"""늘봄 랭킹 고도화 1차 검증 — 7개 영역 · 주간 종합 리그(늘봄왕) · 순위 변동/격차 · 미션 연결 ·
10위 제한 · 랭킹 참여 ON/OFF.

로컬:  python3 e2e/check_ranking_phase1.py
라이브: BASE=https://senior-life-platform.pages.dev python3 e2e/check_ranking_phase1.py

확인하는 것
1) 7개 영역 탭(늘봄왕·두뇌왕·건강왕·출석왕·모임왕·나눔왕·알뜰왕)이 모두 열리고 390px에서 넘치지 않는다
2) 늘봄왕 점수가 쌓인다 — 출석(+10) → 건강(+20) → 복지 확인(+10) → 퀴즈(+30)
3) 하루 최대 140점 상한이 서버에서도 적용된다(큰 값을 보내도 140점/일을 넘지 않는다)
4) 순위 행마다 변동 배지(▲/▼/신규/－)가 있고, 내 요약 카드에 순위·격차 문구가 나온다
5) 영역별 큰 버튼이 해당 미션 화면으로 데려간다
6) 공개 순위표는 10위까지만, 랭킹 참여를 끄면 내가 순위표에서 빠진다(서버 응답도 확인)
7) 테스트 계정·데이터는 끝나고 0건으로 지운다
"""
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", "http://127.0.0.1:8099").rstrip("/")
LOCAL = BASE.startswith("http://127.0.0.1")
SHOT = "/workspace/downloads"
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")
os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.libs/usr/lib/x86_64-linux-gnu:/workspace/work/.tools/browser-libs"
)
NICK = "랭킹점검"
AREA_KEYS = ["all", "brain", "health", "attend", "group", "share", "save"]
KST = timezone(timedelta(hours=9))
TODAY = datetime.now(KST).strftime("%Y-%m-%d")
WEEKDAY = datetime.now(KST).isoweekday()  # 월=1 … 일=7

results = {}
errors = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
    results[label] = bool(cond)
    if not cond:
        errors.append(label)


def no_overflow(page):
    return page.evaluate(
        "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
    )


def overflowing(page):
    return page.evaluate(
        """() => {
          const out = [];
          for (const el of document.querySelectorAll('body *')) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.right > window.innerWidth + 1 && getComputedStyle(el).position !== 'fixed') {
              out.push((el.className && String(el.className).slice(0, 40)) + ' @' + Math.round(r.right));
              if (out.length >= 5) break;
            }
          }
          return out;
        }"""
    )


def gap_texts(page):
    return page.eval_on_selector_all("[data-change]", "els => els.map(e => e.innerText.trim())")


# ---------------------------------------------------------------- 라이브 준비
CODE_T = None
if not LOCAL:
    from test_kakao_onboarding import js_make_code, sql  # noqa: E402

    ID_T = "556611239"  # 랭킹 고도화 1차 전용 테스트 회원번호
    CODE_T = js_make_code(f"kakao_{ID_T}")

    def cleanup():
        codes = f"'{CODE_T}'"
        for q in [
            f"delete from public.activity_logs where user_code in ({codes});",
            f"delete from public.group_cheers where user_code in ({codes});",
            f"delete from public.group_posts where user_code in ({codes});",
            f"delete from public.group_members where user_code in ({codes});",
            f"delete from public.groups where creator_code in ({codes});",
            f"delete from public.quiz_logs where user_code in ({codes});",
            f"delete from public.daily_visits where user_code in ({codes});",
            f"delete from public.med_checks where user_code in ({codes});",
            f"delete from public.health_checks where user_code in ({codes});",
            f"delete from public.family_events where user_code in ({codes});",
            f"delete from public.anbu_messages where user_code in ({codes});",
            f"delete from public.users where code in ({codes});",
        ]:
            try:
                sql(q)
            except Exception as e:  # noqa: BLE001
                print("  (cleanup skip)", q[:60], e)

    def kakao_stub():
        def handler(route, request):
            if "start=1" in request.url:
                route.fulfill(status=302, headers={"location": "/?code=STUB-AUTH-CODE"})
            elif request.method == "POST":
                route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps(
                        {
                            "ok": True,
                            "profile": {
                                "id": f"kakao_{ID_T}",
                                "nickname": NICK,
                                "birthYear": 1952,
                                "source": "kakao",
                                "createdAt": f"{TODAY}T00:00:00.000Z",
                            },
                        }
                    ),
                )
            else:
                route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps(
                        {"ok": True, "supabase": "connected", "kakao": "configured", "kakaoLoginConfigured": True}
                    ),
                )

        return handler

    def api(path):
        with urllib.request.urlopen(f"{BASE}{path}", timeout=30) as res:
            return json.loads(res.read())


def login(page):
    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
    if LOCAL:
        page.get_by_role("button", name="카카오 없이 둘러보기 (개발용)").click()
    else:
        page.get_by_role("button", name="카카오톡으로 시작하기").click()
    page.wait_for_selector("#setup-nick", timeout=30000)
    page.fill("#setup-nick", NICK)
    page.select_option("#setup-birth", "1952")
    page.click('[data-birthtime="묘시"]')
    page.select_option("#setup-sido", "충청북도")
    page.select_option("#setup-sigungu", "옥천군")
    page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
    page.wait_for_timeout(2500)


def nav(page, label):
    page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name=re.compile(f"^{label}")).first.click()
    page.wait_for_timeout(1200)


def active_tab(page):
    el = page.query_selector("nav[aria-label='주요 메뉴'] button[aria-current='page']")
    return (el.inner_text() if el else "").strip()


# 모임 준비 — 모임왕·나눔왕 바로가기를 확인하려면 모임이 하나 있어야 한다

def ensure_group(page):
    nav(page, "모임")
    page.wait_for_timeout(1500)
    if page.query_selector("[data-group-invite-top]"):
        return True
    trial = page.get_by_role("button", name=re.compile("체험 모임 들어가기"))
    if trial.count():
        trial.first.click()
        page.wait_for_timeout(2500)
    return page.query_selector("[data-group-invite-top]") is not None


def today_score(page):
    el = page.query_selector("[data-league-missions]")
    return int(el.get_attribute("data-league-today")) if el else -1


def main():
    shots = []
    if LOCAL:
        from harness import start_server

        start_server()
    else:
        cleanup()

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
        console_errors = []
        page.on("pageerror", lambda e: console_errors.append(str(e)))
        if not LOCAL:
            page.route("**/api/auth/kakao**", kakao_stub())

        login(page)
        # 모임왕·나눔왕 바로가기를 확인할 수 있게 체험 모임에 먼저 들어간다.
        has_group = ensure_group(page)
        check(has_group, "모임 준비(체험 모임 참여) — 모임왕·나눔왕 확인용", str(has_group))

        nav(page, "랭킹")
        page.wait_for_selector("[data-league-missions]", timeout=20000)

        # ---------- 1. 7개 영역 ----------
        tabs = page.eval_on_selector_all(
            "[data-area-tab]",
            "els => els.map(e => [e.getAttribute('data-area-tab'), e.innerText.replace(/\\n/g,' ').trim()])",
        )
        keys = [t[0] for t in tabs]
        check(keys == AREA_KEYS, "7개 영역 탭(늘봄왕·두뇌왕·건강왕·출석왕·모임왕·나눔왕·알뜰왕)", str(keys))
        labels = " ".join(t[1] for t in tabs)
        check(all(k in labels for k in ["늘봄왕", "두뇌왕", "건강왕", "출석왕", "모임왕", "나눔왕", "알뜰왕"]),
              "영역 이름이 잘리지 않고 보임", labels)
        check(no_overflow(page) <= 0, "랭킹 탭 가로 넘침 없음", str(no_overflow(page)))
        check(not overflowing(page), "화면 밖으로 삐져나온 요소 없음", str(overflowing(page)[:2]))
        page.screenshot(path=f"{SHOT}/_rank_p1_all.png")
        shots.append(f"{SHOT}/_rank_p1_all.png")

        # ---------- 2. 늘봄왕 점수 적립 ----------
        s0 = today_score(page)
        check(s0 == 10, "출석 +10점이 처음부터 쌓임", f"{s0}점")
        cap_text = page.get_attribute("[data-league-missions]", "data-league-cap")
        check(cap_text == "140", "하루 상한 140점 표시", str(cap_text))

        # 건강 미션 +20
        nav(page, "홈")
        page.wait_for_selector("[data-health-card]", timeout=20000)
        page.locator('[data-health-item="water"]').click()
        page.wait_for_timeout(900)
        nav(page, "랭킹")
        page.wait_for_selector("[data-league-missions]", timeout=20000)
        s1 = today_score(page)
        check(s1 == s0 + 20, "건강 미션 완료 +20점", f"{s0} → {s1}")

        # 복지·생활정보 확인 +10
        nav(page, "혜택")
        page.get_by_role("button", name=re.compile("신청 방법 자세히 보기")).first.click()
        page.wait_for_timeout(1200)
        page.get_by_role("button", name="닫기").last.click()
        page.wait_for_timeout(800)
        nav(page, "랭킹")
        page.wait_for_selector("[data-league-missions]", timeout=20000)
        s2 = today_score(page)
        check(s2 == s1 + 10, "복지·생활정보 확인 +10점", f"{s1} → {s2}")

        # 퀴즈 완료 +30
        nav(page, "퀴즈")
        page.get_by_role("button", name=re.compile("퀴즈 시작하기")).first.click()
        page.wait_for_selector("[data-quiz-option='0']", timeout=20000)
        for i in range(3):
            page.locator("[data-quiz-option='0']").first.click()
            page.wait_for_timeout(300)
            page.get_by_role("button", name=re.compile("정답 확인")).first.click()
            page.wait_for_timeout(500)
            page.get_by_role("button", name=re.compile("다음 문제|결과 보기")).first.click()
            page.wait_for_timeout(800)
        nav(page, "랭킹")
        page.wait_for_selector("[data-league-missions]", timeout=20000)
        s3 = today_score(page)
        check(s3 == s2 + 30, "퀴즈 완료 +30점", f"{s2} → {s3}")
        check(s3 == 70, "네 가지 활동 합계 70점", f"{s3}점")

        done_stamps = page.eval_on_selector_all(
            "[data-league-mission][data-league-done]",
            "els => els.map(e => [e.getAttribute('data-league-mission'), e.getAttribute('data-league-done')])",
        )
        done_map = dict((k, v) for k, v in done_stamps)
        check(
            all(done_map.get(k) == "1" for k in ["attend", "quiz", "health", "welfare"]),
            "미션 체크리스트에 완료 도장(출석·퀴즈·건강·복지)",
            str(done_map),
        )
        page.locator("[data-league-missions]").scroll_into_view_if_needed()
        page.wait_for_timeout(500)
        page.screenshot(path=f"{SHOT}/_rank_p1_league.png")
        shots.append(f"{SHOT}/_rank_p1_league.png")
        page.locator("[data-rank-me]").scroll_into_view_if_needed()
        page.wait_for_timeout(500)
        page.screenshot(path=f"{SHOT}/_rank_p1_my.png")
        shots.append(f"{SHOT}/_rank_p1_my.png")

        # ---------- 3. 하루 상한(서버) ----------
        if not LOCAL:
            huge = ",".join(["999"] * 7)
            api_all = api(f"/api/rankings?area=all&code={CODE_T}&today={TODAY}&myd={huge}")
            cap_total = 140 * WEEKDAY
            check(
                api_all.get("myDisplay") == f"{cap_total}점",
                f"서버도 하루 140점 상한(오늘까지 {WEEKDAY}일 × 140)",
                f"{api_all.get('myDisplay')} (기대 {cap_total}점)",
            )
            one_day = "999,0,0,0,0,0,0"
            api_one = api(f"/api/rankings?area=all&code={CODE_T}&today={TODAY}&myd={one_day}")
            check(api_one.get("myDisplay") == "140점", "큰 값을 보내도 하루 140점을 넘지 않음", str(api_one.get("myDisplay")))

        # ---------- 4. 순위 변동 · 격차 문구 ----------
        changes = gap_texts(page)
        check(len(changes) >= 3, "순위 행마다 어제 대비 변동 배지", str(changes[:8]))
        check(
            all(re.fullmatch(r"(▲\d+|▼\d+|신규|－)", c) for c in changes),
            "변동 배지 표기(▲/▼/신규/－)가 정확함",
            str(changes[:8]),
        )
        gap = page.inner_text("[data-rank-gap]")
        check(
            bool(re.search(r"(현재 \d+위|1위예요|아직 기록이 없어요)", gap)),
            "내 순위·격차 안내 문구",
            gap,
        )
        if "10위권까지" in gap:
            check(True, "10위 밖이면 ‘10위권까지 OO점 차이’ 안내", gap)
        elif "바로 위" in gap:
            check(True, "10위 안이면 ‘바로 위(N-1위)와 OO점 차이’ 안내", gap)
        else:
            check(gap.strip().startswith("현재 1위"), "1위 문구 확인", gap)

        # ---------- 5. 상위 10위 제한 ----------
        rank_rows = page.eval_on_selector_all(
            "[data-rest-list] .tabular",
            "els => els.length",
        )
        check(rank_rows <= 7, "4위~10위까지만 목록에 노출", f"{rank_rows}행")
        check(
            page.query_selector("[data-rest-list]") is not None or rank_rows == 0,
            "10위까지만 공개 순위표에 표시",
        )

        # ---------- 6. 영역별 전환 + 미션 바로가기 ----------
        for key in AREA_KEYS:
            page.locator(f"[data-area-tab='{key}']").first.click()
            page.wait_for_timeout(1100)
            wide = no_overflow(page)
            check(wide <= 0, f"{key} 영역 가로 넘침 없음", str(wide))
            board = (
                page.query_selector(f"[data-area-board='{key}']")
                or page.query_selector("[data-group-rank]")
                or page.query_selector("[data-podium]")
                or page.get_by_text("아직 모임이 없어요", exact=False).first.is_visible()
            )
            check(bool(board), f"{key} 영역 순위표가 그려짐")
            check(page.query_selector(f"[data-area-mission='{key}']") is not None, f"{key} 미션 바로가기 버튼")
            if key in ("brain", "health", "group"):
                podium = page.query_selector("[data-podium]")
                if podium:
                    podium.scroll_into_view_if_needed()
                    page.wait_for_timeout(500)
                page.screenshot(path=f"{SHOT}/_rank_p1_{key}.png")
                shots.append(f"{SHOT}/_rank_p1_{key}.png")

        # 두뇌왕 → 퀴즈
        page.locator("[data-area-tab='brain']").first.click()
        page.wait_for_timeout(900)
        page.locator("[data-area-mission='brain'] button").first.click()
        page.wait_for_timeout(1500)
        check("퀴즈" in active_tab(page), "두뇌왕 → 퀴즈 화면", active_tab(page))
        nav(page, "랭킹")

        # 건강왕 → 건강 미션
        page.locator("[data-area-tab='health']").first.click()
        page.wait_for_timeout(900)
        page.locator("[data-area-mission='health'] button").first.click()
        page.wait_for_timeout(1600)
        check(
            "홈" in active_tab(page) and page.query_selector("[data-health-card]") is not None,
            "건강왕 → 건강 미션 카드",
            active_tab(page),
        )
        nav(page, "랭킹")

        # 출석왕 → 홈
        page.locator("[data-area-tab='attend']").first.click()
        page.wait_for_timeout(900)
        page.locator("[data-area-mission='attend'] button").first.click()
        page.wait_for_timeout(1600)
        check(
            "홈" in active_tab(page) and page.query_selector("[data-home-hero]") is not None,
            "출석왕 → 홈(출석 카드)",
            active_tab(page),
        )
        nav(page, "랭킹")

        # 알뜰왕 → 복지·혜택
        page.locator("[data-area-tab='save']").first.click()
        page.wait_for_timeout(900)
        page.locator("[data-area-mission='save'] button").first.click()
        page.wait_for_timeout(1600)
        check(
            "혜택" in active_tab(page) and page.query_selector("[data-welfare-filters]") is not None,
            "알뜰왕 → 복지·혜택 화면",
            active_tab(page),
        )
        nav(page, "랭킹")

        # 나눔왕 → 친구 초대(초대 시트)
        page.locator("[data-area-tab='share']").first.click()
        page.wait_for_timeout(900)
        page.locator("[data-area-mission='share'] button").first.click()
        page.wait_for_timeout(2000)
        invite_sheet = page.query_selector("[data-group-invite-sheet]") is not None
        create_sheet = page.get_by_text("새 모임 만들기", exact=False).first.is_visible()
        check(
            "모임" in active_tab(page) and (invite_sheet or create_sheet),
            "나눔왕 → 친구 초대 시트",
            f"tab={active_tab(page)} invite={invite_sheet} create={create_sheet}",
        )
        page.get_by_role("button", name="닫기").last.click()
        page.wait_for_timeout(800)
        nav(page, "랭킹")

        # 모임왕 → 우리 모임 미션
        page.locator("[data-area-tab='group']").first.click()
        page.wait_for_timeout(900)
        page.locator("[data-area-mission='group'] button").first.click()
        page.wait_for_timeout(2000)
        check(
            "모임" in active_tab(page) and page.query_selector("[data-group-mission]") is not None,
            "모임왕 → 우리 모임 미션",
            active_tab(page),
        )
        nav(page, "랭킹")

        # 늘봄왕 → 종합 미션 카드로 이동
        page.locator("[data-area-tab='all']").first.click()
        page.wait_for_timeout(900)
        page.locator("[data-area-mission='all'] button").first.click()
        page.wait_for_timeout(1200)
        in_view = page.evaluate(
            """() => {
              const el = document.querySelector('[data-league-missions]');
              if (!el) return false;
              const r = el.getBoundingClientRect();
              return r.top < window.innerHeight && r.bottom > 0;
            }"""
        )
        check(in_view, "늘봄왕 → 오늘의 종합 미션 카드로 이동")

        # ---------- 7. 랭킹 참여 OFF ----------
        before = page.get_attribute("[data-ranking-optin]", "data-ranking-optin")
        page.locator("[data-ranking-optin] [role='switch']").click()
        page.wait_for_timeout(1500)
        after = page.get_attribute("[data-ranking-optin]", "data-ranking-optin")
        check(before == "on" and after == "off", "랭킹 참여 스위치 OFF", f"{before} → {after}")
        check(page.query_selector("[data-rank-me='off']") is not None, "참여 OFF 안내가 보임")
        check(page.get_by_text("(나)", exact=False).count() == 0, "순위표에서 내 이름이 빠짐")
        page.screenshot(path=f"{SHOT}/_rank_p1_optout.png")
        shots.append(f"{SHOT}/_rank_p1_optout.png")

        page.wait_for_timeout(2500)  # /api/state 로 서버에 ranking_visible=false 저장
        if not LOCAL:
            api_off = api(f"/api/rankings?area=all&code={CODE_T}&today={TODAY}")
            me_rows = [r for r in api_off.get("rows", []) if r.get("name") == NICK or r.get("isMe")]
            check(api_off.get("myRank") is None, "서버 응답에서 내 순위가 빠짐", str(api_off.get("myRank")))
            check(not me_rows, "다른 사람이 보는 순위표에도 내 이름 없음", str(me_rows[:2]))
            visible = sql(f"select ranking_visible from public.users where code = '{CODE_T}';")
            check(
                bool(visible) and visible[0].get("ranking_visible") is False,
                "DB(users.ranking_visible)에 참여 OFF 저장",
                str(visible),
            )

        # 다시 켜면 순위표에 돌아온다
        page.locator("[data-ranking-optin] [role='switch']").click()
        page.wait_for_timeout(2000)
        check(page.get_attribute("[data-ranking-optin]", "data-ranking-optin") == "on", "랭킹 참여 다시 ON")

        check(not [e for e in console_errors if "Notification" not in e], "콘솔 치명 오류 없음", str(console_errors[:2]))
        browser.close()

    try:
        from PIL import Image

        imgs = [Image.open(s) for s in shots]
        w = max(i.width for i in imgs)
        gap = 24
        h = sum(i.height for i in imgs) + gap * (len(imgs) - 1)
        canvas = Image.new("RGB", (w, h), "white")
        y = 0
        for im in imgs:
            canvas.paste(im, ((w - im.width) // 2, y))
            y += im.height + gap
        canvas.save(f"{SHOT}/neulbom_ranking_v2_phase1.png")
        print("saved", f"{SHOT}/neulbom_ranking_v2_phase1.png")
    except Exception as e:  # noqa: BLE001
        print("composite failed:", e)

    # ---------- 8. 테스트 데이터 정리 ----------
    if not LOCAL:
        cleanup()
        left = {}
        for tbl, col in [
            ("users", "code"),
            ("quiz_logs", "user_code"),
            ("daily_visits", "user_code"),
            ("health_checks", "user_code"),
            ("activity_logs", "user_code"),
            ("med_checks", "user_code"),
            ("family_events", "user_code"),
        ]:
            rows = sql(f"select count(*) as n from public.{tbl} where {col} = '{CODE_T}';")
            left[tbl] = rows[0]["n"] if rows else -1
        check(all(v == 0 for v in left.values()), "테스트 계정·데이터 0건 정리", str(left))
        print("정리 결과:", left)

    print("\n===== 결과 =====")
    print(f"통과 {sum(1 for v in results.values() if v)} / {len(results)}")
    if errors:
        print("실패:", errors)
    else:
        print("모든 점검 통과")


if __name__ == "__main__":
    main()
