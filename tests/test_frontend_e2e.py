"""
装修管家 · 前端 E2E 自动化测试 (Playwright + Chromium)
运行: pytest tests/test_frontend_e2e.py -v
前提: 服务在 localhost:8765 运行，pip install playwright
"""
import pytest
import os
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:8765"
SCREENSHOT_DIR = os.path.join(os.path.dirname(__file__), "..", "test_screenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)


@pytest.fixture(scope="module")
def browser():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()


@pytest.fixture
def page(browser):
    context = browser.new_context(
        viewport={"width": 1024, "height": 768},  # iPad 尺寸
        device_scale_factor=2,
    )
    page = context.new_page()
    yield page
    context.close()


class TestPageRendering:
    """核心：所有页面必须正常渲染，无白屏无报错"""

    def test_homepage_loads(self, page):
        """首页（登录前）正常显示"""
        errors = []
        page.on("pageerror", lambda err: errors.append(str(err)))

        page.goto(BASE, wait_until="networkidle")
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "01_homepage.png"))

        # 应该显示登录页面
        assert page.locator("text=装修管家").is_visible(), "首页未显示标题"
        assert page.locator("text=嘉兴别墅").is_visible(), "首页未显示副标题"
        assert len(errors) == 0, f"JS 错误: {errors}"

    def test_login_and_dashboard(self, page):
        """登录 → 仪表盘正常渲染"""
        errors = []
        page.on("pageerror", lambda err: errors.append(str(err)))

        page.goto(f"{BASE}/login", wait_until="networkidle")

        # 填写登录表单
        page.fill('input[autocomplete="username"]', "malingling")
        page.fill('input[autocomplete="current-password"]', "941102")
        page.click('button[type="submit"]')

        # 等待跳转到仪表盘
        page.wait_for_url(f"{BASE}/", timeout=10000)
        page.wait_for_load_state("networkidle")
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "02_dashboard.png"))

        # 验证仪表盘内容
        assert page.locator('h2:has-text("仪表盘")').is_visible(), "仪表盘标题未显示"
        body = page.inner_text("body")
        assert len(body) > 100, "仪表盘内容过少"
        assert len(errors) == 0, f"JS 错误: {errors}"

    def test_items_page(self, page):
        """采购清单页面"""
        errors = []
        page.on("pageerror", lambda err: errors.append(str(err)))

        # 先登录
        page.goto(f"{BASE}/login", wait_until="networkidle")
        page.fill('input[autocomplete="username"]', "malingling")
        page.fill('input[autocomplete="current-password"]', "941102")
        page.click('button[type="submit"]')
        page.wait_for_url(f"{BASE}/", timeout=10000)

        # 点击采购清单
        page.click('a[href="/items"]')
        page.wait_for_load_state("networkidle")
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "03_items.png"))

        assert page.locator("text=采购清单").is_visible(), "采购清单未显示"
        assert len(errors) == 0, f"JS 错误: {errors}"

    def test_import_page(self, page):
        """导入数据页面"""
        errors = []
        page.on("pageerror", lambda err: errors.append(str(err)))

        # 先登录
        page.goto(f"{BASE}/login", wait_until="networkidle")
        page.fill('input[autocomplete="username"]', "malingling")
        page.fill('input[autocomplete="current-password"]', "941102")
        page.click('button[type="submit"]')
        page.wait_for_url(f"{BASE}/", timeout=10000)

        page.goto(f"{BASE}/import", wait_until="networkidle")
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "04_import.png"))

        assert page.locator('h2:has-text("导入数据")').is_visible(), "导入数据页未显示"
        assert len(errors) == 0, f"JS 错误: {errors}"

    def test_versions_page(self, page):
        """版本管理页面"""
        errors = []
        page.on("pageerror", lambda err: errors.append(str(err)))

        # 先登录
        page.goto(f"{BASE}/login", wait_until="networkidle")
        page.fill('input[autocomplete="username"]', "malingling")
        page.fill('input[autocomplete="current-password"]', "941102")
        page.click('button[type="submit"]')
        page.wait_for_url(f"{BASE}/", timeout=10000)

        page.goto(f"{BASE}/versions", wait_until="networkidle")
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "05_versions.png"))

        assert page.locator('h2:has-text("版本管理")').is_visible(), "版本管理页未显示"
        assert len(errors) == 0, f"JS 错误: {errors}"


class TestUILayout:
    """UI 布局完整性检查"""

    def test_no_white_screen(self, page):
        """所有页面不应为白屏"""
        page.goto(f"{BASE}/login", wait_until="networkidle")
        page.fill('input[autocomplete="username"]', "malingling")
        page.fill('input[autocomplete="current-password"]', "941102")
        page.click('button[type="submit"]')
        page.wait_for_url(f"{BASE}/", timeout=10000)
        page.wait_for_load_state("networkidle")

        # 检查页面有实际内容（不是空的）
        body_text = page.inner_text("body")
        assert len(body_text.strip()) > 50, f"页面内容过少: {body_text[:100]}"

    def test_no_layout_overflow(self, page):
        """内容不应该水平溢出"""
        page.goto(f"{BASE}/", wait_until="networkidle")
        page.fill('input[autocomplete="username"]', "malingling")
        page.fill('input[autocomplete="current-password"]', "941102")
        page.click('button[type="submit"]')
        page.wait_for_url(f"{BASE}/", timeout=10000)

        # 检查 body 宽度 = viewport 宽度（无水平滚动）
        body_width = page.evaluate("document.body.scrollWidth")
        viewport_width = page.evaluate("window.innerWidth")
        assert body_width <= viewport_width + 5, f"水平溢出: body={body_width}px > viewport={viewport_width}px"


class TestResponsive:
    """响应式布局检查"""

    def test_ipad_landscape(self, page):
        """iPad 横屏 (1024×768)"""
        page.set_viewport_size({"width": 1024, "height": 768})
        page.goto(f"{BASE}/", wait_until="networkidle")
        page.fill('input[autocomplete="username"]', "malingling")
        page.fill('input[autocomplete="current-password"]', "941102")
        page.click('button[type="submit"]')
        page.wait_for_url(f"{BASE}/", timeout=10000)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "06_ipad_landscape.png"))
        # 侧栏应该显示
        sidebar = page.locator("aside")
        assert sidebar.count() > 0, "iPad 横屏缺少侧栏"

    def test_ipad_portrait(self, page):
        """iPad 竖屏 (768×1024)"""
        page.set_viewport_size({"width": 768, "height": 1024})
        page.goto(f"{BASE}/", wait_until="networkidle")
        page.fill('input[autocomplete="username"]', "malingling")
        page.fill('input[autocomplete="current-password"]', "941102")
        page.click('button[type="submit"]')
        page.wait_for_url(f"{BASE}/", timeout=10000)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "07_ipad_portrait.png"))


class TestPWA:
    """PWA 配置完整性"""

    def test_manifest_valid(self, page):
        page.goto(BASE, wait_until="networkidle")
        manifest = page.evaluate("""async () => {
            const link = document.querySelector('link[rel="manifest"]');
            if (!link) return null;
            const resp = await fetch(link.href);
            return resp.json();
        }""")
        assert manifest, "Manifest 未加载"
        assert manifest["display"] == "standalone"
        assert manifest["name"] == "装修管家"

    def test_apple_meta_tags(self, page):
        page.goto(BASE, wait_until="networkidle")
        capable = page.evaluate("""() => {
            const meta = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
            return meta ? meta.content : null;
        }""")
        assert capable == "yes", "缺少 apple-mobile-web-app-capable"

    def test_service_worker(self, page):
        page.goto(BASE, wait_until="networkidle")
        sw = page.evaluate("""() => 'serviceWorker' in navigator""")
        assert sw, "浏览器不支持 Service Worker"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
