"""늘봄 퀴즈 — 연습 결과 화면의 '전체 N문제를 섞어서/새로 골라' 부연 문구가 사라졌는지 확인.

python3 e2e/check_quiz_result_copy.py
"""
import re
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from harness import onboard, start_server  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
OUT = "/workspace/downloads"

BANNED = [
    "문제를 섞어서 계속 내드려요",
    "문제 중에서 새로 골라 드려요",
    "318문제",
    "섞어서 계속",
    "새로 골라 드려요",
]

httpd = start_server()
problems = []

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = b.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=3,
        locale="ko-KR",
        is_mobile=True,
        has_touch=True,
    )
    page = ctx.new_page()
    errs = []
    bad_http = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.on(
        "console",
        lambda m: errs.append(f"console:{m.type}:{m.text}")
        if (m.type == "error" and "Failed to load resource" not in m.text)
        else None,
    )
    page.on(
        "response",
        lambda r: bad_http.append(f"{r.status} {r.url}")
        if (r.status >= 400 and "/api/" not in r.url)
        else None,
    )

    onboard(page)
    page.wait_for_timeout(1200)
    banner = page.locator("[data-install-banner]")
    if banner.count():
        banner.click()
        page.wait_for_timeout(700)
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)

    def nav(name):
        page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name=name).click()
        page.wait_for_timeout(1200)

    def overflow_info():
        return page.evaluate(
            """() => {
              const doc = document.documentElement;
              const over = Array.from(document.querySelectorAll("main *"))
                .filter(el => el.getBoundingClientRect().right > doc.clientWidth + 1)
                .slice(0, 6)
                .map(el => (el.tagName + "." + (el.className || "")).slice(0, 80));
              return { scrollW: doc.scrollWidth, clientW: doc.clientWidth, over };
            }"""
        )

    def answer_once():
        page.wait_for_selector("[data-quiz-option]", timeout=15000)
        page.locator("[data-quiz-option]").first.click()
        page.wait_for_timeout(250)
        page.get_by_role("button", name=re.compile("정답 확인")).click()
        page.wait_for_timeout(400)
        page.get_by_role("button", name=re.compile("^다음 문제$|연습 결과 보기|결과 보기")).first.click()
        page.wait_for_timeout(500)

    def check_body(tag):
        body = page.locator("body").inner_text()
        for phrase in BANNED:
            if phrase in body:
                problems.append(f"[{tag}] 문구가 아직 화면에 있음: {phrase!r}")
        return body

    def font_sizes(tag):
        for label in ("보통", "크게", "아주 크게"):
            info = overflow_info()
            if info["over"] or info["scrollW"] > info["clientW"] + 1:
                problems.append(f"[{tag}/{label}] 가로 넘침 {info['over']} ({info['scrollW']}>{info['clientW']})")
            page.evaluate("window.scrollTo(0,0)")
            page.wait_for_timeout(250)
            page.screenshot(path=f"{OUT}/_quiz_result_{tag}_{label.replace(' ', '_')}.png")
            if label != "아주 크게":
                page.get_by_role("button", name="글씨 크기 바꾸기 — 지금", exact=False).click()
                page.wait_for_timeout(500)
        # 보통으로 복귀
        page.get_by_role("button", name="글씨 크기 바꾸기 — 지금", exact=False).click()
        page.wait_for_timeout(500)

    nav("퀴즈")
    page.wait_for_timeout(800)

    # 1) 무한 연습 결과
    page.locator("[data-quiz-topic='ox']").first.click()
    page.wait_for_timeout(1200)
    answer_once()
    page.locator("[data-quiz-stop]").first.click()
    page.wait_for_timeout(1200)
    body = check_body("무한연습결과")
    if "무한 연습 결과" not in body:
        problems.append("[무한연습결과] 결과 화면이 아님")
    if "계속 더 풀기" not in body:
        problems.append("[무한연습결과] '계속 더 풀기' 버튼 없음")
    print("[무한연습결과] 줄:", [l for l in body.split("\n") if l.strip()][-6:])
    font_sizes("endless")

    page.get_by_role("button", name=re.compile("퀴즈 홈으로 돌아가기")).click()
    page.wait_for_timeout(900)

    # 2) 오늘의 퀴즈 연습 모드 결과 (비무한)
    page.evaluate("window.scrollTo(0,0)")
    page.wait_for_timeout(300)
    practice = page.get_by_role("button", name=re.compile("연습|더 풀어"))
    if practice.count():
        practice.first.click()
        page.wait_for_timeout(1200)
        answer_once()
        stop = page.locator("[data-quiz-stop]")
        if stop.count():
            stop.first.click()
        else:
            page.get_by_role("button", name=re.compile("연습 결과 보기|결과 보기")).first.click()
        page.wait_for_timeout(1200)
        body = check_body("연습결과")
        print("[연습결과] 줄:", [l for l in body.split("\n") if l.strip()][-6:])
        page.screenshot(path=f"{OUT}/_quiz_result_practice.png")
    else:
        print("[연습결과] 연습 모드 진입 버튼을 찾지 못해 건너뜀")

    if errs:
        problems.append(f"콘솔/페이지 오류 {len(errs)}건: {errs[:5]}")
    if bad_http:
        problems.append(f"4xx/5xx {len(bad_http)}건: {bad_http[:5]}")
    b.close()

httpd.shutdown()
print("\n결과:", "통과" if not problems else "문제 있음")
for prob in problems:
    print(" -", prob)
sys.exit(1 if problems else 0)
