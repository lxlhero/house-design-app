"""
装修管家 — 最简用户名+密码认证
生产环境通过环境变量 HOUSE_USER / HOUSE_PASS 设置。
JWT 30天有效，登录一次管一个月。
"""

import os
import secrets
from pathlib import Path
from datetime import datetime, timedelta
from fastapi import Request, HTTPException

# 自动加载 .env 文件（如果存在）
try:
    from dotenv import load_dotenv
    _env_path = Path(__file__).resolve().parent.parent / ".env"
    if _env_path.exists():
        load_dotenv(_env_path)
except ImportError:
    pass
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from .logging_config import get_logger

logger = get_logger("house_design.auth")

# ── 配置 ──
HOUSE_USER = os.getenv("HOUSE_USER", "mama")
HOUSE_PASS = os.getenv("HOUSE_PASS", "change-me-please")
JWT_SECRET = os.getenv("JWT_SECRET", secrets.token_hex(32))
JWT_EXPIRE_DAYS = 30

# Lazy import pyjwt
def _jwt():
    global jwt
    if 'jwt' not in globals():
        import jwt as _jwt_module
        globals()['jwt'] = _jwt_module
    return jwt

# ── JWT 工具 ──

def create_token() -> str:
    """生成 30 天有效的 JWT"""
    expire = datetime.utcnow() + timedelta(days=JWT_EXPIRE_DAYS)
    return _jwt().encode(
        {"sub": "house_user", "exp": expire},
        JWT_SECRET,
        algorithm="HS256"
    )

def verify_token(token: str) -> bool:
    """验证 JWT 是否有效"""
    try:
        _jwt().decode(token, JWT_SECRET, algorithms=["HS256"])
        return True
    except Exception:
        return False

# ── 认证中间件 ──

class AuthMiddleware(BaseHTTPMiddleware):
    """拦截 /api/* 请求，验证 JWT（放行 login、health、日志等）"""

    PUBLIC_PATHS = {"/api/auth/login", "/api/health"}
    PUBLIC_PREFIXES = ("/api/logs/",)  # 日志查看也放行（方便调试）

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # 放行: 非 API 路径（前端静态文件）
        if not path.startswith("/api/"):
            return await call_next(request)

        # 放行: 白名单
        if path in self.PUBLIC_PATHS:
            return await call_next(request)
        if path.startswith(self.PUBLIC_PREFIXES):
            return await call_next(request)

        # 验证 token（优先从 Header，其次 Cookie）
        token = (
            request.headers.get("Authorization", "").replace("Bearer ", "")
            or request.cookies.get("house_token", "")
        )
        if not token or not verify_token(token):
            logger.warning("Auth failed", extra={"extra": {"path": path}})
            return JSONResponse(status_code=401, content={"detail": "请先登录"})

        return await call_next(request)


# ── 登录 API 处理器 ──

def handle_login(username: str, password: str) -> dict:
    """处理登录请求，返回 token 和过期信息"""
    if username == HOUSE_USER and password == HOUSE_PASS:
        token = create_token()
        logger.info("User logged in", extra={"extra": {"username": username}})
        return {"token": token, "expires_in_days": JWT_EXPIRE_DAYS}
    logger.warning("Login failed", extra={"extra": {"username": username}})
    raise HTTPException(status_code=401, detail="用户名或密码错误")
