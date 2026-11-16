"""라이브(Cloudflare Pages) 390×844 E2E 전체 검증 — 늘봄 디자인 기준.

BASE=https://senior-life-platform.pages.dev python3 e2e/test_live.py
"""
import json
import os
import re
import sys
import urllib.request

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402
from test_kakao_onboarding import js_make_code  # noqa: E402

BASE = os.environ.get("BASE", "https://senior-life-platform.pages.dev").rstrip("/")
SHOT = "/workspace/downloads"


def api(path):
    req = urllib.request.Request(BASE + path, headers={"User-Agent": "Mozilla/5.0 (E2E check)"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.status, json.loads(r.read().decode())


def delete_test_user(code):
    """이전 실행이 남긴 테스트 계정을 지워 항상 '처음 로그인' 경로를 검사한다."""
    token = open("/workspace/work/senior-platform/.supabase_token").read().strip()
    body = json.dumps({"query": f"delete from public.users where code = '{code}';"}).encode()
    req = urllib.request.Request(
        "https://api.supabase.com/v1/projects/aaslirekynetqguajkpv/database/query",
        data=body, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, method="POST",
    )
    urllib.request.urlopen(req, timeout=25).read()


def main():
    res = {}
    errors = []

    # 1) API 계약 (Pages Functions)
    try:
        code, health = api("/api/health")
    except Exception as exc:  # 로컬 정적 프리뷰에는 Functions 가 없다
        code, health = 0, {"supabase": f"n/a ({exc.__class__.__name__})", "kakao": "n/a"}
    res["api_health"] = {"status": code, "supabase": health.get("supabase"), "kakao": health.get("kakao")}
    try:
        code, rank = api(
            "/api/rankings?scope=region&sido=%EC%B6%A9%EC%B2%AD%EB%B6%81%EB%8F%84"
            "&sigungu=%EC%98%A5%EC%B2%9C%EA%B5%B0&name=%EC%88%9C%EC%9E%90&points=60&streak=2&birthYear=1952"
        )
    except Exception:
        code, rank = 0, {}
    res["api_rankings"] = {
        "status": code,
        "weekId": rank.get("weekId"),
        "total": rank.get("total"),
        "myRank": rank.get("myRank"),
        "rows": len(rank.get("rows", [])),
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(
            args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"]
        )
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            locale="ko-KR",
            is_mobile=True,
            has_touch=True,
            permissions=["camera"],
        )
        page = ctx.new_page()
        page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        # 카카오 인가만 스텁한다(실제 카카오 계정 로그인은 사용자 본인만 가능). 페이지·API·DB 는 라이브 그대로.
        KAKAO_ID = os.environ.get("STUB_KAKAO_ID", "777000333")
        delete_test_user(js_make_code(f"kakao_{KAKAO_ID}"))

        def _kakao(route, request):
            if "start=1" in request.url:
                route.fulfill(status=302, headers={"location": "/?code=STUB-AUTH-CODE"})
            elif request.method == "POST":
                route.fulfill(status=200, content_type="application/json", body=json.dumps({
                    "ok": True,
                    "profile": {"id": f"kakao_{KAKAO_ID}", "nickname": "카카오순자", "birthYear": 1952,
                                "source": "kakao", "createdAt": "2026-11-16T00:00:00.000Z"},
                }))
            else:
                route.fulfill(status=200, content_type="application/json", body=json.dumps({
                    "ok": True, "supabase": "connected", "kakao": "configured",
                    "kakaoLoginConfigured": True, "kakaoJsConfigured": False, "redirectUri": BASE + "/",
                }))

        page.route("**/api/auth/kakao**", _kakao)
        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
        res["login_only_ok"] = page.query_selector("#setup-nick") is None
        page.get_by_role("button", name="카카오톡으로 시작하기").click()
        page.wait_for_selector("#setup-nick", timeout=30000)
        res["onboarding_ok"] = True
        page.fill("#setup-nick", "순자")
        page.select_option("#setup-birth", "1952")
        page.select_option("#setup-time", "묘시")
        page.select_option("#setup-sido", "충청북도")
        page.select_option("#setup-sigungu", "옥천군")
        page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
        page.wait_for_timeout(3000)

        nav = page.get_by_role("navigation").get_by_role("button")
        res["nav_tabs"] = nav.count()

        # ---------- 홈 ----------
        res["home_greeting"] = page.get_by_text("안녕하세요,").is_visible()
        res["home_fortune"] = page.get_by_text("오늘의 운세").first.is_visible()
        res["home_weather"] = page.get_by_text("오늘의 날씨와 생활팁").first.is_visible()
        res["home_tiles"] = all(
            page.get_by_text(t).first.is_visible()
            for t in ["오늘의 퀴즈", "정부 지원금", "돋보기", "복약 체크", "안부 전송", "생활 가이드"]
        )
        res["home_logo"] = page.get_by_label("늘봄 홈").is_visible()

        # 인사카드(Canvas) — 시트 안에서 실제로 그려지는지
        page.get_by_role("button", name="인사카드 만들기").click()
        page.wait_for_timeout(2500)
        res["greeting_canvas_bytes"] = page.evaluate(
            """() => { const c=[...document.querySelectorAll('canvas')].find(c=>c.width>1000); return c?c.toDataURL('image/png').length:0; }"""
        )
        page.screenshot(path=f"{SHOT}/_live_card.png")
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)

        # 운세 상세
        page.get_by_text("오늘의 운세").first.click()
        page.wait_for_timeout(700)
        res["fortune_sheet"] = page.get_by_text("행운의 색").is_visible()
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)

        # ---------- 퀴즈 ----------
        nav.nth(1).click()
        page.wait_for_selector("text=1분 두뇌 퀴즈", timeout=20000)
        res["quiz_intro"] = page.get_by_role("button", name="퀴즈 시작하기").is_visible()
        page.get_by_role("button", name="퀴즈 시작하기").click()
        page.wait_for_timeout(700)
        res["quiz_progress"] = page.get_by_text("1 / 3 문제").is_visible()
        res["quiz_confirm_disabled"] = page.get_by_role("button", name="정답 확인").is_disabled()

        for i in range(3):
            page.locator("[data-quiz-option]").first.click()
            page.wait_for_timeout(250)
            page.get_by_role("button", name="정답 확인").click()
            page.wait_for_timeout(350)
            if i == 0:
                res["quiz_feedback"] = page.get_by_text(re.compile("정답이에요|아쉽지만")).is_visible()
                page.screenshot(path=f"{SHOT}/_live_quiz.png")
            page.get_by_role("button", name=re.compile("^(다음 문제|결과 보기)$")).click()
            page.wait_for_timeout(450)

        page.wait_for_selector("text=오늘의 퀴즈 결과", timeout=20000)
        res["quiz_result"] = True
        page.get_by_role("button", name="금빛 상장 만들기").click()
        page.wait_for_timeout(1800)
        res["certificate_canvas_bytes"] = page.evaluate(
            """() => { const c=[...document.querySelectorAll('canvas')].find(c=>c.width>1000); return c?c.toDataURL('image/png').length:0; }"""
        )
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)

        # ---------- 연습 모드 (새 퀴즈 더 풀기 · 점수 미반영) ----------
        res["practice_cta"] = page.get_by_role("button", name="연습 모드 시작하기").is_visible()
        points_before = page.locator("section").first.inner_text()

        def play_practice_set():
            page.get_by_role("button", name=re.compile("^(연습 모드 시작하기|다른 문제 더 풀어보기)$")).click()
            page.wait_for_timeout(600)
            for _ in range(3):
                page.locator("[data-quiz-option]").first.click()
                page.wait_for_timeout(200)
                page.get_by_role("button", name="정답 확인").click()
                page.wait_for_timeout(300)
                page.get_by_role("button", name=re.compile("^(다음 문제|연습 결과 보기)$")).click()
                page.wait_for_timeout(400)
            page.wait_for_selector("text=연습 모드 결과", timeout=20000)

        play_practice_set()
        res["practice_badge"] = page.get_by_text("연습 모드").first.is_visible()
        res["practice_result"] = True
        res["practice_no_points"] = page.get_by_text("점수와 순위에 들어가지 않아요", exact=False).is_visible()
        page.screenshot(path=f"{SHOT}/_live_practice.png")

        play_practice_set()  # 한 세트 더
        res["practice_again"] = True
        page.get_by_role("button", name="오늘의 퀴즈로 돌아가기").click()
        page.wait_for_timeout(500)
        res["practice_back"] = page.get_by_text("오늘의 퀴즈 결과").is_visible()
        res["points_unchanged"] = points_before == page.locator("section").first.inner_text()

        # ---------- 명예의 전당 ----------
        nav.nth(2).click()
        page.wait_for_selector("text=이번 주 순위", timeout=20000)
        page.wait_for_timeout(1200)
        res["ranking_podium"] = page.get_by_text("이번 주 1위를 축하합니다", exact=False).is_visible()
        res["ranking_tabs"] = all(
            page.get_by_role("tab", name=t).is_visible() for t in ["우리 동네", "출생연도", "개근왕"]
        )
        res["ranking_my_rank"] = page.get_by_text("내 순위").first.is_visible()
        page.screenshot(path=f"{SHOT}/_live_ranking.png")

        # ---------- 복지 혜택 ----------
        nav.nth(3).click()
        page.wait_for_selector("text=내게 맞는 복지 혜택", timeout=20000)
        page.wait_for_timeout(800)
        res["welfare_hero"] = page.get_by_text("기초연금").first.is_visible()
        res["welfare_steps"] = page.get_by_text("이렇게 신청해요").is_visible()
        page.get_by_role("button", name="신청 방법 자세히 보기").click()
        page.wait_for_timeout(800)
        res["welfare_sheet"] = page.get_by_text("이렇게 하세요 (3단계)").is_visible()
        res["welfare_phone"] = page.get_by_role("link", name=re.compile("전화하기|129 안내")).is_visible()
        page.screenshot(path=f"{SHOT}/_live_welfare.png")
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)

        # ---------- 도구 ----------
        nav.nth(4).click()
        page.wait_for_selector("text=생활 속 스마트 도구", timeout=20000)
        res["tools_segments"] = all(
            page.get_by_role("tab", name=t).is_visible() for t in ["돋보기", "손전등", "가이드"]
        )
        page.get_by_role("button", name="확대 키우기").first.click()
        page.wait_for_timeout(300)
        res["tools_zoom"] = page.get_by_text("2.5배").first.is_visible()
        page.get_by_role("button", name="돋보기 켜기").click()
        page.wait_for_timeout(1800)
        res["tools_camera"] = page.locator("video").first.is_visible()
        page.screenshot(path=f"{SHOT}/_live_tools.png")
        page.get_by_role("button", name="돋보기 닫기").click()
        page.wait_for_timeout(400)
        page.get_by_role("tab", name="가이드").click()
        page.wait_for_timeout(500)
        res["tools_guides"] = page.get_by_text("1분 카드뉴스").first.is_visible()

        # ---------- 가족 ----------
        nav.nth(5).click()
        page.wait_for_selector("text=가족에게 안부 전하기", timeout=20000)
        page.wait_for_timeout(700)
        page.get_by_role("button", name="아침 약").click()
        page.wait_for_timeout(400)
        res["family_med"] = page.get_by_text("먹었어요").first.is_visible()
        res["family_activity"] = page.get_by_text("오늘의 활동").is_visible()
        code = page.locator(".tabular").first.inner_text().strip()
        res["family_code"] = code
        page.screenshot(path=f"{SHOT}/_live_family.png")

        # ---------- 가족안부달력 ----------
        page.get_by_role("button", name="달력 열기").click()
        page.wait_for_selector("text=다가오는 일정과 소식", timeout=20000)
        page.wait_for_timeout(600)
        res["calendar_open"] = True
        res["calendar_title"] = page.get_by_text("가족안부달력").first.is_visible()
        res["calendar_legend"] = page.get_by_text("우리동네 소식", exact=True).first.is_visible()

        # 일정 추가 — 오늘 날짜에 생일(매년 반복)
        page.get_by_role("button", name=re.compile("에 일정 추가")).click()
        page.wait_for_selector("text=가족 일정 추가", timeout=15000)
        page.wait_for_timeout(400)
        page.get_by_placeholder("예: 큰딸 생일, 손주 돌잔치").fill("큰딸 생일")
        page.get_by_role("button", name="일정 저장하기").click()
        page.wait_for_timeout(800)
        res["calendar_event_added"] = page.get_by_text("큰딸 생일").first.is_visible()
        res["calendar_dday_today"] = page.get_by_text("오늘!").first.is_visible()

        # 4갈래 소식 필터
        res["calendar_filters"] = all(
            page.get_by_role("tab", name=re.compile(t)).is_visible() for t in ["행사", "축제", "무료강좌", "복지소식"]
        )
        page.get_by_role("tab", name=re.compile("복지소식")).click()
        page.wait_for_timeout(500)
        res["calendar_filter_welfare"] = page.get_by_text("복지 소식", exact=True).first.is_visible()
        page.screenshot(path=f"{SHOT}/neulbom_family_calendar.png")
        page.get_by_label("달력 닫기").click()
        page.wait_for_timeout(500)
        res["calendar_closed"] = page.get_by_text("다가오는 일정과 소식").count() == 0

        # 자녀 대시보드 — 공유한 가족 일정
        page.goto(f"{BASE}/family/?code={code}", wait_until="domcontentloaded")
        page.wait_for_timeout(2500)
        res["dashboard_name"] = page.get_by_text("순자 님의 오늘").is_visible()
        res["dashboard_med"] = page.get_by_text("아침 약").first.is_visible()
        res["dashboard_7days"] = page.get_by_text("최근 7일").is_visible()
        res["dashboard_calendar"] = page.get_by_text("가족 일정").first.is_visible()
        res["dashboard_calendar_event"] = page.get_by_text("큰딸 생일").first.is_visible()
        page.screenshot(path=f"{SHOT}/_live_dashboard.png")

        # 일정 삭제 확인
        page.goto(f"{BASE}/", wait_until="domcontentloaded")
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=20000)
        # 홈 배너는 오늘 일정 유무에 따라 이름이 달라진다("가족안부달력 …" / "큰딸 생일 오늘! … 우리 동네 소식")
        page.get_by_role("button", name=re.compile("우리 동네 소식|가족안부달력")).first.click(timeout=20000)
        page.wait_for_selector("text=다가오는 일정과 소식", timeout=20000)
        page.wait_for_timeout(500)
        page.get_by_role("button", name="삭제").first.click()
        page.wait_for_timeout(300)
        page.get_by_role("button", name="지우기").click()
        page.wait_for_timeout(600)
        res["calendar_event_deleted"] = page.get_by_text("큰딸 생일").count() == 0

        browser.close()

    res["console_errors"] = errors
    print(json.dumps(res, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
