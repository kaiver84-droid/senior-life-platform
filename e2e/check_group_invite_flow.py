"""모임 초대 동선 점검 — ① 생성 직후 초대 시트 자동 열림 ② 상단·목록 초대 버튼 ③ 1인 모임 초대 안내.

로컬:  python3 e2e/check_group_invite_flow.py
라이브: BASE=https://senior-life-platform.pages.dev python3 e2e/check_group_invite_flow.py

라이브 점검은 카카오 인가만 Playwright 라우팅으로 흉내 내고, 페이지·API·Supabase 는 실제 라이브를 쓴다.
끝나면 테스트 계정이 만든 모임·글·회원·사용자 행을 DB 에서 지운다.
"""
import json
import os
import re
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", "http://127.0.0.1:8099").rstrip("/")
LOCAL = BASE.startswith("http://127.0.0.1")
SHOT = "/workspace/downloads"
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")
TEST_GROUP = "초대점검 모임"
NICK = "초대점검"

results = {}
errors = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
    results[label] = bool(cond)
    if not cond:
        errors.append(label)


if not LOCAL:
    from test_kakao_onboarding import js_make_code, sql  # noqa: E402

    ID_T = "777479101"
    CODE_T = js_make_code(f"kakao_{ID_T}")

    def cleanup():
        codes = f"'{CODE_T}'"
        for q in [
            f"delete from public.group_cheers where user_code in ({codes});",
            f"delete from public.group_posts where user_code in ({codes});",
            f"delete from public.group_members where user_code in ({codes});",
            f"delete from public.groups where creator_code in ({codes});",
            f"delete from public.quiz_logs where user_code in ({codes});",
            f"delete from public.daily_visits where user_code in ({codes});",
            f"delete from public.med_checks where user_code in ({codes});",
            f"delete from public.health_checks where user_code in ({codes});",
            f"delete from public.family_events where user_code in ({codes});",
            f"delete from public.users where code in ({codes});",
        ]:
            try:
                sql(q)
            except Exception as e:  # noqa: BLE001
                print("  (cleanup skip)", q[:60], e)

    def kakao_stub():
        def handler(route, request):
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
                                "id": f"kakao_{ID_T}",
                                "nickname": NICK,
                                "birthYear": 1955,
                                "source": "kakao",
                                "createdAt": "2026-11-17T00:00:00.000Z",
                            },
                        }
                    ),
                )
            else:
                route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps({"ok": True, "supabase": "connected", "kakao": "configured", "kakaoLoginConfigured": True}),
                )

        return handler


def login(page):
    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
    if LOCAL:
        page.get_by_role("button", name="카카오 없이 둘러보기 (개발용)").click()
    else:
        page.get_by_role("button", name="카카오톡으로 시작하기").click()
    page.wait_for_selector("#setup-nick", timeout=30000)
    page.fill("#setup-nick", NICK)
    page.select_option("#setup-birth", "1952")
    page.click('[data-birthtime="묘시"]')
    page.select_option("#setup-sido", "충청북도")
    page.select_option("#setup-sigungu", "옥천군")
    page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
    page.wait_for_timeout(2000)


def nav(page, label):
    page.get_by_role("navigation").get_by_role("button", name=label).click()


def invite_sheet(page):
    return page.locator("[data-group-invite-sheet]").first


def wait_sheet(page, timeout=12000):
    try:
        page.wait_for_selector("[data-group-invite-sheet]", timeout=timeout)
        page.wait_for_timeout(600)
        return True
    except Exception:  # noqa: BLE001
        return False


def main():
    if LOCAL:
        from harness import start_server

        start_server()
    else:
        cleanup()

    shots = []
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
        console_errors = []
        page.on("pageerror", lambda e: console_errors.append(f"pageerror: {e}"))
        page.on("console", lambda m: console_errors.append(f"console: {m.text}") if m.type == "error" else None)
        if not LOCAL:
            page.route("**/api/auth/kakao**", kakao_stub())

        login(page)
        nav(page, "모임")
        page.wait_for_timeout(1800)

        # ---------- 1) 여러 명 모임(체험 FAM101) 가입 → 기존 초대 버튼 유지 + 상단/목록 초대 버튼 ----------
        try:
            page.get_by_role("button", name=re.compile("체험 모임 들어가기")).first.click()
        except Exception:  # noqa: BLE001
            pass
        try:
            page.wait_for_selector("text=오늘 출석 현황", timeout=30000)
        except Exception:  # noqa: BLE001
            pass
        page.wait_for_timeout(2500)
        body = page.inner_text("main")
        m = re.search(r"멤버 (\d+)명", body)
        check(bool(m) and int(m.group(1)) > 1, "체험 모임(여러 명) 입장", m.group(0) if m else "")
        check("카카오톡으로 우리 모임 초대하기" in body, "기존 카톡 초대 버튼 유지")
        check("아직 나 혼자 있어요" not in body, "여러 명 모임에서는 1인 안내 숨김")
        check(page.locator("[data-group-invite-top]").first.is_visible(), "상단 헤더 💌 초대 버튼")
        check(page.locator("[data-group-row-invite]").first.is_visible(), "내 모임 ‘보는 중’ 줄 초대 버튼")

        page.locator("[data-group-invite-top]").first.click()
        check(wait_sheet(page), "상단 초대 버튼으로 초대 시트 열림")
        sheet = invite_sheet(page).inner_text()
        check("FAM101" in sheet and "초대장 보내기" in sheet, "초대 시트 내용(번호·카톡)", sheet.replace("\n", " ")[:80])
        page.screenshot(path=f"{SHOT}/_group_invite_multi.png")
        shots.append(f"{SHOT}/_group_invite_multi.png")
        page.keyboard.press("Escape")
        page.wait_for_timeout(800)

        page.locator("[data-group-row-invite]").first.click()
        check(wait_sheet(page), "목록 초대 버튼으로 초대 시트 열림")
        page.keyboard.press("Escape")
        page.wait_for_timeout(800)

        # ---------- 2) 새 모임 만들기 → 만들자마자 초대 시트 ----------
        page.evaluate("() => window.scrollTo(0, 0)")
        page.wait_for_timeout(400)
        page.get_by_role("button", name=re.compile("새 모임 만들기")).first.click()
        page.wait_for_selector("#group-name", timeout=15000)
        page.fill("#group-name", TEST_GROUP)
        page.get_by_role("button", name=re.compile("^모임 만들기|모임을 만드는 중")).last.click()

        opened = wait_sheet(page, 25000)
        body = page.inner_text("body")
        check(opened, "모임 생성 직후 초대 시트 자동 열림")
        check("모임을 만들었어요" in body, "생성 직후 토스트 안내")
        new_code = None
        if opened:
            sheet = invite_sheet(page).inner_text()
            code_m = re.search(r"\b([A-Z0-9]{6})\b", sheet)
            new_code = code_m.group(1) if code_m else None
            check(bool(new_code), "초대 시트에 새 모임 초대 번호 표시", str(new_code))
            check(bool(new_code) and f"?group={new_code}" in sheet, "초대 링크에 새 모임 코드 포함", f"?group={new_code}")
            check("카카오톡으로 초대장 보내기" in sheet and "초대 링크 복사" in sheet, "초대장 보내기·링크 복사 버튼")
        page.screenshot(path=f"{SHOT}/_group_invite_after_create.png")
        shots.append(f"{SHOT}/_group_invite_after_create.png")

        page.keyboard.press("Escape")
        page.wait_for_timeout(1000)

        # ---------- 3) 1인 모임 — 큰 초대 안내 + 바로 초대 ----------
        page.evaluate("() => window.scrollTo(0, 0)")
        page.wait_for_timeout(600)
        body = page.inner_text("main")
        check("아직 나 혼자 있어요" in body and "가족이나 친구를 초대해 보세요" in body, "1인 모임 초대 안내 문구")
        check(page.get_by_role("button", name=re.compile("카카오톡으로 바로 초대하기")).first.is_visible(), "1인 모임 큰 ‘바로 초대’ 버튼")
        page.wait_for_timeout(3200)  # 토스트가 사라진 뒤
        page.screenshot(path=f"{SHOT}/_group_invite_solo.png")
        shots.append(f"{SHOT}/_group_invite_solo.png")

        page.get_by_role("button", name=re.compile("카카오톡으로 바로 초대하기")).first.click()
        check(wait_sheet(page), "‘바로 초대’ 버튼으로 초대 시트 열림")
        if new_code:
            check(new_code in invite_sheet(page).inner_text(), "1인 모임 초대 시트에 새 모임 번호", new_code)
        page.keyboard.press("Escape")
        page.wait_for_timeout(700)

        hard = [e for e in console_errors if "pageerror" in e or "Failed to fetch" not in e]
        check(not hard, "콘솔 치명 오류 없음", str(hard[:3]))

        # --- 한 장으로 합치기 ---
        browser.close()

    try:
        from PIL import Image

        imgs = [Image.open(s) for s in shots]
        w = max(i.width for i in imgs)
        gap = 24
        h = sum(i.height for i in imgs) + gap * (len(imgs) - 1)
        canvas = Image.new("RGB", (w, h), "white")
        y = 0
        for im in imgs:
            canvas.paste(im, ((w - im.width) // 2, y))
            y += im.height + gap
        canvas.save(f"{SHOT}/neulbom_group_invite_flow.png")
        print("saved", f"{SHOT}/neulbom_group_invite_flow.png")
    except Exception as e:  # noqa: BLE001
        print("composite failed:", e)

    if not LOCAL:
        cleanup()
        print("테스트 계정 DB 정리 완료:", CODE_T)

    print("\n결과:", sum(results.values()), "/", len(results), "통과")
    if errors:
        print("실패:", errors)
        sys.exit(1)


if __name__ == "__main__":
    main()
