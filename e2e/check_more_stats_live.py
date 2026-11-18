"""라이브(https://senior-life-platform.pages.dev)에서 더보기 탭 ‘늘봄 현황’ 카드 확인.

390×844 · 보통/아주 크게 두 단계에서 숫자·넘침을 확인하고 `downloads/neulbom_more_stats.png` 로 남긴다.
검증용 임시 계정은 이 스크립트가 Supabase 에서 지운다(마지막 단계).

python3 e2e/check_more_stats_live.py
"""
import json
import os
import sys
import time
import urllib.request

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
BASE = "https://senior-life-platform.pages.dev"
OUT = "/workspace/downloads"
NICK = "통계테스트"
PROFILE_ID = f"e2e_stats_{int(time.time())}"

env = {}
with open("/workspace/work/senior-platform/.env.integrations") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k] = v
SB_URL = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
SB_KEY = env["SUPABASE_SERVICE_ROLE_KEY"]


def sb(path, method="GET", body=None, prefer="return=minimal"):
    req = urllib.request.Request(
        f"{SB_URL}/rest/v1/{path}",
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "apikey": SB_KEY,
            "Authorization": f"Bearer {SB_KEY}",
            "Content-Type": "application/json",
            "Prefer": prefer,
        },
    )
    with urllib.request.urlopen(req, timeout=20) as res:
        raw = res.read().decode()
        return json.loads(raw) if raw else None


SEED = """
(() => {
  window.localStorage.setItem("seniorLife.v1", JSON.stringify({
    version: 1,
    profile: {
      id: "%s", nickname: "%s", birthYear: 1952, birthTime: "묘시",
      sido: "충청북도", sigungu: "옥천군", createdAt: new Date().toISOString(),
      source: "demo", profileCompleted: true,
    },
    quizLogs: [], daily: null, med: {}, visits: [], familyEvents: [],
    health: {}, missions: {}, rankingVisible: true, fontSize: 18, lastVisit: "",
  }));
})();
""" % (PROFILE_ID, NICK)

problems = []
code_box = {"code": ""}


def measure(page):
    return page.evaluate(
        """() => {
          const doc = document.documentElement;
          const card = document.querySelector("[data-stats-card]");
          const r = card.getBoundingClientRect();
          const tiles = Array.from(document.querySelectorAll("[data-stat-tile]")).map(el => ({
            kind: el.dataset.statTile,
            text: (el.innerText || "").replace(/\\s+/g, " ").trim(),
            clipped: el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2,
          }));
          const over = Array.from(document.querySelectorAll("main *"))
            .filter(el => el.getBoundingClientRect().right > doc.clientWidth + 1)
            .slice(0, 5)
            .map(el => (el.tagName + "." + (el.className || "")).slice(0, 60));
          return {
            font: getComputedStyle(doc).fontSize,
            card: { top: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
            tiles, over, scrollW: doc.scrollWidth, clientW: doc.clientWidth,
          };
        }"""
    )


try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        ctx = b.new_context(
            viewport={"width": 390, "height": 844}, device_scale_factor=3,
            locale="ko-KR", is_mobile=True, has_touch=True,
        )
        ctx.add_init_script(SEED)
        page = ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))

        # NEULBOM_NO_ACCOUNT=1 이면 서버 저장(POST /api/state)을 막아 임시 계정을 만들지 않는다 —
        # 실제 가입자 수(테스트 계정 없는 숫자) 그대로의 화면을 남길 때 쓴다.
        if os.environ.get("NEULBOM_NO_ACCOUNT") == "1":
            def block_state(route):
                if route.request.method == "POST":
                    route.abort()
                else:
                    route.continue_()
            page.route("**/api/state*", block_state)

        def on_req(req):
            if "/api/state?code=" in req.url and not code_box["code"]:
                code_box["code"] = req.url.split("/api/state?code=")[1].split("&")[0]

        page.on("request", on_req)

        page.goto(f"{BASE}/", wait_until="domcontentloaded")
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=25000)
        page.wait_for_timeout(1200)
        # 첫 방문 안내(앱 설치 배너/시트)가 뜨면 닫는다
        for _ in range(2):
            btn = page.locator("[data-install-banner]")
            if btn.count():
                btn.first.click()
                page.wait_for_timeout(700)
            page.keyboard.press("Escape")
            page.wait_for_timeout(500)

        page.get_by_role("button", name="더보기", exact=True).click()
        page.wait_for_selector("[data-stats-card]", timeout=15000)
        # 숫자가 도착할 때까지(‘—’ 가 아니게 될 때까지) 기다린다
        page.wait_for_function(
            "() => Array.from(document.querySelectorAll('[data-stat-tile]')).every(el => el.innerText.includes('명'))",
            timeout=15000,
        )
        page.wait_for_timeout(400)

        code = code_box["code"]
        print("내 코드:", code)
        api_req = urllib.request.Request(
            f"{BASE}/api/stats?code={code}",
            headers={"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) NeulbomE2E"},
        )
        with urllib.request.urlopen(api_req, timeout=20) as res:
            api = json.loads(res.read().decode())
        print("API:", api)

        info = measure(page)
        print("보통:", info)
        total_text, online_text = (t["text"] for t in info["tiles"])
        if f"{api['totalUsers']:,}명" not in total_text:
            problems.append(f"전체 가입 표시({total_text}) ≠ API({api['totalUsers']})")
        if f"{api['onlineUsers']}명" not in online_text:
            problems.append(f"현재 접속 표시({online_text}) ≠ API({api['onlineUsers']})")
        if info["over"]:
            problems.append(f"가로 넘침 {info['over']}")
        if any(t["clipped"] for t in info["tiles"]):
            problems.append(f"숫자칸 잘림 {info['tiles']}")
        if info["scrollW"] > info["clientW"]:
            problems.append(f"가로 스크롤 {info['scrollW']} > {info['clientW']}")

        os.makedirs(OUT, exist_ok=True)
        page.screenshot(path=f"{OUT}/neulbom_more_stats.png")
        page.screenshot(path=f"{OUT}/_more_stats_live_19px.png")

        # 아주 크게 — 한 줄 유지·넘침 없음
        page.get_by_role("button", name="글씨 크기 바꾸기 — 지금", exact=False).click()
        page.wait_for_timeout(600)
        page.get_by_role("button", name="글씨 크기 바꾸기 — 지금", exact=False).click()
        page.wait_for_timeout(900)
        big = measure(page)
        print("아주 크게:", big)
        if big["over"] or any(t["clipped"] for t in big["tiles"]):
            problems.append(f"아주 크게 넘침/잘림 {big}")
        page.screenshot(path=f"{OUT}/_more_stats_live_25px.png")

        if errs:
            problems.append(f"페이지 오류: {errs[:3]}")
        b.close()
finally:
    # 검증용 임시 계정 정리 — 남은 기록까지 함께 지운다
    if code_box["code"] and os.environ.get("NEULBOM_NO_ACCOUNT") != "1":
        c = code_box["code"]
        for table in ("quiz_logs", "daily_visits", "med_checks", "health_checks", "activity_logs", "family_events"):
            try:
                sb(f"{table}?user_code=eq.{c}", method="DELETE")
            except Exception as e:  # 표가 없거나 열이 다르면 건너뛴다
                print(f"  {table} 정리 건너뜀: {e}")
        try:
            sb(f"group_members?user_code=eq.{c}", method="DELETE")
        except Exception as e:
            print("  group_members 정리 건너뜀:", e)
        sb(f"users?code=eq.{c}", method="DELETE")
        left = sb(f"users?code=eq.{c}&select=code")
        print("정리 후 남은 계정:", left)

print("문제:", len(problems))
for x in problems:
    print("  ", x)
sys.exit(1 if problems else 0)
