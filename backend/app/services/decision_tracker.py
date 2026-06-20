"""
装修管家 · 决策追踪
每次业务操作记录独立决策日志，配合中间件实现全链路可追溯。
"""
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from ..logging_config import LOG_DIR, get_logger

logger = get_logger("house_design.decision")
DECISION_LOG = LOG_DIR / "decisions.jsonl"


def track(action, target, detail=None, decision_id=None, session_id=None, request_id=None, status="ok"):
    """记录一次决策"""
    entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "decision_id": decision_id or f"dec_{uuid.uuid4().hex[:10]}",
        "session_id": session_id or "-",
        "request_id": request_id or "-",
        "action": action,
        "target": target,
        "status": status,
        "detail": detail or {},
    }
    try:
        with open(DECISION_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False, default=str) + "\n")
    except Exception as e:
        logger.error(f"Decision log write failed: {e}")
    logger.info(f"Decision: {action}/{target}", extra={"extra": entry})
    return entry["decision_id"]


def query(limit=50, action=None) -> list:
    """查询决策记录"""
    if not DECISION_LOG.exists():
        return []
    results = []
    try:
        with open(DECISION_LOG, "r", encoding="utf-8") as f:
            for line in list(f.readlines())[-500:]:
                try:
                    e = json.loads(line.strip())
                    if action and e.get("action") != action:
                        continue
                    results.append(e)
                except json.JSONDecodeError:
                    continue
    except Exception:
        pass
    return list(reversed(results))[-limit:]
