"""늘봄 퀴즈 — 문구 정리 · 주제 2열 정렬 · 무한 연습(주제 골라 바로 풀기) 점검.

python3 e2e/check_quiz_infinite.py
"""
import re
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from harness import onboard, start_server  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
OUT = "/workspace/downloads"

httpd = start_server()
problems = []


def overflow_info(page):
    return page.evaluate(
        """() => {
          const doc = document.documentElement;
          const over = Array.from(document.querySelectorAll("main *"))
            .filter(el => el.getBoundingClientRect().right > doc.clientWidth + 1)
            .slice(0, 6)
            .map(el => (el.tagName + "." + (el.className || "")).slice(0, 80));
          const topicOver = Array.from(document.querySelectorAll("[data-quiz-topic]"))
            .filter(el => el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2)
            .map(el => (el.getAttribute("data-quiz-topic") + ":" + el.innerText.replace(/\\n/g, " ")));
          return { scrollW: doc.scrollWidth, clientW: doc.clientWidth, over, topicOver };
        }"""
    )


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = b.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=3,
        locale="ko-KR",
        is_mobile=True,
        has_touch=True,
    )
    page = ctx.new_page()
    errs = []
    bad_http = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.on("console", lambda m: errs.append(f"console:{m.type}:{m.text}") if (m.type == "error" and "Failed to load resource" not in m.text) else None)
    page.on("response", lambda r: bad_http.append(f"{r.status} {r.url}") if (r.status >= 400 and "/api/" not in r.url) else None)

    onboard(page)
    page.wait_for_timeout(1500)
    banner = page.locator("[data-install-banner]")
    if banner.count():
        banner.click()
        page.wait_for_timeout(900)
        page.keyboard.press("Escape")
        page.wait_for_timeout(600)

    def nav(name):
        page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name=name).click()
        page.wait_for_timeout(1200)

    # ---------------- 1. 퀴즈 소개 화면 — 문구·정렬 ----------------
    nav("퀴즈")
    page.wait_for_timeout(800)
    body = page.locator("body").inner_text()
    if "하루 3문제는 점수에 들어가요" in body:
        problems.append("안내 문구가 아직 남아 있음")
    if "초성 · 옛날 노래 · 틀린 그림 · OX · 넌센스" in body:
        problems.append("파란 박스 장르 나열이 아직 남아 있음")
    if body.count("지금 318문제가") or re.search(r"지금 \d+문제가 준비돼 있어요", body):
        # 위쪽 헤더의 배지는 남기고, 주제 영역 배지만 지웠는지 확인
        header_bank = page.evaluate(
            "() => Array.from(document.querySelectorAll('[data-quiz-bank]')).length"
        )
        if header_bank != 1:
            problems.append(f"문제 수 배지 개수가 1개가 아님: {header_bank}")
    if "점수와 상관없이 좋아하는 주제로 3문제를 풀어" in body:
        problems.append("주제 안내 문구가 3문제 그대로임")
    if "계속 풀어 볼 수 있어요" not in body:
        problems.append("주제 안내 문구(계속 풀어) 없음")
    if "섞어서 3문제" in body:
        problems.append("‘섞어서 3문제’ 라벨이 남아 있음")

    # 2열 정렬 확인 — 6개 버튼이 3행 2열로 같은 x 좌표 두 개만 쓰는지
    grid = page.evaluate(
        """() => {
          const els = Array.from(document.querySelectorAll("[data-quiz-topic]"));
          const rects = els.map(e => { const r = e.getBoundingClientRect(); return {k: e.getAttribute("data-quiz-topic"), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)}; });
          const cols = [...new Set(rects.map(r => r.x))];
          const rows = [...new Set(rects.map(r => r.y))];
          return { n: els.length, cols, rows, rects };
        }"""
    )
    print("주제 버튼 배치:", grid["n"], "개 · 열", len(grid["cols"]), "행", len(grid["rows"]))
    if grid["n"] != 6:
        problems.append(f"주제 버튼 6개가 아님: {grid['n']}")
    if len(grid["cols"]) != 2:
        problems.append(f"2열 정렬이 아님: 열 x좌표 {grid['cols']}")
    if len(grid["rows"]) != 3:
        problems.append(f"3행 정렬이 아님: 행 y좌표 {grid['rows']}")
    labels = [r["k"] for r in grid["rects"]]
    print("순서:", labels)

    for label, font_label in [("보통", None), ("크게", "크게"), ("아주 크게", "아주 크게")]:
        info = overflow_info(page)
        if info["over"] or info["scrollW"] > info["clientW"] + 1:
            problems.append(f"[{label}] 소개 화면 가로 넘침 {info['over']} ({info['scrollW']}>{info['clientW']})")
        if info["topicOver"]:
            problems.append(f"[{label}] 주제 버튼 잘림 {info['topicOver']}")
        page.evaluate("window.scrollTo(0,0)")
        page.wait_for_timeout(300)
        page.screenshot(path=f"{OUT}/_quiz_intro_{label.replace(' ', '_')}.png")
        page.locator("[data-quiz-topics]").scroll_into_view_if_needed()
        page.wait_for_timeout(300)
        page.screenshot(path=f"{OUT}/_quiz_topics_{label.replace(' ', '_')}.png")
        if label != "아주 크게":
            page.get_by_role("button", name="글씨 크기 바꾸기 — 지금", exact=False).click()
            page.wait_for_timeout(600)
    # 글씨 크기를 보통으로 되돌린다
    page.get_by_role("button", name="글씨 크기 바꾸기 — 지금", exact=False).click()
    page.wait_for_timeout(600)

    # ---------------- 2. 무한 연습 (OX 주제) ----------------
    def play_answers(n, topic):
        seen = []
        for i in range(n):
            page.wait_for_selector("[data-quiz-option]", timeout=15000)
            prompt = page.evaluate(
                """() => {
                  const card = document.querySelector("[data-quiz-option]").closest("div");
                  return document.body.innerText.slice(0, 4000);
                }"""
            )
            header = page.evaluate(
                """() => {
                  const s = document.querySelector("[data-quiz-solved]");
                  const bar = s ? s.parentElement : null;
                  return bar ? bar.innerText.replace(/\\n/g, " | ") : "";
                }"""
            )
            seen.append(header)
            page.locator("[data-quiz-option]").first.click()
            page.wait_for_timeout(250)
            page.get_by_role("button", name=re.compile("정답 확인")).click()
            page.wait_for_timeout(400)
            page.get_by_role("button", name=re.compile("^다음 문제$|연습 결과 보기|결과 보기")).first.click()
            page.wait_for_timeout(500)
            if i == 0:
                page.evaluate("window.scrollTo(0,0)")
                page.wait_for_timeout(300)
                page.screenshot(path=f"{OUT}/_quiz_endless_{topic}.png")
        return seen

    page.locator("[data-quiz-topic='ox']").first.click()
    page.wait_for_timeout(1200)
    body = page.locator("body").inner_text()
    if "무한 연습" not in body:
        problems.append("무한 연습 표시가 없음")
    if "그만 풀기" not in body:
        problems.append("그만 풀기 버튼이 없음")
    if not page.locator("[data-quiz-stop]").count():
        problems.append("[data-quiz-stop] 없음")

    headers = play_answers(6, "ox")
    print("진행 표시:", headers)
    if not any("6문제째" in h for h in headers):
        problems.append(f"6문제째까지 진행되지 않음: {headers}")
    if not any("무한 연습" in h for h in headers):
        problems.append("진행 표시에 무한 연습이 없음")
    if any("연습 결과 보기" in h for h in headers):
        problems.append("3문제에서 끝나 버림")
    solved = page.inner_text("[data-quiz-solved]")
    print("정답 표시:", solved)
    if "정답" not in solved:
        problems.append("정답 개수 표시 없음")

    # 그만 풀기 → 결과 화면
    page.locator("[data-quiz-stop]").first.click()
    page.wait_for_timeout(1200)
    body = page.locator("body").inner_text()
    print("그만 풀기 결과:", [l for l in body.split("\n") if "연습" in l or "문제를 풀었" in l][:5])
    if "무한 연습 결과" not in body:
        problems.append("무한 연습 결과 화면이 아님")
    if "6문제를 풀었어요" not in body:
        problems.append("푼 문제 수(6)가 결과에 없음")
    page.screenshot(path=f"{OUT}/_quiz_endless_result.png")
    page.get_by_role("button", name=re.compile("퀴즈 홈으로 돌아가기")).click()
    page.wait_for_timeout(900)
    if "주제 골라 바로 풀기" not in page.locator("body").inner_text():
        problems.append("퀴즈 홈으로 돌아오지 못함")

    # ---------------- 3. 섞어서 풀기 — 4문제 연속 ----------------
    page.locator("[data-quiz-topic='mix']").first.click()
    page.wait_for_timeout(1200)
    headers = play_answers(4, "mix")
    print("섞어서 진행:", headers[-1] if headers else "없음")
    if not headers or "4문제째" not in headers[-1]:
        problems.append(f"섞어서 풀기가 4문제까지 이어지지 않음: {headers}")
    page.locator("[data-quiz-stop]").first.click()
    page.wait_for_timeout(900)
    page.get_by_role("button", name=re.compile("퀴즈 홈으로 돌아가기")).click()
    page.wait_for_timeout(800)

    # ---------------- 4. 랭킹 — 영역 개편 · 연령대 삭제 · 통합 카드 ----------------
    nav("랭킹")
    page.wait_for_timeout(2000)
    page.evaluate("window.scrollTo(0,0)")
    page.wait_for_timeout(500)

    tabs = page.evaluate(
        "() => Array.from(document.querySelectorAll('[data-area-tab]')).map(e => [e.getAttribute('data-area-tab'), e.innerText.replace(/\\n/g, ' ').trim()])"
    )
    keys = [t[0] for t in tabs]
    labels = " ".join(t[1] for t in tabs)
    print("영역 탭:", tabs)
    if sorted(keys) != sorted(["all", "brain", "attend", "group", "share", "save"]):
        problems.append(f"영역 카드 구성이 다름: {keys}")
    for need in ["퀴즈왕", "출석왕", "모임왕", "초대왕", "지식왕"]:
        if need not in labels:
            problems.append(f"영역 이름 없음: {need}")
    for gone in ["기억왕", "건강왕", "나눔왕", "알뜰왕"]:
        if gone in labels:
            problems.append(f"옛 영역 이름이 남음: {gone}")

    ranges = page.evaluate(
        "() => Array.from(document.querySelectorAll('[data-range-tab]')).map(e => e.getAttribute('data-range-tab'))"
    )
    print("범위 탭:", ranges)
    if ranges != ["group", "region", "national"]:
        problems.append(f"범위 탭 구성이 다름: {ranges}")
    if page.evaluate("() => !!document.querySelector('[data-age-bands]')") or "age" in ranges:
        problems.append("연령대 탭/칩이 남아 있음")
    if "연령대" in page.locator("body").inner_text():
        problems.append("화면에 연령대 문구가 남아 있음")

    card = page.evaluate(
        """() => {
          const el = document.querySelector("[data-grade-card]");
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const next = document.querySelector("[data-grade-next-text]");
          const btn = document.querySelector("[data-badge-open]");
          const me = document.querySelector("[data-rank-me]");
          const gap = document.querySelector("[data-rank-gap]");
          return {
            h: Math.round(r.height), w: Math.round(r.width),
            text: el.innerText.replace(/\\n/g, " | "),
            nextText: next ? next.innerText : "",
            badgeBtn: btn ? btn.innerText.replace(/\\n/g, " ") : "",
            me: me ? me.getAttribute("data-rank-me") : null,
            gap: gap ? gap.innerText : "",
            sameCard: el === me,
          };
        }"""
    )
    print("통합 카드:", card)
    if not card:
        problems.append("통합 카드(내 순위+등급)가 없음")
    else:
        if not card["sameCard"]:
            problems.append("내 순위와 등급이 한 카드가 아님")
        if card["h"] > 260:
            problems.append(f"통합 카드가 아직 큼: {card['h']}px")
        for need in ["내 순위", "내 ", "등급까지"]:
            if need not in card["text"]:
                problems.append(f"통합 카드에 '{need}' 없음: {card['text']}")
        if not card["badgeBtn"]:
            problems.append("배지 컬렉션 버튼 없음")
        clipped = page.evaluate(
            """() => Array.from(document.querySelectorAll("[data-grade-card] *"))
                 .filter(el => el.children.length === 0 && (el.innerText || "").trim().length > 0)
                 .filter(el => el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0)
                 .slice(0, 5)
                 .map(el => (el.innerText || "").trim().slice(0, 20))"""
        )
        if clipped:
            problems.append(f"히어로 카드 안에서 글자가 넘침: {clipped}")
        if not card["gap"]:
            problems.append("격차 안내 없음")

    first = page.evaluate(
        """() => {
          const tabs = document.querySelectorAll("[data-area-tab]");
          const ranges = document.querySelectorAll("[data-range-tab]");
          const vh = window.innerHeight;
          const last = tabs[tabs.length - 1];
          return {
            areas: tabs.length,
            lastAreaBottom: last ? Math.round(last.getBoundingClientRect().bottom) : 0,
            lastRangeBottom: ranges.length ? Math.round(ranges[ranges.length-1].getBoundingClientRect().bottom) : 0,
            vh,
          };
        }"""
    )
    print("첫 화면 배치:", first)
    hero = page.evaluate(
        """() => {
          const ribbon = document.querySelector("[data-my-rank-ribbon]");
          const card = document.querySelector("[data-grade-card]");
          const cells = card ? Array.from(card.querySelectorAll(":scope > div")).length : 0;
          const text = card ? card.innerText.replace(/\\n/g, " | ") : "";
          const cards = Array.from(document.querySelectorAll("[data-area-card]")).map(e => e.getAttribute("data-area-card"));
          return { ribbon: ribbon ? ribbon.innerText : "", text, cards, cells };
        }"""
    )
    print("히어로:", hero)
    if not hero["ribbon"]:
        problems.append("히어로 카드의 순위 리본이 없음")
    for need in ["이번 주 포인트", "연속 출석", "내 등급·배지"]:
        if need not in hero["text"]:
            problems.append(f"3분할 요약에 '{need}' 없음")
    if sorted(hero["cards"]) != sorted(["brain", "attend", "group", "share", "save", "all"]):
        problems.append(f"분야 카드가 6개(5분야+늘봄왕)가 아님: {hero['cards']}")
    # 분야 카드를 누르면 순위표가 그 분야로 바뀌는지
    page.locator("[data-area-card='brain']").first.click()
    page.wait_for_timeout(1200)
    board_area = page.evaluate(
        "() => { const b = document.querySelector('[data-area-board]'); return b ? b.getAttribute('data-area-board') : null; }"
    )
    print("분야 카드 → 순위표:", board_area)
    if board_area != "brain":
        problems.append(f"분야 카드를 눌러도 순위표가 바뀌지 않음: {board_area}")
    head = page.inner_text("[data-area-board-anchor]")
    if "퀴즈왕" not in head:
        problems.append(f"순위표 제목이 분야와 다름: {head}")
    page.screenshot(path=f"{OUT}/_ranking_area_brain.png")
    page.locator("[data-area-card='all']").first.click()
    page.wait_for_timeout(1000)
    page.evaluate("window.scrollTo(0,0)")
    page.wait_for_timeout(400)
    page.screenshot(path=f"{OUT}/neulbom_ranking_simple.png")
    page.locator("[data-grade-card]").scroll_into_view_if_needed()
    page.wait_for_timeout(500)
    page.screenshot(path=f"{OUT}/_ranking_mycard.png")

    # 배지 컬렉션 시트가 여전히 열리는지
    page.locator("[data-badge-open]").first.click()
    page.wait_for_timeout(900)
    if not page.locator("[data-badge-sheet]").count():
        problems.append("배지 컬렉션 시트가 열리지 않음")
    page.get_by_role("button", name="닫기").last.click()
    page.wait_for_timeout(700)

    for label in ["보통", "크게", "아주 크게"]:
        page.evaluate("window.scrollTo(0,0)")
        if label != "보통":
            page.get_by_role("button", name="글씨 크기 바꾸기 — 지금", exact=False).click()
            page.wait_for_timeout(700)
        info = overflow_info(page)
        if info["over"] or info["scrollW"] > info["clientW"] + 1:
            problems.append(f"[랭킹 {label}] 가로 넘침 {info['over']}")
        cardh = page.evaluate(
            "() => { const e = document.querySelector('[data-grade-card]'); return e ? Math.round(e.getBoundingClientRect().height) : 0; }"
        )
        print(f"[랭킹 {label}] 통합 카드 높이:", cardh)
        page.screenshot(path=f"{OUT}/_ranking_{label.replace(' ', '_')}.png")

    # ---------------- 5. 모임 탭 — 중복 정리 · 건강 챌린지 삭제 ----------------
    nav("모임")
    page.wait_for_timeout(1800)
    if not page.locator("[data-group-invite-top]").count():
        trial = page.get_by_role("button", name=re.compile("체험 모임 들어가기"))
        if trial.count():
            trial.first.click()
        for _ in range(15):
            page.wait_for_timeout(800)
            if page.locator("[data-group-invite-top]").count():
                break
    page.wait_for_timeout(1200)
    page.evaluate("window.scrollTo(0,0)")
    page.wait_for_timeout(400)
    gtext = page.locator("main").inner_text()
    group_info = page.evaluate(
        """() => {
          const inv = document.querySelectorAll("[data-group-invite-top]");
          const rowInv = document.querySelectorAll("[data-group-row-invite]");
          const cap = document.querySelectorAll("[data-group-capacity]");
          const health = document.querySelectorAll("[data-health-card]");
          const header = inv.length ? inv[0].parentElement : null;
          return {
            topInvite: inv.length,
            headerChildren: header ? header.children.length : 0,
            rowInvite: rowInv.length,
            capacity: cap.length,
            healthCards: health.length,
            today: document.querySelectorAll("[data-group-row][aria-pressed='true']").length,
          };
        }"""
    )
    print("모임 화면:", group_info)
    if group_info["topInvite"] != 1:
        problems.append(f"상단 초대 버튼 개수: {group_info['topInvite']}")
    if group_info["rowInvite"]:
        problems.append("목록 줄 초대 버튼이 아직 있음")
    if "정원 3/" in gtext or re.search(r"정원 \d+/\d+명", gtext):
        problems.append("정원 중복 표시가 남아 있음")
    if group_info["healthCards"]:
        problems.append("모임 탭에 건강 챌린지 카드가 남아 있음")
    if "오늘의 건강 챌린지" in gtext:
        problems.append("모임 탭에 ‘오늘의 건강 챌린지’ 문구가 남아 있음")
    if "체크한 도장은" in page.locator("body").inner_text():
        problems.append("‘체크한 도장은 …’ 안내 문구가 남아 있음")
    page.screenshot(path=f"{OUT}/neulbom_groups_clean.png")

    for label in ["크게", "아주 크게", "보통"]:
        page.get_by_role("button", name="글씨 크기 바꾸기 — 지금", exact=False).click()
        page.wait_for_timeout(700)
        info = overflow_info(page)
        if info["over"] or info["scrollW"] > info["clientW"] + 1:
            problems.append(f"[모임 {label}] 가로 넘침 {info['over']}")
        page.screenshot(path=f"{OUT}/_groups_{label.replace(' ', '_')}.png")

    if errs:
        problems.append(f"오류/콘솔: {errs[:4]}")
    if bad_http:
        problems.append(f"HTTP 오류: {bad_http[:4]}")
    b.close()
httpd.shutdown()
print("\n문제:", len(problems))
for x in problems:
    print("  -", x)
