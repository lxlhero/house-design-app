"""Excel 导出 API"""
import os
from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..services.excel_exporter import ExcelExporter
from ..services.excel_store import get_latest_excel_path, DATA_DIR
from ..logging_config import get_logger

router = APIRouter(prefix="/api/export", tags=["export"])
logger = get_logger("house_design.export")


@router.get("/excel")
def download_excel(db: Session = Depends(get_db)):
    """下载最新 Excel（含回填的状态/花费）"""
    exporter = ExcelExporter(db)
    try:
        path = exporter.export()
        return FileResponse(
            path,
            filename="嘉兴别墅装修_最新.xlsx",
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    except FileNotFoundError:
        return {"error": "尚未导入过 Excel 文件，请先在「导入导出」页面上传"}


@router.get("/inventory")
def export_inventory(db: Session = Depends(get_db)):
    """同上（兼容旧路径）"""
    return download_excel(db)
