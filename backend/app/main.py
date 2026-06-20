"""
装修管家 API — FastAPI 入口
包含结构化日志、请求追踪、自动轮转。
生产模式: 自动 serve 前端静态文件（单端口 8765）
开发模式: Vite dev server 独立端口，后端只管 /api
"""

from .logging_config import setup_logging, get_logger
from .middleware import RequestLoggingMiddleware

# ── 最先初始化日志 ──
setup_logging()
logger = get_logger("house_design")

logger.info("Starting 装修管家 API...")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from .database import engine, Base
from .routers import items_router, dashboard_router, import_router, export_router, versions_router
from .routers.floorplan_router import router as floorplan_router
from .routers.log_router import router as log_router
from .routers.decision_router import router as decision_router
from .routers.agent_router import router as agent_router
import os

# 建表
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="装修管家 API",
    description="嘉兴五层别墅装修采购预算管理系统",
    version="1.0.0",
)

# ── 中间件（顺序很重要 — 日志中间件最先执行 / 最后返回） ──
app.add_middleware(RequestLoggingMiddleware)

# 认证中间件 — 在 CORS 之前注册
from .auth import AuthMiddleware
app.add_middleware(AuthMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# GZip 压缩 — 大幅减少传输大小（1.6MB JS → ~460KB）
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ── API 路由 ──
app.include_router(items_router)
app.include_router(dashboard_router)
app.include_router(import_router)
app.include_router(export_router)
app.include_router(versions_router)
app.include_router(floorplan_router)
app.include_router(log_router)
app.include_router(decision_router)
app.include_router(agent_router)

@app.get("/api/health")
def health():
    logger.debug("Health check called")
    return {"status": "ok", "app": "装修管家"}


# ── 登录 API ──
@app.post("/api/auth/login")
async def login(body: dict):
    """用户名+密码登录，返回 JWT token"""
    from .auth import handle_login
    return handle_login(body.get("username", ""), body.get("password", ""))

# ── 生产模式：挂载前端静态文件（单端口 8765） ──
# 必须放在所有 API 路由之后，否则通配路由会吞噬 /api/* 请求
STATIC_DIR = os.environ.get(
    "HOUSE_STATIC_DIR",
    os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")
)
IS_PROD = os.path.isdir(STATIC_DIR)

if IS_PROD:
    # 显式注册 / 路由，避免被 /{full_path:path} 通配但 Starlette
    # 某些版本中 path converter 不匹配空路径段的问题
    @app.get("/", include_in_schema=False)
    async def serve_root():
        """SPA 根路径 → 返回 index.html"""
        with open(os.path.join(STATIC_DIR, "index.html"), "r") as f:
            return HTMLResponse(content=f.read())

    # SPA 通配路由：所有非 /api 请求 → 检查真实文件 → 否则返回 index.html
    # 注意：必须在所有具名路由之后注册，且不得拦截 /api /docs /openapi.json
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        """非 API 请求 → 优先返回真实静态文件 → 否则 SPA fallback"""
        # 安全守卫：绝不拦截 API / docs 路径（二次保障，正常不会走到这里）
        if full_path.startswith("api/") or full_path in ("docs", "openapi.json", "redoc"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)

        file_path = os.path.join(STATIC_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        # SPA fallback：返回 index.html，让前端路由接管
        with open(os.path.join(STATIC_DIR, "index.html"), "r") as f:
            return HTMLResponse(content=f.read())

    logger.info(f"Frontend mounted ({STATIC_DIR})")
else:
    logger.info("Frontend not found — running in dev mode (API only)")


@app.on_event("startup")
async def startup():
    mode = "production" if os.path.isdir(STATIC_DIR) else "development"
    logger.info("API server ready", extra={"extra": {"mode": mode, "docs": "http://localhost:8765/docs"}})


@app.on_event("shutdown")
async def shutdown():
    logger.info("API server shutting down")
