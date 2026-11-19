"""라이브 늘봄 랭킹 화면 검증 — 시·도 기준 지역 랭킹 + 2026-11-19 시안.

- 임시 계정 2명(충청북도 옥천군 / 충청북도 청주시)과 임시 모임 하나를 DB 에 만들고
  이번 주 점수를 채운 뒤, 라이브 화면을 390×844 로 열어 확인한다.
- 확인: 히어로(지역/모임 탭) · 시상대 · 우리 모임 내 순위 · 함께해요 배너 ·
  지역 랭킹(충청북도) · 우리 모임 랭킹 · 오늘의 미션(치매예방 퀴즈) ·
  주간 명예의 전당 · 모임 참여 현황 · 응원 배너 · 글씨 3단계 가로 넘침 0.
- 끝나면 임시 계정·모임·기록을 모두 지운다.
- 실행: python3 e2e/check_ranking_sido_live.py
"""
import json
import os
import sys
import urllib.request

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

TOKEN = open("/workspace/work/senior-platform/.supabase_token").read().strip()
PROJECT = "aaslirekynetqguajkpv"
BASE = os.environ.get("BASE", "https://senior-life-platform.pages.dev").rstrip("/")
SHOT = "/workspace/downloads"
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")
os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.libs/usr/lib/x86_64-linux-gnu:/workspace/work/.tools/browser-libs"
)
TODAY = "2026-11-19"
DATES = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"]
WEEK = "2026-W47"


def make_code(seed: str) -> str:
    h = 2166136261
    for ch in seed:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    out = ""
    n = h
    while n:
        n, r = divmod(n, 36)
        out = digits[r] + out
    return out.upper()[-6:].rjust(6, "0")


ID_ME = "zz-ranking-ui-me"
ID_FRIEND = "zz-ranking-ui-friend"
CODE_ME = make_code(ID_ME)
CODE_FRIEND = make_code(ID_FRIEND)
GROUP = "ZZGRP1"
NICK_ME = "김순자"
NICK_FRIEND = "박영수"

errors = []
shots = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
    if not cond:
        errors.append(label)


def sql(query):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT}/database/query",
        data=json.dumps({"query": query}).encode(),
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.loads(res.read() or b"[]")


def cleanup():
    codes = f"'{CODE_ME}','{CODE_FRIEND}'"
    for q in [
        f"delete from public.group_members where group_id = '{GROUP}' or user_code in ({codes});",
        f"delete from public.groups where id = '{GROUP}';",
        f"delete from public.daily_visits where user_code in ({codes});",
        f"delete from public.quiz_logs where user_code in ({codes});",
        f"delete from public.health_checks where user_code in ({codes});",
        f"delete from public.activity_logs where user_code in ({codes});",
        f"delete from public.users where code in ({codes});",
    ]:
        try:
            sql(q)
        except Exception as e:  # noqa: BLE001
            print("  (cleanup skip)", q[:60], e)


def seed():
    cleanup()
    for code, nick, sigungu in ((CODE_ME, NICK_ME, "옥천군"), (CODE_FRIEND, NICK_FRIEND, "청주시")):
        sql(
            "insert into public.users (code, nickname, sido, sigungu, birth_year, source, ranking_visible, profile_completed, created_at) "
            f"values ('{code}','{nick}','충청북도','{sigungu}',1952,'demo',true,true,'{DATES[0]} 00:10:00+00');"
        )
        for d in DATES:
            sql(f"insert into public.daily_visits (user_code, visit_date) values ('{code}','{d}');")
            sql(
                "insert into public.quiz_logs (user_code, quiz_date, week_id, correct, total, points) "
                f"values ('{code}','{d}','{WEEK}',3,3,30);"
            )
            sql(
                "insert into public.health_checks (user_code, check_date, challenges) "
                f"values ('{code}','{d}',array['walk']);"
            )
            sql(
                "insert into public.activity_logs (user_code, activity_date, kind) "
                f"values ('{code}','{d}','welfare'),('{code}','{d}','group');"
            )
    sql(
        "insert into public.groups (id, name, description, creator_code, is_demo, region, weekly_goal, goal_score) "
        f"values ('{GROUP}','검증 모임','랭킹 화면 검증용','{CODE_ME}',false,'충청북도 옥천군',100,100);"
    )
    sql(
        "insert into public.group_members (group_id, user_code, name, role) "
        f"values ('{GROUP}','{CODE_ME}','{NICK_ME}','leader'),('{GROUP}','{CODE_FRIEND}','{NICK_FRIEND}','member');"
    )
    sql(f"update public.users set active_group_id = '{GROUP}' where code = '{CODE_ME}';")
    print(f"  임시 계정: {NICK_ME}({CODE_ME}) · {NICK_FRIEND}({CODE_FRIEND}) · 모임 {GROUP}")


def local_state(font_size: int) -> dict:
    quiz = [
        {
            "date": d,
            "weekId": WEEK,
            "correct": 3,
            "total": 3,
            "points": 30,
            "seconds": 40,
            "types": ["choseong", "lyrics", "ox"],
            "at": f"{d}T09:00:00+09:00",
        }
        for d in DATES
    ]
    return {
        "version": 1,
        "profile": {
            "id": ID_ME,
            "nickname": NICK_ME,
            "birthYear": 1952,
            "birthTime": "모름",
            "sido": "충청북도",
            "sigungu": "옥천군",
            "createdAt": f"{DATES[0]}T00:10:00.000Z",
            "source": "demo",
            "profileCompleted": True,
        },
        "quizLogs": quiz,
        "daily": {"date": TODAY, "answered": 3, "correct": 3, "points": 30, "done": True, "answeredIds": []},
        "med": {},
        "visits": DATES,
        "familyEvents": [],
        "health": {d: ["walk"] for d in DATES},
        "missions": {d: ["welfare", "group"] for d in DATES},
        "rankingVisible": True,
        "fontSize": font_size,
        "lastVisit": TODAY,
    }


def open_ranking(page):
    if page.locator("[data-ranking-hero]").count():
        return
    page.locator("nav[aria-label='주요 메뉴'] button").nth(3).click()
    page.wait_for_timeout(1200)
    if not page.locator("[data-ranking-hero]").count():
        page.locator("nav[aria-label='주요 메뉴'] button").nth(3).click()
        page.wait_for_timeout(900)


def set_state(page, font_size: int):
    page.evaluate(
        "(s) => localStorage.setItem('seniorLife.v1', JSON.stringify(s))",
        local_state(font_size),
    )
    page.reload(wait_until="domcontentloaded")
    page.wait_for_timeout(1200)
    open_ranking(page)
    page.wait_for_timeout(900)


def main():
    seed()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
            page = browser.new_page(viewport={"width": 390, "height": 844})
            page.goto(f"{BASE}/", wait_until="domcontentloaded")
            page.wait_for_timeout(1200)
            set_state(page, 21)

            hero = page.locator("[data-ranking-hero]")
            check(hero.count() == 1, "라이브 — 이번 주 랭킹 히어로 카드")
            hero_text = hero.inner_text()
            check("충청북도" in hero_text, "히어로에 정식 시·도 명칭(충청북도)", hero_text.replace("\n", " ")[:90])
            check("김순자" in hero_text, "시상대에 내 이름(1위)")
            check(page.locator("[data-rank-mode='region']").count() == 1, "지역 랭킹 탭")
            check(page.locator("[data-rank-mode='group']").count() == 1, "모임 랭킹 탭")
            check(page.get_by_text("이번 주도 함께해요!").count() >= 1, "함께해요 배너")
            check(page.locator("[data-region-rank-section]").count() == 1, "지역 랭킹 순위표")
            region_text = page.locator("[data-region-rank-section]").inner_text()
            check("(충청북도)" in region_text, "지역 순위표 제목에 (충청북도)", region_text.replace("\n", " ")[:80])
            check("박영수" in region_text and "김순자" in region_text, "같은 도 다른 시·군(청주시)이 한 순위표에")
            check(page.locator("[data-rank-row][data-rank-me='1']").count() >= 1, "내 줄 민트 하이라이트")
            group_text = page.locator("[data-group-rank-section]").inner_text()
            check("검증 모임" in group_text and NICK_FRIEND in group_text, "우리 모임 랭킹에 모임원")
            check(page.locator("[data-league-missions]").count() == 1, "오늘의 미션 카드")
            check(page.get_by_text("치매예방 퀴즈 풀기").count() >= 1, "오늘의 미션 — 치매예방 퀴즈")
            check(page.get_by_text("모두 완료! 🎉").count() >= 1, "오늘의 미션 모두 완료 배지")
            check(page.locator("[data-week-champion]").count() == 1, "주간 명예의 전당")
            check("김순자" in page.locator("[data-week-champion]").inner_text(), "명예의 전당 1위 이름")
            check(page.locator("[data-group-join-status]").count() == 1, "모임 참여 현황 카드")
            check("2명 / 2명" in page.locator("[data-group-join-status]").inner_text(), "오늘 참여자 2명 / 2명")
            check(page.locator("[data-donut='100']").count() == 1, "참여율 도넛 100%")
            check(page.locator("[data-rank-cheer]").count() == 1, "응원 배너")
            check(page.locator("nav[aria-label='주요 메뉴'] button").count() == 6, "하단 탭 6개 유지")

            # 화면 위 → 첫 화면
            page.screenshot(path=f"{SHOT}/neulbom_ranking_top.png")
            shots.append(f"{SHOT}/neulbom_ranking_top.png")

            # 모임 랭킹 탭도 확인
            page.locator("[data-rank-mode='group']").click()
            page.wait_for_timeout(500)
            check("박영수" in page.locator("[data-ranking-hero]").inner_text(), "모임 탭 시상대에 모임원")
            page.locator("[data-rank-mode='region']").click()
            page.wait_for_timeout(400)

            # 글씨 3단계 가로 넘침
            for size, label in ((18, "보통"), (21, "크게"), (24, "아주 크게")):
                set_state(page, size)
                overflow = page.evaluate(
                    "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
                )
                check(overflow <= 0, f"가로 넘침 없음 — {label}", f"scrollWidth-clientWidth={overflow}")

            # 지역 랭킹 구간 — 시·도 이름이 한눈에
            set_state(page, 21)
            page.evaluate(
                """() => {
                  const el = document.querySelector('[data-region-rank-section]');
                  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76 });
                }"""
            )
            page.wait_for_timeout(500)
            page.screenshot(path=f"{SHOT}/neulbom_ranking_sido.png")
            shots.append(f"{SHOT}/neulbom_ranking_sido.png")

            page.screenshot(path=f"{SHOT}/neulbom_ranking_full.png", full_page=True)
            shots.append(f"{SHOT}/neulbom_ranking_full.png")

            browser.close()
    finally:
        cleanup()
        left = sql(
            f"select (select count(*) from public.users where code in ('{CODE_ME}','{CODE_FRIEND}')) as users, "
            f"(select count(*) from public.groups where id = '{GROUP}') as groups, "
            f"(select count(*) from public.group_members where group_id = '{GROUP}') as members;"
        )
        check(
            left and left[0]["users"] == 0 and left[0]["groups"] == 0 and left[0]["members"] == 0,
            "임시 계정·모임·기록 삭제 완료",
            str(left),
        )

    print("스크린샷:", shots)
    print("\n결과:", "통과" if not errors else f"실패 {errors}")
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
