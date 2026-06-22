"""Excel 导入 API — 全量替换模式"""
import os
import tempfile
from fastapi import APIRouter, UploadFile, File, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.models import ImportLog
from ..services.excel_importer import ExcelImporter
from ..services.version_manager import create_snapshot, cleanup_old_snapshots
from ..services.excel_store import save_uploaded_excel, list_excel_history, get_history_filepath
from ..logging_config import get_logger

router = APIRouter(prefix="/api/import", tags=["import"])
logger = get_logger("house_design.import")


@router.post("/excel")
async def import_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """上传新版 Excel，全量替换数据库（清空 → 重新导入）"""
    if not file.filename.endswith((".xlsx", ".xls")):
        logger.warning("Invalid file type for import", extra={"extra": {"filename": file.filename}})
        return {"error": "请上传 .xlsx 或 .xls 文件"}

    logger.info("Excel import started", extra={"extra": {"filename": file.filename, "size_bytes": file.size}})
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # 保存到本地备份（Excel 真理源，同时创建时间戳快照）
        saved_path = save_uploaded_excel(tmp_path)
        logger.info("Excel saved to local store", extra={"extra": {"path": saved_path}})

        importer = ExcelImporter(tmp_path)
        result = importer.import_all(db)

        log = ImportLog(
            filename=file.filename,
            items_created=result.get("items_count", 0),
            items_updated=0,
            items_unchanged=0,
        )
        db.add(log)
        db.commit()

        # 自动创建版本快照
        create_snapshot(db, source="import")
        cleanup_old_snapshots(db, keep=50)

        logger.info("Excel import completed", extra={"extra": {"filename": file.filename, "summary": result}})
        return {
            "ok": True,
            "mode": "全量替换",
            "filename": file.filename,
            "summary": result,
            "log_id": log.id,
        }
    except Exception as e:
        logger.exception("Excel import failed", extra={"extra": {"filename": file.filename, "error": str(e)}})
        return {"error": f"导入失败: {str(e)}"}
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.get("/template")
def download_template():
    return {
        "message": "请使用与 嘉兴别墅装修采购预算顺序表-1.0.xlsx 相同格式的 Excel 文件",
        "sheets_required": ["预算总览", "采购清单", "装修阶段顺序", "楼层预算"],
        "mode": "全量替换 — 每次导入会清空旧数据，以新版 Excel 为准",
    }


# ─── 历史 Excel 版本 ───

@router.get("/excel-history")
def excel_history():
    """列出所有历史 Excel 快照"""
    return list_excel_history()


@router.get("/excel-history/{filename}")
def download_excel_history(filename: str):
    """下载指定历史 Excel 文件"""
    path = get_history_filepath(filename)
    if not path:
        return {"error": "文件不存在"}
    return FileResponse(path, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename=filename)
