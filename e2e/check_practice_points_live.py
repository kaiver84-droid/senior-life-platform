"""늘봄 라이브 — 연습 모드 정답 +1점이 화면·서버(quiz_logs)·새로고침 뒤에도 유지되는지 확인.

카카오 인가만 스텁으로 흉내 내고 페이지·API·Supabase 는 라이브 그대로 쓴다.
끝나면 테스트 계정을 DB 에서 지운다.

BASE=https://senior-life-platform.pages.dev python3 e2e/check_practice_points_live.py
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

ROOT = "/workspace/work/senior-platform"
BASE = os.environ.get("BASE", "https://senior-life-platform.pages.dev").rstrip("/")
SHOT = "/workspace/downloads"
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")

TOKEN = open(f"{ROOT}/.supabase_token").read().strip()
URL = [l.split("=", 1)[1].strip() for l in open(f"{ROOT}/.env.integrations") if l.startswith("NEXT_PUBLIC_SUPABASE_URL")][0]
PROJECT = URL.split("//")[1].split(".")[0]

ID_T, NAME_T = "777011024", "연습점검"


def js_make_code(seed: str) -> str:
    h = -2128831035

    def i32(x):
        x &= 0xFFFFFFFF
        return x - 0x100000000 if x >= 0x80000000 else x

    for ch in seed:
        h = i32(h ^ ord(ch))
        h = i32(h * 16777619)
    n = h & 0xFFFFFFFF
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    out = ""
    while n:
        n, r = divmod(n, 36)
        out = digits[r] + out
    out = (out or "0").upper()
    return out[-6:].rjust(6, "0")


CODE_T = js_make_code(f"kakao_{ID_T}")
problems = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
    if not cond:
        problems.append(label)


def sql(query):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT}/database/query",
        data=json.dumps({"query": query}).encode(),
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=40) as res:
        return json.loads(res.read() or b"[]")


def cleanup():
    for q in [
        f"delete from public.quiz_logs where user_code = '{CODE_T}';",
        f"delete from public.daily_visits where user_code = '{CODE_T}';",
        f"delete from public.med_checks where user_code = '{CODE_T}';",
        f"delete from public.health_checks where user_code = '{CODE_T}';",
        f"delete from public.activity_logs where user_code = '{CODE_T}';",
        f"delete from public.family_events where user_code = '{CODE_T}';",
        f"delete from public.group_members where user_code = '{CODE_T}';",
        f"delete from public.users where code = '{CODE_T}';",
    ]:
        try:
            sql(q)
        except Exception:  # noqa: BLE001
            pass


def api_get(path):
    req = urllib.request.Request(
        BASE + path,
        headers={"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"},
    )
    with urllib.request.urlopen(req, timeout=40) as res:
        return json.loads(res.read())


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
                            "birthYear": 0,
                            "source": "kakao",
                            "createdAt": "2026-11-23T00:00:00.000Z",
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
    page.on("pageerror", lambda e: errs.append(f"pageerror:{e}"))
    page.on(
        "console",
        lambda m: errs.append(f"console:{m.type}:{m.text}")
        if (m.type == "error" and "Failed to load resource" not in m.text)
        else None,
    )
    page.on("response", lambda r: bad_http.append(f"{r.status} {r.url}") if r.status >= 400 and "/api/" not in r.url else None)
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
    banner = page.locator("[data-install-banner]")
    if banner.count():
        banner.click()
        page.wait_for_timeout(700)
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)

    def nav(name):
        page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name=name).click()
        page.wait_for_timeout(1400)

    def week_points():
        return int(page.locator("[data-week-points]").first.get_attribute("data-week-points") or 0)

    def answer():
        page.wait_for_selector("[data-quiz-option]", timeout=15000)
        page.locator("[data-quiz-option]").first.click()
        page.wait_for_timeout(200)
        page.get_by_role("button", name=re.compile("정답 확인")).click()
        page.wait_for_timeout(450)
        return "정답이에요" in page.locator("body").inner_text()

    nav("퀴즈")
    page.wait_for_timeout(900)
    check(week_points() == 0, "시작 점수 0점", str(week_points()))

    page.locator("[data-quiz-topic='mix']").first.click()
    page.wait_for_timeout(1300)
    earned = 0
    tries = 0
    while earned < 2 and tries < 12:
        tries += 1
        before = week_points()
        ok = answer()
        if ok:
            earned += 1
            check(week_points() == before + 1, f"라이브 정답 {earned}번째 +1", f"{before}→{week_points()}")
            check(page.locator("[data-practice-point]").count() > 0, "‘+1점’ 안내 표시")
        else:
            check(week_points() == before, "라이브 오답 — 점수 그대로", str(week_points()))
        page.screenshot(path=f"{SHOT}/_live_practice_point_{earned}.png")
        page.get_by_role("button", name=re.compile("^다음 문제$")).first.click()
        page.wait_for_timeout(450)

    page.wait_for_timeout(3500)
    rows = sql(f"select quiz_date, week_id, correct, total, points from public.quiz_logs where user_code = '{CODE_T}'")
    print("서버 quiz_logs:", rows)
    check(len(rows) == 1, "서버에 오늘 기록 한 줄", str(len(rows)))
    if rows:
        check(int(rows[0]["points"]) == earned, f"서버 points = {earned}", str(rows[0]["points"]))
        check(int(rows[0]["total"]) == 0, "서버 total 0 (하루 미션 아님)", str(rows[0]["total"]))

    # 연습 결과 문구
    page.locator("[data-quiz-stop]").first.click()
    page.wait_for_timeout(1200)
    body = page.locator("body").inner_text()
    for phrase in ("점수와 순위에는 들어가지 않아요", "연습 모드는 점수와 순위에 들어가지 않아요", "점수·순위에는 들어가지 않아요"):
        check(phrase not in body, f"옛 문구 삭제: {phrase!r}")
    check(f"이번 연습으로 {earned}점을 더 얻었어요" in body, f"결과 안내 {earned}점")
    page.screenshot(path=f"{SHOT}/_live_practice_result.png")

    # 늘봄왕 — 연습만 한 날은 출석 10점만
    st = api_get(f"/api/state?code={CODE_T}")
    log = st["state"]["quizLogs"][0]
    rank = api_get(
        f"/api/rankings?area=all&scope=national&weekId={urllib.parse.quote(log['weekId'])}"
        f"&code={CODE_T}&today={log['date']}&band=70&visible=1"
    )
    me = next((r for r in rank.get("rows", []) if r.get("isMe")), None)
    print("늘봄왕 내 줄:", me)
    check(bool(me) and int(me["points"]) == 10, "연습만 한 날 늘봄왕 = 10점", str(me and me["points"]))

    # 새로고침 — 서버에서 다시 받아도 점수 유지
    page.reload(wait_until="domcontentloaded")
    page.wait_for_timeout(3000)
    banner = page.locator("[data-install-banner]")
    if banner.count():
        banner.click()
        page.wait_for_timeout(600)
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
    nav("퀴즈")
    page.wait_for_timeout(1400)
    check(week_points() == earned, f"라이브 새로고침 뒤 점수 {earned}", str(week_points()))
    body = page.locator("body").inner_text()
    check("퀴즈 시작하기" in body, "하루 미션은 아직 안 한 상태")
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(400)
    page.screenshot(path=f"{SHOT}/_live_practice_after_reload.png")

    if errs:
        problems.append(f"콘솔/페이지 오류 {len(errs)}건: {errs[:5]}")
    if bad_http:
        problems.append(f"4xx/5xx {len(bad_http)}건: {bad_http[:5]}")
    b.close()

cleanup()
print("\n결과:", "통과" if not problems else "문제 있음")
for prob in problems:
    print(" -", prob)
sys.exit(1 if problems else 0)
