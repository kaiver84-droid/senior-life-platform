"""고화질 에셋 반영 화면 미리보기 — 로컬 out/ 또는 라이브.

BASE=https://senior-life-platform.pages.dev python3 e2e/preview_hq.py   # 라이브
python3 e2e/preview_hq.py                                               # 로컬 out/
"""
import os
import re
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from harness import PORT, onboard, start_server  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", f"http://127.0.0.1:{PORT}").rstrip("/")
OUT = os.environ.get("OUT", "/workspace/downloads/_hq")
LOCAL = BASE.startswith("http://127.0.0.1")
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")


def main():
    httpd = None
    if LOCAL:
        httpd = start_server()
    os.makedirs(OUT, exist_ok=True)
    errs = []
    imgs = []

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            locale="ko-KR",
            is_mobile=True,
            has_touch=True,
        )
        page = ctx.new_page()
        page.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
        page.on("console", lambda m: errs.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        page.on("requestfailed", lambda r: errs.append(f"requestfailed: {r.url} {r.failure}"))

        onboard(page)
        page.wait_for_timeout(3500)

        # 이미지 로드 상태
        imgs = page.evaluate(
            """() => Array.from(document.images).map(i => ({src: i.currentSrc || i.src, w: i.naturalWidth, h: i.naturalHeight}))"""
        )

        page.screenshot(path=f"{OUT}/home.png")
        page.evaluate("window.scrollTo(0, 520)")
        page.wait_for_timeout(600)
        page.screenshot(path=f"{OUT}/home_lower.png")
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(300)

        # 인사카드 시트
        page.get_by_role("button", name="인사카드 만들기").click()
        page.wait_for_timeout(2500)
        page.screenshot(path=f"{OUT}/card.png")
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)

        nav = page.get_by_role("navigation").get_by_role("button")

        # 퀴즈 문제 화면
        nav.nth(2).click()
        page.wait_for_timeout(700)
        page.get_by_role("button", name="퀴즈 시작하기").click()
        page.wait_for_timeout(900)
        page.screenshot(path=f"{OUT}/quiz.png")
        page.evaluate("window.scrollTo(0, 400)")
        page.wait_for_timeout(500)
        page.screenshot(path=f"{OUT}/quiz_lower.png")
        page.locator("[data-quiz-option]").first.click()
        page.wait_for_timeout(300)
        page.get_by_role("button", name="정답 확인").click()
        page.wait_for_timeout(700)
        page.evaluate("window.scrollTo(0, 400)")
        page.wait_for_timeout(400)
        page.screenshot(path=f"{OUT}/quiz_checked.png")
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(300)

        # 복지
        nav.nth(4).click()
        page.wait_for_timeout(1200)
        page.screenshot(path=f"{OUT}/welfare.png")
        page.evaluate("window.scrollTo(0, 780)")
        page.wait_for_timeout(600)
        page.screenshot(path=f"{OUT}/welfare_lower.png")
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(300)

        # 가족 (더보기 → 가족)
        nav.nth(5).click()
        page.wait_for_timeout(500)
        page.get_by_role("button", name=re.compile("가족")).first.click()
        page.wait_for_timeout(900)
        page.screenshot(path=f"{OUT}/family.png")

        browser.close()
    if httpd:
        httpd.shutdown()

    print("=== images ===")
    for im in imgs:
        print(f"{'OK ' if im['w'] > 0 else 'BAD'} {im['w']}x{im['h']} {im['src']}")
    print("=== console/page errors ===")
    for e in errs:
        print(e)
    print(f"errors: {len(errs)}")


if __name__ == "__main__":
    main()
