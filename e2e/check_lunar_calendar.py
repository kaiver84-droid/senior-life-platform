"""가족안부달력 음력 일정 점검 — ① ☀️양력/🌙음력 버튼 ② 음력→양력 실시간 미리보기 ③ 저장 뒤 달력·다가오는 일정·
홈 배너의 🌙 배지 ④ 오늘의 음력 날짜 표시 ⑤ 새로 고침 뒤 유지 ⑥ .ics(음력은 5년치 양력 날짜로) ⑦ 삭제·원상 복구.

로컬:  python3 e2e/check_lunar_calendar.py
라이브: BASE=https://senior-life-platform.pages.dev python3 e2e/check_lunar_calendar.py
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
# 이 샌드박스는 시스템 라이브러리가 빠져 있어 LD_LIBRARY_PATH 로 함께 띄운다
os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.libs/usr/lib/x86_64-linux-gnu:/workspace/work/.tools/browser-libs"
)
NICK = "음력점검"
TITLE = "할머니 생신"
# 2026년 음력 10월 15일 → 양력 2026-11-23(월), 2027년 음력 10월 15일 → 양력 2027-11-12(금)
WANT_SOLAR = "11월 23일"
WANT_SOLAR_NEXT = "11월 12일"

results = {}
errors = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
    results[label] = bool(cond)
    if not cond:
        errors.append(label)


CODE_T = None
if not LOCAL:
    from test_kakao_onboarding import js_make_code, sql  # noqa: E402

    ID_T = "831170455"
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

    def verify_clean():
        rows = sql(f"select count(*) as n from public.users where code = '{CODE_T}';")
        fam = sql(f"select count(*) as n from public.family_events where user_code = '{CODE_T}';")
        n_users = rows[0]["n"] if rows else -1
        n_fam = fam[0]["n"] if fam else -1
        check(n_users == 0 and n_fam == 0, "테스트 계정·일정 0건 확인", f"users={n_users} family_events={n_fam}")

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
                                "birthYear": 1950,
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
                    body=json.dumps(
                        {"ok": True, "supabase": "connected", "kakao": "configured", "kakaoLoginConfigured": True}
                    ),
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
    page.select_option("#setup-birth", "1950")
    page.click('[data-birthtime="묘시"]')
    page.select_option("#setup-sido", "충청북도")
    page.select_option("#setup-sigungu", "옥천군")
    page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
    page.wait_for_timeout(2500)


def open_calendar(page):
    banner = page.get_by_role("button").filter(has_text="열기 ›")
    if banner.count():
        banner.first.click()
    else:
        page.get_by_role("button").filter(has_text="가족안부달력").first.click()
    page.wait_for_selector("text=📅 가족안부달력", timeout=20000)
    page.wait_for_timeout(1200)


def close_calendar(page):
    page.get_by_role("button", name="달력 닫기").click()
    page.wait_for_timeout(1500)


def main():
    shots = []
    if LOCAL:
        from harness import start_server

        start_server()
    else:
        cleanup()

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            locale="ko-KR",
            is_mobile=True,
            has_touch=True,
            accept_downloads=True,
            timezone_id="Asia/Seoul",
        )
        page = ctx.new_page()
        console_errors = []
        page.on("pageerror", lambda e: console_errors.append(f"pageerror: {e}"))
        page.on(
            "console",
            lambda m: console_errors.append(f"console: {m.text}")
            if m.type == "error" and "localhost" not in m.text
            else None,
        )
        if not LOCAL:
            page.route("**/api/auth/kakao**", kakao_stub())

        login(page)
        open_calendar(page)

        # ---------- 1) 오늘의 음력 날짜 표시 ----------
        lunar_today = page.locator("[data-today-lunar]").first
        check(lunar_today.is_visible(), "달력 상단 ‘오늘의 음력 날짜’")
        today_text = lunar_today.inner_text().strip()
        check("음력" in today_text and "오늘" in today_text, "오늘 음력 날짜 문구", today_text.replace("\n", " "))
        page.screenshot(path=f"{SHOT}/_lunar_calendar_top.png")
        shots.append(f"{SHOT}/_lunar_calendar_top.png")

        # ---------- 2) 일정 폼 — 양력/음력 버튼 + 음력 미리보기 ----------
        page.get_by_role("button", name=re.compile(r"^\+?\s*일정")).first.click()
        page.wait_for_selector("#ev-title", timeout=15000)
        solar_btn = page.locator('[data-calendar-type="solar"]')
        lunar_btn = page.locator('[data-calendar-type="lunar"]')
        check(solar_btn.is_visible() and lunar_btn.is_visible(), "☀️ 양력 / 🌙 음력 큰 버튼 2개")
        check(solar_btn.get_attribute("aria-pressed") == "true", "처음에는 양력이 선택됨")

        page.click('[data-event-kind="birthday"]')
        page.fill("#ev-title", TITLE)
        lunar_btn.click()
        page.wait_for_timeout(500)
        check(page.locator('[data-lunar-leap]').is_visible(), "음력 선택 시 ‘윤달’ 토글")
        # 2026년 음력 10월 15일
        page.select_option('[aria-label="연도"]', "2026")
        page.select_option('[aria-label="월"]', "10")
        page.wait_for_timeout(300)
        page.select_option('[aria-label="일"]', "15")
        page.wait_for_timeout(500)
        preview = page.locator("[data-lunar-preview-main]").inner_text().strip()
        check("음력 10월 15일" in preview and WANT_SOLAR in preview and "(월)" in preview, "음력→양력 미리보기", preview)
        next_year = page.locator("[data-lunar-preview-next]")
        check(next_year.count() > 0 and WANT_SOLAR_NEXT in next_year.first.inner_text(), "다음 해 양력 날짜도 안내", next_year.first.inner_text() if next_year.count() else "")
        page.click('[data-alarm-mode="0"]')
        page.click('[data-alarm-time="09:00"]')
        page.wait_for_timeout(300)
        page.screenshot(path=f"{SHOT}/_lunar_form_preview.png")
        shots.append(f"{SHOT}/_lunar_form_preview.png")
        page.get_by_role("button", name=re.compile("일정 저장하기")).first.click()
        page.wait_for_timeout(2200)

        # ---------- 3) 저장 직후 — 양력 날짜로 달력 이동 + 🌙 배지 ----------
        saved = page.locator("[data-calendar-saved]").first
        check(saved.is_visible(), "저장 직후 안내 카드")
        saved_text = saved.inner_text().replace("\n", " ")
        check("음력 10월 15일" in saved_text and WANT_SOLAR in saved_text, "저장 카드에 음력·양력 날짜", saved_text[:120])
        page.wait_for_timeout(800)
        page.evaluate("() => window.scrollTo(0, 0)")
        page.wait_for_timeout(600)
        page.screenshot(path=f"{SHOT}/_lunar_saved.png")
        shots.append(f"{SHOT}/_lunar_saved.png")

        # 다가오는 일정 목록 배지
        up_section = page.locator("[data-calendar-upcoming]").first
        up_text = up_section.inner_text().replace("\n", " ") if up_section.count() else ""
        check(TITLE in up_text and "🌙" in up_text and "음력 10월 15일" in up_text, "다가오는 일정 목록 🌙 배지", up_text[:120])

        # 달력에서 11월 23일 칸으로 이동돼 있고, 그 날 일정 카드에 배지가 보인다
        body = page.inner_text("main")
        check(WANT_SOLAR in body, "달력이 실제 양력 날짜로 이동", "")
        day_badge = page.locator("[data-lunar-badge]").first
        check(day_badge.is_visible(), "일정 카드 🌙 음력 배지")
        badge_text = day_badge.inner_text().replace("\n", " ")
        check("🌙" in badge_text and "음력 10월 15일" in badge_text and WANT_SOLAR in badge_text, "배지 문구", badge_text)

        # ---------- 4) .ics — 음력은 해마다 양력 날짜로 5년치 ----------
        ics_text = None
        ics_btn = page.locator("[data-ics-button]").first
        try:
            with page.expect_download(timeout=20000) as dl:
                ics_btn.click()
            download = dl.value
            path = download.path()
            ics_text = open(path, "r", encoding="utf-8").read() if path else None
        except Exception as e:  # noqa: BLE001
            print("  (download)", e)
        if ics_text:
            # RFC 5545 접기(줄바꿈)를 편 뒤에 글자를 확인한다
            unfolded = ics_text.replace("\r\n ", "").replace("\n ", "")
            vevents = ics_text.count("BEGIN:VEVENT")
            check(ics_text.count("RRULE:FREQ=YEARLY") == 0, ".ics 에 단순 매년 반복(RRULE) 없음")
            check(vevents == 5, ".ics 에 5년치 일정(VEVENT 5개)", f"{vevents}개")
            check("DTSTART:20261123T090000" in ics_text, ".ics 첫 해는 양력 2026-11-23", "")
            check("DTSTART:20271112T090000" in ics_text, ".ics 다음 해는 양력 2027-11-12", "")
            check("음력 10월 15일" in unfolded, ".ics 설명에 음력 날짜", "")
            check("BEGIN:VALARM" in ics_text and "TRIGGER:-PT0M" in ics_text, ".ics 알람(VALARM)")
        else:
            check(False, ".ics 내려받기", "다운로드 실패")

        # ---------- 5) 홈 배너 ----------
        close_calendar(page)
        banner = page.get_by_role("button").filter(has_text="열기 ›").first
        check(banner.is_visible(), "홈 가족안부달력 배너")
        banner_text = banner.inner_text().replace("\n", " ")
        check(TITLE in banner_text and "🌙" in banner_text and WANT_SOLAR in banner_text, "홈 배너에 🌙 음력·양력 날짜", banner_text[:120])
        page.evaluate("() => window.scrollTo(0, 0)")
        page.wait_for_timeout(500)
        page.screenshot(path=f"{SHOT}/_lunar_home_banner.png")
        shots.append(f"{SHOT}/_lunar_home_banner.png")

        # ---------- 6) 새로 고침 뒤 유지 ----------
        page.reload(wait_until="domcontentloaded")
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
        page.wait_for_timeout(2500)
        banner_text = page.get_by_role("button").filter(has_text="열기 ›").first.inner_text().replace("\n", " ")
        check(TITLE in banner_text and "🌙" in banner_text, "새로 고침 뒤에도 음력 일정 유지", banner_text[:120])
        open_calendar(page)
        up_text = page.locator("[data-calendar-upcoming]").first.inner_text().replace("\n", " ")
        check(TITLE in up_text and "음력 10월 15일" in up_text, "새로 고침 뒤 목록 배지 유지", up_text[:100])

        # ---------- 7) 윤달 달력 — 2028년 윤5월 ----------
        page.get_by_role("button", name=re.compile(r"^\+?\s*일정")).first.click()
        page.wait_for_selector("#ev-title", timeout=15000)
        page.locator('[data-calendar-type="lunar"]').click()
        page.wait_for_timeout(400)
        page.select_option('[aria-label="연도"]', "2028")
        page.select_option('[aria-label="월"]', "5")
        page.wait_for_timeout(400)
        leap_note = page.locator('[data-lunar-leap="available"]')
        check(leap_note.count() > 0, "2028년 윤5월 안내", leap_note.first.inner_text().replace("\n", " ") if leap_note.count() else "")
        page.locator('[data-lunar-leap]').click()
        page.wait_for_timeout(300)
        page.select_option('[aria-label="일"]', "1")
        page.wait_for_timeout(400)
        leap_preview = page.locator("[data-lunar-preview-main]").inner_text().strip()
        check("음력 윤5월 1일" in leap_preview and "6월 23일" in leap_preview, "윤달 미리보기(2028 윤5/1 = 2028-06-23)", leap_preview)
        page.locator("[data-sheet-close]").last.click(force=True)
        page.wait_for_timeout(900)

        # ---------- 8) 테스트 일정 삭제 → 원상 복구 ----------
        # 긴 화면 안쪽 스크롤 컨테이너 때문에 좌표 클릭이 흔들려, 버튼을 직접 눌러 지운다
        page.evaluate(
            "() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '삭제')?.click()"
        )
        page.wait_for_timeout(700)
        page.evaluate(
            "() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '지우기')?.click()"
        )
        page.wait_for_timeout(1800)
        check(page.locator('[data-lunar-badge]').count() == 0, "테스트 일정 삭제됨(배지 0개)")

        hard = [e for e in console_errors if "pageerror" in e and "Notification" not in e]
        check(not hard, "콘솔 치명 오류 없음", str(hard[:3]))

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
        canvas.save(f"{SHOT}/neulbom_lunar_calendar.png")
        print("saved", f"{SHOT}/neulbom_lunar_calendar.png")
    except Exception as e:  # noqa: BLE001
        print("composite failed:", e)

    if not LOCAL:
        cleanup()
        verify_clean()
        print("테스트 계정 DB 정리 완료:", CODE_T)

    print("\n결과:", sum(results.values()), "/", len(results), "통과")
    if errors:
        print("실패:", errors)
        sys.exit(1)


if __name__ == "__main__":
    main()
