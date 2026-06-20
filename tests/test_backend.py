"""
装修管家 · 后端 API 自动化测试
运行: pytest tests/test_backend.py -v
前提: 服务在 localhost:8765 运行
"""
import pytest
import requests
import json

BASE = "http://localhost:8765"
TOKEN = None
HEADERS = {}


def login():
    global TOKEN, HEADERS
    resp = requests.post(f"{BASE}/api/auth/login", json={
        "username": "malingling",
        "password": "941102"
    })
    assert resp.status_code == 200, f"登录失败: {resp.text}"
    TOKEN = resp.json()["token"]
    HEADERS = {"Authorization": f"Bearer {TOKEN}"}


class TestAuth:
    def test_login_success(self):
        resp = requests.post(f"{BASE}/api/auth/login", json={
            "username": "malingling", "password": "941102"
        })
        assert resp.status_code == 200
        assert "token" in resp.json()

    def test_login_fail_wrong_password(self):
        resp = requests.post(f"{BASE}/api/auth/login", json={
            "username": "malingling", "password": "wrong"
        })
        assert resp.status_code == 401

    def test_api_blocked_without_token(self):
        resp = requests.get(f"{BASE}/api/items")
        assert resp.status_code == 401


class TestHealth:
    def test_health_endpoint(self):
        resp = requests.get(f"{BASE}/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


class TestDashboard:
    @classmethod
    def setup_class(cls):
        login()

    def test_overview_returns_data(self):
        resp = requests.get(f"{BASE}/api/dashboard/overview", headers=HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert "total_budget" in data
        assert data["total_budget"] > 0
        assert "total_items" in data

    def test_categories(self):
        resp = requests.get(f"{BASE}/api/dashboard/categories", headers=HEADERS)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_phases(self):
        resp = requests.get(f"{BASE}/api/dashboard/phases", headers=HEADERS)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_floors(self):
        resp = requests.get(f"{BASE}/api/dashboard/floors", headers=HEADERS)
        assert resp.status_code == 200


class TestItems:
    @classmethod
    def setup_class(cls):
        login()

    def test_list_items(self):
        resp = requests.get(f"{BASE}/api/items", headers=HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert data["total"] > 0

    def test_filter_options(self):
        resp = requests.get(f"{BASE}/api/items/filters", headers=HEADERS)
        assert resp.status_code == 200


class TestFrontend:
    def test_homepage_returns_html(self):
        resp = requests.get(f"{BASE}/")
        assert resp.status_code == 200
        assert "<!DOCTYPE html>" in resp.text or "<html" in resp.text

    def test_manifest_accessible(self):
        resp = requests.get(f"{BASE}/manifest.json")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "装修管家"

    def test_static_js_loads(self):
        # 从首页提取 JS 路径
        resp = requests.get(f"{BASE}/")
        import re
        match = re.search(r'src="(/assets/index-[^"]+\.js)"', resp.text)
        assert match, "未找到 JS 引用"
        js_resp = requests.get(f"{BASE}{match.group(1)}")
        assert js_resp.status_code == 200


class TestDecisions:
    @classmethod
    def setup_class(cls):
        login()

    def test_decisions_api(self):
        resp = requests.get(f"{BASE}/api/decisions", headers=HEADERS)
        assert resp.status_code == 200

    def test_budget_update_triggers_decision(self):
        # 修改预算触发决策记录
        resp = requests.patch(f"{BASE}/api/dashboard/budget", headers=HEADERS, json={
            "total_budget": 1200000
        })
        assert resp.status_code == 200
        # 验证产生了决策记录
        resp2 = requests.get(f"{BASE}/api/decisions?action=budget_update", headers=HEADERS)
        assert resp2.status_code == 200
        assert len(resp2.json().get("items", [])) >= 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
