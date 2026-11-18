"""더보기 탭 ‘🌱 늘봄 현황’ 카드 — 3단계 글씨 크기 레이아웃·로딩 흔들림 점검.

로컬 정적 빌드(out/)를 서빙하고 /api/stats 만 가짜 응답으로 바꿔서 본다.
실제 숫자·라이브 배포 확인은 e2e/check_more_stats_live.py 가 맡는다.

python3 e2e/check_more_stats.py
"""
import json
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from harness import start_server  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
OUT = "/workspace/downloads"
PORT = 8099

SEED = """
(() => {
  const state = {
    version: 1,
    profile: {
      id: "e2e_more_stats", nickname: "순자", birthYear: 1952, birthTime: "묘시",
      sido: "충청북도", sigungu: "옥천군", createdAt: new Date().toISOString(),
      source: "demo", profileCompleted: true,
    },
    quizLogs: [], daily: null, med: {}, visits: [], familyEvents: [],
    health: {}, missions: {}, rankingVisible: true, fontSize: 18, lastVisit: "",
  };
  window.localStorage.setItem("seniorLife.v1", JSON.stringify(state));
})();
"""

problems = []
httpd = start_server()


def open_more(page, delay_ms=0):
    if delay_ms:
        def handler(route):
            page.wait_for_timeout(delay_ms)
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"ok": True, "totalUsers": 1234, "onlineUsers": 23}),
            )
        page.route("**/api/stats*", handler)
    else:
        page.route(
            "**/api/stats*",
            lambda route: route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"ok": True, "totalUsers": 1234, "onlineUsers": 23}),
            ),
        )
    page.goto(f"http://127.0.0.1:{PORT}/", wait_until="domcontentloaded")
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=15000)
    banner = page.locator("[data-install-banner]")
    if banner.count():
        banner.click()
        page.wait_for_timeout(600)
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)
    page.get_by_role("button", name="더보기", exact=True).click()
    page.wait_for_selector("[data-stats-card]", timeout=10000)


def measure(page):
    return page.evaluate(
        """() => {
          const doc = document.documentElement;
          const card = document.querySelector("[data-stats-card]");
          const r = card.getBoundingClientRect();
          const tiles = Array.from(document.querySelectorAll("[data-stat-tile]")).map(el => ({
            kind: el.dataset.statTile,
            text: (el.innerText || "").replace(/\\s+/g, " ").trim(),
            clipped: el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2,
          }));
          const over = Array.from(document.querySelectorAll("main *"))
            .filter(el => el.getBoundingClientRect().right > doc.clientWidth + 1)
            .slice(0, 5)
            .map(el => (el.tagName + "." + (el.className || "")).slice(0, 60));
          return {
            font: getComputedStyle(doc).fontSize,
            card: { w: Math.round(r.width), h: Math.round(r.height) },
            tiles,
            over,
            scrollW: doc.scrollWidth,
            clientW: doc.clientWidth,
          };
        }"""
    )


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = b.new_context(
        viewport={"width": 390, "height": 844}, device_scale_factor=3, locale="ko-KR", is_mobile=True, has_touch=True
    )
    ctx.add_init_script(SEED)
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))

    # 1) 불러오는 동안 카드 높이가 흔들리지 않는지 — 응답을 2초 늦춰 놓고 두 번 잰다
    open_more(page, delay_ms=2000)
    before = measure(page)
    print("로딩 중:", before["card"], [t["text"] for t in before["tiles"]])
    page.wait_for_timeout(2600)
    after = measure(page)
    print("도착 후:", after["card"], [t["text"] for t in after["tiles"]])
    if before["card"]["h"] != after["card"]["h"]:
        problems.append(f"로딩 중 카드 높이 변화 {before['card']} → {after['card']}")
    if "1,234명" not in after["tiles"][0]["text"] or "23명" not in after["tiles"][1]["text"]:
        problems.append(f"가짜 응답 숫자가 그대로 보이지 않음: {[t['text'] for t in after['tiles']]}")

    # 2) 3단계 글씨 크기 — 넘침·잘림·카드 폭
    page.unroute("**/api/stats*")
    page.reload(wait_until="domcontentloaded")
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=15000)
    page.get_by_role("button", name="더보기", exact=True).click()
    page.wait_for_selector("[data-stats-card]", timeout=10000)
    page.wait_for_timeout(1200)

    boxes = []
    for label in ["보통", "크게", "아주 크게"]:
        info = measure(page)
        print(label, info)
        boxes.append((label, info["card"]["h"]))
        if info["over"]:
            problems.append(f"{label}: 가로 넘침 {info['over']}")
        if any(t["clipped"] for t in info["tiles"]):
            problems.append(f"{label}: 숫자칸 잘림 {info['tiles']}")
        for t in info["tiles"]:
            if not t["text"]:
                problems.append(f"{label}: {t['kind']} 칸이 비어 있음")
        page.screenshot(path=f"{OUT}/_more_stats_{info['font'].replace('.', '_')}.png")
        if label != "아주 크게":
            page.get_by_role("button", name="글씨 크기 바꾸기 — 지금", exact=False).click()
            page.wait_for_timeout(700)

    if len({h for _, h in boxes}) > 1:
        print("글씨 크기별 카드 높이:", boxes)

    if errs:
        problems.append(f"페이지 오류: {errs[:3]}")
    b.close()

httpd.shutdown()
print("문제:", len(problems))
for x in problems:
    print("  ", x)
sys.exit(1 if problems else 0)
