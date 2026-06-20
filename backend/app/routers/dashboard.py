"""仪表盘 API"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from ..models.models import Category, Item, Phase, FloorBudget, BudgetConfig, VersionSnapshot
from ..services.excel_store import sync_db_to_excel
from ..logging_config import get_logger

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])
logger = get_logger("house_design.dashboard")


def _get_total_budget(db: Session) -> float:
    """读取总预算：优先从 BudgetConfig，否则从 categories 总和推算"""
    cfg = db.query(BudgetConfig).filter(BudgetConfig.key == "total_budget").first()
    if cfg and cfg.value > 0:
        return cfg.value
    # 从 Excel 导入后初次：categories 总和即为总预算
    return db.query(func.sum(Category.control_budget)).scalar() or 0


def _sync_budget_config(db: Session):
    """确保 BudgetConfig 中有总预算记录"""
    cfg = db.query(BudgetConfig).filter(BudgetConfig.key == "total_budget").first()
    if not cfg:
        total = db.query(func.sum(Category.control_budget)).scalar() or 0
        db.add(BudgetConfig(key="total_budget", value=total))
        db.commit()


@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    _sync_budget_config(db)
    total = _get_total_budget(db)

    items_count = db.query(func.count(Item.id)).scalar() or 0
    status_counts = (
        db.query(Item.status, func.count(Item.id))
        .group_by(Item.status).all()
    )
    status_map = {s: c for s, c in status_counts}
    total_actual = db.query(func.sum(Item.actual_cost)).scalar() or 0
    total_paid = db.query(func.sum(Item.actual_paid)).scalar() or 0
    priority_counts = (
        db.query(Item.priority, func.count(Item.id))
        .group_by(Item.priority).all()
    )

    return {
        "total_budget": total,
        "total_items": items_count,
        "total_actual": total_actual,
        "total_paid": total_paid,
        "budget_remaining": total - total_actual,
        "status_counts": status_map,
        "priority_counts": [{"priority": p, "count": c} for p, c in priority_counts if p],
    }


@router.patch("/budget")
def update_budget(data: dict, db: Session = Depends(get_db)):
    """更新总预算：修改 BudgetConfig + 自动调整预备金来平衡"""
    new_total = data.get("total_budget", 0)
    if new_total <= 0:
        return {"error": "总预算必须大于0"}

    # 更新/创建 BudgetConfig
    cfg = db.query(BudgetConfig).filter(BudgetConfig.key == "total_budget").first()
    if not cfg:
        cfg = BudgetConfig(key="total_budget", value=new_total)
        db.add(cfg)
    else:
        cfg.value = new_total

    # 调整预备金：使 categories 总和 = new_total
    non_reserve_sum = db.query(func.sum(Category.control_budget)).filter(
        Category.name != "预备金"
    ).scalar() or 0
    new_reserve = new_total - non_reserve_sum

    reserve_cat = db.query(Category).filter(Category.name == "预备金").first()
    if reserve_cat:
        reserve_cat.control_budget = max(0, new_reserve)
        reserve_cat.ratio = max(0, new_reserve / new_total) if new_total > 0 else 0

    db.commit()
    # 同步到本地 Excel
    sync_db_to_excel(db)
    return {"ok": True, "total_budget": new_total, "reserve_adjusted_to": max(0, new_reserve)}


@router.get("/categories")
def categories(db: Session = Depends(get_db)):
    cats = db.query(Category).order_by(Category.control_budget.desc()).all()
    return [
        {
            "id": c.id, "name": c.name,
            "control_budget": c.control_budget, "ratio": c.ratio,
            "purchase_timing": c.purchase_timing, "priority": c.priority,
            "items_total": db.query(func.count(Item.id)).filter(Item.category == c.name).scalar() or 0,
            "items_completed": db.query(func.count(Item.id))
                .filter(Item.category == c.name, Item.status.in_(["已安装", "已下单"])).scalar() or 0,
            "actual_spent": db.query(func.sum(Item.actual_cost))
                .filter(Item.category == c.name).scalar() or 0,
        }
        for c in cats
    ]


@router.get("/phases")
def phases(db: Session = Depends(get_db)):
    ps = db.query(Phase).order_by(Phase.phase_num).all()
    return [
        {"id": p.id, "phase_num": p.phase_num, "name": p.name,
         "month_range": p.month_range, "core_tasks": p.core_tasks,
         "must_decide": p.must_decide, "dont_buy_early": p.dont_buy_early,
         "check_points": p.check_points, "related_categories": p.related_categories}
        for p in ps
    ]


@router.get("/floors")
def floors(db: Session = Depends(get_db)):
    fs = db.query(FloorBudget).all()
    return [
        {"id": f.id, "floor": f.floor, "spaces": f.spaces,
         "must_do": f.must_do, "budget_min": f.budget_min,
         "budget_max": f.budget_max, "control_budget": f.control_budget,
         "can_save": f.can_save, "must_not_save": f.must_not_save}
        for f in fs
    ]


@router.get("/import-logs")
def import_logs(db: Session = Depends(get_db)):
    logs = db.query(ImportLog).order_by(ImportLog.imported_at.desc()).limit(20).all()
    return [
        {"id": l.id, "filename": l.filename,
         "items_created": l.items_created, "items_updated": l.items_updated,
         "items_unchanged": l.items_unchanged,
         "imported_at": l.imported_at.isoformat() if l.imported_at else ""}
        for l in logs
    ]
