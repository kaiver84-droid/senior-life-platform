"""늘봄 홈 — 글씨 크기 3단계(보통 18 · 크게 21 · 아주 크게 24) 가로 넘침 점검.

python3 e2e/check_home_font_sizes.py
"""
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from harness import onboard, start_server  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
OUT = "/workspace/downloads"

httpd = start_server()
problems = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, locale="ko-KR", is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    onboard(page)
    page.wait_for_timeout(2000)
    banner = page.locator("[data-install-banner]")
    if banner.count():
        banner.click()
        page.wait_for_timeout(900)
        page.keyboard.press("Escape")
        page.wait_for_timeout(700)

    for label in ["보통", "크게", "아주 크게"]:
        info = page.evaluate(
            """() => {
              const doc = document.documentElement;
              const end = document.querySelector("[data-home-end]");
              const over = Array.from(document.querySelectorAll("main *"))
                .filter(el => el.getBoundingClientRect().right > doc.clientWidth + 1)
                .slice(0, 5)
                .map(el => (el.tagName + "." + (el.className || "")).slice(0, 70));
              const clipped = Array.from(document.querySelectorAll("main span, main p"))
                .filter(el => el.scrollWidth > el.clientWidth + 2 &&
                               getComputedStyle(el).textOverflow === "ellipsis" &&
                               el.clientWidth > 0 &&
                               !el.closest("[data-health-card]"))
                .slice(0, 6)
                .map(el => (el.textContent || "").trim().slice(0, 30));
              return {
                font: getComputedStyle(doc).fontSize,
                endBottom: end ? Math.round(end.getBoundingClientRect().bottom + window.scrollY) : 0,
                scrollW: doc.scrollWidth,
                clientW: doc.clientWidth,
                over,
                clipped,
              };
            }"""
        )
        print(label, info)
        if info["over"]:
            problems.append(f"{label}: 가로 넘침 {info['over']}")
        if info["clipped"]:
            problems.append(f"{label}: 말줄임 {info['clipped']}")
        page.evaluate("window.scrollTo(0,0)")
        page.wait_for_timeout(400)
        page.screenshot(path=f"{OUT}/_home_font_{info['font'].replace('.','_')}.png")
        if label != "아주 크게":
            page.get_by_role("button", name="글씨 크기 바꾸기 — 지금", exact=False).click()
            page.wait_for_timeout(700)

    if errs:
        problems.append(f"페이지 오류: {errs[:3]}")
    b.close()
httpd.shutdown()
print("문제:", len(problems))
for x in problems:
    print("  ", x)
