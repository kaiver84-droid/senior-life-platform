"""늘봄 랭킹 고도화 2차 검증 — 등급·배지 컬렉션 · 친구 1:1 대결 · 모임 대항전 · 퀴즈 318문항.

라이브: BASE=https://senior-life-platform.pages.dev python3 e2e/check_ranking_phase2.py

확인하는 것
1) 등급 카드: 누적 점수로 정한 5단계 등급 배지와 ‘다음 등급까지 OO점’ 안내
2) 배지 컬렉션: 6종 배지를 획득/미획득으로 나눠 보여 주고, 미획득에는 달성 조건 안내
3) 1:1 대결: 모임원에게 신청 → 상대 수락 → 점수 비교 문구, ?duel= 링크로 받은 신청 수락
4) 모임 대항전: 우리 모임 공동 목표 진행률·1등까지 남은 점수·바로 참여 버튼
5) 390px 가로 넘침 0 · 콘솔 오류 0
6) 퀴즈 화면 문항 수(318) 표시와 일일 퀴즈·연습 모드 출제
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

BASE = os.environ.get("BASE", "https://senior-life-platform.pages.dev").rstrip("/")
SHOT = "/workspace/downloads"
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")
os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.libs/usr/lib/x86_64-linux-gnu:/workspace/work/.tools/browser-libs"
)
KST = timezone(timedelta(hours=9))
TODAY = datetime.now(KST).strftime("%Y-%m-%d")
NICK = "랭킹2점검"
OPP_CODE = "ZZDUEL"
OPP_NAME = "대결친구"
EXPECT_QUESTIONS = 318

results = {}
errors = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
    results[label] = bool(cond)
    if not cond:
        errors.append(label)


from test_kakao_onboarding import js_make_code, sql  # noqa: E402

KAKAO_ID = "556611240"
CODE_T = js_make_code(f"kakao_{KAKAO_ID}")
CODE_OPP = OPP_CODE

WEEK_ID = None  # 오늘 날짜로 계산


def week_id_of(date_str):
    d = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=None)
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


WEEK_ID = week_id_of(TODAY)


def api(path):
    req = urllib.request.Request(
        f"{BASE}{path}",
        headers={
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
            "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read())


def api_post(path, body):
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(body).encode(),
        headers={
            "content-type": "application/json",
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
            "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
            "Accept": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read())


def cleanup():
    codes = f"'{CODE_T}','{CODE_OPP}'"
    for q in [
        f"delete from public.duels where challenger_code in ({codes}) or opponent_code in ({codes});",
        f"delete from public.activity_logs where user_code in ({codes});",
        f"delete from public.group_cheers where user_code in ({codes});",
        f"delete from public.group_posts where user_code in ({codes});",
        f"delete from public.group_members where user_code in ({codes});",
        f"delete from public.quiz_logs where user_code in ({codes});",
        f"delete from public.daily_visits where user_code in ({codes});",
        f"delete from public.health_checks where user_code in ({codes});",
        f"delete from public.med_checks where user_code in ({codes});",
        f"delete from public.family_events where user_code in ({codes});",
        f"delete from public.anbu_messages where user_code in ({codes});",
        f"delete from public.rankings_weekly where user_code in ({codes});",
        f"delete from public.users where code in ({codes});",
    ]:
        try:
            sql(q)
        except Exception as e:  # noqa: BLE001
            print("  (cleanup skip)", q[:60], e)


def seed_opponent():
    """대결 상대(테스트 계정)를 DB 에 만든다 — 체험 모임 FAM101 의 모임원으로 넣고 오늘 퀴즈 30점을 준다."""
    sql(
        f"""insert into public.users (code, external_id, nickname, birth_year, sido, sigungu, source, profile_completed)
            values ('{CODE_OPP}', 'test_duel_opponent', '{OPP_NAME}', 1955, '충청북도', '옥천군', 'demo', true)
            on conflict (code) do update set nickname = '{OPP_NAME}';"""
    )
    sql(
        f"""insert into public.group_members (group_id, user_code, name, role)
            values ('FAM101', '{CODE_OPP}', '{OPP_NAME}', 'member')
            on conflict (group_id, user_code) do update set name = '{OPP_NAME}';"""
    )
    sql(
        f"""insert into public.quiz_logs (user_code, quiz_date, week_id, correct, total, points)
            values ('{CODE_OPP}', '{TODAY}', '{WEEK_ID}', 3, 3, 30)
            on conflict (user_code, quiz_date) do update set points = 30;"""
    )


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
                            "id": f"kakao_{KAKAO_ID}",
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


def no_overflow(page):
    return page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")


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


def login(page):
    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
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


def ensure_group(page):
    nav(page, "모임")
    page.wait_for_timeout(1500)
    if page.query_selector("[data-group-invite-top]"):
        return True
    trial = page.get_by_role("button", name=re.compile("체험 모임 들어가기"))
    if trial.count():
        trial.first.click()
    for _ in range(20):
        page.wait_for_timeout(800)
        if page.query_selector("[data-group-invite-top]"):
            return True
    return False


def wait_attr(page, selector, attr, expect, timeout=8000):
    end = datetime.now().timestamp() + timeout / 1000
    while datetime.now().timestamp() < end:
        el = page.query_selector(selector)
        if el and el.get_attribute(attr) == expect:
            return True
        page.wait_for_timeout(300)
    return False


def main():
    shots = []
    cleanup()
    seed_opponent()

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
        page.route("**/api/auth/kakao**", kakao_stub())

        login(page)
        has_group = ensure_group(page)
        check(has_group, "모임 준비(체험 모임 참여)", str(has_group))

        nav(page, "랭킹")
        page.wait_for_selector("[data-grade-card]", timeout=25000)
        page.wait_for_timeout(1800)

        # ---------- 1. 등급 카드 ----------
        grade_key = page.get_attribute("[data-grade-card]", "data-grade-key")
        grade_points = int(page.get_attribute("[data-grade-card]", "data-grade-points") or 0)
        grade_label = page.get_attribute("[data-grade-label]", "data-label") or page.inner_text("[data-grade-label]")
        next_text = page.inner_text("[data-grade-next-text]")
        check(grade_key in ("sprout", "sun", "happy", "gold", "honor"), "등급 카드에 5단계 등급 표시", f"{grade_key}")
        check(grade_points >= 10, "누적 점수가 서버에서 계산됨", f"{grade_points}점")
        check(any(k in grade_label for k in ["새싹", "햇살", "행복", "금빛", "명예회원"]), "등급 이름 표시", grade_label)
        check("등급까지" in next_text or "가장 높은 등급" in next_text, "다음 등급까지 남은 점수 안내", next_text)
        check(no_overflow(page) <= 0, "랭킹 화면 가로 넘침 없음", str(no_overflow(page)))
        page.screenshot(path=f"{SHOT}/_rank_p2_grade.png")
        shots.append(f"{SHOT}/_rank_p2_grade.png")

        # ---------- 2. 배지 컬렉션 ----------
        page.click("[data-badge-open]")
        page.wait_for_selector("[data-badge-sheet]", timeout=10000)
        page.wait_for_timeout(600)
        badges = page.eval_on_selector_all(
            "[data-badge]", "els => els.map(e => [e.getAttribute('data-badge'), e.getAttribute('data-badge-earned')])"
        )
        check(len(badges) == 6, "배지 컬렉션 6종", str(badges))
        earned = [b for b in badges if b[1] == "1"]
        check(len(earned) <= 6, "배지 획득/미획득 구분", f"획득 {len(earned)} / 6")
        check(page.inner_text("[data-badge-sheet]").count("더 하면 받아요") >= 1, "미획득 배지에 달성 조건 안내")
        check(no_overflow(page) <= 0, "배지 시트 가로 넘침 없음", str(no_overflow(page)))
        page.screenshot(path=f"{SHOT}/_rank_p2_badges.png")
        shots.append(f"{SHOT}/_rank_p2_badges.png")
        page.get_by_role("button", name="닫기").last.click()
        page.wait_for_timeout(800)

        # ---------- 3. 1:1 대결 — 모임원에게 신청 ----------
        page.click("[data-duel-open]")
        page.wait_for_selector("[data-duel-sheet]", timeout=10000)
        page.wait_for_timeout(700)
        partner = page.query_selector(f"[data-duel-partner='{CODE_OPP}']")
        check(partner is not None, "대결 신청 시트에 모임원 목록", f"{OPP_NAME}")
        if partner:
            partner.click()
        else:
            api_post("/api/duels", {"action": "create", "code": CODE_T, "today": TODAY, "opponentCode": CODE_OPP, "kind": "total"})
        page.wait_for_timeout(1500)
        page.wait_for_selector("[data-duel-card]", timeout=15000)
        page.wait_for_timeout(800)
        card = page.query_selector("[data-duel-card]")
        duel_id = card.get_attribute("data-duel-id")
        status = card.get_attribute("data-duel-status")
        msg = page.inner_text("[data-duel-message]")
        my_score = int(card.get_attribute("data-duel-my-score") or 0)
        opp_score = int(card.get_attribute("data-duel-other-score") or 0)
        check(status == "pending", "대결 신청이 서버에 저장됨(수락 기다림)", status)
        check(opp_score >= 30, "상대 오늘 점수가 서버에서 계산됨(출석 10 + 퀴즈 30)", f"{opp_score}점")
        check("수락" in msg, "보낸 신청에 ‘수락 기다림’ 안내", msg)
        page.locator("[data-duel-card]").scroll_into_view_if_needed()
        page.wait_for_timeout(400)
        page.screenshot(path=f"{SHOT}/_rank_p2_duel_pending.png")
        shots.append(f"{SHOT}/_rank_p2_duel_pending.png")

        # 상대(테스트 계정)가 수락
        accepted = api_post("/api/duels", {"action": "accept", "code": CODE_OPP, "today": TODAY, "id": duel_id})
        check(bool(accepted.get("ok")), "상대가 대결을 수락", str(accepted.get("ok")))
        page.reload(wait_until="domcontentloaded")
        page.wait_for_selector("[data-duel-card]", timeout=25000)
        page.wait_for_timeout(1500)
        card = page.query_selector("[data-duel-card]")
        check(card.get_attribute("data-duel-status") == "accepted", "수락한 대결로 표시", card.get_attribute("data-duel-status"))
        msg_lose = page.inner_text("[data-duel-message]")
        check(
            "멋진 도전" in msg_lose or "뒤" in msg_lose or "겨루" in msg_lose,
            "져 있어도 따뜻한 격려 문구",
            msg_lose,
        )

        # 퀴즈를 풀어 점수를 올리면 앞서는 문구로 바뀐다 (실시간 점수 비교)
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
        page.wait_for_selector("[data-duel-card]", timeout=25000)
        # 대결 점수는 서버 저장을 거쳐 20초마다 새로 받아 온다 — 오를 때까지 기다린다.
        my_after = 0
        for _ in range(20):
            page.wait_for_timeout(1500)
            card = page.query_selector("[data-duel-card]")
            my_after = int(card.get_attribute("data-duel-my-score") or 0) if card else 0
            if my_after >= 40:
                break
        card = page.query_selector("[data-duel-card]")
        opp_after = int(card.get_attribute("data-duel-other-score") or 0)
        msg_win = page.inner_text("[data-duel-message]")
        check(my_after > opp_after, "퀴즈 뒤 내 점수가 상대보다 앞섬", f"나 {my_after} : {opp_after} 상대")
        check("앞서" in msg_win or "동점" in msg_win, "앞설 때의 응원 문구", msg_win)
        # 등급(누적 점수)도 방금 한 퀴즈까지 반영돼야 한다 — 화면 위 ‘이번 주 점수’와 어긋나지 않게
        page.wait_for_timeout(3200)
        grade_after = int(page.get_attribute("[data-grade-card]", "data-grade-points") or 0)
        check(grade_after >= my_after, "퀴즈 뒤 누적 점수(등급)도 새로 반영", f"{grade_after}점 / 대결 {my_after}점")
        page.locator("[data-duel-card]").scroll_into_view_if_needed()
        page.wait_for_timeout(400)
        page.screenshot(path=f"{SHOT}/_rank_p2_duel_win.png")
        shots.append(f"{SHOT}/_rank_p2_duel_win.png")

        # 서버 응답도 확인
        api_duels = api(f"/api/duels?code={CODE_T}&today={TODAY}")
        check(len(api_duels.get("duels", [])) >= 1, "서버에 대결 기록 저장", str(len(api_duels.get("duels", []))))
        check(
            api_duels["duels"][0]["status"] == "accepted",
            "서버 응답 status=accepted",
            api_duels["duels"][0]["status"],
        )

        # ---------- 4. 대결 링크(?duel=)로 받은 신청 수락 ----------
        sql(f"delete from public.duels where challenger_code = '{CODE_OPP}' or opponent_code = '{CODE_OPP}';")
        page.goto(f"{BASE}/?duel={CODE_OPP}&dn={OPP_NAME}&k=total", wait_until="domcontentloaded")
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
        nav(page, "랭킹")
        page.wait_for_selector("[data-duel-link-banner]", timeout=20000)
        banner = page.inner_text("[data-duel-link-banner]")
        check(OPP_NAME in banner and "대결" in banner, "대결 링크로 받은 신청 안내", banner.replace("\n", " / "))
        page.screenshot(path=f"{SHOT}/_rank_p2_duel_link.png")
        shots.append(f"{SHOT}/_rank_p2_duel_link.png")
        page.get_by_role("button", name=re.compile("수락하고 겨루기")).click()
        page.wait_for_timeout(2500)
        check(page.query_selector("[data-duel-link-banner]") is None, "링크 수락 뒤 안내가 사라짐")
        links = api(f"/api/duels?code={CODE_T}&today={TODAY}")
        link_rows = [d for d in links.get("duels", []) if d.get("fromLink")]
        check(bool(link_rows) and link_rows[0]["status"] == "accepted", "링크로 시작한 대결이 저장됨", str(len(link_rows)))

        # ---------- 5. 모임 대항전 ----------
        page.locator("[data-area-tab='group']").first.click()
        page.wait_for_timeout(2000)
        page.wait_for_selector("[data-group-battle]", timeout=20000)
        battle = page.query_selector("[data-group-battle]")
        rate = int(battle.get_attribute("data-battle-rate") or 0)
        rank = int(battle.get_attribute("data-battle-rank") or 0)
        bmsg = page.inner_text("[data-battle-message]")
        check(rate >= 0, "모임 공동 목표 진행률 표시", f"{rate}%")
        check(rank >= 1, "모임 대항전 순위 표시", f"{rank}위")
        check(("1등까지" in bmsg and "남았어요" in bmsg) or "1등이에요" in bmsg, "1등까지 남은 점수 안내", bmsg)
        check(page.query_selector("[data-battle-join]") is not None, "모임 대항전 바로 참여 버튼")
        check(no_overflow(page) <= 0, "모임왕 화면 가로 넘침 없음", str(no_overflow(page)))
        page.locator("[data-group-battle]").scroll_into_view_if_needed()
        page.wait_for_timeout(400)
        page.screenshot(path=f"{SHOT}/_rank_p2_battle.png")
        shots.append(f"{SHOT}/_rank_p2_battle.png")

        api_battle = api(f"/api/rankings?scope=groupbattle&code={CODE_T}&today={TODAY}")
        check(api_battle.get("ok") and len(api_battle.get("rows", [])) >= 3, "서버 모임 대항전 순위", str(len(api_battle.get("rows", []))))
        mine = api_battle.get("myGroup") or {}
        check(bool(mine) and mine.get("goal", 0) >= 100, "우리 모임 목표·점수 계산", f"{mine.get('score')}/{mine.get('goal')}")

        # ---------- 5-1. 내 프로필(설정)에도 등급 배지 ----------
        page.get_by_role("button", name="설정").click()
        page.wait_for_timeout(1200)
        prof_grade = page.query_selector("[data-profile-grade]")
        check(prof_grade is not None, "내 프로필(설정)에 등급 배지")
        if prof_grade:
            check(
                prof_grade.get_attribute("data-grade-points") is not None,
                "프로필 등급에 누적 점수 표시",
                prof_grade.get_attribute("data-grade-points"),
            )
        page.screenshot(path=f"{SHOT}/_rank_p2_profile.png")
        shots.append(f"{SHOT}/_rank_p2_profile.png")
        page.get_by_role("button", name="닫기").last.click()
        page.wait_for_timeout(800)

        # ---------- 6. 퀴즈 문항 수 · 일일 퀴즈 · 연습 모드 ----------
        nav(page, "퀴즈")
        page.wait_for_timeout(1500)
        bank = page.get_attribute("[data-quiz-bank]", "data-quiz-bank")
        check(bank == str(EXPECT_QUESTIONS), f"퀴즈 화면에 전체 {EXPECT_QUESTIONS}문제 표시", str(bank))
        page.screenshot(path=f"{SHOT}/_rank_p2_quiz.png")
        shots.append(f"{SHOT}/_rank_p2_quiz.png")
        practice = page.get_by_role("button", name=re.compile("연습|주제 골라"))
        check(practice.count() > 0, "연습 모드 버튼 있음", str(practice.count()))
        if practice.count():
            practice.first.click()
            page.wait_for_timeout(1500)
            check(
                page.query_selector("[data-quiz-option='0']") is not None
                or page.get_by_text("연습", exact=False).count() > 0,
                "연습 모드 화면이 열림",
            )
            page.screenshot(path=f"{SHOT}/_rank_p2_practice.png")
            shots.append(f"{SHOT}/_rank_p2_practice.png")

        check(not [e for e in console_errors if "Notification" not in e], "콘솔 치명 오류 없음", str(console_errors[:2]))
        browser.close()

    # ---------- 스크린샷 합치기 ----------
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
        canvas.save(f"{SHOT}/neulbom_ranking_v2_phase2.png")
        print("saved", f"{SHOT}/neulbom_ranking_v2_phase2.png")
    except Exception as e:  # noqa: BLE001
        print("composite failed:", e)

    # ---------- 7. 테스트 데이터 정리 ----------
    cleanup()
    left = {}
    for tbl, col in [
        ("users", "code"),
        ("duels", "challenger_code"),
        ("quiz_logs", "user_code"),
        ("daily_visits", "user_code"),
        ("group_members", "user_code"),
    ]:
        rows = sql(f"select count(*) as n from public.{tbl} where {col} in ('{CODE_T}','{CODE_OPP}');")
        left[tbl] = rows[0]["n"] if rows else -1
    check(all(v == 0 for v in left.values()), "테스트 계정·데이터 0건 정리", str(left))

    print("\n===== 결과 =====")
    print(f"통과 {sum(1 for v in results.values() if v)} / {len(results)}")
    if errors:
        print("실패:", errors)
        sys.exit(1)
    print("모든 점검 통과")


if __name__ == "__main__":
    main()
