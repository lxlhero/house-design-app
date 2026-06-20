"""决策日志查询 API"""
from fastapi import APIRouter, Query
from ..services.decision_tracker import query

router = APIRouter(prefix="/api/decisions", tags=["decisions"])


@router.get("")
def list_decisions(limit: int = Query(50, ge=1, le=200), action: str = Query(None)):
    return {"items": query(limit=limit, action=action)}
