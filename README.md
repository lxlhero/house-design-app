# 装修管家 — 嘉兴五层别墅装修预算管理系统

> **技术栈**: React + Vite + TailwindCSS (前端) · Python FastAPI + SQLite (后端) · Tauri (计划打包)

## 项目结构

```
house_design_app/
├── backend/              # Python FastAPI 后端
│   ├── app/
│   │   ├── main.py       # 入口
│   │   ├── database.py   # SQLite + SQLAlchemy
│   │   ├── models/       # 数据模型
│   │   ├── routers/      # API 路由
│   │   │   ├── dashboard.py   # 仪表盘 / 统计
│   │   │   ├── items.py       # 采购清单 CRUD
│   │   │   └── import_router.py # Excel 导入
│   │   └── services/
│   │       └── excel_importer.py # Excel 解析 + 批量 upsert
│   ├── init_db.py        # 初始化数据库（导入 Excel）
│   └── requirements.txt
├── frontend/             # React 前端
│   ├── src/
│   │   ├── App.jsx           # 路由
│   │   ├── api.js            # API 客户端
│   │   ├── components/
│   │   │   └── Layout.jsx    # 侧边栏布局
│   │   └── pages/
│   │       ├── Dashboard.jsx # 仪表盘（图表+统计）
│   │       ├── Items.jsx     # 采购清单（筛选+编辑）
│   │       └── Import.jsx    # Excel 导入
│   └── vite.config.js        # Vite + Tailwind + 代理
├── start.sh              # 一键启动脚本
└── .gitignore
```

## 快速开始

### 前提
- Python 3.9+ (arm64)
- Node.js 18+ (arm64, npm 10+)

### 1. 启动后端

```bash
cd backend
pip3 install -r requirements.txt
python3 init_db.py          # 首次：导入 Excel 数据
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8765 --reload
```

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

### 3. 打开浏览器

http://localhost:5173

### 一键启动

```bash
chmod +x start.sh && ./start.sh
```

## 功能概览

### 仪表盘
- 预算总览饼图（10 大项分配）
- 状态分布环形图
- 楼层预算柱状对比图
- 预算大项明细表
- 装修阶段时间线（0-8 阶段）

### 采购清单
- 52 项采购品，支持按状态/优先级/大项/阶段/属性筛选
- 关键词搜索（名称、品牌、备注）
- 点击状态标签即可编辑（未开始 → 询价中 → 已定方案 → 已下单 → 已安装）
- 每项显示预算区间、品牌推荐、备注

### 数据导入
- 上传新版 Excel（相同格式）
- 自动匹配已有数据：新增 + 更新 + 不变
- 不会覆盖手动修改的状态/实际花费
- 导入历史记录

## 数据流

```
Excel (.xlsx)
    ↓ 上传或 init_db.py
ExcelImporter (openpyxl)
    ↓ 批量 upsert
SQLite (house_design.db)
    ↓ FastAPI REST
React 前端 (Recharts 可视化)
```

## 迭代计划

| 版本 | 功能 |
|------|------|
| v1.0 ✅ | 预算可视化 + 采购管理 + Excel 导入 |
| v1.1 ✅ | Excel 全量替换导入 + 实际花费录入 + 预算差额一目了然 |
| v1.2 | 户型图标注 + 楼层平面可视化 |
| v2.0 | Tauri 打包为 macOS 原生 .app |

## 许可证

Private — 嘉兴别墅装修专用
