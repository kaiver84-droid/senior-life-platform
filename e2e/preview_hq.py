"""고화질 에셋 반영 화면 미리보기 · 라이브 검증 — 로컬 out/ 또는 라이브.

BASE=https://senior-life-platform.pages.dev python3 e2e/preview_hq.py   # 라이브(카카오 스텁 로그인)
python3 e2e/preview_hq.py                                               # 로컬 out/

확인: 화면에 놓인 <img> 가 모두 HTTP 200 으로 로드(naturalWidth > 0), 콘솔 오류 0건.
스크린샷: downloads/neulbom_hq_home.png · neulbom_hq_quiz.png · neulbom_hq_welfare.png
"""
import json
import os
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from harness import PORT, onboard, start_server  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", f"http://127.0.0.1:{PORT}").rstrip("/")
OUT = os.environ.get("OUT", "/workspace/downloads")
LOCAL = BASE.startswith("http://127.0.0.1")
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")
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


def live_login(page):
    """카카오 스텁 로그인 — 처음 로그인이면 초기 설정을 마치고, 이미 설정한 계정이면 홈으로 바로 간다."""
    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
    page.get_by_role("button", name="카카오톡으로 시작하기").click()
    try:
        page.wait_for_selector("#setup-nick", timeout=12000)
        page.fill("#setup-nick", KAKAO_NAME)
        page.select_option("#setup-birth", "1952")
        page.select_option("#setup-time", "묘시")
        page.select_option("#setup-sido", "충청북도")
        page.select_option("#setup-sigungu", "옥천군")
        page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
    except Exception:
        pass
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=40000)
    page.wait_for_timeout(3200)


def images_report(page, where):
    rows = page.evaluate(
        """() => Array.from(document.images).map(i => ({src: i.currentSrc || i.src, w: i.naturalWidth, h: i.naturalHeight}))"""
    )
    bad = [r for r in rows if r["w"] <= 0]
    for r in rows:
        print(f"  {'OK ' if r['w'] > 0 else 'BAD'} {r['w']}x{r['h']} {r['src'].split('/')[-1]}")
    print(f"  [{where}] 이미지 {len(rows)}개 · 실패 {len(bad)}개")
    return bad


def main():
    httpd = None
    if LOCAL:
        httpd = start_server()
    os.makedirs(OUT, exist_ok=True)
    errs = []
    bad_images = []

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
        page.on("console", lambda m: errs.append(f"error: {m.text}") if m.type == "error" else None)
        page.on("requestfailed", lambda r: errs.append(f"requestfailed: {r.url}"))
        if LOCAL:
            onboard(page)
        else:
            page.route("**/t1.kakaocdn.net/**", lambda route, _req: route.abort())
            page.route("**/api/auth/kakao**", kakao_stub)
            live_login(page)
        page.wait_for_timeout(2500)

        # 1) 홈 — 국화 히어로 · 운세/날씨 타일
        print("홈")
        bad_images += images_report(page, "home")
        page.screenshot(path=f"{OUT}/neulbom_hq_home.png")
        page.screenshot(path=f"{OUT}/_hq_home_lower.png")
        page.evaluate("window.scrollTo(0, 620)")
        page.wait_for_timeout(700)
        page.screenshot(path=f"{OUT}/_hq_home_scrolled.png")
        page.evaluate("window.scrollTo(0, 1180)")
        page.wait_for_timeout(800)
        page.screenshot(path=f"{OUT}/_hq_home_tiles.png")
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(400)

        # 2) 인사카드 시트 — 국화 사진 배경 카드
        page.get_by_role("button", name="인사카드 만들기").click()
        page.wait_for_timeout(2600)
        page.screenshot(path=f"{OUT}/_hq_card.png")
        page.keyboard.press("Escape")
        page.wait_for_timeout(600)

        nav = page.get_by_role("navigation").get_by_role("button")

        # 3) 퀴즈 문제 화면 — 하단 부부 배너
        print("퀴즈")
        nav.nth(2).click()
        page.wait_for_timeout(900)
        page.get_by_role("button", name="퀴즈 시작하기").click()
        page.wait_for_timeout(1200)
        page.evaluate("window.scrollTo(0, 380)")
        page.wait_for_timeout(800)
        bad_images += images_report(page, "quiz")
        page.screenshot(path=f"{OUT}/neulbom_hq_quiz.png")
        page.locator("[data-quiz-option]").first.click()
        page.wait_for_timeout(300)
        page.get_by_role("button", name="정답 확인").click()
        page.wait_for_timeout(700)
        page.evaluate("window.scrollTo(0, 380)")
        page.wait_for_timeout(500)
        page.screenshot(path=f"{OUT}/_hq_quiz_checked.png")
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(400)

        # 4) 복지 — 기초연금 배너 · 가족 안부 카드
        print("복지")
        nav.nth(4).click()
        page.wait_for_timeout(1400)
        page.screenshot(path=f"{OUT}/neulbom_hq_welfare.png")
        page.evaluate("window.scrollTo(0, 1150)")
        page.wait_for_timeout(900)
        bad_images += images_report(page, "welfare")
        page.screenshot(path=f"{OUT}/_hq_welfare_lower.png")
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(300)

        # 5) 가족
        nav.nth(5).click()
        page.wait_for_timeout(600)
        page.get_by_role("button", name="가족", exact=False).first.click()
        page.wait_for_timeout(1200)
        bad_images += images_report(page, "family")
        page.screenshot(path=f"{OUT}/_hq_family.png")

        browser.close()
    if httpd:
        httpd.shutdown()

    # 카카오 SDK CDN 은 로그인 스텁을 위해 일부러 막았으므로(실제 앱에서는 서버 경유 로그인) 오류 집계에서 뺀다.
    real = [
        e
        for e in errs
        if "Failed to load resource" not in e and "t1.kakaocdn.net" not in e
    ]
    print(f"\n콘솔/페이지 오류: {len(real)}건")
    for e in real[:5]:
        print("  ", e)
    print(f"이미지 실패: {len(bad_images)}개")
    if real or bad_images:
        sys.exit(1)


if __name__ == "__main__":
    main()
