"""늘봄 홈 — 가족안부달력 · 오늘의 운세 2열 카드 점검.

- '달력 보기' / '운세 보기' 알약 버튼이 카드 가로 전체를 채우는지(좌우 여백이 카드 패딩과 같은지)
- 알약 버튼 글자가 좌우 패딩 안에 들어오는지(넘침·잘림 없음)
- 카드 본문·제목이 카드 폭 안에서 넘치지 않는지
- 글씨 크기 3단계(보통/크게/아주 크게) 모두에서 확인
- 버튼 클릭 시 달력 시트·운세 시트가 실제로 열리는지

실행 (로컬 정적 빌드 out/):
  LD_LIBRARY_PATH=/workspace/.cache/deblibs/usr/lib/x86_64-linux-gnu \
    python3 e2e/check_calendar_fortune_cards.py

라이브 점검은 LIVE=1 로 실행한다.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import onboard, start_server  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
OUT = "/workspace/downloads"
LIVE = os.environ.get("LIVE") == "1"
BASE = "https://senior-life-platform.pages.dev" if LIVE else None

KAKAO_ID, KAKAO_NAME = "777009002", "순자"


def kakao_stub(route, request):
    """라이브 점검용 — 카카오 로그인 왕복을 가로채 로컬처럼 둘러보기 상태를 만든다."""
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
                    "supabase": "connected",
                    "kakao": "configured",
                    "kakaoLoginConfigured": True,
                    "kakaoJsConfigured": False,
                    "redirectUri": f"{BASE}/",
                }
            ),
        )


def live_login(page):
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
    page.wait_for_timeout(3000)


MEASURE = """() => {
  const cards = Array.from(document.querySelectorAll('main button'))
    .filter(b => /달력 보기|운세 보기/.test(b.textContent || ''));
  return cards.map(b => {
    const card = b.getBoundingClientRect();
    const cs = getComputedStyle(b);
    const pill = Array.from(b.querySelectorAll('span'))
      .find(s => /^(달력 보기|운세 보기)$/.test((s.textContent || '').trim()));
    const title = Array.from(b.querySelectorAll('span'))
      .find(s => /가족안부/.test(s.textContent || '') || /^오늘의운세$|^오늘의 운세$/.test((s.textContent||'').trim()));
    const desc = Array.from(b.querySelectorAll('span'))
      .filter(s => s !== pill && s !== title && (s.textContent || '').trim().length > 4)
      .pop();
    const pr = pill ? pill.getBoundingClientRect() : null;
    const pcs = pill ? getComputedStyle(pill) : null;
    const tr = title ? title.getBoundingClientRect() : null;
    return {
      label: (pill?.textContent || '').trim(),
      cardW: Math.round(card.width),
      cardH: Math.round(card.height),
      cardPadL: Math.round(parseFloat(cs.paddingLeft)),
      cardPadR: Math.round(parseFloat(cs.paddingRight)),
      pillW: pr ? Math.round(pr.width) : null,
      pillH: pr ? Math.round(pr.height) : null,
      pillLeftGap: pr ? Math.round(pr.left - card.left) : null,
      pillRightGap: pr ? Math.round(card.right - pr.right) : null,
      pillFont: pcs ? pcs.fontSize : null,
      pillPadX: pcs ? [pcs.paddingLeft, pcs.paddingRight].join(' / ') : null,
      pillTextOverflow: pill ? pill.scrollWidth - pill.clientWidth : null,
      pillTextClipped: pill ? (pill.scrollWidth > pill.clientWidth + 1) : null,
      cardScrollOverflow: b.scrollWidth - b.clientWidth,
      titleH: tr ? Math.round(tr.height) : null,
      titleLines: title ? Math.round(tr.height / parseFloat(getComputedStyle(title).lineHeight)) : null,
      titleOverflow: title ? title.scrollWidth - title.clientWidth : null,
      descLines: desc ? Math.round(desc.getBoundingClientRect().height / parseFloat(getComputedStyle(desc).lineHeight)) : null,
    };
  });
}"""

problems = []

# 아이폰 사파리는 <button> 안의 flex 자식을 기본값으로 늘리지 않는다(자식이 글자 폭만큼 작아져 왼쪽에 붙음).
# 크로미움에는 그 동작이 없으므로 align-items:flex-start 로 그 상황을 만들어, w-full 이 있으면
# 카드 폭을 그대로 채우는지(= 사파리에서도 같은 모양인지) 확인한다.
SAFARI_SIM = """() => {
  const cards = Array.from(document.querySelectorAll('main button'))
    .filter(b => /달력 보기|운세 보기/.test(b.textContent || ''));
  return cards.map(b => {
    const prev = b.style.alignItems;
    b.style.alignItems = 'flex-start';
    const pill = Array.from(b.querySelectorAll('span'))
      .find(s => /^(달력 보기|운세 보기)$/.test((s.textContent || '').trim()));
    const cs = getComputedStyle(b);
    const cr = b.getBoundingClientRect();
    const pr = pill.getBoundingClientRect();
    const inner = cr.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    b.style.alignItems = prev;
    return {
      label: (pill.textContent || '').trim(),
      pillW: Math.round(pr.width),
      inner: Math.round(inner),
      leftGap: Math.round(pr.left - cr.left),
    };
  });
}"""
httpd = None if LIVE else start_server()
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
    console_errors, page_errors, http_errors = [], [], []

    # 이 점검은 카카오 로그인 왕복을 가짜로 처리하며 카카오 SDK CDN(t1.kakaocdn.net)을 일부러 막는다.
    # 그 차단으로 생기는 ERR_FAILED 는 사이트 오류가 아니므로 세지 않는다(그 외는 모두 센다).
    def keep(text, url=""):
        if "kakaocdn.net" in url:
            return False
        # 로컬 정적 서버(out/)는 /api/* 를 서빙하지 않으므로 로컬 실행에서는 빼고 센다
        return LIVE or "/api/" not in url

    page.on(
        "console",
        lambda m: console_errors.append(
            f"{m.text} @ {(m.location or {}).get('url', '')}"
        )
        if m.type == "error" and keep(m.text, (m.location or {}).get("url", ""))
        else None,
    )
    page.on("pageerror", lambda e: page_errors.append(str(e)))
    page.on(
        "response",
        lambda r: http_errors.append(f"{r.status} {r.url}")
        if r.status >= 400 and keep("", r.url)
        else None,
    )

    if LIVE:
        page.route("**/t1.kakaocdn.net/**", lambda route, _req: route.abort())
        page.route("**/api/auth/kakao**", kakao_stub)
        live_login(page)
    else:
        onboard(page)
    page.wait_for_timeout(2000)
    # 설치 안내 배너는 화면 위쪽을 가리고 시트를 열어 클릭 점검을 방해하므로 먼저 치운다
    page.evaluate("localStorage.setItem('neulbom.installGuide.dismissed.v1', '1')")
    page.reload(wait_until="domcontentloaded")
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=15000)
    page.wait_for_timeout(1500)

    for label in ["보통", "크게", "아주 크게"]:
        font = page.evaluate("getComputedStyle(document.documentElement).fontSize")
        info = page.evaluate(MEASURE)
        print("===", label, font)
        for x in info:
            print("   ", json.dumps(x, ensure_ascii=False))
        if len(info) != 2:
            problems.append(f"{label}: 카드 2개를 찾지 못함 ({len(info)})")
        for x in info:
            tag = f"{label}/{x['label']}"
            if x["pillW"] is None:
                problems.append(f"{tag}: 알약 버튼 없음")
                continue
            expect = x["cardW"] - x["cardPadL"] - x["cardPadR"]
            if abs(x["pillW"] - expect) > 1:
                problems.append(f"{tag}: 알약 폭 {x['pillW']}px != 카드 내부 폭 {expect}px")
            if abs(x["pillLeftGap"] - x["cardPadL"]) > 1 or abs(x["pillRightGap"] - x["cardPadR"]) > 1:
                problems.append(
                    f"{tag}: 알약 좌우 여백 {x['pillLeftGap']}/{x['pillRightGap']} != 카드 패딩 {x['cardPadL']}/{x['cardPadR']}"
                )
            if x["pillTextClipped"]:
                problems.append(f"{tag}: 알약 글자 넘침 {x['pillTextOverflow']}px")
            if x["pillH"] < 40:
                problems.append(f"{tag}: 알약 높이 {x['pillH']}px < 40px")
            if x["cardScrollOverflow"] > 1:
                problems.append(f"{tag}: 카드 내용 가로 넘침 {x['cardScrollOverflow']}px")
            if x["titleOverflow"] is None:
                problems.append(f"{tag}: 제목을 찾지 못함")
            elif x["titleOverflow"] > 1:
                problems.append(f"{tag}: 제목 넘침 {x['titleOverflow']}px")
            if x["titleLines"] and x["titleLines"] > 2:
                problems.append(f"{tag}: 제목이 {x['titleLines']}줄로 늘어남")

        # 카드가 화면 가운데 오도록 스크롤한 뒤 찍는다(하단 탭바에 가리지 않게)
        page.evaluate(
            """() => {
              const b = Array.from(document.querySelectorAll('main button'))
                .find(x => /달력 보기/.test(x.textContent || ''));
              if (b) window.scrollTo(0, Math.max(0, b.getBoundingClientRect().top + window.scrollY - 300));
            }"""
        )
        page.wait_for_timeout(500)
        page.screenshot(path=f"{OUT}/_cards_{label.replace(' ', '_')}.png")
        if label == "보통":
            # 보고용 — 달력·운세 카드 두 개가 한눈에 들어오는 영역만 담는다
            clip = page.evaluate(
                """() => {
                  const b = Array.from(document.querySelectorAll('main button'))
                    .find(x => /달력 보기/.test(x.textContent || ''));
                  const grid = b.parentElement.getBoundingClientRect();
                  const top = Math.max(0, grid.top - 2);
                  return { x: 0, y: top, width: document.documentElement.clientWidth,
                           height: Math.min(window.innerHeight - top - 8, grid.height + 4) };
                }"""
            )
            page.screenshot(path=f"{OUT}/neulbom_calendar_fortune_fix.png", clip=clip)

        sim = page.evaluate(SAFARI_SIM)
        print("    사파리 흉내:", json.dumps(sim, ensure_ascii=False))
        for s in sim:
            if abs(s["pillW"] - s["inner"]) > 1:
                problems.append(
                    f"{label}/{s['label']}: 사파리식 정렬에서 알약 폭 {s['pillW']}px != 카드 내부 {s['inner']}px"
                )

        # 클릭 동작 — 두 카드 모두 실제로 열리는지
        # 달력은 전체 화면(‘달력 닫기’), 운세는 시트(‘닫기’)로 열린다
        for name, marker in [("달력 보기", "달력 닫기"), ("운세 보기", "닫기")]:
            page.get_by_role("button", name=name, exact=False).first.click()
            page.wait_for_timeout(1000)
            opened = page.locator(f'button[aria-label="{marker}"]').first.is_visible()
            if not opened:
                problems.append(f"{label}/{name}: 눌러도 화면이 열리지 않음")
            # 열린 화면을 닫고 다음 카드를 위해 홈 상태로 되돌린다
            page.reload(wait_until="domcontentloaded")
            page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=15000)
            page.wait_for_timeout(1500)
            page.evaluate("window.scrollTo(0, 0)")

        if label != "아주 크게":
            page.get_by_role("button", name="글씨 크기 바꾸기 — 지금", exact=False).click()
            page.wait_for_timeout(700)

    if console_errors:
        problems.append(f"콘솔 오류 {len(console_errors)}건: {console_errors[:3]}")
    if page_errors:
        problems.append(f"페이지 오류: {page_errors[:3]}")
    if http_errors:
        problems.append(f"HTTP 오류 {len(http_errors)}건: {http_errors[:3]}")
    print("콘솔 오류", len(console_errors), "HTTP 오류", len(http_errors))
    b.close()
if httpd:
    httpd.shutdown()
print("문제:", len(problems))
for x in problems:
    print("  ", x)
sys.exit(1 if problems else 0)
