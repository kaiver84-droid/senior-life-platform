"""모임 지금 접속 인원 표시 — 로컬 검증 (정적 out/ 서빙 + Playwright).

python3 e2e/test_group_presence.py
"""
import re
import sys

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
        page.route("**/api/**", lambda route: route.abort())  # 로컬은 Functions 없음 → 오프라인 폴백

        onboard(page)
        # 모임 탭으로
        page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name="모임").click()
        page.wait_for_timeout(600)
        res["tab_open"] = page.get_by_text("우리 모임").first.is_visible()

        # 체험 모임 들어가기
        page.get_by_role("button", name=re.compile("체험 모임 들어가기")).click()
        page.wait_for_timeout(1200)
        body = page.locator("body").inner_text()
        m = re.search(r"지금 (\d+)명 접속 중", body)
        res["online_badge"] = m.group(0) if m else None
        res["online_count"] = int(m.group(1)) if m else 0
        res["member_online_label"] = body.count("접속 중")
        page.screenshot(path=f"{SHOT}/neulbom_group_presence.png", full_page=False)
        res["console_errors"] = errors
        browser.close()
    httpd.shutdown()
    print(res)


if __name__ == "__main__":
    main()
