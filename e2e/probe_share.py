"""공유 버튼(카카오톡으로 바로 보내기) 실제 클릭 점검 — 콘솔/페이지 오류와 안내 문구 확인."""
import json
import os
import re
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", "https://senior-life-platform.pages.dev").rstrip("/")
KAKAO_ID = os.environ.get("AUDIT_KAKAO_ID", "999000777")
errors = []
fails = []


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=3,
            locale="ko-KR",
            is_mobile=True,
            has_touch=True,
            permissions=["clipboard-read", "clipboard-write"],
        )
        page = ctx.new_page()
        page.on("console", lambda m: errors.append(f"{m.type}: {m.text[:200]}") if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on("response", lambda r: fails.append(f"{r.status} {r.url[:100]}") if r.status >= 400 else None)

        def kakao(route, request):
            if "start=1" in request.url:
                route.fulfill(status=302, headers={"location": "/?code=SHAREPROBE"})
            elif request.method == "POST":
                route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True, "profile": {"id": f"kakao_{KAKAO_ID}", "nickname": "공유점검", "birthYear": 1952, "source": "kakao"}}))
            else:
                route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True, "kakaoLoginConfigured": True, "kakaoJsConfigured": False, "redirectUri": BASE}))

        page.route("**/api/auth/kakao**", kakao)
        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
        page.get_by_role("button", name="카카오톡으로 시작하기").click()
        page.wait_for_selector("#setup-nick, nav[aria-label='주요 메뉴']", timeout=40000)
        if page.query_selector("#setup-nick"):
            page.fill("#setup-nick", "공유점검")
            page.select_option("#setup-birth", "1952")
            page.select_option("#setup-sido", "충청북도")
            page.wait_for_timeout(400)
            page.select_option("#setup-sigungu", "옥천군")
            page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=40000)
        page.wait_for_timeout(1500)

        # 홈 인사카드 → 공유 미리보기 → 카카오톡으로 바로 보내기
        page.get_by_role("button", name=re.compile("인사카드 만들기")).first.click()
        page.wait_for_selector("[data-sheet-close]", timeout=10000)
        page.wait_for_timeout(2500)
        page.get_by_role("button", name=re.compile("카톡으로 보내기")).first.click()
        page.wait_for_timeout(2000)
        print("share sheet:", page.locator("[data-share-sheet]").count(), "| hint:", page.locator("[data-share-hint]").first.inner_text()[:120])
        before = len(errors)
        page.get_by_role("button", name=re.compile("카카오톡으로 바로 보내기")).first.click()
        page.wait_for_timeout(4000)
        toast = page.locator("[aria-live='polite']").inner_text().strip()
        print("after click → toast:", repr(toast))
        print("sheet closed:", page.locator("[data-share-sheet]").count() == 0)
        page.screenshot(path="/workspace/downloads/neulbom_audit/probe-share.png")
        print("new errors:", errors[before:])
        print("all errors:", errors)
        print("http fails:", fails)
        browser.close()


if __name__ == "__main__":
    main()
