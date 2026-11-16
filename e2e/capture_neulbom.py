"""늘봄 새 디자인 최종 스크린샷 4종.

사용법:
  python3 e2e/capture_neulbom.py                                  # 로컬 out/ 프리뷰
  BASE=https://senior-life-platform.pages.dev python3 e2e/capture_neulbom.py   # 라이브
"""
import os
import re
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from harness import start_server, PORT  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

BASE = os.environ.get("BASE", f"http://127.0.0.1:{PORT}")
SHOT = "/workspace/downloads"
TMP = "/workspace/downloads/_tiles_neulbom"
FONT = "/usr/share/fonts/pickle-hwp/NotoSansCJKkr-Regular.otf"
INK = "#173B5E"


def crisp(page, path, wait=700):
    page.wait_for_timeout(wait)
    page.screenshot(path=path)


def crop(path, out, top_ratio=0.0, bottom_ratio=1.0):
    im = Image.open(path)
    w, h = im.size
    im.crop((0, int(h * top_ratio), w, int(h * bottom_ratio))).save(out)
    return out


def compose(paths, out, labels=None):
    raws = [Image.open(p).convert("RGB") for p in paths]
    w = raws[0].size[0]
    imgs = []
    for im in raws:
        if im.size[0] != w:
            im = im.resize((w, round(im.size[1] * w / im.size[0])), Image.LANCZOS)
        imgs.append(im)
    h = max(im.size[1] for im in imgs)
    gap, pad, cap = 26, 26, 54 if labels else 0
    total_w = pad * 2 + w * len(imgs) + gap * (len(imgs) - 1)
    total_h = pad * 2 + h + cap
    canvas = Image.new("RGB", (total_w, total_h), "#EFEDE4")
    d = ImageDraw.Draw(canvas)
    font = ImageFont.truetype(FONT, 28) if labels else None
    for i, im in enumerate(imgs):
        x = pad + i * (w + gap)
        y = pad + cap + (h - im.size[1]) // 2
        mask = Image.new("L", im.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, w, h], radius=26, fill=255)
        canvas.paste(im, (x, y), mask)
        if labels:
            d.text((x + 4, pad + 8), labels[i], font=font, fill=INK)
    canvas.save(out, optimize=True)
    print("saved", out, canvas.size)


def answer(page):
    page.locator("[data-quiz-option]").first.click()
    page.wait_for_timeout(300)
    page.get_by_role("button", name="정답 확인").click()
    page.wait_for_timeout(450)
    page.get_by_role("button", name=re.compile("^(다음 문제|결과 보기)$")).click()
    page.wait_for_timeout(600)


def main():
    httpd = None
    if BASE.startswith("http://127.0.0.1"):
        httpd = start_server()
    os.makedirs(TMP, exist_ok=True)
    errs = []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"]
        )
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            locale="ko-KR",
            is_mobile=True,
            has_touch=True,
            permissions=["camera"],
        )
        page = ctx.new_page()
        page.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
        page.on(
            "console",
            lambda m: errs.append(f"{m.type}: {m.text}")
            if m.type == "error" and "/api/" not in (m.location or {}).get("url", "")
            else None,
        )

        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_selector("#nick", timeout=30000)
        page.fill("#nick", "순자")
        page.select_option("#birth", "1952")
        page.select_option("#sido", "충청북도")
        page.select_option("#sigungu", "옥천군")
        page.get_by_role("button", name="시작하기").click()
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
        page.wait_for_timeout(4200)

        # 1) 홈
        crisp(page, f"{TMP}/a_home.png", 700)
        page.evaluate("window.scrollTo(0, 760)")
        crisp(page, f"{TMP}/a2_home_lower.png", 700)
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(400)

        # 인사카드 시트
        page.get_by_role("button", name="인사카드 만들기").click()
        page.wait_for_timeout(2200)
        crisp(page, f"{TMP}/b_card.png", 300)
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)

        nav = page.get_by_role("navigation").get_by_role("button")

        # 2) 퀴즈
        nav.nth(1).click()
        page.wait_for_timeout(700)
        page.get_by_role("button", name="퀴즈 시작하기").click()
        page.wait_for_timeout(800)
        crisp(page, f"{TMP}/c_quiz.png", 400)
        page.locator("[data-quiz-option]").first.click()
        page.wait_for_timeout(300)
        page.get_by_role("button", name="정답 확인").click()
        page.wait_for_timeout(500)
        page.evaluate("window.scrollTo(0, 230)")
        crisp(page, f"{TMP}/d_quiz_checked.png", 500)
        page.get_by_role("button", name=re.compile("^(다음 문제|결과 보기)$")).click()
        page.wait_for_timeout(500)
        answer(page)
        answer(page)
        page.wait_for_selector("text=오늘의 퀴즈 결과", timeout=15000)
        page.wait_for_timeout(800)
        crisp(page, f"{TMP}/e_result.png", 400)
        page.get_by_role("button", name="금빛 상장 만들기").click()
        page.wait_for_timeout(1800)
        crisp(page, f"{TMP}/f_cert_full.png", 300)
        crop(f"{TMP}/f_cert_full.png", f"{TMP}/f_cert.png", 0.42)
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)

        # 3) 랭킹
        nav.nth(2).click()
        page.wait_for_timeout(1500)
        crisp(page, f"{TMP}/g_ranking.png", 400)
        page.evaluate("window.scrollTo(0, 820)")
        crisp(page, f"{TMP}/g2_ranking_lower.png", 500)
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(300)

        # 4) 혜택
        nav.nth(3).click()
        page.wait_for_timeout(1100)
        crisp(page, f"{TMP}/h_welfare.png", 400)
        page.get_by_role("button", name="신청 방법 자세히 보기").click()
        page.wait_for_timeout(1000)
        crisp(page, f"{TMP}/h2_welfare_full.png", 200)
        crop(f"{TMP}/h2_welfare_full.png", f"{TMP}/h2_welfare_detail.png", 0.16)
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)

        # 5) 도구
        nav.nth(4).click()
        page.wait_for_timeout(800)
        crisp(page, f"{TMP}/i_tools.png", 400)
        page.get_by_role("tab", name="가이드").click()
        page.wait_for_timeout(700)
        crisp(page, f"{TMP}/i2_tools_guide.png", 300)

        # 6) 가족
        nav.nth(5).click()
        page.wait_for_timeout(900)
        page.get_by_role("button", name="아침 약").click()
        page.wait_for_timeout(300)
        page.get_by_role("button", name="저녁 약").click()
        page.wait_for_timeout(700)
        page.evaluate("window.scrollTo(0, 0)")
        crisp(page, f"{TMP}/j_family.png", 600)
        page.evaluate("window.scrollTo(0, 800)")
        crisp(page, f"{TMP}/j2_family_lower.png", 600)
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(300)

        code = page.locator(".tabular").first.inner_text().strip()
        page.goto(f"{BASE}/family/?code={code}", wait_until="domcontentloaded")
        page.wait_for_timeout(2600)
        crisp(page, f"{TMP}/k_dashboard.png", 400)

        browser.close()
    if httpd:
        httpd.shutdown()

    compose(
        [f"{TMP}/a_home.png", f"{TMP}/a2_home_lower.png", f"{TMP}/b_card.png"],
        f"{SHOT}/neulbom_home.png",
        ["홈 · 안녕하세요 순자 님", "2×3 바로가기 · 명예의 전당", "이름이 들어간 인사카드"],
    )
    compose(
        [f"{TMP}/c_quiz.png", f"{TMP}/d_quiz_checked.png", f"{TMP}/f_cert.png"],
        f"{SHOT}/neulbom_quiz.png",
        ["1분 두뇌 퀴즈 · 1/3 진행 바", "정답 확인 · 해설", "금빛 상장"],
    )
    compose(
        [f"{TMP}/g_ranking.png", f"{TMP}/h_welfare.png", f"{TMP}/h2_welfare_detail.png"],
        f"{SHOT}/neulbom_ranking_welfare.png",
        ["명예의 전당 · 시상대", "맞춤형 복지 혜택", "3단계 신청 안내"],
    )
    compose(
        [f"{TMP}/i_tools.png", f"{TMP}/j_family.png", f"{TMP}/k_dashboard.png"],
        f"{SHOT}/neulbom_tools_family.png",
        ["생활 도구 · 돋보기", "가족 연결 · 안부", "자녀 확인 화면"],
    )
    print("errors:", errs)


if __name__ == "__main__":
    main()
