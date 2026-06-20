#!/bin/bash
# ═══════════════════════════════════════════
# 装修管家 · 上线前自动化检测
# 用法: ./tests/pre_deploy.sh
# ═══════════════════════════════════════════
set -e
PROJECT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0; FAIL=0
RED='\033[31m'; GREEN='\033[32m'; YELLOW='\033[33m'; NC='\033[0m'

check() { if [ $? -eq 0 ]; then echo "  ${GREEN}✅ $1${NC}"; PASS=$((PASS+1)); else echo "  ${RED}❌ $1${NC}"; FAIL=$((FAIL+1)); fi }

echo "══════════════════════════════════════════"
echo "🏠 装修管家 · 预发布检测"
echo "══════════════════════════════════════════"
echo ""

# ═══ 1. 代码静态检查 ═══
echo "📋 阶段一：代码静态检查"
echo "──────────────────────"

# 构建前端
echo "  构建前端..."
cd "$PROJECT/frontend"
npm run build > /tmp/house_build.log 2>&1
check "前端构建成功 (npm run build)"

# 检查是否有未提交的改动
cd "$PROJECT"
if git diff --quiet && git diff --cached --quiet; then
    check "Git 工作区干净"
else
    echo "  ${YELLOW}⚠️  有未提交的改动${NC}"
fi

# 检查 spacing 污染
echo "  检查 CSS spacing 污染..."
grep -q "spacing-xs\|spacing-sm\|spacing-md\|spacing-lg\|spacing-xl\|spacing-2xl\|spacing-3xl" frontend/src/index.css 2>/dev/null
if [ $? -eq 0 ]; then
    echo "  ${YELLOW}⚠️  index.css 含自定义 --spacing-* (会污染 max-w)$NC"
else
    check "CSS 无 spacing 污染风险"
fi
echo ""

# ═══ 2. 后端测试 ═══
echo "📋 阶段二：后端 API 测试"
echo "──────────────────────"

# 检查服务是否在运行
curl -sf http://localhost:8765/api/health > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "  ⚠️  后端未运行，启动中..."
    cd "$PROJECT/backend"
    /Users/huron/miniconda3/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8765 &
    sleep 3
fi
check "后端服务运行中"

cd "$PROJECT"
/Users/huron/miniconda3/bin/python -m pytest tests/test_backend.py -v --tb=short 2>&1 | tail -20
BACKEND_EXIT=$?
[ $BACKEND_EXIT -eq 0 ] && check "后端 API 测试全部通过" || { echo "  ${RED}❌ 后端测试失败${NC}"; FAIL=$((FAIL+1)); }
echo ""

# ═══ 3. 前端 E2E 测试 ═══
echo "📋 阶段三：前端 E2E 测试 (Chromium 无头浏览器)"
echo "──────────────────────"

cd "$PROJECT"
/Users/huron/miniconda3/bin/python -m pytest tests/test_frontend_e2e.py -v --tb=short 2>&1 | tail -30
FRONTEND_EXIT=$?
[ $FRONTEND_EXIT -eq 0 ] && check "前端 E2E 测试全部通过" || { echo "  ${RED}❌ 前端测试失败${NC}"; FAIL=$((FAIL+1)); }

# 检查截图
SCREENSHOTS=$(ls "$PROJECT/test_screenshots"/*.png 2>/dev/null | wc -l | tr -d ' ')
echo "  生成 ${SCREENSHOTS} 张页面截图 → test_screenshots/"
echo ""

# ═══ 4. 网络连通检查 ═══
echo "📋 阶段四：网络连通性"
echo "──────────────────────"

# Tailscale
which tailscale > /dev/null 2>&1 && tailscale status > /dev/null 2>&1
check "Tailscale 已连接"

tailscale funnel status 2>/dev/null | grep -q "Funnel on"
check "Tailscale Funnel 运行中"

# 延迟测试
echo "  DERP 延迟:"
tailscale netcheck 2>/dev/null | grep "Nearest DERP" | head -1
echo ""

# ═══ 5. 结果汇总 ═══
echo "══════════════════════════════════════════"
TOTAL=$((PASS + FAIL))
echo "  通过: ${GREEN}${PASS}${NC} / 失败: ${RED}${FAIL}${NC} / 总计: ${TOTAL}"
if [ $FAIL -eq 0 ]; then
    echo "  ${GREEN}✅ 全部通过 — 可以上线！${NC}"
    echo ""
    echo "  截图已保存到 test_screenshots/，请人工确认 UI 效果。"
    exit 0
else
    echo "  ${RED}❌ ${FAIL} 项失败 — 请修复后再上线${NC}"
    exit 1
fi
