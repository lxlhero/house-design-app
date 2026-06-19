"""
装修管家核心功能测试
运行: pytest tests/test_core.py -v
前提: 服务已在 localhost:8765 启动 (./start_dev.sh 或 ./start_prod.sh)
"""
import subprocess
import json
import sys

BASE_URL = "http://localhost:8765"


def run_curl(url, method="GET", data=None, headers=None, timeout=10):
    """用 curl 发请求并返回 (状态码, 响应体, 耗时)"""
    cmd = ["curl", "-s", "-o", "-", "-w", "\n%{http_code}\n%{time_total}",
           "--max-time", str(timeout)]
    if method != "GET":
        cmd += ["-X", method]
    if data:
        cmd += ["-d", json.dumps(data)]
        if not headers:
            headers = {}
        headers["Content-Type"] = "application/json"
    if headers:
        for k, v in headers.items():
            cmd += ["-H", f"{k}: {v}"]
    cmd.append(url)

    result = subprocess.run(cmd, capture_output=True, text=True)
    parts = result.stdout.strip().split("\n")
    if len(parts) >= 3:
        body = "\n".join(parts[:-2])
        status = int(parts[-2])
        elapsed = float(parts[-1])
        return status, body, elapsed
    return 0, result.stdout, 0


class TestFrontend:
    """测试: 前端页面能正常打开"""

    def test_homepage_returns_200(self):
        status, body, elapsed = run_curl(BASE_URL + "/")
        assert status == 200, f"首页返回 {status}，预期 200"
        assert "<!DOCTYPE html>" in body or "<html" in body or "<div" in body, \
            f"响应体不是 HTML 页面 (前100字符: {body[:100]})"
        print(f"  ✅ 首页正常 (耗时 {elapsed:.2f}s)")

    def test_static_assets_loadable(self):
        """测试静态资源可访问"""
        status, _, elapsed = run_curl(BASE_URL + "/manifest.json")
        assert status in (200, 304), f"manifest.json 返回 {status}"
        print(f"  ✅ manifest.json 可访问 (耗时 {elapsed:.2f}s)")


class TestAPI:
    """测试: API 返回数据正常"""

    def test_health_endpoint(self):
        status, body, elapsed = run_curl(BASE_URL + "/api/health")
        assert status == 200, f"/api/health 返回 {status}"
        data = json.loads(body)
        assert data.get("status") == "ok", f"健康检查异常: {data}"
        print(f"  ✅ 健康检查通过 (耗时 {elapsed:.2f}s)")

    def test_items_api_requires_auth(self):
        """测试 /api/items 需要认证（未登录应返回 401）"""
        status, body, elapsed = run_curl(BASE_URL + "/api/items")
        assert status == 401, f"/api/items 未登录应返回 401，实际 {status}"
        data = json.loads(body)
        assert "请先登录" in data.get("detail", ""), f"未返回登录提示: {data}"
        print(f"  ✅ 认证中间件正常拦截未登录请求 (耗时 {elapsed:.2f}s)")

    def test_login_endpoint(self):
        """测试 /api/auth/login 端点存在"""
        # 用错误密码测试（确保端点可达）
        status, body, elapsed = run_curl(
            BASE_URL + "/api/auth/login",
            method="POST",
            data={"username": "test", "password": "wrong"}
        )
        assert status == 401, f"登录端点返回 {status}"
        data = json.loads(body)
        assert "错误" in data.get("detail", ""), f"登录端点响应异常: {data}"
        print(f"  ✅ 登录端点正常 (耗时 {elapsed:.2f}s)")

    def test_dashboard_api_requires_auth(self):
        """测试 /api/dashboard/overview 需要认证"""
        status, body, elapsed = run_curl(BASE_URL + "/api/dashboard/overview")
        assert status == 401, f"dashboard 未登录应返回 401，实际 {status}"
        print(f"  ✅ Dashboard API 正常拦截未登录请求 (耗时 {elapsed:.2f}s)")


class TestRender:
    """测试: 3D 渲染 API（如果渲染图片已存在）"""

    def test_full_render_api(self):
        """测试 /api/floorplan/render/full 端点可达"""
        status, body, elapsed = run_curl(
            BASE_URL + "/api/floorplan/render/full",
            timeout=30
        )
        # 渲染图片可能存在（200）或不存在（404），两种都算正常
        if status == 200:
            # 返回的是图片二进制数据
            print(f"  ✅ 全景渲染图存在 (大小 {len(body)} bytes, 耗时 {elapsed:.2f}s)")
        elif status == 404:
            print(f"  ⚠️  全景渲染图尚未生成（404），首次使用需执行 Blender 渲染")
        elif status == 401:
            print(f"  ⚠️  全景渲染需登录（401）")
        else:
            print(f"  ⚠️  渲染 API 返回 {status}: {body[:100]}")

    def test_floor_render_api(self):
        """测试 /api/floorplan/render/1F 端点可达"""
        status, body, elapsed = run_curl(
            BASE_URL + "/api/floorplan/render/1F",
            timeout=30
        )
        if status == 200:
            print(f"  ✅ 1F 渲染图存在 (大小 {len(body)} bytes, 耗时 {elapsed:.2f}s)")
        elif status == 404:
            print(f"  ⚠️  1F 渲染图尚未生成（404）")
        elif status == 401:
            print(f"  ⚠️  楼层渲染需登录（401）")
        else:
            print(f"  ⚠️  渲染 API 返回 {status}")


# ── 纯 curl 测试（不依赖 pytest） ──

def test_curl_direct():
    """纯 curl 测试 — 不依赖 pytest，可以直接 python3 执行"""
    print("=" * 50)
    print("纯 curl 测试（无需 pytest）")
    print("=" * 50)

    tests = [
        ("首页", BASE_URL + "/"),
        ("健康检查", BASE_URL + "/api/health"),
        ("manifest.json", BASE_URL + "/manifest.json"),
        ("/api/items (未登录→401)", BASE_URL + "/api/items"),
    ]

    all_ok = True
    for name, url in tests:
        result = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
             "--max-time", "5", url],
            capture_output=True, text=True
        )
        status = result.stdout.strip()
        expected = "200" if "401" not in name else "401"
        ok = status == expected
        icon = "✅" if ok else "⚠️"
        all_ok = all_ok and ok
        print(f"  {icon} {name}: HTTP {status}" + (f" (预期 {expected})" if not ok else ""))

    # 登录测试
    print(f"\n  🔑 登录测试...")
    result = subprocess.run(
        ["curl", "-s", "-X", "POST",
         "-d", '{"username":"mama","password":"change-me-please"}',
         "-H", "Content-Type: application/json",
         "-w", "\nHTTP:%{http_code}",
         "--max-time", "5", BASE_URL + "/api/auth/login"],
        capture_output=True, text=True
    )
    if "token" in result.stdout and "200" in result.stdout:
        print(f"  ✅ 默认账号登录成功")
    else:
        print(f"  ⚠️  登录响应: {result.stdout[:150]}")

    # 渲染测试
    print(f"\n  🎨 3D 渲染测试...")
    result = subprocess.run(
        ["curl", "-s", "-w", "\nHTTP:%{http_code}",
         "--max-time", "10", BASE_URL + "/api/floorplan/render/full"],
        capture_output=True, text=True
    )
    if "200" in result.stdout:
        print(f"  ✅ 全景渲染图可用")
    else:
        print(f"  ⚠️  渲染图不可用（可能尚未生成）")

    print(f"\n{'✅ 全部通过' if all_ok else '⚠️  部分测试未通过'}")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "curl":
        test_curl_direct()
    else:
        print("运行测试:")
        print("  pytest tests/test_core.py -v")
        print("或纯 curl 模式:")
        print("  python3 tests/test_core.py curl")
        print("前提: 服务已启动在 http://localhost:8765")
