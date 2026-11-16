"""최종 스크린샷 4종 생성.

사용법:
  python3 e2e/capture_final.py                 # 로컬 out/ 프리뷰 (127.0.0.1:8099)
  BASE=https://senior-life-platform.pages.dev python3 e2e/capture_final.py   # 라이브
"""
import os
import sys
from collections import Counter

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from harness import start_server, onboard, PORT  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

BASE = os.environ.get("BASE", f"http://127.0.0.1:{PORT}")
SHOT = "/workspace/downloads"
TMP = "/workspace/downloads/_tiles"
FONT = "/usr/share/fonts/pickle-hwp/NotoSansCJKkr-Regular.otf"


def crisp(page, path, wait=700):
    page.wait_for_timeout(wait)
    page.screenshot(path=path)


def compose(paths, out, labels=None):
    raws = [Image.open(p).convert("RGB") for p in paths]
    w = raws[0].size[0]
    imgs = []
    for im in raws:
        if im.size[0] != w:
            im = im.resize((w, round(im.size[1] * w / im.size[0])), Image.LANCZOS)
        imgs.append(im)
    h = max(im.size[1] for im in imgs)
    gap, pad, cap = 28, 28, 56 if labels else 0
    total_w = pad * 2 + w * len(imgs) + gap * (len(imgs) - 1)
    total_h = pad * 2 + h + cap
    canvas = Image.new("RGB", (total_w, total_h), "#F3ECDD")
    d = ImageDraw.Draw(canvas)
    font = ImageFont.truetype(FONT, 30) if labels else None
    for i, im in enumerate(imgs):
        x = pad + i * (w + gap)
        y = pad + cap
        # 둥근 모서리
        mask = Image.new("L", im.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, w, h], radius=28, fill=255)
        canvas.paste(im, (x, y), mask)
        if labels:
            d.text((x + 6, pad + 6), labels[i], font=font, fill="#1B2A45")
    canvas.save(out, optimize=True)
    print("saved", out, canvas.size)


def answer(page):
    grid = page.locator("button[aria-label$='번째 그림']")
    if grid.count() > 0:
        cells = [grid.nth(i).inner_text().strip() for i in range(grid.count())]
        cnt = Counter(cells)
        odd = min(cnt, key=lambda k: cnt[k])
        grid.nth(cells.index(odd)).click()
    else:
        page.locator("main .space-y-2\\.5 > button").first.click()
    page.wait_for_timeout(400)
    page.get_by_role("button", name="다음 문제").or_(page.get_by_role("button", name="결과 보기")).first.click()
    page.wait_for_timeout(500)


def main():
    httpd = None
    if BASE.startswith("http://127.0.0.1"):
        httpd = start_server()
    os.makedirs(TMP, exist_ok=True)
    errs = []

    with sync_playwright() as p:
        fake_video = "/workspace/.tmp/medicine.y4m"
        args = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"]
        if os.path.exists(fake_video):
            args.append(f"--use-file-for-fake-video-capture={fake_video}")
        browser = p.chromium.launch(args=args)
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                                  locale="ko-KR", is_mobile=True, has_touch=True, permissions=["camera"])
        page = ctx.new_page()
        page.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
        page.on("console", lambda m: errs.append(f"{m.type}: {m.text}") if m.type == "error" else None)

        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_selector("#nick", timeout=20000)
        page.fill("#nick", "순자")
        page.select_option("#birth", "1952")
        page.select_option("#sido", "충청북도")
        page.select_option("#sigungu", "옥천군")
        page.get_by_role("button", name="시작하기").click()
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=20000)

        # A. 홈 상단 (운세 + 날씨)
        page.wait_for_timeout(3000)
        crisp(page, f"{TMP}/a_home.png", 600)
        # B. 인사카드
        # 카드 전체가 한 장에 담기도록 잠시 화면을 길게 잡고, 고정 헤더/내비는 숨긴다
        hide = page.add_style_tag(content="header,nav{display:none !important}")
        page.set_viewport_size({"width": 390, "height": 1560})
        page.wait_for_timeout(900)
        card = page.locator("div.card").filter(has_text="오늘의 안부 인사카드").first
        card.scroll_into_view_if_needed()
        page.wait_for_timeout(1200)
        card.screenshot(path=f"{TMP}/b_card.png")
        hide.evaluate("el => el.remove()")
        page.set_viewport_size({"width": 390, "height": 844})
        page.wait_for_timeout(600)

        # C. 퀴즈 문제 화면
        page.get_by_role("navigation").get_by_role("button").nth(1).click()
        page.wait_for_selector("text=1분 두뇌 퀴즈", timeout=15000)
        page.get_by_role("button", name="퀴즈 시작하기").click()
        page.wait_for_timeout(900)
        crisp(page, f"{TMP}/c_quiz.png")
        for _ in range(3):
            answer(page)
        page.wait_for_selector("text=오늘의 퀴즈 결과", timeout=15000)
        page.wait_for_timeout(900)
        # D. 결과 + 상장
        page.get_by_role("button", name="금빛 상장 만들기").click()
        page.wait_for_timeout(1600)
        hide2 = page.add_style_tag(content="header,nav{display:none !important}")
        page.set_viewport_size({"width": 390, "height": 1180})
        page.wait_for_timeout(700)
        cert_card = page.locator("div.card").filter(has_text="나의 상장").first
        cert_card.scroll_into_view_if_needed()
        page.wait_for_timeout(900)
        cert_card.screenshot(path=f"{TMP}/d_cert.png")
        hide2.evaluate("el => el.remove()")
        page.set_viewport_size({"width": 390, "height": 844})
        page.wait_for_timeout(600)
        # E. 전용 랭킹 탭
        page.get_by_role("navigation").get_by_role("button").nth(2).click()
        page.wait_for_selector("text=이번 주 순위", timeout=15000)
        page.wait_for_timeout(1200)
        crisp(page, f"{TMP}/e_ranking.png")
        page.get_by_role("button", name="띠·나이").first.click()
        page.wait_for_timeout(700)
        crisp(page, f"{TMP}/e2_ranking_zodiac.png")

        # F. 지원금
        page.get_by_role("navigation").get_by_role("button").nth(3).click()
        page.wait_for_selector("text=내게 맞는 지원금", timeout=15000)
        page.locator("h3").first.click()
        page.wait_for_timeout(900)
        crisp(page, f"{TMP}/f_welfare.png")

        # G. 도구 + 돋보기
        page.get_by_role("navigation").get_by_role("button").nth(4).click()
        page.wait_for_selector("text=생활 도구", timeout=15000)
        page.wait_for_timeout(500)
        crisp(page, f"{TMP}/g_tools.png")
        page.get_by_role("button", name="돋보기 켜기").click()
        page.wait_for_timeout(1500)
        page.locator("input[type=range]").fill("1.5")
        page.wait_for_timeout(500)
        crisp(page, f"{TMP}/g2_magnifier.png")
        page.get_by_role("button", name="돋보기 닫기").click()
        page.wait_for_timeout(600)

        # H. 가족 + 대시보드
        page.get_by_role("navigation").get_by_role("button").nth(5).click()
        page.wait_for_selector("text=가족 연결", timeout=15000)
        page.get_by_role("button", name="아침 약").click()
        page.wait_for_timeout(300)
        page.get_by_role("button", name="저녁 약").click()
        page.wait_for_timeout(900)
        crisp(page, f"{TMP}/h_family.png")
        code = page.locator(".tabular").first.inner_text().strip()
        page.goto(f"{BASE}/family/?code={code}", wait_until="domcontentloaded")
        page.wait_for_timeout(2200)
        crisp(page, f"{TMP}/i_dashboard.png")

        browser.close()
    if httpd:
        httpd.shutdown()

    compose([f"{TMP}/a_home.png", f"{TMP}/b_card.png"], f"{SHOT}/senior_home_fortune.png",
            ["홈 · 오늘의 운세와 날씨", "이름이 들어간 인사카드"])
    compose([f"{TMP}/c_quiz.png", f"{TMP}/d_cert.png", f"{TMP}/e_ranking.png"], f"{SHOT}/senior_quiz_ranking.png",
            ["1분 두뇌 퀴즈", "금빛 상장", "🏆 랭킹 탭 (우리 동네)"])
    compose([f"{TMP}/f_welfare.png", f"{TMP}/g2_magnifier.png"], f"{SHOT}/senior_welfare_tools.png",
            ["맞춤형 지원금 · 3단계 안내", "간편 돋보기 1.5배 확대"])
    compose([f"{TMP}/h_family.png", f"{TMP}/i_dashboard.png"], f"{SHOT}/senior_family_dashboard.png",
            ["복약 체크 · 원터치 안부", "자녀 확인 화면"])

    print("errors:", errs)


if __name__ == "__main__":
    main()
