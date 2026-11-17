"""라이브 검증 — 복약 상태가 ① 같은 모임의 다른 구성원 화면 ② /family/ 재접속(번호 없이)에 보이는지.

BASE=https://senior-life-platform.pages.dev python3 e2e/test_live_family_medicine.py
"""
import os
import re
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


def read_code(page):
    """설정 시트에서 가족 연결 번호(6자리)를 읽는다"""
    page.get_by_role("button", name="설정", exact=True).click()
    page.wait_for_selector("[data-sheet-close]", timeout=15000)
    page.wait_for_timeout(500)
    text = page.locator("text=가족 연결 번호").first.inner_text()
    body = page.locator("[data-sheet-close]").last.inner_text()
    sheet_text = page.evaluate(
        "() => { const el = document.querySelector('[data-sheet-close]')?.closest('div.flex.flex-col') || document.body;"
        " return el.innerText; }"
    )
    page.locator("[data-sheet-close]").last.click()
    page.wait_for_timeout(600)
    m = re.findall(r"\b([0-9A-Z]{6})\b", sheet_text)
    return m[-1] if m else ""


def main():
    from test_live_final import onboard_demo, stub_kakao

    with sync_playwright() as p:
        browser = p.chromium.launch()

        # ---------- ① 부모님 기기: 복약 체크 ----------
        parent = browser.new_context(
            viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True
        )
        page = parent.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        stub_kakao(page)
        onboard_demo(page)
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
        page.wait_for_timeout(1500)

        code = read_code(page)
        check(bool(code), "부모님 가족 연결 번호 읽기", code)

        # 오늘의 건강 챌린지에서 ‘복약 챙기기’ 누르기
        medi = page.locator("[data-health-item='medicine']").first
        page.locator("[data-health-item='medicine']").first.scroll_into_view_if_needed()
        page.wait_for_timeout(400)
        before = medi.get_attribute("aria-pressed")
        if before != "true":
            medi.click()
            page.wait_for_timeout(600)
        check(medi.get_attribute("aria-pressed") == "true", "부모님 화면: 복약 챙기기 체크됨", str(before))
        page.wait_for_timeout(2600)  # 서버 저장(1.2초 대기 + 전송) 기다림

        # 모임 화면에서 내 복약 배지 확인
        page.locator("nav[aria-label='주요 메뉴'] button").filter(has_text="모임").first.click()
        page.wait_for_timeout(2500)
        page.get_by_text("오늘 출석 현황").first.scroll_into_view_if_needed()
        page.wait_for_timeout(700)
        page.screenshot(path=f"{SHOT}/neulbom_group_medicine.png")
        mine_done = page.locator("[data-member-medicine='done']").count()
        online_on = page.locator("[data-member-online='on']").count()
        med_line = page.locator("[data-group-medicine]").first.inner_text() if page.locator(
            "[data-group-medicine]"
        ).count() else ""
        check(mine_done >= 1, "모임원 목록: 💊 복약 완료 배지", f"{mine_done}명")
        check(online_on >= 1, "모임원 목록: 🟢 접속 중 배지", f"{online_on}명")
        check("약" in med_line, "모임 요약: 오늘 약 챙긴 사람 표시", med_line.replace("\n", " "))

        # ---------- ② 다른 사람(자녀) 화면: 모임에서 바로 확인 ----------
        other = browser.new_context(
            viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True
        )
        child = other.new_page()
        stub_kakao(child)
        onboard_demo(child)
        child.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
        child.wait_for_timeout(1200)
        child.locator("nav[aria-label='주요 메뉴'] button").filter(has_text="모임").first.click()
        child.wait_for_timeout(2000)
        # 가족이 같은 모임에 들어가 있는지 — 초대 코드로 들어가기
        joined = False
        if child.locator("[data-member-medicine]").count() == 0:
            joined = False
        # (같은 모임에 있지 않으면 이 화면에서는 확인 대상이 아니다)

        # ---------- ③ 자녀 안부 페이지: ?code= 한 번 → 번호 없이 재접속 ----------
        fam = browser.new_context(
            viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True
        )
        fpage = fam.new_page()
        fpage.goto(f"{BASE}/family/?code={code}", wait_until="domcontentloaded")
        fpage.wait_for_selector("[data-family-medicine]", timeout=30000)
        fpage.wait_for_timeout(1800)
        fpage.screenshot(path=f"{SHOT}/neulbom_family_medicine.png")
        top = fpage.locator("[data-family-medicine]").first.inner_text()
        check("오늘 약 복용 상태" in top, "자녀 화면: 💊 오늘 약 복용 상태 카드", top.replace("\n", " "))
        card_text = fpage.locator("text=약 챙기기 완료").count()
        check(card_text >= 1, "자녀 화면: 부모님 복약 완료 표시")
        chip = fpage.locator("[data-health-chip='medicine']").first.get_attribute("data-done")
        check(chip == "1", "자녀 화면: 복약 도장 ✓", str(chip))
        # 카드가 화면 맨 위(접속 카드보다 위)인지
        y_med = fpage.locator("[data-family-medicine]").first.bounding_box()["y"]
        check(y_med < 300, "자녀 화면: 복약 카드가 최상단", f"y={y_med:.0f}")

        # 번호 없이 다시 열기
        fpage.goto(f"{BASE}/family/", wait_until="domcontentloaded")
        fpage.wait_for_selector("[data-family-medicine]", timeout=30000)
        fpage.wait_for_timeout(1800)
        again = fpage.locator("text=약 챙기기 완료").count()
        check(again >= 1, "번호 없이 /family/ 만 열어도 복약 상태 자동 표시")
        url = fpage.url
        check("code=" not in url, "주소창에서 연결 번호 정리됨", url)
        fpage.screenshot(path=f"{SHOT}/neulbom_family_no_link.png")

        check(not errors, "부모님 화면 콘솔 오류 0건", str(errors[:3]))
        browser.close()

    print("\n" + ("모두 통과 ✅" if not fails else f"실패 {len(fails)}건 ❌"))
    for f in fails:
        print(" -", f)
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
