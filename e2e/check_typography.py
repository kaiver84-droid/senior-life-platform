"""시니어 타이포그래피(Pretendard) 점검 — 390×844 화면에서 글꼴·크기·굵기·행간과 넘침을 확인한다.

로컬:  python3 e2e/check_typography.py
라이브: BASE=https://senior-life-platform.pages.dev python3 e2e/check_typography.py
"""
import json
import os
import re
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", "http://127.0.0.1:8099").rstrip("/")
LOCAL = BASE.startswith("http://127.0.0.1")
SHOT = "/workspace/downloads"
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")
os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.libs/usr/lib/x86_64-linux-gnu:/workspace/work/.tools/browser-libs"
)
NICK = "글씨점검"

# 가이드(IMG_4868) 기준 — 실제 화면에서 잰 값
TARGETS = {
    "메인 제목": {"sel": "h1.t-title", "size": 28, "weight": 800, "lh_min": 1.35, "lh_max": 1.75},
    "메뉴 제목": {"sel": ".section-title", "size": 22, "weight": 700, "lh_min": 1.35, "lh_max": 1.75},
    "일반 본문": {"sel": ".t-body", "size": 19, "weight": 500, "lh_min": 1.45, "lh_max": 1.75},
    "주요 안내문": {"sel": ".t-notice", "size": 21, "weight": 600, "lh_min": 1.4, "lh_max": 1.75},
    "버튼": {"sel": "button.touch-btn", "size": 20, "weight": 700, "lh_min": 1.2, "lh_max": 1.6},
    "보조 설명": {"sel": ".t-sub", "size": 17, "weight": 500, "lh_min": 1.35, "lh_max": 1.8},
    "숫자": {"sel": ".t-num", "size": 26, "weight": 700, "lh_min": 1.1, "lh_max": 1.6},
}

results = {}
errors = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
    results[label] = bool(cond)
    if not cond:
        errors.append(label)


CODE_T = None
if not LOCAL:
    from test_kakao_onboarding import js_make_code, sql  # noqa: E402

    ID_T = "556611237"
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
                                "birthYear": 1952,
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
                    body=json.dumps(
                        {"ok": True, "supabase": "connected", "kakao": "configured", "kakaoLoginConfigured": True}
                    ),
                )

        return handler


def login(page):
    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
    if LOCAL:
        page.get_by_role("button", name="카카오 없이 둘러보기 (개발용)").click()
    else:
        page.get_by_role("button", name="카카오톡으로 시작하기").click()
    page.wait_for_selector("#setup-nick", timeout=30000)
    page.fill("#setup-nick", NICK)
    page.select_option("#setup-birth", "1952")
    page.click('[data-birthtime="묘시"]')
    page.select_option("#setup-sido", "충청북도")
    page.select_option("#setup-sigungu", "옥천군")
    page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
    page.wait_for_timeout(2500)


MEASURE = """
() => {
  const out = {};
  const read = (el) => {
    const cs = getComputedStyle(el);
    return {
      text: (el.innerText || '').trim().slice(0, 24),
      fontSize: parseFloat(cs.fontSize),
      fontWeight: Number(cs.fontWeight),
      lineHeight: parseFloat(cs.lineHeight),
      fontFamily: cs.fontFamily,
      ratio: cs.lineHeight === 'normal' ? 1.6 : parseFloat(cs.lineHeight) / parseFloat(cs.fontSize),
      overflow: el.scrollWidth - el.clientWidth,
    };
  };
  for (const [name, sel] of Object.entries(SELECTORS)) {
    const el = document.querySelector(sel);
    out[name] = el ? read(el) : null;
  }
  out._page = {
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    fontLoaded: document.fonts ? document.fonts.check('16px "Pretendard Variable"') || document.fonts.check('16px Pretendard') : false,
    bodyFont: getComputedStyle(document.body).fontFamily,
    rootFont: getComputedStyle(document.documentElement).fontSize,
  };
  // 화면 밖으로 넘친 요소(가로 스크롤을 만드는 것)
  const over = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > window.innerWidth + 1 && getComputedStyle(el).position !== 'fixed') {
      over.push((el.className && String(el.className).slice(0, 40)) + ' @' + Math.round(r.right));
      if (over.length >= 5) break;
    }
  }
  out._overflowing = over;
  return out;
}
"""


def main():
    shots = []
    if LOCAL:
        from harness import start_server

        start_server()
    else:
        cleanup()

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            locale="ko-KR",
            is_mobile=True,
            has_touch=True,
            timezone_id="Asia/Seoul",
        )
        page = ctx.new_page()
        console_errors = []
        page.on("pageerror", lambda e: console_errors.append(str(e)))
        if not LOCAL:
            page.route("**/api/auth/kakao**", kakao_stub())

        login(page)
        page.wait_for_timeout(1500)
        page.evaluate(
            "sels => { window.SELECTORS = sels; }",
            {k: v["sel"] for k, v in TARGETS.items()},
        )

        # ---------- 홈 ----------
        data = page.evaluate(MEASURE)
        check(data["_page"]["fontLoaded"], "Pretendard 웹폰트 로드(document.fonts)", str(data["_page"]["fontLoaded"]))
        check("Pretendard" in data["_page"]["bodyFont"], "본문 글꼴이 Pretendard", data["_page"]["bodyFont"][:60])
        print("  (root font-size)", data["_page"]["rootFont"])
        for name, t in TARGETS.items():
            if name == "숫자":
                continue  # 숫자는 랭킹 탭에서 따로 잰다(홈에는 큰 숫자가 없다)
            m = data.get(name)
            if not m:
                check(False, f"{name} 요소를 찾음")
                continue
            lh = m["ratio"]
            ok = (
                abs(m["fontSize"] - t["size"]) <= 1.2
                and m["fontWeight"] == t["weight"]
                and t["lh_min"] <= lh <= t["lh_max"]
            )
            check(
                ok,
                f"{name}: {t['size']}px·{t['weight']}·행간 {t['lh_min']}~{t['lh_max']}",
                f"{m['fontSize']:.1f}px/{m['fontWeight']}/{lh:.2f} “{m['text']}”",
            )
        check(
            data["_page"]["scrollWidth"] <= data["_page"]["clientWidth"],
            "홈 가로 넘침 없음",
            f"{data['_page']['scrollWidth']} vs {data['_page']['clientWidth']}",
        )
        check(not data["_overflowing"], "홈 화면 밖으로 삐져나온 요소 없음", str(data["_overflowing"][:2]))
        page.screenshot(path=f"{SHOT}/_typo_home.png")
        shots.append(f"{SHOT}/_typo_home.png")

        # ---------- 달력 ----------
        page.get_by_role("button").filter(has_text="가족안부달력").first.click()
        page.wait_for_selector("text=📅 가족안부달력", timeout=20000)
        page.wait_for_timeout(1200)
        cal = page.evaluate(
            """() => {
              const out = { wide: document.documentElement.scrollWidth - document.documentElement.clientWidth, over: [] };
              for (const el of document.querySelectorAll('body *')) {
                const r = el.getBoundingClientRect();
                if (r.width > 0 && r.right > window.innerWidth + 1 && getComputedStyle(el).position !== 'fixed') {
                  out.over.push((el.className && String(el.className).slice(0, 40)) + ' @' + Math.round(r.right));
                  if (out.over.length >= 5) break;
                }
              }
              const cell = document.querySelector('[data-today-lunar]');
              out.lunar = cell ? { size: parseFloat(getComputedStyle(cell).fontSize), text: cell.innerText.trim() } : null;
              return out;
            }"""
        )
        check(cal["wide"] <= 0, "달력 가로 넘침 없음", str(cal["wide"]))
        check(not cal["over"], "달력 화면 밖으로 삐져나온 요소 없음", str(cal["over"][:2]))
        check(cal["lunar"] is not None and cal["lunar"]["size"] >= 17, "달력 상단 음력 날짜 글씨 17px 이상", str(cal["lunar"]))
        page.screenshot(path=f"{SHOT}/_typo_calendar.png")
        shots.append(f"{SHOT}/_typo_calendar.png")
        page.get_by_role("button", name="달력 닫기").click()
        page.wait_for_timeout(1200)

        # ---------- 랭킹 탭 (숫자) ----------
        page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name=re.compile("랭킹")).first.click()
        page.wait_for_timeout(2000)
        rank = page.evaluate(
            """() => {
              const n = document.querySelector('.t-num');
              const cs = n ? getComputedStyle(n) : null;
              return {
                wide: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                num: cs ? { size: parseFloat(cs.fontSize), weight: Number(cs.fontWeight), text: n.innerText.trim().slice(0, 12) } : null,
              };
            }"""
        )
        check(rank["wide"] <= 0, "랭킹 탭 가로 넘침 없음", str(rank["wide"]))
        check(
            rank["num"] is not None and abs(rank["num"]["size"] - 26) <= 1.2 and rank["num"]["weight"] == 700,
            "랭킹 숫자 26px·700",
            str(rank["num"]),
        )
        page.screenshot(path=f"{SHOT}/_typo_ranking.png")
        shots.append(f"{SHOT}/_typo_ranking.png")

        # ---------- 글씨 크게 모드 ----------
        page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name=re.compile("^홈")).first.click()
        page.wait_for_timeout(1200)
        page.get_by_role("button", name=re.compile("글씨 크게")).first.click()
        page.wait_for_timeout(1200)
        big = page.evaluate(
            """() => {
              const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
              const h = document.querySelector('h1.t-title');
              return { root, title: h ? parseFloat(getComputedStyle(h).fontSize) : null,
                       wide: document.documentElement.scrollWidth - document.documentElement.clientWidth };
            }"""
        )
        check(big["root"] >= 22 and (big["title"] or 0) >= 28, "‘글씨 크게’에서 더 커짐", str(big))
        check(big["wide"] <= 0, "글씨 크게에서도 가로 넘침 없음", str(big["wide"]))
        page.screenshot(path=f"{SHOT}/_typo_large.png")
        shots.append(f"{SHOT}/_typo_large.png")

        # 원래 크기로 되돌린다
        page.get_by_role("button", name=re.compile("글씨 더 크게")).first.click()
        page.wait_for_timeout(600)

        check(not [e for e in console_errors if "Notification" not in e], "콘솔 치명 오류 없음", str(console_errors[:2]))
        browser.close()

    try:
        from PIL import Image

        imgs = [Image.open(s) for s in shots]
        w = max(i.width for i in imgs)
        gap = 24
        h = sum(i.height for i in imgs) + gap * (len(imgs) - 1)
        canvas = Image.new("RGB", (w, h), "white")
        y = 0
        for im in imgs:
            canvas.paste(im, ((w - im.width) // 2, y))
            y += im.height + gap
        canvas.save(f"{SHOT}/neulbom_typography.png")
        print("saved", f"{SHOT}/neulbom_typography.png")
    except Exception as e:  # noqa: BLE001
        print("composite failed:", e)

    if not LOCAL:
        cleanup()
        print("테스트 계정 DB 정리 완료:", CODE_T)

    print("\n결과:", sum(results.values()), "/", len(results), "통과")
    if errors:
        print("실패:", errors)
        sys.exit(1)


if __name__ == "__main__":
    main()
