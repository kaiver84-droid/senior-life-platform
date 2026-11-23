"""늘봄 퀴즈 — 연습 모드(무한 연습 포함)에서 맞힌 문제마다 이번 주 점수가 +1 오르는지 확인.

1) 무한 연습: 정답일 때만 상단 ‘이번 주 N점’이 +1, 오답이면 그대로 + ‘이번 주 점수에 +1점 더했어요’ 표시
2) 무한 연습 결과: 옛 문구(‘점수와 순위에는 들어가지 않아요’)가 없고 ‘이번 연습으로 N점을 더 얻었어요’ 표시
3) 새로고침 뒤에도 점수 유지 · 하루 미션(오늘의 5문제)은 아직 ‘안 함’ 상태
4) 하루 미션을 마치면 연습 점수 위에 미션 점수가 더해져 한 줄(total 5)로 남는지

python3 e2e/check_practice_points.py
"""
import json
import re
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from harness import onboard, start_server  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
OUT = "/workspace/downloads"
OLD = ["점수와 순위에는 들어가지 않아요", "연습 모드는 점수와 순위에 들어가지 않아요", "점수·순위에는 들어가지 않아요"]

httpd = start_server()
problems = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
    if not cond:
        problems.append(label)


def week_points(page):
    return int(page.locator("[data-week-points]").first.get_attribute("data-week-points") or 0)


def answer(page):
    """보기 하나를 고르고 정답 확인 — 정답이었는지 돌려준다."""
    page.wait_for_selector("[data-quiz-option]", timeout=15000)
    page.locator("[data-quiz-option]").first.click()
    page.wait_for_timeout(200)
    page.get_by_role("button", name=re.compile("정답 확인")).click()
    page.wait_for_timeout(450)
    body = page.locator("body").inner_text()
    return "정답이에요" in body


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
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.on(
        "console",
        lambda m: errs.append(f"console:{m.type}:{m.text}")
        if (m.type == "error" and "Failed to load resource" not in m.text)
        else None,
    )

    onboard(page)
    page.wait_for_timeout(1200)
    banner = page.locator("[data-install-banner]")
    if banner.count():
        banner.click()
        page.wait_for_timeout(700)
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)

    def nav(name):
        page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name=name).click()
        page.wait_for_timeout(1200)

    nav("퀴즈")
    page.wait_for_timeout(800)
    check(week_points(page) == 0, "시작 점수 0점", str(week_points(page)))

    # ---------- 1) 무한 연습: 정답마다 +1 ----------
    page.locator("[data-quiz-topic='mix']").first.click()
    page.wait_for_timeout(1200)
    earned = 0
    seen = 0
    for _ in range(10):
        before = week_points(page)
        ok = answer(page)
        after = week_points(page)
        badge = page.locator("[data-practice-point]").count() > 0
        if ok:
            seen += 1
            earned += 1
            check(after == before + 1, f"무한 연습 정답 {seen}번째 — 이번 주 {before}→{after}점", f"badge={badge}")
            check(badge, f"무한 연습 정답 {seen}번째 — ‘+1점’ 안내")
            page.screenshot(path=f"{OUT}/_practice_point_+{earned}.png")
        else:
            check(after == before, f"무한 연습 오답 — 점수 그대로 {before}점", str(after))
            check(not badge, "무한 연습 오답 — ‘+1점’ 안내 없음")
        page.get_by_role("button", name=re.compile("^다음 문제$")).first.click()
        page.wait_for_timeout(500)
        if seen >= 3:
            break

    if seen == 0:
        problems.append("무한 연습에서 정답을 한 번도 못 맞혀 +1 검증 불가")

    page.locator("[data-quiz-stop]").first.click()
    page.wait_for_timeout(1200)
    body = page.locator("body").inner_text()
    print("[무한 연습 결과]", [l for l in body.split("\n") if l.strip()][-6:])
    for phrase in OLD:
        check(phrase not in body, f"옛 문구 삭제: {phrase!r}")
    check("무한 연습 결과" in body, "무한 연습 결과 화면")
    m = re.search(r"이번 연습으로 (\d+)점을 더 얻었어요", body)
    check(bool(m) and int(m.group(1)) == earned, f"결과 안내 점수 = 맞힌 수({earned})", m.group(0) if m else "없음")
    page.screenshot(path=f"{OUT}/_practice_result_endless.png")

    # ---------- 2) 새로고침 뒤에도 점수 유지 · 하루 미션은 아직 안 함 ----------
    page.reload(wait_until="domcontentloaded")
    page.wait_for_timeout(1800)
    banner = page.locator("[data-install-banner]")
    if banner.count():
        banner.click()
        page.wait_for_timeout(600)
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
    nav("퀴즈")
    page.wait_for_timeout(1000)
    check(week_points(page) == earned, f"새로고침 뒤 점수 유지 {earned}점", str(week_points(page)))
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(300)
    body = page.locator("body").inner_text()
    check("퀴즈 시작하기" in body, "하루 미션은 아직 안 한 상태(시작 버튼 보임)")
    stored = json.loads(page.evaluate("() => localStorage.getItem('seniorLife.v1')"))
    logs_today = [q for q in stored["quizLogs"] if q["date"] == page.evaluate("() => new Date(Date.now()+9*3600*1000).toISOString().slice(0,10)")]
    check(len(logs_today) == 1, "오늘 기록이 한 줄", str(len(logs_today)))
    if logs_today:
        q = logs_today[0]
        check(q["total"] == 0, "연습만 했을 때 total 0(하루 미션 아님)", str(q["total"]))
        check(q["points"] == earned, f"저장된 점수 {earned}", str(q["points"]))
        check(q.get("practice") == earned, f"연습으로 맞힌 수 {earned}", str(q.get("practice")))
    page.screenshot(path=f"{OUT}/_practice_after_reload.png")

    # ---------- 3) 하루 미션 완료 → 연습 점수 + 미션 점수 한 줄 ----------
    page.get_by_role("button", name=re.compile("퀴즈 시작하기")).first.click()
    page.wait_for_timeout(1000)
    for i in range(5):
        answer(page)
        btn = page.get_by_role("button", name=re.compile("^다음 문제$|^결과 보기$")).first
        btn.click()
        page.wait_for_timeout(600)
    page.wait_for_timeout(800)
    body = page.locator("body").inner_text()
    check("오늘의 퀴즈 결과" in body, "하루 미션 결과 화면")
    m = re.search(r"획득 (\d+)점", body)
    mission_points = int(m.group(1)) if m else -1
    print("[하루 미션]", m.group(0) if m else "획득 점수 없음")
    stored = json.loads(page.evaluate("() => localStorage.getItem('seniorLife.v1')"))
    today = page.evaluate("() => new Date(Date.now()+9*3600*1000).toISOString().slice(0,10)")
    logs_today = [q for q in stored["quizLogs"] if q["date"] == today]
    check(len(logs_today) == 1, "하루 미션 뒤에도 오늘 기록 한 줄", str(len(logs_today)))
    if logs_today and mission_points >= 0:
        q = logs_today[0]
        check(q["total"] == 5, "하루 미션 total 5", str(q["total"]))
        check(q["points"] == earned + mission_points, f"누적 점수 {earned}+{mission_points}", str(q["points"]))
    page.screenshot(path=f"{OUT}/_practice_after_daily.png")

    # ---------- 4) 하루 미션 결과의 연습 안내 문구 ----------
    practice_btn = page.get_by_role("button", name=re.compile("연습 모드 시작하기"))
    check(practice_btn.count() > 0, "결과 화면에 연습 모드 버튼")
    body = page.locator("body").inner_text()
    check("점수·순위에는 들어가지 않아요" not in body, "결과 화면 연습 카드 옛 문구 삭제")
    check("맞힌 문제마다 1점씩 이번 주 점수에 더해져요" in body, "결과 화면 연습 카드 새 안내")

    # 연습 모드(3문제) 결과 문구
    if practice_btn.count():
        before = week_points(page)
        practice_btn.first.click()
        page.wait_for_timeout(1200)
        got = 0
        for i in range(3):
            before = week_points(page)
            if answer(page):
                got += 1
                check(week_points(page) == before + 1, f"연습 모드 정답 {got}번째 +1", str(week_points(page) - before))
            page.get_by_role("button", name=re.compile("^다음 문제$|연습 결과 보기")).first.click()
            page.wait_for_timeout(600)
        page.wait_for_timeout(600)
        body = page.locator("body").inner_text()
        print("[연습 모드 결과]", [l for l in body.split("\n") if l.strip()][-6:])
        for phrase in OLD:
            check(phrase not in body, f"연습 결과 옛 문구 삭제: {phrase!r}")
        check("연습 모드 결과" in body, "연습 모드 결과 화면")
        if got:
            check(f"이번 연습으로 {got}점을 더 얻었어요" in body, f"연습 결과 안내 {got}점")
        page.screenshot(path=f"{OUT}/_practice_result_set.png")

    if errs:
        problems.append(f"콘솔/페이지 오류 {len(errs)}건: {errs[:5]}")
    b.close()

httpd.shutdown()
print("\n결과:", "통과" if not problems else "문제 있음")
for prob in problems:
    print(" -", prob)
sys.exit(1 if problems else 0)
