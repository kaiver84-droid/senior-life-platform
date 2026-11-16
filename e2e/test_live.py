"""라이브(Cloudflare Pages) 390×844 E2E 전체 검증.

BASE=https://senior-life-platform.pages.dev python3 e2e/test_live.py
"""
import json
import os
import sys
import urllib.request
from collections import Counter

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", "https://senior-life-platform.pages.dev").rstrip("/")
SHOT = "/workspace/downloads"


def api(path):
    req = urllib.request.Request(BASE + path, headers={"User-Agent": "Mozilla/5.0 (E2E check)"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.status, json.loads(r.read().decode())


def main():
    res = {}
    errors = []

    # 1) API 계약 확인 (Pages Functions)
    code, health = api("/api/health")
    res["api_health"] = {"status": code, "supabase": health.get("supabase"), "kakao": health.get("kakao")}
    code, rank = api("/api/rankings?scope=region&sido=%EC%B6%A9%EC%B2%AD%EB%B6%81%EB%8F%84&sigungu=%EC%98%A5%EC%B2%9C%EA%B5%B0&name=%EC%88%9C%EC%9E%90&points=60&streak=2&birthYear=1952")
    res["api_rankings"] = {"status": code, "weekId": rank.get("weekId"), "total": rank.get("total"),
                           "myRank": rank.get("myRank"), "rows": len(rank.get("rows", [])), "sample": rank.get("sample")}

    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"])
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                                  locale="ko-KR", is_mobile=True, has_touch=True, permissions=["camera"])
        page = ctx.new_page()
        page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_selector("#nick", timeout=25000)
        res["onboarding_ok"] = True
        page.fill("#nick", "순자")
        page.select_option("#birth", "1952")
        page.select_option("#sido", "충청북도")
        page.select_option("#sigungu", "옥천군")
        page.get_by_role("button", name="시작하기").click()
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=20000)
        page.wait_for_timeout(3000)

        # 홈
        res["home_fortune"] = page.get_by_text("오늘의 운세").is_visible()
        res["home_weather"] = page.get_by_text("날씨 생활 팁").is_visible()
        card_png = page.evaluate("""() => { const cs=[...document.querySelectorAll('canvas')]; const c=cs[0]; return c&&c.width?c.toDataURL('image/png').length:0; }""")
        res["greeting_canvas_bytes"] = card_png
        with page.expect_download(timeout=20000) as dl:
            page.get_by_role("button", name="저장").click()
        dl.value.save_as(f"{SHOT}/senior_greeting_card.png")
        res["greeting_saved"] = os.path.getsize(f"{SHOT}/senior_greeting_card.png")

        # 퀴즈
        page.get_by_role("navigation").get_by_role("button").nth(1).click()
        page.wait_for_selector("text=1분 두뇌 퀴즈", timeout=15000)
        page.get_by_role("button", name="퀴즈 시작하기").click()
        page.wait_for_timeout(900)
        for _ in range(3):
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
        page.wait_for_selector("text=오늘의 퀴즈 결과", timeout=15000)
        res["quiz_result"] = page.locator("text=획득").first.inner_text()

        page.get_by_role("button", name="금빛 상장 만들기").click()
        page.wait_for_timeout(1600)
        cert = page.evaluate("""() => { const cs=[...document.querySelectorAll('canvas')]; const c=cs[cs.length-1]; return c&&c.width?c.toDataURL('image/png').length:0; }""")
        res["certificate_canvas_bytes"] = cert

        # 랭킹 탭
        page.get_by_role("button", name="랭킹 화면 열기").click()
        page.wait_for_selector("text=이번 주 순위", timeout=15000)
        page.wait_for_timeout(1200)
        res["ranking_title"] = page.locator("h1").first.inner_text().replace("\n", " ")
        res["ranking_live_api"] = page.evaluate("""async () => {
            const r = await fetch('/api/rankings?scope=zodiac&name=순자&points=60&streak=2&birthYear=1952');
            const j = await r.json();
            return { status: r.status, ok: j.ok, total: j.total, rows: j.rows ? j.rows.length : 0 };
        }""")
        tabs = {}
        for t in ["띠·나이", "개근상", "우리 동네"]:
            page.get_by_role("button", name=t).first.click()
            page.wait_for_timeout(600)
            tabs[t] = page.locator("text=내 순위").count()
        res["ranking_tabs"] = tabs
        res["ranking_percentile"] = page.locator("text=상위").first.inner_text()

        # 혜택
        page.get_by_role("navigation").get_by_role("button").nth(3).click()
        page.wait_for_selector("text=내게 맞는 지원금", timeout=15000)
        res["welfare_count"] = page.locator("h3").count()
        page.locator("h3").first.click()
        page.wait_for_timeout(700)
        res["welfare_steps"] = page.locator("ol li").count()
        res["welfare_tel"] = page.locator("a[href^='tel:']").count()

        # 도구
        page.get_by_role("navigation").get_by_role("button").nth(4).click()
        page.wait_for_selector("text=생활 도구", timeout=15000)
        page.get_by_role("button", name="돋보기 켜기").click()
        page.wait_for_timeout(1800)
        res["magnifier_video"] = page.locator("video").count()
        page.screenshot(path=f"{SHOT}/_live_magnifier.png")
        page.get_by_role("button", name="돋보기 닫기").click()
        page.wait_for_timeout(500)
        page.get_by_text("보이스피싱 구별법").click()
        page.wait_for_timeout(700)
        res["cardnews_slide"] = page.locator("h4").first.inner_text()
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)

        # 가족
        page.get_by_role("navigation").get_by_role("button").nth(5).click()
        page.wait_for_selector("text=가족 연결", timeout=15000)
        page.get_by_role("button", name="아침 약").click()
        page.wait_for_timeout(300)
        page.get_by_role("button", name="저녁 약").click()
        page.wait_for_timeout(1500)
        res["med_done"] = page.locator("text=완료 ✓").count()
        code = page.locator(".tabular").first.inner_text().strip()
        res["family_code"] = code
        page.wait_for_timeout(2500)
        # 서버 저장 확인 (/api/state)
        state = page.evaluate("""async (code) => {
            const r = await fetch('/api/state?code=' + code);
            const j = await r.json();
            return { status: r.status, ok: j.ok, nickname: j.state && j.state.profile ? j.state.profile.nickname : null,
                     logs: j.state ? j.state.quizLogs.length : 0, med: j.state ? Object.keys(j.state.med).length : 0 };
        }""", code)
        res["api_state"] = state

        # 자녀 대시보드
        page.goto(f"{BASE}/family/?code={code}", wait_until="domcontentloaded")
        page.wait_for_timeout(2500)
        res["dashboard_title"] = page.locator("h1").first.inner_text()
        res["dashboard_visit"] = page.locator("text=오늘 앱에 접속했어요").count()
        res["dashboard_med"] = page.locator("text=✓ 먹었어요").count()

        res["console_errors"] = errors
        browser.close()

    print(json.dumps(res, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
