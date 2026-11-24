"""🎁 추억 상자 검증 — 390×844 · 글씨 3단계(보통·크게·아주 크게).

python3 e2e/check_memory_box.py                                            # 로컬 out/
BASE=https://senior-life-platform.pages.dev python3 e2e/check_memory_box.py  # 라이브

확인
1) 첫 접속(초기 설정 직후)에 화면 가운데 '추억 상자'가 뜨고, 상자 그림이 실제로 로드되는지
   (naturalWidth > 0) · 가로 넘침/잘림 0건
2) 상자를 누르면 Web Audio 오르골이 실제로 울리는지(OscillatorNode.start 호출 수) +
   태어난 해(1952)에 맞는 1970~1980년대 추억 사진이 로드되는지 · 콘솔 오류 0건
3) 닫은 뒤 새로고침해도 같은 날에는 다시 뜨지 않는지
스크린샷: downloads/neulbom_memory_box_{normal,large,xlarge}.png
          downloads/neulbom_memory_box_photo_{...}.png
결과: downloads/memory-box-check.json
"""
import json
import os
import sys

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
    httpd = None
    if LOCAL:
        httpd = start_server()
    report = {}
    problems = []

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
                page.add_init_script(
                    "localStorage.setItem('seniorLife.v1', %s)"
                    % json.dumps(
                        json.dumps(
                            {
                                "version": 1,
                                "profile": {
                                    "id": "demo_memorybox_check",
                                    "nickname": "순자",
                                    "birthYear": int(BIRTH),
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
                )
                page.goto(BASE + "/", wait_until="domcontentloaded")
                page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)

            # ── 1) 첫 접속 — 화면 가운데 추억 상자
            page.wait_for_selector("[data-memory-box-card]", state="visible", timeout=15000)
            page.wait_for_timeout(700)  # 상자 그림 로드·애니메이션
            pr = page.evaluate(PROBE)
            res["box"] = {
                "hasTitle": "추억 상자" in pr["text"],
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
