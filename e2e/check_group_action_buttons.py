"""모임 화면(수정·탈퇴 버튼 한 줄) 검증 — 글씨 3단계에서 넘침·줄바꿈·높이 확인 + 캡처.

로컬: python3 e2e/check_group_action_buttons.py
"""
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from harness import onboard, start_server  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
OUT = "/workspace/downloads"

MEASURE = """
() => {
  const wrap = document.querySelector('.group-action');
  const btns = wrap ? Array.from(wrap.querySelectorAll('button')) : [];
  const lineCount = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0.5 && r.height > 0.5);
    return rects.length;
  };
  const rows = btns.map((b) => {
    const cs = getComputedStyle(b);
    const r = b.getBoundingClientRect();
    return {
      text: (b.textContent || '').trim(),
      w: Math.round(r.width),
      h: Math.round(r.height),
      top: Math.round(r.top),
      scrollW: b.scrollWidth,
      clientW: b.clientWidth,
      wrap: cs.whiteSpace,
      fontSize: cs.fontSize,
      lines: lineCount(b),
      overflow: b.scrollWidth > b.clientWidth + 1 ? b.scrollWidth - b.clientWidth : 0,
    };
  });
  const input = document.querySelector('input[aria-label="모임 게시판에 남길 말"]');
  const submit = input && input.parentElement ? input.parentElement.querySelector('button') : null;
  let inputInfo = null;
  if (input) {
    const cs = getComputedStyle(input);
    const contentW = input.clientWidth; // input 의 clientWidth 는 안쪽 글자 영역
    const canvas = document.createElement('canvas');
    const c2 = canvas.getContext('2d');
    c2.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const phW = c2.measureText(input.placeholder).width;
    inputInfo = {
      ph: input.placeholder,
      w: Math.round(input.getBoundingClientRect().width),
      contentW: Math.round(contentW),
      phW: Math.round(phW),
      phFits: phW <= contentW,
      fontSize: cs.fontSize,
    };
  }
  const submitInfo = submit
    ? {
        text: (submit.textContent || '').trim(),
        w: Math.round(submit.getBoundingClientRect().width),
        h: Math.round(submit.getBoundingClientRect().height),
        lines: lineCount(submit),
      }
    : null;
  const doc = document.documentElement;
  const over = Array.from(document.querySelectorAll('main *'))
    .filter((el) => el.getBoundingClientRect().right > doc.clientWidth + 1)
    .slice(0, 5)
    .map((el) => (el.tagName + '.' + (el.className || '')).slice(0, 60));
  return { rows, inputInfo, submitInfo, root: getComputedStyle(doc).fontSize, scrollW: doc.scrollWidth, clientW: doc.clientWidth, over };
}
"""

httpd = start_server()
problems = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, locale="ko-KR", is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    onboard(page)
    page.wait_for_timeout(1200)
    banner = page.locator("[data-install-banner]")
    if banner.count():
        banner.click()
        page.wait_for_timeout(600)
        page.keyboard.press("Escape")
    page.get_by_role("navigation").get_by_role("button", name="모임").click()
    page.wait_for_timeout(1200)
    page.get_by_role("button", name="체험 모임 들어가기").click()
    page.wait_for_timeout(1500)

    for label in ["보통", "크게", "아주 크게"]:
        info = page.evaluate(MEASURE)
        print(f"[{label}] root {info['root']} scrollW {info['scrollW']}/{info['clientW']}")
        for r in info["rows"]:
            print("   ", r)
        print("    input", info["inputInfo"], "submit", info["submitInfo"])
        if len(info["rows"]) != 2:
            problems.append(f"{label}: 버튼 2개를 찾지 못함 ({len(info['rows'])})")
        else:
            a, b2 = info["rows"]
            if a["h"] != b2["h"]:
                problems.append(f"{label}: 두 버튼 높이 다름 {a['h']} vs {b2['h']}")
            if a["top"] != b2["top"]:
                problems.append(f"{label}: 두 버튼이 같은 줄이 아님 top {a['top']} vs {b2['top']}")
            for r in (a, b2):
                if r["overflow"]:
                    problems.append(f"{label}: '{r['text']}' 가로 넘침 {r['overflow']}px")
                if r["lines"] > 1:
                    problems.append(f"{label}: '{r['text']}' {r['lines']}줄")
        if info["over"]:
            problems.append(f"{label}: 가로 넘침 요소 {info['over']}")
        if info["submitInfo"] and info["submitInfo"]["h"] > 60:
            problems.append(f"{label}: 남기기 버튼 높이 {info['submitInfo']['h']}")
        # 버튼 묶음 캡처
        page.locator(".group-action").scroll_into_view_if_needed()
        page.wait_for_timeout(300)
        tag = {"보통": "18", "크게": "21", "아주 크게": "24"}[label]
        page.locator(".group-action").screenshot(path=f"{OUT}/_local_group_buttons_{tag}.png")
        if label != "아주 크게":
            page.get_by_role("button", name="글씨 크기 바꾸기 — 지금", exact=False).click()
            page.wait_for_timeout(700)

    if errs:
        problems.append(f"페이지 오류: {errs[:3]}")
    b.close()
httpd.shutdown()
print("문제:", len(problems))
for x in problems:
    print("  ", x)
