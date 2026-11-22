"""카카오 애드핏 연동 구조 검증 — 로컬 정적 빌드(out/) 또는 라이브를 390×844 에서 확인한다.

로컬:  SERVE_DIR=/workspace/work/senior-platform/out python3 e2e/check_adfit_20261122.py
라이브: BASE=https://senior-life-platform.pages.dev python3 e2e/check_adfit_20261122.py

확인 항목(글씨 보통·크게·아주 크게 3단계 각각)
- 퀴즈 결과 화면 / 오늘의 혜택 하단 / 더보기(개인정보처리방침 시트) / 공개 /privacy/ 페이지
- 콘솔 오류 0, HTTP 4xx·5xx 0, 가로 넘침 0
- 광고 단위 ID 가 비어 있을 때 광고 자리(data-adfit-slot)가 아예 그려지지 않는지
"""
import json
import os
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from playwright.sync_api import sync_playwright

OUT_DIR = os.environ.get("OUT", "/workspace/downloads")
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")
KAKAO_NAME = "순자"

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
    const decorative = cs.position === 'absolute' && !(el.textContent || '').trim();
    if (!decorative && (r.right > de.clientWidth + 1.5 || r.left < -1.5)) {
      over.push({tag: el.tagName, cls: (el.className||'').toString().slice(0,60),
                 right: Math.round(r.right), txt: (el.textContent||'').trim().slice(0,30)});
    }
  });
  const slot = document.querySelector('[data-adfit-slot]');
  return {
    docW: de.scrollWidth, clientW: de.clientWidth,
    overCount: over.length, over: over.slice(0, 5),
    adSlots: document.querySelectorAll('[data-adfit-slot]').length,
    adIns: document.querySelectorAll('ins.kakao_ad_area').length,
    adfitScript: document.querySelectorAll('script[src*="ba.min.js"]').length,
    adfitLoaded: !!(window.adfit),
    slotText: slot ? slot.innerText.trim() : '',
    bodyText: document.body.innerText,
  };
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
                }
            ),
        )


def block_writes(page):
    def handler(route, request):
        if request.method == "GET":
            route.continue_()
        else:
            route.fulfill(status=200, content_type="application/json", body='{"ok":true}')

    for pattern in ("**/api/state**", "**/api/groups**", "**/api/rankings**", "**/api/duels**"):
        page.route(pattern, handler)


def stub_local_api(page):
    """로컬 정적 서버에는 Pages Functions 가 없으니 /api/* 를 짧은 JSON 으로 대신한다.
    (라이브 검증에서는 쓰지 않는다 — 실제 API 응답을 그대로 본다.)"""
    stubs = {
        "/api/state": '{"ok":true}',
        "/api/groups": '{"ok":true,"groups":[]}',
        "/api/rankings": '{"ok":true}',
        "/api/duels": '{"ok":true}',
        "/api/weather": '{"ok":false}',
        "/api/stats": '{"ok":true,"totalUsers":2,"onlineNow":1}',
    }

    def handler(route, request):
        path = request.url.split("?")[0]
        path = path[path.find("/api") :]
        body = stubs.get(path, '{"ok":true}')
        route.fulfill(status=200, content_type="application/json", body=body)

    page.route("**/api/**", handler)


def close_overlays(page):
    for _ in range(3):
        page.keyboard.press("Escape")
        page.wait_for_timeout(150)
        for label in ("닫기", "나중에", "알겠어요", "다음에"):
            loc = page.get_by_role("button", name=label, exact=False)
            if loc.count():
                try:
                    loc.first.click(timeout=700)
                    page.wait_for_timeout(150)
                except Exception:
                    pass


SEED_DONE = """
() => {
  const k = 'seniorLife.v1';
  const v = JSON.parse(localStorage.getItem(k) || '{}');
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  v.daily = { date: today, answered: 5, correct: 4, points: 64, done: true, answeredIds: [] };
  v.fontSize = FONT;
  if (v.profile) v.profile.profileCompleted = true;
  // 미션 기록도 하나 넣어 혜택 화면이 실제 사용 상태를 닮게 한다
  v.missions = v.missions || {};
  v.missions[today] = ['welfare'];
  localStorage.setItem(k, JSON.stringify(v));
}
"""


def live_login(page, base):
    page.goto(base + "/", wait_until="domcontentloaded")
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
    page.wait_for_timeout(2000)


def main():
    serve_dir = os.environ.get("SERVE_DIR")
    httpd = None
    if serve_dir:
        handler = partial(SimpleHTTPRequestHandler, directory=serve_dir)
        httpd = ThreadingHTTPServer(("127.0.0.1", 8811), handler)
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        base = "http://127.0.0.1:8811"
    else:
        base = os.environ.get("BASE", "https://senior-life-platform.pages.dev").rstrip("/")

    report = {}
    problems = []
    try:
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
                block_writes(page) if not serve_dir else stub_local_api(page)
                page.route("**/api/auth/kakao**", kakao_stub)
                live_login(page, base)

                # 글씨 크기 + 오늘의 퀴즈 완료 상태를 넣고 다시 연다(결과 화면이 바로 보이게)
                page.evaluate(SEED_DONE.replace("FONT", str(size)))
                page.reload(wait_until="networkidle")
                page.wait_for_timeout(1500)
                close_overlays(page)

                res = {}

                # 1) 퀴즈 결과 화면 맨 아래
                page.click("nav[aria-label='주요 메뉴'] >> text=퀴즈")
                page.wait_for_timeout(1200)
                close_overlays(page)
                pr = page.evaluate(PROBE)
                res["quiz_done"] = {
                    "hasResult": "오늘의 퀴즈 결과" in pr["bodyText"],
                    "adSlots": pr["adSlots"],
                    "adIns": pr["adIns"],
                    "overCount": pr["overCount"],
                    "over": pr["over"],
                    "docW": pr["docW"],
                    "clientW": pr["clientW"],
                }
                page.screenshot(path=os.path.join(OUT_DIR, f"adfit_quiz_done_{label}.png"), full_page=True)

                # 2) 오늘의 혜택 목록 맨 아래
                page.click("nav[aria-label='주요 메뉴'] >> text=혜택")
                page.wait_for_timeout(1200)
                page.evaluate("() => window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(700)
                pr = page.evaluate(PROBE)
                res["welfare_bottom"] = {
                    "adSlots": pr["adSlots"],
                    "adIns": pr["adIns"],
                    "overCount": pr["overCount"],
                    "over": pr["over"],
                    "docW": pr["docW"],
                    "clientW": pr["clientW"],
                }
                page.screenshot(path=os.path.join(OUT_DIR, f"adfit_welfare_{label}.png"), full_page=True)

                # 3) 더보기 → 개인정보처리방침 시트
                page.click("nav[aria-label='주요 메뉴'] >> text=더보기")
                page.wait_for_timeout(900)
                close_overlays(page)
                page.get_by_role("button", name="개인정보처리방침", exact=False).first.click()
                page.wait_for_timeout(800)
                pr = page.evaluate(PROBE)
                res["privacy_sheet"] = {
                    "hasBody": "개인정보처리방침" in pr["bodyText"] and "광고 안내" in pr["bodyText"],
                    "hasAdNotice": "카카오 애드핏" in pr["bodyText"],
                    "overCount": pr["overCount"],
                    "over": pr["over"],
                    "docW": pr["docW"],
                    "clientW": pr["clientW"],
                }
                page.screenshot(path=os.path.join(OUT_DIR, f"adfit_privacy_sheet_{label}.png"), full_page=True)
                close_overlays(page)

                # 4) 공개 개인정보처리방침 페이지 — 로그인 없이 열린다
                page.goto(base + "/privacy/", wait_until="networkidle")
                page.wait_for_timeout(600)
                pr = page.evaluate(PROBE)
                res["privacy_page"] = {
                    "h1": page.evaluate("() => document.querySelector('h1')?.innerText || ''"),
                    "hasAdNotice": "카카오 애드핏" in pr["bodyText"],
                    "hasEffective": "2026년 11월 22일" in pr["bodyText"],
                    "overCount": pr["overCount"],
                    "over": pr["over"],
                    "docW": pr["docW"],
                    "clientW": pr["clientW"],
                }
                page.screenshot(path=os.path.join(OUT_DIR, f"adfit_privacy_page_{label}.png"), full_page=True)

                res["consoleErrors"] = console_errors
                res["httpErrors"] = http_errors
                for key in ("quiz_done", "welfare_bottom", "privacy_sheet", "privacy_page"):
                    if res[key]["overCount"]:
                        problems.append(f"{label}/{key}: 가로 넘침 {res[key]['overCount']}건 {res[key]['over']}")
                if console_errors:
                    problems.append(f"{label}: 콘솔 오류 {console_errors[:3]}")
                if http_errors:
                    problems.append(f"{label}: HTTP 오류 {http_errors[:3]}")
                report[label] = res
                ctx.close()
            browser.close()
    finally:
        if httpd:
            httpd.shutdown()

    print(json.dumps(report, ensure_ascii=False, indent=1))
    print("\n=== 요약 ===")
    for label in ("normal", "large", "xlarge"):
        r = report.get(label, {})
        print(
            label,
            "quiz결과", r["quiz_done"]["hasResult"],
            "광고자리", r["quiz_done"]["adSlots"], r["welfare_bottom"]["adSlots"],
            "넘침", r["quiz_done"]["overCount"], r["welfare_bottom"]["overCount"],
            r["privacy_sheet"]["overCount"], r["privacy_page"]["overCount"],
            "콘솔", len(r["consoleErrors"]), "HTTP", len(r["httpErrors"]),
            "privacy페이지", r["privacy_page"]["h1"],
        )
    print("\n문제:", problems if problems else "없음")
    if problems:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
