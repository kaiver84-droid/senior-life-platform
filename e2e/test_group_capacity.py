"""모임 정원 100명 제한 검증 — ① 화면에 정원 표시(멤버 N/100명) ② 정원이 차면 가입 차단(409·한국어 안내)
③ 한 명이 나가면 다시 가입 가능 ④ 테스트 데이터 0건 정리.

라이브: BASE=https://senior-life-platform.pages.dev python3 e2e/test_group_capacity.py
(로컬 정적 미리보기에는 /api/groups 가 없어 라이브에서만 돈다)
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

from test_kakao_onboarding import js_make_code, sql  # noqa: E402

BASE = os.environ.get("BASE", "https://senior-life-platform.pages.dev").rstrip("/")
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")
os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.libs/usr/lib/x86_64-linux-gnu:/workspace/work/.tools/browser-libs"
)
SHOT = "/workspace/downloads"
MAX = 100

ID_T = "902100455"          # 모임장(화면 확인용 테스트 계정)
ID_B = "902100466"          # 정원이 찬 뒤 들어오려는 사람
ID_C = "902100477"          # 초대 링크(?group=)로 들어오려는 새 사람
CODE_T = js_make_code(f"kakao_{ID_T}")
CODE_B = js_make_code(f"kakao_{ID_B}")
CODE_C = js_make_code(f"kakao_{ID_C}")
NICK = "정원점검"

results = {}
errors = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
    results[label] = bool(cond)
    if not cond:
        errors.append(label)


def api(body: dict) -> tuple[int, dict]:
    req = urllib.request.Request(
        f"{BASE}/api/groups",
        data=json.dumps(body).encode(),
        headers={
            "content-type": "application/json",
            "accept": "application/json",
            "origin": BASE,
            "referer": BASE + "/",
            # Cloudflare 가 브라우저가 아닌 요청을 막지 않도록 실제 브라우저와 같은 표시를 보낸다
            "user-agent": (
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
                "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
            ),
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            return res.status, json.loads(res.read() or b"{}")
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw or b"{}")
        except Exception:  # noqa: BLE001
            return e.code, {"raw": raw.decode("utf-8", "ignore")[:200]}


def cleanup():
    codes = f"'{CODE_T}','{CODE_B}','{CODE_C}'"
    for q in [
        f"delete from public.group_cheers where user_code in ({codes});",
        f"delete from public.group_posts where user_code in ({codes});",
        f"delete from public.group_members where user_code in ({codes}) or name like '정원점검%';",
        f"delete from public.groups where creator_code in ({codes}) or name = '정원 점검 모임';",
        f"delete from public.quiz_logs where user_code in ({codes});",
        f"delete from public.daily_visits where user_code in ({codes});",
        f"delete from public.med_checks where user_code in ({codes});",
        f"delete from public.health_checks where user_code in ({codes});",
        f"delete from public.family_events where user_code in ({codes});",
        f"delete from public.users where code in ({codes});",
    ]:
        try:
            sql(q)
        except Exception as e:  # noqa: BLE001
            print("  (cleanup skip)", q[:60], e)


def kakao_stub(ident: str, nick: str):
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
                            "id": f"kakao_{ident}",
                            "nickname": nick,
                            "birthYear": 1955,
                            "source": "kakao",
                            "createdAt": "2026-11-17T00:00:00.000Z",
                        },
                    }
                ),
            )
        else:
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"ok": True, "supabase": "connected", "kakao": "configured", "kakaoLoginConfigured": True}),
            )

    return handler


def login(page, ident, nick):
    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
    page.get_by_role("button", name="카카오톡으로 시작하기").click()
    page.wait_for_selector("#setup-nick", timeout=30000)
    page.fill("#setup-nick", nick)
    page.select_option("#setup-birth", "1955")
    page.click('[data-birthtime="묘시"]')
    page.select_option("#setup-sido", "충청북도")
    page.select_option("#setup-sigungu", "옥천군")
    page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
    page.wait_for_timeout(2500)


def main():
    cleanup()
    group_id = None
    shots = []
    try:
        # ---------- 1) 모임 만들기(모임장 계정) ----------
        status, body = api(
            {
                "action": "create",
                "code": CODE_T,
                "name": "정원 점검 모임",
                "description": "정원 100명 제한 검증용",
                "me": {"name": NICK},
            }
        )
        group_id = body.get("groupId")
        check(status == 200 and bool(group_id), "/api/groups create", f"{status} {str(body)[:80]}")
        if not group_id:
            print("모임을 만들지 못해 검증을 멈춥니다.")
            return
        check(body.get("maxMembers") == MAX, "모임 목록 응답에 maxMembers: 100", str(body.get("maxMembers")))
        groups = body.get("groups") or []
        check(bool(groups) and groups[0].get("maxMembers") == MAX, "모임 목록에도 정원 정보", str(groups[0].get("memberCount")) if groups else "없음")

        # ---------- 2) 99명 더 채워 정원(100명) 만들기 ----------
        sql(
            "insert into public.group_members (group_id, user_code, name, role) "
            "select '%s', 'CAPM' || g::text, '정원점검' || g::text, 'member' from generate_series(1, 99) g "
            "on conflict do nothing;" % group_id
        )
        rows = sql(f"select count(*) as n from public.group_members where group_id = '{group_id}';")
        member_count = rows[0]["n"] if rows else -1
        check(member_count == MAX, "모임원 100명 채움", str(member_count))

        # ---------- 3) 화면에서 정원 표시 확인 ----------
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
            page.route("**/api/auth/kakao**", kakao_stub(ID_T, NICK))
            login(page, ID_T, NICK)
            page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name=re.compile("모임")).first.click()
            page.wait_for_timeout(2500)
            main_text = page.inner_text("main")
            check(
                "/ 100명" in main_text or f"/ {MAX}명" in main_text,
                "'멤버 N / 100명' 정원 표시",
                [ln for ln in main_text.split("\n") if "명" in ln][:3],
            )
            cap = page.locator("[data-group-capacity]").first
            cap_text = cap.inner_text().strip() if cap.count() else ""
            check("정원이 다 찼어요" in cap_text and "100/100" in cap_text, "정원 마감 표시 (100/100명)", cap_text)
            page.screenshot(path=f"{SHOT}/_capacity_full.png")
            shots.append(f"{SHOT}/_capacity_full.png")

            # 초대 시트 안내문
            invite = page.locator("[data-group-invite-top]").first
            if invite.count():
                invite.click()
                page.wait_for_timeout(1200)
                invite_cap = page.locator("[data-group-invite-capacity]").first
                invite_text = invite_cap.inner_text().strip() if invite_cap.count() else ""
                check("100" in invite_text and "정원" in invite_text, "초대 시트 정원 안내", invite_text)
                page.screenshot(path=f"{SHOT}/_capacity_invite.png")
                shots.append(f"{SHOT}/_capacity_invite.png")
            browser.close()

        # ---------- 4) 정원이 찬 모임에 새 사람 가입 → 409 ----------
        status, body = api({"action": "join", "code": CODE_B, "groupId": group_id, "name": "정원점검B", "me": {"name": "정원점검B"}})
        check(status == 409, "정원이 차면 가입 차단(409)", f"{status}")
        msg = str(body.get("message") or "")
        check(body.get("error") == "group_full" and "정원(100명)" in msg and "새 모임" in msg, "한국어 안내 메시지", msg)
        check(body.get("memberCount") == MAX and body.get("maxMembers") == MAX, "응답에 정원 정보", f"{body.get('memberCount')}/{body.get('maxMembers')}")

        # ---------- 5) 한 명이 나가면 다시 가입할 수 있다 ----------
        sql(f"delete from public.group_members where id = (select id from public.group_members where group_id = '{group_id}' and user_code like 'CAPM%' limit 1);")
        status, body = api({"action": "join", "code": CODE_B, "groupId": group_id, "name": "정원점검B", "me": {"name": "정원점검B"}})
        check(status == 200 and body.get("ok"), "정원이 비면 가입 허용(200)", f"{status}")
        rows = sql(f"select count(*) as n from public.group_members where group_id = '{group_id}';")
        check((rows[0]["n"] if rows else -1) == MAX, "다시 100명 유지", str(rows[0]["n"] if rows else "?"))

        # 이미 들어 있는 사람은 정원이 차도 그대로 (재입장 요청은 성공)
        status, body = api({"action": "join", "code": CODE_B, "groupId": group_id, "name": "정원점검B", "me": {"name": "정원점검B"}})
        check(status == 200, "이미 가입한 사람의 재요청은 통과", f"{status}")

        # ---------- 6) 초대 링크(?group=)로 들어온 새 사람 — 화면에 정원 초과 안내 ----------
        #     (한 명 나간 자리를 다시 채워 100명으로 만든 뒤 확인한다)
        sql(f"delete from public.group_members where group_id = '{group_id}' and user_code = '{CODE_B}';")
        sql(
            "insert into public.group_members (group_id, user_code, name, role) "
            "select '%s', 'CAPN' || g::text, '정원점검N' || g::text, 'member' "
            "from generate_series(1, (select %d - count(*) from public.group_members where group_id = '%s')) g "
            "on conflict do nothing;" % (group_id, MAX, group_id)
        )
        rows = sql(f"select count(*) as n from public.group_members where group_id = '{group_id}';")
        check((rows[0]["n"] if rows else -1) == MAX, "화면 확인 전 100명 유지", str(rows[0]["n"] if rows else "?"))
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
            page.route("**/api/auth/kakao**", kakao_stub(ID_C, "정원점검C"))
            # 초대 링크로 들어온다 → 로그인·초기설정 뒤 자동 가입 시도
            page.goto(f"{BASE}/?group={group_id}", wait_until="domcontentloaded")
            page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
            page.get_by_role("button", name="카카오톡으로 시작하기").click()
            page.wait_for_selector("#setup-nick", timeout=30000)
            page.fill("#setup-nick", "정원점검C")
            page.select_option("#setup-birth", "1955")
            page.click('[data-birthtime="묘시"]')
            page.select_option("#setup-sido", "충청북도")
            page.select_option("#setup-sigungu", "옥천군")
            page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
            page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
            page.wait_for_timeout(4000)
            body_text = page.inner_text("body")
            check("정원(100명)이 다 찼어요" in body_text, "초대 링크 자동 가입도 정원에서 막힘 + 한국어 안내", "")
            page.screenshot(path=f"{SHOT}/_capacity_join_blocked.png")
            shots.append(f"{SHOT}/_capacity_join_blocked.png")
            browser.close()
        rows = sql(f"select count(*) as n from public.group_members where group_id = '{group_id}' and user_code = '{CODE_C}';")
        check((rows[0]["n"] if rows else -1) == 0, "정원이 찬 모임에 새 사람이 들어가지 않음", str(rows[0]["n"] if rows else "?"))

    finally:
        cleanup()
        rows = sql(f"select count(*) as n from public.group_members where group_id = '{group_id}' or user_code like 'CAPM%';") if group_id else []
        left = rows[0]["n"] if rows else 0
        g = sql(f"select count(*) as n from public.groups where id = '{group_id}';") if group_id else []
        left_g = g[0]["n"] if g else 0
        u = sql(f"select count(*) as n from public.users where code in ('{CODE_T}','{CODE_B}','{CODE_C}');")
        check(left == 0 and left_g == 0 and (u[0]["n"] if u else 0) == 0, "테스트 데이터 0건 정리", f"members={left} groups={left_g} users={u[0]['n'] if u else '?'}")

    try:
        from PIL import Image

        if shots:
            imgs = [Image.open(s) for s in shots]
            w = max(i.width for i in imgs)
            gap = 24
            h = sum(i.height for i in imgs) + gap * (len(imgs) - 1)
            canvas = Image.new("RGB", (w, h), "white")
            y = 0
            for im in imgs:
                canvas.paste(im, ((w - im.width) // 2, y))
                y += im.height + gap
            canvas.save(f"{SHOT}/neulbom_group_capacity.png")
            print("saved", f"{SHOT}/neulbom_group_capacity.png")
    except Exception as e:  # noqa: BLE001
        print("composite failed:", e)

    print("\n결과:", sum(results.values()), "/", len(results), "통과")
    if errors:
        print("실패:", errors)
        sys.exit(1)


if __name__ == "__main__":
    main()
