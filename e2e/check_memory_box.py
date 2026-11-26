"""🎁 추억 상자 검증 — 390×844 · 글씨 3단계(보통·크게·아주 크게).

※ 2026-11-27 부터 이 기능은 숨김 상태다(lib/flags.ts `ENABLE_MEMORY_BOX = false`).
   지금 이 파일을 돌리면 "상자가 없다"고 실패하는 것이 정상이므로, 아래 main() 이 플래그를 먼저 읽고
   꺼져 있으면 그 사실만 알리고 끝난다. 숨김 상태 검사는 `e2e/check_memory_box_hidden.py` 를 쓴다.
   다시 켜면(플래그 true) 이 파일을 그대로 돌리면 된다.

python3 e2e/check_memory_box.py                                            # 로컬 out/
BASE=https://senior-life-platform.pages.dev python3 e2e/check_memory_box.py  # 라이브

확인
1) 첫 접속(초기 설정 직후)에 화면 가운데 '오늘의 추억상자'가 뜨고, 상자 그림이 실제로 로드되는지
   (naturalWidth > 0) · 가로 넘침/잘림 0건 · 예전 제목 '추억 상자'는 남아 있지 않은지
2) 상자를 누르면 Web Audio 오르골이 실제로 울리는지(OscillatorNode.start 호출 수) +
   태어난 해(1952)에 맞는 1970~1980년대 추억 사진이 로드되는지 · 콘솔 오류 0건
3) 닫은 뒤 새로고침해도 같은 날에는 다시 뜨지 않는지
4) 50대 이상 네 시대 — 1946·1955·1965·1975·1985년생에게 각각 1960~1970년대 /
   1970~1980년대 / 1980~1990년대 초반 / 1990~2000년대 초반(1975·1985년생) 사진이 나오는지
   (2000년대·2010년대 구간은 없음)
스크린샷: downloads/neulbom_memory_box_{normal,large,xlarge}.png
          downloads/neulbom_memory_box_photo_{...}.png
결과: downloads/memory-box-check.json

5) 네 시대 × 사진 열다섯 장 — 등록된 사진 파일(.png·.webp)이 모두 있고 빠진 것이 없는지
6) 보름 순환 — 월말(11-28)→월초(12-12)를 넘겨도 연속 15일에 매일 다른 사진,
   16일째는 첫 사진으로 돌아오는지
"""
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from harness import PORT, onboard, start_server  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", f"http://127.0.0.1:{PORT}").rstrip("/")
OUT = os.environ.get("OUT", "/workspace/downloads")
LOCAL = BASE.startswith("http://127.0.0.1")
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")
BIRTH = os.environ.get("BIRTH", "1952")
ERA = os.environ.get("ERA", "1970~1980년대")  # 1952년생 → 1970~1980년대
NOTE = os.environ.get("NOTE", "")

# 50대 이상 네 시대 — 출생연도, 기대 시대 이름, 기대 사진 접두어
ERA_MATRIX = [
    (1946, "1960~1970년대", "era1"),
    (1955, "1970~1980년대", "era2"),
    (1965, "1980~1990년대 초반", "era3"),
    (1975, "1990~2000년대 초반", "era4"),
    (1985, "1990~2000년대 초반", "era4"),  # 1985년생도 시니어 기본 시대(1990~2000년대 초반)
]


def profile_script(birth, size=18):
    """카카오 로그인 없이 '이미 초기 설정을 마친 기기' 상태를 만드는 localStorage 스크립트."""
    return "localStorage.setItem('seniorLife.v1', %s)" % json.dumps(
        json.dumps(
            {
                "version": 1,
                "profile": {
                    "id": "demo_memorybox_check",
                    "nickname": "순자",
                    "birthYear": int(birth),
                    "birthTime": "묘시",
                    "sido": "충청북도",
                    "sigungu": "옥천군",
                    "createdAt": "2026-11-24T00:00:00.000Z",
                    "source": "demo",
                    "profileCompleted": True,
                },
                "quizLogs": [],
                "med": {},
                "visits": [],
                "familyEvents": [],
                "health": {},
                "missions": {},
                "rankingVisible": True,
                "fontSize": size,
                "lastVisit": "",
            },
            ensure_ascii=False,
        )
    )


def date_script(day):
    """브라우저의 '오늘'을 지정한 날(서울 낮 12시)로 고정한다 — 보름 순환을 하루씩 넘겨 보기 위해."""
    return (
        "const __fixed = new Date('%sT12:00:00+09:00').getTime();"
        "const __RealDate = Date;"
        "class __FakeDate extends __RealDate {"
        "  constructor(...a){ if (a.length === 0) { super(__fixed); } else { super(...a); } }"
        "  static now(){ return __fixed; }"
        "}"
        "window.Date = __FakeDate;"
    ) % day


# 상자 그림·사진·글자 폭 측정 (넘침·잘림)
PROBE = """
() => {
  const de = document.documentElement;
  const over = [];
  document.querySelectorAll('*').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.right > de.clientWidth + 1.5 || r.left < -1.5) {
      over.push({tag: el.tagName, cls: (el.className||'').toString().slice(0,80),
                 left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width)});
    }
  });
  const imgs = [...document.querySelectorAll('[data-memory-box-card] img, [data-memory-box-photo] img')]
    .map((i) => ({src: i.currentSrc || i.src, nw: i.naturalWidth, nh: i.naturalHeight,
                  w: Math.round(i.getBoundingClientRect().width), h: Math.round(i.getBoundingClientRect().height)}));
  const card = document.querySelector('[data-memory-box-card], [data-memory-box-photo]');
  const cr = card ? card.getBoundingClientRect() : null;
  const text = card ? card.innerText : '';
  return {
    docW: de.scrollWidth, clientW: de.clientWidth, docH: de.scrollHeight,
    overCount: over.length, over: over.slice(0, 10), imgs, text,
    card: cr ? {left: Math.round(cr.left), right: Math.round(cr.right),
                top: Math.round(cr.top), bottom: Math.round(cr.bottom),
                w: Math.round(cr.width), h: Math.round(cr.height)} : null,
    vh: window.innerHeight,
    scrollY: window.scrollY,
    bodyOverflow: getComputedStyle(document.body).overflow,
  };
}
"""

# 클릭하는 순간 소리가 나는지 — AudioContext·OscillatorNode.start 를 세는 감시 장치
SPY = """
() => {
  window.__chime = {ctx: 0, starts: 0, states: []};
  const Orig = window.AudioContext || window.webkitAudioContext;
  if (!Orig) return 'no-webaudio';
  class Spy extends Orig {
    constructor(...a) {
      super(...a);
      window.__chime.ctx++;
      window.__chime.states.push(this.state);
    }
    createOscillator() {
      const o = super.createOscillator();
      const start = o.start.bind(o);
      o.start = (...x) => { window.__chime.starts++; return start(...x); };
      return o;
    }
  }
  window.AudioContext = Spy;
  window.webkitAudioContext = Spy;
  return 'ok';
}
"""


def set_font(page, size):
    page.evaluate(
        """(s) => { const k='seniorLife.v1'; const v=JSON.parse(localStorage.getItem(k)||'{}');
                   v.fontSize=s; localStorage.setItem(k, JSON.stringify(v));
                   document.documentElement.style.setProperty('--app-font', (s+1)+'px'); }""",
        size,
    )


def main():
    flags = open("/workspace/work/senior-platform/lib/flags.ts", encoding="utf-8").read()
    if "ENABLE_MEMORY_BOX = true" not in flags:
        print("SKIP — 오늘의 추억상자는 숨김 상태입니다(lib/flags.ts ENABLE_MEMORY_BOX=false).")
        print("       숨김 검사: python3 e2e/check_memory_box_hidden.py")
        return

    httpd = None
    if LOCAL:
        httpd = start_server()
    report = {}
    problems = []

    # ── 0) 등록된 사진 파일 — lib/memory-box.ts 의 photo("eraX-y") 마다 .png·.webp 가 실제로 있는지
    root = "/workspace/work/senior-platform"
    lib_src = open(os.path.join(root, "lib/memory-box.ts"), encoding="utf-8").read()
    names = re.findall(r'photo\(\s*"([^"]+)"', lib_src)
    per_era, missing = {}, []
    for n in names:
        per_era.setdefault(n.split("-")[0], []).append(n)
        for ext in ("png", "webp"):
            p = os.path.join(root, "public/images/memory-box", f"{n}.{ext}")
            if not os.path.exists(p) or os.path.getsize(p) < 20000:
                missing.append(f"{n}.{ext}")
    report["photos"] = {k: len(v) for k, v in sorted(per_era.items())}
    report["photosMissing"] = missing
    for k, v in sorted(per_era.items()):
        if len(v) != 15:
            problems.append((k, "사진이 열다섯 장이 아님", v))
        if len(set(v)) != len(v):
            problems.append((k, "사진 이름 중복", v))
    if missing:
        problems.append(("files", "사진 파일이 없거나 너무 작음", missing))

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        for label, size in (("normal", 18), ("large", 21), ("xlarge", 24)):
            ctx = browser.new_context(
                viewport={"width": 390, "height": 844},
                device_scale_factor=2,
                is_mobile=True,
                has_touch=True,
                user_agent=(
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
                ),
            )
            page = ctx.new_page()
            console_errors = []
            http_errors = []
            page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: console_errors.append(f"pageerror: {e}"))
            page.on("response", lambda r: http_errors.append((r.status, r.url)) if r.status >= 400 else None)
            # DB 쓰기는 남기지 않는다
            page.route(
                "**/api/state",
                lambda route: route.fulfill(status=200, content_type="application/json", body='{"ok":true}')
                if route.request.method != "GET"
                else route.continue_(),
            )

            res = {}
            if LOCAL:
                onboard(page, birth=BIRTH)
                if size != 18:
                    set_font(page, size)
                    page.reload(wait_until="networkidle")
            else:
                # 라이브: 카카오 로그인 없이 '이미 초기 설정을 마친 기기' 상태를 만들어
                # 이 기기에 이미 저장된 설정과 똑같이 홈부터 연다(서버·DB에는 아무것도 쓰지 않는다).
                page.add_init_script(profile_script(BIRTH, size))
                page.goto(BASE + "/", wait_until="domcontentloaded")
                page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)

            # ── 1) 첫 접속 — 화면 가운데 추억 상자
            page.wait_for_selector("[data-memory-box-card]", state="visible", timeout=15000)
            page.wait_for_timeout(700)  # 상자 그림 로드·애니메이션
            pr = page.evaluate(PROBE)
            res["box"] = {
                "hasTitle": "오늘의 추억상자" in pr["text"],
                "hasOldTitle": "추억 상자" in pr["text"],
                "hasGuide": "눌러서 열어보세요" in pr["text"],
                "card": pr["card"],
                "vh": pr["vh"],
                "centered": bool(pr["card"]) and abs((pr["card"]["top"] + pr["card"]["bottom"]) / 2 - pr["vh"] / 2) < 40,
                "docW": pr["docW"],
                "clientW": pr["clientW"],
                "overCount": pr["overCount"],
                "over": pr["over"],
                "imgs": pr["imgs"],
                "bodyOverflow": pr["bodyOverflow"],
                "text": pr["text"],
            }
            if not pr["imgs"] or pr["imgs"][0]["nw"] <= 0:
                problems.append((label, "상자 그림이 로드되지 않음", pr["imgs"]))
            if not res["box"]["hasTitle"]:
                problems.append((label, "제목이 '오늘의 추억상자'가 아님", pr["text"][:120]))
            if res["box"]["hasOldTitle"]:
                problems.append((label, "예전 제목 '추억 상자'가 남아 있음", pr["text"][:120]))
            if pr["overCount"]:
                problems.append((label, "가로 넘침", pr["over"]))
            page.screenshot(path=os.path.join(OUT, f"neulbom_memory_box_{label}.png"))

            # ── 2) 상자를 눌렀을 때 — 소리 + 추억 사진
            spy = page.evaluate(SPY)
            page.click("[data-memory-box-open]")
            page.wait_for_timeout(120)
            chime = page.evaluate("() => window.__chime")
            page.wait_for_selector("[data-memory-box-photo]", state="visible", timeout=5000)
            page.wait_for_timeout(600)
            pr2 = page.evaluate(PROBE)
            res["photo"] = {
                "spy": spy,
                "chime": chime,
                "eraLabel": ERA in pr2["text"],
                "hasEra": "20~30대 시절의 추억" in pr2["text"],
                "hasClose": "닫기" in pr2["text"],
                "card": pr2["card"],
                "docW": pr2["docW"],
                "clientW": pr2["clientW"],
                "overCount": pr2["overCount"],
                "over": pr2["over"],
                "imgs": pr2["imgs"],
                "text": pr2["text"],
            }
            if chime.get("starts", 0) <= 0:
                problems.append((label, "Web Audio 오르골이 울리지 않음", chime))
            if not any(i["nw"] > 0 and "/images/memory-box/era" in i["src"] for i in pr2["imgs"]):
                problems.append((label, "추억 사진이 로드되지 않음", pr2["imgs"]))
            if not res["photo"]["eraLabel"]:
                problems.append((label, "나이대 시대 라벨이 맞지 않음", pr2["text"][:120]))
            page.screenshot(path=os.path.join(OUT, f"neulbom_memory_box_photo_{label}.png"))

            # ── 3) 닫은 뒤 같은 날 새로고침 — 다시 뜨지 않아야 한다
            page.click("[data-memory-box-close]")
            page.wait_for_timeout(300)
            res["closed"] = page.locator("[data-memory-box-card], [data-memory-box-photo]").count() == 0
            page.reload(wait_until="networkidle")
            page.wait_for_timeout(1600)
            again = page.locator("[data-memory-box-card], [data-memory-box-photo]").count()
            res["noRepeatSameDay"] = again == 0
            res["seenKey"] = page.evaluate("() => localStorage.getItem('neulbom.memoryBoxSeenDate')")
            if again:
                problems.append((label, "같은 날 새로고침에 상자가 다시 떴다", again))
            page.screenshot(path=os.path.join(OUT, f"neulbom_memory_box_after_{label}.png"))

            # ── 4) 날짜가 바뀌면 다시 뜨고, 사진도 바뀐다(어제 열었다고 적어 두고 확인)
            kst = timezone(timedelta(hours=9))
            yesterday = (datetime.now(kst) - timedelta(days=1)).strftime("%Y-%m-%d")
            page.evaluate(
                "(d) => localStorage.setItem('neulbom.memoryBoxSeenDate', d)", yesterday
            )
            page.reload(wait_until="networkidle")
            back = page.locator("[data-memory-box-card]")
            try:
                back.wait_for(state="visible", timeout=4000)
                returned = True
            except Exception:
                returned = False
            res["nextDayShowsAgain"] = returned
            if not returned:
                problems.append((label, "날짜가 바뀌었는데 상자가 다시 뜨지 않았다", yesterday))
            else:
                page.click("[data-memory-box-open]")
                page.wait_for_selector("[data-memory-box-photo]", state="visible", timeout=5000)
                page.wait_for_timeout(500)
                pr4 = page.evaluate(PROBE)
                res["nextDayPhoto"] = [i["src"] for i in pr4["imgs"] if "/images/memory-box/era" in i["src"]]
                page.click("[data-memory-box-close]")
                page.wait_for_timeout(200)

            res["consoleErrors"] = console_errors
            res["httpErrors"] = http_errors
            # 로컬 정적 서버에는 /api/* 가 없다 — 그 404 는 라이브에서 확인해야 하므로 문제로 세지 않는다.
            real_http = [(s, u) for s, u in http_errors if "/api/" not in u]
            real_console = [e for e in console_errors if "Failed to load resource" not in e]
            if real_http:
                problems.append((label, "HTTP 오류", real_http[:5]))
            if real_console:
                problems.append((label, "콘솔 오류", real_console[:5]))
            report[label] = res
            ctx.close()

        # ── 5) 50대 이상 네 시대 — 출생연도별로 맞는 추억 사진이 나오는지
        matrix = []
        for birth, want_label, want_era in ERA_MATRIX:
            ctx = browser.new_context(
                viewport={"width": 390, "height": 844},
                device_scale_factor=2,
                is_mobile=True,
                has_touch=True,
                user_agent=(
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
                ),
            )
            page = ctx.new_page()
            merr = []
            page.on("console", lambda m: merr.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: merr.append(f"pageerror: {e}"))
            page.route(
                "**/api/state",
                lambda route: route.fulfill(status=200, content_type="application/json", body='{"ok":true}')
                if route.request.method != "GET"
                else route.continue_(),
            )
            if LOCAL:
                onboard(page, birth=str(birth))
            else:
                page.add_init_script(profile_script(birth))
                page.goto(BASE + "/", wait_until="domcontentloaded")
                page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
            page.wait_for_selector("[data-memory-box-card]", state="visible", timeout=15000)
            page.click("[data-memory-box-open]")
            page.wait_for_selector("[data-memory-box-photo]", state="visible", timeout=5000)
            page.wait_for_timeout(500)
            text = page.locator("[data-memory-box-photo]").inner_text()
            srcs = page.evaluate(
                "() => [...document.querySelectorAll('[data-memory-box-photo] img')]"
                ".map((i) => i.currentSrc || i.src)"
            )
            row = {
                "birth": birth,
                "wantLabel": want_label,
                "wantEra": want_era,
                "labelOk": want_label in text,
                "photoOk": any(f"/images/memory-box/{want_era}-" in u for u in srcs),
                "noRetiredEra": not any("/images/memory-box/era5-" in u or "/images/memory-box/era6-" in u for u in srcs),
                "srcs": [u.split("/")[-1] for u in srcs],
                "text": text[:160],
            }
            matrix.append(row)
            if not row["labelOk"]:
                problems.append((f"birth {birth}", "시대 라벨이 맞지 않음", row["text"]))
            if not row["photoOk"]:
                problems.append((f"birth {birth}", "시대 사진이 맞지 않음", row["srcs"]))
            if not row["noRetiredEra"]:
                problems.append((f"birth {birth}", "은퇴한 era5·era6 사진이 뜸", row["srcs"]))
            page.screenshot(path=os.path.join(OUT, f"neulbom_memory_box_era_{birth}.png"))
            page.click("[data-memory-box-close]")
            page.wait_for_timeout(200)
            ctx.close()
        report["eras"] = matrix

        # ── 6) 보름 순환 — 연속 15일(월말→월초를 넘기는 날짜)에 매일 다른 사진, 16일째는 첫 사진
        #    1952년생(1970~1980년대)으로 확인한다.
        rotation_days = ["2026-11-28", "2026-11-29", "2026-11-30",
                         "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04",
                         "2026-12-05", "2026-12-06", "2026-12-07", "2026-12-08",
                         "2026-12-09", "2026-12-10", "2026-12-11", "2026-12-12",
                         "2026-12-13"]  # 마지막 날은 첫날과 같은 사진이어야 한다
        picked = []
        for day in rotation_days:
            ctx = browser.new_context(
                viewport={"width": 390, "height": 844},
                device_scale_factor=2,
                is_mobile=True,
                has_touch=True,
                user_agent=(
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
                ),
            )
            page = ctx.new_page()
            page.add_init_script(profile_script(BIRTH))
            page.add_init_script(date_script(day))
            page.route(
                "**/api/state",
                lambda route: route.fulfill(status=200, content_type="application/json", body='{"ok":true}')
                if route.request.method != "GET"
                else route.continue_(),
            )
            page.goto(BASE + "/", wait_until="domcontentloaded")
            page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
            page.wait_for_selector("[data-memory-box-card]", state="visible", timeout=15000)
            page.click("[data-memory-box-open]")
            page.wait_for_selector("[data-memory-box-photo]", state="visible", timeout=5000)
            page.wait_for_timeout(500)
            srcs = page.evaluate(
                "() => [...document.querySelectorAll('[data-memory-box-photo] img')]"
                ".map((i) => i.currentSrc || i.src)"
            )
            name = next((u.split("/")[-1] for u in srcs if "/images/memory-box/era" in u), None)
            picked.append(name)
            page.close()
            ctx.close()
        first_fifteen = picked[:15]
        rotation = {
            "days": rotation_days,
            "picked": picked,
            "fifteenDistinct": len(set(first_fifteen)) == 15 and all(first_fifteen),
            "sixteenthSameAsFirst": bool(picked[15]) and picked[15] == picked[0],
        }
        report["rotation"] = rotation
        if not rotation["fifteenDistinct"]:
            problems.append(("rotation", "15일 안에 같은 사진이 다시 나왔다", picked))
        if not rotation["sixteenthSameAsFirst"]:
            problems.append(("rotation", "16일째가 첫 사진으로 돌아오지 않았다", picked))

        browser.close()

    if httpd:
        httpd.shutdown()

    report["_problems"] = problems
    with open(os.path.join(OUT, "memory-box-check.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(json.dumps(report, ensure_ascii=False, indent=2)[:6000])
    print("\nPROBLEMS:", len(problems))


if __name__ == "__main__":
    main()
