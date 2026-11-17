"""라이브 모임 기능 E2E — https://senior-life-platform.pages.dev

검증 범위
1) 홈: 모임 선택 배너 · 오늘의 모임 현황(출석률·1위) · 오늘의 모임 미션
2) 우리 모임 탭: 체험 모임(FAM101) 가입 → 회원별 출석 · 주간 달성률 게이지 · 게시판 글쓰기 · 카톡 초대 링크
3) 모임 만들기 → 초대 링크(?group=CODE)로 다른 사람이 들어와 자동 가입
4) 랭킹: 우리 모임 · 전국 · 지역별 · 개근왕 (우리 모임 시상대 + 달성률 배너)
5) 퀴즈: ‘우리 모임 공동 퀴즈’ 배지 · 참여자 수 · 결과를 모임에 알리기
6) 기존 기능(홈 인사카드·운세·날씨·달력, 더보기 → 도구/가족) 유지

카카오 인가만 Playwright 라우팅으로 흉내 내고, 페이지·API·Supabase 는 라이브 그대로 쓴다.

사용법: python3 e2e/test_live_groups.py
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

ID_A, NAME_A = "777003001", "모임순자"
ID_B, NAME_B = "777003002", "모임철수"
CODE_A = js_make_code(f"kakao_{ID_A}")
CODE_B = js_make_code(f"kakao_{ID_B}")

results = {}
errors = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
    results[label] = bool(cond)
    if not cond:
        errors.append(label)


def cleanup():
    codes = f"'{CODE_A}','{CODE_B}'"
    for q in [
        f"delete from public.group_cheers where user_code in ({codes});",
        f"delete from public.group_posts where user_code in ({codes});",
        f"delete from public.group_members where user_code in ({codes});",
        f"delete from public.groups where creator_code in ({codes});",
        f"delete from public.quiz_logs where user_code in ({codes});",
        f"delete from public.daily_visits where user_code in ({codes});",
        f"delete from public.med_checks where user_code in ({codes});",
        f"delete from public.family_events where user_code in ({codes});",
        f"delete from public.users where code in ({codes});",
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


def login(page, kakao_id, nickname):
    page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
    page.get_by_role("button", name="카카오톡으로 시작하기").click()
    page.wait_for_selector("#setup-nick", timeout=30000)
    page.fill("#setup-nick", nickname)
    page.select_option("#setup-birth", "1952")
    page.click('[data-birthtime="묘시"]')
    page.select_option("#setup-sido", "충청북도")
    page.select_option("#setup-sigungu", "옥천군")
    page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
    page.wait_for_timeout(2500)


def nav_button(page, label):
    return page.get_by_role("navigation").get_by_role("button", name=label)


def main():
    cleanup()

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            locale="ko-KR",
            is_mobile=True,
            has_touch=True,
        )
        errors_console = []
        bad_api = []
        page = ctx.new_page()
        page.on("console", lambda m: errors_console.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: errors_console.append(f"pageerror: {e}"))
        page.on("response", lambda r: bad_api.append(f"{r.status} {r.url}") if "/api/groups" in r.url and r.status >= 400 else None)
        page.route("**/api/auth/kakao**", kakao_stub(ID_A, NAME_A))

        page.goto(BASE + "/", wait_until="domcontentloaded")
        login(page, ID_A, NAME_A)

        # ---------- 하단 탭 ----------
        tabs = page.get_by_role("navigation").get_by_role("button")
        names = [tabs.nth(i).inner_text().strip().split("\n")[-1] for i in range(tabs.count())]
        check(names == ["홈", "모임", "퀴즈", "랭킹", "혜택", "더보기"], "하단 탭 6개(홈·모임·퀴즈·랭킹·혜택·더보기)", str(names))
        check(page.get_by_text("모임을 골라 주세요").first.is_visible(), "가입 전 홈 모임 배너 안내")

        # ---------- 모임 탭: 체험 모임 가입 ----------
        nav_button(page, "모임").click()
        page.wait_for_selector("text=모임을 시작해 보세요", timeout=20000)
        check(page.get_by_role("button", name=re.compile("체험 모임 들어가기")).first.is_visible(), "모임 없을 때 체험 모임 안내")
        page.get_by_role("button", name=re.compile("체험 모임 들어가기")).first.click()
        page.wait_for_selector("text=오늘 출석 현황", timeout=30000)
        page.wait_for_timeout(1500)

        body = page.inner_text("main")
        check("우리 가족 사랑방" in body, "체험 모임 이름 표시")
        # 체험 모임(10명) + 나 = 11명이 기본. 지난 검증에서 들어온 회원이 있으면 그보다 많을 수 있다.
        member = re.search(r"멤버 (\d+)명", body)
        check(bool(member) and int(member.group(1)) >= 11, "체험 모임 회원 11명 이상(체험 10 + 나)", member.group(0) if member else "")
        donut = re.search(r"(\d+) / (\d+)명", body)
        check(bool(donut) and int(donut.group(1)) >= 8, "오늘 출석 인원 표시", donut.group(0) if donut else "")
        check("이번 주 모임 달성률" in body and "%" in body, "주간 달성률 게이지")
        check(len(page.locator("[aria-label*='출석']").all()) >= 10, "회원별 출석 도장 목록")

        # 게시판 글쓰기
        post_text = "오늘 퀴즈 3문제 다 맞혔어요! 다들 화이팅 💪"
        page.get_by_label("모임 게시판에 남길 말").fill(post_text)
        page.get_by_role("button", name="남기기").click()
        page.wait_for_timeout(2200)
        check(page.get_by_text(post_text).first.is_visible(), "게시판에 한 줄 안내 글 등록")
        page.screenshot(path=f"{SHOT}/_live_group_board.png")
        page.wait_for_timeout(3600)  # 토스트가 사라진 뒤
        page.evaluate("() => window.scrollTo(0, 0)")
        page.wait_for_timeout(700)
        page.screenshot(path=f"{SHOT}/neulbom_group_tab.png")

        # 카톡 초대 링크
        page.get_by_role("button", name=re.compile("초대하기")).first.click()
        page.wait_for_selector("text=카카오톡으로 모임 초대", timeout=15000)
        sheet = page.inner_text("main >> xpath=..") if False else page.inner_text("body")
        check("FAM101" in sheet, "초대 코드 표시")
        check("?group=FAM101" in sheet, "카카오톡 초대 링크에 ?group=FAM101")
        check(page.get_by_role("button", name=re.compile("카카오톡으로 초대장 보내기")).is_visible(), "카톡 초대 버튼")
        page.keyboard.press("Escape")
        page.wait_for_timeout(600)

        # ---------- 홈 ----------
        nav_button(page, "홈").click()
        page.wait_for_timeout(1500)
        home = page.inner_text("main")
        home_member = re.search(r"멤버 (\d+)명", home)
        check("우리 가족 사랑방" in home and bool(home_member) and int(home_member.group(1)) >= 11,
              "홈 상단 모임 배너(이름·멤버 수)", home_member.group(0) if home_member else "")
        check("오늘의 모임 현황" in home, "홈 오늘의 모임 현황 카드")
        check("모임 1위" in home, "홈 모임 1위 표시")
        check("오늘의 모임 미션" in home and "모임 랭킹에 도전하세요" in home, "홈 오늘의 모임 미션 배너")
        check(page.get_by_role("button", name=re.compile("지금 바로 참여하기|오늘 결과 보기")).is_visible(), "미션 참여 버튼")
        check("오늘의 운세" in home and "오늘의 날씨와 생활팁" in home, "기존 운세·날씨 유지")
        check(page.get_by_role("button", name="인사카드 만들기").is_visible(), "기존 인사카드 유지")
        check("가족안부달력" in home, "기존 가족안부달력 배너 유지")
        check(all(t in home for t in ["오늘의 퀴즈", "정부 지원금", "돋보기", "복약 체크", "안부 전송", "생활 가이드"]), "기존 2×3 바로가기 유지")
        page.wait_for_timeout(3600)  # 토스트가 사라진 뒤
        page.evaluate("() => window.scrollTo(0, 0)")
        page.wait_for_timeout(700)
        page.screenshot(path=f"{SHOT}/neulbom_group_home.png")
        page.evaluate("() => window.scrollBy(0, 780)")
        page.wait_for_timeout(900)
        page.screenshot(path=f"{SHOT}/_live_home_mission.png")
        page.evaluate("() => window.scrollTo(0, 0)")

        # ---------- 랭킹 ----------
        nav_button(page, "랭킹").click()
        page.wait_for_timeout(2000)
        rank = page.inner_text("main")
        for label in ["우리 모임", "전국", "지역별", "개근왕"]:
            check(label in rank, f"랭킹 탭 {label}")
        check("우리 모임 내 순위" in rank, "우리 모임 1·2·3위 시상대/내 순위")
        check(re.search(r"이번 주 우리 모임 달성률 \d+%", rank) is not None, "달성률 축하 배너", re.search(r"이번 주 우리 모임 달성률 \d+%", rank).group(0) if re.search(r"이번 주 우리 모임 달성률 \d+%", rank) else "")
        check(any(n in rank for n in ["김영희", "박철수", "이정숙", "최민수", "정순자"]), "체험 모임 회원이 시상대에 표시")
        page.screenshot(path=f"{SHOT}/neulbom_group_ranking.png")

        page.get_by_role("tab", name="전국").click()
        page.wait_for_timeout(1800)
        check("명예의 전당" in page.inner_text("main"), "전국 랭킹 표시")
        page.get_by_role("tab", name="지역별").click()
        page.wait_for_timeout(1500)
        check("옥천" in page.inner_text("main") or "지역" in page.inner_text("main"), "지역별 랭킹 표시")
        page.get_by_role("tab", name="개근왕").click()
        page.wait_for_timeout(1500)
        check("연속 출석" in page.inner_text("main"), "개근왕 랭킹 표시")

        # ---------- 퀴즈 ----------
        nav_button(page, "퀴즈").click()
        page.wait_for_selector("text=1분 두뇌 퀴즈", timeout=20000)
        page.wait_for_timeout(1200)
        quiz = page.inner_text("main")
        check("우리 모임 공동 퀴즈" in quiz, "퀴즈 상단 ‘우리 모임 공동 퀴즈’ 배지")
        check(re.search(r"우리 모임 참여자\s*\d+\s*/\s*\d+명", quiz) is not None, "퀴즈 참여자 N/M명", re.search(r"우리 모임 참여자\s*\d+\s*/\s*\d+명", quiz).group(0) if re.search(r"우리 모임 참여자\s*\d+\s*/\s*\d+명", quiz) else "")

        page.get_by_role("button", name="퀴즈 시작하기").click()
        page.wait_for_timeout(800)
        for i in range(3):
            page.locator("[data-quiz-option]").first.click()
            page.wait_for_timeout(200)
            page.get_by_role("button", name="정답 확인").click()
            page.wait_for_timeout(300)
            page.get_by_role("button", name=re.compile("^(다음 문제|결과 보기)$")).click()
            page.wait_for_timeout(450)
        page.wait_for_selector("text=오늘의 퀴즈 결과", timeout=20000)
        check(page.get_by_role("button", name=re.compile("모임에 결과 알리기")).is_visible(), "퀴즈 결과 → 모임에 결과 알리기")

        # ---------- 모임 만들기 ----------
        nav_button(page, "모임").click()
        page.wait_for_timeout(1200)
        page.get_by_role("button", name=re.compile("모임 만들기")).first.click()
        page.wait_for_selector("#group-name", timeout=15000)
        page.locator("#group-name").fill("옥천 친구들 모임")
        page.get_by_role("button", name=re.compile("^모임 만들기$")).last.click()
        page.wait_for_timeout(2500)
        made = page.inner_text("main")
        check("옥천 친구들 모임" in made, "새 모임 만들기")
        check("멤버 1명" in made, "새 모임 회원 1명")

        # 모임 바꾸기 — 만든 모임 ↔ 체험 모임
        page.get_by_role("button", name=re.compile("모임 바꾸기")).first.click()
        page.wait_for_selector("text=보고 싶은 모임을 골라 주세요", timeout=15000)
        sheet_text = page.inner_text("body")
        check("우리 가족 사랑방" in sheet_text and "옥천 친구들 모임" in sheet_text, "모임 바꾸기 목록에 두 모임")
        page.screenshot(path=f"{SHOT}/_live_group_switch.png")
        page.get_by_role("button", name=re.compile("우리 가족 사랑방")).first.click()
        page.wait_for_timeout(2500)
        switched = page.inner_text("main")
        sw_member = re.search(r"멤버 (\d+)명", switched)
        check("우리 가족 사랑방" in switched and bool(sw_member) and int(sw_member.group(1)) >= 11,
              "모임 전환 후 출석·게시판 다시 표시", sw_member.group(0) if sw_member else "")

        rows = sql(f"select id from public.groups where creator_code = '{CODE_A}' order by created_at desc limit 1")
        new_code = rows[0]["id"] if rows else ""
        check(bool(re.match(r"^[A-Z0-9]{6}$", new_code or "")), "새 모임 6자리 초대 코드", new_code)

        # ---------- 초대 링크로 다른 사람 자동 가입 ----------
        if new_code:
            ctx_b = browser.new_context(
                viewport={"width": 390, "height": 844},
                device_scale_factor=2,
                locale="ko-KR",
                is_mobile=True,
                has_touch=True,
            )
            page_b = ctx_b.new_page()
            page_b.on("console", lambda m: errors_console.append(f"[B] {m.type}: {m.text}") if m.type == "error" else None)
            page_b.route("**/api/auth/kakao**", kakao_stub(ID_B, NAME_B))
            page_b.goto(f"{BASE}/?group={new_code}", wait_until="domcontentloaded")
            login(page_b, ID_B, NAME_B)
            page_b.wait_for_timeout(3000)
            joined = page_b.inner_text("main")
            check("옥천 친구들 모임" in joined, "초대 링크로 들어온 사람이 자동 가입")
            check("멤버 2명" in joined, "가입 후 회원 2명", re.search(r"멤버 \d+명", joined).group(0) if re.search(r"멤버 \d+명", joined) else "")
            check(page_b.evaluate("() => window.location.search") == "", "초대 파라미터 정리(주소창)")
            page_b.screenshot(path=f"{SHOT}/_live_group_invite_join.png")
            ctx_b.close()

        # ---------- 기존 기능: 더보기 → 도구 · 가족 · 달력 ----------
        nav_button(page, "더보기").click()
        page.wait_for_timeout(900)
        more = page.inner_text("main")
        check(all(t in more for t in ["도구 모음", "가족 확인 화면", "가족안부달력", "내 정보 · 설정"]), "더보기 메뉴(도구·가족·달력·설정)")
        page.get_by_role("button", name=re.compile("도구 모음")).click()
        page.wait_for_timeout(1200)
        check("돋보기" in page.inner_text("main"), "더보기 → 도구 화면")
        page.get_by_role("button", name="더보기로 돌아가기").click()
        page.wait_for_timeout(600)
        page.get_by_role("button", name=re.compile("가족 확인 화면")).click()
        page.wait_for_timeout(1500)
        check("가족" in page.inner_text("main"), "더보기 → 가족 확인 화면")
        page.get_by_role("button", name="더보기로 돌아가기").click()
        page.wait_for_timeout(600)
        page.get_by_role("button", name=re.compile("가족안부달력")).click()
        page.wait_for_timeout(1500)
        check("달력" in page.inner_text("body") or "일정" in page.inner_text("body"), "더보기 → 가족안부달력")
        page.keyboard.press("Escape")

        # '/api/state?code=...' 는 첫 로그인 때 아직 저장 전이라 404 가 정상이다(기존 동작).
        real_errors = [
            e
            for e in errors_console
            if "favicon" not in e and "manifest" not in e and "Failed to load resource" not in e
        ]
        check(len(real_errors) == 0, "콘솔 오류 없음", "; ".join(real_errors[:6]))
        check(len(bad_api) == 0, "모임 API 오류 응답 없음", "; ".join(bad_api[:4]))

        browser.close()

    cleanup()
    print(json.dumps(results, ensure_ascii=False, indent=1))
    print(f"\n총 {len(results)}개 중 실패 {len(errors)}개")
    if errors:
        for e in errors:
            print(" -", e)
    sys.exit(0 if not errors else 1)


if __name__ == "__main__":
    main()
