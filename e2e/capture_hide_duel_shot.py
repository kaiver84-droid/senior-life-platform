#!/usr/bin/env python3
"""랭킹 탭 전체를 한 장으로 — 세로로 긴 뷰포트에서 찍어 고정 하단 메뉴가 중간에 겹치지 않게 한다."""
import os
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

import check_ranking_phase2 as base  # noqa: E402

OUT = "/workspace/downloads/neulbom_hide_duel.png"
os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.libs/usr/lib/x86_64-linux-gnu:/workspace/work/.tools/browser-libs"
)


def main():
    base.cleanup()
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=base.CHROME, args=["--no-sandbox"])
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            locale="ko-KR",
            is_mobile=True,
            has_touch=True,
            timezone_id="Asia/Seoul",
        )
        page = ctx.new_page()
        page.route("**/api/auth/kakao**", base.kakao_stub())
        base.login(page)
        base.ensure_group(page)
        base.nav(page, "랭킹")
        page.wait_for_selector("[data-grade-card]", timeout=25000)
        page.wait_for_timeout(2500)

        h = page.evaluate("() => Math.ceil(document.documentElement.scrollHeight)")
        h = min(max(h, 844), 2600)
        page.set_viewport_size({"width": 390, "height": h})
        page.wait_for_timeout(900)
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(500)
        page.screenshot(path=OUT)
        print("content height", h)
        browser.close()
    base.cleanup()
    print("saved", OUT)


if __name__ == "__main__":
    main()
