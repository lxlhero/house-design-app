"""Excel 导出 API"""
import os
import tempfile
from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..services.excel_exporter import ExcelExporter
from ..logging_config import get_logger

router = APIRouter(prefix="/api/export", tags=["export"])
logger = get_logger("house_design.export")


@router.get("/inventory")
def export_inventory(db: Session = Depends(get_db)):
    logger.info("Inventory export requested")
    """导出当前数据库状态到 Excel（回填状态 + 实际花费 + 供应商）"""
    exporter = ExcelExporter(db)
    output_path = os.path.join(tempfile.gettempdir(), "装修采购预算_导出.xlsx")
    exporter.export(output_path)
    filepath = exporter.export(db)
    logger.info("Excel exported", extra={"extra": {"filepath": filepath}})
    return FileResponse(
        path=output_path,
        filename="嘉兴别墅装修采购预算_最新.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
