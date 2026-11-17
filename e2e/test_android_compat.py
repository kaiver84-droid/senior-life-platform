"""안드로이드 호환 점검 (360×800 · 412×915) — 가로 잘림 · 버튼 겹침 · 모달 닫기 · TTS · 카카오 공유 · PWA.

로컬:  python3 e2e/test_android_compat.py            (out/ 를 8099 에서 서빙)
라이브: BASE=https://senior-life-platform.pages.dev python3 e2e/test_android_compat.py
"""
import json
import os
import re
import sys
import urllib.request

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", "http://127.0.0.1:8099").rstrip("/")
SHOT = "/workspace/downloads"
LOCAL = "127.0.0.1" in BASE or "localhost" in BASE

ANDROID_UA = (
    "Mozilla/5.0 (Linux; Android 14; SM-S911N) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Mobile Safari/537.36"
)

fails = []


def check(ok, label, extra=""):
    print(("✅ " if ok else "❌ ") + label + (f" · {extra}" if extra else ""))
    if not ok:
        fails.append(label)


def nav(page, label):
    """하단 탭 누르기 — 탭이 없는 화면(다른 곳으로 넘어간 뒤)이면 먼저 홈으로 되돌린다."""
    tab = page.locator("nav[aria-label='주요 메뉴'] button").filter(has_text=label).first
    if not tab.count():
        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=20000)
        page.wait_for_timeout(600)
        tab = page.locator("nav[aria-label='주요 메뉴'] button").filter(has_text=label).first
    tab.click()
    page.wait_for_timeout(700)


def no_hscroll(page, tag):
    """가로 스크롤(잘림)이 없는지 — 문서 폭이 화면 폭을 넘으면 실패."""
    width, scroll = page.evaluate(
        "() => [window.innerWidth, Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)]"
    )
    check(scroll <= width + 1, f"{tag}: 가로 잘림 없음", f"{scroll} <= {width}")


def wide_elements(page, tag):
    """화면 폭보다 넓은 요소(가로 잘림 원인) 목록."""
    over = page.evaluate(
        """() => {
          const w = window.innerWidth;
          return [...document.querySelectorAll('main *, nav *, header *')]
            .filter(el => {
              const r = el.getBoundingClientRect();
              return r.width > w + 2 && r.height > 4 && getComputedStyle(el).position !== 'fixed';
            })
            .slice(0, 5)
            .map(el => (el.tagName + '.' + (el.className || '')).toString().slice(0, 70));
        }"""
    )
    check(not over, f"{tag}: 화면보다 넓은 요소 없음", str(over[:3]))


def sheet_close_ok(page, tag, shot=None):
    page.wait_for_selector("[data-sheet-close]", timeout=10000)
    page.wait_for_timeout(400)
    btn = page.locator("[data-sheet-close]").last
    box = btn.bounding_box()
    ok = bool(box) and btn.is_visible()
    check(ok, f"{tag}: 상단 닫기 버튼 보임")
    if ok:
        check(box["y"] >= 60, f"{tag}: 닫기 버튼이 화면 위 60px 아래(상태바에 안 가림)", f'y={box["y"]:.0f}')
        check(
            box["y"] + box["height"] <= page.viewport_size["height"],
            f"{tag}: 닫기 버튼이 화면 안",
            f'{box["y"] + box["height"]:.0f}',
        )
        check("닫기" in btn.inner_text(), f"{tag}: ‘닫기’ 글씨", btn.inner_text().strip())
        if shot:
            page.screenshot(path=f"{SHOT}/{shot}")
    btn.click()
    page.wait_for_timeout(450)
    check(page.locator("[data-sheet-close]").count() == 0, f"{tag}: 닫기 눌러 닫힘")


def run(p, label, width, height):
    browser = p.chromium.launch()
    ctx = browser.new_context(
        viewport={"width": width, "height": height},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
        user_agent=ANDROID_UA,
    )
    page = ctx.new_page()
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))

    if LOCAL:
        from harness import onboard, start_server

        httpd = start_server()
        try:
            onboard(page)
        finally:
            pass
    else:
        from test_live_final import onboard_demo, stub_kakao

        stub_kakao(page)
        onboard_demo(page)

    tag = f"{label}({width}×{height})"

    # ---------- 1) 홈: 가로 잘림 · 하단 탭 ----------
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=20000)
    page.wait_for_timeout(1200)
    no_hscroll(page, tag)
    wide_elements(page, tag)
    nav_btns = page.locator("nav[aria-label='주요 메뉴'] button")
    check(nav_btns.count() == 6, f"{tag}: 하단 탭 6개")
    boxes = [nav_btns.nth(i).bounding_box() for i in range(nav_btns.count())]
    check(all(b and b["width"] > 40 for b in boxes), f"{tag}: 탭 버튼 폭 충분", f'{min(b["width"] for b in boxes if b):.0f}px')
    check(
        all(b and b["x"] >= -1 and b["x"] + b["width"] <= width + 1 for b in boxes),
        f"{tag}: 탭이 화면 안",
    )
    page.screenshot(path=f"{SHOT}/neulbom_android_{width}x{height}_home.png")

    # ---------- 2) 설치 안내 배너 → 안내 시트 ----------
    banner = page.locator("[data-install-banner]")
    if banner.count():
        banner.first.click()
        page.wait_for_selector("[data-install-guide]", timeout=8000)
        steps = page.locator("[data-install-guide] li")
        check(steps.count() >= 2, f"{tag}: 홈 화면에 추가 단계 안내", f"{steps.count()}단계")
        check(
            page.locator("[data-install-guide]").inner_text().find("홈 화면에 추가") >= 0,
            f"{tag}: ‘홈 화면에 추가’ 문구",
        )
        page.screenshot(path=f"{SHOT}/neulbom_android_install_guide.png")
        sheet_close_ok(page, f"{tag} 설치 안내 시트")
    else:
        check(True, f"{tag}: 설치 배너(이미 앱이면 안 뜸) — 건너뜀")

    # ---------- 3) 오늘의 운세 시트 + TTS ----------
    page.evaluate("() => window.scrollTo(0, 0)")
    page.wait_for_timeout(400)
    page.get_by_role("button", name="오늘의 운세").first.click()
    sheet_close_ok(page, f"{tag} 운세 시트", shot=f"neulbom_android_fortune_{width}x{height}.png")

    page.get_by_role("button", name="오늘의 운세").first.click()
    page.wait_for_selector("text=운세 소리로 듣기", timeout=8000)
    tts = page.evaluate("() => typeof window.speechSynthesis !== 'undefined'")
    check(tts, f"{tag}: speechSynthesis 사용 가능")
    page.get_by_role("button", name=re.compile("운세 소리로 듣기")).first.click()
    page.wait_for_timeout(1200)
    check(True, f"{tag}: ‘운세 소리로 듣기’ 눌러도 오류 없음")
    sheet_close_ok(page, f"{tag} 운세 시트(닫기)")

    # ---------- 4) 혜택 상세 시트 ----------
    nav(page, "혜택")
    page.get_by_role("button", name="신청 방법 자세히 보기").first.click()
    sheet_close_ok(page, f"{tag} 지원금 상세 시트")

    # ---------- 5) 카카오 공유 시트 ----------
    nav(page, "홈")
    page.evaluate("() => window.scrollTo(0, 0)")
    page.wait_for_timeout(400)
    page.get_by_role("button", name="카카오톡으로 보내기").first.click()
    page.wait_for_selector("[data-share-sheet]", timeout=15000)
    page.wait_for_timeout(1200)
    kbox = page.locator("[data-share-kakao] button").first.bounding_box()
    check(kbox and kbox["height"] >= 64, f"{tag}: 카카오 버튼 크게", f'{kbox["height"]:.0f}px' if kbox else "-")
    bbox = page.locator("[data-share-close] button").first.bounding_box()
    check(bbox and bbox["height"] >= 52, f"{tag}: 공유 시트 아래 닫기 크게", f'{bbox["height"]:.0f}px' if bbox else "-")
    page.screenshot(path=f"{SHOT}/neulbom_android_share_{width}x{height}.png")
    page.locator("[data-share-kakao] button").first.click()
    page.wait_for_timeout(2600)
    check(page.locator("[data-share-sheet]").count() == 0, f"{tag}: 카카오 공유 누르면 시트 닫힘")
    if page.locator("[data-sheet-close]").count():
        page.locator("[data-sheet-close]").last.click()
        page.wait_for_timeout(500)

    # ---------- 6) 더보기 → 설치 안내 줄 · 설정 시트 ----------
    nav(page, "더보기")
    row = page.locator("[data-install-row]")
    check(row.count() == 1, f"{tag}: 더보기에 ‘주소창 없이 앱처럼 쓰기’ 메뉴")
    row.first.click()
    page.wait_for_selector("[data-install-guide]", timeout=8000)
    check(True, f"{tag}: 더보기에서 안내 다시 열림")
    sheet_close_ok(page, f"{tag} 더보기 설치 안내")
    page.get_by_role("button", name="설정", exact=True).click()
    sheet_close_ok(page, f"{tag} 설정 시트")
    no_hscroll(page, f"{tag} 더보기")

    # ---------- 7) PWA 자원 ----------
    man = page.evaluate(
        "async () => { const r = await fetch('/manifest.json'); const j = await r.json();"
        " return {status: r.status, name: j.short_name, display: j.display, icons: (j.icons||[]).length}; }"
    )
    check(man["status"] == 200 and man["display"] == "standalone", f"{tag}: manifest.json", str(man))
    check(man["icons"] >= 2, f"{tag}: manifest 아이콘", f'{man["icons"]}개')
    sw = page.evaluate("async () => (await fetch('/sw.js')).status")
    check(sw == 200, f"{tag}: sw.js", str(sw))
    apple = page.evaluate("() => !!document.querySelector(\"link[rel='apple-touch-icon']\")")
    check(apple, f"{tag}: apple-touch-icon 링크")

    # ---------- 8) 콘솔 오류 ----------
    real = [
        e
        for e in errors
        if "favicon" not in e and "Failed to load resource" not in e and "manifest" not in e.lower()
    ]
    check(not real, f"{tag}: 콘솔 오류 0건", str(real[:3]))

    browser.close()
    if LOCAL:
        httpd.shutdown()
        httpd.server_close()


def main():
    with sync_playwright() as p:
        for label, w, h in [("안드로이드", 360, 800), ("안드로이드", 412, 915)]:
            print(f"\n===== {label} {w}×{h} =====")
            run(p, label, w, h)

    print("\n" + ("모두 통과 ✅" if not fails else f"실패 {len(fails)}건 ❌"))
    for f in fails:
        print(" -", f)
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
