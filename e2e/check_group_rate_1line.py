"""늘봄 ‘이번 주 달성률’ 한 줄 검증 — 390×844, 글씨 보통/크게/아주 크게.

모임 화면 부제 · 달성률 게이지 · 홈 모임 카드의 `이번 주 참여율`이
중간에서 끊기지 않고 한 줄(같은 y, scrollWidth <= clientWidth)인지 확인한다.

로컬: python3 e2e/check_group_rate_1line.py
라이브: BASE=https://senior-life-platform.pages.dev python3 e2e/check_group_rate_1line.py
       (라이브는 카카오 인가만 스텁으로 흉내 내고, 끝나면 임시 계정 행을 DB 에서 지운다)
"""
import json
import os
import re
import sys
import urllib.request

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", "").rstrip("/")
LIVE = bool(BASE)
SHOT = "/workspace/downloads"
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")
NICK = "달성률점검"

MEASURE = """
() => {
  const doc = document.documentElement;
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = Array.from(range.getClientRects()).filter((x) => x.width > 0.5 && x.height > 0.5);
    const tops = Array.from(new Set(rects.map((x) => Math.round(x.top))));
    return {
      text: (el.textContent || '').trim(),
      w: Math.round(r.width),
      h: Math.round(r.height),
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      scrollW: el.scrollWidth,
      clientW: el.clientWidth,
      font: cs.fontSize,
      ws: cs.whiteSpace,
      lines: tops.length,
      overflow: Math.max(0, el.scrollWidth - el.clientWidth),
      right: Math.round(r.right),
    };
  };
  const q = (sel) => document.querySelector(sel);
  const sub = q('[data-weekly-rate="sub"]');
  const gauge = q('[data-weekly-gauge]');
  const home = q('[data-weekly-rate="home"]');
  // 부제 문단(부제 span 의 부모 p) — 줄 수·넘침을 함께 본다
  const subP = sub ? sub.closest('p') : null;
  const gLabel = gauge ? gauge.querySelector('[data-rate-label]') : null;
  const gValue = gauge ? gauge.querySelector('[data-rate-value]') : null;
  const main = q('main');
  const pageOver = Array.from(document.querySelectorAll('main *'))
    .filter((el) => el.getBoundingClientRect().right > doc.clientWidth + 1)
    .slice(0, 6)
    .map((el) => (el.tagName + '.' + (el.className || '')).slice(0, 70));
  return {
    root: getComputedStyle(doc).fontSize,
    viewport: doc.clientWidth,
    scrollW: doc.scrollWidth,
    pageOver,
    sub: box(sub),
    subP: box(subP),
    subPText: subP ? (subP.textContent || '').trim() : '',
    gauge: box(gauge),
    gaugeLabel: box(gLabel),
    gaugeValue: box(gValue),
    home: box(home),
    mainText: main ? (main.textContent || '').slice(0, 120) : '',
  };
}
"""

results = []
errors = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
    results.append(bool(cond))
    if not cond:
        errors.append(label)


# ── 라이브 모드: 임시 카카오 계정 + 뒷정리 ─────────────────────────────
SUPA_TOKEN = ""
PROJECT = "aaslirekynetqguajkpv"
ID_T = "779912342"


def sql(query):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT}/database/query",
        data=json.dumps({"query": query}).encode(),
        headers={"Authorization": f"Bearer {SUPA_TOKEN}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
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


CODE_T = js_make_code(f"kakao_{ID_T}") if LIVE else ""


def cleanup():
    if not LIVE:
        return
    codes = f"'{CODE_T}'"
    for q in [
        f"delete from public.group_cheers where user_code in ({codes});",
        f"delete from public.group_posts where user_code in ({codes});",
        f"delete from public.group_members where user_code in ({codes});",
        f"delete from public.groups where creator_code in ({codes});",
        f"delete from public.quiz_logs where user_code in ({codes});",
        f"delete from public.daily_visits where user_code in ({codes});",
        f"delete from public.med_checks where user_code in ({codes});",
        f"delete from public.health_checks where user_code in ({codes});",
        f"delete from public.family_events where user_code in ({codes});",
        f"delete from public.users where code in ({codes});",
    ]:
        try:
            sql(q)
        except Exception as e:  # noqa: BLE001
            print("  (cleanup skip)", q[:60], e)


def kakao_stub():
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
                            "id": f"kakao_{ID_T}",
                            "nickname": NICK,
                            "birthYear": 1955,
                            "source": "kakao",
                            "createdAt": "2026-11-17T00:00:00.000Z",
                        },
                    }
                ),
            )
        else:
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"ok": True, "supabase": "connected", "kakao": "configured", "kakaoLoginConfigured": True}),
            )

    return handler


def same_line(a, b, tol=3):
    """두 요소의 세로 중심이 같은 줄인지"""
    if not a or not b:
        return False
    return abs((a["top"] + a["bottom"]) / 2 - (b["top"] + b["bottom"]) / 2) <= tol


httpd = None
if LIVE:
    SUPA_TOKEN = open("/workspace/work/senior-platform/.supabase_token").read().strip()
    cleanup()
else:
    from harness import onboard, start_server  # noqa: E402

    httpd = start_server()
    BASE = "http://127.0.0.1:8099"

kept = {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, locale="ko-KR", is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))

    if LIVE:
        page.route("**/api/auth/kakao**", kakao_stub())
        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_selector("text=카카오톡으로 시작하기", timeout=45000)
        page.get_by_role("button", name="카카오톡으로 시작하기").click()
        page.wait_for_selector("#setup-nick", timeout=45000)
        page.fill("#setup-nick", NICK)
        page.select_option("#setup-birth", "1955")
        page.click('[data-birthtime="묘시"]')
        page.select_option("#setup-sido", "충청북도")
        page.select_option("#setup-sigungu", "옥천군")
        page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=45000)
    else:
        onboard(page)
    page.wait_for_timeout(1500)
    ib = page.locator("[data-install-banner]")
    if ib.count():
        ib.click()
        page.wait_for_timeout(500)
        page.keyboard.press("Escape")

    page.get_by_role("navigation").get_by_role("button", name="모임").click()
    page.wait_for_timeout(1200)
    if page.get_by_role("button", name=re.compile("체험 모임 들어가기")).count():
        page.get_by_role("button", name=re.compile("체험 모임 들어가기")).first.click()
        page.wait_for_timeout(3000)
    page.wait_for_timeout(1500)

    names = {19: "보통", 22: "크게", 25: "아주 크게"}
    tag_of = {"보통": "18", "크게": "21", "아주 크게": "24"}
    for step in range(3):
        info = page.evaluate(MEASURE)
        root = int(round(float(info["root"].replace("px", ""))))
        label = names.get(root, f"root {root}")
        print(f"\n[{label}] root {info['root']} viewport {info['viewport']} scrollW {info['scrollW']}")
        print("   sub   ", {k: info["sub"][k] for k in ("text", "w", "font", "lines", "overflow", "ws")} if info["sub"] else None)
        print("   subP  ", {k: info["subP"][k] for k in ("w", "h", "lines")} if info["subP"] else None)
        print("   gauge ", {k: info["gauge"][k] for k in ("text", "w", "lines", "overflow")} if info["gauge"] else None)

        sub = info["sub"]
        check(bool(sub), f"{label}: 모임 부제의 ‘이번 주 달성률 %’ 표시 확인", str(sub and sub["text"]))
        if sub:
            check(sub["lines"] == 1, f"{label}: ‘{sub['text']}’ 한 줄", f"{sub['lines']}줄")
            check(sub["overflow"] == 0, f"{label}: 부제 달성률 가로 넘침 없음", f"{sub['overflow']}px")
            check(
                not info["subP"] or sub["w"] <= info["subP"]["w"],
                f"{label}: 달성률 문구가 부제 칸 안에 들어감",
                f"{sub['w']}<={info['subP'] and info['subP']['w']}",
            )
            check(sub["ws"] == "nowrap", f"{label}: 달성률 문구 nowrap", sub["ws"])
        if info["subP"]:
            # 부제 문단은 ‘·’ 단위로만 줄이 바뀐다 — 달성률 문구가 쪼개지면 위 검사에서 걸린다
            check(info["subP"]["right"] <= info["viewport"], f"{label}: 부제가 화면 밖으로 넘치지 않음", f"{info['subP']['right']}>{info['viewport']}")

        g = info["gauge"]
        if g:
            gl, gv = info["gaugeLabel"], info["gaugeValue"]
            check(bool(gl) and bool(gv), f"{label}: 게이지 라벨·% 요소 확인")
            if gl and gv:
                check(gl["lines"] == 1, f"{label}: 게이지 라벨 한 줄", f"{gl['lines']}줄")
                check(gv["lines"] == 1, f"{label}: 게이지 % 한 줄", f"{gv['lines']}줄")
                check(same_line(gl, gv), f"{label}: 게이지 라벨·% 같은 y", f"{gl['top']} / {gv['top']}")
                check(gv["right"] <= info["viewport"], f"{label}: 게이지 %가 화면 안", f"{gv['right']}")
            check(g["overflow"] == 0, f"{label}: 게이지 줄 넘침 없음", f"{g['overflow']}px")
        else:
            errors.append(f"{label}: 달성률 게이지 없음")

        check(not info["pageOver"], f"{label}: 화면 가로 넘침 없음", str(info["pageOver"]))
        check(info["scrollW"] <= info["viewport"] + 1, f"{label}: 문서 가로 스크롤 없음", f"{info['scrollW']}/{info['viewport']}")

        # 모임 화면 상단(부제 + 게이지) 캡처
        page.evaluate("() => window.scrollTo(0, 0)")
        page.wait_for_timeout(300)
        page.screenshot(path=f"{SHOT}/_rate_group_top_{tag_of.get(label, str(root))}.png")
        if g:
            page.locator("[data-weekly-gauge]").scroll_into_view_if_needed()
            page.wait_for_timeout(300)
            page.locator("[data-weekly-gauge]").locator("xpath=..").screenshot(path=f"{SHOT}/_rate_gauge_{tag_of.get(label, str(root))}.png")
            page.evaluate("() => window.scrollTo(0, 0)")
            page.wait_for_timeout(300)

        # 홈 모임 카드의 ‘이번 주 참여율’
        page.get_by_role("navigation").get_by_role("button", name="홈").click()
        page.wait_for_timeout(1000)
        hinfo = page.evaluate(MEASURE)
        home = hinfo["home"]
        print("   home  ", {k: home[k] for k in ("text", "w", "font", "lines", "overflow")} if home else None)
        check(bool(home), f"{label}: 홈 카드 ‘이번 주 참여율’ 표시 확인")
        if home:
            check(home["lines"] == 1, f"{label}: ‘{home['text']}' 한 줄", f"{home['lines']}줄")
            check(home["overflow"] == 0, f"{label}: 홈 참여율 넘침 없음", f"{home['overflow']}px")
        page.locator("[data-weekly-rate='home']").scroll_into_view_if_needed()
        page.wait_for_timeout(300)
        page.screenshot(path=f"{SHOT}/_rate_home_{tag_of.get(label, str(root))}.png")

        kept[label] = {
            "root": info["root"],
            "sub": sub and {k: sub[k] for k in ("text", "font", "lines", "scrollW", "clientW")},
            "gauge": g and {"text": g["text"], "font": info["gaugeValue"]["font"], "lines": g["lines"]},
            "home": home and {k: home[k] for k in ("text", "font", "lines", "scrollW", "clientW")},
        }

        if step < 2:
            page.get_by_role("button", name=re.compile("글씨 크기 바꾸기")).first.click()
            page.wait_for_timeout(900)
            page.get_by_role("navigation").get_by_role("button", name="모임").click()
            page.wait_for_timeout(1200)

    # 보고용 대표 캡처 — 아주 크게 모임 화면 상단
    page.evaluate("() => window.scrollTo(0, 0)")
    page.wait_for_timeout(400)
    page.screenshot(path=f"{SHOT}/neulbom_group_rate_1line.png")

    if errs:
        errors.append(f"페이지 오류: {errs[:3]}")
    b.close()

if httpd:
    httpd.shutdown()

print("\n=== 글씨 3단계 요약 ===")
print(json.dumps(kept, ensure_ascii=False, indent=1))
print("문제:", len(errors))
for x in errors:
    print("  ", x)
cleanup()
sys.exit(1 if errors else 0)
