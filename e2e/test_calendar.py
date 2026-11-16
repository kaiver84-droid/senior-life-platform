"""가족안부달력 · 우리동네 소식 로컬 검증 (정적 out/ 서빙 + Playwright).

python3 e2e/test_calendar.py
"""
import json
import re
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

from harness import onboard, start_server  # noqa: E402

SHOT = "/workspace/downloads"


def main():
    httpd = start_server()
    res = {}
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            locale="ko-KR",
            is_mobile=True,
            has_touch=True,
        )
        page = ctx.new_page()
        page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        page.route("**/api/**", lambda route: route.abort())  # 로컬은 Functions 없음
        onboard(page)

        # 홈 배너
        res["home_banner"] = page.get_by_text("가족안부달력").first.is_visible()
        page.get_by_text("가족안부달력").first.click()
        page.wait_for_selector("text=다가오는 일정과 소식", timeout=15000)
        page.wait_for_timeout(500)
        res["calendar_open"] = True
        res["calendar_title"] = page.get_by_text("가족안부달력").first.is_visible()
        res["weekday_header"] = page.get_by_text("일", exact=True).first.is_visible()

        # 오늘 날짜에 일정 추가
        page.get_by_role("button", name=re.compile("에 일정 추가")).click()
        page.wait_for_selector("text=가족 일정 추가", timeout=10000)
        page.wait_for_timeout(300)
        page.get_by_placeholder("예: 큰딸 생일, 손주 돌잔치").fill("큰딸 생일")
        # 생일 종류는 기본 선택(🎂) — 매년 반복도 기본 켜짐
        page.get_by_role("button", name="일정 저장하기").click()
        page.wait_for_timeout(700)
        res["event_saved"] = page.get_by_text("큰딸 생일").first.is_visible()
        res["event_dday_today"] = page.get_by_text("오늘!").first.is_visible()

        # 다음 달로 이동 → 매년 반복 일정이 같은 날에 다시 보이는지
        page.get_by_role("button", name="다음 달").click()
        page.wait_for_timeout(500)
        month_label = page.locator("text=/\\d{4}년 \\d{1,2}월/").first.inner_text()
        res["next_month"] = month_label
        # 오늘과 같은 '일' 칸을 눌러 확인
        today_day = page.locator("button[aria-label^='2026-11']").first.get_attribute("aria-label")
        res["today_cell"] = today_day

        # 이번 달로 돌아와 목록에서 일정 확인
        page.get_by_label("이번 달로").click()
        page.wait_for_timeout(400)

        # 필터 6종
        tabs = page.get_by_role("tab")
        res["filter_tabs"] = tabs.count()
        res["filter_labels"] = [tabs.nth(i).inner_text() for i in range(tabs.count())]

        for label in ["축제", "무료강좌", "복지소식", "행사"]:
            page.get_by_role("tab", name=re.compile(label)).click()
            page.wait_for_timeout(250)
            count = page.locator("section").last.inner_text()
            res[f"filter_{label}"] = len(count) > 10

        page.get_by_role("tab", name="행사").click()
        page.wait_for_timeout(300)
        # 첫 소식 카드를 눌러 그 날짜의 상세가 나오는지
        page.screenshot(path=f"{SHOT}/neulbom_family_calendar.png", full_page=False)

        # 날짜 칸 클릭 → 상세 카드 (오늘 칸: 만든 일정 + 소식)
        page.get_by_role("button", name=re.compile("^2026-11-16")).first.click()
        page.wait_for_timeout(400)
        res["day_detail_event"] = page.get_by_text("큰딸 생일").first.is_visible()

        # 삭제 흐름
        page.get_by_role("button", name="삭제").first.click()
        page.wait_for_timeout(300)
        res["delete_confirm"] = page.get_by_text("이 일정을 지울까요?").is_visible()
        page.get_by_role("button", name="지우기").click()
        page.wait_for_timeout(500)
        res["deleted"] = page.get_by_text("큰딸 생일").count() == 0

        # 카톡 공유 버튼 (소식 카드)
        page.get_by_role("button", name=re.compile("카톡으로 알리기")).first.click()
        page.wait_for_timeout(600)
        res["share_toast"] = page.locator("text=/공유|이미지를 저장|링크를 복사/").count() > 0

        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        # 닫기
        page.get_by_label("달력 닫기").click()
        page.wait_for_timeout(300)
        res["calendar_closed"] = page.get_by_text("다가오는 일정과 소식").count() == 0

        # 가족 탭 카드
        nav = page.get_by_role("navigation").get_by_role("button")
        nav.nth(5).click()
        page.wait_for_timeout(600)
        res["family_card"] = page.get_by_text("가족안부달력").first.is_visible()
        res["family_news_count"] = page.get_by_text(re.compile("우리 동네 소식 \\d+건")).first.is_visible()

        browser.close()
    httpd.shutdown()
    res["console_errors"] = errors
    print(json.dumps(res, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
