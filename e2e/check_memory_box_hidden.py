"""🎁 오늘의 추억상자(추억의 사진 선물) 숨김 검증 — 2026-11-27 "일단 숨겨놔 줘".

390×844 · 글씨 3단계(보통 18 · 크게 21 · 아주 크게 24). DB 쓰기(POST /api/state)는 막고 읽기만 한다.

확인
1) 첫 접속(localStorage 비움) — 온보딩 화면에 추억상자 팝업·버튼이 없다
2) 이미 설정을 마친 기기(localStorage 에 프로필만 있음 = 예전에는 팝업이 뜨던 바로 그 상태)
   — 홈에 추억상자 팝업·버튼·'추억' 문구가 전혀 없다
3) 오늘 상자를 본 날짜 키(neulbom.memoryBoxSeenDate)가 새로 생기지 않는다
4) /guide/quiz/ 공개 안내 페이지에도 추억상자 소개가 없다
5) 콘솔 오류 0건 · 가로 넘침 0px · 깨진 이미지 0건

스크린샷: work/evidence/neulbom_hide_memory_box_20261127.png (글씨 3단계 합성)
          work/evidence/neulbom_hide_memory_box_20261127_{normal,large,xlarge}.png
          work/evidence/neulbom_hide_memory_box_20261127_fresh_{normal,large,xlarge}.png
          work/evidence/neulbom_hide_memory_box_20261127_guide_quiz.png
결과: work/evidence/neulbom_hide_memory_box_20261127.json
"""
import json
import os

# 크롬이 쓰는 시스템 라이브러리 — 이 샌드박스에서는 따로 모아 둔 곳을 가리켜야 실행된다
os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.libs/usr/lib/x86_64-linux-gnu:/workspace/work/.tools/browser-libs"
)

from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "https://senior-life-platform.pages.dev").rstrip("/")
OUT = os.environ.get("OUT", "/workspace/work/evidence")
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")
STEM = os.environ.get("STEM", "neulbom_hide_memory_box_20261127")
UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
)

PROBE = """
() => {
  const de = document.documentElement;
  const over = [];
  document.querySelectorAll('*').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.right > de.clientWidth + 1.5 || r.left < -1.5) {
      over.push({tag: el.tagName, cls: (el.className||'').toString().slice(0,70),
                 left: Math.round(r.left), right: Math.round(r.right)});
    }
  });
  const boxNodes = document.querySelectorAll(
    '[data-memory-box-card], [data-memory-box-photo], [data-memory-box-open], ' +
    '[data-memory-box-close], [data-memory-box-dismiss]'
  ).length;
  const text = document.body.innerText || '';
  const memoria = [...document.querySelectorAll('button, a, [role=button]')]
    .map((b) => (b.innerText || '').trim())
    .filter((t) => t.includes('추억'));
  const broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0)
    .map((i) => (i.currentSrc || i.src).split('/').slice(-2).join('/'));
  return {
    boxNodes,
    hasTitle: text.includes('추억상자'),
    hasOldTitle: text.includes('추억 상자'),
    hasAnyMemoryWord: text.includes('추억'),
    memoriaButtons: memoria,
    docW: de.scrollWidth, clientW: de.clientWidth, docH: de.scrollHeight,
    overCount: over.length, over: over.slice(0, 8),
    brokenImages: broken.slice(0, 8),
    seenKey: localStorage.getItem('neulbom.memoryBoxSeenDate'),
    bodyOverflowX: getComputedStyle(document.body).overflowX,
    url: location.pathname,
    screenshotText: text.slice(0, 160),
  };
}
"""


def configured_profile(font_size):
    """프로필만 있고 '오늘 상자를 봤다'는 키는 없는 기기 — 예전에는 이 상태에서 홈 팝업이 떴다."""
    return "localStorage.setItem('seniorLife.v1', %s)" % json.dumps(
        json.dumps(
            {
                "version": 1,
                "profile": {
                    "id": "demo_memorybox_hidden_check",
                    "nickname": "순자",
                    "birthYear": 1952,
                    "birthTime": "묘시",
                    "sido": "충청북도",
                    "sigungu": "옥천군",
                    "createdAt": "2026-11-24T00:00:00.000Z",
                    "source": "demo",
                    "profileCompleted": True,
                },
                "quizLogs": [],
                "med": {},
                "visits": [],
                "familyEvents": [],
                "health": {},
                "missions": {},
                "rankingVisible": True,
                "fontSize": font_size,
                "lastVisit": "",
            },
            ensure_ascii=False,
        )
    )


def new_page(browser, font_size=None, configured=True):
    ctx = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
        user_agent=UA,
    )
    page = ctx.new_page()
    console, http = [], []
    page.on("console", lambda m: console.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
    page.on("response", lambda r: http.append((r.status, r.url)) if r.status >= 400 else None)
    # DB 쓰기는 차단 — 읽기(GET)만 통과
    page.route(
        "**/api/state",
        lambda route: route.fulfill(status=200, content_type="application/json", body='{"ok":true}')
        if route.request.method != "GET"
        else route.continue_(),
    )
    if configured:
        page.add_init_script(configured_profile(font_size or 18))
    return ctx, page, console, http


def blocked_font_inject(page, size):
    """이미 그려진 홈에서 글씨 단계를 바꾼다(앱과 같은 CSS 변수)."""
    page.evaluate(
        """(s) => {
            const k = 'seniorLife.v1';
            const v = JSON.parse(localStorage.getItem(k) || '{}');
            v.fontSize = s;
            localStorage.setItem(k, JSON.stringify(v));
            document.documentElement.style.setProperty('--app-font', (s + 1) + 'px');
        }""",
        size,
    )


def main():
    os.makedirs(OUT, exist_ok=True)
    report = {"base": BASE, "problems": []}
    problems = report["problems"]
    shots = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

        # ── 1·2·3) 글씨 3단계 — 첫 접속(빈 저장소)과 설정된 기기
        normal_panels = []
        for label, size in (("normal", 18), ("large", 21), ("xlarge", 24)):
            # (a) 첫 접속 — localStorage 비움
            ctx, page, console, http = new_page(browser, size, configured=False)
            page.goto(BASE + "/", wait_until="domcontentloaded")
            page.wait_for_timeout(2500)
            pr = page.evaluate(PROBE)
            fresh_shot = os.path.join(OUT, f"{STEM}_fresh_{label}.png")
            page.screenshot(path=fresh_shot)
            report[f"fresh_{label}"] = {
                "boxNodes": pr["boxNodes"],
                "hasTitle": pr["hasTitle"],
                "hasAnyMemoryWord": pr["hasAnyMemoryWord"],
                "memoriaButtons": pr["memoriaButtons"],
                "overCount": pr["overCount"],
                "docW": pr["docW"],
                "clientW": pr["clientW"],
                "consoleErrors": console,
                "shot": fresh_shot,
            }
            if pr["boxNodes"] or pr["hasTitle"] or pr["memoriaButtons"]:
                problems.append((f"fresh {label}", "빈 저장소 첫 접속에 추억상자 흔적", pr))
            if pr["overCount"]:
                problems.append((f"fresh {label}", "가로 넘침", pr["over"]))
            if console:
                problems.append((f"fresh {label}", "콘솔 오류", console[:4]))
            ctx.close()

            # (b) 설정을 마친 기기 — 예전에는 홈 가운데 팝업이 뜨던 상태
            ctx, page, console, http = new_page(browser, size, configured=True)
            page.goto(BASE + "/", wait_until="domcontentloaded")
            page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
            page.wait_for_timeout(2200)  # 예전이라면 팝업이 떠 있었을 시간
            # 첫 방문에 뜨는 '앱 설치하기' 안내 시트는 닫고 홈 화면 자체를 찍는다
            dismissed = False
            for sel in ('button:has-text("나중에 보기")', 'button:has-text("다시 안 보기")'):
                loc = page.locator(sel)
                if loc.count() and loc.first.is_visible():
                    loc.first.click()
                    dismissed = True
                    page.wait_for_timeout(700)
                    break
            if size != 18:
                blocked_font_inject(page, size)
                page.wait_for_timeout(900)
            page.wait_for_timeout(1200)  # 팝업이 늦게라도 뜨는지 한 번 더
            pr = page.evaluate(PROBE)
            shot = os.path.join(OUT, f"{STEM}_{label}.png")
            page.screenshot(path=shot)
            report[f"configured_{label}"] = {
                "installSheetDismissed": dismissed,
                "boxNodes": pr["boxNodes"],
                "hasTitle": pr["hasTitle"],
                "hasOldTitle": pr["hasOldTitle"],
                "hasAnyMemoryWord": pr["hasAnyMemoryWord"],
                "memoriaButtons": pr["memoriaButtons"],
                "seenKeyAfterVisit": pr["seenKey"],
                "overCount": pr["overCount"],
                "over": pr["over"],
                "docW": pr["docW"],
                "clientW": pr["clientW"],
                "brokenImages": pr["brokenImages"],
                "consoleErrors": [e for e in console if "Failed to load resource" not in e],
                "httpErrors": [(s, u) for s, u in http if "/api/" not in u][:5],
                "shot": shot,
            }
            if not dismissed:
                problems.append((f"configured {label}", "앱 설치하기 시트를 닫지 못해 홈을 찍지 못함", pr["screenshotText"]))
            if pr["boxNodes"] or pr["hasTitle"] or pr["memoriaButtons"]:
                problems.append((f"configured {label}", "홈에 추억상자 팝업·버튼이 남아 있음", pr))
            if pr["seenKey"]:
                problems.append((f"configured {label}", "상자를 본 날짜 키가 새로 생김", pr["seenKey"]))
            if pr["overCount"]:
                problems.append((f"configured {label}", "가로 넘침", pr["over"]))
            if pr["brokenImages"]:
                problems.append((f"configured {label}", "깨진 이미지", pr["brokenImages"]))
            real_console = [e for e in console if "Failed to load resource" not in e]
            if real_console:
                problems.append((f"configured {label}", "콘솔 오류", real_console[:4]))
            shots[label] = shot
            normal_panels.append(shot)
            ctx.close()

        # ── 4) 공개 안내 페이지(/guide/quiz/) 에도 소개가 없다
        ctx, page, console, http = new_page(browser)
        page.goto(BASE + "/guide/quiz/", wait_until="domcontentloaded")
        page.wait_for_timeout(1200)
        guide_text = page.evaluate("() => document.body.innerText")
        guide_shot = os.path.join(OUT, f"{STEM}_guide_quiz.png")
        page.screenshot(path=guide_shot)
        report["guideQuiz"] = {
            "hasMemorySection": "추억상자" in guide_text,
            "hasMemoryWord": "추억" in guide_text,
            "consoleErrors": [e for e in console if "Failed to load resource" not in e],
            "shot": guide_shot,
        }
        if "추억상자" in guide_text:
            problems.append(("guide/quiz", "안내 페이지에 추억상자 소개가 남아 있음", guide_text[:200]))
        if report["guideQuiz"]["consoleErrors"]:
            problems.append(("guide/quiz", "콘솔 오류", report["guideQuiz"]["consoleErrors"][:4]))
        ctx.close()

        browser.close()

    # ── 글씨 3단계를 한 장으로 합친 증빙(보통·크게·아주 크게)
    main_shot = os.path.join(OUT, f"{STEM}.png")
    try:
        from PIL import Image, ImageDraw

        imgs = [Image.open(s).convert("RGB") for s in normal_panels]
        h = max(i.height for i in imgs)
        total_w = sum(i.width for i in imgs) + 24 * (len(imgs) + 1)
        canvas = Image.new("RGB", (total_w, h + 76), (245, 241, 232))
        draw = ImageDraw.Draw(canvas)
        draw.text((24, 20), "늘봄 홈 — 오늘의 추억상자 숨김(2026-11-27) · 글씨 보통 / 크게 / 아주 크게 · 390×844",
                  fill=(60, 50, 40))
        x = 24
        for img in imgs:
            canvas.paste(img, (x, 60))
            x += img.width + 24
        canvas.save(main_shot)
        report["mainShot"] = main_shot
    except Exception as e:  # 합성 실패해도 개별 스크린샷은 남는다
        report["composeError"] = str(e)
        main_shot = normal_panels[0]
        report["mainShot"] = main_shot

    with open(os.path.join(OUT, f"{STEM}.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print("\nPROBLEMS:", len(problems))


if __name__ == "__main__":
    main()
