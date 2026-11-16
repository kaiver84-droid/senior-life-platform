"""라이브(Cloudflare Pages) 검증 — 우리동네 소식 지역 전환 · 모임 접속 인원 · 카카오 키/리다이렉트.

BASE=https://senior-life-platform.pages.dev python3 e2e/test_live_final.py
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


def api(path):
    req = urllib.request.Request(BASE + path, headers={"User-Agent": "Mozilla/5.0 (E2E)"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read().decode())


KAKAO_ID = os.environ.get("STUB_KAKAO_ID", "777000333")


def stub_kakao(page):
    """카카오 인가 화면만 스텁한다(실제 로그인은 사용자 본인만 가능). 페이지·API·DB 는 라이브 그대로."""

    def _kakao(route, request):
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
                            "id": f"kakao_{KAKAO_ID}",
                            "nickname": "카카오순자",
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
                        "redirectUri": BASE,
                    }
                ),
            )

    page.route("**/api/auth/kakao**", _kakao)


def onboard_demo(page):
    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
    page.get_by_role("button", name="카카오톡으로 시작하기").click()
    # 서버에 저장된 프로필이 있으면 초기 설정을 건너뛰고 바로 홈으로 들어간다.
    page.wait_for_selector("#setup-nick, nav[aria-label='주요 메뉴']", timeout=30000)
    if page.query_selector("#setup-nick"):
        page.fill("#setup-nick", "순자")
        page.select_option("#setup-birth", "1952")
        page.select_option("#setup-time", "묘시")
        page.select_option("#setup-sido", "충청북도")
        page.select_option("#setup-sigungu", "옥천군")
        page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
    page.wait_for_timeout(1200)


def main():
    res = {}
    errors = []
    http_fails = []
    kakao_reqs = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            locale="ko-KR",
            is_mobile=True,
            has_touch=True,
        )
        page = ctx.new_page()
        page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on("request", lambda r: kakao_reqs.append(r.url) if "kakao" in r.url else None)
        page.on("response", lambda r: http_fails.append(f"{r.status} {r.url[:110]}") if r.status >= 400 else None)

        stub_kakao(page)
        onboard_demo(page)

        # ---------- 모임 접속 인원 ----------
        page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name="모임").click()
        page.wait_for_timeout(1800)
        demo_btn = page.get_by_role("button", name=re.compile("체험 모임 들어가기"))
        if demo_btn.count():
            demo_btn.first.click()
            page.wait_for_timeout(2600)
        body = page.locator("body").inner_text()
        m = re.search(r"지금 (\d+)명 접속 중", body)
        res["group_badge"] = m.group(0) if m else None
        res["group_online_count"] = int(m.group(1)) if m else 0
        res["member_online_dots"] = body.count("접속 중")
        page.screenshot(path=f"{SHOT}/neulbom_group_presence_live.png", full_page=False)

        # ---------- 우리동네 소식 — 옥천 → 부산 해운대구 → 서울 강남구 ----------
        page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name="홈").click()
        page.wait_for_timeout(1200)
        page.get_by_text("가족안부달력").first.click()
        page.wait_for_selector("text=다가오는 일정과 소식", timeout=20000)
        page.wait_for_timeout(600)
        res["area_default"] = page.get_by_label("우리동네 소식 지역 바꾸기").inner_text().replace("\n", " ")
        okcheon_text = page.locator("section").nth(6).inner_text()

        def switch(sido, sigungu, shot=None, wait_toast=True):
            page.get_by_label("우리동네 소식 지역 바꾸기").click()
            page.wait_for_selector("#news-sido", timeout=15000)
            page.select_option("#news-sido", sido)
            page.wait_for_timeout(350)
            page.select_option("#news-sigungu", sigungu)
            page.wait_for_timeout(350)
            preview = page.get_by_text(re.compile(r"에서 앞으로 넉 달")).first.inner_text()
            page.get_by_role("button", name=re.compile(f"{sigungu} 소식 보기")).click()
            page.wait_for_timeout(1600 if wait_toast else 400)
            if shot:
                page.wait_for_timeout(3400)  # 안내 토스트가 사라진 뒤에 찍는다
                page.get_by_text("다가오는 일정과 소식").first.scroll_into_view_if_needed()
                page.wait_for_timeout(600)
                page.screenshot(path=f"{SHOT}/{shot}", full_page=False)
            return preview

        res["preview_busan"] = switch("부산광역시", "해운대구", "neulbom_local_news_busan.png")
        body_busan = page.locator("body").inner_text()
        res["busan_area"] = page.get_by_label("우리동네 소식 지역 바꾸기").inner_text().replace("\n", " ")
        res["busan_link_visible"] = "해운대구 바로가기" in body_busan
        res["busan_only_busan"] = ("부산 해운대구 보건소" in body_busan) or ("부산 해운대구 행정복지센터" in body_busan)

        res["preview_seoul"] = switch("서울특별시", "강남구", "neulbom_local_news_seoul.png")
        body_seoul = page.locator("body").inner_text()
        res["seoul_area"] = page.get_by_label("우리동네 소식 지역 바꾸기").inner_text().replace("\n", " ")
        res["seoul_link_visible"] = "강남구 바로가기" in body_seoul
        res["seoul_only_seoul"] = ("서울 강남구 행정복지센터" in body_seoul) or ("서울 강남구 보건소" in body_seoul)
        res["regions_differ"] = body_busan != body_seoul

        # 옥천(내 지역)으로 복귀
        page.get_by_label("우리동네 소식 지역 바꾸기").click()
        page.wait_for_selector("#news-sido", timeout=15000)
        page.get_by_role("button", name=re.compile("내 지역")).click()
        page.wait_for_timeout(1200)
        res["back_area"] = page.get_by_label("우리동네 소식 지역 바꾸기").inner_text().replace("\n", " ")
        page.get_by_role("button", name="달력 닫기").click()
        page.wait_for_timeout(600)

        # ---------- 카카오 공유 → sharer.kakao.com app_key ----------
        page.evaluate(
            """() => {
              const link = { mobileWebUrl: location.origin, webUrl: location.origin };
              window.Kakao.Share.sendDefault({
                objectType: "feed",
                content: { title: "늘봄 검증", description: "카카오 키 확인", imageUrl: location.origin + "/icon-512.png", imageWidth: 512, imageHeight: 512, link },
                buttons: [{ title: "늘봄 열기", link }],
              });
            }"""
        )
        page.wait_for_timeout(4000)

        # ---------- 카카오 JS 키 — 실제 SDK 초기화 + 공유 요청의 app_key ----------
        fresh = browser.new_context(
            viewport={"width": 390, "height": 844}, locale="ko-KR", is_mobile=True, has_touch=True
        )
        key_page = fresh.new_page()
        key_reqs = []
        key_page.on("request", lambda r: key_reqs.append(r.url) if "kakao" in r.url else None)
        key_page.goto(BASE + "/", wait_until="domcontentloaded")
        key_page.wait_for_timeout(4000)
        res["kakao_sdk_initialized"] = key_page.evaluate(
            "() => Boolean(window.Kakao && window.Kakao.isInitialized && window.Kakao.isInitialized())"
        )
        try:
            key_page.evaluate(
                """() => {
                  const link = { mobileWebUrl: location.origin, webUrl: location.origin };
                  window.Kakao.Share.sendDefault({
                    objectType: "feed",
                    content: { title: "늘봄 검증", description: "카카오 키 확인", imageUrl: location.origin + "/icon-512.png", imageWidth: 512, imageHeight: 512, link },
                    buttons: [{ title: "늘봄 열기", link }],
                  });
                }"""
            )
        except Exception as exc:  # noqa: BLE001
            res["send_error"] = str(exc)[:120]
        key_page.wait_for_timeout(5000)
        key_app_keys = set()
        for u in key_reqs:
            if "app_key" in u:
                q = urllib.parse.parse_qs(urllib.parse.urlparse(u).query)
                key_app_keys.update(q.get("app_key", []))
        res["kakao_requests"] = sorted({u.split("?")[0] for u in key_reqs if "sharer" in u or "kapi" in u or "kauth" in u})[:8]
        res["app_keys_seen"] = sorted(key_app_keys)
        res["console_errors"] = [e for e in errors if "favicon" not in e]
        res["http_4xx5xx"] = http_fails
        browser.close()

    # 서버 응답 확인
    res["api_kakao"] = api("/api/auth/kakao")
    res["api_news_busan"] = {k: api("/api/local-news?sido=%EB%B6%80%EC%82%B0%EA%B4%91%EC%97%AD%EC%8B%9C&sigungu=%ED%95%B4%EC%9A%B4%EB%8C%80%EA%B5%AC")[k] for k in ("ok", "area", "count")}
    print(json.dumps(res, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
