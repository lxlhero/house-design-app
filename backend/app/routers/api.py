from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from ..database import get_db
from ..models.models import Category, Item, Phase, FloorBudget, ImportLog
from ..logging_config import get_logger

router = APIRouter(prefix="/api", tags=["api"])
logger = get_logger("house_design.api")


# ─── 仪表盘概览 ───

@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    """预算总览数据"""
    categories = db.query(Category).all()
    total = sum(c.control_budget for c in categories)
    items = db.query(Item).all()

    status_counts = {}
    for it in items:
        status_counts[it.status] = status_counts.get(it.status, 0) + 1

    priority_counts = {}
    for it in items:
        priority_counts[it.priority] = priority_counts.get(it.priority, 0) + 1

    attr_counts = {}
    for it in items:
        a = it.attr
        attr_counts[a] = attr_counts.get(a, 0) + 1

    return {
        "total_budget": total,
        "total_items": len(items),
        "categories": [{
            "id": c.id, "name": c.name, "control_budget": c.control_budget,
            "ratio": c.ratio, "purchase_timing": c.purchase_timing,
            "priority": c.priority
        } for c in categories],
        "status_counts": status_counts,
        "priority_counts": priority_counts,
        "attr_counts": attr_counts,
    }


# ─── 采购清单 CRUD ───

@router.get("/items")
def list_items(
    db: Session = Depends(get_db),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    phase: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    floor: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("id"),
    sort_dir: str = Query("asc"),
    limit: int = Query(200),
    offset: int = Query(0),
):
    q = db.query(Item)
    if status:
        q = q.filter(Item.status == status)
    if priority:
        q = q.filter(Item.priority == priority)
    if phase:
        q = q.filter(Item.phase.like(f"%{phase}%"))
    if category:
        q = q.filter(Item.category == category)
    if floor:
        q = q.filter(Item.floor_space.like(f"%{floor}%"))
    if search:
        q = q.filter(Item.item_name.like(f"%{search}%"))

    col = getattr(Item, sort_by, Item.id)
    if sort_dir == "desc":
        col = col.desc()
    q = q.order_by(col)

    total = q.count()
    items = q.offset(offset).limit(limit).all()
    if total > 0:
        logger.debug("Items listed", extra={"extra": {"total": total, "filters": {"status": status, "category": category, "floor": floor, "search": search}}})
    return {
        "total": total,
        "items": [{
            "id": it.id, "floor_space": it.floor_space, "category": it.category,
            "item_name": it.item_name, "attr": it.attr, "phase": it.phase,
            "suggestion": it.suggestion, "timing": it.timing,
            "budget_min": it.budget_min, "budget_max": it.budget_max,
            "control_budget": it.control_budget, "brand_recommendation": it.brand_recommendation,
            "priority": it.priority, "status": it.status, "notes": it.notes,
            "actual_cost": it.actual_cost, "actual_paid": it.actual_paid,
            "supplier": it.supplier, "supplier_contact": it.supplier_contact,
            "created_at": str(it.created_at), "updated_at": str(it.updated_at),
        } for it in items]
    }


@router.get("/items/{item_id}")
def get_item(item_id: int, db: Session = Depends(get_db)):
    it = db.query(Item).filter(Item.id == item_id).first()
    if not it:
        return {"error": "not found"}
    return {
        "id": it.id, "floor_space": it.floor_space, "category": it.category,
        "item_name": it.item_name, "attr": it.attr, "phase": it.phase,
        "suggestion": it.suggestion, "timing": it.timing,
        "budget_min": it.budget_min, "budget_max": it.budget_max,
        "control_budget": it.control_budget, "brand_recommendation": it.brand_recommendation,
        "priority": it.priority, "status": it.status, "notes": it.notes,
        "actual_cost": it.actual_cost, "actual_paid": it.actual_paid,
        "supplier": it.supplier, "supplier_contact": it.supplier_contact,
    }


@router.patch("/items/{item_id}")
def update_item(item_id: int, data: dict, db: Session = Depends(get_db)):
    it = db.query(Item).filter(Item.id == item_id).first()
    if not it:
        return {"error": "not found"}
    for field in ["status", "actual_cost", "actual_paid", "supplier",
                   "supplier_contact", "notes", "priority"]:
        if field in data:
            setattr(it, field, data[field])
    db.commit()
    db.refresh(it)
    logger.info("Item updated", extra={"extra": {"item_id": item_id, "fields": [k for k in data if k in ["status", "actual_cost", "actual_paid", "supplier", "supplier_contact", "notes", "priority"]]}})
    return {"ok": True}


# ─── 装修阶段 ───

@router.get("/phases")
def list_phases(db: Session = Depends(get_db)):
    phases = db.query(Phase).order_by(Phase.phase_num).all()
    return [{
        "id": p.id, "phase_num": p.phase_num, "name": p.name,
        "month_range": p.month_range, "core_tasks": p.core_tasks,
        "must_decide": p.must_decide, "dont_buy_early": p.dont_buy_early,
        "check_points": p.check_points, "related_categories": p.related_categories,
    } for p in phases]


# ─── 楼层预算 ───

@router.get("/floors")
def list_floors(db: Session = Depends(get_db)):
    floors = db.query(FloorBudget).all()
    return [{
        "id": f.id, "floor": f.floor, "spaces": f.spaces,
        "must_do": f.must_do, "budget_min": f.budget_min,
        "budget_max": f.budget_max, "control_budget": f.control_budget,
        "can_save": f.can_save, "must_not_save": f.must_not_save,
    } for f in floors]


# ─── 筛选选项 ───

@router.get("/filter-options")
def filter_options(db: Session = Depends(get_db)):
    items = db.query(Item).all()
    return {
        "statuses": sorted(set(it.status for it in items if it.status)),
        "priorities": sorted(set(it.priority for it in items if it.priority)),
        "categories": sorted(set(it.category for it in items if it.category)),
        "attrs": sorted(set(it.attr for it in items if it.attr)),
        "phases": sorted(set(it.phase for it in items if it.phase)),
    }


# ─── 导入日志 ───

@router.get("/import-logs")
def import_logs(db: Session = Depends(get_db), limit: int = 10):
    logs = db.query(ImportLog).order_by(ImportLog.imported_at.desc()).limit(limit).all()
    return [{
        "id": l.id, "filename": l.filename,
        "items_created": l.items_created, "items_updated": l.items_updated,
        "items_unchanged": l.items_unchanged,
        "imported_at": str(l.imported_at),
    } for l in logs]
