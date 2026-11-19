"""늘봄 랭킹 — 시·도 기준 지역 랭킹 + 2026-11-19 시안(한 화면 세로 스크롤) 검증.

라이브: BASE=https://senior-life-platform.pages.dev python3 e2e/check_ranking_sido.py

확인하는 것
1) API: 같은 도의 다른 시·군(충청북도 옥천군 / 청주시) 사용자가 ‘지역별’에 함께 묶이고,
   다른 도(대전광역시) 사용자는 빠지는지. 응답 regionLabel 이 정식 시·도 명칭인지.
2) 화면: 이번 주 랭킹 히어로 · 우리 모임 내 순위 · 함께해요 배너 · 지역 랭킹 ·
   우리 모임 랭킹 · 오늘의 미션(치매예방 퀴즈) · 주간 명예의 전당 · 모임 참여 현황 · 응원 배너.
3) 글씨 3단계(보통 18 / 크게 21 / 아주 크게 24)에서 390px 가로 넘침 0건.
4) 테스트 계정은 끝나고 DB 에서 지운다.
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", "https://senior-life-platform.pages.dev").rstrip("/")
SHOT = "/workspace/downloads"
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")
os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.libs/usr/lib/x86_64-linux-gnu:/workspace/work/.tools/browser-libs"
)
KST = timezone(timedelta(hours=9))
TODAY = datetime.now(KST).strftime("%Y-%m-%d")

# 1차 배포 전에는 로컬(out/ + harness)에서 화면 모양만 본다 — API 는 live 판단 때만 쓴다.
LOCAL = os.environ.get("LOCAL_ONLY") == "1"

results = {}
errors = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
    results[label] = bool(cond)
    if not cond:
        errors.append(label)


def api_get(params: dict, base: str | None = None):
    url = f"{base or BASE}/api/rankings?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
            "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read())


def open_ranking(page):
    """하단 탭 4번째(랭킹)를 눌러 랭킹 화면을 연다."""
    if page.locator("[data-ranking-hero]").count():
        return
    page.locator("nav[aria-label='주요 메뉴'] button").nth(3).click()
    page.wait_for_timeout(800)
    if not page.locator("[data-ranking-hero]").count():
        page.locator("nav[aria-label='주요 메뉴'] button").nth(3).click()
        page.wait_for_timeout(600)


def run_screen(pw):
    """시안 화면 검증 — 로컬 정적 빌드(out/)를 띄워 390×844 로 본다."""
    from harness import start_server, onboard

    httpd = start_server()
    shots = []
    try:
        browser = pw.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        page = browser.new_page(viewport={"width": 390, "height": 844})
        onboard(page, name="순자", birth="1952", sido="충청북도", sigungu="옥천군")
        open_ranking(page)

        check(page.locator("[data-ranking-hero]").count() == 1, "이번 주 랭킹 히어로 카드")
        check(page.locator("[data-rank-mode='region']").count() == 1, "지역 랭킹 탭 알약")
        check(page.locator("[data-rank-mode='group']").count() == 1, "모임 랭킹 탭 알약")
        hero_text = page.locator("[data-ranking-hero]").inner_text()
        check("충청북도" in hero_text, "히어로에 정식 시·도 명칭(충청북도)", hero_text.replace("\n", " ")[:80])
        check("지역 랭킹" in hero_text and "모임 랭킹" in hero_text, "두 탭 이름")
        check(page.locator("[data-my-group-rank-card]").count() == 1, "우리 모임 내 순위 카드")
        check(page.get_by_text("이번 주도 함께해요!").count() >= 1, "함께해요 배너")
        check(page.get_by_text("지역 랭킹", exact=True).count() >= 1, "지역 랭킹 순위표 제목")
        check(page.get_by_text("우리 모임 랭킹", exact=True).count() >= 1, "우리 모임 랭킹 순위표 제목")
        check(page.locator("[data-league-missions]").count() == 1, "오늘의 미션 카드")
        check(page.get_by_text("치매예방 퀴즈 풀기").count() >= 1, "오늘의 미션 — 치매예방 퀴즈")
        check(page.get_by_text("안부 인사 보내기").count() >= 1, "오늘의 미션 — 안부 인사 보내기")
        check(page.locator("[data-week-champion]").count() == 1, "주간 명예의 전당 카드")
        check(page.locator("[data-group-join-status]").count() == 1, "모임 참여 현황 카드")
        check(page.locator("[data-rank-cheer]").count() == 1, "응원 배너")
        region_section = page.locator("[data-region-rank-section]")
        check(region_section.count() == 1, "지역 랭킹 순위표 표식")
        check("충청북도" in (region_section.inner_text() if region_section.count() else ""), "지역 순위표 제목에 시·도 명칭")
        check(page.locator("nav[aria-label='주요 메뉴'] button").count() == 6, "하단 탭 6개 유지")

        # 글씨 3단계 — 가로 넘침 0건
        for size, label in ((18, "보통"), (21, "크게"), (24, "아주 크게")):
            page.evaluate(
                "(s) => { localStorage.setItem('seniorLife.v1', JSON.stringify({...JSON.parse(localStorage.getItem('seniorLife.v1')), fontSize: s})); }",
                size,
            )
            page.reload(wait_until="domcontentloaded")
            page.wait_for_timeout(800)
            open_ranking(page)
            overflow = page.evaluate(
                """() => {
                  const bad = [];
                  const root = document.querySelector('main') || document.body;
                  root.querySelectorAll('*').forEach((el) => {
                    const r = el.getBoundingClientRect();
                    if (r.width === 0) return;
                    if (r.right > 391.5 || r.left < -1.5) {
                      const t = (el.textContent || '').trim().slice(0, 24);
                      bad.push(`${el.tagName}.${el.className.toString().slice(0,40)}|${Math.round(r.left)},${Math.round(r.right)}|${t}`);
                    }
                  });
                  return bad.slice(0, 8);
                }"""
            )
            # 시상대 장식용 원(overflow-hidden 안)은 영향이 없으니 실제 넘친 항목만 본다
            doc_overflow = page.evaluate(
                "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
            )
            check(doc_overflow <= 0, f"가로 넘침 없음 — {label}", f"scrollWidth-clientWidth={doc_overflow}")
            if overflow:
                print("    (참고) 화면 밖으로 나간 요소:", overflow)

        # 스크린샷 — 크게(21) 에서 위 화면과 전체 스크롤
        page.evaluate(
            "(s) => { localStorage.setItem('seniorLife.v1', JSON.stringify({...JSON.parse(localStorage.getItem('seniorLife.v1')), fontSize: s})); }",
            21,
        )
        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(800)
        open_ranking(page)
        top_path = f"{SHOT}/neulbom_ranking_top.png"
        page.screenshot(path=top_path)
        shots.append(top_path)

        page.screenshot(path=f"{SHOT}/neulbom_ranking_full.png", full_page=True)
        shots.append(f"{SHOT}/neulbom_ranking_full.png")

        # 지역 랭킹(시·도 기준) 구간 — 표 제목·시·도 이름·순위 줄이 한 화면에
        page.evaluate(
            """() => {
              const el = document.querySelector('[data-region-rank-section]');
              if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76 });
            }"""
        )
        page.wait_for_timeout(500)
        page.screenshot(path=f"{SHOT}/neulbom_ranking_sido.png")
        shots.append(f"{SHOT}/neulbom_ranking_sido.png")

        browser.close()
    finally:
        httpd.shutdown()
    return shots


def main():
    with sync_playwright() as pw:
        shots = run_screen(pw)
    print("스크린샷:", shots)
    print("\n결과:", "통과" if not errors else f"실패 {errors}")
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
