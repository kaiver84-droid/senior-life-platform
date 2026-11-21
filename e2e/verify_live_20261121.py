"""라이브(배포 후) 검증 — 2026-11-21 결함·UX 수정 + 화질.

BASE=https://senior-life-platform.pages.dev LD_LIBRARY_PATH=/workspace/work/.tools/browser-libs \
  python3 e2e/verify_live_20261121.py

DB 보호: 이 스크립트는 GET 만 서버로 보낸다. POST/PUT/PATCH/DELETE 는 가짜 200 으로 막는다.
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "https://senior-life-platform.pages.dev").rstrip("/")
OUT = os.environ.get("OUT", "/workspace/downloads")
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")
KAKAO_NAME = "순자"
PARENT_CODE = os.environ.get("PARENT_CODE", "QEM3P5")

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
    // 장식용 절대배치 도형(글자 없음)은 카드 overflow-hidden 안에서 잘리므로 제외
    const decorative = cs.position === 'absolute' && !(el.textContent || '').trim();
    if (!decorative && (r.right > de.clientWidth + 1.5 || r.left < -1.5)) {
      over.push({tag: el.tagName, cls: (el.className||'').toString().slice(0,80), right: Math.round(r.right), txt: (el.textContent||'').trim().slice(0,40)});
    }
  });
  const clipped = [...document.querySelectorAll('.truncate')]
      .filter((e) => e.scrollWidth > e.clientWidth + 1)
      .map((e) => ({txt: e.innerText.slice(0,44), sw: e.scrollWidth, cw: e.clientWidth}));
  return {docW: de.scrollWidth, clientW: de.clientWidth, over, overCount: over.length,
          clippedCount: clipped.length, clipped: clipped.slice(0,6),
          bodyText: document.body.innerText};
}
"""


def kakao_stub(route, request):
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
                        "id": "kakao_777009002",
                        "nickname": KAKAO_NAME,
                        "birthYear": 1952,
                        "source": "kakao",
                        "createdAt": "2026-11-16T00:00:00.000Z",
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


def block_writes(page):
    def handler(route, request):
        if request.method == "GET":
            route.continue_()
        else:
            route.fulfill(status=200, content_type="application/json", body='{"ok":true}')

    page.route("**/api/state**", handler)
    page.route("**/api/groups**", handler)
    page.route("**/api/rankings**", handler)
    page.route("**/api/duels**", handler)


def live_login(page):
    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
    page.get_by_role("button", name="카카오톡으로 시작하기").click()
    try:
        page.wait_for_selector("#setup-nick", timeout=12000)
        page.fill("#setup-nick", KAKAO_NAME)
        page.select_option("#setup-birth", "1952")
        page.click('[data-birthtime="묘시"]')
        page.select_option("#setup-sido", "충청북도")
        page.select_option("#setup-sigungu", "옥천군")
        page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
    except Exception:
        pass
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=40000)
    page.wait_for_timeout(2500)


def close_overlays(page):
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


def set_font(page, size):
    page.evaluate(
        """(s) => { const k='seniorLife.v1'; const v=JSON.parse(localStorage.getItem(k)||'{}');
                   v.fontSize=s; localStorage.setItem(k, JSON.stringify(v));
                   document.documentElement.style.setProperty('--app-font', (s+1)+'px'); }""",
        size,
    )


def main():
    report = {}
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        for label, size in (("normal", 18), ("large", 21), ("xlarge", 24)):
            ctx = browser.new_context(
                viewport={"width": 390, "height": 844},
                device_scale_factor=3,
                is_mobile=True,
                has_touch=True,
                locale="ko-KR",
                user_agent=(
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
                ),
            )
            page = ctx.new_page()
            console_errors, http_errors = [], []
            page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: console_errors.append(f"pageerror: {e}"))
            page.on("response", lambda r: http_errors.append((r.status, r.url)) if r.status >= 400 else None)
            block_writes(page)
            page.route("**/api/auth/kakao**", kakao_stub)
            live_login(page)
            set_font(page, size)
            page.reload(wait_until="networkidle")
            page.wait_for_timeout(1500)
            close_overlays(page)

            res = {}
            pr = page.evaluate(PROBE)
            res["home"] = {k: pr[k] for k in ("docW", "clientW", "overCount", "clippedCount", "over")}
            page.screenshot(path=os.path.join(OUT, f"neulbom_fix_home_{label}.png"), full_page=True)

            close_overlays(page)
            page.click("nav[aria-label='주요 메뉴'] >> text=혜택")
            page.wait_for_timeout(900)
            pr = page.evaluate(PROBE)
            res["welfare"] = {k: pr[k] for k in ("docW", "clientW", "overCount", "clippedCount", "clipped")}
            page.screenshot(path=os.path.join(OUT, f"neulbom_fix_welfare_{label}.png"), full_page=True)

            close_overlays(page)
            page.click("nav[aria-label='주요 메뉴'] >> text=퀴즈")
            page.wait_for_timeout(700)
            close_overlays(page)
            page.click("[data-quiz-topic='mix']")
            page.wait_for_timeout(1000)
            widths = []
            for _ in range(10):
                widths.append(page.evaluate("() => document.documentElement.scrollWidth"))
                page.wait_for_timeout(120)
            pr = page.evaluate(PROBE)
            res["quiz"] = {k: pr[k] for k in ("docW", "clientW", "overCount")}
            res["quiz"]["maxW"] = max(widths)
            page.screenshot(path=os.path.join(OUT, f"neulbom_fix_quiz_{label}.png"), full_page=True)

            close_overlays(page)
            page.click("nav[aria-label='주요 메뉴'] >> text=랭킹")
            page.wait_for_timeout(1800)
            pr = page.evaluate(PROBE)
            res["ranking"] = {
                "hasPrepare": "순위를 준비하고 있어요" in pr["bodyText"],
                "hasNoRank": "아직 순위에 들지 않았어요" in pr["bodyText"],
                "hasHint": "오늘 미션으로 참여하면 순위에 들어요" in pr["bodyText"],
                "docW": pr["docW"],
                "clientW": pr["clientW"],
            }
            page.screenshot(path=os.path.join(OUT, f"neulbom_fix_ranking_{label}.png"), full_page=True)

            res["consoleErrors"] = console_errors
            res["httpErrors"] = http_errors
            if console_errors or http_errors:
                errors.append((label, console_errors[:4], http_errors[:4]))
            report[label] = res
            ctx.close()

        # 가족 대시보드 — 내 프로필이 있는 기기에서 부모님 코드를 연 경우
        for name, url in (("family_code", f"{BASE}/family/?code={PARENT_CODE}"), ("family_nocode", f"{BASE}/family/")):
            ctx = browser.new_context(
                viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True
            )
            page = ctx.new_page()
            block_writes(page)
            page.route("**/api/auth/kakao**", kakao_stub)
            live_login(page)
            own = page.evaluate("() => { const v=JSON.parse(localStorage.getItem('seniorLife.v1')||'{}'); return {nick: v.profile && v.profile.nickname, code: v.code}; }")
            page.goto(url, wait_until="networkidle")
            page.wait_for_timeout(3000)
            info = {
                "own": own,
                "h1": page.evaluate("() => document.querySelector('h1') ? document.querySelector('h1').innerText : ''"),
                "sub": page.evaluate("() => { const p=document.querySelector('h1 + p'); return p ? p.innerText : ''; }"),
                "bodyStart": page.evaluate("() => document.body.innerText.slice(0, 120)"),
            }
            page.screenshot(path=os.path.join(OUT, f"neulbom_fix_{name}.png"), full_page=True)
            report[name] = info
            ctx.close()
        browser.close()

    print(json.dumps(report, ensure_ascii=False, indent=1))
    print("\n=== 요약 ===")
    for label in ("normal", "large", "xlarge"):
        v = report[label]
        print(
            label,
            "docW",
            v["home"]["docW"], v["home"]["clientW"],
            "quizMax", v["quiz"]["maxW"],
            "homeOver", v["home"]["overCount"],
            "welfareClip", v["welfare"]["clippedCount"],
            "prepare?", v["ranking"]["hasPrepare"],
            "noRank?", v["ranking"]["hasNoRank"],
            "console", len(v["consoleErrors"]),
            "http", len(v["httpErrors"]),
        )
    print("family:", report["family_code"]["h1"], "|", report["family_code"]["sub"])
    print("family(no code):", report["family_nocode"]["h1"])


if __name__ == "__main__":
    main()
