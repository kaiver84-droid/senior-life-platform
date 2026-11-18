"""늘봄 라이브(390×844) — 카드 문구·퀴즈 헤더 점검 + 보고용 캡처.

- 홈: 가족안부달력 카드 문구가 '생일·기념일 추가'(‘챙겨 보세요’ 없음), 운세 카드 문구가
  '오늘은 ' 없이 한 줄로 들어가는지 확인 → downloads/neulbom_home_card_copy.png
- 퀴즈: 위쪽 헤더에 '지금 N문제가 준비돼 있어요' 배지가 없는지 확인
  → downloads/neulbom_quiz_header_clean.png

실행:
  LD_LIBRARY_PATH=/workspace/work/.tools/browser-libs python3 e2e/capture_copy_fixes.py
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright  # noqa: E402

CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
OUT = "/workspace/downloads"
BASE = os.environ.get("BASE", "https://senior-life-platform.pages.dev").rstrip("/")
KAKAO_ID, KAKAO_NAME = "777009002", "순자"


def kakao_stub(route, request):
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
                        "nickname": KAKAO_NAME,
                        "birthYear": 1952,
                        "source": "kakao",
                        "createdAt": "2026-11-16T00:00:00.000Z",
                    },
                }
            ),
        )
    else:
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(
                {
                    "ok": True,
                    "supabase": "stub",
                    "kakao": "configured",
                    "kakaoLoginConfigured": True,
                    "kakaoJsConfigured": False,
                    "redirectUri": f"{BASE}/",
                }
            ),
        )


def login(page):
    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
    page.get_by_role("button", name="카카오톡으로 시작하기").click()
    try:
        page.wait_for_selector("#setup-nick", timeout=12000)
        page.fill("#setup-nick", KAKAO_NAME)
        page.select_option("#setup-birth", "1952")
        page.click('[data-birthtime="묘시"]')
        page.select_option("#setup-sido", "충청북도")
        page.select_option("#setup-sigungu", "옥천군")
        page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
    except Exception:
        pass
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=40000)
    page.wait_for_timeout(2500)


problems = []
info = {}

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = b.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=3,
        locale="ko-KR",
        is_mobile=True,
        has_touch=True,
        user_agent=(
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
            "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        ),
    )
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.route("**/t1.kakaocdn.net/**", lambda r, _q: r.abort())
    page.route("**/api/auth/kakao**", kakao_stub)
    login(page)
    page.evaluate("localStorage.setItem('neulbom.installGuide.dismissed.v1', '1')")
    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
    page.wait_for_timeout(2500)

    # ---------- 홈 카드 ----------
    cards = page.evaluate(
        """() => Array.from(document.querySelectorAll('main button'))
          .filter(b => /달력 보기|운세 보기/.test(b.textContent || ''))
          .map(b => {
            const spans = Array.from(b.querySelectorAll('span'));
            const pill = spans.find(s => /^(달력 보기|운세 보기)$/.test((s.textContent||'').trim()));
            const desc = spans.filter(s => s !== pill && (s.textContent||'').trim().length > 3).pop();
            const dr = desc ? desc.getBoundingClientRect() : null;
            return {
              label: (pill?.textContent || '').trim(),
              desc: (desc?.textContent || '').trim(),
              descH: dr ? Math.round(dr.height) : null,
              descLines: dr ? Math.round(dr.height / parseFloat(getComputedStyle(desc).lineHeight)) : null,
              cardH: Math.round(b.getBoundingClientRect().height),
              overflow: b.scrollWidth - b.clientWidth,
            };
          })"""
    )
    info["cards"] = cards
    by_label = {c["label"]: c for c in cards}
    if len(cards) != 2:
        problems.append(f"카드 2개를 찾지 못함 ({len(cards)})")
    cal = by_label.get("달력 보기", {})
    fort = by_label.get("운세 보기", {})
    if "챙겨 보세요" in (cal.get("desc") or ""):
        problems.append(f"달력 카드에 옛 문구가 남음: {cal.get('desc')}")
    if (cal.get("desc") or "").strip() not in ("생일·기념일 추가",):
        # 다음 일정이 있으면 ‘일정 제목 D-day’가 나오는 게 정상이다
        info["calendarDesc"] = cal.get("desc")
    if (fort.get("desc") or "").startswith("오늘은 "):
        problems.append(f"운세 카드 문구가 아직 ‘오늘은 …’으로 시작: {fort.get('desc')}")
    for c in cards:
        if c.get("descLines") and c["descLines"] > 1:
            problems.append(f"{c['label']} 카드 문구가 {c['descLines']}줄로 늘어남")
        if c.get("overflow", 0) > 1:
            problems.append(f"{c['label']} 카드 가로 넘침 {c['overflow']}px")

    page.evaluate(
        """() => {
          const b = Array.from(document.querySelectorAll('main button'))
            .find(x => /달력 보기/.test(x.textContent || ''));
          window.scrollTo(0, Math.max(0, b.getBoundingClientRect().top + window.scrollY - 300));
        }"""
    )
    page.wait_for_timeout(700)
    clip = page.evaluate(
        """() => {
          const b = Array.from(document.querySelectorAll('main button'))
            .find(x => /달력 보기/.test(x.textContent || ''));
          const grid = b.parentElement.getBoundingClientRect();
          const top = Math.max(0, grid.top - 6);
          return { x: 0, y: top, width: document.documentElement.clientWidth,
                   height: Math.min(window.innerHeight - top - 8, grid.height + 12) };
        }"""
    )
    page.screenshot(path=f"{OUT}/neulbom_home_card_copy.png", clip=clip)
    info["homeShot"] = f"{OUT}/neulbom_home_card_copy.png"

    # ---------- 퀴즈 헤더 ----------
    page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name="퀴즈").click()
    page.wait_for_timeout(2200)
    body = page.locator("body").inner_text()
    if re.search(r"지금 \d+문제가 준비돼 있어요", body):
        problems.append("퀴즈 위쪽 헤더에 문제 수 배지가 아직 남아 있음")
    info["quizBanks"] = page.evaluate(
        "() => Array.from(document.querySelectorAll('[data-quiz-bank]'))"
        ".map(e => ({ tag: e.tagName, value: e.getAttribute('data-quiz-bank'), "
        "visible: !!(e.offsetWidth || e.offsetHeight) }))"
    )
    info["quizHeaderText"] = page.evaluate(
        """() => {
          const h = document.querySelector('main h1');
          const sec = h ? h.closest('section') : null;
          return sec ? (sec.innerText || '').trim() : '';
        }"""
    )
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(400)
    page.screenshot(path=f"{OUT}/neulbom_quiz_header_clean.png")
    info["quizShot"] = f"{OUT}/neulbom_quiz_header_clean.png"

    if errors:
        problems.append(f"페이지 오류: {errors[:3]}")
    b.close()

print(json.dumps(info, ensure_ascii=False, indent=2))
print("문제:", len(problems))
for x in problems:
    print("  ", x)
sys.exit(1 if problems else 0)
