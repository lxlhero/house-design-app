#!/bin/bash
# ── 装修管家 · 生产模式 ──
# 构建前端 → 启动单端口 8765 → Tailscale Funnel 公网暴露
set -e
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🏠 装修管家 — 生产模式"
echo "========================="

# 0. 清理旧进程（避免端口冲突）
OLD_PID=$(lsof -ti:8765 2>/dev/null)
if [ -n "$OLD_PID" ]; then
  echo "🧹 清理旧进程 (PID: $OLD_PID)..."
  kill -9 $OLD_PID 2>/dev/null
  sleep 1
fi

# 1. 环境变量提示
if [ -z "$HOUSE_PASS" ]; then
  echo "⚠️  HOUSE_PASS 未设置，使用 .env 文件中的密码"
fi

# 1. 构建前端
echo "📦 构建前端..."
cd "$PROJECT_DIR/frontend"
npm install --silent 2>/dev/null || npm install
npm run build
echo "   ✅ 构建完成 → frontend/dist/"

# 2. 启动后端
echo "🚀 启动后端 (port 8765)..."
cd "$PROJECT_DIR/backend"
# caffeinate -i 防止系统空闲休眠
caffeinate -i python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8765 &
BACKEND_PID=$!
echo "   后端 PID: $BACKEND_PID"
sleep 3

# 3. 健康检查
echo "🔍 健康检查..."
if curl -sf http://localhost:8765/api/health > /dev/null 2>&1; then
  echo "   ✅ 后端正常"
else
  echo "   ❌ 后端启动失败"
  kill $BACKEND_PID 2>/dev/null
  exit 1
fi

# 4. VPN 提示
echo ""
echo "🌐 公网暴露:"
echo "   如需 iPad 远程访问，请在另一终端运行:"
echo "   tailscale funnel --bg 8765"
echo ""
echo "   然后在 iPad Safari 打开:"
echo "   https://$(scutil --get ComputerName | tr 'A-Z' 'a-z' | sed 's/ /-/g').<你的tailnet>.ts.net"

# 5. 本地已就绪
echo ""
echo "✅ 生产模式已启动"
echo "   本地: http://localhost:8765"
echo ""
echo "   默认登录账号: mama / 环境变量 HOUSE_PASS 设置的密码"
echo ""
echo "按 Ctrl+C 停止服务"

trap "kill $BACKEND_PID 2>/dev/null; exit 0" INT TERM
wait
