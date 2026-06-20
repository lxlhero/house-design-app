FROM python:3.12-slim

WORKDIR /app

# 安装依赖
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端代码
COPY backend/ ./backend/

# 复制前端构建产物
COPY frontend/dist/ ./frontend/dist/

# 数据目录
RUN mkdir -p /app/backend/data

WORKDIR /app/backend

EXPOSE 8766

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8766"]
