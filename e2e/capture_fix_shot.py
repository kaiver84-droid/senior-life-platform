"""수정된 달력·운세 카드 화면만 담아 downloads/neulbom_calendar_fortune_fix.png 로 저장한다.

LD_LIBRARY_PATH=/workspace/work/.tools/browser-libs python3 e2e/capture_fix_shot.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright  # noqa: E402

CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
OUT = "/workspace/downloads"
BASE = os.environ.get("BASE", "https://senior-life-platform.pages.dev").rstrip("/")
LOCAL = BASE.startswith("http://")
KAKAO_ID, KAKAO_NAME = "777009002", "순자"


def kakao_stub(route, request):
    if "start=1" in request.url:
        route.fulfill(status=302, headers={"location": "/?code=STUB-AUTH-CODE"})
    elif request.method == "POST":
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(
                {
                    "ok": True,
                    "profile": {
                        "id": f"kakao_{KAKAO_ID}",
                        "nickname": KAKAO_NAME,
                        "birthYear": 1952,
                        "source": "kakao",
                        "createdAt": "2026-11-16T00:00:00.000Z",
                    },
                }
            ),
        )
    else:
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(
                {
                    "ok": True,
                    "supabase": "connected",
                    "kakao": "configured",
                    "kakaoLoginConfigured": True,
                    "kakaoJsConfigured": False,
                    "redirectUri": f"{BASE}/",
                }
            ),
        )


def login(page):
    if LOCAL:
        from harness import onboard

        onboard(page)
        page.wait_for_timeout(2000)
        return
    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
    page.get_by_role("button", name="카카오톡으로 시작하기").click()
    try:
        page.wait_for_selector("#setup-nick", timeout=12000)
        page.fill("#setup-nick", KAKAO_NAME)
        page.select_option("#setup-birth", "1952")
        page.click('[data-birthtime="묘시"]')
        page.select_option("#setup-sido", "충청북도")
        page.select_option("#setup-sigungu", "옥천군")
        page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
    except Exception:
        pass
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=40000)
    page.wait_for_timeout(2500)


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = b.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=3,
        locale="ko-KR",
        is_mobile=True,
        has_touch=True,
    )
    page = ctx.new_page()
    page.route("**/t1.kakaocdn.net/**", lambda r, _q: r.abort())
    page.route("**/api/auth/kakao**", kakao_stub)
    login(page)
    page.evaluate("localStorage.setItem('neulbom.installGuide.dismissed.v1', '1')")
    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
    page.wait_for_timeout(2500)
    page.evaluate(
        """() => {
          const b = Array.from(document.querySelectorAll('main button'))
            .find(x => /달력 보기/.test(x.textContent || ''));
          window.scrollTo(0, Math.max(0, b.getBoundingClientRect().top + window.scrollY - 300));
        }"""
    )
    page.wait_for_timeout(600)
    clip = page.evaluate(
        """() => {
          const b = Array.from(document.querySelectorAll('main button'))
            .find(x => /달력 보기/.test(x.textContent || ''));
          const grid = b.parentElement.getBoundingClientRect();
          const top = Math.max(0, grid.top - 2);
          return { x: 0, y: top, width: document.documentElement.clientWidth,
                   height: Math.min(window.innerHeight - top - 8, grid.height + 4) };
        }"""
    )
    page.screenshot(path=f"{OUT}/neulbom_calendar_fortune_fix.png", clip=clip)
    print("saved", OUT + "/neulbom_calendar_fortune_fix.png", clip)
    b.close()
