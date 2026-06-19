#!/usr/bin/env python3
"""初始化数据库：可选从 Excel 导入初始数据"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import engine, Base

# 建表
Base.metadata.create_all(bind=engine)
print("✅ 数据库表已创建")

# 可选导入 Excel
excel_path = os.environ.get("HOUSE_EXCEL_PATH", "")
if not excel_path:
    print("ℹ️  未设置 HOUSE_EXCEL_PATH，跳过 Excel 导入")
    print("   示例: export HOUSE_EXCEL_PATH=/path/to/别墅装修.xlsx")
elif not os.path.exists(excel_path):
    print(f"⚠️  Excel 文件不存在: {excel_path}")
else:
    from app.services.importer import import_excel
    print(f"📥 导入: {excel_path}")
    stats = import_excel(excel_path)
    print(f"✅ 完成: {stats}")
