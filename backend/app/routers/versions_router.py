"""版本管理 API — 平台版本历史 + 数据回退"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.models import PlatformVersion
from ..services.version_manager import (
    create_snapshot, list_snapshots, rollback_to, cleanup_old_snapshots
)
from ..logging_config import get_logger

router = APIRouter(prefix="/api/versions", tags=["versions"])
logger = get_logger("house_design.versions_api")

# 平台版本历史种子数据
VERSION_HISTORY = [
    {
        "version": "v1.0", "title": "预算可视化 + 采购管理",
        "features": [
            "仪表盘：预算饼图、状态环形图、楼层柱状图",
            "采购清单：52项可搜索、按多维筛选",
            "装修阶段时间线（9阶段）",
            "品牌推荐、预算大项明细表",
            "Excel 导入初始化数据",
            "React + Vite + TailwindCSS 界面",
        ],
    },
    {
        "version": "v1.1", "title": "Excel全量替换 + 实际花费",
        "features": [
            "Excel 导入改为全量替换（上传即覆盖）",
            "采购清单新增实际花费列（点击可编辑）",
            "差额一目了然：绿色「省」/ 红色「超」",
            "实际花费、预算余额、花费占比实时统计",
        ],
    },
    {
        "version": "v1.2", "title": "Excel双向联动 + 动态总预算",
        "features": [
            "导出 Excel：回填状态/实际花费到 Excel",
            "导入→编辑→导出→再导入 完整闭环",
            "总预算从数据库动态读取，不再写死",
            "Items 页新增导出 Excel 按钮",
        ],
    },
    {
        "version": "v1.3", "title": "版本回退 + 可编辑总预算",
        "features": [
            "版本管理页面：时间线查看历史版本",
            "一键回退数据到任意历史版本",
            "总预算可点击编辑，改后自动调预备金",
            "导入数据后自动创建版本快照",
        ],
    },
]


def seed_versions(db: Session):
    """初始化平台版本历史（幂等）"""
    existing = db.query(PlatformVersion).count()
    if existing > 0:
        return
    for v in VERSION_HISTORY:
        db.add(PlatformVersion(
            version=v["version"],
            title=v["title"],
            features="\n".join(f"• {f}" for f in v["features"]),
        ))
    db.commit()


@router.get("")
def get_versions(db: Session = Depends(get_db)):
    seed_versions(db)
    versions = db.query(PlatformVersion).order_by(PlatformVersion.id.desc()).all()
    return [
        {
            "id": v.id,
            "version": v.version,
            "title": v.title,
            "features": v.features,
            "snapshot_id": v.snapshot_id,
            "released_at": v.released_at.isoformat() if v.released_at else "",
        }
        for v in versions
    ]


@router.post("/snapshots")
def create_snapshot_api(data: dict, db: Session = Depends(get_db)):
    logger.info("Snapshot creation requested", extra={"extra": {"label": data.get("label", ""), "source": data.get("source", "manual")}})
    """保存当前数据快照 + 标记到最新平台版本"""
    label = data.get("label", "")
    snapshot = create_snapshot(db, label=label, source="manual")
    cleanup_old_snapshots(db, keep=50)

    # 关联到最新平台版本
    latest = db.query(PlatformVersion).order_by(PlatformVersion.id.desc()).first()
    if latest:
        latest.snapshot_id = snapshot.id
        db.commit()

    return {
        "ok": True,
        "id": snapshot.id,
        "version": latest.version if latest else "?",
        "created_at": snapshot.created_at.isoformat() if snapshot.created_at else "",
    }


@router.post("/rollback/{version_id}")
def rollback_version(version_id: int, db: Session = Depends(get_db)):
    """回退到指定平台版本（恢复该版本关联的数据快照）"""
    logger.warning("Rollback requested", extra={"extra": {"version_id": version_id}})
    pv = db.query(PlatformVersion).filter(PlatformVersion.id == version_id).first()
    if not pv:
        raise HTTPException(status_code=404, detail="版本不存在")

    if not pv.snapshot_id:
        raise HTTPException(status_code=400, detail="该版本没有关联数据快照，请先在对应版本保存数据")

    success = rollback_to(db, pv.snapshot_id)
    if not success:
        raise HTTPException(status_code=404, detail="快照文件丢失")

    return {
        "ok": True,
        "message": f"已回退到 {pv.version}（{pv.title}），请刷新页面查看",
    }
