"""40대(1986·1987년생) 가입·설정 저장 검증 — 로컬 out/ 또는 라이브.

BASE=https://senior-life-platform.pages.dev python3 e2e/test_birth_40s.py   # 라이브(카카오 스텁 로그인)
python3 e2e/test_birth_40s.py                                              # 로컬 out/

확인 항목
1) 초기 설정의 '태어난 해' 선택지에 1987년(맨 끝)까지 있고, 1986/1987년생으로 저장이 된다
2) 홈이 그대로 뜨고(막힘 없음), 복지 화면에 40대용 혜택(국민내일배움카드·중장년내일센터·국가 건강검진)이 보인다
3) ⚙ 설정 → '내 정보 고치기'에서도 1987년이 선택지에 있고, 다시 저장해도 값이 유지된다
"""
import json
import os
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from harness import PORT, start_server  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", f"http://127.0.0.1:{PORT}").rstrip("/")
LOCAL = BASE.startswith("http://127.0.0.1")
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")
SHOT = "/workspace/downloads"
NAME = os.environ.get("NAME", "중년철수")
BIRTH = os.environ.get("BIRTH", "1986")
KAKAO_ID = os.environ.get("KAKAO_ID", "777009777")

results = {}
errors = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
    results[label] = bool(cond)
    if not cond:
        errors.append(label)


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
                        "nickname": NAME,
                        "birthYear": 1986,
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


def main():
    httpd = None
    if LOCAL:
        httpd = start_server()
    page_errors = []

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
        page.on("pageerror", lambda e: page_errors.append(f"pageerror: {e}"))
        page.on(
            "console",
            lambda m: page_errors.append(f"error: {m.text}")
            if m.type == "error" and "/api/" not in (m.location or {}).get("url", "")
            else None,
        )

        if LOCAL:
            page.goto(BASE + "/", wait_until="domcontentloaded")
            page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
            page.get_by_role("button", name="카카오 없이 둘러보기 (개발용)").click()
        else:
            page.route("**/t1.kakaocdn.net/**", lambda route, _req: route.abort())
            page.route("**/api/auth/kakao**", kakao_stub)
            page.goto(BASE + "/", wait_until="domcontentloaded")
            page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
            page.get_by_role("button", name="카카오톡으로 시작하기").click()

        page.wait_for_selector("#setup-nick", timeout=30000)

        years = page.locator("#setup-birth option").all_inner_texts()
        check(len(years) > 0 and years[-1].startswith("1987"), "초기 설정 출생연도 마지막 항목이 1987년", years[-1] if years else "-")
        check(any(y.startswith("1986") for y in years), "1986년 선택지 있음")

        page.fill("#setup-nick", NAME)
        page.select_option("#setup-birth", BIRTH)
        page.click('[data-birthtime="묘시"]')
        page.select_option("#setup-sido", "충청북도")
        page.select_option("#setup-sigungu", "옥천군")
        page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
        page.wait_for_timeout(2800)
        check(True, "40대(1986년생)로 가입·초기 설정 저장 완료")
        check(page.get_by_text(NAME).first.is_visible(), "홈에 이름 표시")

        # 복지 탭 — 40대용 혜택
        nav = page.get_by_role("navigation").get_by_role("button")
        nav.nth(4).click()
        page.wait_for_timeout(1800)
        body = page.inner_text("body")
        check(f"{BIRTH}년생" in body, "복지 화면에 1986년생(40세) 기준 표시", [l for l in body.splitlines() if "년생" in l][:1])
        check("국민내일배움카드" in body, "복지 화면에 40대용 '국민내일배움카드' 노출")
        check("중장년내일센터" in body, "복지 화면에 '중장년내일센터' 노출")
        check("40·50대는" in body, "40·50대 안내 문구 노출")
        page.screenshot(path=f"{SHOT}/neulbom_welfare_40s.png")

        # 설정 → 내 정보 고치기
        page.get_by_role("button", name="설정").click()
        page.wait_for_timeout(700)
        page.get_by_role("button", name="내 정보 고치기").click()
        page.wait_for_timeout(700)
        years2 = page.locator("#edit-birth option").all_inner_texts()
        check(len(years2) > 0 and years2[-1].startswith("1987"), "내 정보 고치기에도 1987년까지 있음", years2[-1] if years2 else "-")
        check(page.locator("#edit-birth").input_value() == BIRTH, "저장한 출생연도가 그대로 선택돼 있음")
        page.select_option("#edit-birth", "1987")
        save_btn = page.get_by_role("button", name="저장", exact=True)
        save_btn.scroll_into_view_if_needed()
        page.wait_for_timeout(300)
        save_btn.click()
        page.wait_for_timeout(1400)
        check("1987년생" in page.inner_text("body"), "저장 직후 설정 화면에 1987년생으로 표시")
        page.keyboard.press("Escape")
        page.wait_for_timeout(700)
        page.get_by_role("button", name="설정").click()
        page.wait_for_timeout(600)
        page.get_by_role("button", name="내 정보 고치기").click()
        page.wait_for_timeout(700)
        check(page.locator("#edit-birth").input_value() == "1987", "1987년으로 고친 값이 다시 열었을 때 유지")
        page.keyboard.press("Escape")
        page.wait_for_timeout(600)

        nav.nth(4).click()
        page.wait_for_timeout(1500)
        check("1987년생" in page.inner_text("body"), "1987년생으로 바꾼 뒤 복지 화면 기준도 1987년생")

        browser.close()
    if httpd:
        httpd.shutdown()

    real_errors = [e for e in page_errors if "Failed to load resource" not in e and "t1.kakaocdn.net" not in e]
    check(len(real_errors) == 0, "콘솔/페이지 오류 0건", "; ".join(real_errors[:3]))
    print(f"\n결과: {sum(1 for v in results.values() if v)}/{len(results)} 통과")
    if errors:
        print("실패:", ", ".join(errors))
        sys.exit(1)


if __name__ == "__main__":
    main()
