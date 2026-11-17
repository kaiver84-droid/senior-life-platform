"""초고화질(2400px 히어로 · 1024px 3D 아이콘) 반영 후 로컬 화면 확인용 캡처.

python3 e2e/preview_uhd.py            # 로컬 out/
BASE=https://senior-life-platform.pages.dev python3 e2e/preview_uhd.py
"""
import os
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from harness import onboard, start_server  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", "http://127.0.0.1:8099").rstrip("/")
LOCAL = BASE.startswith("http://127.0.0.1")
OUT = "/workspace/downloads"
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")


def main():
    if LOCAL:
        start_server()
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox", "--force-device-scale-factor=3"])
        ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
        page = ctx.new_page()
        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_timeout(2500)
        page.screenshot(path=f"{OUT}/_uhd_check_onboarding.png")
        onboard(page)
        page.wait_for_timeout(2500)
        page.screenshot(path=f"{OUT}/_uhd_check_home.png")
        page.evaluate("window.scrollTo(0, 240)")
        page.wait_for_timeout(1200)
        page.screenshot(path=f"{OUT}/_uhd_check_home2.png")
        b.close()
        print("saved _uhd_check_*.png")


if __name__ == "__main__":
    main()
