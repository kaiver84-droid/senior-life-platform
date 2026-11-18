"""라이브 검증 — 모임 화면의 `✏️ 모임 수정` · `🚪 모임 탈퇴` 두 버튼이 글씨 3단계에서
한 줄 · 같은 높이로 서는지 390×844 로 확인하고 캡처한다.

    BASE=https://senior-life-platform.pages.dev python3 e2e/check_group_action_buttons_live.py

카카오 인가만 스텁으로 흉내 내고 페이지·API·Supabase 는 실제 라이브를 쓴다.
끝나면 테스트 계정이 만든 행을 DB 에서 지운다.
"""
import json
import os
import re
import sys
import urllib.request

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", "https://senior-life-platform.pages.dev").rstrip("/")
SHOT = "/workspace/downloads"
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")
NICK = "줄바꿈점검"

from measure_group import MEASURE  # noqa: E402

results = []
errors = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
    results.append(bool(cond))
    if not cond:
        errors.append(label)


SUPA_TOKEN = open("/workspace/work/senior-platform/.supabase_token").read().strip()
PROJECT = "aaslirekynetqguajkpv"


def sql(query):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT}/database/query",
        data=json.dumps({"query": query}).encode(),
        headers={"Authorization": f"Bearer {SUPA_TOKEN}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read() or b"[]")


def js_make_code(seed: str) -> str:
    h = -2128831035

    def i32(x):
        x &= 0xFFFFFFFF
        return x - 0x100000000 if x >= 0x80000000 else x

    for ch in seed:
        h = i32(h ^ ord(ch))
        h = i32(h * 16777619)
    n = h & 0xFFFFFFFF
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    out = ""
    while n:
        n, r = divmod(n, 36)
        out = digits[r] + out
    out = (out or "0").upper()
    return out[-6:].rjust(6, "0")


ID_T = "779912341"
CODE_T = js_make_code(f"kakao_{ID_T}")


def cleanup():
    codes = f"'{CODE_T}'"
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


cleanup()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, locale="ko-KR", is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.route("**/api/auth/kakao**", kakao_stub())

    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.wait_for_selector("text=카카오톡으로 시작하기", timeout=45000)
    page.get_by_role("button", name="카카오톡으로 시작하기").click()
    page.wait_for_selector("#setup-nick", timeout=45000)
    page.fill("#setup-nick", NICK)
    page.select_option("#setup-birth", "1952")
    page.click('[data-birthtime="묘시"]')
    page.select_option("#setup-sido", "충청북도")
    page.select_option("#setup-sigungu", "옥천군")
    page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=45000)
    page.wait_for_timeout(2500)

    page.get_by_role("navigation").get_by_role("button", name="모임").click()
    page.wait_for_timeout(2500)
    page.get_by_role("button", name=re.compile("체험 모임 들어가기")).first.click()
    page.wait_for_selector(".group-action", timeout=45000)
    page.wait_for_timeout(4500)  # 입장 안내 토스트가 사라질 때까지
    body = page.inner_text("main")
    check("모임 게시판" in body and page.locator(".group-action").count() == 1, "체험 모임(FAM101) 입장")

    names = {19: "보통", 22: "크게", 25: "아주 크게"}
    kept = {}
    for step in range(3):
        info = page.evaluate(MEASURE)
        root = int(round(float(info["root"].replace("px", ""))))
        label = names.get(root, f"root {root}")
        print(f"[{label}] root {info['root']} scrollW {info['scrollW']}/{info['clientW']}")
        for r in info["rows"]:
            print("   ", r)
        print("    input", info["inputInfo"], "submit", info["submitInfo"])
        check(len(info["rows"]) == 2, f"{label}: 버튼 2개", str(len(info["rows"])))
        if len(info["rows"]) == 2:
            a, c = info["rows"]
            check(a["h"] == c["h"] == 52, f"{label}: 두 버튼 높이 같음(52)", f"{a['h']} / {c['h']}")
            check(a["top"] == c["top"], f"{label}: 같은 줄", f"{a['top']} / {c['top']}")
            for r in (a, c):
                check(r["lines"] == 1, f"{label}: '{r['text']}' 한 줄", f"{r['lines']}줄")
                check(r["overflow"] == 0, f"{label}: '{r['text']}' 가로 넘침 없음", f"{r['overflow']}px")
            kept[label] = {"rows": [a["text"], c["text"]], "height": a["h"], "font": a["fontSize"], "root": info["root"]}
        check(not info["over"], f"{label}: 화면 가로 넘침 없음", str(info["over"]))
        if info["inputInfo"]:
            check(info["inputInfo"]["phFits"], f"{label}: 입력칸 안내문이 잘리지 않음", f"{info['inputInfo']['ph']} ({info['inputInfo']['phW']}<={info['inputInfo']['contentW']})")
        if info["submitInfo"]:
            check(info["submitInfo"]["lines"] == 1, f"{label}: '남기기' 한 줄", str(info["submitInfo"]))

        page.locator(".group-action").scroll_into_view_if_needed()
        page.wait_for_timeout(400)
        tag = {"보통": "18", "크게": "21", "아주 크게": "24"}.get(label, str(root))
        page.locator(".group-action").screenshot(path=f"{SHOT}/_live_group_buttons_{tag}.png")
        # 입력줄 + 버튼 묶음이 함께 보이는 화면 (보고용)
        page.evaluate(
            """() => {
              const el = document.querySelector('.group-action');
              if (el) el.scrollIntoView({ block: 'center' });
            }"""
        )
        page.wait_for_timeout(400)
        page.screenshot(path=f"{SHOT}/_live_group_screen_{tag}.png")
        if step < 2:
            page.get_by_role("button", name=re.compile("글씨 크기 바꾸기")).first.click()
            page.wait_for_timeout(900)

    check(all(len(v["rows"]) == 2 for v in kept.values()) and len(kept) == 3, "세 글씨 크기 모두 확인", json.dumps(kept, ensure_ascii=False))
    if errs:
        errors.append(f"페이지 오류: {errs[:3]}")
    b.close()

cleanup()
print("문제:", len(errors))
for x in errors:
    print("  ", x)
sys.exit(1 if errors else 0)
