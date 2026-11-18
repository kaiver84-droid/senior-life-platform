"""소리로 듣기 버튼 통합 검증 — 가짜 음성 목록(남성·기본·구글·유나)에서 유나가 선택되고
혜택 상세의 '신청 방법 소리로 듣기' 가 실제로 낭독을 시작하는지 본다.

python3 e2e/check_tts_ui.py
"""
import json
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from harness import onboard, start_server  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
OUT = "/workspace/downloads"

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
  const real = window.speechSynthesis || {};
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

problems = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
    if not cond:
        problems.append(label)


httpd = start_server()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, locale="ko-KR", is_mobile=True, has_touch=True)
    page = ctx.new_page()
    page.add_init_script(STUB)
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    onboard(page)
    page.wait_for_timeout(1200)
    banner = page.locator("[data-install-banner]")
    if banner.count():
        banner.click()
        page.wait_for_timeout(500)
        page.keyboard.press("Escape")

    page.get_by_role("navigation").get_by_role("button", name="혜택").click()
    page.wait_for_timeout(1200)
    page.get_by_role("button", name="신청 방법 자세히 보기").first.click()
    page.wait_for_timeout(900)
    btn = page.locator('[data-tts="welfare-detail"]')
    check(btn.count() == 1, "혜택 상세 '신청 방법 소리로 듣기' 버튼 있음")
    btn.first.click()
    page.wait_for_timeout(700)
    state = btn.first.get_attribute("data-tts-state")
    spoken = page.evaluate("() => window.__spoken || []")
    check(state == "speaking", "버튼이 '멈추기' 상태로 바뀜", state)
    check(len(spoken) > 0, "낭독 시작됨", f"{len(spoken)}문장")
    if spoken:
        first = spoken[0]
        check(first["voice"] == "Yuna (Enhanced)", "유나(Enhanced) 음성 선택", str(first["voice"]))
        check(abs(first["rate"] - 0.95) < 1e-6 and abs(first["pitch"] - 1.04) < 1e-6, "rate 0.95 · pitch 1.04", f"{first['rate']}/{first['pitch']}")
        joined = " ".join(s["text"] for s in spoken)
        check("신청" in joined and "🚪" not in joined, "신청 방법 문장이 한국어로 읽힘", joined[:80])
        check(first["lang"] == "ko-KR", "언어 ko-KR", first["lang"])
        print("    전체 낭독문:", joined[:220])

    # 멈추기 확인
    btn.first.click()
    page.wait_for_timeout(500)
    check(btn.first.get_attribute("data-tts-state") == "idle", "다시 누르면 멈춤")

    page.screenshot(path=f"{OUT}/_tts_welfare_detail.png")
    if errs:
        problems.append(f"페이지 오류: {errs[:3]}")
    b.close()
httpd.shutdown()
print("문제:", len(problems))
for x in problems:
    print("  ", x)
