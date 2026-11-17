"""2단계 라이브 E2E — https://senior-life-platform.pages.dev

검증 범위
1) 홈: 오늘의 건강 챌린지 카드 → 원터치 도장 2개 → 새로고침 뒤에도 유지
2) 다른 기기(새 브라우저)로 같은 카카오 계정 로그인 → Supabase 에 저장된 도장 복원
3) 퀴즈: 주제 골라 풀기(OX 2지선다 · 넌센스 4지선다) + 기존 하루 3문제 흐름
4) 카카오톡 공유 미리보기 시트(건강 기록 · 퀴즈 상장) + 복사 폴백
5) 모임 탭: 체험 모임(FAM101) 가입 → 모임 건강 챌린지 함께 달성률
6) 기존 기능 회귀: 하단 탭 6개 · 홈 인사카드/운세/날씨/달력 · 더보기 도구/가족 · 랭킹 4탭

카카오 인가만 Playwright 라우팅으로 흉내 내고, 페이지·API·Supabase 는 라이브 그대로 쓴다.
스크린샷: downloads/neulbom_health_challenge.png, neulbom_ox_nonsense_quiz.png, neulbom_kakao_share_modal.png

실행: python3 e2e/test_live_phase2.py
"""
import json
import os
import re
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from test_kakao_onboarding import sql, js_make_code  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", "https://senior-life-platform.pages.dev").rstrip("/")
SHOT = "/workspace/downloads"
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")

ID_A, NAME_A = "777004001", "건강순자"
CODE_A = js_make_code(f"kakao_{ID_A}")

results = {}
errors = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
    results[label] = bool(cond)
    if not cond:
        errors.append(label)


def cleanup():
    for q in [
        f"delete from public.health_checks where user_code = '{CODE_A}';",
        f"delete from public.group_cheers where user_code = '{CODE_A}';",
        f"delete from public.group_posts where user_code = '{CODE_A}';",
        f"delete from public.group_members where user_code = '{CODE_A}';",
        f"delete from public.groups where creator_code = '{CODE_A}';",
        f"delete from public.quiz_logs where user_code = '{CODE_A}';",
        f"delete from public.daily_visits where user_code = '{CODE_A}';",
        f"delete from public.med_checks where user_code = '{CODE_A}';",
        f"delete from public.family_events where user_code = '{CODE_A}';",
        f"delete from public.users where code = '{CODE_A}';",
    ]:
        sql(q)


def kakao_stub(kakao_id, nickname):
    def handler(route, request):
        if "start=1" in request.url:
            route.fulfill(status=302, headers={"location": "/?code=STUB-AUTH-CODE"})
        elif request.method == "POST":
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(
                    {
                        "ok": True,
                        "profile": {
                            "id": f"kakao_{kakao_id}",
                            "nickname": nickname,
                            "birthYear": 1952,
                            "source": "kakao",
                            "createdAt": "2026-11-16T00:00:00.000Z",
                        },
                    }
                ),
            )
        else:
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(
                    {
                        "ok": True,
                        "supabase": "connected",
                        "kakao": "configured",
                        "kakaoLoginConfigured": True,
                        "kakaoJsConfigured": False,
                        "redirectUri": f"{BASE}/",
                    }
                ),
            )

    return handler


def new_context(browser):
    ctx = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=2,
        locale="ko-KR",
        is_mobile=True,
        has_touch=True,
        permissions=["clipboard-read", "clipboard-write"],
    )
    page = ctx.new_page()
    page.on("console", lambda m: console.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
    # 카카오 SDK 는 CDN 에서 받아오지 않게 막고, 서버 경유 인가(스텁)로 로그인한다.
    page.route("**/t1.kakaocdn.net/**", lambda route, _req: route.abort())
    page.route("**/api/auth/kakao**", kakao_stub(ID_A, NAME_A))
    return ctx, page


def login(page):
    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
    page.get_by_role("button", name="카카오톡으로 시작하기").click()
    page.wait_for_selector("#setup-nick", timeout=30000)
    page.fill("#setup-nick", NAME_A)
    page.select_option("#setup-birth", "1952")
    page.click('[data-birthtime="묘시"]')
    page.select_option("#setup-sido", "충청북도")
    page.select_option("#setup-sigungu", "옥천군")
    page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
    page.wait_for_timeout(3200)


def relogin_setup_done(page):
    """이미 설정을 마친 사람 — 홈으로 바로 들어온다."""
    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
    page.get_by_role("button", name="카카오톡으로 시작하기").click()
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=40000)
    page.wait_for_timeout(3500)


def nav_button(page, label):
    return page.get_by_role("navigation").get_by_role("button", name=label)


console = []


def main():
    cleanup()

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        ctx, page = new_context(browser)
        login(page)

        # ---------- 회귀: 하단 탭 ----------
        tabs = page.get_by_role("navigation").get_by_role("button")
        names = [tabs.nth(i).inner_text().strip().split("\n")[-1] for i in range(tabs.count())]
        check(names == ["홈", "모임", "퀴즈", "랭킹", "혜택", "더보기"], "하단 탭 6개 유지", str(names))
        home = page.inner_text("main")
        check("안녕하세요" in home and "오늘의 운세" in home and "오늘의 날씨와 생활팁" in home, "홈 인사·운세·날씨 유지")
        check("가족안부달력" in home, "홈 가족안부달력 배너 유지")
        check(page.get_by_role("button", name="인사카드 만들기").is_visible(), "인사카드 버튼 유지")

        # ---------- 1) 건강 챌린지 ----------
        card = page.locator("[data-health-card]")
        check(card.count() == 1, "홈 오늘의 건강 챌린지 카드")
        check(page.locator("[data-health-item]").count() == 5, "챌린지 5가지")
        page.locator("[data-health-item='water']").click()
        page.wait_for_timeout(400)
        page.locator("[data-health-item='stretch']").click()
        page.wait_for_timeout(1500)
        check(page.locator("[data-health-item] [data-health-done='1']").count() == 2, "도장 2개 체크")
        page.wait_for_timeout(2200)  # 서버 저장(1.2초 디바운스) 기다림

        # 서버에 실제로 저장됐는지 확인
        rows = sql(f"select challenges from public.health_checks where user_code = '{CODE_A}'")
        ids = rows[0].get("challenges") if rows else None
        check(
            isinstance(ids, list) and len(ids) == 2 and set(ids) == {"water", "stretch"},
            "Supabase health_checks 저장",
            json.dumps(ids, ensure_ascii=False),
        )

        page.reload(wait_until="domcontentloaded")
        page.wait_for_selector("[data-health-card]", timeout=30000)
        page.wait_for_timeout(2500)
        check(page.locator("[data-health-item] [data-health-done='1']").count() == 2, "새로고침 뒤 도장 유지")

        # ---------- 2) 다른 기기(새 브라우저)로 같은 계정 로그인 → 서버에서 복원 ----------
        ctx2, page2 = new_context(browser)
        relogin_setup_done(page2)
        restored = page2.locator("[data-health-item] [data-health-done='1']").count()
        check(restored == 2, "다른 기기 로그인에서도 도장 복원", str(restored))
        ctx2.close()

        # ---------- 3) 공유 미리보기(건강) → 스크린샷 ----------
        page.evaluate("() => window.scrollTo(0, 0)")
        page.wait_for_timeout(500)
        page.locator("[data-health-card]").scroll_into_view_if_needed()
        page.wait_for_timeout(800)
        card.screenshot(path=f"{SHOT}/neulbom_health_challenge.png")
        check(os.path.exists(f"{SHOT}/neulbom_health_challenge.png"), "건강 챌린지 스크린샷 저장")

        check(page.get_by_role("button", name="건강 기록 자랑하기").count() == 0, "건강 기록 자랑하기 버튼 삭제됨")
        check(page.locator("[data-health-item]").count() == 5, "건강 챌린지 도장 5종 유지")
        nav_button(page, "홈").click()
        page.wait_for_timeout(800)
        page.get_by_role("button", name="카카오톡으로 보내기").first.click()
        page.wait_for_selector("[data-share-sheet]", timeout=20000)
        page.wait_for_timeout(1300)
        check(page.locator("[data-share-preview] canvas").count() == 1, "공유 카드 미리보기 캔버스")
        check(page.get_by_text("가족 단톡방").first.is_visible(), "카톡 단톡방 미리보기")
        page.screenshot(path=f"{SHOT}/neulbom_kakao_share_modal.png")

        check(page.get_by_text("다른 방법으로 보내기").count() == 0, "‘다른 방법으로 보내기’ 삭제됨")
        check(page.locator("[data-share-close] button").first.is_visible(), "공유 시트 닫기 버튼")

        # 카카오 SDK 가 막힌 환경(카톡 인앱·도메인 미등록과 같은 상황) — 보내기를 누르면 시트가 닫히고 안내 토스트가 뜬다
        page.locator("[data-share-kakao]").get_by_role("button").click()
        page.wait_for_timeout(3000)
        check(page.locator("[data-share-sheet]").count() == 0, "보내기 누르면 공유 시트가 닫힌다")
        page.wait_for_timeout(400)

        # ---------- 4) 퀴즈: OX · 넌센스 ----------
        nav_button(page, "퀴즈").click()
        page.wait_for_selector("text=1분 두뇌 퀴즈", timeout=20000)
        page.wait_for_timeout(1200)
        quiz = page.inner_text("main")
        check(page.locator("[data-quiz-topic]").count() == 5, "퀴즈 주제 5가지")
        check("OX 건강 상식" in quiz and "넌센스·아재개그" in quiz, "OX·넌센스 주제 노출")

        page.locator("[data-quiz-topic='ox']").click()
        page.wait_for_timeout(900)
        check(page.get_by_text("이 말이 맞을까요?").first.is_visible(), "OX 문제 출제")
        check(page.locator("[data-quiz-option]").count() == 2, "OX 2지선다")
        page.evaluate("() => window.scrollTo(0, 120)")
        page.wait_for_timeout(500)
        page.screenshot(path=f"{SHOT}/neulbom_ox_nonsense_quiz.png")
        check(os.path.exists(f"{SHOT}/neulbom_ox_nonsense_quiz.png"), "OX 퀴즈 스크린샷 저장")

        page.locator("[data-quiz-option]").first.click()
        page.get_by_role("button", name="정답 확인").click()
        page.wait_for_timeout(700)
        check(
            page.get_by_text("정답이에요").first.is_visible() or page.get_by_text("아쉽지만").first.is_visible(),
            "OX 채점·해설 표시",
        )
        page.get_by_role("button", name="다음 문제").click()
        page.wait_for_timeout(400)
        page.locator("[data-quiz-option]").first.click()
        page.get_by_role("button", name="정답 확인").click()
        page.wait_for_timeout(300)
        page.get_by_role("button", name="다음 문제").click()
        page.wait_for_timeout(400)
        page.locator("[data-quiz-option]").first.click()
        page.get_by_role("button", name="정답 확인").click()
        page.wait_for_timeout(300)
        page.get_by_role("button", name="연습 결과 보기").click()
        page.wait_for_timeout(800)
        check(page.get_by_text("연습 모드 결과").first.is_visible(), "연습 모드 결과(점수 무관)")

        page.get_by_role("button", name="오늘의 퀴즈로 돌아가기").click()
        page.wait_for_timeout(700)
        page.locator("[data-quiz-topic='nonsense']").click()
        page.wait_for_timeout(800)
        check(page.locator("[data-quiz-option]").count() == 4, "넌센스 4지선다")
        check(page.get_by_text("힌트:").first.is_visible(), "넌센스 힌트 표시")

        # 기존 하루 3문제 흐름 (점수 반영) — 새로고침으로 퀴즈 첫 화면으로 돌아간다
        page.reload(wait_until="domcontentloaded")
        page.wait_for_selector("text=퀴즈 시작하기", timeout=30000)
        page.wait_for_timeout(900)
        page.get_by_role("button", name="퀴즈 시작하기").click()
        page.wait_for_timeout(800)
        daily_types = []
        for i in range(3):
            badge = page.locator("main").inner_text()
            for label in ["초성 퀴즈", "옛날 노래 가사", "틀린 그림 찾기", "OX 건강 상식", "넌센스·아재개그"]:
                if label in badge:
                    daily_types.append(label)
                    break
            page.locator("[data-quiz-option]").first.click()
            page.wait_for_timeout(250)
            page.get_by_role("button", name="정답 확인").click()
            page.wait_for_timeout(300)
            page.get_by_role("button", name=re.compile("^(다음 문제|결과 보기)$")).click()
            page.wait_for_timeout(500)
        page.wait_for_selector("text=오늘의 퀴즈 결과", timeout=20000)
        check(len(daily_types) == 3, "하루 3문제 정상 진행", " / ".join(daily_types))
        check(page.get_by_role("button", name=re.compile("금빛 상장 만들기")).is_visible(), "금빛 상장 버튼 유지")

        # 상장 공유 미리보기
        page.get_by_role("button", name=re.compile("금빛 상장 만들기")).click()
        page.wait_for_selector("text=나의 금빛 상장", timeout=15000)
        page.wait_for_timeout(1400)
        page.get_by_role("button", name="자랑하기").click()
        page.wait_for_selector("[data-share-sheet]", timeout=15000)
        page.wait_for_timeout(1000)
        check(page.get_by_text("퀴즈 상장 자랑하기").first.is_visible(), "상장 공유 미리보기 시트")
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
        page.keyboard.press("Escape")
        page.wait_for_timeout(600)

        # ---------- 5) 모임: 건강 챌린지 함께 ----------
        nav_button(page, "모임").click()
        page.wait_for_timeout(1500)
        page.get_by_role("button", name=re.compile("체험 모임 들어가기")).first.click()
        page.wait_for_selector("text=오늘 출석 현황", timeout=30000)
        page.wait_for_timeout(1800)
        group_main = page.inner_text("main")
        check(page.locator("[data-health-card]").count() >= 1, "모임 탭 건강 챌린지 카드")
        check(re.search(r"\d+/\d+명\s*함께했어요", group_main) is not None, "모임 함께 참여 인원")
        check("이번 주 모임 달성률" in group_main and "모임 게시판" in group_main, "모임 출석·게시판 유지")

        # 모임 초대 공유 미리보기(회귀 + 신규)
        page.get_by_role("button", name=re.compile("초대하기")).first.click()
        page.wait_for_selector("text=카카오톡으로 모임 초대", timeout=15000)
        page.get_by_role("button", name=re.compile("카카오톡으로 초대장 보내기")).click()
        page.wait_for_selector("[data-share-sheet]", timeout=15000)
        page.wait_for_timeout(900)
        check("FAM101" in page.inner_text("[data-share-sheet]"), "모임 초대 카드(코드 포함)")
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        page.keyboard.press("Escape")
        page.wait_for_timeout(600)

        # ---------- 6) 기존 기능 회귀 ----------
        nav_button(page, "랭킹").click()
        page.wait_for_timeout(2200)
        rank = page.inner_text("main")
        check(all(t in rank for t in ["우리 모임", "전국", "지역별", "개근왕"]), "랭킹 4탭 유지")
        check("이번 주 우리 모임 달성률" in rank, "모임 달성률 배너 유지")

        nav_button(page, "더보기").click()
        page.wait_for_timeout(900)
        more = page.inner_text("main")
        check(all(t in more for t in ["도구 모음", "가족 확인 화면", "가족안부달력", "내 정보 · 설정"]), "더보기 메뉴 유지")
        page.get_by_role("button", name=re.compile("가족안부달력")).click()
        page.wait_for_timeout(1500)
        check("달력" in page.inner_text("body") or "일정" in page.inner_text("body"), "가족안부달력 열림")
        page.keyboard.press("Escape")

        real_errors = [e for e in console if "favicon" not in e and "Failed to load resource" not in e and "manifest" not in e]
        check(len(real_errors) == 0, "콘솔 오류 없음", "; ".join(real_errors[:4]))

        browser.close()

    cleanup()
    print(json.dumps(results, ensure_ascii=False, indent=1))
    print(f"\n총 {len(results)}개 중 실패 {len(errors)}개")
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
