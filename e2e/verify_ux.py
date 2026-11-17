"""시니어 맞춤 UX 개편(태어난 시간·필터·큰 버튼·TTS·공유 시트) 로컬 검증.

out/ 정적 빌드를 띄우고 390×844 로 확인한다.
    python3 e2e/verify_ux.py
"""
import os
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402
from harness import start_server, PORT  # noqa: E402

SHOT = "/workspace/downloads"
TMP = "/tmp/ux"
os.makedirs(TMP, exist_ok=True)

fails = []


def check(ok, label, detail=""):
    print(("  PASS " if ok else "  FAIL ") + label + (f" — {detail}" if detail and not ok else ""))
    if not ok:
        fails.append(label)


def box(page, selector):
    return page.locator(selector).first.bounding_box()


def overflow(page, selector):
    return page.eval_on_selector(
        selector,
        "el => ({ sw: el.scrollWidth, cw: el.clientWidth })",
    )


def main():
    httpd = start_server()
    base = f"http://127.0.0.1:{PORT}/"
    errors = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            ctx = browser.new_context(
                viewport={"width": 390, "height": 844},
                device_scale_factor=3,
                locale="ko-KR",
                is_mobile=True,
                has_touch=True,
            )
            page = ctx.new_page()
            page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

            # ---------- 1) 로그인 화면 문구 ----------
            page.goto(base, wait_until="domcontentloaded")
            page.wait_for_selector("text=카카오톡으로 시작하기", timeout=15000)
            login_text = page.inner_text("body")
            check("카카오 계정으로 한 번만 로그인하면 끝나요" in login_text, "로그인 안내가 실제 웹 로그인에 맞다")
            check("카카오 로그인 화면이 열려요" in login_text, "버튼을 누르면 카카오 로그인 화면이 열린다고 안내")

            page.get_by_role("button", name="카카오 없이 둘러보기 (개발용)").click()
            page.wait_for_selector("#setup-nick", timeout=15000)

            # ---------- 2) 태어난 시간 ----------
            keys = page.eval_on_selector_all(
                "#setup-time [data-birthtime]",
                "els => els.map(e => e.getAttribute('data-birthtime'))",
            )
            check(len(keys) == 13, "태어난 시간 버튼 13개(모르겠음 + 12시진)", str(keys))
            check(keys[0] == "모름", "맨 위 첫 번째가 모르겠음", str(keys[:2]))
            first = page.locator("#setup-time [data-birthtime]").first
            check("모르겠음" in first.inner_text(), "첫 버튼 글씨가 ‘모르겠음’", first.inner_text())
            zi = page.locator('#setup-time [data-birthtime="자시"]')
            check("밤 11시~새벽 1시" in zi.inner_text(), "자시 버튼에 밤 11시~새벽 1시 표기", zi.inner_text())
            check("새벽 1시~3시" in page.locator('#setup-time [data-birthtime="축시"]').inner_text(), "축시 시간대 표기")
            check("밤 9시~11시" in page.locator('#setup-time [data-birthtime="해시"]').inner_text(), "해시 시간대 표기")
            h = first.bounding_box()["height"]
            check(h >= 48, "모르겠음 버튼 높이 48px 이상", f"{h}px")
            zh = zi.bounding_box()["height"]
            check(zh >= 48, "시진 버튼 높이 48px 이상", f"{zh}px")

            page.fill("#setup-nick", "순자")
            page.select_option("#setup-birth", "1952")
            page.locator('#setup-time [data-birthtime="묘시"]').click()
            check(page.locator('#setup-time [data-birthtime="묘시"]').get_attribute("aria-checked") == "true",
                  "고른 시진이 선택 표시된다")
            page.screenshot(path=f"{SHOT}/neulbom_ux_birthtime.png")
            # 모르겠음 + 처음 시진들이 한 화면에 보이는지
            page.locator('#setup-time [data-birthtime="자시"]').scroll_into_view_if_needed()
            page.wait_for_timeout(300)
            page.screenshot(path=f"{TMP}/birthtime_scrolled.png")

            page.locator("#setup-sido").select_option("충청북도")
            page.locator("#setup-sigungu").select_option("옥천군")
            page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
            page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=15000)
            page.wait_for_timeout(900)

            # ---------- 3) 상단 글씨 크기 버튼 ----------
            font_btn = page.locator("header button", has_text="글씨")
            fb = font_btn.first.bounding_box()
            check(fb["height"] >= 48, "상단 글씨 크기 버튼 높이 48px 이상", f"{fb['height']}px")
            check("글씨 크게" in font_btn.first.inner_text(), "기본 상태에서 ‘글씨 크게’로 보인다", font_btn.first.inner_text())
            font_btn.first.click()
            page.wait_for_timeout(400)
            root_font = page.evaluate("getComputedStyle(document.documentElement).fontSize")
            check(root_font == "21px", "누르면 앱 글씨가 한 단계 커진다", root_font)
            check("글씨 더 크게" in font_btn.first.inner_text(), "다음 단계 안내로 바뀐다", font_btn.first.inner_text())
            font_btn.first.click()
            font_btn.first.click()
            page.wait_for_timeout(300)
            check(page.evaluate("getComputedStyle(document.documentElement).fontSize") == "18px", "세 번 누르면 보통으로 돌아온다")

            # ---------- 4) 오늘의 운세 TTS ----------
            page.get_by_role("button", name="오늘의 운세").first.click()
            page.wait_for_selector('[data-tts="fortune"]', timeout=8000)
            page.wait_for_timeout(500)
            tts = page.locator('[data-tts="fortune"]')
            check(tts.is_visible(), "운세 카드에 소리로 듣기 버튼")
            tb = tts.bounding_box()
            check(tb["height"] >= 48, "TTS 버튼 높이 48px 이상", f"{tb['height']}px")
            page.screenshot(path=f"{SHOT}/neulbom_ux_tts_fortune.png")
            tts.click()
            page.wait_for_timeout(400)
            state = tts.get_attribute("data-tts-state")
            label = tts.inner_text()
            check(state in ("speaking", "idle"), "TTS 버튼 상태 값이 있다", str(state))
            if state == "speaking":
                check("멈추기" in label, "읽는 동안 ‘멈추기’로 바뀐다", label)
                tts.click()
                page.wait_for_timeout(300)
                check(tts.get_attribute("data-tts-state") == "idle", "다시 누르면 멈춘다")
            page.keyboard.press("Escape")
            page.wait_for_timeout(500)

            # ---------- 5) 달력 필터 ----------
            page.get_by_role("button", name="가족안부달력").first.click()
            page.wait_for_selector("[data-calendar-filters]", timeout=8000)
            page.wait_for_timeout(500)
            of = overflow(page, "[data-calendar-filters]")
            check(of["sw"] <= of["cw"] + 1, "달력 필터가 가로로 잘리지 않는다", str(of))
            labels = page.eval_on_selector_all(
                "[data-calendar-filters] button", "els => els.map(e => e.innerText.replace(/\\n/g, ' ').trim())"
            )
            check(len(labels) == 6, "달력 갈래 6개가 모두 화면에 있다", str(labels))
            check(all("전체" in x or "가족일정" in x or "행사" in x or "축제" in x or "무료 강좌" in x or "복지 소식" in x
                      for x in labels), "갈래 이름이 다 보인다", str(labels))
            hh = page.locator("[data-calendar-filters] button").first.bounding_box()["height"]
            check(hh >= 48, "필터 버튼 높이 48px 이상", f"{hh}px")
            # 다가오는 일정·소식 영역의 필터 바로 위에서 잘라 찍는다
            page.locator("[data-calendar-filters]").scroll_into_view_if_needed()
            page.wait_for_timeout(400)
            page.screenshot(path=f"{SHOT}/neulbom_ux_calendar_filters.png")
            page.locator('[data-calendar-filters] button:has-text("복지 소식")').click()
            page.wait_for_timeout(400)
            check(page.locator('[data-calendar-filters] button:has-text("복지 소식")').get_attribute("aria-selected") == "true",
                  "복지 소식 갈래가 선택된다")
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)
            page.locator("header button[aria-label='달력 닫기']").click()
            page.wait_for_timeout(500)

            # ---------- 6) 복지 필터 + 신청 방법 TTS ----------
            page.get_by_role("button", name="혜택", exact=True).click()
            page.wait_for_selector("[data-welfare-filters]", timeout=8000)
            page.wait_for_timeout(600)
            of2 = overflow(page, "[data-welfare-filters]")
            check(of2["sw"] <= of2["cw"] + 1, "복지 필터가 가로로 잘리지 않는다", str(of2))
            wl = page.eval_on_selector_all("[data-welfare-filters] button", "els => els.map(e => e.innerText.trim())")
            check(len(wl) == 8, "복지 분류 8개가 다 보인다", str(wl))
            wb = page.locator("[data-welfare-filters] button").first.bounding_box()
            check(wb["height"] >= 48, "복지 필터 버튼 높이 48px 이상", f"{wb['height']}px")
            page.screenshot(path=f"{TMP}/welfare_filters.png")
            ws = page.locator('[data-tts="welfare-hero"]')
            check(ws.count() == 1, "복지 신청 방법 옆 소리로 듣기 버튼")
            if ws.count():
                check("소리로 듣기" in ws.inner_text(), "복지 TTS 버튼 글씨", ws.inner_text())
                ws.scroll_into_view_if_needed()
                page.wait_for_timeout(300)
                ws.click()
                page.wait_for_timeout(400)
                if ws.get_attribute("data-tts-state") == "speaking":
                    check("멈추기" in ws.inner_text(), "복지 TTS 재생 중 표시")
                    ws.click()
                page.wait_for_timeout(300)

            # ---------- 7) 퀴즈 TTS ----------
            page.get_by_role("button", name="퀴즈", exact=True).click()
            page.wait_for_timeout(800)
            page.get_by_role("button", name="퀴즈 시작하기").click()
            page.wait_for_selector('[data-tts="quiz"]', timeout=8000)
            q = page.locator('[data-tts="quiz"]')
            check(q.is_visible(), "퀴즈 문제에 소리로 듣기 버튼")
            check(q.bounding_box()["height"] >= 48, "퀴즈 TTS 버튼 높이 48px 이상")
            page.screenshot(path=f"{TMP}/quiz_tts.png")
            q.click()
            page.wait_for_timeout(300)

            # ---------- 8) 공유 시트 ----------
            page.get_by_role("button", name="홈", exact=True).click()
            page.wait_for_timeout(600)
            page.get_by_role("button", name="카카오톡으로 보내기").first.click()
            page.wait_for_selector("[data-share-sheet]", timeout=10000)
            page.wait_for_timeout(1400)
            kakao = page.locator("[data-share-kakao] button").first
            kb = kakao.bounding_box()
            check(kb["height"] >= 64, "카카오톡 보내기 버튼이 가장 크다(64px+)", f"{kb['height']}px")
            check("카카오톡으로 바로 보내기" in kakao.inner_text(), "1번 버튼 이름", kakao.inner_text())
            check(page.locator("[data-share-copy]").count() == 0, "보조 버튼은 처음엔 접혀 있다")
            page.get_by_role("button", name="다른 방법으로 보내기").click()
            page.wait_for_timeout(400)
            check(page.locator("[data-share-copy]").count() == 1, "‘다른 방법으로 보내기’를 누르면 보조 버튼이 나온다")
            check(page.locator("[data-share-device]").count() == 1, "휴대폰 공유창 버튼 있음")
            page.screenshot(path=f"{TMP}/share_sheet.png")

            # ---------- 9) 오류 ----------
            real_errors = [e for e in errors if "favicon" not in e and "Failed to load resource" not in e]
            check(not real_errors, "콘솔 오류 0건", str(real_errors[:3]))

            browser.close()
    finally:
        httpd.shutdown()

    print("\n결과:", "모두 통과" if not fails else f"{len(fails)}건 실패 → {fails}")
    return 0 if not fails else 1


if __name__ == "__main__":
    raise SystemExit(main())
