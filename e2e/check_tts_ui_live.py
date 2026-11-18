"""라이브 검증 — 혜택 상세의 `신청 방법 소리로 듣기` 가 한국어 여성 아나운서 음성으로
제대로 낭독을 시작하는지(가짜 음성 목록 주입) 확인한다.

    BASE=https://senior-life-platform.pages.dev python3 e2e/check_tts_ui_live.py
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
NICK = "음성점검"

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


ID_T = "779912342"
CODE_T = js_make_code(f"kakao_{ID_T}")

VOICES = [
    {"name": "Minsu", "lang": "ko-KR", "localService": True, "default": True, "voiceURI": "minsu"},
    {"name": "Korean", "lang": "ko-KR", "localService": True, "default": False, "voiceURI": "korean"},
    {"name": "Google 한국의", "lang": "ko-KR", "localService": False, "default": False, "voiceURI": "google"},
    {"name": "Yuna (Enhanced)", "lang": "ko-KR", "localService": True, "default": False, "voiceURI": "yuna"},
]

STUB = """
(() => {
  const voices = %s;
  const spoken = [];
  window.__spoken = spoken;
  class FakeUtterance { constructor(text) { this.text = text; } }
  const fake = {
    speaking: false, paused: false, pending: false,
    getVoices: () => voices,
    speak: (u) => {
      spoken.push({ text: u.text, voice: u.voice ? u.voice.name : null, rate: u.rate, pitch: u.pitch, lang: u.lang });
      fake.speaking = true;
      if (typeof u.onend === 'function') setTimeout(() => { fake.speaking = false; u.onend(); }, 60000);
    },
    cancel: () => { fake.speaking = false; },
    resume: () => {}, pause: () => {},
    addEventListener: () => {}, removeEventListener: () => {},
    onvoiceschanged: null,
  };
  Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
  window.SpeechSynthesisUtterance = FakeUtterance;
})();
""" % json.dumps(VOICES, ensure_ascii=False)

errors = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
    if not cond:
        errors.append(label)


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
            print("  (cleanup skip)", q[:50], e)


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
    page.add_init_script(STUB)
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

    page.get_by_role("navigation").get_by_role("button", name="혜택").click()
    page.wait_for_timeout(2000)
    page.get_by_role("button", name="신청 방법 자세히 보기").first.click()
    page.wait_for_timeout(1200)
    btn = page.locator('[data-tts="welfare-detail"]')
    check(btn.count() == 1, "라이브 혜택 상세 '신청 방법 소리로 듣기' 버튼 있음")
    btn.first.click()
    page.wait_for_timeout(900)
    spoken = page.evaluate("() => window.__spoken || []")
    state = btn.first.get_attribute("data-tts-state")
    check(state == "speaking", "버튼이 '멈추기' 상태로 바뀜", str(state))
    check(len(spoken) > 0, "낭독 시작됨", f"{len(spoken)}문장")
    if spoken:
        first = spoken[0]
        check(first["voice"] == "Yuna (Enhanced)", "유나(Enhanced) 여성 음성 선택", str(first["voice"]))
        check(abs(first["rate"] - 0.95) < 1e-6 and abs(first["pitch"] - 1.04) < 1e-6, "rate 0.95 · pitch 1.04", f"{first['rate']}/{first['pitch']}")
        joined = " ".join(s["text"] for s in spoken)
        check("첫째" in joined, "단계 설명이 '첫째'로 자연스럽게 읽힘", joined[:120])
        check("🚪" not in joined and "[object" not in joined, "이모지·깨진 문자 없음")
        print("    낭독문:", joined[:200])
    page.screenshot(path=f"{SHOT}/_live_tts_welfare_detail.png")

    btn.first.click()
    page.wait_for_timeout(600)
    check(btn.first.get_attribute("data-tts-state") == "idle", "다시 누르면 멈춤")
    if errs:
        errors.append(f"페이지 오류: {errs[:3]}")
    b.close()

cleanup()
print("문제:", len(errors))
for x in errors:
    print("  ", x)
sys.exit(1 if errors else 0)
