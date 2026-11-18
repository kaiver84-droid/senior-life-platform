"""모임 초대 → 중간 안내·미리보기 없이 **클릭과 같은 콜스택에서** 카카오톡 공유창 호출 점검.

라이브: BASE=https://senior-life-platform.pages.dev python3 e2e/check_direct_invite.py

- 카카오 SDK 는 스텁으로 바꿔 `Kakao.Share.sendDefault` 가 불린 시점을 기록한다.
  클릭 캡처 단계에서 `__clickStack = true` 로 두고 **마이크로태스크**에서 끄기 때문에,
  await 뒤(마이크로태스크·다음 작업)에 불렸다면 false 가 된다 → “동기 호출”을 실제로 구분한다.
- 페이지·API·Supabase 는 실제 라이브를 쓰고, 끝나면 테스트 계정이 만든 행을 DB 에서 지운다.
"""
import json
import os
import re
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", "https://senior-life-platform.pages.dev").rstrip("/")
SHOT = "/workspace/downloads"
FINAL_SHOT = f"{SHOT}/neulbom_direct_invite.png"
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")
TEST_GROUP = "직접초대 점검"
NICK = "초대점검"

results = {}
errors = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
    results[label] = bool(cond)
    if not cond:
        errors.append(label)


from test_kakao_onboarding import js_make_code, sql  # noqa: E402

ID_T = "777479103"
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


# 실제 카카오 SDK 대신 호출 시점을 기록하는 스텁
KAKAO_STUB_JS = """
window.__shareCalls = [];
window.__clickStack = false;
document.addEventListener('click', () => {
  window.__clickStack = true;
  // 클릭 처리의 동기 구간이 끝나는 즉시(마이크로태스크) 끈다 — await 뒤 호출이면 false 로 잡힌다
  queueMicrotask(() => { window.__clickStack = false; });
}, true);
window.Kakao = {
  isInitialized: () => true,
  init: () => {},
  Share: {
    sendDefault: (payload) => {
      const c = (payload && payload.content) || {};
      window.__shareCalls.push({
        inClickStack: window.__clickStack,
        title: c.title || '',
        description: c.description || '',
        link: (c.link && c.link.mobileWebUrl) || '',
        imageUrl: c.imageUrl || '',
        installTalk: payload ? payload.installTalk : null,
      });
      return Promise.resolve();
    },
  },
};
"""


def login(page):
    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.wait_for_selector("text=카카오톡으로 시작하기", timeout=40000)
    page.get_by_role("button", name="카카오톡으로 시작하기").click()
    page.wait_for_selector("#setup-nick", timeout=40000)
    page.fill("#setup-nick", NICK)
    page.select_option("#setup-birth", "1952")
    page.click('[data-birthtime="묘시"]')
    page.select_option("#setup-sido", "충청북도")
    page.select_option("#setup-sigungu", "옥천군")
    page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=40000)
    page.wait_for_timeout(2000)


def nav(page, label):
    page.get_by_role("navigation").get_by_role("button", name=label).click()


def share_calls(page):
    return page.evaluate("() => window.__shareCalls || []")


def main():
    cleanup()

    shots = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            locale="ko-KR",
            is_mobile=True,
            has_touch=True,
        )
        ctx.add_init_script(KAKAO_STUB_JS)
        page = ctx.new_page()
        console_errors = []
        http_errors = []
        page.on("pageerror", lambda e: console_errors.append(f"pageerror: {e}"))
        page.on("console", lambda m: console_errors.append(f"console: {m.text}") if m.type == "error" else None)
        page.on(
            "response",
            lambda r: http_errors.append(f"{r.status} {r.url}") if r.status >= 400 and "/api/auth/kakao" not in r.url else None,
        )
        page.route("**/api/auth/kakao**", kakao_stub())

        login(page)
        nav(page, "모임")
        page.wait_for_timeout(1800)

        # ---------- 1) 모임 만들기 → 초대 시트는 번호·버튼만 ----------
        page.get_by_role("button", name=re.compile("새 모임 만들기")).first.click()
        page.wait_for_selector("#group-name", timeout=20000)
        page.fill("#group-name", TEST_GROUP)
        page.get_by_role("button", name=re.compile("^모임 만들기|모임을 만드는 중")).last.click()

        page.wait_for_selector("[data-group-invite-sheet]", timeout=30000)
        page.wait_for_timeout(900)
        sheet = page.locator("[data-group-invite-sheet]").first
        sheet_text = sheet.inner_text()
        code_m = re.search(r"\b([A-Z0-9]{6})\b", sheet_text)
        new_code = code_m.group(1) if code_m else None
        check(bool(new_code), "생성 직후 초대 시트에 모임 번호", str(new_code))
        check("카카오톡으로 초대장 보내기" in sheet_text, "초대 시트에 카톡 보내기 버튼")
        check("초대 링크 복사" in sheet_text, "초대 시트에 링크 복사 버튼")
        for junk in ["정원", "한 모임은", "링크로 들어온 가족은", "가족·친구에게 링크를 보내면", "자동으로 이 모임에 들어옵니다"]:
            check(junk not in sheet_text, f"초대 시트 부연설명 제거: ‘{junk}’")
        check("?group=" not in sheet_text, "초대 시트에 긴 링크 주소 박스 없음")
        page.screenshot(path=f"{SHOT}/_direct_invite_sheet.png")
        shots.append(f"{SHOT}/_direct_invite_sheet.png")

        # ---------- 2) 시트의 TALK 버튼 → 미리보기 없이 동기 호출 ----------
        before = len(share_calls(page))
        sheet.get_by_role("button", name=re.compile("카카오톡으로 초대장 보내기")).click()
        page.wait_for_timeout(1200)
        calls = share_calls(page)
        check(len(calls) == before + 1, "초대 시트 TALK → sendDefault 1회", str(len(calls)))
        if calls:
            call = calls[-1]
            check(call["inClickStack"] is True, "초대 시트 TALK → 클릭 동기 콜스택에서 호출", str(call))
            check(bool(new_code) and f"?group={new_code}" in call["link"], "보낸 초대장 링크에 모임 번호", call["link"])
            check("ref=" in call["link"], "초대장 링크에 초대왕 ref 유지")
            check(TEST_GROUP in call["title"], "초대장 제목에 모임명", call["title"])
        check(page.locator("[data-share-sheet]").count() == 0, "공유 미리보기 시트가 열리지 않음")
        check("가족 단톡방에 이렇게 보여요" not in page.inner_text("body"), "미리보기·TIP 문구 없음")
        check(page.locator("[data-group-invite-sheet]").count() == 0, "보낸 뒤 초대 시트 닫힘")
        check("카카오톡이 열렸어요" in page.inner_text("body"), "한 줄 안내 토스트")

        # ---------- 3) 모임 탭의 모든 초대 버튼 → 바로 카톡 ----------
        page.wait_for_timeout(2600)  # 토스트 사라진 뒤
        page.evaluate("() => window.scrollTo(0, 0)")
        page.wait_for_timeout(300)

        def click_and_check(locator, label):
            before = len(share_calls(page))
            locator.first.click()
            page.wait_for_timeout(900)
            calls = share_calls(page)
            check(len(calls) == before + 1, f"{label} → sendDefault 1회", str(len(calls)))
            check(bool(calls) and calls[-1]["inClickStack"] is True, f"{label} → 클릭 동기 콜스택", str(calls[-1] if calls else ""))
            check(page.locator("[data-share-sheet]").count() == 0, f"{label} → 미리보기 없음")
            check(page.locator("[data-group-invite-sheet]").count() == 0, f"{label} → 중간 시트 없음")
            page.evaluate("() => window.scrollTo(0, 0)")
            page.wait_for_timeout(200)

        click_and_check(page.locator("[data-group-invite-top]"), "상단 💌 초대")
        page.screenshot(path=f"{SHOT}/_direct_invite_top_click.png")
        shots.append(f"{SHOT}/_direct_invite_top_click.png")
        click_and_check(page.locator("[data-group-row-invite]"), "내 모임 줄 💌 초대")
        click_and_check(page.get_by_role("button", name=re.compile("카카오톡으로 바로 초대하기")), "1인 모임 바로 초대")
        click_and_check(page.get_by_role("button", name=re.compile("카카오톡으로 우리 모임 초대하기")), "모임 초대 큰 버튼")

        # ---------- 4) 오류 없음 ----------
        hard = [e for e in console_errors if "pageerror" in e]
        check(not hard, "콘솔 치명 오류 0건", str(hard[:3]))
        check(not http_errors, "HTTP 400 이상 0건", str(http_errors[:3]))

        browser.close()

    # --- 한 장으로 합치기 ---
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
