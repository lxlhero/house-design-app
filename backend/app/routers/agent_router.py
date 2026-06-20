"""Hermes Agent SSE 端点（带工具调用能力）"""
from fastapi import APIRouter, Request, Depends
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..services.agent import stream_chat, generate_title

router = APIRouter(prefix="/api/agent", tags=["agent"])


@router.post("/title")
async def title(request: Request):
    """根据首条消息生成对话标题（3-8字）"""
    body = await request.json()
    msg = body.get("message", "")
    if not msg:
        return JSONResponse({"title": "新对话"})
    t = await generate_title(msg)
    return JSONResponse({"title": t})


@router.post("/chat")
async def chat(request: Request, db: Session = Depends(get_db)):
    """流式对话 — Agent 可以调用工具修改数据库"""
    from ..logging_config import get_logger
    logger = get_logger("house_design.agent")
    body = await request.json()
    message = body.get("message", "")
    history = body.get("history", [])

    logger.info(f"Chat request: msg={message[:60]}, history_len={len(history)}")

    async def event_stream():
        async for chunk in stream_chat(message, history, db=db):
            yield chunk

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        }
    )
