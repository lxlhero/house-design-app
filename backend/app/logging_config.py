"""
装修管家 — 结构化日志系统
==========================
JSON Lines 格式，支持文件轮转、分级过滤、请求追踪。
"""

import logging
import json
import sys
import os
import time
import traceback
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler
from pathlib import Path
from datetime import datetime, timezone

LOG_DIR = Path(os.environ.get("HOUSE_LOG_DIR", os.path.join(os.path.dirname(__file__), "..", "logs")))
LOG_DIR.mkdir(parents=True, exist_ok=True)

LOG_LEVEL = os.environ.get("HOUSE_LOG_LEVEL", "INFO").upper()
LOG_MAX_BYTES = int(os.environ.get("HOUSE_LOG_MAX_BYTES", 10 * 1024 * 1024))  # 10MB
LOG_BACKUP_COUNT = int(os.environ.get("HOUSE_LOG_BACKUPS", 10))
LOG_RETENTION_DAYS = int(os.environ.get("HOUSE_LOG_RETENTION_DAYS", 30))


class JsonFormatter(logging.Formatter):
    """JSON Lines 格式化器 — 每行一条 JSON 记录"""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        if hasattr(record, "request_id"):
            log_entry["request_id"] = record.request_id
        if hasattr(record, "path"):
            log_entry["path"] = record.path
        if hasattr(record, "method"):
            log_entry["method"] = record.method
        if hasattr(record, "status_code"):
            log_entry["status_code"] = record.status_code
        if hasattr(record, "duration_ms"):
            log_entry["duration_ms"] = round(record.duration_ms, 2)
        if hasattr(record, "client_ip"):
            log_entry["client_ip"] = record.client_ip
        if hasattr(record, "extra"):
            log_entry.update(record.extra)

        if record.exc_info and record.exc_info[0]:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "traceback": traceback.format_exception(*record.exc_info),
            }

        return json.dumps(log_entry, ensure_ascii=False, default=str)


class RequestIdFilter(logging.Filter):
    """注入 request_id 到日志记录"""

    def __init__(self):
        super().__init__()
        self._request_id = None

    def set_request_id(self, request_id: str):
        self._request_id = request_id

    def filter(self, record):
        record.request_id = self._request_id or "-"
        return True


# 全局 request_id 过滤器
request_id_filter = RequestIdFilter()


def setup_logging():
    """初始化日志系统 — 在应用启动时调用一次"""

    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))

    # 清除已有的 handlers（避免重复）
    root_logger.handlers.clear()

    # ── 1. 控制台输出（开发时查看） ──
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG if LOG_LEVEL == "DEBUG" else logging.INFO)
    console_handler.setFormatter(JsonFormatter())
    console_handler.addFilter(request_id_filter)
    root_logger.addHandler(console_handler)

    # ── 2. 应用日志文件（按大小轮转） ──
    app_log = LOG_DIR / "app.log"
    app_handler = RotatingFileHandler(
        str(app_log), maxBytes=LOG_MAX_BYTES, backupCount=LOG_BACKUP_COUNT, encoding="utf-8"
    )
    app_handler.setLevel(logging.DEBUG)
    app_handler.setFormatter(JsonFormatter())
    app_handler.addFilter(request_id_filter)
    root_logger.addHandler(app_handler)

    # ── 3. 错误日志文件（只记录 ERROR 及以上） ──
    error_log = LOG_DIR / "error.log"
    error_handler = RotatingFileHandler(
        str(error_log), maxBytes=LOG_MAX_BYTES, backupCount=LOG_BACKUP_COUNT, encoding="utf-8"
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(JsonFormatter())
    error_handler.addFilter(request_id_filter)
    root_logger.addHandler(error_handler)

    # ── 4. 访问日志文件（每天轮转，保留 30 天） ──
    access_log = LOG_DIR / "access.log"
    access_handler = TimedRotatingFileHandler(
        str(access_log), when="midnight", interval=1, backupCount=LOG_RETENTION_DAYS, encoding="utf-8"
    )
    access_handler.setLevel(logging.INFO)
    access_handler.setFormatter(JsonFormatter())
    access_handler.addFilter(request_id_filter)
    root_logger.addHandler(access_handler)

    # ── 抑制过于嘈杂的第三方库 ──
    for noisy in ["uvicorn.access", "uvicorn.error", "sqlalchemy.engine"]:
        logging.getLogger(noisy).setLevel(logging.WARNING)

    root_logger.info("Logging system initialized", extra={
        "extra": {"log_dir": str(LOG_DIR), "level": LOG_LEVEL}
    })
    return root_logger


def get_logger(name: str = None) -> logging.Logger:
    """获取 logger 实例"""
    logger = logging.getLogger(name or "house_design")
    logger.addFilter(request_id_filter)
    return logger


def set_request_context(request_id: str, path: str = None, method: str = None):
    """为当前请求设置上下文"""
    request_id_filter.set_request_id(request_id)
    if path:
        logging.getLogger("house_design.request").info(
            "request_start", extra={"extra": {"path": path, "method": method}}
        )


def log_request_end(status_code: int, duration_ms: float):
    """记录请求完成"""
    logging.getLogger("house_design.request").info(
        "request_end",
        extra={"extra": {"status_code": status_code, "duration_ms": round(duration_ms, 2)}},
    )
