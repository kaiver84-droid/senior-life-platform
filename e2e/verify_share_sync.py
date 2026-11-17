"""카톡 공유 동기 호출 + 홈 화면 '가족안부달력 / 오늘의 운세' 순서 검증.

로컬 out/ 정적 빌드를 띄우고(또는 BASE 로 라이브), 카카오 SDK 자리에 가짜 객체를 넣어
- '카카오톡으로 바로 보내기' 클릭과 **같은 작업(task)** 안에서 sendDefault 가 불렸는지
- payload.installTalk 가 false 인지, 이미지가 /share-card.png 인지
- talk-apps.kakao.com 으로 이동하는 요청이 없는지
- 홈에서 '가족안부달력' 배너가 '오늘의 운세' 카드보다 위에 있는지
를 확인한다. 홈 스크린샷도 저장한다.

실행: python3 e2e/verify_share_sync.py            # 로컬 빌드(out/)
      BASE=https://senior-life-platform.pages.dev python3 e2e/verify_share_sync.py
"""
import json
import os
import re
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

LIVE = os.environ.get("BASE", "").strip()
BASE = LIVE.rstrip("/") if LIVE else "http://127.0.0.1:8099"
CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
SHOT_DIR = "/workspace/downloads/neulbom_audit"
TAG = "live" if LIVE else "local"

PROFILE = {
    "id": "kakao_999000777",
    "nickname": "공유점검",
    "birthYear": 1952,
    "birthTime": "묘시",
    "sido": "충청북도",
    "sigungu": "옥천군",
    "createdAt": "2026-11-01T00:00:00.000Z",
    "source": "kakao",
    "profileCompleted": True,
}
STATE = {
    "version": 1,
    "profile": PROFILE,
    "quizLogs": [],
    "daily": None,
    "med": {},
    "visits": [],
    "familyEvents": [
        {"id": "ev1", "title": "손녀 생일", "date": "2026-11-21", "repeatYearly": True, "kind": "birthday"}
    ],
    "health": {},
    "fontSize": 18,
    "lastVisit": "",
}

# 가짜 Kakao SDK: 클릭과 같은 작업에서 불렸는지(__inClick)까지 기록한다.
KAKAO_STUB = """
(() => {
  window.__kakaoCalls = [];
  window.__inClick = false;
  window.__kakaoListeners = [];
  document.addEventListener('click', () => {
    window.__inClick = true;
    setTimeout(() => { window.__inClick = false; }, 0);
  }, true);
  const Kakao = {
    isInitialized: () => true,
    init: () => {},
    Auth: { authorize: () => {} },
    Share: {
      sendDefault: (payload) => {
        window.__kakaoCalls.push({ payload, inClick: window.__inClick, at: Date.now() });
        return Promise.resolve({});
      },
    },
  };
  Object.defineProperty(window, 'Kakao', { value: Kakao, configurable: true, writable: true });
  try { localStorage.setItem('seniorLife.v1', %s); } catch (e) {}
})();
""" % json.dumps(json.dumps(STATE))


def main():
    errors, fails, navigations = [], [], []
    ok = True

    def check(name, cond, detail=""):
        nonlocal ok
        print(("PASS " if cond else "FAIL ") + name + (f" — {detail}" if detail else ""))
        if not cond:
            ok = False

    httpd = None
    if not LIVE:
        from harness import start_server

        httpd = start_server()

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=3,
            locale="ko-KR",
            is_mobile=True,
            has_touch=True,
        )
        ctx.add_init_script(KAKAO_STUB)
        page = ctx.new_page()
        page.on("console", lambda m: errors.append(f"{m.type}: {m.text[:200]}") if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on("response", lambda r: fails.append(f"{r.status} {r.url[:110]}") if r.status >= 400 else None)
        page.on("request", lambda r: navigations.append(r.url) if "talk-apps.kakao.com" in r.url else None)

        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=45000)
        page.wait_for_timeout(1800)

        # ---------- 홈 배치: 가족안부달력이 오늘의 운세보다 위 ----------
        cal = page.get_by_role("button", name=re.compile("가족안부달력|열기")).filter(
            has_text=re.compile("가족안부달력|생일·기념일|손녀 생일|열기")
        ).first
        fortune = page.get_by_role("button", name=re.compile("오늘의 운세")).first
        cal_box = cal.bounding_box()
        fortune_box = fortune.bounding_box()
        print("calendar top:", cal_box and round(cal_box["y"]), "| fortune top:", fortune_box and round(fortune_box["y"]))
        check("가족안부달력이 오늘의 운세보다 위", bool(cal_box and fortune_box and cal_box["y"] < fortune_box["y"]))
        check("가족안부달력이 화면 한 눈에 들어오는 위치(운세 바로 위)", bool(cal_box and fortune_box and 0 < fortune_box["y"] - cal_box["y"] < 220))

        top = max((cal_box["y"] if cal_box else 0) - 24, 0)
        bottom = (fortune_box["y"] + fortune_box["height"] + 24) if fortune_box else 900
        os.makedirs(SHOT_DIR, exist_ok=True)
        page.screenshot(
            path=f"{SHOT_DIR}/home-calendar-above-fortune-{TAG}.png",
            full_page=True,
            clip={"x": 0, "y": top, "width": 390, "height": min(bottom - top, 1100)},
        )
        page.screenshot(path=f"{SHOT_DIR}/home-full-{TAG}.png", full_page=True)

        # ---------- 카톡 공유: 클릭과 같은 작업에서 동기 호출 ----------
        page.get_by_role("button", name=re.compile("인사카드 만들기")).first.click()
        page.wait_for_selector("[data-sheet-close]", timeout=15000)
        page.wait_for_timeout(2500)
        page.get_by_role("button", name=re.compile("카톡으로 보내기")).first.click()
        page.wait_for_selector("[data-share-sheet]", timeout=15000)
        page.wait_for_timeout(1200)
        before = len(errors)
        page.get_by_role("button", name=re.compile("카카오톡으로 바로 보내기")).first.click()
        page.wait_for_timeout(1500)

        calls = page.evaluate("window.__kakaoCalls")
        toast = page.locator("[aria-live='polite']").inner_text().strip()
        print("calls:", json.dumps(calls, ensure_ascii=False)[:600])
        print("toast:", repr(toast))
        print("sheet closed:", page.locator("[data-share-sheet]").count() == 0)

        check("sendDefault 1회 호출", len(calls) == 1, f"{len(calls)}회")
        if calls:
            payload = calls[0]["payload"]
            check("클릭과 같은 작업(동기)에서 호출", calls[0]["inClick"] is True)
            check("installTalk === false", payload.get("installTalk") is False, str(payload.get("installTalk")))
            check("imageUrl = /share-card.png", str(payload.get("content", {}).get("imageUrl", "")).endswith("/share-card.png"))
            check("feed 카드 제목 있음", bool(payload.get("content", {}).get("title")))
        check("talk-apps.kakao.com 이동 없음", len(navigations) == 0, str(navigations[:3]))
        check("새 콘솔 오류 없음", len(errors) == before, str(errors[before:]))

        print("http 4xx/5xx:", fails)
        browser.close()

    if httpd:
        httpd.shutdown()
    print("\nRESULT:", "PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
