"""라이브 최종 확인 — ① 홈 날씨 카드가 실제 날씨인지 ② 닫기 버튼 위치 ③ 설치 안내 ④ 스크린샷.

BASE=https://senior-life-platform.pages.dev python3 e2e/test_live_home_weather.py
"""
import os
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", "https://senior-life-platform.pages.dev").rstrip("/")
SHOT = "/workspace/downloads"

fails = []


def check(ok, label, extra=""):
    print(("✅ " if ok else "❌ ") + label + (f" · {extra}" if extra else ""))
    if not ok:
        fails.append(label)


def main():
    from test_live_final import onboard_demo, stub_kakao

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True
        )
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        stub_kakao(page)
        onboard_demo(page)
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
        page.wait_for_timeout(2600)

        # ① 홈 날씨 카드
        card = page.locator("button", has_text="오늘의 날씨와 생활팁").first
        card.scroll_into_view_if_needed()
        page.wait_for_timeout(500)
        text = card.inner_text()
        print("   카드 문구:", text.replace("\n", " · "))
        check("불러오지 못" not in text, "홈 날씨 카드: 실제 날씨 표시", text.replace("\n", " · "))
        check("°" in text, "홈 날씨 카드: 기온 표시")
        page.screenshot(path=f"{SHOT}/neulbom_home_weather_live.png")

        # ② 설치 안내 배너 (앱으로 열린 상태가 아니면 한 번 보인다)
        banner = page.locator("[data-install-banner]")
        check(banner.count() == 1, "홈: ‘주소창 없이 앱처럼 쓰기’ 안내 배너")
        if banner.count():
            banner.first.click()
            page.wait_for_selector("[data-install-guide]", timeout=10000)
            page.wait_for_timeout(600)
            guide_text = page.locator("[data-install-guide]").inner_text()
            check("홈 화면에 추가" in guide_text, "설치 안내: 단계 문구")
            page.screenshot(path=f"{SHOT}/neulbom_install_guide_live.png")
            page.locator("[data-sheet-close]").last.click()
            page.wait_for_timeout(500)

        # ③ 오늘의 운세 시트 — 닫기 버튼이 상단 상태바에 가리지 않는지
        page.get_by_role("button", name="오늘의 운세").first.click()
        page.wait_for_selector("[data-sheet-close]", timeout=15000)
        page.wait_for_timeout(700)
        btn = page.locator("[data-sheet-close]").last
        box = btn.bounding_box()
        check(box["y"] >= 60, "운세 시트: 닫기 버튼이 위에서 60px 이상 아래", f'y={box["y"]:.0f}')
        check(box["height"] >= 44 and box["width"] >= 44, "운세 시트: 닫기 44×44 이상", f'{box["width"]:.0f}×{box["height"]:.0f}')
        page.screenshot(path=f"{SHOT}/neulbom_fortune_close_fixed.png")
        # 닫기 전에 하단 고정 닫기 버튼도 확인
        bottom = page.locator("[data-sheet-close]").last
        page.locator("text=닫기").last.click() if False else None
        page.locator("[data-sheet-close]").last.click()
        page.wait_for_timeout(500)
        check(page.locator("[data-sheet-close]").count() == 0, "운세 시트: 닫기 눌러 닫힘")

        # ④ 복지 상세 시트
        page.locator("nav[aria-label='주요 메뉴'] button").filter(has_text="혜택").first.click()
        page.wait_for_timeout(1200)
        page.get_by_role("button", name="신청 방법 자세히 보기").first.click()
        page.wait_for_selector("[data-sheet-close]", timeout=15000)
        page.wait_for_timeout(600)
        box = page.locator("[data-sheet-close]").last.bounding_box()
        check(box["y"] >= 60, "복지 상세 시트: 닫기 버튼이 위에서 60px 이상 아래", f'y={box["y"]:.0f}')
        page.screenshot(path=f"{SHOT}/neulbom_welfare_close_fixed.png")
        page.locator("[data-sheet-close]").last.click()
        page.wait_for_timeout(500)

        # ⑤ 공유 시트
        page.locator("nav[aria-label='주요 메뉴'] button").filter(has_text="홈").first.click()
        page.wait_for_timeout(900)
        page.evaluate("() => window.scrollTo(0, 0)")
        page.get_by_role("button", name="카카오톡으로 보내기").first.click()
        page.wait_for_selector("[data-share-sheet]", timeout=20000)
        page.wait_for_timeout(1600)
        sbox = page.locator("[data-sheet-close]").last.bounding_box()
        check(sbox["y"] >= 60, "공유 시트: 닫기 버튼이 위에서 60px 이상 아래", f'y={sbox["y"]:.0f}')
        page.screenshot(path=f"{SHOT}/neulbom_share_close_fixed.png")
        page.locator("[data-share-close] button").first.click()
        page.wait_for_timeout(600)

        check(not errors, "콘솔 오류 0건", str(errors[:3]))
        browser.close()

    print("\n" + ("모두 통과 ✅" if not fails else f"실패 {len(fails)}건 ❌"))
    for f in fails:
        print(" -", f)
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
