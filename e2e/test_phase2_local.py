"""2단계 로컬 UI 검증 — out/ 정적 빌드를 8099 에서 서빙하며 건강 챌린지·OX·넌센스·공유 시트를 확인한다.

카카오 로그인 없이 보기 위해 localStorage 에 프로필을 미리 심는다(서버 API 는 없는 로컬 환경).
실행: python3 e2e/test_phase2_local.py
"""
import json
import os
import re
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from harness import start_server, PORT  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

SHOT = os.environ.get("SHOT_DIR", "/workspace/downloads")
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")

SEED = """
if (localStorage.getItem("seniorLife.v1")) { /* 이미 저장된 기록은 그대로 둔다 */ } else {
const state = {
  version: 1,
  profile: {
    id: "u_local_test",
    nickname: "순자",
    birthYear: 1952,
    birthTime: "묘시",
    sido: "충청북도",
    sigungu: "옥천군",
    createdAt: new Date().toISOString(),
    source: "demo",
    profileCompleted: true,
  },
  quizLogs: [], daily: null, med: {}, visits: [], familyEvents: [], health: {}, fontSize: 18, lastVisit: "",
};
localStorage.setItem("seniorLife.v1", JSON.stringify(state));
}
"""

results = {}
errors = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
    results[label] = bool(cond)
    if not cond:
        errors.append(label)


def main():
    httpd = start_server()
    base = f"http://127.0.0.1:{PORT}"
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            locale="ko-KR",
            is_mobile=True,
            has_touch=True,
            permissions=["clipboard-read", "clipboard-write"],
        )
        page = ctx.new_page()
        console = []
        page.on("console", lambda m: console.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
        page.add_init_script(SEED)
        page.goto(base + "/", wait_until="domcontentloaded")
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=20000)
        page.wait_for_timeout(1200)

        # ---------- 홈: 건강 챌린지 ----------
        card = page.locator("[data-health-card]")
        check(card.count() == 1, "홈에 오늘의 건강 챌린지 카드", str(card.count()))
        check(page.get_by_text("오늘의 건강 챌린지").first.is_visible(), "건강 챌린지 제목")
        items = page.locator("[data-health-item]")
        check(items.count() == 5, "챌린지 5가지", str(items.count()))

        page.locator("[data-health-item='water']").click()
        page.wait_for_timeout(350)
        page.locator("[data-health-item='walk']").click()
        page.wait_for_timeout(500)
        done_now = page.locator("[data-health-item] [data-health-done='1']").count()
        check(done_now == 2, "물·걷기 도장 2개 체크", str(done_now))
        saved = page.evaluate("() => JSON.parse(localStorage.getItem('seniorLife.v1')).health")
        today_key = list(saved.keys())[0] if saved else ""
        check(bool(saved) and len(saved.get(today_key, [])) == 2, "localStorage 에 체크인 저장", json.dumps(saved, ensure_ascii=False))
        check(page.get_by_text("2/5").first.is_visible(), "진행 표시 2/5")

        page.evaluate("() => window.scrollTo(0, 320)")
        page.wait_for_timeout(600)
        page.screenshot(path=f"{SHOT}/_local_health.png")

        # 새로고침해도 유지
        page.reload(wait_until="domcontentloaded")
        page.wait_for_selector("[data-health-card]", timeout=20000)
        page.wait_for_timeout(800)
        done_after = page.locator("[data-health-item] [data-health-done='1']").count()
        check(done_after == 2, "새로고침 후에도 도장 유지", str(done_after))

        # ---------- 공유 시트 (홈 인사카드) ----------
        check(page.get_by_role("button", name="건강 기록 자랑하기").count() == 0, "건강 기록 자랑하기 버튼 삭제됨")
        check(page.locator("[data-health-item]").count() == 5, "건강 챌린지 도장 5종 유지")
        page.evaluate("() => window.scrollTo(0, 0)")
        page.wait_for_timeout(500)
        page.get_by_role("button", name="카카오톡으로 보내기").first.click()
        page.wait_for_selector("[data-share-sheet]", timeout=15000)
        page.wait_for_timeout(900)
        check(page.locator("[data-share-preview] canvas").count() == 1, "공유 카드 미리보기 캔버스")
        check(page.get_by_text("가족 단톡방").first.is_visible(), "카카오톡 단톡방 미리보기")
        check(page.locator("[data-share-kakao]").count() == 1, "카카오톡 보내기 버튼")
        check(page.get_by_text("다른 방법으로 보내기").count() == 0, "‘다른 방법으로 보내기’ 삭제됨")
        check(page.locator("[data-share-close] button").first.is_visible(), "공유 시트 닫기 버튼")
        hint = page.locator("[data-share-hint]").inner_text()
        check("카카오" in hint, "공유 안내 문구", hint[:60])
        page.screenshot(path=f"{SHOT}/_local_share.png")
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)

        # ---------- 퀴즈: OX·넌센스 ----------
        page.get_by_role("navigation").get_by_role("button", name="퀴즈").click()
        page.wait_for_selector("text=1분 두뇌 퀴즈", timeout=20000)
        page.wait_for_timeout(900)
        topics = page.locator("[data-quiz-topic]")
        check(topics.count() == 5, "주제 고르기 5가지", str(topics.count()))
        check(page.get_by_text("OX 건강 상식").first.is_visible(), "OX 주제 노출")
        check(page.get_by_text("넌센스·아재개그").first.is_visible(), "넌센스 주제 노출")
        page.screenshot(path=f"{SHOT}/_local_quiz_intro.png")

        page.locator("[data-quiz-topic='ox']").click()
        page.wait_for_timeout(900)
        check(page.get_by_text("이 말이 맞을까요?").first.is_visible(), "OX 문제 화면")
        opts = page.locator("[data-quiz-option]")
        check(opts.count() == 2, "OX 두 보기", str(opts.count()))
        page.screenshot(path=f"{SHOT}/_local_ox.png")
        opts.first.click()
        page.get_by_role("button", name="정답 확인").click()
        page.wait_for_timeout(600)
        check(page.get_by_text("정답이에요").first.is_visible() or page.get_by_text("아쉽지만").first.is_visible(), "OX 채점 결과")
        for _ in range(2):
            page.get_by_role("button", name="다음 문제").click()
            page.wait_for_timeout(300)
            page.locator("[data-quiz-option]").first.click()
            page.get_by_role("button", name="정답 확인").click()
            page.wait_for_timeout(300)
        page.get_by_role("button", name="연습 결과 보기").click()
        page.wait_for_timeout(700)
        check(page.get_by_text("연습 모드 결과").first.is_visible(), "연습 결과 화면")

        # 넌센스 4지선다
        page.get_by_role("button", name="오늘의 퀴즈로 돌아가기").click()
        page.wait_for_timeout(600)
        page.locator("[data-quiz-topic='nonsense']").click()
        page.wait_for_timeout(700)
        check(page.locator("[data-quiz-option]").count() == 4, "넌센스 4지선다")
        page.screenshot(path=f"{SHOT}/_local_nonsense.png")

        # ---------- 인사카드 공유 미리보기 ----------
        page.get_by_role("navigation").get_by_role("button", name="홈").click()
        page.wait_for_timeout(900)
        page.get_by_role("button", name="인사카드 만들기").click()
        page.wait_for_selector("text=오늘의 안부 인사카드", timeout=15000)
        page.wait_for_timeout(1200)
        page.get_by_role("button", name=re.compile("카톡으로 보내기")).click()
        page.wait_for_selector("[data-share-sheet]", timeout=15000)
        page.wait_for_timeout(900)
        check(page.get_by_text("단톡방에 이렇게 보여요").first.is_visible(), "인사카드 공유 시트")
        check(page.locator("[data-share-preview] canvas").count() == 1, "인사카드 액자 미리보기")
        page.screenshot(path=f"{SHOT}/_local_greeting_share.png")
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)

        # ---------- 모임 탭: 체험 모임에 들어가 건강 챌린지 함께 보기 ----------
        page.get_by_role("navigation").get_by_role("button", name="모임").click()
        page.wait_for_timeout(1200)
        page.get_by_role("button", name=re.compile("체험 모임 들어가기")).first.click()
        page.wait_for_selector("text=오늘 출석 현황", timeout=20000)
        page.wait_for_timeout(1200)
        check(page.locator("[data-health-card]").count() >= 1, "모임 탭 오늘의 건강 챌린지")
        # 모임 초대 공유 미리보기
        page.get_by_role("button", name=re.compile("초대하기")).first.click()
        page.wait_for_selector("text=카카오톡으로 모임 초대", timeout=15000)
        page.wait_for_timeout(600)
        page.get_by_role("button", name=re.compile("카카오톡으로 초대장 보내기")).click()
        page.wait_for_selector("[data-share-sheet]", timeout=15000)
        page.wait_for_timeout(800)
        check(page.get_by_text("모임 들어가기").first.is_visible(), "모임 초대 공유 카드")
        page.locator("[data-share-more]").click()
        page.wait_for_timeout(350)
        page.locator("[data-share-copy]").click()
        page.wait_for_timeout(700)
        check("복사" in page.locator("[data-share-hint]").inner_text(), "링크·글 복사 동작", page.locator("[data-share-hint]").inner_text()[:30])
        page.screenshot(path=f"{SHOT}/_local_invite_share.png")
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)

        group_text = page.inner_text("main")
        check(re.search(r"\d+/\d+명\s*함께했어요", group_text) is not None, "모임 함께 참여 표시", (re.search(r"\d+/\d+명", group_text).group(0) if re.search(r"\d+/\d+명", group_text) else ""))
        page.evaluate("() => window.scrollTo(0, 0)")
        page.wait_for_timeout(400)
        page.screenshot(path=f"{SHOT}/_local_group_health.png")

        real_errors = [e for e in console if "favicon" not in e and "Failed to load resource" not in e and "manifest" not in e]
        check(len(real_errors) == 0, "콘솔 오류 없음", "; ".join(real_errors[:4]))
        browser.close()
    httpd.shutdown()
    print(json.dumps(results, ensure_ascii=False, indent=1))
    print(f"\n총 {len(results)}개 중 실패 {len(errors)}개")
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
