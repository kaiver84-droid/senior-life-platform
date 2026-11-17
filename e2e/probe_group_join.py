"""모임 입장 흐름만 집중 점검 — 첫 사용자가 '체험 모임 들어가기'를 눌렀을 때 무슨 일이 일어나는지."""
import json
import os
import re
import sys
import time

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", "https://senior-life-platform.pages.dev").rstrip("/")
KAKAO_ID = os.environ.get("AUDIT_KAKAO_ID", "999000444")
SHOT = "/workspace/downloads/neulbom_audit"

net = []
errors = []


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=3,
            locale="ko-KR",
            is_mobile=True,
            has_touch=True,
            timezone_id="Asia/Seoul",
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        )
        page = ctx.new_page()
        page.on("console", lambda m: errors.append(f"{m.type}: {m.text[:200]}") if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror {e}"))
        page.on(
            "response",
            lambda r: net.append((int(time.time() * 1000) % 100000, r.status, r.request.method, r.url.replace(BASE, "")[:90]))
            if "/api/" in r.url
            else None,
        )

        def kakao(route, request):
            if "start=1" in request.url:
                route.fulfill(status=302, headers={"location": "/?code=PROBE"})
            elif request.method == "POST":
                route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps({"ok": True, "profile": {"id": f"kakao_{KAKAO_ID}", "nickname": "모임점검", "birthYear": 1952, "source": "kakao"}}),
                )
            else:
                route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps({"ok": True, "kakaoLoginConfigured": True, "kakaoJsConfigured": False, "redirectUri": BASE}),
                )

        page.route("**/api/auth/kakao**", kakao)
        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
        page.get_by_role("button", name="카카오톡으로 시작하기").click()
        page.wait_for_selector("#setup-nick, nav[aria-label='주요 메뉴']", timeout=40000)
        if page.query_selector("#setup-nick"):
            page.fill("#setup-nick", "모임점검")
            page.select_option("#setup-birth", "1952")
            page.select_option("#setup-sido", "충청북도")
            page.wait_for_timeout(400)
            page.select_option("#setup-sigungu", "옥천군")
            page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=40000)
        page.wait_for_timeout(1500)

        page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name="모임").click()
        page.wait_for_timeout(1200)
        net.clear()
        print("before click:", page.locator("main").inner_text()[:80].replace("\n", " "))

        btn = page.get_by_role("button", name=re.compile("체험 모임 들어가기"))
        print("buttons matched:", btn.count())
        btn.first.click()
        for wait in (1200, 3000, 6000, 10000):
            page.wait_for_timeout(wait if wait == 1200 else wait - 0)
            body = page.locator("main").inner_text()
            toast = page.locator("[aria-live='polite']").inner_text().strip()
            print(f"t+{wait}ms: loaded={'우리 가족 사랑방' in body and '오늘 출석 현황' in body} toast={toast!r} head={body[:60]!r}")
            page.screenshot(path=f"{SHOT}/probe-group-{wait}.png")
            if "오늘 출석 현황" in body:
                break
        print("\nAPI calls:")
        for n in net[-14:]:
            print("  ", n)
        print("errors:", errors)
        browser.close()


if __name__ == "__main__":
    main()
