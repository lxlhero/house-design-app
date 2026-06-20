"""
Excel 本地存储服务
- 导入时保存 Excel 到本地作为备份真理源
- DB 变更后自动回写 Excel 保持同步
"""
import os
import shutil
import openpyxl
from copy import copy
from pathlib import Path
from sqlalchemy.orm import Session
from ..models.models import Item

# 本地存储目录（相对于项目 backend 目录）
DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
LOCAL_EXCEL_NAME = "别墅装修_最新.xlsx"
LOCAL_EXCEL_PATH = DATA_DIR / LOCAL_EXCEL_NAME


def init_store():
    """确保 data 目录存在"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def save_uploaded_excel(filepath: str) -> str:
    """保存用户上传的 Excel 到本地备份，保留最近 3 份历史"""
    init_store()
    dest = str(LOCAL_EXCEL_PATH)

    # 轮转旧备份：.bak2 → .bak3, .bak1 → .bak2, 当前 → .bak1
    for i in range(2, 0, -1):
        old = Path(f"{dest}.bak{i}")
        new = Path(f"{dest}.bak{i+1}")
        if old.exists():
            if new.exists():
                new.unlink()
            old.rename(new)

    if Path(dest).exists():
        bak1 = Path(f"{dest}.bak1")
        if bak1.exists():
            bak1.unlink()
        shutil.move(dest, str(bak1))

    shutil.copy2(filepath, dest)
    return dest


def get_latest_excel_path() -> str | None:
    """获取最新 Excel 的路径（本地备份）"""
    if LOCAL_EXCEL_PATH.exists():
        return str(LOCAL_EXCEL_PATH)
    return None


def sync_db_to_excel(db: Session) -> str | None:
    """
    将数据库中物品的状态/实际花费/供应商回写到本地 Excel
    返回写入的文件路径，如果没有 Excel 则返回 None
    """
    path = get_latest_excel_path()
    if not path:
        return None

    # 构建 DB 物品映射
    items_map = {}
    for item in db.query(Item).all():
        items_map[item.item_name] = item

    wb = openpyxl.load_workbook(path)

    # 尝试更新「采购清单」sheet
    if "采购清单" not in wb.sheetnames:
        return path

    ws = wb["采购清单"]
    header_row = 3  # 标题行（根据 Excel 结构）
    existing_cols = ws.max_column

    # 确保追加列存在
    new_headers = ["实际花费", "已支付", "供应商"]
    need_new_headers = False
    for i, h in enumerate(new_headers):
        cell = ws.cell(row=header_row, column=existing_cols + i + 1)
        if cell.value != h:
            need_new_headers = True
            break

    if need_new_headers:
        for i, h in enumerate(new_headers):
            cell = ws.cell(row=header_row, column=existing_cols + i + 1, value=h)
            src_cell = ws.cell(row=header_row, column=existing_cols)
            if src_cell.font:
                cell.font = copy(src_cell.font)
            if src_cell.fill:
                cell.fill = copy(src_cell.fill)
            if src_cell.alignment:
                cell.alignment = copy(src_cell.alignment)

    # 遍历数据行
    for row in ws.iter_rows(min_row=4, max_row=ws.max_row):
        if len(row) < 3:
            continue
        item_name_cell = row[2]  # C 列 = 采购项
        item_name = str(item_name_cell.value).strip() if item_name_cell.value else ""
        if not item_name or item_name in ("采购项", ""):
            continue

        db_item = items_map.get(item_name)
        if not db_item:
            continue

        row_num = item_name_cell.row

        # 回填状态（M 列 = 第 13 列）
        if len(row) > 12 and db_item.status:
            row[12].value = db_item.status

        # 回填实际花费
        actual_col = existing_cols + 1
        if not need_new_headers:
            # 检查是否已有该列
            pass
        ws.cell(row=row_num, column=actual_col, value=db_item.actual_cost or 0)
        ws.cell(row=row_num, column=actual_col + 1, value=db_item.actual_paid or 0)
        ws.cell(row=row_num, column=actual_col + 2, value=db_item.supplier or "")

    wb.save(path)
    return path
