"""
版本快照服务 — 复制 SQLite 文件实现版本管理
每次导入/手动保存时创建快照，支持一键回退
"""
import os
import shutil
import glob
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models.models import VersionSnapshot, Item, Category, Phase, FloorBudget
from ..logging_config import get_logger

logger = get_logger("house_design.versions")

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "house_design.db")
VERSIONS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "versions")


def _ensure_versions_dir():
    os.makedirs(VERSIONS_DIR, exist_ok=True)


def get_stats(db: Session):
    """获取当前 DB 简要统计"""
    items_count = db.query(func.count(Item.id)).scalar() or 0
    total_budget = db.query(func.sum(Category.control_budget)).scalar() or 0
    return items_count, total_budget


def create_snapshot(db: Session, label: str = "", source: str = "manual") -> VersionSnapshot:
    """创建数据库快照"""
    _ensure_versions_dir()

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    snapshot_filename = f"snapshot_{timestamp}.db"
    snapshot_path = os.path.join(VERSIONS_DIR, snapshot_filename)

    # 复制当前数据库文件
    shutil.copy2(DB_PATH, snapshot_path)

    # 统计信息
    items_count, total_budget = get_stats(db)

    # 自动生成标签
    if not label:
        if source == "import":
            label = f"导入数据后 ({items_count}项, ¥{total_budget/10000:.0f}万)"
        else:
            label = f"手动保存 ({items_count}项, ¥{total_budget/10000:.0f}万)"

    snapshot = VersionSnapshot(
        label=label,
        filename=snapshot_filename,
        source=source,
        items_count=items_count,
        total_budget=total_budget,
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    logger.info("Version snapshot created", extra={"extra": {"source": source, "items": items_count}})
    return snapshot


def list_snapshots(db: Session):
    """列出所有版本快照"""
    return db.query(VersionSnapshot).order_by(VersionSnapshot.created_at.desc()).all()


def rollback_to(db: Session, snapshot_id: int) -> bool:
    """回退到指定快照"""
    snapshot = db.query(VersionSnapshot).filter(VersionSnapshot.id == snapshot_id).first()
    if not snapshot:
        return False

    snapshot_path = os.path.join(VERSIONS_DIR, snapshot.filename)
    if not os.path.exists(snapshot_path):
        return False

    # 用快照文件替换当前数据库
    shutil.copy2(snapshot_path, DB_PATH)

    # 注意：当前 db session 已失效，调用方需要重新连接
    return True


def cleanup_old_snapshots(db: Session, keep: int = 50):
    """清理旧快照，只保留最近 N 个"""
    _ensure_versions_dir()
    snapshots = db.query(VersionSnapshot).order_by(VersionSnapshot.created_at.desc()).all()
    if len(snapshots) <= keep:
        return

    for snap in snapshots[keep:]:
        # 删除文件
        path = os.path.join(VERSIONS_DIR, snap.filename)
        if os.path.exists(path):
            os.unlink(path)
        # 删除记录
        db.delete(snap)
    db.commit()
