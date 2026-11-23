"""상황별 카톡 카드 이미지 · 내가 만든 카드 업로드 검증.

확인 항목
1. 상황별 주소의 og:image 가 서로 다른 카드(/images/share-*.png)를 가리키고, 그 주소가 모두 200 image/png
2. /api/share-image 로 카드 PNG 를 올리면 200 이고, 돌려받은 주소가 200 image/png 로 열린다(카카오가 받아 가는 주소)
3. 앱에서 [카톡으로 보내기]를 누르면 sendDefault payload 의 content.imageUrl 이
   고정 배너(/share-card.png)가 아니라 **그 카드**의 주소이고, 클릭과 같은 콜스택에서 동기로 불린다
   - 홈 인사카드(내가 만든 카드 → 업로드 주소)
   - 가족 안부카드(내가 만든 카드 → 업로드 주소)

실행
    BASE=https://senior-life-platform.pages.dev python3 e2e/verify_share_cards.py
    (로컬 빌드는 python3 e2e/verify_share_cards.py — 단, 로컬에는 /api/share-image 가 없어 업로드 검사는 건너뛴다)
"""
import json
import os
import re
import sys
import time
import urllib.request

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

LIVE = os.environ.get("BASE", "").strip()
BASE = LIVE.rstrip("/") if LIVE else "http://127.0.0.1:8099"
CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
SHOT_DIR = "/workspace/downloads/neulbom_share_cards"
TAG = "live" if LIVE else "local"

SITUATIONS = {
    "/?tab=quiz": "/images/share-quiz.png",
    "/?tab=welfare": "/images/share-welfare.png",
    "/?tab=groups": "/images/share-group.png",
    "/?group=ZEPCVS": "/images/share-group.png",
    "/family/?code=ABCDEF": "/images/share-family.png",
    "/?share=greeting": "/images/share-greeting.png",
    "/?share=fortune": "/images/share-fortune.png",
    "/": "/share-card.png",
}

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
    "familyEvents": [],
    "health": {},
    "fontSize": 18,
    "lastVisit": "",
}

KAKAO_STUB = """
(() => {
  window.__kakaoCalls = [];
  window.__inClick = false;
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


UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"


def http(url, method="GET", body=None, headers=None):
    h = {"User-Agent": UA}
    h.update(headers or {})
    req = urllib.request.Request(url, method=method, data=body, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()


def main():
    ok = True
    results = []

    def check(name, cond, detail=""):
        nonlocal ok
        print(("PASS " if cond else "FAIL ") + name + (f" — {detail}" if detail else ""))
        if not cond:
            ok = False
        results.append((name, bool(cond), detail))

    # ---------- 1) 상황별 og:image ----------
    print("\n== 상황별 og:image ==")
    seen = {}
    for path, want in SITUATIONS.items():
        status, _, body = http(BASE + path)
        html = body.decode("utf-8", "ignore")
        og = (re.search(r'<meta property="og:image" content="([^"]*)"', html) or [None, ""])[1]
        seen[path] = og
        check(f"og:image {path} → {want}", og.endswith(want), og)
        if og:
            code, headers, data = http(og)
            ctype = headers.get("Content-Type", "")
            check(f"이미지 200 image/png {want}", code == 200 and "image/png" in ctype,
                  f"{code} {ctype} {len(data)}B")
    print("서로 다른 카드 수:", len({v for v in seen.values()}), "/", len(SITUATIONS))
    check("상황마다 다른 카드(중복 없이 6종 이상)", len({v for v in seen.values()}) >= 6)

    # 혜택 하나를 가리키는 링크 — 그 혜택의 이름·금액이 미리보기에 뜨는지
    status, _, body = http(BASE + "/?tab=welfare&program=basic-pension")
    html = body.decode("utf-8", "ignore")
    og_title = (re.search(r'<meta property="og:title" content="([^"]*)"', html) or [None, ""])[1]
    og_desc = (re.search(r'<meta property="og:description" content="([^"]*)"', html) or [None, ""])[1]
    og_img = (re.search(r'<meta property="og:image" content="([^"]*)"', html) or [None, ""])[1]
    check("혜택 링크 og:title 에 혜택 이름", "기초연금" in og_title, og_title)
    check("혜택 링크 og:description 에 금액·문의", "349,700" in og_desc and "주민센터" in og_desc, og_desc)
    check("혜택 링크 og:image = 복지 카드", og_img.endswith("/images/share-welfare.png"), og_img)

    # ---------- 2) 업로드 API ----------
    print("\n== /api/share-image ==")
    png = open("/workspace/work/senior-platform/public/images/share-quiz.png", "rb").read()
    import base64

    payload = json.dumps({"k": "quiz", "d": "data:image/png;base64," + base64.b64encode(png).decode()}).encode()
    code, _, body = http(BASE + "/api/share-image", "POST", payload, {"content-type": "application/json"})
    out = json.loads(body or b"{}")
    check("카드 업로드 200", code == 200 and out.get("ok") is True, f"{code} {str(out)[:120]}")
    card_url = out.get("url") or ""
    if card_url:
        code, headers, data = http(card_url)
        check("업로드 카드 주소 200 image/png", code == 200 and "image/png" in headers.get("Content-Type", ""),
              f"{code} {headers.get('Content-Type')} {len(data)}B")
        check("올린 바이트와 같은 이미지", len(data) == len(png))
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, *a, **k):
                return None

        opener = urllib.request.build_opener(NoRedirect)
        try:
            r = opener.open(
                urllib.request.Request(BASE + "/api/share-image?k=quiz&h=000000000000000000000000", headers={"User-Agent": UA}),
                timeout=20,
            )
            code2, loc2 = r.status, r.headers.get("Location", "")
        except urllib.error.HTTPError as e:
            code2, loc2 = e.code, e.headers.get("Location", "")
        check("없는 카드는 상황별 기본 카드로 302", code2 == 302 and loc2.endswith("/images/share-quiz.png"),
              f"{code2} {loc2}")

    # ---------- 3) 앱 → 카톡 payload ----------
    print("\n== 카톡 보내기 payload ==")
    httpd = None
    if not LIVE:
        from harness import start_server

        httpd = start_server()

    uploads = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844}, device_scale_factor=3, locale="ko-KR", is_mobile=True, has_touch=True
        )
        ctx.add_init_script(KAKAO_STUB)
        page = ctx.new_page()

        def watch(resp):
            if "/api/share-image" in resp.url and resp.request.method == "POST":
                try:
                    uploads.append(resp.json().get("url", ""))
                except Exception:
                    uploads.append("")

        page.on("response", watch)
        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=45000)
        page.wait_for_timeout(1500)

        # 홈 → 인사카드 만들기 → 카톡으로 보내기
        page.locator("[data-home-greeting]").first.click()
        page.wait_for_selector("[data-sheet-close]", timeout=15000)
        page.wait_for_timeout(2200)
        page.get_by_role("button", name=re.compile("카톡으로 보내기")).first.click()
        page.wait_for_selector("[data-share-sheet]", timeout=15000)
        page.wait_for_timeout(2500)  # 카드 그리기 + 조용한 업로드
        page.get_by_role("button", name=re.compile("카카오톡으로 바로 보내기")).first.click()
        page.wait_for_timeout(1200)

        calls = page.evaluate("window.__kakaoCalls") or []
        check("인사카드 sendDefault 호출", len(calls) >= 1, f"{len(calls)}회")
        if calls:
            c = calls[0]
            img = str(c["payload"].get("content", {}).get("imageUrl", ""))
            check("인사카드 imageUrl = 올려 둔 그 카드", "/api/share-image?k=greeting&h=" in img or "/images/share-greeting.png" in img, img)
            check("업로드한 주소와 일치", bool(uploads) and img == uploads[-1], f"upload={uploads[-1] if uploads else None}")
            check("클릭과 같은 콜스택(동기) 호출", c["inClick"] is True)
        os.makedirs(SHOT_DIR, exist_ok=True)
        page.screenshot(path=f"{SHOT_DIR}/home-greeting-sent-{TAG}.png")

        # 더보기 → 가족 확인 화면 → 안부 카드 보내기 (가족은 탭이 아니라 더보기 안에 있다)
        page.goto(BASE + "/?tab=more", wait_until="domcontentloaded")
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=45000)
        page.wait_for_timeout(1500)
        page.get_by_role("button", name=re.compile("가족 확인 화면")).first.click()
        page.wait_for_timeout(2500)
        btn = page.get_by_role("button", name=re.compile("안부 카드 보내기")).first
        check("가족 탭 안부 카드 보내기 버튼 있음", btn.count() > 0)
        if btn.count():
            before_uploads = len(uploads)
            btn.click()
            page.wait_for_timeout(1800)
            calls2 = page.evaluate("window.__kakaoCalls") or []
            check("가족 안부 sendDefault 호출", len(calls2) >= 1, f"{len(calls2)}회")
            if calls2:
                img = str(calls2[0]["payload"].get("content", {}).get("imageUrl", ""))
                check(
                    "가족 안부 imageUrl = 업로드 카드/가족 카드",
                    "/api/share-image?k=family&h=" in img or "/images/share-family.png" in img,
                    img,
                )
                print("  family uploads:", uploads[before_uploads:])

        # ---------- 혜택 상세 모달: 중복 닫기 정리 + 카톡 공유 ----------
        print("\n== 혜택 상세 모달 ==")
        page.goto(BASE + "/?tab=welfare&program=basic-pension", wait_until="domcontentloaded")
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=45000)
        page.wait_for_selector("text=이렇게 하세요 (3단계)", timeout=20000)
        page.wait_for_timeout(900)

        close_btns = page.locator("button:text-is('닫기')")
        check("시트 안 ‘닫기’ 버튼 1개(중복 없음)", close_btns.count() == 1, f"{close_btns.count()}개")
        check("상단 ✕ 닫기 감춤", page.locator("[data-sheet-close]").count() == 0)
        share_btn = page.locator("[data-welfare-share] button").first
        check("혜택 모달에 ‘카톡 공유’ 버튼", share_btn.count() > 0 and "카톡" in share_btn.inner_text())
        page.screenshot(path=f"{SHOT_DIR}/welfare-detail-share-{TAG}.png")

        page.evaluate("window.__kakaoCalls = []")
        share_btn.click()
        page.wait_for_timeout(1200)
        calls3 = page.evaluate("window.__kakaoCalls") or []
        check("혜택 카톡 공유 sendDefault 호출", len(calls3) >= 1, f"{len(calls3)}회")
        if calls3:
            c = calls3[0]
            content = c["payload"].get("content", {})
            img = str(content.get("imageUrl", ""))
            link = str((content.get("link") or {}).get("mobileWebUrl", ""))
            check("혜택 제목이 카드 제목에", "기초연금" in str(content.get("title", "")), str(content.get("title")))
            check(
                "금액·문의가 카드 설명에",
                "349,700" in str(content.get("description", "")) and "주민센터" in str(content.get("description", "")),
                str(content.get("description")),
            )
            check("혜택 카드 이미지 = share-welfare.png", img.endswith("/images/share-welfare.png"), img)
            check("링크에 program=<id>", "program=basic-pension" in link, link)
            check("클릭과 같은 콜스택(동기) 호출", c["inClick"] is True)
        browser.close()

    if httpd:
        httpd.shutdown()

    print("\nRESULT:", "PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
