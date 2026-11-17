"""초대 링크 ?ref= 왕복 확인 — 라이브.

1) 초대 링크(?group=&ref=)로 들어온 사람의 브라우저가 ref 를 보관하는지
2) 그 상태로 가입을 마치면 users.invited_by 에 초대한 사람 id 가 남는지 (초대왕 집계의 원천)
3) 내가 보내는 모임 초대 링크에도 ref=내 id 가 붙는지

사용법: python3 e2e/check_invite_ref.py
"""

import json
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from test_kakao_onboarding import sql, js_make_code  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = "https://senior-life-platform.pages.dev"
CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
ID = "777005001"
NAME = "초대링크검증"
CODE = js_make_code(f"kakao_{ID}")
INVITER = "kakao_inviter_zz"

ok = True


def check(cond, label, extra=""):
    global ok
    ok = ok and bool(cond)
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))


def cleanup():
    for q in [
        f"delete from public.group_posts where user_code='{CODE}';",
        f"delete from public.group_members where user_code='{CODE}';",
        f"delete from public.quiz_logs where user_code='{CODE}';",
        f"delete from public.daily_visits where user_code='{CODE}';",
        f"delete from public.users where code='{CODE}';",
    ]:
        sql(q)


def stub():
    def handler(route, request):
        if "start=1" in request.url:
            route.fulfill(status=302, headers={"location": "/?code=STUB"})
        elif request.method == "POST":
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"ok": True, "profile": {"id": f"kakao_{ID}", "nickname": NAME, "birthYear": 1950, "source": "kakao", "createdAt": "2026-11-17T00:00:00Z"}}),
            )
        else:
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"ok": True, "supabase": "connected", "kakaoConfigured": True, "kakaoLoginConfigured": True, "kakaoJsConfigured": False, "redirectUri": BASE + "/"}),
            )
    return handler


cleanup()
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, locale="ko-KR")
        page = ctx.new_page()
        page.route("**/api/auth/kakao**", stub())

        page.goto(f"{BASE}/?group=FAM101&ref={INVITER}", wait_until="domcontentloaded")
        page.wait_for_timeout(2500)
        stored = page.evaluate("() => ({ ref: localStorage.getItem('seniorLife.inviteRef'), group: localStorage.getItem('seniorLife.pendingGroup') })")
        check(stored.get("ref") == INVITER, "받은 초대 링크의 ref 보관", str(stored))
        check(stored.get("group") == "FAM101", "받은 초대 링크의 모임 번호 보관", str(stored))

        page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
        page.get_by_role("button", name="카카오톡으로 시작하기").click()
        page.wait_for_selector("#setup-nick", timeout=30000)
        page.fill("#setup-nick", NAME)
        page.select_option("#setup-birth", "1950")
        page.click('[data-birthtime="묘시"]')
        page.select_option("#setup-sido", "충청북도")
        page.select_option("#setup-sigungu", "옥천군")
        page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
        page.wait_for_timeout(3000)

        rows = sql(f"select invited_by from public.users where code='{CODE}';")
        check(bool(rows) and rows[0]["invited_by"] == INVITER, "가입 시 users.invited_by 저장", str(rows))

        page.get_by_role("navigation").get_by_role("button", name="모임").click()
        page.wait_for_timeout(3000)
        page.evaluate("() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('우리 모임 초대하기')); b && b.click(); }")
        page.wait_for_selector("text=초대 링크", timeout=15000)
        page.wait_for_timeout(800)
        link = page.evaluate("() => { const t=[...document.querySelectorAll('p')].map(x=>x.textContent).find(x=>x && x.includes('/?group=')); return t || ''; }")
        check(f"ref=kakao_{ID}" in link, "내가 보내는 초대 링크에 ref=내 id", link)
        b.close()
finally:
    cleanup()

print("\n결과:", "통과" if ok else "실패")
sys.exit(0 if ok else 1)
