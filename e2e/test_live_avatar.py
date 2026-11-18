"""라이브 E2E — 카톡 프로필 사진 · 초대왕 · 응원 즉시반응 · 모임 수정/탈퇴.

확인 범위
1) 카카오 로그인(스텁) 응답의 http:// 프로필 사진이 https:// 로 바뀌어 DB(users.avatar_url)에 저장
2) 랭킹 → 우리 모임: 1·2·3위 시상대와 순위 목록에 원형 사진(깨짐 없음), 사진 없는 사람은 첫 글자
3) 랭킹 → 초대왕: 시상대 + ‘N명 초대’ + 초대한 사람의 카톡 사진
4) 모임 탭: 내 출석 칩·게시판 글쓴이 옆에 원형 사진
5) ♡ 응원: 누르는 즉시(같은 틱) 숫자·색 변화 + 새로고침 후 유지
6) ✏️ 모임 수정: 이름·지역·소개 저장 → 새로고침 후에도 유지
7) 🚪 모임 탈퇴하기: 확인 후 목록에서 사라짐
8) 더보기 → 내 정보·설정에 ‘카카오톡 사진 연동됨’
9) 콘솔 오류 0건

사용법: python3 e2e/test_live_avatar.py
"""

import json
import os
import re
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from test_kakao_onboarding import sql, js_make_code  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", "https://senior-life-platform.pages.dev").rstrip("/")
SHOT = "/workspace/downloads"
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")

ID_A, NAME_A = "777004001", "사진순자"
ID_B, NAME_B = "777004002", "글자철수"
CODE_A = js_make_code(f"kakao_{ID_A}")
CODE_B = js_make_code(f"kakao_{ID_B}")
MY_ID = f"kakao_{ID_A}"
PHOTO_HTTP = "http://senior-life-platform.pages.dev/images/profile-sample.jpg"
PHOTO_HTTPS = "https://senior-life-platform.pages.dev/images/profile-sample.jpg"
INVITE_TAG = "invited_"  # 초대왕 검증용 가짜 피초대자들

results = {}
errors = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
    results[label] = bool(cond)
    if not cond:
        errors.append(label)


def week_id_kst():
    from datetime import datetime, timedelta, timezone

    now = datetime.now(timezone(timedelta(hours=9)))
    monday = now - timedelta(days=now.weekday())
    return f"{monday.isocalendar().year}-W{monday.isocalendar().week:02d}", now.strftime("%Y-%m-%d")


def cleanup():
    codes = f"'{CODE_A}','{CODE_B}'"
    for q in [
        f"delete from public.group_cheers where user_code in ({codes});",
        f"delete from public.group_posts where user_code in ({codes});",
        f"delete from public.group_members where user_code in ({codes});",
        f"delete from public.groups where creator_code in ({codes});",
        f"delete from public.quiz_logs where user_code in ({codes});",
        f"delete from public.daily_visits where user_code in ({codes});",
        f"delete from public.med_checks where user_code in ({codes});",
        f"delete from public.health_checks where user_code in ({codes});",
        f"delete from public.family_events where user_code in ({codes});",
        f"delete from public.users where code in ({codes});",
        f"delete from public.users where external_id like '{INVITE_TAG}%';",
    ]:
        sql(q)


def seed_points(code, week_id, today):
    """모임 1위가 되도록 이번 주 퀴즈 점수를 넣는다(시상대에 내 사진이 서게)."""
    sql(
        "insert into public.quiz_logs (user_code, quiz_date, week_id, correct, total, points, seconds, types) "
        f"values ('{code}', '{today}', '{week_id}', 3, 3, 300, 20, '{{ox,nonsense,lyrics}}') "
        "on conflict (user_code, quiz_date) do update set points = 300;"
    )
    sql(
        "insert into public.daily_visits (user_code, visit_date) "
        f"values ('{code}', '{today}') on conflict do nothing;"
    )


def seed_invites(count, inviter_id):
    """초대왕 순위 검증용 — 내가 초대한 사람 count 명을 만든다."""
    for i in range(count):
        code = f"INV{i:03d}"
        sql(
            "insert into public.users (code, external_id, nickname, birth_year, sido, sigungu, source, "
            "profile_completed, invited_by) "
            f"values ('{code}', '{INVITE_TAG}{i}', '초대손님{i+1}', 1950, '충청북도', '옥천군', 'kakao', true, '{inviter_id}') "
            "on conflict (code) do update set invited_by = excluded.invited_by;"
        )


def kakao_stub(kakao_id, nickname, avatar=None):
    def handler(route, request):
        if "start=1" in request.url:
            route.fulfill(status=302, headers={"location": "/?code=STUB-AUTH-CODE"})
        elif request.method == "POST":
            profile = {
                "id": f"kakao_{kakao_id}",
                "nickname": nickname,
                "birthYear": 1952,
                "source": "kakao",
                "createdAt": "2026-11-17T00:00:00.000Z",
            }
            if avatar:
                profile["avatarUrl"] = avatar
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"ok": True, "profile": profile}),
            )
        else:
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(
                    {
                        "ok": True,
                        "supabase": "connected",
                        "kakao": "configured",
                        "kakaoLoginConfigured": True,
                        "kakaoJsConfigured": False,
                        "redirectUri": f"{BASE}/",
                    }
                ),
            )

    return handler


def login(page, nickname):
    page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
    page.get_by_role("button", name="카카오톡으로 시작하기").click()
    page.wait_for_selector("#setup-nick", timeout=30000)
    page.fill("#setup-nick", nickname)
    page.select_option("#setup-birth", "1952")
    page.click('[data-birthtime="묘시"]')
    page.select_option("#setup-sido", "충청북도")
    page.select_option("#setup-sigungu", "옥천군")
    page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
    page.wait_for_timeout(2500)


def nav_button(page, label):
    return page.get_by_role("navigation").get_by_role("button", name=label)


def photo_state(page, scope):
    return page.evaluate(
        """(sel) => {
          const root = document.querySelector(sel) || document.body;
          const imgs = Array.from(root.querySelectorAll('[data-avatar="photo"] img'));
          return {
            count: imgs.length,
            loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
            srcs: imgs.map((i) => i.currentSrc || i.src),
            initials: root.querySelectorAll('[data-avatar="initial"]').length,
          };
        }""",
        scope,
    )


def main():
    cleanup()
    week_id, today = week_id_kst()
    os.makedirs(SHOT, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            locale="ko-KR",
            is_mobile=True,
            has_touch=True,
            service_workers="block",
        )
        console_errors = []
        page = ctx.new_page()
        page.on("console", lambda m: console_errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: console_errors.append(f"pageerror: {e}"))
        page.route("**/api/auth/kakao**", kakao_stub(ID_A, NAME_A, PHOTO_HTTP))

        page.goto(BASE + "/", wait_until="domcontentloaded")
        login(page, NAME_A)

        rows = sql(f"select avatar_url from public.users where code = '{CODE_A}';")
        saved = rows[0]["avatar_url"] if rows else None
        check(saved == PHOTO_HTTPS, "카카오 http 사진 → https 로 DB 저장", str(saved))

        # 1위 + 초대 12명
        seed_points(CODE_A, week_id, today)
        seed_invites(12, MY_ID)
        page.reload(wait_until="domcontentloaded")
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
        page.wait_for_timeout(1500)

        # ---------- 모임 탭: 체험 모임 가입 → 출석 칩 사진 ----------
        nav_button(page, "모임").click()
        page.wait_for_selector("text=모임을 시작해 보세요", timeout=20000)
        page.get_by_role("button", name=re.compile("체험 모임 들어가기")).first.click()
        page.wait_for_selector("text=오늘 출석 현황", timeout=30000)
        page.wait_for_timeout(2500)

        chips = photo_state(page, "main")
        check(chips["count"] >= 1, "모임 출석 현황에 내 원형 사진", str(chips["count"]))
        check(chips["loaded"] == chips["count"] and chips["count"] >= 1, "사진이 깨지지 않고 실제로 그려짐", str(chips))
        check(
            chips["initials"] >= 1,
            "사진 없는 모임원은 기존 표시(도장·첫 글자) 유지",
            f"first-letter {chips['initials']}",
        )
        page.screenshot(path=f"{SHOT}/_avatar_group_tab.png")

        # ---------- 응원: 누르는 즉시 반응 ----------
        page.get_by_label("모임 게시판에 남길 말").fill("사진 연동 확인 글이에요 😊")
        page.get_by_role("button", name="남기기").click()
        page.wait_for_timeout(2500)
        post_photos = photo_state(page, "main")
        check(post_photos["count"] >= 1, "게시판 글쓴이 옆에도 내 사진", str(post_photos["count"]))

        cheer = page.evaluate(
            """async () => {
              const pick = () => Array.from(document.querySelectorAll('button')).filter((b) => b.textContent.includes('응원'))[0];
              const btn = pick();
              if (!btn) return { error: 'no-button' };
              const before = btn.textContent.trim();
              const t0 = performance.now();
              btn.click();
              // 다음 화면 그리기(약 16ms) 안에 바뀌면 ‘즉시’ 반응으로 본다.
              await new Promise((r) => requestAnimationFrame(() => r()));
              const after = pick();
              return {
                before,
                after: after ? after.textContent.trim() : '',
                pressedAfter: after ? after.getAttribute('aria-pressed') : '',
                ms: Math.round((performance.now() - t0) * 10) / 10,
              };
            }"""
        )
        check(
            not cheer.get("error")
            and cheer["after"] != cheer["before"]
            and cheer.get("pressedAfter") == "true"
            and cheer.get("ms", 9999) < 60,
            "♡ 응원 클릭 즉시 숫자·색 변경(60ms 이내)",
            str(cheer),
        )
        page.wait_for_timeout(2500)
        page.reload(wait_until="domcontentloaded")
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
        nav_button(page, "모임").click()
        page.wait_for_timeout(3000)
        kept = page.evaluate(
            """() => {
              const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('응원'));
              return btn ? { text: btn.textContent.trim(), pressed: btn.getAttribute('aria-pressed') } : null;
            }"""
        )
        check(bool(kept) and kept["pressed"] == "true", "새로고침 후에도 응원 유지", str(kept))

        # ---------- 랭킹: 우리 모임 시상대 ----------
        nav_button(page, "랭킹").click()
        page.wait_for_selector('[data-rank-tab="group"][aria-selected="true"]', timeout=20000)
        page.wait_for_selector("[data-podium]", timeout=20000)
        page.wait_for_timeout(2500)

        board = photo_state(page, "[data-podium]")
        check(board["count"] >= 1, "우리 모임 시상대에 원형 사진", str(board["count"]))
        check(board["loaded"] == board["count"] and board["count"] >= 1, "시상대 사진 깨짐 없음", str(board))
        check("profile-sample.jpg" in " ".join(board["srcs"]), "저장된 카톡 사진 주소로 그려짐", str(board["srcs"]))
        check(page.get_by_text(NAME_A).first.is_visible(), "1위 자리에 내 이름", "")
        page.screenshot(path=f"{SHOT}/neulbom_ranking_avatar.png")

        list_photos = photo_state(page, "[data-rest-list]")
        check(
            list_photos["loaded"] == list_photos["count"] and list_photos["initials"] >= 3,
            "순위 목록은 첫 글자 원 + 사진 깨짐 없음",
            str(list_photos),
        )

        # ---------- 랭킹: 초대왕 ----------
        page.click('[data-rank-tab="invite"]')
        page.wait_for_timeout(3000)
        invite_podium = photo_state(page, "[data-podium]")
        body = page.inner_text("main")
        check("초대왕" in body and "명 초대" in body, "초대왕 탭 · ‘N명 초대’ 표시", "")
        check("12명 초대" in body, "내 초대 성공 건수(12명) 반영", "")
        check(invite_podium["count"] >= 1 and invite_podium["loaded"] == invite_podium["count"],
              "초대왕 시상대에 초대한 사람의 카톡 사진", str(invite_podium))
        check(page.get_by_text(NAME_A).first.is_visible(), "초대왕 1위에 내 이름", "")
        page.screenshot(path=f"{SHOT}/neulbom_invite_king.png")

        # ---------- 더보기 → 내 정보·설정 ----------
        nav_button(page, "더보기").click()
        page.wait_for_timeout(1200)
        page.get_by_role("button", name=re.compile("내 정보")).first.click()
        page.wait_for_selector("text=내 정보 · 설정", timeout=15000)
        page.wait_for_timeout(1200)
        check("카카오톡 사진 연동됨" in page.inner_text("body"), "설정에 '카카오톡 사진 연동됨' 표시", "")
        settings_photos = photo_state(page, "body")
        check(settings_photos["loaded"] >= 1, "설정 화면 내 사진 표시", str(settings_photos["count"]))
        page.screenshot(path=f"{SHOT}/_avatar_settings.png")
        # 설정 시트는 ‘닫기’로 닫는다(Escape 로는 닫히지 않는다).
        page.locator('button[aria-label="닫기"]').last.click()
        page.wait_for_timeout(900)

        # ---------- 모임 수정 · 탈퇴 ----------
        new_name = "옥천 사진 모임"
        nav_button(page, "모임").click()
        page.wait_for_timeout(2000)
        # 화면에서 직접 만든다(모임 바꾸기 → 새 모임 만들기). 그래야 보던 모임도 같이 바뀐다.
        page.get_by_role("button", name=re.compile("모임 바꾸기")).first.click()
        page.wait_for_selector("text=새 모임 만들기", timeout=15000)
        # 시트 안쪽 버튼은 고정 헤더에 가려 클릭이 막히므로 DOM 클릭(실제 React 이벤트)으로 누른다.
        page.evaluate(
            """() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('새 모임 만들기')); b && b.click(); }"""
        )
        page.wait_for_selector("#group-name", timeout=15000)
        page.fill("#group-name", new_name)
        page.evaluate(
            """() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '모임 만들기'); b && b.click(); }"""
        )
        page.wait_for_timeout(3500)
        made_rows = sql(
            f"select id from public.groups where creator_code='{CODE_A}' and name like '{new_name}%' order by created_at desc limit 1;"
        )
        made_id = made_rows[0]["id"] if made_rows else None
        check(bool(made_id), "수정·탈퇴 검증용 모임 만들기(화면에서)", str(made_id))
        page.wait_for_timeout(500)

        page.get_by_role("button", name=re.compile("모임 수정")).first.click()
        page.wait_for_selector("#group-edit-name", timeout=15000)
        page.fill("#group-edit-name", "옥천 사진 모임 (수정됨)")
        page.fill("#group-edit-region", "충북 옥천군")
        page.fill("#group-edit-desc", "사진 연동 확인하는 모임이에요")
        page.get_by_role("button", name=re.compile("바꾼 내용 저장하기")).click()
        page.wait_for_timeout(3000)
        edited = "옥천 사진 모임 (수정됨)" in page.inner_text("main")
        check(edited, "모임 수정 직후 화면에 새 이름", "")
        page.reload(wait_until="domcontentloaded")
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
        page.wait_for_timeout(2500)
        check("옥천 사진 모임 (수정됨)" in page.inner_text("body"), "새로고침 후에도 수정 내용 유지", "")
        check("충북 옥천군" in page.inner_text("body"), "지역도 함께 저장됨", "")

        nav_button(page, "모임").click()
        page.wait_for_timeout(1800)
        page.get_by_role("button", name=re.compile("모임 탈퇴")).first.click()
        page.wait_for_selector("text=모임에서 탈퇴하기", timeout=15000)
        page.wait_for_timeout(600)
        check("정말 이 모임에서 나갈까요?" in page.inner_text("body"), "탈퇴 확인 안내 표시", "")
        page.get_by_role("button", name=re.compile("모임 탈퇴하기")).last.click()
        page.wait_for_timeout(3500)

        left = sql(
            f"select count(*) from public.group_members where user_code='{CODE_A}' and group_id='{made_id}';"
        )
        check(left[0]["count"] == 0, "탈퇴 후 모임원 명단에서 빠짐", str(left))
        check("옥천 사진 모임 (수정됨)" not in page.inner_text("body"), "탈퇴 후 화면 목록에서 사라짐", "")

        # ---------- 사진 없는 사람으로 다시 로그인 → 첫 글자 폴백 ----------
        ctx2 = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ko-KR")
        page2 = ctx2.new_page()
        page2.route("**/api/auth/kakao**", kakao_stub(ID_B, NAME_B))
        page2.goto(BASE + "/", wait_until="domcontentloaded")
        login(page2, NAME_B)
        nav_button(page2, "더보기").click()
        page2.wait_for_timeout(1200)
        page2.get_by_role("button", name=re.compile("내 정보")).first.click()
        page2.wait_for_selector("text=내 정보 · 설정", timeout=15000)
        page2.wait_for_timeout(1000)
        check(
            page2.locator('[data-avatar="initial"]').count() >= 1
            and "카카오톡 사진 연동됨" not in page2.inner_text("body"),
            "사진 없는 계정은 첫 글자 원 + 연동 안내 없음",
            "",
        )
        page2.screenshot(path=f"{SHOT}/_avatar_fallback.png")

        real_errors = [e for e in console_errors if "favicon" not in e and "404" not in e]
        check(len(real_errors) == 0, "콘솔 오류 0건", " | ".join(real_errors[:5]))

        shot = f"{SHOT}/neulbom_ranking_avatar.png"
        check(os.path.getsize(shot) > 30_000, "랭킹 시상대 캡처 저장", shot)

        ctx2.close()
        browser.close()

    cleanup()
    print("\n결과:", len(results) - len(errors), "/", len(results), "통과")
    if errors:
        print("실패:", errors)
        sys.exit(1)


if __name__ == "__main__":
    main()
