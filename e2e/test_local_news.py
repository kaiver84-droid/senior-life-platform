"""우리동네 소식 — 지역 전환 로컬 검증 (정적 out/ 서빙 + Playwright).

python3 e2e/test_local_news.py
"""
import sys
import re

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

from harness import onboard, start_server  # noqa: E402

SHOT = "/workspace/downloads"


def main():
    httpd = start_server()
    errors = []
    res = {}
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
        page.route("**/api/**", lambda route: route.abort())

        # 옥천군으로 시작
        onboard(page, name="순자", birth="1952", sido="충청북도", sigungu="옥천군")
        page.get_by_text("가족안부달력").first.click()
        page.wait_for_selector("text=다가오는 일정과 소식", timeout=15000)
        page.wait_for_timeout(400)
        res["default_area"] = page.get_by_label("우리동네 소식 지역 바꾸기").inner_text()

        # 지역 바꾸기 — 부산 해운대구
        page.get_by_label("우리동네 소식 지역 바꾸기").click()
        page.wait_for_selector("#news-sido", timeout=10000)
        page.select_option("#news-sido", "부산광역시")
        page.wait_for_timeout(300)
        page.select_option("#news-sigungu", "해운대구")
        page.wait_for_timeout(300)
        res["preview"] = page.get_by_text(re.compile("해운대구에서 앞으로")).first.inner_text()
        page.get_by_role("button", name=re.compile("해운대구 소식 보기")).click()
        page.wait_for_timeout(600)
        res["after_area"] = page.get_by_label("우리동네 소식 지역 바꾸기").inner_text()
        res["busan_place_seen"] = page.get_by_text(re.compile("부산 해운대구")).first.is_visible()
        body = page.locator("body").inner_text()
        res["has_busan_words"] = ("해운대" in body) or ("부산" in body)
        res["no_okcheon_place"] = ("충북 옥천군" not in body)
        page.get_by_text("다가오는 일정과 소식").first.scroll_into_view_if_needed()
        page.wait_for_timeout(3800)
        page.get_by_text("해운대구 바로가기").first.scroll_into_view_if_needed()
        page.wait_for_timeout(400)
        page.screenshot(path=f"{SHOT}/neulbom_local_news_busan.png", full_page=False)
        res["links_visible"] = page.get_by_text("해운대구 바로가기").first.is_visible()

        # 서울 강남구
        page.get_by_label("우리동네 소식 지역 바꾸기").click()
        page.wait_for_selector("#news-sido", timeout=10000)
        page.select_option("#news-sido", "서울특별시")
        page.wait_for_timeout(300)
        page.select_option("#news-sigungu", "강남구")
        page.wait_for_timeout(300)
        page.get_by_role("button", name=re.compile("강남구 소식 보기")).click()
        page.wait_for_timeout(600)
        res["seoul_area"] = page.get_by_label("우리동네 소식 지역 바꾸기").inner_text()
        page.get_by_text("다가오는 일정과 소식").first.scroll_into_view_if_needed()
        page.wait_for_timeout(3800)
        page.screenshot(path=f"{SHOT}/neulbom_local_news_seoul.png", full_page=False)
        res["seoul_links"] = page.get_by_text(re.compile("강남구 바로가기")).first.is_visible()

        # 축제 필터
        page.get_by_role("tab", name=re.compile("축제")).click()
        page.wait_for_timeout(400)
        res["filter_text"] = page.locator("section").last.inner_text()[:160]

        # 내 지역으로 돌아가기
        page.get_by_label("우리동네 소식 지역 바꾸기").click()
        page.wait_for_selector("#news-sido", timeout=10000)
        page.get_by_role("button", name=re.compile("내 지역")).click()
        page.wait_for_timeout(500)
        res["back_area"] = page.get_by_label("우리동네 소식 지역 바꾸기").inner_text()
        res["profile_unchanged"] = page.get_by_text(re.compile("충북 옥천군")).first.is_visible()

        res["console_errors"] = errors
        browser.close()
    httpd.shutdown()
    print(res)


if __name__ == "__main__":
    main()
