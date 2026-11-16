"""E2E 3/3 — 혜택(지원금) · 도구(돋보기·카드뉴스) · 가족(복약·안부·대시보드)."""
import sys, os, json
sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from harness import start_server, onboard, PORT
from playwright.sync_api import sync_playwright

SHOT = "/workspace/downloads"

def main():
    httpd = start_server()
    errors, results = [], {}
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"])
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ko-KR",
                                  is_mobile=True, has_touch=True, permissions=["camera"])
        page = ctx.new_page()
        page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" and "/api/" not in (m.location or {}).get("url", "") else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        onboard(page)
        nav = page.get_by_role("navigation").get_by_role("button")

        # ---------- 혜택 ----------
        nav.nth(3).click()
        page.wait_for_selector("text=내게 맞는 지원금", timeout=10000)
        page.wait_for_timeout(500)
        results["matched_badge"] = page.locator("text=받을 수 있어요").first.inner_text()
        results["program_count"] = page.locator("h3").count()
        first_title = page.locator("h3").first.inner_text()
        page.locator("h3").first.click()
        page.wait_for_timeout(500)
        results["expanded_first"] = first_title
        results["steps_visible"] = page.locator("text=이렇게 하세요 (3단계)").count()
        results["step_items"] = page.locator("ol li").count()
        results["has_tel_link"] = page.locator("a[href^='tel:']").count()
        # 필터
        page.get_by_role("button", name="의료").first.click()
        page.wait_for_timeout(400)
        results["medical_count"] = page.locator("h3").count()
        page.get_by_role("button", name="전체").first.click()
        page.wait_for_timeout(300)
        # 조건 변경 시트
        page.get_by_role("button", name="지역·나이 바꾸기").click()
        page.wait_for_selector("#e-birth", timeout=5000)
        page.select_option("#e-sido", "서울특별시")
        page.wait_for_timeout(300)
        page.select_option("#e-sigungu", "종로구")
        page.get_by_role("button", name="저장하기").click()
        page.wait_for_timeout(700)
        results["after_region_change"] = page.locator("text=서울 종로구").first.is_visible()
        page.get_by_role("button", name="지역·나이 바꾸기").click()
        page.wait_for_selector("#e-birth", timeout=5000)
        page.select_option("#e-sido", "충청북도")
        page.wait_for_timeout(300)
        page.select_option("#e-sigungu", "옥천군")
        page.get_by_role("button", name="저장하기").click()
        page.wait_for_timeout(700)
        page.screenshot(path=os.path.join(SHOT, "senior_welfare.png"))

        # ---------- 도구 ----------
        nav.nth(4).click()
        page.wait_for_selector("text=생활 도구", timeout=10000)
        page.wait_for_timeout(400)
        results["tools_visible"] = page.get_by_text("간편 돋보기").is_visible()
        page.get_by_role("button", name="돋보기 켜기").click()
        page.wait_for_timeout(1800)
        results["camera_error"] = page.locator("text=카메라를 켤 수 없어요").count()
        results["video_present"] = page.locator("video").count()
        slider = page.locator("input[type=range]")
        if slider.count():
            slider.fill("3")
            page.wait_for_timeout(300)
            results["zoom_label"] = page.locator("text=확대").first.inner_text()
        page.screenshot(path=os.path.join(SHOT, "senior_tools.png"))
        page.get_by_role("button", name="돋보기 닫기").click()
        page.wait_for_timeout(500)
        # 카드뉴스
        page.get_by_text("보이스피싱 구별법").click()
        page.wait_for_timeout(700)
        results["guide_slide"] = page.locator("h4").first.inner_text()
        page.get_by_role("button", name="다음").click()
        page.wait_for_timeout(400)
        results["guide_slide2"] = page.locator("h4").first.inner_text()
        results["guide_progress"] = page.locator("text=2 / 6").count()
        page.screenshot(path=os.path.join(SHOT, "senior_cardnews.png"))
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
        # 글씨 크기
        page.get_by_role("button", name="아주 크게").click()
        page.wait_for_timeout(400)
        results["font_size"] = page.evaluate("getComputedStyle(document.documentElement).fontSize")
        page.get_by_role("button", name="보통").click()
        page.wait_for_timeout(300)

        # ---------- 가족 ----------
        nav.nth(5).click()
        page.wait_for_selector("text=가족 연결", timeout=10000)
        page.wait_for_timeout(400)
        page.get_by_role("button", name="아침 약").click()
        page.wait_for_timeout(300)
        page.get_by_role("button", name="저녁 약").click()
        page.wait_for_timeout(500)
        results["med_state"] = page.locator("text=먹었어요").count()
        results["med_badge"] = page.locator("text=완료 ✓").count()
        code = page.locator(".tabular").first.inner_text()
        results["family_code"] = code
        page.wait_for_timeout(400)
        page.screenshot(path=os.path.join(SHOT, "senior_family.png"))

        # 안부 카드 공유 (폴백 다운로드)
        try:
            with page.expect_download(timeout=12000) as dl:
                page.get_by_role("button", name="안부 카드 보내기").click()
            d = dl.value
            p2 = os.path.join(SHOT, "senior_anbu_card.png")
            d.save_as(p2)
            results["anbu_saved"] = os.path.getsize(p2)
        except Exception as e:
            results["anbu_error"] = str(e)[:120]
        page.wait_for_timeout(800)
        results["share_toast"] = page.locator("[aria-live=polite]").inner_text()[:80]

        # 자녀 대시보드
        page.goto(f"http://127.0.0.1:{PORT}/family/?code={code}", wait_until="domcontentloaded")
        page.wait_for_timeout(1800)
        results["dash_title"] = page.locator("h1").first.inner_text()
        results["dash_visit"] = page.locator("text=오늘 앱에 접속했어요").count()
        results["dash_med"] = page.locator("text=✓ 먹었어요").count()
        results["dash_quiz"] = page.locator("text=퀴즈").count()
        page.screenshot(path=os.path.join(SHOT, "senior_family_dashboard.png"))

        results["console_errors"] = errors
        browser.close()
    httpd.shutdown()
    print(json.dumps(results, ensure_ascii=False, indent=1))

if __name__ == "__main__":
    main()
