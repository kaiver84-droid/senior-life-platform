"""2026-11-21 결함 3건·UX 보완 검증 — 390×844 · 글씨 3단계.

python3 e2e/check_fix_20261121.py            # 로컬 out/
BASE=https://senior-life-platform.pages.dev python3 e2e/check_fix_20261121.py   # 라이브

확인
- 문서·요소 가로 넘침 0건(scrollWidth <= clientWidth)
- 잘린 글자(truncate 로 scrollWidth > clientWidth) 0건 (혜택·건강 챌린지)
- 퀴즈 무한연습(#quiz → 섞어서 풀기) 문서 폭 390 유지
- 랭킹 상단 '순위를 준비하고 있어요' 문구 없음
- 가족 대시보드: 내 프로필이 있는 기기에서도 ?code= 부모님 데이터 표시
- 콘솔 오류·HTTP 4xx/5xx 0건
스크린샷: downloads/neulbom_fix_{home,welfare,quiz,ranking,family}.png
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

PROBE = """
() => {
  const de = document.documentElement;
  const over = [];
  const clipped = [];
  document.querySelectorAll('*').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.right > de.clientWidth + 1.5 || r.left < -1.5) {
      over.push({tag: el.tagName, cls: (el.className||'').toString().slice(0,90), right: Math.round(r.right), txt: (el.textContent||'').trim().slice(0,40)});
    }
    const isClipped = cs.overflow === 'hidden' && el.scrollWidth > el.clientWidth + 1;
    if (isClipped && (el.textContent||'').trim().length > 1) {
      clipped.push({sw: el.scrollWidth, cw: el.clientWidth, txt: (el.textContent||'').trim().slice(0,44)});
    }
  });
  return {
    docW: de.scrollWidth, clientW: de.clientWidth,
    over: over.slice(0, 12), overCount: over.length,
    bodyText: document.body.innerText,
  };
}
"""

METRICS = """
() => {
  const rows = [...document.querySelectorAll('[data-health-item]')].map((b) => {
    const t = b.querySelector('span.block');
    const d = b.querySelectorAll('span.block')[1];
    return {id: b.dataset.healthItem, rowW: Math.round(b.getBoundingClientRect().width),
            titleW: t ? Math.round(t.getBoundingClientRect().width) : 0,
            titleSW: t ? t.scrollWidth : 0, titleSH: t ? t.scrollHeight : 0,
            desc: d ? d.innerText : ''};
  });
  return {rows};
}
"""


def close_overlays(page):
    """홈에 뜨는 시트(앱 설치 안내·웰컴)를 닫고 탭을 누를 수 있게 한다."""
    for _ in range(3):
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)
        for label in ("닫기", "나중에", "알겠어요", "다음에"):
            loc = page.get_by_role("button", name=label, exact=False)
            if loc.count():
                try:
                    loc.first.click(timeout=800)
                    page.wait_for_timeout(200)
                except Exception:
                    pass
    page.wait_for_timeout(200)


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
    errors = []
    report = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        for label, size in (("normal", 18), ("large", 21), ("xlarge", 24)):
            ctx = browser.new_context(
                viewport={"width": 390, "height": 844},
                device_scale_factor=3,
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
            page.on(
                "response",
                lambda r: http_errors.append((r.status, r.url)) if r.status >= 400 else None,
            )
            # DB 에 아무것도 남기지 않는다 — 모든 쓰기 요청은 가짜 200
            page.route(
                "**/api/state",
                lambda route: route.fulfill(status=200, content_type="application/json", body='{"ok":true}')
                if route.request.method != "GET"
                else route.continue_(),
            )
            onboard(page)
            set_font(page, size)
            page.reload(wait_until="networkidle")
            page.wait_for_timeout(900)
            close_overlays(page)

            res = {}
            # 1) 홈
            pr = page.evaluate(PROBE)
            res["home"] = {"docW": pr["docW"], "clientW": pr["clientW"], "overCount": pr["overCount"], "over": pr["over"]}
            if label == "xlarge":
                res["home"]["healthRows"] = page.evaluate(METRICS)
            page.screenshot(path=os.path.join(OUT, f"neulbom_fix_home_{label}.png"), full_page=True)

            # 2) 혜택
            close_overlays(page)
            page.click("nav[aria-label='주요 메뉴'] >> text=혜택")
            page.wait_for_timeout(700)
            pr = page.evaluate(PROBE)
            res["welfare"] = {"docW": pr["docW"], "clientW": pr["clientW"], "overCount": pr["overCount"], "over": pr["over"]}
            res["welfare"]["clippedTitles"] = [
                c for c in page.evaluate(
                    """() => [...document.querySelectorAll('.truncate')].filter((e)=>e.scrollWidth>e.clientWidth+1)
                            .map((e)=>({txt:e.innerText.slice(0,40), sw:e.scrollWidth, cw:e.clientWidth}))"""
                )
            ]
            page.screenshot(path=os.path.join(OUT, f"neulbom_fix_welfare_{label}.png"), full_page=True)

            # 3) 퀴즈 → 섞어서 풀기(무한 연습)
            page.click("nav[aria-label='주요 메뉴'] >> text=퀴즈")
            page.wait_for_timeout(600)
            page.click("[data-quiz-topic='mix']")
            page.wait_for_timeout(900)
            widths = []
            for _ in range(12):
                widths.append(page.evaluate("() => document.documentElement.scrollWidth"))
                page.wait_for_timeout(120)
            pr = page.evaluate(PROBE)
            res["quiz"] = {
                "docW": pr["docW"],
                "clientW": pr["clientW"],
                "maxW": max(widths),
                "overCount": pr["overCount"],
                "over": pr["over"],
            }
            page.screenshot(path=os.path.join(OUT, f"neulbom_fix_quiz_{label}.png"), full_page=True)

            # 4) 랭킹 — 모순 문구 확인
            page.click("nav[aria-label='주요 메뉴'] >> text=랭킹")
            page.wait_for_timeout(1200)
            pr = page.evaluate(PROBE)
            res["ranking"] = {
                "docW": pr["docW"],
                "clientW": pr["clientW"],
                "hasPrepare": "순위를 준비하고 있어요" in pr["bodyText"],
                "hasNoRank": "아직 순위에 들지 않았어요" in pr["bodyText"],
                "overCount": pr["overCount"],
                "over": pr["over"],
            }
            page.screenshot(path=os.path.join(OUT, f"neulbom_fix_ranking_{label}.png"), full_page=True)

            res["consoleErrors"] = console_errors
            res["httpErrors"] = http_errors
            report[label] = res
            if console_errors or http_errors:
                errors.append((label, console_errors[:5], http_errors[:5]))
            ctx.close()

        # 5) 가족 대시보드 — 내 프로필이 있는 기기 + 부모님 코드
        code = os.environ.get("PARENT_CODE", "QEM3P5")
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True
        )
        page = ctx.new_page()
        page.goto(f"{BASE}/", wait_until="domcontentloaded")
        page.wait_for_timeout(400)
        page.route(
            "**/api/state",
            lambda route: route.fulfill(status=200, content_type="application/json", body='{"ok":true}')
            if route.request.method != "GET"
            else route.continue_(),
        )
        onboard(page)
        page.goto(f"{BASE}/family/?code={code}", wait_until="networkidle")
        page.wait_for_timeout(2500)
        h1 = page.evaluate("() => document.querySelector('h1') ? document.querySelector('h1').innerText : ''")
        body = page.evaluate("() => document.body.innerText.slice(0, 400)")
        report["family"] = {"h1": h1, "bodyStart": body}
        page.screenshot(path=os.path.join(OUT, "neulbom_fix_family.png"), full_page=True)
        ctx.close()
        browser.close()
    if httpd:
        httpd.shutdown()

    print(json.dumps(report, ensure_ascii=False, indent=1))
    print("\n=== 요약 ===")
    for k, v in report.items():
        if k == "family":
            print("family:", v["h1"])
        else:
            print(
                k,
                "docW/clientW",
                v["home"]["docW"], v["home"]["clientW"],
                "quiz",
                v["quiz"]["docW"], v["quiz"]["maxW"],
                "ranking prepare?", v["ranking"]["hasPrepare"],
                "console", len(v["consoleErrors"]),
                "http", len(v["httpErrors"]),
            )


if __name__ == "__main__":
    main()
