"""카카오톡 원터치 간편로그인(throughTalk) 라이브 검증.

BASE=https://senior-life-platform.pages.dev python3 e2e/test_kakao_talk.py

확인 항목
1) GET /api/auth/kakao → kakaoLoginConfigured / kakaoJsConfigured / redirectUri
2) 온보딩 [카카오톡으로 시작하기] 클릭 → Kakao JS SDK(Auth.authorize, throughTalk:true) 가
   kauth.kakao.com/oauth/authorize 로 이동하는지(through_talk=true, client_id=JS 키,
   redirect_uri=서버가 토큰 교환에 쓰는 값과 동일) 와 콘솔 에러 0건
3) 카카오 화면이 오류 코드(KOE 등) 없이 뜨는지
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", "https://senior-life-platform.pages.dev").rstrip("/")
SHOT = "/workspace/downloads"
IPHONE_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
)


def api(path):
    req = urllib.request.Request(BASE + path, headers={"User-Agent": "Mozilla/5.0 (E2E check)"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.status, json.loads(r.read().decode())


def main():
    out = {}
    status, info = api("/api/auth/kakao")
    out["api"] = {"status": status, **info}
    server_redirect = info.get("redirectUri")

    console_errors = []
    requests = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=3,
            user_agent=IPHONE_UA,
            locale="ko-KR",
            is_mobile=True,
            has_touch=True,
        )
        page = ctx.new_page()
        page.on("console", lambda m: console_errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: console_errors.append(f"pageerror: {e}"))
        page.on("request", lambda r: requests.append(r.url))

        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_selector("text=카카오톡으로 시작하기", timeout=25000)
        page.wait_for_timeout(1500)  # /api/auth/kakao 상태 조회 대기

        btn = page.get_by_role("button", name="카카오톡으로 시작하기")
        out["button_visible"] = btn.is_visible()
        page.screenshot(path=f"{SHOT}/kakao_talk_before.png")

        with page.expect_navigation(timeout=25000):
            btn.click()
        page.wait_for_load_state("domcontentloaded", timeout=25000)
        page.wait_for_timeout(2500)

        out["landed_url"] = page.url
        q = urllib.parse.parse_qs(urllib.parse.urlparse(page.url).query)
        out["params"] = {k: v[0] for k, v in q.items()}
        out["sdk_loaded"] = any("kakao_js_sdk" in u or "kakao.min.js" in u for u in requests)
        out["redirect_matches"] = q.get("redirect_uri", [""])[0] == server_redirect
        out["through_talk"] = q.get("through_talk", [""])[0]
        out["authorize_host"] = urllib.parse.urlparse(page.url).netloc

        body_text = page.inner_text("body")[:800] if page.query_selector("body") else ""
        out["page_text_head"] = re.sub(r"\s+", " ", body_text)[:400]
        out["error_codes"] = sorted(set(re.findall(r"\b(KOE\d{3}|KOE\d+)\b", body_text)))
        out["console_errors"] = console_errors
        page.screenshot(path=f"{SHOT}/kakao_talk_landed.png")

        ctx.close()
        browser.close()

    print(json.dumps(out, ensure_ascii=False, indent=2))
    ok = (
        out.get("button_visible")
        and out.get("authorize_host") == "kauth.kakao.com"
        and out.get("through_talk") == "true"
        and out.get("redirect_matches")
        and not out.get("console_errors")
    )
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
