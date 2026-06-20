"""
装修管家 · Hermes Agent 桥接
直接使用 Hermes Agent 的 DeepSeek API key，调用同款模型。
"""
import os, json, httpx
from ..logging_config import get_logger

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


async def stream_chat(message: str, history: list[dict], db=None):
    """调用 DeepSeek API（复用 Hermes 的 key），流式返回"""

    system = """你是装修管家小美。一位妈妈在嘉兴装修五层别墅（总预算120万，52个采购项，当前未开工）。
用温暖亲切的语气回复，每次3-5句话，加适当emoji。她不太懂装修术语，请你通俗解释。"""

    messages = [{"role": "system", "content": system}]
    if history:
        messages.extend(history[-10:])
    messages.append({"role": "user", "content": message})

    if not LLM_KEY:
        yield f"data: {json.dumps({'error': '未配置DeepSeek API key，请检查 ~/.hermes/profiles/mom/.env'})}\n\n"
        yield "data: [DONE]\n\n"
        return

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream(
                "POST", LLM_URL,
                headers={"Authorization": f"Bearer {LLM_KEY}", "Content-Type": "application/json"},
                json={"model": LLM_MODEL, "messages": messages, "stream": True, "temperature": 0.7, "max_tokens": 512},
            ) as resp:
                if resp.status_code != 200:
                    body = await resp.aread()
                    yield f"data: {json.dumps({'error': f'AI服务异常({resp.status_code})'})}\n\n"
                    yield "data: [DONE]\n\n"
                    return

                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]": break
                        try:
                            chunk = json.loads(data)
                            text = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                            if text:
                                yield f"data: {json.dumps({'text': text})}\n\n"
                        except json.JSONDecodeError:
                            continue
    except Exception as e:
        yield f"data: {json.dumps({'error': f'连接失败: {str(e)[:100]}'})}\n\n"

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
