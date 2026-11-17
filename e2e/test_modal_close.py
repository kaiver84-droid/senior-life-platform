"""모든 팝업/시트 닫기 버튼 전수 검증 (390×844) — 공유 시트 단순화 + 전체 닫기 버튼.

로컬:  python3 e2e/test_modal_close.py                       (out/ 를 8099 에서 서빙)
라이브: BASE=https://senior-life-platform.pages.dev python3 e2e/test_modal_close.py
"""
import os
import re
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", "http://127.0.0.1:8099").rstrip("/")
SHOT = "/workspace/downloads"
LOCAL = "127.0.0.1" in BASE or "localhost" in BASE

fails = []


def check(ok, label, extra=""):
    print(("✅ " if ok else "❌ ") + label + (f" · {extra}" if extra else ""))
    if not ok:
        fails.append(label)


def top_close_box(page):
    btn = page.locator("[data-sheet-close]").last
    if not btn.count():
        return None, None
    return btn, btn.bounding_box()


def assert_sheet_close(page, name, shot=None):
    """시트가 떠 있고, 상단 ✕ 닫기가 44×44 이상으로 보이며, 눌러서 닫히는지."""
    page.wait_for_selector("[data-sheet-close]", timeout=10000)
    page.wait_for_timeout(450)
    btn, box = top_close_box(page)
    ok = bool(btn and btn.is_visible() and box)
    check(ok, f"{name}: 상단 ✕ 닫기 보임")
    if ok:
        check(
            box["height"] >= 44 and box["width"] >= 44,
            f"{name}: 닫기 버튼 44×44 이상",
            f'{box["width"]:.0f}×{box["height"]:.0f}',
        )
        check(
            box["y"] + box["height"] <= 844 and box["x"] + box["width"] <= 390,
            f"{name}: 닫기 버튼 화면 안",
            f'x={box["x"]:.0f} y={box["y"]:.0f}',
        )
        check("닫기" in btn.inner_text(), f"{name}: ‘닫기’ 글씨", btn.inner_text().strip())
        if shot:
            page.screenshot(path=f"{SHOT}/{shot}")
    before = page.locator("[data-sheet-close]").count()
    btn.click()
    page.wait_for_timeout(500)
    after = page.locator("[data-sheet-close]").count()
    check(after == before - 1, f"{name}: 닫기 누르면 닫힘", f"{before} → {after}")


def main():
    httpd = None
    if LOCAL:
        from harness import onboard, start_server

        httpd = start_server()

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True,
        )
        page = ctx.new_page()
        errors = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        try:
            if LOCAL:
                onboard(page)
            else:
                from test_live_final import onboard_demo, stub_kakao

                stub_kakao(page)
                onboard_demo(page)

            # ---------- 1) 홈: 건강 기록 자랑하기 삭제 · 도장 5종 유지 ----------
            page.wait_for_selector("[data-health-card]", timeout=20000)
            check(page.get_by_role("button", name="건강 기록 자랑하기").count() == 0, "건강 기록 자랑하기 버튼 없음")
            check(page.get_by_text("건강 기록 자랑").count() == 0, "‘건강 기록 자랑’ 글씨 없음")
            check(page.locator("[data-health-item]").count() == 5, "건강 챌린지 도장 5종 유지")
            check(page.get_by_text("오늘의 건강 챌린지").first.is_visible(), "건강 챌린지 카드 유지")
            page.get_by_text("오늘의 건강 챌린지").first.scroll_into_view_if_needed()
            page.wait_for_timeout(400)
            page.screenshot(path=f"{SHOT}/neulbom_health_no_share.png")

            # ---------- 2) 공유 시트: 다른 방법 삭제 · 카톡 + 닫기 ----------
            page.evaluate("() => window.scrollTo(0, 0)")
            page.wait_for_timeout(400)
            page.get_by_role("button", name="카카오톡으로 보내기").first.click()
            page.wait_for_selector("[data-share-sheet]", timeout=20000)
            page.wait_for_timeout(1600)
            share = page.locator("[data-share-sheet]")
            check(page.get_by_text("다른 방법으로 보내기").count() == 0, "공유 시트: ‘다른 방법으로 보내기’ 없음")
            check(page.locator("[data-share-more]").count() == 0, "공유 시트: 접이식 보조 버튼 없음")
            check(page.locator("[data-share-copy]").count() == 0, "공유 시트: 링크 복사 버튼 없음")
            check(page.locator("[data-share-save]").count() == 0, "공유 시트: 사진 저장 버튼 없음")
            check(page.locator("[data-share-device]").count() == 0, "공유 시트: 휴대폰 공유 버튼 없음")
            tip = page.locator("[data-share-sheet]").inner_text()
            check("다른 방법" not in tip and "이미지 저장" not in tip, "공유 시트 안내 문구 정리됨")

            kakao = page.locator("[data-share-kakao] button").first
            kbox = kakao.bounding_box()
            check("카카오톡으로 바로 보내기" in kakao.inner_text(), "공유 시트: 카카오톡 바로 보내기 버튼")
            check(kbox["height"] >= 64, "공유 시트: 카카오 버튼 크게", f'{kbox["height"]:.0f}px')
            bottom = page.locator("[data-share-close] button").first
            bbox = bottom.bounding_box()
            check(bottom.is_visible(), "공유 시트: 아래 큰 닫기 버튼")
            check(bbox["height"] >= 52, "공유 시트: 아래 닫기 높이 52px 이상", f'{bbox["height"]:.0f}px')

            # 시트 안쪽을 끝까지 내려 카톡·닫기 버튼이 함께 보이는 화면을 남긴다
            page.locator("[data-share-sheet]").evaluate("el => el.scrollIntoView({block:'end'})")
            page.wait_for_timeout(400)
            page.screenshot(path=f"{SHOT}/neulbom_share_clean.png")
            page.evaluate("() => window.scrollTo(0, 0)")
            page.wait_for_timeout(300)

            # 2-a) 아래 닫기 → 시트 닫힘
            bottom.click()
            page.wait_for_timeout(500)
            check(page.locator("[data-share-sheet]").count() == 0, "공유 시트: 아래 닫기로 닫힘")
            # 2-b) 인사카드 시트가 남아 있으면 그것도 닫는다
            if page.locator("[data-sheet-close]").count():
                assert_sheet_close(page, "안부 인사카드 시트")

            # 2-c) 다시 열어 카카오톡 바로 보내기 → 시트가 닫힌다
            page.get_by_role("button", name="카카오톡으로 보내기").first.click()
            page.wait_for_selector("[data-share-sheet]", timeout=20000)
            page.wait_for_timeout(1500)
            page.locator("[data-share-kakao] button").first.click()
            page.wait_for_timeout(3200)
            check(page.locator("[data-share-sheet]").count() == 0, "카카오톡 바로 보내기 누르면 시트 닫힘")
            if page.locator("[data-sheet-close]").count():
                page.locator("[data-sheet-close]").last.click()
                page.wait_for_timeout(500)

            # 2-d) 상단 ✕ 닫기로도 닫힌다
            page.get_by_role("button", name="카카오톡으로 보내기").first.click()
            page.wait_for_selector("[data-share-sheet]", timeout=20000)
            page.wait_for_timeout(1200)
            assert_sheet_close(page, "공유 시트(상단 ✕)")
            if page.locator("[data-sheet-close]").count():
                page.locator("[data-sheet-close]").last.click()
                page.wait_for_timeout(500)

            # ---------- 3) 홈: 오늘의 운세 / 날씨 시트 ----------
            page.get_by_role("button", name="오늘의 운세").first.click()
            assert_sheet_close(page, "오늘의 운세 시트", shot="neulbom_modal_close.png")

            page.get_by_role("button", name="오늘의 날씨와 생활팁").first.click()
            assert_sheet_close(page, "오늘의 날씨 시트")

            # ---------- 4) 달력: 지역 선택 · 일정 추가 ----------
            page.get_by_role("button").filter(has_text="우리 동네 소식").first.click()
            page.wait_for_timeout(900)
            page.get_by_role("button", name="우리동네 소식 지역 바꾸기").click()
            assert_sheet_close(page, "달력 지역 선택 시트")
            page.get_by_role("button", name="일정", exact=False).first.click()
            assert_sheet_close(page, "가족 일정 추가 시트")
            page.get_by_role("button", name="달력 닫기").click()
            page.wait_for_timeout(600)

            # ---------- 5) 혜택: 지원금 상세 시트 ----------
            page.get_by_role("button", name="혜택", exact=True).click()
            page.wait_for_timeout(1000)
            page.get_by_role("button", name="신청 방법 자세히 보기").first.click()
            assert_sheet_close(page, "지원금 상세 시트", shot="neulbom_modal_close.png")

            # ---------- 6) 모임: 모임 시트 ----------
            page.get_by_role("button", name="모임", exact=True).click()
            page.wait_for_timeout(1000)
            opener = page.get_by_role("button", name="모임 만들기")
            if not opener.count():
                opener = page.get_by_role("button", name="번호로 들어가기")
            if not opener.count():
                opener = page.get_by_role("button", name="모임 바꾸기")
            opener.first.click()
            assert_sheet_close(page, "모임 시트")

            # ---------- 7) 퀴즈: 상장 시트 ----------
            page.get_by_role("button", name="퀴즈", exact=True).click()
            page.wait_for_timeout(1200)
            page.get_by_role("button", name="퀴즈 시작하기").click()
            page.wait_for_timeout(900)
            for _ in range(3):
                page.locator("[data-quiz-option]").first.click()
                page.wait_for_timeout(300)
                page.get_by_role("button", name="정답 확인").click()
                page.wait_for_timeout(400)
                page.get_by_role("button", name=re.compile("^(다음 문제|결과 보기)$")).click()
                page.wait_for_timeout(700)
            page.wait_for_selector("text=오늘의 퀴즈 결과", timeout=20000)
            page.get_by_role("button", name="금빛 상장 만들기").click()
            assert_sheet_close(page, "퀴즈 상장 시트")

            # ---------- 8) 설정 시트 ----------
            page.get_by_role("button", name="설정").click()
            assert_sheet_close(page, "내 정보 · 설정 시트")

            # ---------- 9) 콘솔 오류 ----------
            real = [e for e in errors if "favicon" not in e and "Failed to load resource" not in e]
            check(not real, "콘솔 오류 0건", str(real[:3]))

            browser.close()
        finally:
            if httpd:
                httpd.shutdown()

    print("\n결과:", "모두 통과" if not fails else f"{len(fails)}건 실패 → {fails}")
    return 0 if not fails else 1


if __name__ == "__main__":
    raise SystemExit(main())
