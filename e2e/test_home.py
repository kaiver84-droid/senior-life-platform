"""E2E 1/3 — 홈(운세·날씨·인사카드) 검증 + 스크린샷."""
import sys, os, json, time
sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from harness import start_server, onboard, PORT
from playwright.sync_api import sync_playwright

SHOT = "/workspace/downloads"

def main():
    httpd = start_server()
    errors = []
    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"])
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ko-KR", is_mobile=True, has_touch=True)
        ctx.grant_permissions(["geolocation"])
        page = ctx.new_page()
        page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        onboard(page)
        page.wait_for_timeout(2500)

        # 운세 카드
        results["fortune_visible"] = page.get_by_text("오늘의 운세").is_visible()
        results["score_found"] = page.locator("text=점").first.is_visible()
        results["weather_tip"] = page.get_by_text("날씨 생활 팁").is_visible()
        results["streak_badge"] = page.get_by_text("일 연속").first.is_visible()

        # 인사카드 캔버스 실제 렌더링 확인
        page.wait_for_selector("canvas", timeout=10000)
        page.wait_for_timeout(1200)
        data_len = page.evaluate("""() => {
            const c = document.querySelector('canvas');
            return c && c.width ? c.toDataURL('image/png').length : 0;
        }""")
        results["canvas_png_bytes"] = data_len
        results["canvas_size"] = page.evaluate("""() => { const c=document.querySelector('canvas'); return [c.width, c.height]; }""")

        # 테마 5종 선택 테스트
        for label in ["여름바다", "가을단풍", "겨울설경", "노을", "봄꽃"]:
            page.get_by_role("button", name=f"{label}").first.click()
            page.wait_for_timeout(150)
        results["themes_ok"] = True

        # 문구 프리셋 + 직접 입력
        page.get_by_role("button", name="행복한 하루 보내세요").click()
        page.wait_for_timeout(400)
        results["message_value"] = page.input_value("#msg")

        # 이미지 저장 (다운로드 이벤트)
        with page.expect_download(timeout=15000) as dl:
            page.get_by_role("button", name="저장").click()
        download = dl.value
        path = os.path.join(SHOT, "senior_greeting_card.png")
        download.save_as(path)
        results["saved_png"] = os.path.getsize(path)

        # 카톡으로 보내기 (데스크톱 크로미움 → 폴백 다운로드 + 클립보드)
        page.get_by_role("button", name="카톡으로 보내기").click()
        page.wait_for_timeout(1500)
        toast = page.locator("[aria-live=polite]")
        results["share_toast"] = toast.inner_text().strip()[:80]

        page.wait_for_timeout(500)
        page.evaluate("window.scrollTo(0,0)")
        page.wait_for_timeout(400)
        page.screenshot(path=os.path.join(SHOT, "senior_home_fortune.png"), full_page=False)

        # 스크롤 아래쪽(인사카드)도 한 장 남겨 두기
        page.get_by_text("오늘의 안부 인사카드").scroll_into_view_if_needed()
        page.wait_for_timeout(600)
        page.screenshot(path=os.path.join(SHOT, "senior_home_card.png"), full_page=False)

        results["url"] = page.url
        results["console_errors"] = errors
        browser.close()
    httpd.shutdown()
    print(json.dumps(results, ensure_ascii=False, indent=1))

if __name__ == "__main__":
    main()
