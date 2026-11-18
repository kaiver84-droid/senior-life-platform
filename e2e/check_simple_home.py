"""늘봄 첫 화면(시안형 심플 개편) 검증·스크린샷 — 390×844 모바일 뷰포트.

python3 e2e/check_simple_home.py                                      # 로컬 out/
BASE=https://senior-life-platform.pages.dev python3 e2e/check_simple_home.py   # 라이브(배포 뒤)

확인 항목
- 콘솔/페이지 오류 0건, 깨진 이미지 0건
- 첫 화면 카드(인사 → 혜택)가 1~1.2 화면 안에 들어오는지(스크롤 높이 측정)
- 390px 폭에서 가로 넘침(scrollWidth > clientWidth) 0건
- 주요 버튼(모임 · 랭킹 · 공동 미션 · 달력 · 운세 · 안부 · 혜택 · 날씨) 동작
스크린샷
- downloads/neulbom_simple_home.png (첫 화면 전체)
- downloads/_simple_home_top.png (스크롤 없이 보이는 첫 화면)
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
    page.wait_for_timeout(3500)


def home(page):
    page.get_by_role("button", name="홈", exact=True).click()
    page.wait_for_timeout(900)
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(400)


def main():
    httpd = None
    if LOCAL:
        httpd = start_server()
    os.makedirs(OUT, exist_ok=True)
    errs, problems = [], []

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=3,
            locale="ko-KR",
            is_mobile=True,
            has_touch=True,
        )
        page = ctx.new_page()
        page.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
        page.on("console", lambda m: errs.append(f"console: {m.text}") if m.type == "error" else None)

        def on_fail(req):
            reason = ""
            try:
                reason = req.failure or ""
            except Exception:
                pass
            if "ERR_ABORTED" in reason:
                return
            errs.append(f"requestfailed: {req.url} ({reason})")

        page.on("requestfailed", on_fail)

        if LOCAL:
            onboard(page)
        else:
            page.route("**/t1.kakaocdn.net/**", lambda route, _req: route.abort())
            page.route("**/api/auth/kakao**", kakao_stub)
            live_login(page)
        page.wait_for_timeout(2500)

        # 첫 사용자 설치 안내 배너가 그대로 있는지 확인하고, 한 번 열어 본 뒤 닫는다
        # (한 번 보면 다시 뜨지 않으므로 이후 화면은 실제 사용자 화면과 같아진다)
        banner = page.locator("[data-install-banner]")
        install_ok = banner.count() > 0
        print(f"  {'OK ' if install_ok else 'BAD'} 첫 사용자 설치 안내 배너")
        if install_ok:
            banner.click()
            page.wait_for_timeout(1200)
            page.keyboard.press("Escape")
            page.wait_for_timeout(900)
        page.wait_for_timeout(600)

        # ---------- 첫 화면 ----------
        page.wait_for_selector("[data-home-hero]", timeout=20000)
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(800)
        page.screenshot(path=f"{OUT}/_simple_home_top.png")

        metrics = page.evaluate(
            """() => {
                const doc = document.documentElement;
                const nav = document.querySelector("nav[aria-label='주요 메뉴']");
                const navH = nav ? nav.getBoundingClientRect().height : 0;
                const end = document.querySelector("[data-home-end]");
                const endBottom = end ? end.getBoundingClientRect().bottom + window.scrollY : 0;
                return {
                    vh: window.innerHeight,
                    scrollHeight: doc.scrollHeight,
                    clientWidth: doc.clientWidth,
                    navH,
                    firstScreenBottom: Math.round(endBottom),
                    overflowX: Array.from(document.querySelectorAll("main *"))
                        .filter(el => el.getBoundingClientRect().right > doc.clientWidth + 1)
                        .slice(0, 6)
                        .map(el => (el.tagName + "." + (el.className || "")).slice(0, 90)),
                };
            }"""
        )
        print(json.dumps(metrics, ensure_ascii=False, indent=2))
        if metrics["overflowX"]:
            problems.append(f"가로 넘침: {metrics['overflowX']}")
        screens = (metrics["firstScreenBottom"] - metrics["navH"]) / metrics["vh"]
        print(f"첫 화면(인사~혜택) 높이 = {screens:.2f} 화면")
        if screens > 1.25:
            problems.append(f"첫 화면 카드가 {screens:.2f} 화면 — 1~1.2 화면을 넘음")

        # ---------- 카드별 그림 ----------
        for name, sel in [
            ("hero", "[data-home-hero]"),
            ("mission", "[data-group-mission]"),
            ("health", "[data-health-card]"),
        ]:
            loc = page.locator(sel).first
            if loc.count():
                try:
                    loc.scroll_into_view_if_needed()
                    page.wait_for_timeout(400)
                    loc.screenshot(path=f"{OUT}/_simple_{name}.png")
                except Exception as e:
                    print("shot fail", name, e)

        # ---------- 넘치는 글자(말줄임/넘침) 확인 ----------
        clipped = page.evaluate(
            """() => Array.from(document.querySelectorAll("main button, main p, main span"))
                .filter(el => el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow === "visible" && el.clientWidth > 0)
                .slice(0, 8)
                .map(el => (el.textContent || "").trim().slice(0, 40))"""
        )
        print("넘치는 글자:", clipped)
        if clipped:
            problems.append(f"가로로 넘치는 글자: {clipped}")

        # ---------- 이미지 ----------
        broken = page.evaluate(
            """() => Array.from(document.images).filter(i => i.naturalWidth === 0).map(i => i.currentSrc || i.src)"""
        )
        if broken:
            problems.append(f"깨진 이미지: {broken}")

        # ---------- 버튼 동작 ----------
        def hash_of():
            return page.evaluate("location.hash")

        home(page)
        page.get_by_role("button", name="모임 랭킹 보기").click()
        page.wait_for_timeout(1500)
        h = hash_of()
        ok = h == "#ranking"
        print(f"  {'OK ' if ok else 'BAD'} 모임 랭킹 → 랭킹 탭 (hash={h})")
        if not ok:
            problems.append(f"모임 랭킹 → 랭킹 탭 이동 실패 (hash={h})")
        page.screenshot(path=f"{OUT}/_simple_rank_tab.png")

        home(page)
        page.get_by_role("button", name="우리 모임 열기").click()
        page.wait_for_timeout(1500)
        h = hash_of()
        ok = h == "#group"
        print(f"  {'OK ' if ok else 'BAD'} 모임 카드 → 모임 탭 (hash={h})")
        if not ok:
            problems.append(f"모임 카드 → 모임 탭 이동 실패 (hash={h})")

        home(page)
        page.locator("[data-group-mission]").click()
        page.wait_for_timeout(1800)
        h = hash_of()
        quiz_ok = page.locator("text=치매예방").first.is_visible()
        ok = h == "#quiz" and quiz_ok
        print(f"  {'OK ' if ok else 'BAD'} 공동 미션 → 치매예방 퀴즈 (hash={h})")
        if not ok:
            problems.append(f"공동 미션 → 퀴즈 이동 실패 (hash={h}, 치매예방={quiz_ok})")

        home(page)
        page.get_by_role("button", name="가족안부달력").click()
        page.wait_for_timeout(1600)
        cal_ok = page.locator("text=일정 추가").first.is_visible()
        print(f"  {'OK ' if cal_ok else 'BAD'} 달력 보기 → 가족안부달력 화면")
        if not cal_ok:
            problems.append("달력 모달이 열리지 않음")
        page.screenshot(path=f"{OUT}/_simple_calendar.png")
        page.get_by_role("button", name="달력 닫기").click()
        page.wait_for_timeout(900)

        home(page)
        page.get_by_role("button", name="오늘의 운세").click()
        page.wait_for_timeout(1500)
        fortune_ok = page.locator("text=행운의 색").first.is_visible()
        print(f"  {'OK ' if fortune_ok else 'BAD'} 운세 보기 → 오늘의 운세 시트")
        if not fortune_ok:
            problems.append("운세 시트가 열리지 않음")
        page.keyboard.press("Escape")
        page.wait_for_timeout(1000)

        home(page)
        page.get_by_role("button", name="안부 인사 보내기").click()
        page.wait_for_timeout(2000)
        greet_ok = page.locator("text=오늘의 안부 인사카드").first.is_visible()
        print(f"  {'OK ' if greet_ok else 'BAD'} 안부 인사 보내기 → 인사카드 시트")
        if not greet_ok:
            problems.append("안부 인사 시트가 열리지 않음")
        page.screenshot(path=f"{OUT}/_simple_greeting.png")
        page.keyboard.press("Escape")
        page.wait_for_timeout(800)

        home(page)
        page.get_by_role("button", name="오늘의 혜택").click()
        page.wait_for_timeout(1500)
        h = hash_of()
        ok = h == "#welfare"
        print(f"  {'OK ' if ok else 'BAD'} 오늘의 혜택 → 혜택 탭 (hash={h})")
        if not ok:
            problems.append(f"혜택 탭 이동 실패 (hash={h})")

        home(page)
        page.get_by_role("button", name="오늘의 날씨와 생활팁 보기").click()
        page.wait_for_timeout(1500)
        weather_ok = page.locator("text=오늘의 생활팁").first.is_visible()
        print(f"  {'OK ' if weather_ok else 'BAD'} 날씨 알약 → 날씨·생활팁 시트")
        if not weather_ok:
            problems.append("날씨 시트가 열리지 않음")
        page.keyboard.press("Escape")
        page.wait_for_timeout(800)

        # ---------- 모임을 만든 뒤 홈 카드(모임 요약·랭킹) 확인 ----------
        if LOCAL:
            home(page)
            page.get_by_role("button", name="우리 모임 열기").click()
            page.wait_for_timeout(1500)
            try:
                page.get_by_role("button", name="새 모임 만들기").first.click()
                page.wait_for_timeout(700)
                page.get_by_placeholder("예) 우리 가족 사랑방, 옥천 친구들 모임").fill("우리 가족 사랑방")
                page.get_by_role("button", name="모임 만들기", exact=True).click()
                page.wait_for_timeout(2500)
                # 모임을 만든 뒤 뜨는 초대 안내 시트는 닫고 홈으로 돌아간다
                for _ in range(3):
                    if page.locator("div.fixed.inset-0.z-\\[80\\]").count():
                        page.keyboard.press("Escape")
                        page.wait_for_timeout(700)
                    else:
                        break
            except Exception as e:
                problems.append(f"모임 만들기 실패: {e}")
            home(page)
            page.wait_for_timeout(1500)
            page.evaluate("window.scrollTo(0, 0)")
            page.screenshot(path=f"{OUT}/_simple_home_group.png")
            txt = page.locator("[data-home-hero]").locator("xpath=..").inner_text()
            print("모임 카드 글:", [l for l in txt.split("\n") if "출석" in l or "위" in l][:4])

        # ---------- 전체 홈 화면(스크롤 포함) ----------
        home(page)
        # 고정 탭바가 스크롤 중간에 찍히지 않도록 페이지 맨 아래로 옮겨 전체 화면을 담는다
        page.evaluate(
            """() => {
                const nav = document.querySelector("nav[aria-label='주요 메뉴']");
                if (!nav) return;
                nav.style.position = "absolute";
                nav.style.top = (document.documentElement.scrollHeight - nav.getBoundingClientRect().height) + "px";
                nav.style.bottom = "auto";
            }"""
        )
        page.wait_for_timeout(500)
        page.screenshot(path=f"{OUT}/neulbom_simple_home.png", full_page=True)

        browser.close()
    if httpd:
        httpd.shutdown()

    real = [
        e
        for e in errs
        if "Failed to load resource" not in e
        and "t1.kakaocdn.net" not in e
        and "open-meteo.com" not in e
    ]
    print(f"\n콘솔/페이지 오류: {len(real)}건")
    for e in real[:8]:
        print("  ", e)
    print(f"문제: {len(problems)}건")
    for e in problems[:10]:
        print("  ", e)
    if real or problems:
        sys.exit(1)
    print("\n모두 정상입니다.")


if __name__ == "__main__":
    main()
