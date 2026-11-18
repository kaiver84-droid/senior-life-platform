"""늘봄 라이브 점검 — 퀴즈(무한 연습·2열) · 랭킹(히어로·분야 카드) · 모임(중복 정리) · 하단 메뉴.

카카오 인가만 스텁으로 흉내 내고 페이지·API·Supabase 는 라이브 그대로 쓴다.
끝나면 테스트 계정을 DB 에서 지운다.

python3 e2e/check_live_refresh.py
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

ID_T, NAME_T = "777009001", "점검순자"
CODE_T = js_make_code(f"kakao_{ID_T}")

problems = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
    if not cond:
        problems.append(label)


def cleanup():
    for q in [
        f"delete from public.health_checks where user_code = '{CODE_T}';",
        f"delete from public.group_cheers where user_code = '{CODE_T}';",
        f"delete from public.group_posts where user_code = '{CODE_T}';",
        f"delete from public.group_members where user_code = '{CODE_T}';",
        f"delete from public.groups where creator_code = '{CODE_T}';",
        f"delete from public.quiz_logs where user_code = '{CODE_T}';",
        f"delete from public.daily_visits where user_code = '{CODE_T}';",
        f"delete from public.med_checks where user_code = '{CODE_T}';",
        f"delete from public.family_events where user_code = '{CODE_T}';",
        f"delete from public.users where code = '{CODE_T}';",
    ]:
        try:
            sql(q)
        except Exception:  # noqa: BLE001
            pass


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
                            "createdAt": "2026-11-18T00:00:00.000Z",
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


cleanup()
console = []
bad_http = []

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=3,
        locale="ko-KR",
        is_mobile=True,
        has_touch=True,
    )
    page = ctx.new_page()
    page.on("console", lambda m: console.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
    page.on("response", lambda r: bad_http.append(f"{r.status} {r.url}") if r.status >= 400 else None)
    page.route("**/t1.kakaocdn.net/**", lambda route, _req: route.abort())
    page.route("**/api/auth/kakao**", kakao_stub(ID_T, NAME_T))

    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
    page.get_by_role("button", name="카카오톡으로 시작하기").click()
    page.wait_for_selector("#setup-nick", timeout=30000)
    page.fill("#setup-nick", NAME_T)
    page.select_option("#setup-birth", "1952")
    page.click('[data-birthtime="묘시"]')
    page.select_option("#setup-sido", "충청북도")
    page.select_option("#setup-sigungu", "옥천군")
    page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
    page.wait_for_timeout(2500)

    def nav(name):
        page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name=name).click()
        page.wait_for_timeout(1400)

    def overflow():
        return page.evaluate(
            """() => {
              const doc = document.documentElement;
              return {
                scrollW: doc.scrollWidth, clientW: doc.clientWidth,
                over: Array.from(document.querySelectorAll("main *"))
                  .filter(el => el.getBoundingClientRect().right > doc.clientWidth + 1)
                  .slice(0, 4)
                  .map(el => (el.tagName + "." + (typeof el.className === 'string' ? el.className : '')).slice(0, 60)),
              };
            }"""
        )

    # ---------------- 하단 메뉴 ----------------
    navinfo = page.evaluate(
        """() => {
          const nav = document.querySelector("nav[aria-label='주요 메뉴']");
          const btns = Array.from(nav.querySelectorAll("button"));
          const active = nav.querySelector("button[aria-current='page']");
          const pill = active ? active.querySelector("span") : null;
          return {
            n: btns.length,
            labels: btns.map(b => b.innerText.trim()),
            svgs: btns.map(b => b.querySelectorAll("svg").length),
            filled: Array.from(nav.querySelectorAll("svg")).filter(s => s.getAttribute("fill") === "currentColor").length,
            activeBg: pill ? getComputedStyle(pill).backgroundColor : "",
            activeRadius: pill ? getComputedStyle(pill).borderRadius : "",
          };
        }"""
    )
    print("하단 메뉴:", navinfo)
    check(navinfo["n"] == 6, "하단 메뉴 6개 유지", str(navinfo["labels"]))
    check(navinfo["filled"] >= 6, "채움형 아이콘 적용", f"{navinfo['filled']}개")
    check("rgb(" in navinfo["activeBg"] and navinfo["activeBg"] != "rgba(0, 0, 0, 0)", "선택 탭 배지 배경", navinfo["activeBg"])

    # ---------------- 퀴즈 ----------------
    nav("퀴즈")
    page.wait_for_timeout(900)
    body = page.locator("body").inner_text()
    check("하루 3문제는 점수에 들어가요" not in body, "안내 문구 삭제")
    check("초성 · 옛날 노래 · 틀린 그림 · OX · 넌센스" not in body, "파란 박스 장르 나열 삭제")
    check("계속 풀어 볼 수 있어요" in body, "주제 안내 문구 변경")
    check("섞어서 3문제" not in body and "섞어서 풀기" in body, "‘섞어서 풀기’ 라벨")
    check(not re.search(r"지금 \d+문제가 준비돼 있어요", body), "문제 수 배지 문구 삭제")
    grid = page.evaluate(
        """() => {
          const els = Array.from(document.querySelectorAll("[data-quiz-topic]"));
          const xs = [...new Set(els.map(e => Math.round(e.getBoundingClientRect().x)))];
          const ys = [...new Set(els.map(e => Math.round(e.getBoundingClientRect().y)))];
          const bank = document.querySelectorAll("[data-quiz-bank]").length;
          const overflow = els.filter(e => e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 2)
            .map(e => e.getAttribute("data-quiz-topic"));
          return { n: els.length, cols: xs.length, rows: ys.length, bank, overflow };
        }"""
    )
    print("주제 그리드:", grid)
    check(grid["n"] == 6 and grid["cols"] == 2 and grid["rows"] == 3, "주제 버튼 2열 3행", str(grid))
    check(grid["bank"] == 1, "문제 수 표식(data-quiz-bank) 한 곳", str(grid["bank"]))
    check(not grid["overflow"], "주제 버튼 글자 잘림 없음", str(grid["overflow"]))
    info = overflow()
    check(info["scrollW"] <= info["clientW"] + 1 and not info["over"], "퀴즈 화면 가로 넘침 없음", str(info["over"]))
    page.evaluate("window.scrollTo(0,0)")
    page.wait_for_timeout(300)
    page.locator("[data-quiz-topics]").scroll_into_view_if_needed()
    page.wait_for_timeout(400)
    page.screenshot(path=f"{SHOT}/_live_quiz_topics.png")

    # 무한 연습
    page.locator("[data-quiz-topic='ox']").first.click()
    page.wait_for_timeout(1400)
    check("무한 연습" in page.locator("body").inner_text(), "무한 연습 표시")
    page.evaluate("window.scrollTo(0,0)")
    page.wait_for_timeout(400)
    page.screenshot(path=f"{SHOT}/neulbom_quiz_infinite.png")
    headers = []
    for i in range(6):
        page.wait_for_selector("[data-quiz-option]", timeout=15000)
        headers.append(
            page.evaluate("() => { const s = document.querySelector('[data-quiz-solved]'); return s ? s.parentElement.innerText.replace(/\\n/g, ' ') : ''; }")
        )
        page.locator("[data-quiz-option]").first.click()
        page.wait_for_timeout(250)
        page.get_by_role("button", name=re.compile("정답 확인")).click()
        page.wait_for_timeout(350)
        page.get_by_role("button", name=re.compile("^다음 문제$|연습 결과 보기|결과 보기")).first.click()
        page.wait_for_timeout(450)
    print("진행:", headers)
    check(any("6문제째" in h for h in headers), "6문제 넘게 계속 진행", str(headers[-1] if headers else ""))
    check(page.locator("[data-quiz-option]").count() > 0, "7번째 문제가 이어짐")
    page.locator("[data-quiz-stop]").first.click()
    page.wait_for_timeout(1200)
    check("무한 연습 결과" in page.locator("body").inner_text(), "그만 풀기 → 결과 화면")
    page.get_by_role("button", name=re.compile("퀴즈 홈으로 돌아가기")).click()
    page.wait_for_timeout(900)

    # ---------------- 랭킹 ----------------
    nav("랭킹")
    page.wait_for_timeout(2200)
    page.evaluate("window.scrollTo(0,0)")
    page.wait_for_timeout(500)
    tabs = page.evaluate(
        "() => Array.from(document.querySelectorAll('[data-area-tab]')).map(e => [e.getAttribute('data-area-tab'), e.innerText.replace(/\\n/g, ' ').trim()])"
    )
    keys = sorted(t[0] for t in tabs)
    labels = " ".join(t[1] for t in tabs)
    print("영역:", tabs)
    check(keys == sorted(["all", "brain", "attend", "group", "share", "save"]), "분야 5개 + 늘봄왕", str(keys))
    check(all(k in labels for k in ["퀴즈왕", "출석왕", "모임왕", "초대왕", "지식왕"]), "새 분야 이름", labels[:80])
    check(not any(k in labels for k in ["기억왕", "건강왕", "나눔왕", "알뜰왕"]), "옛 분야 이름 없음")
    ranges = page.evaluate("() => Array.from(document.querySelectorAll('[data-range-tab]')).map(e => e.getAttribute('data-range-tab'))")
    check(ranges == ["group", "region", "national"], "범위 탭 3개(연령대 삭제)", str(ranges))
    check("연령대" not in page.locator("main").inner_text(), "연령대 문구·칩 없음")
    hero = page.evaluate(
        """() => {
          const card = document.querySelector("[data-grade-card]");
          if (!card) return null;
          const me = document.querySelector("[data-rank-me]");
          return {
            same: card === me,
            h: Math.round(card.getBoundingClientRect().height),
            ribbon: (document.querySelector("[data-my-rank-ribbon]") || {}).innerText || "",
            text: card.innerText.replace(/\\n/g, " | "),
            badge: !!document.querySelector("[data-badge-open]"),
            next: !!document.querySelector("[data-grade-next-text]"),
          };
        }"""
    )
    print("히어로:", hero)
    check(bool(hero) and hero["same"], "내 순위+내 등급 한 카드")
    check(bool(hero) and bool(hero["ribbon"]), "순위 리본", hero["ribbon"] if hero else "")
    for need in ["이번 주 포인트", "연속 출석", "내 등급·배지"]:
        check(bool(hero) and need in hero["text"], f"3분할 요약 — {need}")
    check(bool(hero) and hero["badge"] and hero["next"], "배지 버튼·다음 등급 안내")
    check(bool(hero) and hero["h"] <= 260, "히어로 카드 높이 적정", str(hero["h"]) if hero else "")
    info = overflow()
    check(info["scrollW"] <= info["clientW"] + 1 and not info["over"], "랭킹 화면 가로 넘침 없음", str(info["over"]))
    page.screenshot(path=f"{SHOT}/neulbom_ranking_simple.png")

    # 분야 카드 → 순위표 전환
    page.locator("[data-area-card='brain']").first.click()
    page.wait_for_timeout(1500)
    board = page.evaluate("() => { const b = document.querySelector('[data-area-board]'); return b ? b.getAttribute('data-area-board') : null; }")
    check(board == "brain", "분야 카드 → 순위표 전환", str(board))
    page.screenshot(path=f"{SHOT}/_live_ranking_board.png")
    # 배지 시트
    page.evaluate("window.scrollTo(0,0)")
    page.wait_for_timeout(400)
    page.locator("[data-badge-open]").first.click()
    page.wait_for_timeout(900)
    check(page.locator("[data-badge-sheet]").count() > 0, "배지 컬렉션 시트 열림")
    page.get_by_role("button", name="닫기").last.click()
    page.wait_for_timeout(700)

    # ---------------- 모임 ----------------
    nav("모임")
    page.wait_for_timeout(1600)
    if not page.locator("[data-group-invite-top]").count():
        trial = page.get_by_role("button", name=re.compile("체험 모임 들어가기"))
        if trial.count():
            trial.first.click()
        for _ in range(12):
            page.wait_for_timeout(900)
            if page.locator("[data-group-invite-top]").count():
                break
    page.wait_for_timeout(1200)
    page.evaluate("window.scrollTo(0,0)")
    page.wait_for_timeout(400)
    g = page.evaluate(
        """() => ({
          top: document.querySelectorAll("[data-group-invite-top]").length,
          row: document.querySelectorAll("[data-group-row-invite]").length,
          health: document.querySelectorAll("[data-health-card]").length,
          text: document.querySelector("main").innerText,
        })"""
    )
    print("모임:", {k: v for k, v in g.items() if k != "text"})
    check(g["top"] == 1, "상단 초대 버튼 하나", str(g["top"]))
    check(g["row"] == 0, "목록 줄 초대 버튼 중복 없음")
    check(g["health"] == 0 and "오늘의 건강 챌린지" not in g["text"], "모임 건강 챌린지 삭제")
    check(not re.search(r"정원 \d+/\d+명", g["text"]), "정원 중복 표시 없음")
    check("체크한 도장은" not in g["text"], "‘체크한 도장은…’ 문구 없음")
    info = overflow()
    check(info["scrollW"] <= info["clientW"] + 1 and not info["over"], "모임 화면 가로 넘침 없음", str(info["over"]))
    page.screenshot(path=f"{SHOT}/neulbom_groups_clean.png")

    # ---------------- 콘솔·HTTP ----------------
    hard = [c for c in console if "Failed to load resource" not in c]
    check(not hard, "콘솔 오류 0건", str(hard[:3]))
    check(not bad_http, "HTTP 400 이상 0건", str(bad_http[:3]))

    browser.close()

cleanup()
print("\n문제:", len(problems))
for x in problems:
    print("  -", x)
