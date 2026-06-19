"""
装修管家 API — FastAPI 入口
包含结构化日志、请求追踪、自动轮转。
"""

from .logging_config import setup_logging, get_logger
from .middleware import RequestLoggingMiddleware

# ── 最先初始化日志 ──
setup_logging()
logger = get_logger("house_design")

logger.info("Starting 装修管家 API...")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import items_router, dashboard_router, import_router, export_router, versions_router
from .routers.floorplan_router import router as floorplan_router
from .routers.log_router import router as log_router

# 建表
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="装修管家 API",
    description="嘉兴五层别墅装修采购预算管理系统",
    version="1.0.0",
)

# ── 中间件（顺序很重要 — 日志中间件最先执行 / 最后返回） ──
app.add_middleware(RequestLoggingMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 路由 ──
app.include_router(items_router)
app.include_router(dashboard_router)
app.include_router(import_router)
app.include_router(export_router)
app.include_router(versions_router)
app.include_router(floorplan_router)
app.include_router(log_router)


@app.get("/api/health")
def health():
    logger.debug("Health check called")
    return {"status": "ok", "app": "装修管家"}


@app.on_event("startup")
async def startup():
    logger.info("API server ready", extra={"extra": {"docs": "http://localhost:8765/docs"}})


@app.on_event("shutdown")
async def shutdown():
    logger.info("API server shutting down")
