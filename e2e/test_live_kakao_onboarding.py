"""라이브(https://senior-life-platform.pages.dev)에서 로그인 전용 첫 화면 + 최초 1회 설정을 검증한다.

- 페이지·API 는 실제 배포본을 그대로 쓰고, **카카오 인가(/api/auth/kakao)만** Playwright 라우팅으로 흉내 낸다.
  (실제 카카오 계정 로그인은 사용자 본인만 할 수 있어, 인가 단계만 대체한다)
- 검증 항목은 e2e/test_kakao_onboarding.py 와 같고, 스크린샷을 모바일 크기(402×874)로 남긴다.

사용법: python3 e2e/test_live_kakao_onboarding.py
"""
import json
import os
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from test_kakao_onboarding import sql, js_make_code, compose  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = "https://senior-life-platform.pages.dev"
KAKAO_ID = "777000222"
KAKAO_NAME = "카카오테스트"
CODE = js_make_code(f"kakao_{KAKAO_ID}")
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")
TMP = "/workspace/downloads/_tiles_kakao_live"
SHOT = "/workspace/downloads"

errors = []


def check(cond, label):
    print(("  OK   " if cond else "  FAIL ") + label)
    if not cond:
        errors.append(label)


def crisp(page, path, wait=800):
    page.wait_for_timeout(wait)
    page.screenshot(path=path)
    return path


CONFIG = {
    "ok": True,
    "supabase": "connected",
    "kakao": "configured",
    "kakaoLoginConfigured": True,
    # 서버 경유(302) 폴백 경로를 검증하려고 JS SDK 경로는 끈다
    "kakaoJsConfigured": False,
    "redirectUri": f"{BASE}/",
}
PROFILE = {
    "id": f"kakao_{KAKAO_ID}",
    "nickname": KAKAO_NAME,
    "birthYear": 0,
    "sido": "",
    "sigungu": "",
    "source": "kakao",
    "createdAt": "2026-11-16T00:00:00.000Z",
}


def stub_kakao(route, request):
    url = request.url
    if "start=1" in url:
        route.fulfill(status=302, headers={"location": "/?code=STUB-AUTH-CODE"})
    elif request.method == "POST":
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True, "profile": PROFILE}))
    else:
        route.fulfill(status=200, content_type="application/json", body=json.dumps(CONFIG))


def new_page(browser):
    ctx = browser.new_context(
        viewport={"width": 402, "height": 874}, device_scale_factor=2, locale="ko-KR", timezone_id="Asia/Seoul"
    )
    page = ctx.new_page()
    page.route("**/api/auth/kakao**", stub_kakao)
    return ctx, page


def main():
    os.makedirs(TMP, exist_ok=True)
    sql(f"delete from public.users where code = '{CODE}';")
    print("테스트 코드:", CODE)

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME if os.path.exists(CHROME) else None)

        # ---------- ① 라이브 첫 화면 ----------
        ctx, page = new_page(browser)
        page.goto(BASE + "/", wait_until="networkidle")
        page.wait_for_selector("text=카카오톡으로 시작하기", timeout=25000)
        shot_login = crisp(page, f"{TMP}/01_live_login.png", 900)
        check(page.query_selector("#setup-nick") is None, "라이브 첫 화면에 이름 입력 폼이 없다")
        check(page.query_selector("input") is None, "라이브 첫 화면에 입력칸이 하나도 없다")
        check(page.query_selector("select") is None, "라이브 첫 화면에 선택칸이 하나도 없다")
        check(page.get_by_role("button", name="카카오 없이 둘러보기 (개발용)").count() == 0,
              "라이브에서는 개발용 둘러보기가 보이지 않는다")
        check(page.get_by_role("button", name="카카오톡으로 시작하기").is_visible(), "카카오톡으로 시작하기 버튼만 있다")

        # ---------- ② 로그인 후 최초 1회 설정 ----------
        page.get_by_role("button", name="카카오톡으로 시작하기").click()
        page.wait_for_selector("#setup-nick", timeout=30000)
        page.wait_for_timeout(600)
        check(page.locator("#setup-time [data-birthtime]").count() == 13, "태어난 시간 모르겠음 + 12시진")
        check(page.input_value("#setup-nick") == KAKAO_NAME, "카카오 닉네임이 기본값으로 채워진다")
        page.fill("#setup-nick", "라이브순자")
        page.select_option("#setup-birth", "1944")
        page.click('[data-birthtime="신시"]')
        page.select_option("#setup-sido", "충청북도")
        page.select_option("#setup-sigungu", "옥천군")
        shot_setup = crisp(page, f"{TMP}/02_live_setup.png", 400)
        page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=25000)
        page.wait_for_timeout(2200)
        shot_home = crisp(page, f"{TMP}/03_live_home.png", 900)
        check(page.get_by_text("라이브순자").count() > 0, "저장 후 홈에 내 이름이 보인다")

        # ---------- ③ 라이브 API/DB 반영 ----------
        import urllib.request

        req = urllib.request.Request(
            f"{BASE}/api/state?code={CODE}",
            headers={"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"},
        )
        live_state = json.loads(urllib.request.urlopen(req, timeout=25).read())
        prof = (live_state.get("state") or {}).get("profile") or {}
        print("   라이브 /api/state profile:", prof)
        check(prof.get("profileCompleted") is True, "라이브 API 가 profileCompleted=true 를 돌려준다")
        check(prof.get("birthTime") == "신시", "라이브 API 가 birthTime=신시 를 돌려준다")
        row = sql(f"select nickname, birth_year, birth_time, sido, sigungu, profile_completed from public.users where code = '{CODE}';")
        print("   Supabase 행:", row)
        check(bool(row) and row[0]["birth_time"] == "신시" and row[0]["profile_completed"] is True,
              "Supabase 에 birth_time/profile_completed 저장")
        ctx.close()

        # ---------- ④ 다른 기기 재로그인 → 설정 건너뛰기 ----------
        ctx2, page2 = new_page(browser)
        page2.goto(BASE + "/", wait_until="networkidle")
        page2.wait_for_selector("text=카카오톡으로 시작하기", timeout=25000)
        page2.get_by_role("button", name="카카오톡으로 시작하기").click()
        page2.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
        page2.wait_for_timeout(1200)
        check(page2.query_selector("#setup-nick") is None, "재로그인 시 설정 화면을 건너뛴다")
        restored = page2.evaluate("() => JSON.parse(localStorage.getItem('seniorLife.v1')).profile")
        print("   복원:", restored)
        check(restored.get("nickname") == "라이브순자" and restored.get("birthTime") == "신시",
              "DB 프로필(이름·태어난 시간)을 그대로 불러온다")
        shot_relogin = crisp(page2, f"{TMP}/04_live_relogin.png", 700)

        # ---------- ⑤ ⚙ 설정에서 태어난 시간 수정 ----------
        page2.get_by_role("button", name="설정").click()
        page2.wait_for_selector("text=내 정보 · 설정", timeout=10000)
        check(page2.get_by_text("태어난 시간 · 신시 (15:30~17:29)").count() >= 1, "설정에 태어난 시간이 보인다")
        page2.get_by_role("button", name="내 정보 고치기").click()
        page2.wait_for_selector("#edit-time", timeout=10000)
        page2.click('[data-birthtime="오시"]')
        shot_edit = crisp(page2, f"{TMP}/05_live_settings_edit.png", 400)
        page2.get_by_role("button", name="저장", exact=True).click()
        page2.wait_for_timeout(1400)
        check(page2.get_by_text("태어난 시간 · 오시 (11:30~13:29)").count() >= 1, "설정에서 태어난 시간 수정 반영")
        page2.wait_for_timeout(1800)
        row2 = sql(f"select birth_time from public.users where code = '{CODE}';")
        check(bool(row2) and row2[0]["birth_time"] == "오시", "수정한 태어난 시간이 라이브 DB에도 반영")
        page2.keyboard.press("Escape")

        # ---------- ⑥ 운세에 태어난 시간 반영 ----------
        page2.get_by_role("button", name="오늘의 운세").first.click()
        page2.wait_for_selector("text=오시 팁", timeout=10000)
        check(page2.get_by_text("한낮에 태어나").count() >= 1, "운세에 시진 성향이 보인다")
        shot_fortune = crisp(page2, f"{TMP}/06_live_fortune.png", 500)
        page2.keyboard.press("Escape")
        ctx2.close()
        browser.close()

    compose(
        [shot_login, shot_setup, shot_home],
        f"{SHOT}/neulbom_kakao_onboarding.png",
        ["① 라이브 첫 화면 · 카카오톡 로그인 전용", "② 로그인 후 최초 1회 설정", "③ 저장하면 바로 홈"],
    )
    compose(
        [shot_relogin, shot_edit, shot_fortune],
        f"{SHOT}/neulbom_kakao_relogin_skip.png",
        ["④ 다른 기기에서 재로그인 → 설정 건너뜀", "⑤ 설정에서 태어난 시간 수정", "⑥ 운세에 시간대 팁"],
    )

    print()
    if errors:
        print("실패:", len(errors))
        for e in errors:
            print(" -", e)
        sys.exit(1)
    print("라이브 검증 모두 통과 ✅")


if __name__ == "__main__":
    main()
