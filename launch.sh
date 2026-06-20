#!/bin/bash
# 装修管家 — 开机自启脚本
# 由 ~/Library/LaunchAgents/com.huron.house-app.plist 调用
# 路径自适应：找到项目目录（假设此脚本在项目根目录下）

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$SCRIPT_DIR/launch.log"
echo "[$(date)] 装修管家自启..." >> "$LOG"

# 等网络就绪
sleep 5

# 自动检测 Python 路径（优先 conda，其次系统 python3）
PYTHON=""
for py in "$HOME/miniconda3/bin/python" "$(which python3 2>/dev/null)" /usr/local/bin/python3 /opt/homebrew/bin/python3; do
  if [ -x "$py" ] && "$py" -c "import uvicorn" 2>/dev/null; then
    PYTHON="$py"
    break
  fi
done
if [ -z "$PYTHON" ]; then
  echo "[$(date)] ERROR: 找不到可用的 Python" >> "$LOG"
  exit 1
fi
echo "[$(date)] 使用 Python: $PYTHON" >> "$LOG"

# 启动 uvicorn
cd "$SCRIPT_DIR/backend"
"$PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port 8765 &
UVICORN_PID=$!
echo "[$(date)] uvicorn PID=$UVICORN_PID" >> "$LOG"

# 等 uvicorn 就绪再开 funnel
sleep 5
tailscale funnel --bg 8765 >> "$LOG" 2>&1
echo "[$(date)] funnel started" >> "$LOG"

# 保持脚本运行（LaunchAgent KeepAlive 需要）
wait $UVICORN_PID
