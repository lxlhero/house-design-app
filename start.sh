#!/bin/bash
# 装修管家 — 一键启动脚本（无需 Excel 也可启动）
# Usage: ./start.sh
# 可选: export HOUSE_EXCEL_PATH=/path/to/别墅装修.xlsx

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🏠 装修管家 v1.0 — 嘉兴五层别墅"
echo "================================"
echo ""

# ── Backend ──
echo "📡 启动后端 API (port 8765)..."
cd "$PROJECT_DIR/backend"

# Init DB
python3 init_db.py

echo "  启动 uvicorn..."
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8765 &
BACKEND_PID=$!
echo "  后端 PID: $BACKEND_PID"

# ── Frontend ──
echo "🎨 启动前端 (port 5173)..."
cd "$PROJECT_DIR/frontend"

# Install deps if needed (fast check)
if [ ! -f node_modules/.package-lock.json ]; then
    echo "  📦 安装前端依赖..."
    npm install
fi

npx vite --host --port 5173 &
FRONTEND_PID=$!
echo "  前端 PID: $FRONTEND_PID"

echo ""
echo "✅ 启动完成"
echo "  前端: http://localhost:5173"
echo "  后端: http://localhost:8765"
echo "  API文档: http://localhost:8765/docs"
echo ""

# Trap cleanup
trap "echo ''; echo '🛑 停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

wait
