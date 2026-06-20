"""
装修管家 — 请求日志中间件
记录每个 HTTP 请求的路径、方法、状态码、耗时。
"""

import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from .logging_config import set_request_context, log_request_end, get_logger

logger = get_logger("house_design.middleware")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """自动为每个请求注入 request_id 并记录访问日志"""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4())[:8])
        session_id = request.headers.get("X-Session-ID", "-")
        decision_id = request.headers.get("X-Decision-ID", "-")
        set_request_context(
            request_id=request_id,
            path=request.url.path,
            method=request.method,
        )

        # 存 request.state 供路由使用
        request.state.trace_id = request_id
        request.state.session_id = session_id
        request.state.decision_id = decision_id

        start_time = time.time()

        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception as exc:
            status_code = 500
            logger.exception(
                "Unhandled exception in request",
                extra={
                    "extra": {
                        "path": request.url.path,
                        "method": request.method,
                        "error": str(exc),
                    }
                },
            )
            raise

        duration_ms = (time.time() - start_time) * 1000
        log_request_end(status_code=status_code, duration_ms=duration_ms)

        response.headers["X-Request-ID"] = request_id
        return response
