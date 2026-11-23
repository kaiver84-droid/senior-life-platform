"""새 초고화질 안부 인사카드(크리스마스 포함 5종) 검증 · 완성 카드 이미지 저장.

확인 항목
1. 카드 고르기 줄에 새 테마 5종(크리스마스·황금 해돋이·모란·숲속 산책길·한옥 찻잔)이 있고 눌러서 고를 수 있다
2. 고른 테마가 실제 `renderGreetingCard` 로 그려진다 — 흰 인사말 카드 위에 이름·문구가 얹힌 1080×1350 PNG 를 저장
3. 카드 고르기 줄이 옆으로 넘겨지고(스크롤), 화면(390px)은 가로로 넘치지 않는다 — 글씨 18px · ‘아주 크게’ 24px 둘 다
4. 크리스마스 테마에서 성탄 인사 문구 칩이 함께 보인다
5. [카톡으로 보내기] → 1200×630 카드에 **그 카드 그대로** 담기고, /api/share-image 로 올린 주소가 payload.imageUrl 로 쓰인다(라이브에서만)

실행
    python3 e2e/verify_greeting_new_cards.py            # 로컬 out/ (그리기·넘침·문구)
    BASE=https://senior-life-platform.pages.dev python3 e2e/verify_greeting_new_cards.py
"""
import base64
import json
import os
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

LIVE = os.environ.get("BASE", "").strip()
BASE = LIVE.rstrip("/") if LIVE else "http://127.0.0.1:8099"
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")
OUT = os.environ.get("OUT", "/workspace/downloads")
TAG = "live" if LIVE else "local"

NEW_THEMES = [
    ("christmas", "크리스마스"),
    ("golden_sunrise", "황금 해돋이"),
    ("peony", "모란 꽃다발"),
    ("autumn_path", "숲속 산책길"),
    ("hanok_tea", "한옥 찻잔"),
]

PROFILE = {
    "id": "kakao_999000777",
    "nickname": "김순자",
    "birthYear": 1952,
    "birthTime": "묘시",
    "sido": "충청북도",
    "sigungu": "옥천군",
    "createdAt": "2026-11-01T00:00:00.000Z",
    "source": "kakao",
    "profileCompleted": True,
}


def state(font_size=18):
    return {
        "version": 1,
        "profile": PROFILE,
        "quizLogs": [],
        "daily": None,
        "med": {},
        "visits": [],
        "familyEvents": [],
        "health": {},
        "fontSize": font_size,
        "lastVisit": "",
    }


KAKAO_STUB = """
(() => {
  window.__kakaoCalls = [];
  const Kakao = {
    isInitialized: () => true,
    init: () => {},
    Auth: { authorize: () => {} },
    Share: { sendDefault: (payload) => { window.__kakaoCalls.push({ payload }); return Promise.resolve({}); } },
  };
  Object.defineProperty(window, 'Kakao', { value: Kakao, configurable: true, writable: true });
  try { localStorage.setItem('seniorLife.v1', %s); } catch (e) {}
})();
"""


def save_data_url(data_url, path):
    head, b64 = data_url.split(",", 1)
    with open(path, "wb") as f:
        f.write(base64.b64decode(b64))
    return os.path.getsize(path)


def main():
    ok = True
    errors, bad_responses = [], []

    def check(name, cond, detail=""):
        nonlocal ok
        print(("PASS " if cond else "FAIL ") + name + (f" — {detail}" if detail else ""))
        if not cond:
            ok = False

    os.makedirs(OUT, exist_ok=True)
    httpd = None
    if not LIVE:
        from harness import start_server

        httpd = start_server()

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

        def open_ctx(font_size):
            ctx = browser.new_context(
                viewport={"width": 390, "height": 844}, device_scale_factor=3, locale="ko-KR",
                is_mobile=True, has_touch=True,
            )
            ctx.add_init_script(KAKAO_STUB % json.dumps(json.dumps(state(font_size))))
            return ctx

        # ---------- 1) 기본 글씨(18px) — 고르기·그리기·넘침 ----------
        ctx = open_ctx(18)
        page = ctx.new_page()
        uploads = []

        def watch(resp):
            if "/api/share-image" in resp.url and resp.request.method == "POST":
                try:
                    body = resp.json()
                except Exception:
                    body = {}
                uploads.append({"status": resp.status, "url": body.get("url", ""), "ok": body.get("ok")})

        page.on("console", lambda m: errors.append(f"{m.type}: {m.text[:200]}") if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on("response", lambda r: bad_responses.append(f"{r.status} {r.url[:110]}") if r.status >= 400 else None)
        page.on("response", watch)

        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=45000)
        page.wait_for_timeout(1500)
        page.locator("[data-home-greeting]").first.click()
        page.wait_for_selector("[data-greeting-card]", timeout=15000)
        page.wait_for_timeout(2000)

        # 고르기 줄에 새 테마가 모두 있는지
        for key, label in NEW_THEMES:
            chip = page.locator(f'[data-greeting-theme="{key}"]')
            check(f"고르기 칸 있음 · {label}", chip.count() == 1 and label in chip.first.inner_text(), chip.first.inner_text() if chip.count() else "없음")

        strip = page.locator('[aria-label="카드 그림 고르기"]')
        metrics = page.evaluate(
            """() => {
              const el = document.querySelector('[aria-label="카드 그림 고르기"]');
              const doc = document.documentElement;
              return {
                strip: el ? { w: el.clientWidth, sw: el.scrollWidth } : null,
                pageW: doc.scrollWidth, winW: window.innerWidth,
                bodyW: document.body.scrollWidth,
              };
            }"""
        )
        check("고르기 줄은 옆으로 넘어간다(스크롤 가능)", metrics["strip"] and metrics["strip"]["sw"] > metrics["strip"]["w"] + 4,
              str(metrics["strip"]))
        check("화면 가로 넘침 없음(18px)", metrics["pageW"] <= metrics["winW"] + 1, f"page {metrics['pageW']} / win {metrics['winW']}")

        page.screenshot(path=f"{OUT}/neulbom_greeting_new_theme_chips_{TAG}.png")
        chip_box = page.locator('[aria-label="카드 그림 고르기"]')
        chip_box.screenshot(path=f"{OUT}/neulbom_greeting_new_theme_strip_{TAG}.png")

        # 새 카드 5종을 차례로 골라 완성 카드(1080×1350) 저장
        for key, label in NEW_THEMES:
            page.locator(f'[data-greeting-theme="{key}"]').first.click()
            page.wait_for_timeout(1200)
            # 카드 그리기가 끝났는지: '카드를 그리는 중…' 이 사라질 때까지
            try:
                page.wait_for_selector("text=카드를 그리는 중…", state="detached", timeout=15000)
            except Exception:
                pass
            page.wait_for_timeout(400)
            data_url = page.evaluate(
                """() => { const c = document.querySelector('[data-greeting-card]'); return c ? c.toDataURL('image/png') : ''; }"""
            )
            path = f"{OUT}/neulbom_card_{key}_{TAG}.png"
            size = save_data_url(data_url, path) if data_url else 0
            dims = page.evaluate(
                """() => { const c = document.querySelector('[data-greeting-card]'); return c ? [c.width, c.height] : [0, 0]; }"""
            )
            check(f"완성 카드 그려짐 · {label}", size > 60000 and dims == [1080, 1350], f"{dims} {size // 1024}KB {path}")

        # 크리스마스 문구 칩
        page.locator('[data-greeting-theme="christmas"]').first.click()
        page.wait_for_timeout(400)
        chips = page.locator("text=메리 크리스마스! 행복한 연말 보내세요")
        check("크리스마스 추천 문구 칩 보임", chips.count() >= 1, f"{chips.count()}개")
        msg_value = page.locator("#msg").input_value()
        check("크리스마스 카드 고르면 기본 문구가 성탄 인사로", "크리스마스" in msg_value, msg_value)
        page.wait_for_timeout(900)
        page.screenshot(path=f"{OUT}/neulbom_greeting_christmas_sheet_{TAG}.png")

        # ---------- 2) 카톡 공유: 그 카드가 그대로 1200×630 에 담기고 업로드 주소를 쓴다 ----------
        page.get_by_role("button", name="카톡으로 보내기").first.click()
        page.wait_for_selector("[data-share-sheet]", timeout=15000)
        page.wait_for_timeout(3000)
        framed = page.evaluate(
            """() => { const c = document.querySelector('[data-share-preview] canvas'); return c ? c.toDataURL('image/png') : ''; }"""
        )
        path = f"{OUT}/neulbom_share_framed_christmas_{TAG}.png"
        fsize = save_data_url(framed, path) if framed else 0
        fdims = page.evaluate(
            """() => { const c = document.querySelector('[data-share-preview] canvas'); return c ? [c.width, c.height] : [0, 0]; }"""
        )
        check("공유 카드(1200×630)에 내 카드가 담김", fsize > 20000 and fdims == [1200, 630], f"{fdims} {fsize // 1024}KB {path}")
        page.screenshot(path=f"{OUT}/neulbom_share_preview_christmas_{TAG}.png")

        if LIVE:
            page.get_by_role("button", name="카카오톡으로 바로 보내기").first.click()
            page.wait_for_timeout(1500)
            calls = page.evaluate("window.__kakaoCalls") or []
            check("카톡 sendDefault 호출", len(calls) >= 1, f"{len(calls)}회")
            if calls:
                img = str(calls[0]["payload"].get("content", {}).get("imageUrl", ""))
                check("보낸 카드 imageUrl = 올려 둔 그 카드", "/api/share-image?k=greeting&h=" in img, img)
                check("업로드 성공(200)", bool(uploads) and uploads[-1]["status"] == 200 and uploads[-1]["ok"] is True, str(uploads[-1] if uploads else None))
                check("업로드 주소와 payload 일치", bool(uploads) and img == uploads[-1]["url"], f"upload={uploads[-1]['url'] if uploads else None}")

        ctx.close()

        # ---------- 3) ‘아주 크게’(24px)에서 가로 넘침 ----------
        ctx2 = open_ctx(24)
        page2 = ctx2.new_page()
        page2.on("console", lambda m: errors.append(f"[big] {m.type}: {m.text[:200]}") if m.type == "error" else None)
        page2.on("pageerror", lambda e: errors.append(f"[big] pageerror: {e}"))
        page2.goto(BASE + "/", wait_until="domcontentloaded")
        page2.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=45000)
        page2.wait_for_timeout(1500)
        page2.locator("[data-home-greeting]").first.click()
        page2.wait_for_selector("[data-greeting-card]", timeout=15000)
        page2.wait_for_timeout(1800)
        m2 = page2.evaluate(
            """() => {
              const el = document.querySelector('[aria-label="카드 그림 고르기"]');
              const doc = document.documentElement;
              const chip = document.querySelector('[data-greeting-theme="christmas"]');
              const cs = chip ? getComputedStyle(chip) : null;
              return {
                strip: el ? { w: el.clientWidth, sw: el.scrollWidth } : null,
                pageW: doc.scrollWidth, winW: window.innerWidth, bodyW: document.body.scrollWidth,
                root: parseFloat(getComputedStyle(doc).fontSize),
                chipW: chip ? chip.getBoundingClientRect().width : 0,
              };
            }"""
        )
        check("글씨가 실제로 커졌다(24px)", m2["root"] >= 23, f"{m2['root']}px")
        check("화면 가로 넘침 없음(아주 크게)", m2["pageW"] <= m2["winW"] + 1, f"page {m2['pageW']} / win {m2['winW']} / body {m2['bodyW']}")
        check("아주 크게에서도 칸이 잘리지 않음", m2["chipW"] >= 100, f"{round(m2['chipW'])}px")
        # 칸 안 글씨가 칸 밖으로 넘지 않는지(마지막 칸 기준)
        overflow_txt = page2.evaluate(
            """() => {
              const out = [];
              document.querySelectorAll('[data-greeting-theme]').forEach((b) => {
                const label = b.lastElementChild;
                if (label && label.scrollWidth > label.clientWidth + 1) out.push(b.dataset.greetingTheme + ':' + label.scrollWidth + '>' + label.clientWidth);
              });
              return out;
            }"""
        )
        check("이름표가 칸 밖으로 넘치지 않음", not overflow_txt, ", ".join(overflow_txt) or "0건")
        page2.screenshot(path=f"{OUT}/neulbom_greeting_theme_strip_big_{TAG}.png")
        page2.locator('[data-greeting-theme="christmas"]').first.click()
        page2.wait_for_timeout(1500)
        page2.screenshot(path=f"{OUT}/neulbom_greeting_christmas_big_{TAG}.png")
        ctx2.close()
        browser.close()

    if httpd:
        httpd.shutdown()

    # 로컬 정적 서버에는 Pages Functions(/api/*)가 없어 404 가 나는 것이 정상이다 — 라이브에서만 본다.
    def env_noise(text):
        t = text.lower()
        return "favicon" in t or (not LIVE and ("/api/" in t or "404" in t or "501" in t))

    real = [e for e in errors if not env_noise(e)]
    check("콘솔 오류 없음", not real, "; ".join(real[:3]))
    failed = [r for r in bad_responses if "/_next/static" not in r and (LIVE or "/api/" not in r)]
    check("실패한 요청 없음(4xx·5xx)", not failed, "; ".join(failed[:4]))

    print("\nRESULT:", "PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
