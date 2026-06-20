"""初始化数据库 — 导入原始 Excel 数据（可选）"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, engine, Base

# 可配置：环境变量 > 命令行参数 > 默认值
EXCEL_PATH = os.environ.get(
    "HOUSE_EXCEL_PATH",
    sys.argv[1] if len(sys.argv) > 1 else ""
)


def main():
    # 建表
    Base.metadata.create_all(bind=engine)
    print("✅ 数据库表已创建")

    # 导入 Excel（可选）
    if not EXCEL_PATH:
        print("ℹ️  未提供 Excel 路径，跳过数据导入")
        print("   设置方式: export HOUSE_EXCEL_PATH=/path/to/file.xlsx")
        return

    if not os.path.exists(EXCEL_PATH):
        print(f"⚠️  Excel 文件不存在: {EXCEL_PATH}")
        print("   跳过数据导入，3D 户型图等功能仍可正常使用")
        return

    from app.services.excel_importer import ExcelImporter
    db = SessionLocal()
    try:
        print(f"📥 导入 Excel: {EXCEL_PATH}")
        importer = ExcelImporter(EXCEL_PATH)
        result = importer.import_all(db)
        print("✅ 导入完成:")
        for k, v in result.items():
            print(f"  {k}: {v}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
