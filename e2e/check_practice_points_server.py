"""늘봄 — 연습 모드 +1점이 서버(Supabase quiz_logs)까지 저장되는지 확인.

로컬 빌드(out/) + 같은 핸들러를 돌리는 로컬 API(e2e/local-api.ts → 실제 Supabase)로:
1) 무한 연습에서 2문제를 맞히면 quiz_logs 오늘 줄이 points 2 · total 0 으로 서버에 남는지
2) 새로고침(서버에서 다시 받아오기) 뒤에도 점수가 그대로인지
3) 연습만 한 날은 늘봄왕 하루 점수에 퀴즈 30점이 붙지 않는지(출석 10점만)
4) 하루 미션까지 마치면 같은 줄이 total 5 · points(연습+미션) 로 올라가는지
끝나면 테스트 계정 데이터를 DB 에서 지운다.

python3 e2e/check_practice_points_server.py
"""
import json
import os
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, "/workspace/work/senior-platform/e2e")

NODE = "/workspace/work/.tools/node-v20.18.0-linux-x64/bin/node"
ROOT = "/workspace/work/senior-platform"
CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
SHOT = "/workspace/downloads"

PROJECT = "aaslirekynetqguajkpv"
SUPA_TOKEN = open(f"{ROOT}/.supabase_token").read().strip()
TEST_ID = "777011023"
TEST_NAME = "연습점검"


def sql(query):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT}/database/query",
        data=json.dumps({"query": query}).encode(),
        headers={"Authorization": f"Bearer {SUPA_TOKEN}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=40) as res:
        return json.loads(res.read() or b"[]")


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


CODE = js_make_code(f"kakao_{TEST_ID}")

problems = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
    if not cond:
        problems.append(label)


def env_file(path):
    env = {}
    for line in open(path):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def cleanup():
    for q in [
        f"delete from public.quiz_logs where user_code = '{CODE}';",
        f"delete from public.daily_visits where user_code = '{CODE}';",
        f"delete from public.med_checks where user_code = '{CODE}';",
        f"delete from public.health_checks where user_code = '{CODE}';",
        f"delete from public.activity_logs where user_code = '{CODE}';",
        f"delete from public.family_events where user_code = '{CODE}';",
        f"delete from public.users where code = '{CODE}';",
    ]:
        try:
            sql(q)
        except Exception as e:  # noqa: BLE001
            print("cleanup skip:", str(e)[:80])


def server_log():
    return sql(f"select quiz_date, week_id, correct, total, points from public.quiz_logs where user_code = '{CODE}'")


def get_state():
    with urllib.request.urlopen(f"http://127.0.0.1:8099/api/state?code={CODE}", timeout=25) as res:
        return json.loads(res.read())


cleanup()

api_env = dict(os.environ)
api_env.update(env_file(f"{ROOT}/.env.integrations"))
api_env["PORT"] = "8098"
subprocess.run(
    ["npx", "--yes", "esbuild@0.24.0", "e2e/local-api.ts", "--bundle", "--format=esm", "--platform=node", "--outfile=e2e/.local-api.mjs"],
    cwd=ROOT,
    env={**os.environ, "PATH": "/workspace/work/.tools/node-v20.18.0-linux-x64/bin:" + os.environ.get("PATH", "")},
    check=True,
    capture_output=True,
)
api = subprocess.Popen([NODE, "e2e/.local-api.mjs"], cwd=ROOT, env=api_env)
time.sleep(1.5)

os.environ["STUB_KAKAO_ID"] = TEST_ID
os.environ["STUB_KAKAO_NAME"] = TEST_NAME
os.environ["STUB_KAKAO_YEAR"] = "1952"
from stub_api import start_server  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

httpd = start_server()
BASE = "http://127.0.0.1:8099"

try:
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
            lambda m: errs.append(f"{m.type}:{m.text}")
            if (m.type == "error" and "Failed to load resource" not in m.text)
            else None,
        )

        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
        page.get_by_role("button", name="카카오톡으로 시작하기").click()
        page.wait_for_selector("#setup-nick", timeout=30000)
        page.fill("#setup-nick", TEST_NAME)
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
        page.wait_for_timeout(800)
        check(week_points() == 0, "시작 점수 0점", str(week_points()))

        page.locator("[data-quiz-topic='mix']").first.click()
        page.wait_for_timeout(1200)
        earned = 0
        tries = 0
        while earned < 2 and tries < 12:
            tries += 1
            before = week_points()
            ok = answer()
            if ok:
                earned += 1
                check(week_points() == before + 1, f"정답 {earned}번째 +1 (화면)", f"{before}→{week_points()}")
            page.get_by_role("button", name=re.compile("^다음 문제$")).first.click()
            page.wait_for_timeout(450)
        page.wait_for_timeout(3500)  # 1.2초 디바운스 + 저장
        rows = server_log()
        print("서버 quiz_logs:", rows)
        check(len(rows) == 1, "서버에 오늘 기록 한 줄", str(len(rows)))
        if rows:
            r = rows[0]
            check(int(r["points"]) == earned, f"서버 points = {earned}", str(r["points"]))
            check(int(r["total"]) == 0, "서버 total 0 (하루 미션 아님)", str(r["total"]))
            check(int(r["correct"]) == 0, "서버 correct 0 (미션 정답 수)", str(r["correct"]))

        # 늘봄왕 하루 점수 — 연습만 했으니 출석 10점만 (퀴즈 미션 30점이 붙으면 40점)
        with urllib.request.urlopen(
            f"http://127.0.0.1:8099/api/rankings?area=all&scope=national&weekId="
            f"{urllib.parse.quote(get_state()['state']['quizLogs'][0]['weekId'])}&code={CODE}&today="
            f"{get_state()['state']['quizLogs'][0]['date']}&band=70&visible=1",
            timeout=40,
        ) as res:
            ranking = json.loads(res.read())
        me = next((r for r in ranking.get("rows", []) if r.get("isMe")), None)
        print("늘봄왕 내 줄:", me)
        check(bool(me), "늘봄왕 순위표에 내 줄")
        if me:
            check(int(me.get("points", -1)) == 10, "연습만 한 날 늘봄왕 = 출석 10점", str(me.get("points")))

        # 새로고침 → 서버에서 다시 받아도 점수 유지
        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(2600)
        banner = page.locator("[data-install-banner]")
        if banner.count():
            banner.click()
            page.wait_for_timeout(600)
            page.keyboard.press("Escape")
            page.wait_for_timeout(400)
        nav("퀴즈")
        page.wait_for_timeout(1200)
        check(week_points() == earned, f"새로고침(서버 동기화) 뒤 점수 {earned}", str(week_points()))
        page.screenshot(path=f"{SHOT}/_practice_server_after_reload.png")

        # 하루 미션 완료 → 같은 줄에 미션 점수 합산
        page.get_by_role("button", name=re.compile("퀴즈 시작하기")).first.click()
        page.wait_for_timeout(1000)
        for i in range(5):
            answer()
            page.get_by_role("button", name=re.compile("^다음 문제$|^결과 보기$")).first.click()
            page.wait_for_timeout(550)
        page.wait_for_timeout(600)
        m = re.search(r"획득 (\d+)점", page.locator("body").inner_text())
        mission_points = int(m.group(1)) if m else -1
        page.wait_for_timeout(3500)
        rows = server_log()
        print("하루 미션 뒤 서버 quiz_logs:", rows)
        check(len(rows) == 1, "하루 미션 뒤에도 서버 한 줄", str(len(rows)))
        if rows and mission_points >= 0:
            r = rows[0]
            check(int(r["total"]) == 5, "서버 total 5 (하루 미션 완료)", str(r["total"]))
            check(int(r["points"]) == earned + mission_points, f"서버 points {earned}+{mission_points}", str(r["points"]))
        page.screenshot(path=f"{SHOT}/_practice_server_after_daily.png")

        if errs:
            problems.append(f"콘솔/페이지 오류 {len(errs)}건: {errs[:5]}")
        b.close()
finally:
    httpd.shutdown()
    api.terminate()
    cleanup()

print("\n결과:", "통과" if not problems else "문제 있음")
for prob in problems:
    print(" -", prob)
sys.exit(1 if problems else 0)
