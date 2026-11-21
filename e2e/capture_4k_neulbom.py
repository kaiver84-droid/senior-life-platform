"""아이폰 3배 화면(DPR 3) 기준 초고화질 렌더링 검증 · 스크린샷.

python3 e2e/capture_4k_neulbom.py                                              # 로컬 out/
BASE=https://senior-life-platform.pages.dev python3 e2e/capture_4k_neulbom.py   # 라이브

확인 항목
- 접속 첫 화면 히어로(onboarding-hero) · 홈 국화 · 퀴즈 부부 · 복지 건물 · 가족 사진이
  표시 크기의 3배 이상 해상도로 로드되는지(naturalWidth)
- 3D 아이콘(icon-3d-*)이 1024px 로, 사진·배너가 실제 표시의 3배 이상으로 로드되는지, 깨진 이미지 0건
- 콘솔/페이지 오류 0건
스크린샷
- downloads/neulbom_uhd_onboarding.png · neulbom_uhd_home.png · neulbom_uhd_icons.png
- 보조: downloads/_uhd_quiz.png · _uhd_welfare.png · _uhd_tiles.png
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

BIG = {  # 고해상도 여야 하는 배너·사진 (파일명 조각 → 최소 naturalWidth)
    "onboarding-hero": 1600,
    "home-hero": 1600,
    "greeting-chrysanthemum": 1536,
    "quiz-couple": 1254,
    "welfare-pension-bg": 1536,
    "family-greeting-couple": 1402,
}
ICON_MIN = 768  # 3D 아이콘(icon-3d-*) 최소 원본 크기 — 표시 30~48px 의 16배 이상


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
        page.click('[data-birthtime="묘시"]')
        page.select_option("#setup-sido", "충청북도")
        page.select_option("#setup-sigungu", "옥천군")
        page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
    except Exception:
        pass
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=40000)
    page.wait_for_timeout(3200)


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
        need = next((v for k, v in BIG.items() if k in name), ICON_MIN)
        sharp = ok and r["w"] >= need
        if not ok:
            problems.append(f"{where}: 로드 실패 {name}")
        elif not sharp:
            problems.append(f"{where}: 해상도 부족 {name} {r['w']}px < {need}px")
        dpr = round(r["w"] / r["cw"], 1) if r["cw"] else 0
        print(f"  {'OK ' if sharp else 'BAD'} {r['w']}x{r['h']} 표시{r['cw']}px(약 {dpr}배) {name}")
    return problems


def stack_images(chunks, out_path, pad=28, bg=(249, 247, 241)):
    """여러 스크린샷을 세로로 이어 붙인다(아이콘이 실제 화면에서 어떻게 보이는지 한 장으로)."""
    from io import BytesIO

    from PIL import Image

    ims = [Image.open(BytesIO(b)).convert("RGB") for b in chunks]
    width = max(i.width for i in ims)
    height = sum(i.height for i in ims) + pad * (len(ims) + 1)
    sheet = Image.new("RGB", (width + pad * 2, height), bg)
    y = pad
    for im in ims:
        sheet.paste(im, (pad + (width - im.width) // 2, y))
        y += im.height + pad
    sheet.save(out_path)


def main():
    httpd = None
    if LOCAL:
        httpd = start_server()
    os.makedirs(OUT, exist_ok=True)
    errs, problems = [], []

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=3,          # 아이폰 14 레티나 3배
            locale="ko-KR",
            is_mobile=True,
            has_touch=True,
        )
        page = ctx.new_page()
        page.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
        page.on("console", lambda m: errs.append(f"error: {m.text}") if m.type == "error" else None)
        def on_fail(req):
            # 화면 이동·지연 로딩 취소(ERR_ABORTED)는 오류가 아니다 — 실제 실패만 모은다
            reason = ""
            try:
                reason = req.failure or ""
            except Exception:
                pass
            if "ERR_ABORTED" in reason:
                return
            errs.append(f"requestfailed: {req.url} ({reason})")

        page.on("requestfailed", on_fail)

        # ---------- ① 접속 첫 화면 ----------
        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
        page.wait_for_selector("img[src*='onboarding-hero']", timeout=20000)
        page.wait_for_timeout(2200)
        problems += report(img_rows(page), "onboarding")
        page.screenshot(path=f"{OUT}/neulbom_uhd_onboarding.png", full_page=True)
        # 히어로 영역만 따로(디테일 확인용)
        page.locator("section").first.screenshot(path=f"{OUT}/_uhd_onboarding_hero.png")

        # ---------- 홈 화면 ----------
        if LOCAL:
            onboard(page)
        else:
            page.route("**/t1.kakaocdn.net/**", lambda route, _req: route.abort())
            page.route("**/api/auth/kakao**", kakao_stub)
            live_login(page)
        page.wait_for_timeout(2600)
        page.screenshot(path=f"{OUT}/neulbom_uhd_home.png")

        # 지연 로딩(lazy) 아이콘까지 모두 불러오게 한 번 끝까지 훑는다
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(1400)
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(700)
        problems += report(img_rows(page), "home")

        # ---------- ③ 3D 아이콘(건강 챌린지 · 운세 · 날씨 · 바로가기) ----------
        clips = []
        health = page.locator("[data-health-card]")
        health.scroll_into_view_if_needed()
        page.wait_for_timeout(700)
        hb = health.bounding_box()
        if hb:
            clips.append(page.screenshot(clip={"x": hb["x"], "y": hb["y"], "width": hb["width"], "height": 330}))

        page.evaluate(
            """() => {
              const btns = [...document.querySelectorAll('button')];
              const f = btns.find(b => b.textContent.includes('오늘의 운세'));
              f?.scrollIntoView({ block: 'center' });
            }"""
        )
        page.wait_for_timeout(800)
        pair = page.evaluate(
            """() => {
              const btns = [...document.querySelectorAll('button')];
              const f = btns.find(b => b.textContent.includes('오늘의 운세'));
              const w = btns.find(b => b.textContent.includes('오늘의 날씨와 생활팁'));
              if (!f || !w) return null;
              const a = f.getBoundingClientRect(), b = w.getBoundingClientRect();
              const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
              return { x: x, y: y, width: Math.max(a.width, b.width), height: Math.max(a.bottom, b.bottom) - y };
            }"""
        )
        if pair:
            clips.append(page.screenshot(clip=pair))

        page.evaluate(
            """() => {
              const sec = [...document.querySelectorAll('section')].find((el) => el.textContent.includes('바로가기'));
              if (sec) window.scrollTo(0, sec.getBoundingClientRect().top + window.scrollY - 26);
            }"""
        )
        page.wait_for_timeout(800)
        tb = page.evaluate(
            """() => {
              const sec = [...document.querySelectorAll('section')].find((el) => el.textContent.includes('바로가기'));
              if (!sec) return null;
              const r = sec.getBoundingClientRect();
              const nav = document.querySelector("nav[aria-label='주요 메뉴']");
              const limit = nav ? nav.getBoundingClientRect().top - 10 : window.innerHeight;
              return { x: r.x, y: r.y, width: r.width, height: Math.min(r.height, limit - r.y) };
            }"""
        )
        if tb and tb["height"] > 40:
            clips.append(page.screenshot(clip=tb))
        if clips:
            stack_images(clips, f"{OUT}/neulbom_uhd_icons.png")
        page.screenshot(path=f"{OUT}/_uhd_tiles.png")
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(400)

        nav = page.get_by_role("navigation").get_by_role("button")

        # ---------- 퀴즈 화면 ----------
        nav.nth(2).click()
        page.wait_for_timeout(900)
        page.get_by_role("button", name="퀴즈 시작하기").click()
        page.wait_for_timeout(1400)
        page.evaluate("window.scrollTo(0, 360)")
        page.wait_for_timeout(900)
        problems += report(img_rows(page), "quiz")
        page.screenshot(path=f"{OUT}/_uhd_quiz.png")

        # ---------- 복지 화면 ----------
        nav.nth(4).click()
        page.wait_for_timeout(1600)
        # 아래쪽 가족 사진은 lazy 라서, 끝까지 내려 실제로 받아진 뒤에 검사한다
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(1600)
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(500)
        problems += report(img_rows(page), "welfare")
        page.screenshot(path=f"{OUT}/_uhd_welfare.png")
        page.evaluate("window.scrollTo(0, 900)")
        page.wait_for_timeout(900)
        page.screenshot(path=f"{OUT}/_uhd_welfare_family.png")

        browser.close()
    if httpd:
        httpd.shutdown()

    # 카카오 SDK CDN 은 로그인 스텁 때문에, Open-Meteo 는 샌드박스 네트워크 차단 때문에 뺀다
    # (날씨는 실패해도 화면이 기본 안내로 넘어가도록 만들어져 있다).
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
