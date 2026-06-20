"""
Excel 导出服务 — 将数据库中的状态/实际花费回填到 Excel
保持原始 Excel 结构，追加新列，实现双向联动
"""
import openpyxl
from copy import copy
from sqlalchemy.orm import Session
from ..models.models import Item

TEMPLATE_PATH = "/Users/xiu/Desktop/work/house_design/嘉兴别墅装修采购预算顺序表-1.0.xlsx"


class ExcelExporter:
    def __init__(self, db: Session):
        self.db = db
        self.items_map = {}
        for item in db.query(Item).all():
            self.items_map[item.item_name] = item

    def export(self, output_path: str) -> str:
        """导出 Excel，回填状态/实际花费/供应商，返回文件路径"""
        wb = openpyxl.load_workbook(TEMPLATE_PATH)
        self._update_procurement_sheet(wb)
        wb.save(output_path)
        return output_path

    def _update_procurement_sheet(self, wb):
        """更新采购清单 sheet：回填状态 + 追加实际花费/已支付/供应商列"""
        ws = wb["采购清单"]

        # 找到标题行（第 3 行），追加新列名
        header_row = 3
        existing_cols = ws.max_column
        new_headers = ["实际花费", "已支付", "供应商"]
        for i, h in enumerate(new_headers):
            cell = ws.cell(row=header_row, column=existing_cols + i + 1, value=h)
            # 复制标题样式
            src_cell = ws.cell(row=header_row, column=existing_cols)
            if src_cell.font:
                cell.font = copy(src_cell.font)
            if src_cell.fill:
                cell.fill = copy(src_cell.fill)
            if src_cell.alignment:
                cell.alignment = copy(src_cell.alignment)

        # 遍历数据行（第 4 行开始）
        for row in ws.iter_rows(min_row=4, max_row=ws.max_row):
            item_name_cell = row[2]  # C 列 = 采购项
            status_cell = row[12] if len(row) > 12 else None  # M 列 = 状态

            item_name = str(item_name_cell.value).strip() if item_name_cell.value else ""
            if not item_name or item_name in ("采购项", ""):
                continue

            db_item = self.items_map.get(item_name)
            if not db_item:
                continue

            row_num = item_name_cell.row

            # 回填状态（M 列 = 第 13 列）
            if status_cell and db_item.status:
                status_cell.value = db_item.status

            # 追加实际花费（新列 1）
            actual_cell = ws.cell(row=row_num, column=existing_cols + 1)
            actual_cell.value = db_item.actual_cost if db_item.actual_cost else 0

            # 追加已支付（新列 2）
            paid_cell = ws.cell(row=row_num, column=existing_cols + 2)
            paid_cell.value = db_item.actual_paid if db_item.actual_paid else 0

            # 追加供应商（新列 3）
            supplier_cell = ws.cell(row=row_num, column=existing_cols + 3)
            supplier_cell.value = db_item.supplier if db_item.supplier else ""
