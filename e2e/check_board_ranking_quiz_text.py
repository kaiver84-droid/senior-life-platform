"""라이브 검증 — ① 모임 게시판 빈 상태 안내 두 줄 ② 랭킹 상단 모임명 배지 제거
③ 랭킹 미션 행 제목·부제 한 줄(세 글씨 크기) ④ 오늘의 퀴즈 5문제 진행·완료.

    BASE=https://senior-life-platform.pages.dev python3 e2e/check_board_ranking_quiz_text.py

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
NICK = "오문제점검"

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


ID_T = "779913579"
CODE_T = js_make_code(f"kakao_{ID_T}")

HEADER_MEASURE = """() => {
  const sec = [...document.querySelectorAll('section')].find(s => s.innerText.includes('명예의 전당'));
  if (!sec) return null;
  const row = [...sec.querySelectorAll('div')].find(d => d.innerText.includes('연속 출석') && d.innerText.includes('늘봄왕'));
  const pills = row ? [...row.children].map(c => c.innerText.trim()) : [];
  const badges = [...sec.querySelectorAll('span')].map(s => s.innerText.trim()).filter(t => t.startsWith('🏠') || t.startsWith('🏘️'));
  return {pills, housePills: badges, text: sec.innerText};
}"""

MISSION_MEASURE = """() => {
  const rows = [...document.querySelectorAll('[data-league-mission]')];
  return rows.map(r => {
    const t = r.querySelector('[data-mission-title]');
    const n = r.querySelector('[data-mission-note]');
    const lines = el => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
      return Math.round(el.getBoundingClientRect().height / lh);
    };
    const over = el => el ? Math.max(0, el.scrollWidth - el.clientWidth) : null;
    return {
      id: r.dataset.leagueMission,
      title: t ? t.innerText.trim() : null,
      note: n ? n.innerText.trim() : null,
      titleLines: lines(t), noteLines: lines(n),
      titleOver: over(t), noteOver: over(n),
      titleFont: t ? getComputedStyle(t).fontSize : null,
      rowH: Math.round(r.getBoundingClientRect().height),
      rowOver: Math.max(0, r.scrollWidth - r.clientWidth),
    };
  });
}"""

BOARD_MEASURE = """() => {
  const board = document.querySelector('.group-post') ? document.querySelector('.group-post').parentElement : null;
  const ps = [...document.querySelectorAll('main p')];
  const el = ps.find(p => p.innerText.includes('첫 안부를 남겨 보세요'));
  if (!el) return null;
  const cs = getComputedStyle(el);
  const brs = el.querySelectorAll('br').length;
  const rects = [...el.getClientRects()];
  return {
    text: el.innerText,
    brs,
    height: Math.round(el.getBoundingClientRect().height),
    lineHeight: cs.lineHeight,
    fontSize: cs.fontSize,
    lines: Math.round(
      (el.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) /
        (parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4)
    ),
    over: Math.max(0, el.scrollWidth - el.clientWidth),
    scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
  };
}"""


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
                            "createdAt": "2026-11-18T00:00:00.000Z",
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
    ctx = b.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=3,
        locale="ko-KR",
        is_mobile=True,
        has_touch=True,
        service_workers="block",
    )
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

    # ---------------------------------------------------------------- 랭킹
    page.get_by_role("navigation").get_by_role("button", name="랭킹").click()
    page.wait_for_timeout(2200)
    hdr = page.evaluate(HEADER_MEASURE)
    check(hdr is not None, "랭킹 상단 섹션 찾음")
    if hdr:
        print("   pills:", hdr["pills"])
        print("   house pills:", hdr["housePills"])
        check(any("연속 출석" in x for x in hdr["pills"]), "‘🔥 N일 연속 출석’ 유지")
        check(any("늘봄왕" in x for x in hdr["pills"]), "‘이번 주 늘봄왕 N점’ 유지")
        check(not hdr["housePills"], "🏠 모임명 배지 없음", str(hdr["housePills"]))
    # 지역별 탭 유지
    body = page.inner_text("main")
    check("지역별" in body, "‘🏘️ 지역별’ 탭 유지")
    # 상단 캡처
    sec = page.locator("section").filter(has_text="명예의 전당").first
    sec.screenshot(path=f"{SHOT}/neulbom_ranking_header_clean.png")
    page.screenshot(path=f"{SHOT}/_live_ranking_top.png")
    print("   saved neulbom_ranking_header_clean.png")

    # 미션 행 — 세 글씨 크기
    names = {19: "보통", 22: "크게", 25: "아주 크게"}
    for step in range(3):
        page.wait_for_timeout(400)
        rows = page.evaluate(MISSION_MEASURE)
        root = page.evaluate("() => getComputedStyle(document.documentElement).fontSize")
        label = names.get(int(round(float(root.replace('px', '')))), f"root {root}")
        print(f"[{label}] root {root}")
        for r in rows:
            print("   ", r)
        check(len(rows) == 6, f"{label}: 미션 카드 6개", str(len(rows)))
        for r in rows:
            check(r["titleLines"] == 1, f"{label}: '{r['title']}' 제목 한 줄", f"{r['titleLines']}줄 ({r['titleFont']})")
            check(r["noteLines"] == 1, f"{label}: '{r['note']}' 부제 한 줄", f"{r['noteLines']}줄")
            check((r["titleOver"] or 0) <= 1, f"{label}: '{r['title']}' 넘침 없음", f"{r['titleOver']}px")
            check((r["noteOver"] or 0) <= 1, f"{label}: '{r['note']}' 넘침 없음", f"{r['noteOver']}px")
        check(not page.evaluate("() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1"), f"{label}: 화면 가로 넘침 없음")
        if step == 0:
            card = page.locator("[data-league-mission]").first.locator("xpath=ancestor::div[1]")
            page.locator("[data-league-mission='attend']").scroll_into_view_if_needed()
            page.wait_for_timeout(300)
            page.screenshot(path=f"{SHOT}/neulbom_ranking_missions_clean.png")
            page.locator("[data-league-mission]").first.screenshot(path=f"{SHOT}/_mission_first.png")
            print("   saved neulbom_ranking_missions_clean.png")
        if step < 2:
            page.get_by_role("button", name=re.compile("글씨 크기 바꾸기")).first.click()
            page.wait_for_timeout(1000)
    # 글씨 크기 원복(보통)
    for _ in range(2):
        page.get_by_role("button", name=re.compile("글씨 크기 바꾸기")).first.click()
        page.wait_for_timeout(700)

    # ---------------------------------------------------------------- 퀴즈
    page.get_by_role("navigation").get_by_role("button", name="퀴즈").click()
    page.wait_for_timeout(2000)
    body = page.inner_text("main")
    check("하루 5문제" in body, "헤더 ‘하루 5문제’", [x for x in body.split("\n") if "하루" in x][:3])
    check("오늘의 5문제가" in body, "‘오늘의 5문제가 준비됐어요’")
    preview = page.locator("[data-quiz-topic]").first
    rows_prev = page.evaluate(
        """() => {
          const p = [...document.querySelectorAll('p')].find(x => x.innerText.includes('오늘의 5문제가'));
          const card = p ? p.closest('div[class*="rounded"]').parentElement : null;
          const box = card || document.querySelector('main');
          return [...box.querySelectorAll('span.text-\\\\[0\\\\.98rem\\\\]')].map(s => s.innerText.trim());
        }"""
    )
    print("   preview rows:", rows_prev)
    check(len(rows_prev) == 5, "미리보기 카드 5개", str(len(rows_prev)))
    card = page.locator("main").locator("div").filter(has_text="오늘의 5문제가").first
    page.screenshot(path=f"{SHOT}/neulbom_quiz_5questions.png")
    print("   saved neulbom_quiz_5questions.png")

    page.get_by_role("button", name=re.compile("퀴즈 시작하기")).click()
    page.wait_for_timeout(900)
    seen = []
    for i in range(5):
        bar = page.inner_text("main")
        m = re.search(r"(\d)\s*/\s*(\d+)\s*문제", bar)
        dots = page.evaluate("() => document.querySelectorAll('span.w-2\\\\.5, span.w-4').length")
        seen.append((m.group(1), m.group(2)) if m else None)
        if i == 0:
            page.screenshot(path=f"{SHOT}/_quiz_play_1of5.png")
        page.locator("[data-quiz-option]").first.click()
        page.wait_for_timeout(220)
        page.get_by_role("button", name="정답 확인").click()
        page.wait_for_timeout(260)
        page.get_by_role("button", name=re.compile("^(다음 문제|결과 보기)$")).click()
        page.wait_for_timeout(520)
    print("   진행 표시:", seen)
    ok_bar = all(s and s[1] == "5" for s in seen) and [s[0] for s in seen if s] == ["1", "2", "3", "4", "5"]
    check(ok_bar, "1/5 → 5/5 로 진행", str(seen))

    page.wait_for_selector("text=오늘의 퀴즈 결과", timeout=20000)
    done = page.inner_text("main")
    check(re.search(r"/\s*5", done) is not None, "결과 화면 총점 / 5", [x for x in done.split("\n") if "/" in x][:3])
    page.screenshot(path=f"{SHOT}/_quiz_done_5.png")
    print("   saved _quiz_done_5.png")

    # ---------------------------------------------------------------- 게시판 빈 상태
    code = CODE_T
    payload = {
        "action": "create",
        "code": code,
        "name": "점검 모임",
        "description": "줄바꿈 확인용",
        "me": {"name": NICK},
    }
    r = page.request.post(BASE + "/api/groups", data=json.dumps(payload), headers={"content-type": "application/json"})
    j = r.json()
    check(j.get("ok") is True, "빈 게시판용 모임 생성", str(j.get("groupId")))
    gid = j.get("groupId")
    exists = sql(f"select id from public.groups where id = '{gid}';") if gid else None
    print("   group row:", exists)

    page.get_by_role("navigation").get_by_role("button", name="모임").click()
    page.wait_for_timeout(2500)
    page.reload(wait_until="domcontentloaded")
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=45000)
    page.wait_for_timeout(2500)
    page.get_by_role("navigation").get_by_role("button", name="모임").click()
    page.wait_for_timeout(2500)
    body = page.inner_text("main")
    if "점검 모임" in body:
        page.get_by_role("button", name=re.compile("점검 모임")).first.click()
        page.wait_for_timeout(2500)
    info = page.evaluate(BOARD_MEASURE)
    print("   board:", info)
    check(info is not None, "게시판 빈 상태 안내 찾음")
    if info:
        check(info["brs"] == 1, "‘<br>’ 한 개로 두 줄", str(info["brs"]))
        check(info["lines"] == 2, "두 줄로 표시", f"{info['lines']}줄 (h={info['height']}, lh={info['lineHeight']})")
        check(info["over"] == 0, "가로 넘침 없음", f"{info['over']}px")
        check(info["scrollW"] <= info["clientW"] + 1, "화면 가로 넘침 없음", f"{info['scrollW']}/{info['clientW']}")
        txt = info["text"].split("\n")
        print("   lines:", txt)
    page.locator("text=첫 안부를 남겨 보세요").first.scroll_into_view_if_needed()
    page.wait_for_timeout(400)
    el = page.locator("text=첫 안부를 남겨 보세요").first.locator("xpath=..")
    el.screenshot(path=f"{SHOT}/neulbom_board_empty_2lines.png")
    page.screenshot(path=f"{SHOT}/_board_empty_screen.png")
    print("   saved neulbom_board_empty_2lines.png")

    if errs:
        errors.append(f"페이지 오류: {errs[:3]}")
    b.close()

cleanup()
print("통과:", sum(1 for x in results if x), "/", len(results))
print("문제:", len(errors))
for x in errors:
    print("  ", x)
sys.exit(1 if errors else 0)
