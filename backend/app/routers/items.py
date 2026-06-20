"""采购清单 CRUD API"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from ..database import get_db
from ..models.models import Item
from ..services.excel_store import sync_db_to_excel
from ..logging_config import get_logger

router = APIRouter(prefix="/api/items", tags=["items"])
logger = get_logger("house_design.items")


@router.get("")
def list_items(
    db: Session = Depends(get_db),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    phase: Optional[str] = Query(None),
    floor_space: Optional[str] = Query(None),
    attr: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    q = db.query(Item)
    if status:
        q = q.filter(Item.status == status)
    if priority:
        q = q.filter(Item.priority == priority)
    if category:
        q = q.filter(Item.category == category)
    if phase:
        q = q.filter(Item.phase == phase)
    if floor_space:
        q = q.filter(Item.floor_space.like(f"%{floor_space}%"))
    if attr:
        q = q.filter(Item.attr == attr)
    if search:
        q = q.filter(
            Item.item_name.like(f"%{search}%") |
            Item.notes.like(f"%{search}%") |
            Item.brand_recommendation.like(f"%{search}%")
        )

    total = q.count()
    items = q.order_by(Item.id).offset((page - 1) * page_size).limit(page_size).all()
    if total > 0:
        logger.debug("Items listed", extra={"extra": {"total": total, "filters": {"status": status, "category": category, "floor_space": floor_space, "search": search}}})

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": i.id, "floor_space": i.floor_space,
                "category": i.category, "item_name": i.item_name,
                "attr": i.attr, "phase": i.phase,
                "suggestion": i.suggestion, "timing": i.timing,
                "budget_min": i.budget_min, "budget_max": i.budget_max,
                "control_budget": i.control_budget,
                "brand_recommendation": i.brand_recommendation,
                "priority": i.priority, "status": i.status,
                "notes": i.notes,
                "actual_cost": i.actual_cost, "actual_paid": i.actual_paid,
                "supplier": i.supplier, "supplier_contact": i.supplier_contact,
                "updated_at": i.updated_at.isoformat() if i.updated_at else "",
            }
            for i in items
        ],
    }


@router.get("/filters")
def filter_options(db: Session = Depends(get_db)):
    """返回所有筛选选项的可用值"""
    return {
        "statuses": [r[0] for r in db.query(Item.status).distinct().all() if r[0]],
        "priorities": [r[0] for r in db.query(Item.priority).distinct().all() if r[0]],
        "categories": [r[0] for r in db.query(Item.category).distinct().all() if r[0]],
        "phases": [r[0] for r in db.query(Item.phase).distinct().all() if r[0]],
        "attrs": [r[0] for r in db.query(Item.attr).distinct().all() if r[0]],
    }


@router.get("/{item_id}")
def get_item(item_id: int, db: Session = Depends(get_db)):
    i = db.query(Item).filter(Item.id == item_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="Item not found")
    return {
        "id": i.id, "floor_space": i.floor_space,
        "category": i.category, "item_name": i.item_name,
        "attr": i.attr, "phase": i.phase,
        "suggestion": i.suggestion, "timing": i.timing,
        "budget_min": i.budget_min, "budget_max": i.budget_max,
        "control_budget": i.control_budget,
        "brand_recommendation": i.brand_recommendation,
        "priority": i.priority, "status": i.status, "notes": i.notes,
        "actual_cost": i.actual_cost, "actual_paid": i.actual_paid,
        "supplier": i.supplier, "supplier_contact": i.supplier_contact,
        "updated_at": i.updated_at.isoformat() if i.updated_at else "",
    }


@router.patch("/{item_id}")
def update_item(item_id: int, data: dict, db: Session = Depends(get_db)):
    i = db.query(Item).filter(Item.id == item_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="Item not found")

    updatable = [
        "status", "actual_cost", "actual_paid", "supplier",
        "supplier_contact", "notes", "priority"
    ]
    for field in updatable:
        if field in data:
            setattr(i, field, data[field])

    db.commit()
    db.refresh(i)
    # 同步到本地 Excel
    sync_db_to_excel(db)
    logger.info("Item updated", extra={"extra": {"item_id": item_id, "fields": [k for k in data if k in updatable]}})
    return {"ok": True, "id": i.id}


@router.patch("/batch/status")
def batch_update_status(data: dict, db: Session = Depends(get_db)):
    """批量更新状态: {ids: [1,2,3], status: '已下单'}"""
    ids = data.get("ids", [])
    new_status = data.get("status", "")
    if not ids or not new_status:
        raise HTTPException(status_code=400, detail="ids and status required")

    updated = db.query(Item).filter(Item.id.in_(ids)).update(
        {"status": new_status}, synchronize_session=False
    )
    db.commit()
    # 同步到本地 Excel
    sync_db_to_excel(db)
    logger.info("Batch status update", extra={"extra": {"count": updated, "status": new_status}})
    return {"ok": True, "updated": updated}
