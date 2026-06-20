"""
装修管家 API — 日志查看路由
提供日志文件列表、内容查询、统计信息。
"""

import os
import json
from pathlib import Path
from fastapi import APIRouter, Query, HTTPException
from ..logging_config import LOG_DIR, get_logger

router = APIRouter(prefix="/api/logs", tags=["日志"])
logger = get_logger("house_design.log_api")


@router.get("/files")
def list_log_files():
    """列出所有日志文件及基本信息"""
    files = []
    for p in sorted(LOG_DIR.glob("*.log*"), key=lambda x: x.name):
        stat = p.stat()
        files.append({
            "name": p.name,
            "size": stat.st_size,
            "size_human": _format_bytes(stat.st_size),
            "modified": _format_time(stat.st_mtime),
            "lines": _count_lines(p),
        })
    return {"total": len(files), "files": files}


@router.get("/view/{filename:path}")
def view_log(
    filename: str,
    lines: int = Query(default=100, ge=1, le=2000, description="返回最近 N 行"),
    level: str = Query(default=None, description="按级别过滤: DEBUG/INFO/WARNING/ERROR"),
    search: str = Query(default=None, description="关键词搜索"),
):
    """查看指定日志文件的内容"""
    filepath = LOG_DIR / filename
    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(status_code=404, detail=f"Log file not found: {filename}")

    if not filepath.name.endswith(".log") and not ".log." in filepath.name:
        raise HTTPException(status_code=400, detail="Only .log files are accessible")

    # 读取最后 N 行
    all_lines = _tail_file(filepath, lines * 3)  # 多读一些用于过滤
    entries = []
    for line in all_lines:
        try:
            entry = json.loads(line.strip())
            if level and entry.get("level") != level.upper():
                continue
            if search and search.lower() not in json.dumps(entry).lower():
                continue
            entries.append(entry)
        except json.JSONDecodeError:
            if search and search.lower() in line.lower():
                entries.append({"raw": line.strip()})

    return {
        "file": filename,
        "requested_lines": lines,
        "returned_entries": len(entries[-lines:]),
        "entries": entries[-lines:],
    }


@router.get("/stats")
def log_stats():
    """日志系统统计信息"""
    total_size = 0
    total_lines = 0
    error_count = 0
    file_stats = []

    for p in sorted(LOG_DIR.glob("*.log")):
        stat = p.stat()
        lines = _count_lines(p)
        total_size += stat.st_size
        total_lines += lines

        # 统计错误数
        errs = 0
        if "error" in p.name.lower():
            errs = lines
        else:
            errs = _count_errors(p)

        error_count += errs
        file_stats.append({
            "name": p.name,
            "lines": lines,
            "errors": errs,
            "size_human": _format_bytes(stat.st_size),
        })

    return {
        "log_dir": str(LOG_DIR),
        "total_files": len(file_stats),
        "total_size": _format_bytes(total_size),
        "total_lines": total_lines,
        "total_errors": error_count,
        "files": file_stats,
    }


def _format_bytes(n: int) -> str:
    for unit in ["B", "KB", "MB", "GB"]:
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def _format_time(ts: float) -> str:
    from datetime import datetime
    return datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S")


def _count_lines(path: Path) -> int:
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return sum(1 for _ in f)
    except Exception:
        return 0


def _tail_file(path: Path, n: int) -> list:
    """读取文件最后 N 行（高效实现）"""
    try:
        with open(path, "rb") as f:
            f.seek(0, os.SEEK_END)
            file_size = f.tell()
            if file_size == 0:
                return []

            # 从尾部读入 buffer
            buffer_size = min(file_size, 8192)
            lines_found = []
            pos = file_size

            while len(lines_found) <= n and pos > 0:
                read_size = min(buffer_size, pos)
                pos -= read_size
                f.seek(pos)
                chunk = f.read(read_size).decode("utf-8", errors="ignore")

                if pos == 0:
                    lines_found = chunk.splitlines() + lines_found
                else:
                    new_lines = chunk.splitlines(True)
                    if lines_found:
                        new_lines[-1] = new_lines[-1] + lines_found[0]
                        lines_found = new_lines + lines_found[1:]
                    else:
                        lines_found = new_lines

            return lines_found[-n:] if len(lines_found) > n else lines_found
    except Exception as e:
        logger.error(f"Failed to tail file {path}: {e}")
        return []


def _count_errors(path: Path) -> int:
    try:
        count = 0
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                if '"level":"ERROR"' in line:
                    count += 1
        return count
    except Exception:
        return 0
