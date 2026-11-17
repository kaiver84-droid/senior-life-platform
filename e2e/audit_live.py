"""늘봄 라이브 전수 점검 — 온보딩·홈·모임·퀴즈·랭킹·혜택·더보기·달력·자녀화면.

BASE=https://senior-life-platform.pages.dev python3 e2e/audit_live.py --stage explore
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
SHOT = "/workspace/downloads/neulbom_audit"
os.makedirs(SHOT, exist_ok=True)

KAKAO_ID = os.environ.get("AUDIT_KAKAO_ID", "999000111")
STUB_CODE = "AUDIT-CODE-0001"

console_errors = []
page_errors = []
http_fails = []
failed_requests = []


def attach(page):
    page.on("console", lambda m: console_errors.append(f"{m.type}: {m.text[:300]}") if m.type == "error" else None)
    page.on("pageerror", lambda e: page_errors.append(str(e)[:300]))
    page.on(
        "response",
        lambda r: http_fails.append(f"{r.status} {r.request.method} {r.url[:120]}")
        if r.status >= 400
        else None,
    )
    page.on(
        "requestfailed",
        lambda r: failed_requests.append(f"{r.failure} {r.url[:120]}")
        if "cancelled" not in str(r.failure)
        else None,
    )


def stub_kakao(page):
    def _kakao(route, request):
        if "start=1" in request.url:
            route.fulfill(status=302, headers={"location": f"/?code={STUB_CODE}"})
        elif request.method == "POST":
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(
                    {
                        "ok": True,
                        "profile": {
                            "id": f"kakao_{KAKAO_ID}",
                            "nickname": "점검테스트",
                            "birthYear": 1952,
                            "source": "kakao",
                            "createdAt": "2026-11-17T00:00:00.000Z",
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
    page.route("**kauth.kakao.com/**", lambda route, request: route.fulfill(status=302, headers={"location": f"{BASE}/?code={STUB_CODE}"}))


def img_report(page):
    return page.evaluate(
        """() => Array.from(document.images).map(i => ({src: i.currentSrc || i.src, w: i.naturalWidth, h: i.naturalHeight, alt: i.alt, shown: i.getBoundingClientRect().width}))"""
    )


def overflow(page):
    return page.evaluate(
        """() => {
          const d = document.documentElement;
          const over = [];
          document.querySelectorAll('*').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.right > window.innerWidth + 2) {
              over.push((el.tagName + '.' + (el.className || '')).slice(0, 80) + ' right=' + Math.round(r.right));
            }
          });
          return {scrollW: d.scrollWidth, innerW: window.innerWidth, over: over.slice(0, 8)};
        }"""
    )


def labels(page):
    return page.evaluate(
        """() => Array.from(document.querySelectorAll('button, [role=button], a, select, input')).map(el => ({
            tag: el.tagName, text: (el.innerText || el.getAttribute('aria-label') || el.placeholder || '').trim().replace(/\\s+/g,' ').slice(0, 60),
            aria: el.getAttribute('aria-label') || '', sel: el.getAttribute('data-birthtime') || ''
        })).filter(x => x.text || x.aria)"""
    )


def shot(page, name):
    path = f"{SHOT}/{name}.png"
    page.screenshot(path=path, full_page=False)
    return path


def onboard(page, name="점검테스트", birth="1952", birth_time="묘시", sido="충청북도", sigungu="옥천군"):
    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
    page.get_by_role("button", name="카카오톡으로 시작하기").click()
    page.wait_for_selector("#setup-nick, nav[aria-label='주요 메뉴']", timeout=40000)
    if page.query_selector("#setup-nick"):
        page.fill("#setup-nick", name)
        page.select_option("#setup-birth", birth)
        page.click(f'[data-birthtime="{birth_time}"]')
        page.select_option("#setup-sido", sido)
        page.wait_for_timeout(300)
        page.select_option("#setup-sigungu", sigungu)
        page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=40000)
    page.wait_for_timeout(1500)


def nav(page, label):
    page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name=label).click()
    page.wait_for_timeout(1200)


def main():
    stage = sys.argv[sys.argv.index("--stage") + 1] if "--stage" in sys.argv else "explore"
    out = {"stage": stage}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=3,
            locale="ko-KR",
            is_mobile=True,
            has_touch=True,
            timezone_id="Asia/Seoul",
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        )
        page = ctx.new_page()
        attach(page)
        stub_kakao(page)

        # ---------- 온보딩 ----------
        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
        page.wait_for_timeout(1200)
        out["onboarding_images"] = img_report(page)
        out["onboarding_overflow"] = overflow(page)
        page.get_by_role("button", name="카카오톡으로 시작하기").click()
        page.wait_for_selector("#setup-nick, nav[aria-label='주요 메뉴']", timeout=40000)
        out["setup_shown"] = bool(page.query_selector("#setup-nick"))
        if out["setup_shown"]:
            out["birth_options"] = page.eval_on_selector_all("#setup-birth option", "els => els.map(e => e.value)")
            out["birthtime_order"] = page.eval_on_selector_all(
                "[data-birthtime]", "els => els.map(e => e.getAttribute('data-birthtime') + ':' + (e.innerText||'').split('\\n')[0])"
            )
            out["sido_options"] = page.eval_on_selector_all("#setup-sido option", "els => els.map(e => e.value)")
            out["setup_overflow"] = overflow(page)
            shot(page, "01-setup")
            page.fill("#setup-nick", "점검테스트")
            page.select_option("#setup-birth", "1987")
            page.click('[data-birthtime="모름"]')
            page.select_option("#setup-sido", "충청북도")
            page.wait_for_timeout(400)
            out["sigungu_options"] = page.eval_on_selector_all("#setup-sigungu option", "els => els.map(e => e.value)")
            page.select_option("#setup-sigungu", "옥천군")
            page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=40000)
        page.wait_for_timeout(2000)

        # ---------- 탭별 탐색 ----------
        tabs = ["홈", "모임", "퀴즈", "랭킹", "혜택", "더보기"]
        out["tabs"] = {}
        for t in tabs:
            nav(page, t)
            page.wait_for_timeout(1200)
            info = {
                "text": page.locator("main").inner_text()[:4000],
                "labels": labels(page),
                "overflow": overflow(page),
                "images_broken": [i for i in img_report(page) if i["w"] == 0],
                "shot": shot(page, f"02-tab-{t}"),
            }
            out["tabs"][t] = info

        out["console_errors"] = console_errors
        out["page_errors"] = page_errors
        out["http_fails"] = http_fails
        out["failed_requests"] = failed_requests
        browser.close()

    path = f"/workspace/tool-results/audit-{stage}.json"
    os.makedirs("/workspace/tool-results", exist_ok=True)
    with open(path, "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print("saved", path)
    print("console_errors", len(console_errors), console_errors[:6])
    print("page_errors", len(page_errors), page_errors[:4])
    print("http_fails", http_fails[:10])


if __name__ == "__main__":
    main()
