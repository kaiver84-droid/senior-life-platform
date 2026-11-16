"""E2E 2/3 — 퀴즈 3문제 · 상장 · 명예의 전당 검증 + 스크린샷."""
import sys, os, json
sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from harness import start_server, onboard, PORT
from playwright.sync_api import sync_playwright

SHOT = "/workspace/downloads"

def answer_current(page, results, idx):
    """초성·가사 문제는 정답이 항상 1번(인덱스 0), 틀린 그림은 다른 그림을 찾아 누른다."""
    # 틀린 그림인지 확인
    grid = page.locator("button[aria-label$='번째 그림']")
    if grid.count() > 0:
        cells = [grid.nth(i).inner_text().strip() for i in range(grid.count())]
        # 가장 적은 글자가 다른 그림
        from collections import Counter
        cnt = Counter(cells)
        odd = min(cnt, key=lambda k: cnt[k])
        target = cells.index(odd)
        grid.nth(target).click()
        results[f"q{idx}"] = {"type": "spot", "cells": cells, "picked": target}
    else:
        opts = page.locator("main button:has(span)").filter(has_text="")
        first = page.locator("main .space-y-2\\.5 > button").first
        first.click()
        results[f"q{idx}"] = {"type": "choice"}
    page.wait_for_timeout(500)
    fb = page.locator("text=정답이에요").count() + page.locator("text=아쉽지만").count()
    results[f"q{idx}_feedback"] = fb
    page.get_by_role("button", name="다음 문제").or_(page.get_by_role("button", name="결과 보기")).first.click()
    page.wait_for_timeout(600)


def main():
    httpd = start_server()
    errors, results = [], {}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ko-KR", is_mobile=True, has_touch=True)
        page = ctx.new_page()
        page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" and "/api/" not in (m.location or {}).get("url", "") else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        onboard(page)
        # 퀴즈 탭
        page.get_by_role("button", name="퀴즈", exact=True).click()
        page.wait_for_selector("text=1분 두뇌 퀴즈", timeout=10000)
        page.get_by_role("button", name="퀴즈 시작하기").click()
        page.wait_for_timeout(700)

        for i in range(3):
            results[f"prompt_{i}"] = page.locator("main p").first.inner_text()[:40]
            answer_current(page, results, i)

        page.wait_for_selector("text=오늘의 퀴즈 결과", timeout=10000)
        results["result_text"] = page.locator("text=오늘의 퀴즈 결과").first.inner_text()
        results["points_shown"] = page.locator("text=획득").first.inner_text()

        # 상장 생성
        page.get_by_role("button", name="금빛 상장 만들기").click()
        page.wait_for_timeout(1500)
        results["cert_png"] = page.evaluate("""() => {
            const cs=[...document.querySelectorAll('canvas')];
            const c=cs[cs.length-1];
            return c && c.width ? c.toDataURL('image/png').length : 0;
        }""")
        with page.expect_download(timeout=15000) as dl:
            page.get_by_role("button", name="저장").first.click()
        d = dl.value
        cert_path = os.path.join(SHOT, "senior_certificate.png")
        d.save_as(cert_path)
        results["cert_saved"] = os.path.getsize(cert_path)

        # 퀴즈 결과 스크린샷
        page.get_by_text("오늘의 퀴즈 결과").scroll_into_view_if_needed()
        page.wait_for_timeout(600)
        page.screenshot(path=os.path.join(SHOT, "senior_quiz_result.png"))

        # 전용 랭킹 탭으로 이동
        page.get_by_role("button", name="랭킹 화면 열기").click()
        page.wait_for_selector("text=이번 주 순위", timeout=10000)
        page.wait_for_timeout(800)
        results["rank_tab_title"] = page.locator("h1").first.inner_text().replace("\n", " ")
        ranks = {}
        for t in ["띠·나이", "개근상", "우리 동네"]:
            page.get_by_role("button", name=t).first.click()
            page.wait_for_timeout(700)
            ranks[t] = page.locator("text=내 순위").count()
        results["ranking_tabs"] = ranks
        results["ranking_rows"] = page.locator("text=(나)").count()
        results["percentile"] = page.locator("text=상위").first.inner_text()
        page.screenshot(path=os.path.join(SHOT, "senior_ranking_tab.png"))
        # 오늘 퀴즈 풀러 가기 → 이미 완료 상태면 결과/상장 보기
        page.get_by_role("button", name="퀴즈 결과 · 상장 보기").or_(
            page.get_by_role("button", name="오늘 퀴즈 풀러 가기")
        ).first.click()
        page.wait_for_timeout(900)
        results["quiz_return"] = page.evaluate("location.hash")

        results["console_errors"] = errors
        browser.close()
    httpd.shutdown()
    print(json.dumps(results, ensure_ascii=False, indent=1))

if __name__ == "__main__":
    main()
