"""Hermes Agent SSE 端点 — 桥接本机 Hermes CLI"""
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from ..services.agent import stream_chat

router = APIRouter(prefix="/api/agent", tags=["agent"])


@router.post("/chat")
async def chat(request: Request):
    body = await request.json()
    message = body.get("message", "")
    history = body.get("history", [])

    async def event_stream():
        async for chunk in stream_chat(message, history):
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
