# 🏠 装修管家 — 嘉兴别墅管理系统

> FastAPI + React PWA，运行在 Mac M2 Pro，通过 Tailscale Funnel 暴露公网供 iPad 使用。

---

## 📱 妈妈访问地址

```
https://macbook-pro.taild2321d.ts.net
```

默认账号：`malingling` / 密码存储在 `backend/.env` 文件中

---

## 🚀 启动方式

### 日常使用（生产模式）

在前端代码没有改动时，直接启动后端即可（前端已构建在 `frontend/dist/`）：

```bash
# 1. 启动后端（8765端口，含前端页面）
cd ~/code/ai_lab/house_work/house_design_app/backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8765 &

# 2. 公网暴露
tailscale funnel --bg 8765
```

或者用封装好的脚本：

```bash
cd ~/code/ai_lab/house_work/house_design_app
./start_prod.sh        # 构建前端 + 启动后端（不含Funnel，需手动 tailscale funnel --bg 8765）
```

### 休眠后恢复

**大多数情况不需要手动操作**——开盖唤醒后服务自动恢复，妈妈刷新页面即可。

如果唤醒后连不上，三步恢复：

```bash
# 1. 清理旧进程
lsof -ti:8765 | xargs kill -9 2>/dev/null

# 2. 启动后端
cd ~/code/ai_lab/house_work/house_design_app/backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8765 &

# 3. 重新暴露公网
tailscale funnel --bg 8765
```

**建议直接关掉自动休眠**，就不用操心这个了：
> 系统设置 → 电池 → 选项 → 开启「当显示器关闭时，防止 Mac 自动进入睡眠」

### 开发模式（改代码时用）

双端口运行，前端热更新，后端自动重载：

```bash
cd ~/code/ai_lab/house_work/house_design_app
./start_dev.sh
```

- 前端：http://localhost:5173 （Vite HMR，改动即时生效）
- 后端：http://localhost:8765 （uvicorn reload）
- API 请求 `/api/*` 由 Vite 自动代理到后端

---

## 🛠 常用命令

| 操作 | 命令 |
|------|------|
| 查看服务状态 | `lsof -i:8765` |
| 停止服务 | `lsof -ti:8765 \| xargs kill` |
| 关闭公网暴露 | `tailscale funnel --https=443 off` |
| 查看 Tailscale 状态 | `tailscale status` |
| 构建前端 | `cd frontend && npm run build` |
| 运行测试 | `python tests/test_core.py curl` |
| 修改密码 | `export HOUSE_PASS=新密码` 然后重启服务 |

---

## 🧪 测试

```bash
# 纯 curl 模式（零依赖）
python tests/test_core.py curl

# pytest 模式（需 pip install pytest）
pytest tests/test_core.py -v
```

测试覆盖：首页加载、API 健康检查、PWA manifest、登录认证、API 认证拦截。

---

## 🏗 架构

```
  iPad (Safari/PWA)           Mac M2 Pro
  ┌──────────────┐          ┌─────────────────────┐
  │ 装修管家 图标  │  HTTPS  │ uvicorn :8765        │
  │ 全屏打开      │◄────────│ ├─ /api/* → FastAPI   │
  │ 输入密码登录   │  Funnel │ └─ /*     → React SPA │
  └──────────────┘          │ Tailscale Funnel     │
                            └─────────────────────┘
```

- 单端口 8765：FastAPI 同时 serve API 和前端静态文件
- PWA：iPad 添加到主屏幕后全屏运行，像原生 App
- 认证：用户名+密码 JWT，30 天免登录
- 数据库：SQLite（`backend/house_design.db`）

---

## 📁 关键文件

```
house_design_app/
├── start_dev.sh          # 开发模式启动
├── start_prod.sh         # 生产模式启动
├── start_prod_cf.sh      # 生产模式（Cloudflare Tunnel 备选）
├── start_backend.sh      # 仅后端
├── tests/test_core.py    # 自动化测试
├── backend/app/
│   ├── main.py           # FastAPI 入口 + 前端挂载
│   └── auth.py           # JWT 认证中间件
├── frontend/dist/        # 前端构建产物
└── architecture_renovation_plan.txt  # 架构方案文档
```

---

## ⚠️ 注意事项

- Python 环境：conda base（`/Users/huron/miniconda3/bin/python`），普通 `pip` 不可用
- Mac 需保持开机，建议关闭自动休眠
- 改完前端代码后需 `npm run build` 重新构建，生产模式才能看到更新
- Blender 3D 渲染图需手动跑一次 `backend/render_floorplan_3d.py` 才能使用
