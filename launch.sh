#!/bin/bash
# 装修管家 — 开机自启脚本
# 由 ~/Library/LaunchAgents/com.huron.house-app.plist 调用

LOG="$HOME/code/ai_lab/house_work/house_design_app/launch.log"
echo "[$(date)] 装修管家自启..." >> "$LOG"

# 等网络就绪
sleep 5

# 启动 uvicorn
cd "$HOME/code/ai_lab/house_work/house_design_app/backend"
/Users/huron/miniconda3/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8765 &
UVICORN_PID=$!
echo "[$(date)] uvicorn PID=$UVICORN_PID" >> "$LOG"

# 等 uvicorn 就绪再开 funnel
sleep 5
tailscale funnel --bg 8765 >> "$LOG" 2>&1
echo "[$(date)] funnel started" >> "$LOG"

# 保持脚本运行（LaunchAgent KeepAlive 需要）
wait $UVICORN_PID
