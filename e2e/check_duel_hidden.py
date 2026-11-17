#!/usr/bin/env python3
"""늘봄 — 친구와 1:1 대결 화면 숨김(ENABLE_DUELS=false) 라이브 검증.

라이브(https://senior-life-platform.pages.dev)를 390×844 모바일 뷰포트로 열어
1) 랭킹 탭에 1:1 대결 UI(목록·신청 카드·대결 링크·수락 배너)가 하나도 안 보이는지
2) ?duel= 초대 링크로 들어와도 대결 배너가 뜨지 않는지
3) 랭킹 2차의 나머지(등급 카드·배지 컬렉션·모임 대항전·퀴즈 318문항)가 그대로 동작하는지
4) 가로 넘침 0 · 콘솔 오류 0
5) 대결 API·DB 는 살아 있는지(서버 응답 ok)
를 확인하고 스크린샷을 downloads/neulbom_hide_duel.png 에 남긴다.

사용법: python3 e2e/check_duel_hidden.py
"""
import json
import os
import re
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

import check_ranking_phase2 as base  # noqa: E402

BASE = base.BASE
SHOT = "/workspace/downloads"
OUT = f"{SHOT}/neulbom_hide_duel.png"
CHROME = base.CHROME
os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.libs/usr/lib/x86_64-linux-gnu:/workspace/work/.tools/browser-libs"
)
results = {}
errors = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
    results[label] = bool(cond)
    if not cond:
        errors.append(label)


DUEL_SELECTORS = [
    "[data-duel-section]",
    "[data-duel-invite]",
    "[data-duel-open]",
    "[data-duel-link-copy]",
    "[data-duel-link]",
    "[data-duel-list]",
    "[data-duel-card]",
    "[data-duel-sheet]",
    "[data-duel-link-banner]",
]
DUEL_TEXTS = ["1:1 대결", "친구와 1:1", "대결 링크", "대결을 신청", "수락하고 겨루기", "오늘의 대결"]


def main():
    base.cleanup()  # 이전 실행의 테스트 계정 정리
    console_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            locale="ko-KR",
            is_mobile=True,
            has_touch=True,
            timezone_id="Asia/Seoul",
        )
        page = ctx.new_page()
        page.on("pageerror", lambda e: console_errors.append(str(e)))
        page.on("console", lambda m: console_errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
        page.route("**/api/auth/kakao**", base.kakao_stub())

        base.login(page)
        has_group = base.ensure_group(page)
        check(has_group, "모임 준비(체험 모임 참여)", str(has_group))

        base.nav(page, "랭킹")
        page.wait_for_selector("[data-grade-card]", timeout=25000)
        page.wait_for_timeout(2500)

        # ---------- 1. 대결 UI 숨김 ----------
        found = {}
        for sel in DUEL_SELECTORS:
            n = page.locator(sel).count()
            if n:
                found[sel] = n
        check(not found, "랭킹 탭에 1:1 대결 요소 0개", json.dumps(found, ensure_ascii=False))

        body = page.inner_text("body")
        hit = [t for t in DUEL_TEXTS if t in body]
        check(not hit, "화면 글자에 대결 문구 없음", ",".join(hit))
        check(not page.locator("[data-duel-section]").count(), "랭킹 탭 전체 스크롤에도 대결 섹션 없음")
        check(base.no_overflow(page) <= 0, "랭킹 화면 가로 넘침 없음", str(base.no_overflow(page)))

        # ---------- 2. 랭킹 2차 나머지 기능 정상 ----------
        grade_key = page.get_attribute("[data-grade-card]", "data-grade-key")
        check(
            grade_key in ("sprout", "sun", "happy", "gold", "honor"),
            "등급 카드 정상 표시",
            str(grade_key),
        )
        next_text = page.inner_text("[data-grade-next-text]")
        check("등급까지" in next_text or "가장 높은 등급" in next_text, "다음 등급까지 안내", next_text)

        page.click("[data-badge-open]")
        page.wait_for_selector("[data-badge-sheet]", timeout=10000)
        page.wait_for_timeout(600)
        badges = page.eval_on_selector_all("[data-badge]", "els => els.length")
        check(badges == 6, "배지 컬렉션 6종 정상", str(badges))
        page.get_by_role("button", name="닫기").last.click()
        page.wait_for_timeout(800)

        page.locator("[data-area-tab='group']").first.click()
        page.wait_for_timeout(2000)
        page.wait_for_selector("[data-group-battle]", timeout=20000)
        battle = page.query_selector("[data-group-battle]")
        rate = int(battle.get_attribute("data-battle-rate") or 0)
        rank = int(battle.get_attribute("data-battle-rank") or 0)
        check(rank >= 1, "모임 대항전 순위 정상", f"{rank}위 · 진행률 {rate}%")
        check(page.query_selector("[data-battle-join]") is not None, "모임 대항전 참여 버튼 정상")
        check(base.no_overflow(page) <= 0, "모임 대항전 화면 가로 넘침 없음", str(base.no_overflow(page)))

        # 스크린샷: 랭킹 탭 위쪽(등급 카드) + 대결이 있어야 할 자리
        page.locator("[data-grade-card]").scroll_into_view_if_needed()
        page.wait_for_timeout(500)
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(400)
        page.screenshot(path=OUT, full_page=True)
        print("saved", OUT)

        # 퀴즈 화면 문항 수(318) 그대로
        base.nav(page, "퀴즈")
        page.wait_for_timeout(1500)
        bank = page.get_attribute("[data-quiz-bank]", "data-quiz-bank")
        check(bank == "318", "퀴즈 318문항 표시 정상", str(bank))

        # ---------- 3. ?duel= 초대 링크로 들어와도 대결 배너 없음 ----------
        page.goto(f"{BASE}/?duel={base.CODE_OPP}&dn={base.OPP_NAME}&k=total", wait_until="domcontentloaded")
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
        base.nav(page, "랭킹")
        page.wait_for_selector("[data-grade-card]", timeout=25000)
        page.wait_for_timeout(2500)
        check(not page.locator("[data-duel-link-banner]").count(), "?duel= 링크로도 대결 배너가 뜨지 않음")
        pending = page.evaluate("() => window.localStorage.getItem('seniorLife.pendingDuel')")
        check(pending is None, "대결 링크를 저장하지도 않음", str(pending))
        check("1:1 대결" not in page.inner_text("body"), "링크 진입 화면에도 대결 문구 없음")

        # ---------- 4. 콘솔 오류 0 ----------
        fatal = [e for e in console_errors if "Notification" not in e and "favicon" not in e]
        check(not fatal, "콘솔 치명 오류 0건", str(fatal[:3]))
        browser.close()

    # ---------- 5. 대결 API·DB 는 보존 ----------
    api_duels = base.api(f"/api/duels?code={base.CODE_T}&today={base.TODAY}")
    check(bool(api_duels.get("ok")), "대결 API 살아 있음(/api/duels 200)", str(api_duels.get("ok")))
    check("duels" in api_duels, "대결 API 응답 구조 유지", str(list(api_duels.keys())))

    base.cleanup()
    left = base.sql(
        f"select count(*) as n from public.users where code in ('{base.CODE_T}','{base.CODE_OPP}');"
    )
    check(left[0]["n"] == 0, "테스트 계정 정리 완료", str(left))

    print("\n===== 결과 =====")
    print(f"통과 {sum(1 for v in results.values() if v)} / {len(results)}")
    if errors:
        print("실패:", errors)
        sys.exit(1)
    print("모든 점검 통과")


if __name__ == "__main__":
    main()
