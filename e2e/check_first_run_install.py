"""첫 사용자(온보딩 직후) 앱 설치 유도 점검 — 아이폰·안드로이드·카톡·이미 앱 설치(standalone).

라이브: BASE=https://senior-life-platform.pages.dev python3 e2e/check_first_run_install.py

- 카카오 인가만 Playwright 라우팅으로 흉내 내고 페이지·API·Supabase 는 실제 라이브를 쓴다.
- ① 아이폰 사파리: 온보딩 직후 설치 안내가 한 번 자동으로 뜨고, 공유(□↑) → 홈 화면에 추가 단계가 보인다
- ② ‘나중에 보기’로 닫으면 새로고침해도 다시 자동으로 뜨지 않는다(배너도 사라짐)
- ③ 안드로이드: beforeinstallprompt 가 잡히면 원터치 ‘늘봄 앱 바로 설치하기’ 버튼이 보이고 눌리면 설치 팝업이 뜬다
- ④ 카톡 인앱브라우저: ‘카카오톡 안에서는 설치 메뉴가 없어요’ + ‘Safari로 열기’ 안내
- ⑤ 이미 홈 화면 앱(standalone)으로 열면 자동 안내가 뜨지 않는다
끝나면 테스트 계정이 만든 행을 DB 에서 지운다.
"""
import json
import os
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", "https://senior-life-platform.pages.dev").rstrip("/")
SHOT = "/workspace/downloads"
FINAL_SHOT = f"{SHOT}/neulbom_first_run_install.png"
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")
NICK = "설치점검"

UA_IOS = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
)
UA_ANDROID = (
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0.0.0 Mobile Safari/537.36"
)
UA_KAKAO = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.5.0"
)

results = {}
errors = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
    results[label] = bool(cond)
    if not cond:
        errors.append(label)


from test_kakao_onboarding import js_make_code, sql  # noqa: E402

ID_T = "777479104"
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


def login(page):
    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.wait_for_selector("text=카카오톡으로 시작하기", timeout=45000)
    page.get_by_role("button", name="카카오톡으로 시작하기").click()
    # 처음 계정이면 초기 설정, 이미 끝난 계정이면 바로 홈으로 온다
    try:
        page.wait_for_selector("#setup-nick", timeout=9000)
    except Exception:  # noqa: BLE001
        pass
    if page.locator("#setup-nick").count():
        page.fill("#setup-nick", NICK)
        page.select_option("#setup-birth", "1952")
        page.click('[data-birthtime="묘시"]')
        page.select_option("#setup-sido", "충청북도")
        page.select_option("#setup-sigungu", "옥천군")
        page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=45000)


def new_page(browser, ua, standalone=False):
    ctx = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=2,
        locale="ko-KR",
        is_mobile=True,
        has_touch=True,
        user_agent=ua,
    )
    if standalone:
        # 이미 홈 화면에 추가한 앱처럼 보이게(아이폰 standalone)
        ctx.add_init_script(
            "Object.defineProperty(navigator, 'standalone', { get: () => true });"
            "const mm = window.matchMedia.bind(window);"
            "window.matchMedia = (q) => (q.includes('display-mode: standalone') ? { matches: true, media: q, addEventListener(){}, removeEventListener(){} } : mm(q));"
        )
    ctx.route("**/api/auth/kakao**", kakao_stub())
    page = ctx.new_page()
    js_errors = []
    page.on("pageerror", lambda e: js_errors.append(str(e)))
    return ctx, page, js_errors


def guide_text(page):
    return page.locator("[data-install-guide]").first.inner_text()


def main():
    cleanup()
    shots = []

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

        # ---------- ① 아이폰 사파리: 온보딩 직후 자동 안내 ----------
        ctx, page, js_errors = new_page(browser, UA_IOS)
        login(page)
        shown = False
        try:
            page.wait_for_selector("[data-install-guide]", timeout=15000)
            shown = True
        except Exception:  # noqa: BLE001
            pass
        check(shown, "아이폰: 온보딩 직후 설치 안내 자동 노출")
        if shown:
            page.wait_for_timeout(400)
            platform = page.locator("[data-install-guide]").first.get_attribute("data-platform")
            body = guide_text(page)
            check(platform == "ios", "아이폰: data-platform=ios", str(platform))
            check("공유" in body and "홈 화면에 추가" in body, "아이폰: 공유(□↑) → 홈 화면에 추가 안내")
            check("나중에 보기" in body, "아이폰: ‘나중에 보기’로 바로 넘길 수 있음")
            check(page.locator("[data-install-banner]").count() == 0, "아이폰: 배너 중복 노출 없음")
            page.screenshot(path=f"{SHOT}/_install_ios.png")
            shots.append(f"{SHOT}/_install_ios.png")

            # ---------- ② 나중에 보기 → 다시 자동 노출 안 됨 ----------
            page.get_by_role("button", name="나중에 보기").click()
            page.wait_for_timeout(600)
            check(page.locator("[data-install-guide]").count() == 0, "아이폰: ‘나중에 보기’로 닫힘")
            seen = page.evaluate("() => localStorage.getItem('neulbom.installGuide.seen.v1')")
            check(seen == "1", "아이폰: 한 번 봄 기록 저장", str(seen))

            page.reload(wait_until="domcontentloaded")
            page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=45000)
            page.wait_for_timeout(4000)
            check(page.locator("[data-install-guide]").count() == 0, "아이폰: 새로고침해도 자동 노출 없음")
            check(page.locator("[data-install-banner]").count() == 0, "아이폰: 설치 배너도 다시 뜨지 않음")

            # 더보기에서 직접 열기는 계속 가능
            page.get_by_role("navigation").get_by_role("button", name="더보기").click()
            page.wait_for_timeout(600)
            row = page.locator("[data-install-row]").first
            check(row.count() > 0, "더보기: 설치 안내 줄 있음")
            if row.count():
                row.click()
                page.wait_for_timeout(700)
                check(page.locator("[data-install-guide]").count() == 1, "더보기에서 직접 열기 가능")
                page.keyboard.press("Escape")
        check(not js_errors, "아이폰: 자바스크립트 오류 없음", str(js_errors[:2]))
        ctx.close()

        # ---------- ③ 안드로이드: beforeinstallprompt 원터치 ----------
        ctx, page, js_errors = new_page(browser, UA_ANDROID)
        login(page)
        page.evaluate(
            """() => {
                const e = new Event('beforeinstallprompt');
                e.prompt = () => { window.__installPrompted = true; return Promise.resolve(); };
                e.userChoice = Promise.resolve({ outcome: 'accepted' });
                window.dispatchEvent(e);
            }"""
        )
        page.wait_for_selector("[data-install-guide]", timeout=15000)
        page.wait_for_timeout(500)
        platform = page.locator("[data-install-guide]").first.get_attribute("data-platform")
        check(platform == "android", "안드로이드: data-platform=android", str(platform))
        native = page.locator("[data-install-native]")
        check(native.count() == 1, "안드로이드: 원터치 설치 안내 노출")
        if native.count():
            label = native.inner_text()
            check("늘봄 앱 바로 설치하기" in label, "안드로이드: ‘늘봄 앱 바로 설치하기’ 버튼", label.replace("\n", " ")[:50])
            page.screenshot(path=f"{SHOT}/_install_android.png")
            shots.append(f"{SHOT}/_install_android.png")
            page.get_by_role("button", name="늘봄 앱 바로 설치하기").click()
            page.wait_for_timeout(1200)
            check(page.evaluate("() => window.__installPrompted === true"), "안드로이드: 버튼 누르면 설치 팝업 호출")
            check(page.locator("[data-install-guide]").count() == 0, "안드로이드: 설치 수락 뒤 안내 닫힘")
        check(not js_errors, "안드로이드: 자바스크립트 오류 없음", str(js_errors[:2]))
        ctx.close()

        # ---------- ④ 카톡 인앱브라우저 ----------
        ctx, page, js_errors = new_page(browser, UA_KAKAO)
        login(page)
        page.wait_for_selector("[data-install-guide]", timeout=15000)
        page.wait_for_timeout(500)
        platform = page.locator("[data-install-guide]").first.get_attribute("data-platform")
        body = guide_text(page)
        check(platform == "kakao", "카톡 인앱: data-platform=kakao", str(platform))
        check("카카오톡 안에서는 설치 메뉴가 없어요" in body, "카톡 인앱: 다른 브라우저로 열기 안내")
        check(page.get_by_role("button", name="Safari로 열기").count() == 1, "카톡 인앱: ‘Safari로 열기’ 버튼")
        page.screenshot(path=f"{SHOT}/_install_kakao.png")
        shots.append(f"{SHOT}/_install_kakao.png")
        check(not js_errors, "카톡 인앱: 자바스크립트 오류 없음", str(js_errors[:2]))
        ctx.close()

        # ---------- ⑤ 이미 홈 화면 앱(standalone) ----------
        ctx, page, js_errors = new_page(browser, UA_IOS, standalone=True)
        login(page)
        page.wait_for_timeout(4500)
        check(page.locator("[data-install-guide]").count() == 0, "standalone: 자동 설치 안내 없음")
        check(page.locator("[data-install-banner]").count() == 0, "standalone: 설치 배너 없음")
        check(not js_errors, "standalone: 자바스크립트 오류 없음", str(js_errors[:2]))
        ctx.close()

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
        canvas.save(FINAL_SHOT)
        print("saved", FINAL_SHOT)
    except Exception as e:  # noqa: BLE001
        print("composite failed:", e)

    cleanup()
    print("테스트 계정 DB 정리 완료:", CODE_T)

    print("\n결과:", sum(results.values()), "/", len(results), "통과")
    if errors:
        print("실패:", errors)
        sys.exit(1)


if __name__ == "__main__":
    main()
