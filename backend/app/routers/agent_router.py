"""Mom Agent SSE 流式端点"""
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..services.agent import stream_chat
import json

router = APIRouter(prefix="/api/agent", tags=["agent"])


@router.post("/chat")
async def chat(request: Request):
    """
    POST /api/agent/chat
    Body: {"message": "你好", "history": [...]}
    返回: SSE 流 (text/event-stream)
    """
    body = await request.json()
    message = body.get("message", "")
    history = body.get("history", [])

    db: Session = next(get_db())

    async def event_stream():
        try:
            async for chunk in stream_chat(message, history, db):
                yield chunk
        finally:
            db.close()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        }
    )
