"""랭킹 미션 행의 실제 폭·글씨 크기를 재는 진단 스크립트(임시)."""
import json
import os
import re
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", "https://senior-life-platform.pages.dev").rstrip("/")
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")
NICK = "폭점검"
ID_T = "779911111"

PROBE = """() => {
  const row = document.querySelector('[data-league-mission="health"]');
  if (!row) return null;
  const box = el => el ? {cw: el.clientWidth, sw: el.scrollWidth, w: Math.round(el.getBoundingClientRect().width)} : null;
  const t = row.querySelector('[data-mission-title]');
  const n = row.querySelector('[data-mission-note]');
  const rows = row.querySelectorAll(':scope > span');
  const act = rows[1] ? rows[1].lastElementChild : null;
  const btn = row;
  const card = btn.parentElement.parentElement;
  return {
    btn: box(btn), card: box(card),
    row1: box(rows[0]), row2: box(rows[1]),
    title: { ...box(t), fs: getComputedStyle(t).fontSize, lh: getComputedStyle(t).lineHeight },
    note: { ...box(n), fs: getComputedStyle(n).fontSize },
    action: { ...box(act), fs: act ? getComputedStyle(act).fontSize : null },
    chain: (() => { const out=[]; let el=btn; for (let i=0;i<4 && el;i++){ const cs=getComputedStyle(el); out.push({tag:el.tagName, cls:(el.className||'').toString().slice(0,90), w:Math.round(el.getBoundingClientRect().width), pl:cs.paddingLeft, pr:cs.paddingRight, bl:cs.borderLeftWidth}); el=el.parentElement; } return out; })(),
    root: getComputedStyle(document.documentElement).fontSize,
    rowH: Math.round(btn.getBoundingClientRect().height),
  };
}"""


def kakao_stub():
    def handler(route, request):
        if "start=1" in request.url:
            route.fulfill(status=302, headers={"location": "/?code=STUB-AUTH-CODE"})
        elif request.method == "POST":
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"ok": True, "profile": {"id": f"kakao_{ID_T}", "nickname": NICK, "birthYear": 1955, "source": "kakao", "createdAt": "2026-11-18T00:00:00.000Z"}}),
            )
        else:
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True, "supabase": "connected", "kakao": "configured", "kakaoLoginConfigured": True}))

    return handler


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ko-KR", is_mobile=True, has_touch=True, service_workers="block")
    page = ctx.new_page()
    page.route("**/api/auth/kakao**", kakao_stub())
    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.wait_for_selector("text=카카오톡으로 시작하기", timeout=45000)
    page.get_by_role("button", name="카카오톡으로 시작하기").click()
    try:
        page.wait_for_selector("#setup-nick", timeout=8000)
    except Exception:  # noqa: BLE001
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=45000)
    if page.locator("#setup-nick").count():
        page.fill("#setup-nick", NICK)
        page.select_option("#setup-birth", "1952")
        page.click('[data-birthtime="묘시"]')
        page.select_option("#setup-sido", "충청북도")
        page.select_option("#setup-sigungu", "옥천군")
        page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=45000)
    page.wait_for_timeout(2000)
    page.get_by_role("navigation").get_by_role("button", name="랭킹").click()
    page.wait_for_timeout(2000)
    for step in range(3):
        print(json.dumps(page.evaluate(PROBE), ensure_ascii=False))
        if step < 2:
            page.get_by_role("button", name=re.compile("글씨 크기 바꾸기")).first.click()
            page.wait_for_timeout(900)
    b.close()
