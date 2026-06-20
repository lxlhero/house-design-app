#!/bin/bash
# ── 装修管家 · 开发模式 ──
# 双端口：Vite dev server (5173, HMR 热更新) + uvicorn (8765, 自动重载)
# Vite proxy /api → localhost:8765，无跨域烦恼
set -e
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🏠 装修管家 — 开发模式"
echo "========================="

# 0. 清理旧进程（避免端口冲突）
OLD_8765=$(lsof -ti:8765 2>/dev/null)
OLD_5173=$(lsof -ti:5173 2>/dev/null)
if [ -n "$OLD_8765" ]; then
  echo "🧹 清理旧后端进程 (PID: $OLD_8765)..."
  kill -9 $OLD_8765 2>/dev/null
fi
if [ -n "$OLD_5173" ]; then
  echo "🧹 清理旧前端进程 (PID: $OLD_5173)..."
  kill -9 $OLD_5173 2>/dev/null
fi
[ -n "$OLD_8765" ] || [ -n "$OLD_5173" ] && sleep 1

# 1. 环境变量提示
if [ -z "$HOUSE_PASS" ]; then
  echo "⚠️  HOUSE_PASS 未设置，使用默认密码 'change-me-please'"
  echo "   设置: export HOUSE_PASS='你的密码'"
fi
echo ""

# 1. 启动后端 (uvicorn, 带热重载)
echo "🔧 启动后端 (port 8765, reload)..."
cd "$PROJECT_DIR/backend"

# Init DB（幂等，已存在则跳过）
python3 init_db.py 2>/dev/null || true

python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8765 --reload &
BACKEND_PID=$!
echo "   后端 PID: $BACKEND_PID"

# 2. 检查并安装前端依赖（快速检查）
echo ""
echo "🎨 启动前端 (port 5173, HMR)..."
cd "$PROJECT_DIR/frontend"
if [ ! -f node_modules/.package-lock.json ]; then
    echo "   📦 安装前端依赖..."
    npm install
fi

# 3. 启动 Vite dev server
npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!
echo "   前端 PID: $FRONTEND_PID"

echo ""
echo "✅ 开发模式已启动"
echo "   前端: http://localhost:5173  (Vite HMR, 热更新)"
echo "   后端: http://localhost:8765  (uvicorn reload)"
echo "   前端请求 /api/* 自动代理到后端（vite.config proxy）"
echo ""
echo "按 Ctrl+C 停止所有服务"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
