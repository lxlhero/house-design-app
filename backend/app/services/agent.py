"""
装修管家 · Mom Agent 服务
======================
构建包含项目全貌的系统提示词，调用 LLM 流式返回。
支持: DeepSeek / OpenAI 兼容 API / Ollama 本地模型
"""
import os
import json
import httpx
from sqlalchemy.orm import Session
from ..models.models import Item, Category, Phase, FloorBudget, BudgetConfig
from ..logging_config import get_logger

logger = get_logger("house_design.agent")

# ═══ LLM 配置 ═══
LLM_API_KEY = os.getenv("HOUSE_AI_API_KEY", os.getenv("DEEPSEEK_API_KEY", ""))
LLM_BASE_URL = os.getenv("HOUSE_AI_BASE_URL", "https://api.deepseek.com")
LLM_MODEL = os.getenv("HOUSE_AI_MODEL", "deepseek-chat")

# 如果没有 API key，尝试本地 Ollama
if not LLM_API_KEY:
    LLM_BASE_URL = os.getenv("OLLAMA_HOST", "http://localhost:11434/v1")
    LLM_MODEL = os.getenv("HOUSE_AI_MODEL", "qwen2.5:7b")
    LLM_API_KEY = "ollama"  # Ollama 不需要 key


def _build_system_prompt(db: Session) -> str:
    """构建包含项目全貌的系统提示词"""
    # 总预算
    cfg = db.query(BudgetConfig).filter(BudgetConfig.key == "total_budget").first()
    total_budget = int(cfg.value) if cfg else 0

    # 物品统计
    total_items = db.query(Item).count()
    items_with_status = db.query(Item.status, db.func.count(Item.id)).group_by(Item.status).all()
    status_text = "、".join(f"{s}:{c}项" for s, c in items_with_status) if items_with_status else "暂无"

    # 大项预算
    cats = db.query(Category).order_by(Category.control_budget.desc()).limit(10).all()
    cat_text = "\n".join(f"  - {c.name}: ¥{c.control_budget/10000:.1f}万" for c in cats)

    # 阶段
    phases = db.query(Phase).order_by(Phase.phase_num).all()
    phases_text = "\n".join(f"  阶段{p.phase_num} {p.name}: {p.month_range} — {p.core_tasks}" for p in phases)

    # 优先级最高的待办
    pending = db.query(Item).filter(Item.status == "未开始").order_by(
        db.case({"最高": 0, "高": 1, "中高": 2}, value=Item.priority)
    ).limit(5).all()
    pending_text = "\n".join(f"  - [{p.priority}] {p.item_name} (预算¥{p.control_budget/10000:.1f}万)" for p in pending) if pending else "暂无待办"

    return f"""你是"装修管家 Mom Agent"，正在帮助一位妈妈管理她在嘉兴的五层别墅装修项目。

## 项目概况
- 总预算: ¥{total_budget/10000:.1f}万
- 采购项总数: {total_items}项
- 各状态分布: {status_text}

## 预算大项
{cat_text}

## 装修阶段
{phases_text}

## 当前待办（优先级从高到低）
{pending_text}

## 你的角色
1. 用温暖亲切的语气和妈妈对话（她不太熟悉装修术语）
2. 主动推进装修进度，提醒下一步该做什么
3. 回答关于预算、采购、施工的问题
4. 根据预算大项给出省钱建议
5. 解释装修概念时用通俗语言
6. 回复简洁有力，每次3-5句话即可
7. 用 emoji 增加亲和力，但不过度
"""


async def stream_chat(message: str, history: list[dict], db: Session):
    """
    流式对话 — 生成器逐块返回内容。
    history: [{"role": "user"|"assistant", "content": "..."}]
    """
    system_prompt = _build_system_prompt(db)

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history[-20:])  # 最近20条历史
    messages.append({"role": "user", "content": message})

    logger.info("Agent chat", extra={"extra": {"msg_len": len(message), "history_len": len(history)}})

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                f"{LLM_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {LLM_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": LLM_MODEL,
                    "messages": messages,
                    "stream": True,
                    "temperature": 0.7,
                    "max_tokens": 1024,
                },
            ) as response:
                if response.status_code != 200:
                    body = await response.aread()
                    logger.error(f"LLM API error: {response.status_code} {body}")
                    yield f"data: {json.dumps({'error': f'AI服务异常({response.status_code})'})}\n\n"
                    return

                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                            delta = chunk.get("choices", [{}])[0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield f"data: {json.dumps({'text': content})}\n\n"
                        except json.JSONDecodeError:
                            continue

    except httpx.ConnectError:
        logger.error("LLM connection failed")
        yield f"data: {json.dumps({'error': '无法连接AI服务，请检查网络或 LLM 配置'})}\n\n"
    except Exception as e:
        logger.exception("Agent stream error")
        yield f"data: {json.dumps({'error': f'服务异常: {str(e)[:100]}'})}\n\n"

    yield "data: [DONE]\n\n"
