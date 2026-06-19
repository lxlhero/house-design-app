#!/bin/bash
# ── 装修管家 · 生产模式 (Cloudflare Tunnel) ──
# 构建前端 → 启动单端口 8765 → Cloudflare Tunnel 公网暴露
# 前提: brew install cloudflared && cloudflared tunnel login
# 可选: 绑定自定义域名 ~$1/年体验更佳
set -e
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOMAIN="${HOUSE_DOMAIN}"

echo "🏠 装修管家 — 生产模式 (Cloudflare Tunnel)"
echo "============================================="

# 0. 环境变量
if [ -z "$HOUSE_PASS" ]; then
  echo "⚠️  HOUSE_PASS 未设置，使用默认密码 'change-me-please'"
  echo "   设置: export HOUSE_PASS='你的密码'"
fi
echo ""

# 1. 构建前端
echo "📦 构建前端..."
cd "$PROJECT_DIR/frontend"
npm install --silent 2>/dev/null || npm install
npm run build
echo "   ✅ 构建完成 → frontend/dist/"

# 2. 启动后端
echo "🚀 启动后端 (port 8765)..."
cd "$PROJECT_DIR/backend"
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

# 4. 启动 Cloudflare Tunnel
echo ""
echo "🌐 启动 Cloudflare Tunnel..."
CF_CONFIG="$HOME/.cloudflared/house-config.yml"

if [ -f "$CF_CONFIG" ] && [ -n "$DOMAIN" ]; then
  # 已配置隧道 + 自定义域名
  caffeinate -i cloudflared --config "$CF_CONFIG" tunnel run &
  TUNNEL_PID=$!
  echo "   Tunnel PID: $TUNNEL_PID"
  echo "   公网地址: https://$DOMAIN"
else
  # Quick Tunnel 模式（临时域名，每次启动变化）
  echo "   ⚠️  未找到 CF Tunnel 配置或 HOUSE_DOMAIN，使用临时隧道..."
  echo "   ⚠️  临时域名每次重启会变化，不适合长期使用"
  echo ""
  echo "   如需固定域名:"
  echo "   1. 注册 Cloudflare 账号并在 CF 注册域名 (~$1/年)"
  echo "   2. brew install cloudflared"
  echo "   3. cloudflared tunnel login"
  echo "   4. cloudflared tunnel create house-app"
  echo "   5. 创建 $CF_CONFIG"
  echo "   6. cloudflared tunnel route dns house-app your.domain.com"
  echo ""
  cloudflared tunnel --url http://localhost:8765 2>&1 &
  TUNNEL_PID=$!
fi

echo ""
echo "✅ 生产模式已启动"
echo "   本地: http://localhost:8765"
echo "   默认登录: mama / HOUSE_PASS 设置的密码"
echo ""
echo "按 Ctrl+C 停止所有服务"

trap "kill $BACKEND_PID ${TUNNEL_PID:-} 2>/dev/null; exit 0" INT TERM
wait
