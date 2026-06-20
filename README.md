# 装修管家 — 嘉兴五层别墅装修预算管理系统

FastAPI + React + SQLite，Docker 容器化部署，iPad PWA 访问。

## 架构

```
iPad (Safari PWA)
    │
    ▼
https://macbook-pro.taild2321d.ts.net  (Tailscale Funnel)
    │
    ▼
Nginx :8765
    ├── /         → house-design :8766  (Docker)
    └── /poker/   → poker       :8768
```

## 快速启动

### 1. 构建前端

```bash
cd frontend
npm install
npm run build
```

### 2. 构建 Docker 镜像

```bash
docker build -t house-design:v1.0 .
```

### 3. 启动容器

```bash
docker run -d \
  --name house-design \
  --restart unless-stopped \
  -p 8766:8766 \
  -e DEEPSEEK_API_KEY="你的DeepSeek API Key" \
  -v $(pwd)/backend/data:/app/backend/data \
  -v $(pwd)/backend/house_design.db:/app/backend/house_design.db \
  house-design:v1.0
```

> **重要**：`DEEPSEEK_API_KEY` 必须传入，否则 Agent AI 对话不可用。Key 存放在 `~/.hermes/profiles/mom/.env`。

### 4. 验证

```bash
curl http://localhost:8766/api/health
# → {"status":"ok","app":"装修管家"}
```

## Nginx 反代配置

```nginx
server {
    listen 8765;

    # 装修管家
    location / {
        proxy_pass http://127.0.0.1:8766;
        proxy_buffering off;              # SSE 流式必须关闭缓冲
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Poker
    location /poker/ {
        proxy_pass http://127.0.0.1:8768/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## 公网暴露 (Tailscale Funnel)

```bash
# 开启 Funnel（只需一次）
tailscale funnel --bg 8765

# 查看状态
tailscale funnel status

# 关闭
tailscale funnel --bg 8765 off
```

公网地址：`https://<你的机器名>.<你的tailnet>.ts.net`

## 账号

| 用户名 | 密码 | 说明 |
|--------|------|------|
| malingling | 941102 | 妈妈账号 |

密码在 `backend/.env` 中配置。

## 数据持久化

| 文件 | 路径 | 说明 |
|------|------|------|
| SQLite 数据库 | `backend/house_design.db` | 所有业务数据 |
| Excel 模板 | `backend/data/别墅装修_最新.xlsx` | 导入导出双向同步 |

Docker 启动时通过 `-v` 挂载到宿主机，容器删除数据不丢失。

## 开发

```bash
# 后端
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8766 --reload

# 前端
cd frontend
npm run dev
```

## 技术栈

- **后端**: FastAPI + SQLAlchemy + SQLite
- **前端**: React 19 + Vite + Tailwind CSS + Recharts
- **AI**: DeepSeek Chat (function calling)
- **部署**: Docker + Nginx + Tailscale Funnel
- **PWA**: Service Worker + Web App Manifest

## iPad 使用

1. Safari 打开公网地址
2. 点底部「分享」→「添加到主屏幕」
3. 桌面出现「装修管家」图标
4. 全屏 PWA 体验，支持语音输入
