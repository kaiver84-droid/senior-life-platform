"""가족안부달력 알람 점검 — ① 알람 설정·저장 ② 일정 카드 🔔 배지 ③ 홈·달력 상단 오늘의 일정 알림 카드
④ .ics(VALARM) 내려받기 ⑤ 소리로 듣기·확인했어요.

로컬:  python3 e2e/check_calendar_alarm.py
라이브: BASE=https://senior-life-platform.pages.dev python3 e2e/check_calendar_alarm.py
"""
import json
import os
import re
import sys
import tempfile

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", "http://127.0.0.1:8099").rstrip("/")
LOCAL = BASE.startswith("http://127.0.0.1")
SHOT = "/workspace/downloads"
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")
NICK = "알람점검"
TODAY_EVENT = "병원 정기검진"
TOMORROW_EVENT = "손주 생일 잔치"

results = {}
errors = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
    results[label] = bool(cond)
    if not cond:
        errors.append(label)


if not LOCAL:
    from test_kakao_onboarding import js_make_code, sql  # noqa: E402

    ID_T = "777479102"
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
    page.select_option("#setup-birth", "1950")
    page.click('[data-birthtime="묘시"]')
    page.select_option("#setup-sido", "충청북도")
    page.select_option("#setup-sigungu", "옥천군")
    page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
    page.wait_for_timeout(2500)


def open_calendar(page):
    # 일정이 있으면 홈 배너 글자가 일정 이름으로 바뀐다 — ‘열기 ›’ 로 찾는다
    banner = page.get_by_role("button").filter(has_text="열기 ›")
    if banner.count():
        banner.first.click()
    else:
        page.get_by_role("button").filter(has_text="가족안부달력").first.click()
    page.wait_for_selector("text=📅 가족안부달력", timeout=20000)
    page.wait_for_timeout(1200)


def add_event(page, title, next_day=False, alarm_mode="0", alarm_time="09:00", kind_label="병원·약속"):
    page.get_by_role("button", name=re.compile(r"^\+?\s*일정")).first.click()
    page.wait_for_selector("#ev-title", timeout=15000)
    page.get_by_role("button", name=re.compile(kind_label)).first.click()
    page.fill("#ev-title", title)
    page.get_by_role("button", name=re.compile("^내일$" if next_day else "^오늘$")).first.click()
    page.click(f'[data-alarm-mode="{alarm_mode}"]')
    if alarm_mode != "none":
        page.click(f'[data-alarm-time="{alarm_time}"]')
    page.wait_for_timeout(300)
    summary = page.locator("[data-alarm-summary]").inner_text() if alarm_mode != "none" else ""
    page.get_by_role("button", name=re.compile("일정 저장하기|고친 내용 저장")).first.click()
    page.wait_for_timeout(1800)
    return summary


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
            accept_downloads=True,
        )
        page = ctx.new_page()
        console_errors = []
        page.on("pageerror", lambda e: console_errors.append(f"pageerror: {e}"))
        page.on(
            "console",
            lambda m: console_errors.append(f"console: {m.text}") if m.type == "error" and "localhost" not in m.text else None,
        )
        if not LOCAL:
            page.route("**/api/auth/kakao**", kakao_stub())

        login(page)
        open_calendar(page)

        # ---------- 1) 알람 폼 확인 ----------
        page.get_by_role("button", name=re.compile(r"^\+?\s*일정")).first.click()
        page.wait_for_selector("#ev-title", timeout=15000)
        check(page.locator("[data-alarm-box]").is_visible(), "일정 폼에 🔔 알람 설정 영역")
        modes = [page.locator(f'[data-alarm-mode="{m}"]').inner_text().strip() for m in ["0", "1", "3", "none"]]
        check(
            all(k in modes[0] for k in ["당일"]) and "1일 전" in modes[1] and "3일 전" in modes[2] and "알람 없음" in modes[3],
            "알람 시점 칩(당일·1일 전·3일 전·알람 없음)",
            str(modes),
        )
        times = page.locator("[data-alarm-time]").all_inner_texts()
        check(len(times) == 3 and "오전 9시" in times[0], "알람 시각 칩(오전 9시·낮 12시·오후 6시)", str(times))
        page.fill("#ev-title", TODAY_EVENT)
        page.get_by_role("button", name=re.compile("병원·약속")).first.click()
        page.get_by_role("button", name=re.compile("^오늘$")).first.click()
        page.click('[data-alarm-mode="0"]')
        page.click('[data-alarm-time="09:00"]')
        page.wait_for_timeout(400)
        summary = page.locator("[data-alarm-summary]").inner_text()
        check("오전 9시" in summary, "알람 요약 문구 표시", summary.strip())
        page.screenshot(path=f"{SHOT}/_calendar_alarm_form.png")
        shots.append(f"{SHOT}/_calendar_alarm_form.png")
        page.get_by_role("button", name=re.compile("일정 저장하기")).first.click()
        page.wait_for_timeout(2200)

        # ---------- 2) 저장 직후 안내 + 카드 배지 ----------
        saved = page.locator("[data-calendar-saved]").first
        check(saved.is_visible(), "저장 직후 안내 카드")
        saved_text = saved.inner_text()
        check("🔔" in saved_text and "오전 9시" in saved_text, "저장 직후 알람 표시", saved_text.replace("\n", " ")[:80])
        check(saved.locator("[data-ics-button]").is_visible(), "저장 직후 .ics 버튼")

        # ---------- 3) .ics 내려받기(VALARM 포함) ----------
        ics_text = None
        try:
            with page.expect_download(timeout=15000) as dl:
                saved.locator("[data-ics-button]").click()
            download = dl.value
            path = download.path()
            ics_text = open(path, "r", encoding="utf-8").read() if path else None
        except Exception as e:  # noqa: BLE001
            print("  (download)", e)
        check(bool(ics_text) and "BEGIN:VCALENDAR" in ics_text, ".ics 파일 내려받기", (ics_text or "")[:0])
        check(bool(ics_text) and "BEGIN:VALARM" in ics_text and "TRIGGER:-PT0M" in ics_text, ".ics 안에 VALARM 포함")
        check(bool(ics_text) and TODAY_EVENT in ics_text, ".ics 에 일정 이름 포함")
        if ics_text:
            with tempfile.NamedTemporaryFile("w", suffix=".ics", delete=False, encoding="utf-8") as f:
                f.write(ics_text)

        # ---------- 4) 달력 상단 오늘의 일정 알림 ----------
        page.wait_for_timeout(600)
        page.evaluate("() => window.scrollTo(0, 0)")
        page.wait_for_timeout(500)
        card = page.locator('[data-today-alarm="calendar"]').first
        check(card.is_visible(), "달력 상단 ‘오늘의 일정 알림’ 카드")
        card_text = card.inner_text()
        check(TODAY_EVENT in card_text and "오늘" in card_text, "카드에 오늘 일정 표시", card_text.replace("\n", " ")[:90])
        check(card.get_by_role("button", name=re.compile("소리로 듣기")).is_visible(), "🔊 소리로 듣기 버튼")
        check(card.get_by_role("button", name=re.compile("확인했어요")).is_visible(), "✅ 확인했어요 버튼")
        check(card.get_by_role("button", name=re.compile("휴대폰 알림")).is_visible(), "🔔 휴대폰 알림 켜기 버튼")
        check(page.locator("[data-event-alarm]").first.is_visible(), "일정 카드 🔔 알람 배지")
        page.screenshot(path=f"{SHOT}/_calendar_alarm_card.png")
        shots.append(f"{SHOT}/_calendar_alarm_card.png")

        # ---------- 5) ‘1일 전’ 알람은 오늘 울린다 ----------
        summary = add_event(page, TOMORROW_EVENT, next_day=True, alarm_mode="1", alarm_time="18:00", kind_label="생일")
        check("1일 전" in summary and "오후 6시" in summary, "‘1일 전 오후 6시’ 요약", summary.strip())
        page.evaluate("() => window.scrollTo(0, 0)")
        page.wait_for_timeout(1200)
        card_text = page.locator('[data-today-alarm="calendar"]').first.inner_text()
        check(TOMORROW_EVENT in card_text and "1일 뒤" in card_text, "1일 전 알람이 오늘 카드에 표시", card_text.replace("\n", " ")[:100])

        # ---------- 6) 홈 화면에서도 같은 알림 ----------
        page.get_by_role("button", name="달력 닫기").click()
        page.wait_for_timeout(1500)
        home_card = page.locator('[data-today-alarm="home"]').first
        check(home_card.is_visible(), "홈 화면 ‘오늘의 일정 알림’ 카드")
        check(home_card.evaluate("el => el.getBoundingClientRect().top < 400"), "홈 카드가 화면 위쪽에 보임")
        page.evaluate("() => window.scrollTo(0, 0)")
        page.wait_for_timeout(400)
        page.screenshot(path=f"{SHOT}/_calendar_alarm_home.png")
        shots.append(f"{SHOT}/_calendar_alarm_home.png")

        home_card.get_by_role("button", name=re.compile("확인했어요")).click()
        page.wait_for_timeout(1200)
        check(page.locator('[data-today-alarm="home"]').count() == 0, "‘확인했어요’ 뒤 카드 사라짐")

        # 새로 고침해도 확인 표시가 유지된다
        page.reload(wait_until="domcontentloaded")
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
        page.wait_for_timeout(2500)
        check(page.locator('[data-today-alarm="home"]').count() == 0, "새로 고침해도 오늘은 다시 띄우지 않음")

        # 저장한 일정이 남아 있는지 (서버 저장 포함)
        open_calendar(page)
        body = page.inner_text("main")
        check(TODAY_EVENT in body, "저장한 일정 유지(새로 고침 뒤)", "")

        hard = [
            e
            for e in console_errors
            if "pageerror" in e and "Notification" not in e
        ]
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
        canvas.save(f"{SHOT}/neulbom_calendar_alarm.png")
        print("saved", f"{SHOT}/neulbom_calendar_alarm.png")
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
