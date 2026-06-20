"""仪表盘 API"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from ..models.models import Category, Item, Phase, FloorBudget, BudgetConfig, ImportLog, VersionSnapshot
from ..services.excel_store import sync_db_to_excel
from ..services.decision_tracker import track
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
def update_budget(data: dict, db: Session = Depends(get_db), request: Request = None):
    """更新总预算"""
    new_total = data.get("total_budget", 0)
    if new_total <= 0:
        return {"error": "总预算必须大于0"}

    old_total = _get_total_budget(db)

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
    db.commit()
    sync_db_to_excel(db)
    # 决策追踪
    track("budget_update", "总预算",
          detail={"old": old_total, "new": new_total},
          session_id=getattr(request.state, "session_id", "-") if request else "-",
          request_id=getattr(request.state, "trace_id", "-") if request else "-")
    return {"ok": True, "total_budget": new_total, "reserve_adjusted_to": max(0, new_reserve)}


@router.get("/categories")
def categories(detail: bool = False, db: Session = Depends(get_db)):
    cats = db.query(Category).order_by(Category.control_budget.desc()).all()
    result = []
    for c in cats:
        items = db.query(Item).filter(Item.category == c.name).order_by(
            Item.control_budget.desc()
        ).all()
        items_total = len(items)
        items_completed = sum(1 for i in items if i.status in ("已安装", "已完成"))
        items_active = sum(1 for i in items if i.status in ("已下单", "已支付", "已到货"))

        entry = {
            "id": c.id, "name": c.name,
            "control_budget": c.control_budget, "ratio": c.ratio,
            "purchase_timing": c.purchase_timing, "priority": c.priority,
            "items_total": items_total,
            "items_completed": items_completed,
            "items_active": items_active,
            "actual_spent": sum(i.actual_cost or 0 for i in items),
        }
        if detail:
            entry["items"] = [
                {
                    "id": i.id,
                    "item_name": i.item_name,
                    "floor_space": i.floor_space,
                    "control_budget": i.control_budget,
                    "budget_min": i.budget_min,
                    "budget_max": i.budget_max,
                    "actual_cost": i.actual_cost,
                    "status": i.status,
                    "priority": i.priority,
                    "phase": i.phase,
                    "brand_recommendation": i.brand_recommendation,
                    "notes": i.notes,
                }
                for i in items
            ]
        result.append(entry)
    return result


@router.get("/phases")
def phases(db: Session = Depends(get_db)):
    ps = db.query(Phase).order_by(Phase.phase_num).all()
    return [
        {"id": p.id, "phase_num": p.phase_num, "name": p.name,
         "month_range": p.month_range, "core_tasks": p.core_tasks,
         "must_decide": p.must_decide, "dont_buy_early": p.dont_buy_early,
         "check_points": p.check_points, "related_categories": p.related_categories,
         "status": p.status or "upcoming"}
        for p in ps
    ]


@router.patch("/phases/{phase_id}/advance")
def advance_phase(phase_id: int, db: Session = Depends(get_db)):
    """标记当前阶段完成，自动推进到下一阶段"""
    p = db.query(Phase).filter(Phase.id == phase_id).first()
    if not p:
        return {"error": "阶段不存在"}

    # 标记为完成
    p.status = "completed"

    # 找到下一个阶段，设为 current
    next_p = db.query(Phase).filter(
        Phase.phase_num > p.phase_num
    ).order_by(Phase.phase_num).first()

    if next_p:
        next_p.status = "current"

    # 确保之前所有阶段都是 completed
    db.query(Phase).filter(
        Phase.phase_num < p.phase_num, Phase.status != "completed"
    ).update({"status": "completed"})

    db.commit()
    return {
        "ok": True,
        "completed": p.name,
        "current": next_p.name if next_p else "全部完成 🎉",
    }


@router.patch("/phases/{phase_id}/rollback")
def rollback_phase(phase_id: int, db: Session = Depends(get_db)):
    """回退阶段：撤销完成状态，回到此阶段"""
    p = db.query(Phase).filter(Phase.id == phase_id).first()
    if not p:
        return {"error": "阶段不存在"}

    # 将此阶段及之后所有阶段重置
    db.query(Phase).filter(
        Phase.phase_num >= p.phase_num
    ).update({"status": "upcoming"})

    # 设置为 current
    p.status = "current"
    db.commit()

    return {"ok": True, "current": p.name}


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
