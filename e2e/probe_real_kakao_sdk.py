"""실제 카카오 JS SDK 로 '카카오톡으로 바로 보내기' 클릭 점검.

- 실제 SDK(t1.kakaocdn.net/kakao_js_sdk/2.7.4) 를 그대로 쓰고
- sendDefault 는 **감싸서(spy)** 호출 시점과 payload 만 기록하고 실제 전환은 하지 않는다
  (헤드리스 브라우저에서 kakaolink:// 를 열 수 없어서 앱 전환 대신 기록만 한다).
- SDK 가 클릭 전에 이미 로드·초기화됐는지, 클릭과 같은 작업에서 호출됐는지,
  talk-apps.kakao.com(다운로드 안내) 으로 나가는 요청이 없는지 본다.

실행: python3 e2e/probe_real_kakao_sdk.py            # 로컬 out/
      BASE=https://senior-life-platform.pages.dev python3 e2e/probe_real_kakao_sdk.py
"""
import json
import os
import re
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
LIVE = os.environ.get("BASE", "").strip()
BASE = LIVE.rstrip("/") if LIVE else "http://127.0.0.1:8099"
TAG = "live" if LIVE else "local"
STATE = {
    "version": 1,
    "profile": {
        "id": "kakao_999000777",
        "nickname": "공유점검",
        "birthYear": 1952,
        "birthTime": "묘시",
        "sido": "충청북도",
        "sigungu": "옥천군",
        "createdAt": "2026-11-01T00:00:00.000Z",
        "source": "kakao",
        "profileCompleted": True,
    },
    "quizLogs": [],
    "daily": None,
    "med": {},
    "visits": [],
    "familyEvents": [],
    "health": {},
    "fontSize": 18,
    "lastVisit": "",
}

SPY = """
(() => {
  window.__calls = [];
  window.__inClick = false;
  document.addEventListener('click', () => {
    window.__inClick = true;
    setTimeout(() => { window.__inClick = false; }, 0);
  }, true);
  window.__spy = () => {
    if (!window.Kakao || !window.Kakao.Share || window.__spied) return !!window.__spied;
    const orig = window.Kakao.Share.sendDefault;
    window.Kakao.Share.sendDefault = (payload) => {
      window.__calls.push({ payload, inClick: window.__inClick });
      return Promise.resolve({});
    };
    window.__spied = true;
    return true;
  };
})();
"""

httpd = None
if not LIVE:
    from harness import start_server

    httpd = start_server()

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, locale="ko-KR", is_mobile=True, has_touch=True)
    ctx.add_init_script("try{localStorage.setItem('seniorLife.v1', %s);}catch(e){}" % json.dumps(json.dumps(STATE)))
    ctx.add_init_script(SPY)
    page = ctx.new_page()
    errors, talk, fails = [], [], []
    page.on("console", lambda m: errors.append(f"{m.type}: {m.text[:160]}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("request", lambda r: talk.append(r.url) if "talk-apps.kakao.com" in r.url else None)
    page.on("response", lambda r: fails.append(f"{r.status} {r.url[:100]}") if r.status >= 400 else None)

    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=45000)
    page.wait_for_timeout(3500)
    ready = page.evaluate("() => !!window.Kakao && window.Kakao.isInitialized()")
    print("SDK loaded & initialized before any share tap:", ready)
    page.evaluate("window.__spy()")

    url_before = page.url
    page.get_by_role("button", name=re.compile("인사카드 만들기")).first.click()
    page.wait_for_selector("[data-sheet-close]", timeout=15000)
    page.wait_for_timeout(2500)
    page.get_by_role("button", name=re.compile("카톡으로 보내기")).first.click()
    page.wait_for_selector("[data-share-sheet]", timeout=15000)
    page.wait_for_timeout(1200)
    page.get_by_role("button", name=re.compile("카카오톡으로 바로 보내기")).first.click()
    page.wait_for_timeout(1200)

    calls = page.evaluate("window.__calls")
    print("url:", url_before, "→", page.url)
    print("calls:", len(calls), "| inClick:", [c.get("inClick") for c in calls], "| installTalk:", [c.get("payload", {}).get("installTalk") for c in calls])
    print("toast:", repr(page.locator("[aria-live='polite']").inner_text().strip()))
    print("talk-apps requests:", talk)
    print("console errors:", errors)
    print("http 4xx/5xx:", fails)
    page.screenshot(path=f"/workspace/downloads/neulbom_audit/real-sdk-after-send-{TAG}.png")
    b.close()

if httpd:
    httpd.shutdown()
