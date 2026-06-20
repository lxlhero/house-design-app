"""
装修管家 · Hermes Agent 桥接
- 直接使用 Hermes Agent 的 DeepSeek API key，调用同款模型
- 支持工具调用（function calling）：Agent 可以直接修改数据库
- 流式返回，工具调用时静默执行后继续流式输出
"""
import os, json, httpx
from ..logging_config import get_logger
from .agent_tools import TOOLS, set_db, execute_tool

logger = get_logger("house_design.agent")

# 从 Hermes Agent 的 .env 读取 key
HERMES_ENV = "/Users/huron/.hermes/profiles/mom/.env"
def _load_hermes_key():
    if os.path.exists(HERMES_ENV):
        with open(HERMES_ENV) as f:
            for line in f:
                line = line.strip()
                if line.startswith("DEEPSEEK_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    return os.getenv("DEEPSEEK_API_KEY", "")

LLM_KEY = _load_hermes_key()
LLM_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com") + "/chat/completions"
LLM_MODEL = "deepseek-chat"

logger.info(f"Agent using Hermes key: {'yes' if LLM_KEY else 'no'}")

SYSTEM_PROMPT = """你是装修管家小美，帮一位妈妈管理嘉兴五层别墅（地上三层+地下两层）的装修。

⚠️ 重要规则（最高优先级）：
当用户提到任何涉及数据的操作（购买、下单、花费、花了、买了、更新、修改、改成、改预算、记录...），
你必须立即调用对应的工具函数来实际操作数据库，不能只回复文字。
例如：用户说「中央空调花了5万」→ 你必须调用 search_items + update_item_supplier + update_item_status

可用工具：
- search_items：查找采购项
- update_item_budget：修改预算
- update_item_status：修改状态（未开始/已下单/已支付/已到货/已安装/已完成）
- update_item_supplier：记录实际花费、供应商
- get_budget_summary：查看预算总览
- get_phase_status：查看阶段进度
- update_total_budget：修改总预算

回复风格：亲切温暖，每次 2-4 句话，加适当 emoji。工具执行完后简单告知结果即可。"""


async def _stream_llm(messages: list[dict], include_tools: bool = True, force_tools: bool = False):
    """流式调用 DeepSeek API，返回逐行 SSE 数据"""
    payload = {
        "model": LLM_MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 1024,
        "stream": True,
    }
    if include_tools:
        payload["tools"] = TOOLS
        payload["tool_choice"] = "required" if force_tools else "auto"

    async with httpx.AsyncClient(timeout=60.0) as client:
        async with client.stream(
            "POST", LLM_URL,
            headers={"Authorization": f"Bearer {LLM_KEY}", "Content-Type": "application/json"},
            json=payload,
        ) as resp:
            if resp.status_code != 200:
                body = await resp.aread()
                raise Exception(f"AI 服务异常 ({resp.status_code}): {body[:200]}")

            async for line in resp.aiter_lines():
                yield line


async def stream_chat(message: str, history: list[dict], db=None):
    """流式对话 + 工具调用循环（最多 3 轮工具调用）"""

    if not LLM_KEY:
        yield f"data: {json.dumps({'error': '未配置DeepSeek API key，请检查 ~/.hermes/profiles/mom/.env'})}\n\n"
        yield "data: [DONE]\n\n"
        return

    # 设置 DB 供 tool 使用
    if db:
        set_db(db)

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if history:
        messages.extend(history[-10:])  # 限制历史长度，避免工具指令被淹没
    messages.append({"role": "user", "content": message})

    # 检测是否需要强制工具调用
    force_tools = any(kw in message for kw in [
        '花了', '买了', '下单', '支付', '到货', '安装', '完成',
        '改成', '修改', '更新', '改预算', '记录', '花费', '付了',
        '多少钱', '预算', '多少万', '进度', '状态', '阶段',
    ])
    logger.info(f"Chat: msg={message[:50]}, history={len(history)}, force_tools={force_tools}")

    # ═══ 工具调用循环（最多 3 轮） ═══
    for round_num in range(3):
        tool_calls_buffer = []  # [{id, name, arguments}]
        content_buffer = ""

        try:
            async for line in _stream_llm(messages, include_tools=True, force_tools=force_tools):
                if not line.startswith("data: "):
                    continue
                data_str = line[6:]
                if data_str == "[DONE]":
                    break

                try:
                    chunk = json.loads(data_str)
                    delta = chunk.get("choices", [{}])[0].get("delta", {})

                    text = delta.get("content", "")
                    if text:
                        content_buffer += text
                        yield f"data: {json.dumps({'text': text})}\n\n"

                    for tc in delta.get("tool_calls", []):
                        idx = tc.get("index", 0)
                        while len(tool_calls_buffer) <= idx:
                            tool_calls_buffer.append({"id": "", "name": "", "arguments": ""})
                        if "id" in tc:
                            tool_calls_buffer[idx]["id"] = tc["id"]
                        func = tc.get("function", {})
                        if "name" in func:
                            tool_calls_buffer[idx]["name"] = func["name"]
                        if "arguments" in func:
                            tool_calls_buffer[idx]["arguments"] += func["arguments"]

                except json.JSONDecodeError:
                    continue

        except Exception as e:
            yield f"data: {json.dumps({'error': f'连接失败: {str(e)[:100]}'})}\n\n"
            yield "data: [DONE]\n\n"
            return

        # ── 没有工具调用 → 对话结束 ──
        if not tool_calls_buffer:
            yield "data: [DONE]\n\n"
            return

        # ── 有工具调用 → 添加 assistant 消息到历史 ──
        assistant_msg = {"role": "assistant", "content": content_buffer or None, "tool_calls": []}
        for tc in tool_calls_buffer:
            if tc["name"]:
                assistant_msg["tool_calls"].append({
                    "id": tc["id"],
                    "type": "function",
                    "function": {"name": tc["name"], "arguments": tc["arguments"]}
                })
        messages.append(assistant_msg)

        # ── 执行工具并添加结果 ──
        for tc in tool_calls_buffer:
            if not tc["name"]:
                continue
            try:
                args = json.loads(tc["arguments"]) if tc["arguments"] else {}
            except json.JSONDecodeError:
                args = {}

            result = execute_tool(tc["name"], args)
            logger.info(f"Tool: {tc['name']} → {result[:100]}")

            yield f"data: {json.dumps({'tool': tc['name'], 'result': result[:200]})}\n\n"

            messages.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "content": result
            })

        # ── 继续循环，LLM 将基于工具结果生成最终回复 ──

    # 最终兜底（理论上不会到这里）
    try:
        async for line in _stream_llm(messages, include_tools=False):
            if not line.startswith("data: ") or line[6:] == "[DONE]":
                continue
            try:
                chunk = json.loads(line[6:])
                text = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                if text:
                    yield f"data: {json.dumps({'text': text})}\n\n"
            except json.JSONDecodeError:
                continue
    except Exception as e:
        yield f"data: {json.dumps({'error': f'生成失败: {str(e)[:100]}'})}\n\n"

    yield "data: [DONE]\n\n"


async def generate_title(message: str) -> str:
    """根据首条消息生成3-8字对话标题"""
    if not LLM_KEY:
        return message[:10] + ("…" if len(message) > 10 else "")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                LLM_URL,
                headers={"Authorization": f"Bearer {LLM_KEY}", "Content-Type": "application/json"},
                json={
                    "model": LLM_MODEL,
                    "messages": [
                        {"role": "system", "content": "用3到8个字回应，只输出标题本身，不加任何标点或解释。"},
                        {"role": "user", "content": f"给这段对话起个标题：{message}"},
                    ],
                    "max_tokens": 20,
                    "temperature": 0.3,
                },
            )
            data = resp.json()
            title = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
            return title[:15] or message[:8] + "…"
    except Exception:
        return message[:10] + ("…" if len(message) > 10 else "")
