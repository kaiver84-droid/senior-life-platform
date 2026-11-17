"""여러 모임 동시 가입 · 전환 + 단체별 랭킹 검증 (390×844).

로컬:  python3 e2e/test_groups_multi.py
라이브: BASE=https://senior-life-platform.pages.dev python3 e2e/test_groups_multi.py
        (라이브에서는 이 검증용 계정이 만든 모임을 끝나고 DB 에서 지운다)
"""
import json
import os
import re
import sys
import time
import urllib.request

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", "http://127.0.0.1:8099").rstrip("/")
SHOT = "/workspace/downloads"
LOCAL = "127.0.0.1" in BASE or "localhost" in BASE
KAKAO_ID = os.environ.get("STUB_KAKAO_ID", "777000333")

fails = []


def check(ok, label, extra=""):
    print(("✅ " if ok else "❌ ") + label + (f" · {extra}" if extra else ""))
    if not ok:
        fails.append(label)


def nav(page, name):
    page.get_by_role("navigation").get_by_role("button").filter(has_text=name).first.click()


def sql(query):
    token = open("/workspace/work/senior-platform/.supabase_token").read().strip()
    req = urllib.request.Request(
        "https://api.supabase.com/v1/projects/aaslirekynetqguajkpv/database/query",
        data=json.dumps({"query": query}).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read() or b"[]")


def server_groups(code):
    """라이브에서만 — 서버(Supabase)에 실제로 저장된 내 모임 목록"""
    if not code:
        return []
    try:
        url = f"{BASE}/api/groups?code={code}&meName=%EC%88%9C%EC%9E%90&mePoints=0&meDays=1&meToday=1"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (E2E)"})
        with urllib.request.urlopen(req, timeout=20) as res:
            return json.loads(res.read().decode()).get("groups", [])
    except Exception:  # noqa: BLE001
        return []


def wait_server_group(code, name, tries=16):
    """서버에 그 이름의 모임이 생길 때까지 잠깐 기다린다(폴백 저장이 아니라 진짜 저장 확인)"""
    for _ in range(tries):
        for g in server_groups(code):
            if g.get("name") == name:
                return g.get("id", "")
        time.sleep(0.8)
    return ""


def make_group(page, name):
    page.get_by_role("button", name="+ 새 모임 만들기").first.click()
    page.wait_for_selector("#group-name", timeout=15000)
    page.locator("#group-name").fill(name)
    page.get_by_role("button", name=re.compile("^모임 만들기$")).last.click()
    # 서버 저장이 끝나 목록에 새 모임이 뜰 때까지 기다린다(라이브는 왕복이 조금 느리다)
    page.wait_for_function(
        "(n) => !!document.querySelector('[data-group-switcher]') && document.querySelector('[data-group-switcher]').innerText.includes(n)",
        arg=name,
        timeout=20000,
    )
    # 만든 직후에는 초대 시트가 스스로 열린다(2026-11-17 개선) — 다음 동작을 가로막지 않게 닫는다
    page.wait_for_timeout(500)
    if page.locator("[data-group-invite-sheet]").count():
        page.keyboard.press("Escape")
        page.wait_for_timeout(600)
    page.wait_for_timeout(400)


def main():
    httpd = None
    if LOCAL:
        from harness import onboard, start_server

        httpd = start_server()

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True,
        )
        page = ctx.new_page()
        errors = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        code = ""

        try:
            if LOCAL:
                onboard(page)
            else:
                from test_kakao_onboarding import js_make_code
                from test_live_final import onboard_demo, stub_kakao

                code = js_make_code(f"kakao_{KAKAO_ID}")
                stub_kakao(page)
                onboard_demo(page)

            # ---------- 1) 모임 탭: 첫 모임 ----------
            nav(page, "모임")
            enter = page.get_by_role("button", name=re.compile("체험 모임 들어가기"))
            page.wait_for_function(
                "() => document.querySelector('[data-group-switcher]') || document.body.innerText.includes('모임을 시작해 보세요')",
                timeout=20000,
            )
            page.wait_for_timeout(600)
            if enter.count():
                enter.first.click()
                page.wait_for_timeout(2800)
            page.wait_for_selector("[data-group-switcher]", timeout=20000)
            before = page.locator("[data-group-row]").count()
            print(f"   시작 모임 수: {before}")

            add_btns = page.locator("[data-group-switcher] [data-group-add-buttons] button")
            check(add_btns.count() == 2, "우리 모임 화면 상단: 추가 버튼 2개 노출", str(add_btns.count()))
            check(
                page.get_by_role("button", name="+ 새 모임 만들기").first.is_visible(),
                "‘+ 새 모임 만들기’ 버튼",
            )
            check(
                page.get_by_role("button", name="초대 번호로 모임 추가").first.is_visible(),
                "‘초대 번호로 모임 추가’ 버튼",
            )
            for i in range(add_btns.count()):
                h = add_btns.nth(i).bounding_box()["height"]
                check(h >= 52, f"추가 버튼 {i + 1} 높이 52px 이상", f"{h:.0f}px")

            # ---------- 2) 모임 A · 모임 B 연달아 만들기 ----------
            make_group(page, "가족 모임")
            rows_a = page.locator("[data-group-row]").count()
            if LOCAL:
                m = re.search(
                    r"번호 ([A-Z0-9]{6})",
                    page.locator("[data-group-row]", has_text="가족 모임").first.inner_text(),
                )
                code_a = m.group(1) if m else ""
            else:
                code_a = wait_server_group(code, "가족 모임")
            check(bool(code_a), "모임 A 가 서버에 저장됨", code_a)
            check(
                rows_a == before + 1 if LOCAL else rows_a >= before + 1,
                "모임 A 만든 뒤 목록 +1",
                f"{before} → {rows_a}",
            )
            check("가족 모임" in page.inner_text("main"), "모임 A 로 전환됨")
            check(
                page.get_by_text("가족 모임").first.is_visible()
                and "멤버 1명" in page.inner_text("main"),
                "모임 A 멤버 1명",
            )

            make_group(page, "친구 모임")
            rows_b = page.locator("[data-group-row]").count()
            check(
                rows_b == before + 2 if LOCAL else rows_b >= before + 2,
                "모임 B 만든 뒤 목록 +2",
                f"{before} → {rows_b}",
            )
            check("친구 모임" in page.inner_text("main"), "모임 B 로 전환됨")
            names = page.locator("[data-group-switcher]").inner_text()
            check(
                "가족 모임" in names and "친구 모임" in names,
                "한 화면에 여러 모임이 함께 보임",
            )
            check(page.get_by_text("전환 ›").count() >= 1, "다른 모임에 ‘전환’ 표시")
            page.evaluate("() => window.scrollTo(0, 0)")
            page.wait_for_timeout(600)
            page.screenshot(path=f"{SHOT}/neulbom_groups_switch.png")

            # ---------- 3) 게시판으로 전환이 실제로 바뀌는지 ----------
            page.get_by_label("모임 게시판에 남길 말").fill("B 모임에 남긴 안부")
            page.get_by_role("button", name="남기기").click()
            page.wait_for_timeout(1800)

            page.locator("[data-group-row]", has_text="가족 모임").first.click()
            page.wait_for_timeout(2500)
            a_text = page.inner_text("main")
            check("가족 모임" in a_text, "모임 A 로 전환")
            check("B 모임에 남긴 안부" not in a_text, "모임 B 게시글은 모임 A 에 안 보임")
            check("오늘 출석 현황" in a_text and "이번 주 모임 달성률" in a_text, "모임 A 출석·달성률 표시")

            page.get_by_label("모임 게시판에 남길 말").fill("A 모임에 남긴 안부")
            page.get_by_role("button", name="남기기").click()
            page.wait_for_timeout(1800)

            page.locator("[data-group-row]", has_text="친구 모임").first.click()
            page.wait_for_timeout(2500)
            b_text = page.inner_text("main")
            check("A 모임에 남긴 안부" not in b_text, "모임 A 게시글은 모임 B 에 안 보임")
            check("B 모임에 남긴 안부" in b_text, "모임 B 게시글이 그대로 남아 있음")

            # ---------- 3-b) 초대 번호로 다른 모임에 추가 가입 ----------
            check(bool(code_a), "모임 A 초대 번호 확인", code_a)
            page.get_by_role("button", name="초대 번호로 모임 추가").first.click()
            page.wait_for_selector("#group-code", timeout=15000)
            page.locator("#group-code").fill(code_a)
            page.get_by_role("button", name="모임 들어가기", exact=True).click()
            page.wait_for_function(
                "() => document.body.innerText.includes('가족 모임')", timeout=20000
            )
            page.wait_for_timeout(1500)
            check(
                page.locator("[data-group-row]").count() >= before + 2,
                "초대 번호로 들어가도 모임 목록 그대로",
                str(page.locator("[data-group-row]").count()),
            )
            check("친구 모임" in page.inner_text("[data-group-switcher]"), "가입 후에도 원래 모임이 남아 있음")

            # ---------- 4) 홈 모임 선택 시트에도 추가 버튼 ----------
            nav(page, "홈")
            page.wait_for_timeout(1500)
            page.get_by_role("button", name="모임 바꾸기").first.click()
            page.wait_for_selector("text=보고 싶은 모임을 골라 주세요", timeout=15000)
            page.wait_for_timeout(600)
            sheet_text = page.inner_text("body")
            check("가족 모임" in sheet_text and "친구 모임" in sheet_text, "홈 시트에 여러 모임")
            check(
                page.get_by_role("button", name="+ 새 모임 만들기").first.is_visible(),
                "홈 모임 시트: 새 모임 만들기 버튼",
            )
            check(
                page.get_by_role("button", name="초대 번호로 모임 추가").first.is_visible(),
                "홈 모임 시트: 초대 번호로 모임 추가 버튼",
            )
            page.screenshot(path=f"{SHOT}/_home_group_sheet.png")
            page.get_by_role("button", name=re.compile("가족 모임")).first.click()
            page.wait_for_timeout(2500)
            check("가족 모임" in page.inner_text("main"), "홈 시트에서도 한 번에 모임 전환")

            # ---------- 5) 단체별 랭킹 ----------
            nav(page, "랭킹")
            page.wait_for_timeout(1500)
            tab = page.locator("[data-rank-tab='groups']")
            check(tab.count() == 1, "랭킹 탭에 ‘단체별’ 있음")
            check(tab.is_visible(), "‘단체별’ 탭 보임")
            box = tab.bounding_box()
            check(box["x"] >= 0 and box["x"] + box["width"] <= 390, "‘단체별’ 탭이 화면 밖으로 잘리지 않음",
                  f'x={box["x"]:.0f} w={box["width"]:.0f}')
            tab.click()
            page.wait_for_selector("[data-group-rank]", timeout=15000)
            page.wait_for_timeout(1800)

            board = page.locator("[data-group-rank]").inner_text()
            check("단체 명예의 전당" in board or "1위" in board, "단체 시상대 렌더링")
            check(page.get_by_text("1위").count() >= 1 and page.get_by_text("2위").count() >= 1 and page.get_by_text("3위").count() >= 1,
                  "1·2·3위 시상대")
            check("명" in board and "출석" in board and "%" in board, "인원수 · 출석률 표시")
            check("평균" in board and "점" in board, "평균·총점 표시")
            check(page.locator("[data-my-group-rank]").count() == 1, "내 모임 순위 카드")
            check("내 모임" in board, "‘내 모임’ 표시")
            check("가족 모임" in board, "내가 만든 모임이 단체 순위에 나옴")
            # 전체 순위까지 한 장에 담기게 — 화면에 붙어 있는 위·아래 막대는 잠깐 숨기고 찍는다
            page.add_style_tag(
                content="header{visibility:hidden!important} nav[aria-label='주요 메뉴']{visibility:hidden!important}"
            )
            page.wait_for_timeout(300)
            page.locator("main").screenshot(path=f"{SHOT}/neulbom_group_rank_tab.png")

            real = [e for e in errors if "favicon" not in e and "Failed to load resource" not in e]
            check(not real, "콘솔 오류 0건", str(real[:3]))

            browser.close()
        finally:
            if httpd:
                httpd.shutdown()
            if not LOCAL and code:
                # 검증용 계정이 만든 모임은 실제 사용자 순위표에 남지 않게 지운다
                try:
                    sql(
                        "delete from public.group_posts where user_code = '{0}';"
                        "delete from public.groups where creator_code = '{0}';".format(code)
                    )
                    print(f"   정리: {code} 가 만든 모임 삭제")
                except Exception as exc:  # noqa: BLE001
                    print(f"   정리 실패: {exc}")

    print("\n결과:", "모두 통과" if not fails else f"{len(fails)}건 실패 → {fails}")
    return 0 if not fails else 1


if __name__ == "__main__":
    raise SystemExit(main())
