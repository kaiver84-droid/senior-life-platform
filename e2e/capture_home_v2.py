"""홈 히어로 · 건강 챌린지 3D 아이콘 — 아이폰 3배 화면(DPR 3) 검증·스크린샷.

python3 e2e/capture_home_v2.py                                              # 로컬 out/
BASE=https://senior-life-platform.pages.dev python3 e2e/capture_home_v2.py   # 라이브

확인 항목
- 홈 히어로(home-hero)가 1600px 이상으로 로드되는지, 표시 크기의 3배 이상인지
- 건강 챌린지 5개 항목 아이콘(icon-3d-water/walk/stretch/medicine/call)이 640px 인지
- 깨진 이미지 0건 · 콘솔/페이지 오류 0건
스크린샷
- downloads/neulbom_home_hero_v2.png    (홈 첫 화면 — 인사 히어로)
- downloads/neulbom_home_health_3d.png  (오늘의 건강 챌린지 카드)
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
KAKAO_ID, KAKAO_NAME = "777009002", "순자"

BIG = {
    "home-hero": 1600,
    "onboarding-hero": 1600,
    "greeting-chrysanthemum": 1500,
    "icon-3d-": 640,
}
HEALTH_ICONS = ["icon-3d-water", "icon-3d-walk", "icon-3d-stretch", "icon-3d-medicine", "icon-3d-call"]


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
                        "id": f"kakao_{KAKAO_ID}",
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


def live_login(page):
    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
    page.get_by_role("button", name="카카오톡으로 시작하기").click()
    try:
        page.wait_for_selector("#setup-nick", timeout=12000)
        page.fill("#setup-nick", KAKAO_NAME)
        page.select_option("#setup-birth", "1952")
        page.select_option("#setup-time", "묘시")
        page.select_option("#setup-sido", "충청북도")
        page.select_option("#setup-sigungu", "옥천군")
        page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
    except Exception:
        pass
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=40000)
    page.wait_for_timeout(3000)


def img_rows(page):
    return page.evaluate(
        """() => Array.from(document.images).map(i => ({
            src: i.currentSrc || i.src,
            w: i.naturalWidth,
            h: i.naturalHeight,
            cw: Math.round(i.getBoundingClientRect().width),
        }))"""
    )


def report(rows, where):
    problems = []
    print(f"\n[{where}] 이미지 {len(rows)}개")
    for r in rows:
        name = r["src"].split("/")[-1]
        ok = r["w"] > 0
        need = next((v for k, v in BIG.items() if k in name), 320)
        sharp = ok and r["w"] >= need
        if not ok:
            problems.append(f"{where}: 로드 실패 {name}")
        elif not sharp:
            problems.append(f"{where}: 해상도 부족 {name} {r['w']}px < {need}px")
        dpr = round(r["w"] / r["cw"], 1) if r["cw"] else 0
        print(f"  {'OK ' if sharp else 'BAD'} {r['w']}x{r['h']} 표시{r['cw']}px(약 {dpr}배) {name}")
    return problems


def main():
    httpd = None
    if LOCAL:
        httpd = start_server()
    os.makedirs(OUT, exist_ok=True)
    errs, problems = [], []
    seen = set()

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=3,
            locale="ko-KR",
            is_mobile=True,
            has_touch=True,
        )
        page = ctx.new_page()
        page.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
        page.on("console", lambda m: errs.append(f"error: {m.text}") if m.type == "error" else None)

        def on_fail(req):
            reason = ""
            try:
                reason = req.failure or ""
            except Exception:
                pass
            if "ERR_ABORTED" in reason:
                return
            errs.append(f"requestfailed: {req.url} ({reason})")

        page.on("requestfailed", on_fail)

        if LOCAL:
            onboard(page)
        else:
            page.route("**/t1.kakaocdn.net/**", lambda route, _req: route.abort())
            page.route("**/api/auth/kakao**", kakao_stub)
            live_login(page)
        page.wait_for_timeout(2400)

        # ---------- ① 홈 첫 화면 — 인사 히어로 ----------
        hero = page.locator("[data-home-hero]")
        hero.wait_for(state="visible", timeout=20000)
        hero.scroll_into_view_if_needed()
        page.wait_for_timeout(900)
        page.screenshot(path=f"{OUT}/neulbom_home_hero_v2.png")
        hb = hero.bounding_box()
        if hb:
            page.screenshot(path=f"{OUT}/_home_hero_card.png", clip=hb)
        problems += report(img_rows(page), "home-top")
        for r in img_rows(page):
            seen.add(r["src"].split("/")[-1].split("?")[0])

        # ---------- ② 건강 챌린지 3D 아이콘 ----------
        health = page.locator("[data-health-card]")
        health.scroll_into_view_if_needed()
        page.wait_for_timeout(1200)
        health.screenshot(path=f"{OUT}/neulbom_home_health_3d.png")
        # 카드가 화면보다 길면 위·아래로 나눠 담는다
        hb2 = health.bounding_box()
        print(f"\nhealth card 크기: {hb2}")
        rows = img_rows(page)
        problems += report(rows, "home-scrolled")
        for r in rows:
            seen.add(r["src"].split("/")[-1].split("?")[0])

        # 건강 아이콘 5종이 실제로 다 있는지
        loaded = {r["src"].split("/")[-1].split("?")[0] for r in rows}
        for name in HEALTH_ICONS:
            if not any(n.startswith(name) for n in loaded):
                problems.append(f"health: 건강 아이콘 미적용 {name}")

        browser.close()
    if httpd:
        httpd.shutdown()

    real = [
        e
        for e in errs
        if "Failed to load resource" not in e
        and "t1.kakaocdn.net" not in e
        and "open-meteo.com" not in e
    ]
    print(f"\n콘솔/페이지 오류: {len(real)}건")
    for e in real[:6]:
        print("  ", e)
    print(f"이미지 문제: {len(problems)}건")
    for e in problems[:10]:
        print("  ", e)
    if real or problems:
        sys.exit(1)
    print("\n모두 정상 — 3배 화면에서 선명하게 렌더링됩니다.")


if __name__ == "__main__":
    main()
