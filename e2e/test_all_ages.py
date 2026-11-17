"""전 연령(10대 이하~80대 이상) 연령대·출생연도 확장 검증 — 로컬 out/ 또는 라이브.

BASE=https://senior-life-platform.pages.dev python3 e2e/test_all_ages.py   # 라이브(카카오 스텁 로그인)
python3 e2e/test_all_ages.py                                              # 로컬 out/

확인 항목
1) 초기 설정의 '태어난 해'가 1926~2020년 전 연령(95개)이고 2012년(10대 이하)으로 가입이 된다
2) 랭킹 🎂 연령대 탭에 8개(10대 이하·20대 … 80대 이상) 칩이 390px 화면에서 잘리지 않고 4×2로 보인다
3) 8개 연령대를 모두 눌러도 빈 화면·오류 없이 시상대와 내 순위 카드가 나온다
4) 다른 연령대를 볼 때는 '내 연령대 순위' 안내가 나온다
5) ⚙ 설정에서 2020년생으로 바꿔도 저장되고, 복지 화면이 나이에 맞는 혜택을 보여 준다
"""
import json
import os
import sys
import urllib.request

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from harness import PORT, start_server  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", f"http://127.0.0.1:{PORT}").rstrip("/")
LOCAL = BASE.startswith("http://127.0.0.1")
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")
os.environ.setdefault(
    "LD_LIBRARY_PATH", "/workspace/.libs/usr/lib/x86_64-linux-gnu:/workspace/work/.tools/browser-libs"
)
SHOT = "/workspace/downloads"
SHOT_NAME = os.environ.get("SHOT_NAME", "neulbom_all_ages" + ("_local" if LOCAL else ""))
NAME = os.environ.get("NAME", "새싹이")
BIRTH = os.environ.get("BIRTH", "2012")
KAKAO_ID = os.environ.get("KAKAO_ID", "777010777")
BANDS = [
    (10, "10대 이하"),
    (20, "20대"),
    (30, "30대"),
    (40, "40대"),
    (50, "50대"),
    (60, "60대"),
    (70, "70대"),
    (80, "80대 이상"),
]

results = {}
errors = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
    results[label] = bool(cond)
    if not cond:
        errors.append(label)


def api_json(path):
    with urllib.request.urlopen(BASE + path, timeout=25) as r:
        return json.loads(r.read().decode())


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
                        "nickname": NAME,
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


def main():
    httpd = None
    if LOCAL:
        httpd = start_server()
    page_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=3,
            locale="ko-KR",
            is_mobile=True,
            has_touch=True,
        )
        page = ctx.new_page()
        page.on("pageerror", lambda e: page_errors.append(f"pageerror: {e}"))
        page.on(
            "console",
            lambda m: page_errors.append(f"error: {m.text}")
            if m.type == "error" and "/api/" not in (m.location or {}).get("url", "")
            else None,
        )

        if LOCAL:
            page.goto(BASE + "/", wait_until="domcontentloaded")
            page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
            page.get_by_role("button", name="카카오 없이 둘러보기 (개발용)").click()
        else:
            page.route("**/t1.kakaocdn.net/**", lambda route, _req: route.abort())
            page.route("**/api/auth/kakao**", kakao_stub)
            page.goto(BASE + "/", wait_until="domcontentloaded")
            page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
            page.get_by_role("button", name="카카오톡으로 시작하기").click()

        page.wait_for_selector("#setup-nick", timeout=30000)

        # 1) 태어난 해 선택 범위 — 전 연령
        years = page.eval_on_selector_all("#setup-birth option", "els => els.map(e => e.value)")
        check(len(years) == 95, "태어난 해 선택지 95개(1926~2020)", f"n={len(years)}")
        check(years[0] == "1926" and years[-1] == "2020", "범위가 1926~2020", f"{years[0]}~{years[-1]}")
        check(all(y in years for y in ["1986", "1995", "2012", "2020"]), "1986·1995·2012·2020 선택 가능")

        page.fill("#setup-nick", NAME)
        page.select_option("#setup-birth", BIRTH)
        page.click('[data-birthtime="모름"]')
        page.select_option("#setup-sido", "충청북도")
        page.select_option("#setup-sigungu", "옥천군")
        page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
        page.wait_for_timeout(2500)
        check(True, "2012년생(10대 이하)으로 가입·초기 설정 저장 완료")
        check(page.get_by_text(NAME).first.is_visible(), "홈에 이름 표시")

        # 2) 랭킹 🎂 연령대 탭
        page.get_by_role("navigation").get_by_role("button", name="랭킹", exact=True).click()
        page.wait_for_selector("[data-range-tab='age']", timeout=20000)
        page.click("[data-range-tab='age']")
        page.wait_for_selector("[data-age-bands]", timeout=15000)
        page.wait_for_timeout(1200)

        chips = page.eval_on_selector_all(
            "[data-age-band]",
            "els => els.map(e => ({ b: e.getAttribute('data-age-band'), t: e.innerText.trim(), "
            "w: Math.round(e.getBoundingClientRect().width), r: Math.round(e.getBoundingClientRect().right), "
            "y: Math.round(e.getBoundingClientRect().top), "
            "clip: e.scrollWidth > e.clientWidth + 1, pressed: e.getAttribute('aria-pressed') }))",
        )
        check(len(chips) == 8, "연령대 칩 8개", f"n={len(chips)}")
        labels = [c["t"] for c in chips]
        check(labels == [b[1] for b in BANDS], "칩 이름이 10대 이하~80대 이상 순서", str(labels))
        check(all(not c["clip"] for c in chips), "칩 글자가 잘리지 않음", str([c["t"] for c in chips if c["clip"]]))
        check(all(c["r"] <= 390 for c in chips), "칩이 390px 화면 밖으로 넘치지 않음", str([(c["t"], c["r"]) for c in chips if c["r"] > 390]))
        rows_y = sorted({c["y"] for c in chips})
        check(
            len(rows_y) == 2 and chips[0]["y"] == chips[3]["y"] and chips[4]["y"] == chips[7]["y"],
            "칩이 4×2(두 줄)로 배치",
            f"y={rows_y}",
        )
        no_overflow = page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
        check(no_overflow, "연령대 탭 가로 스크롤 없음")
        check(any(c["b"] == "10" and c["pressed"] == "true" for c in chips), "내 연령대(10대 이하)가 기본 선택")

        # 3) 8개 연령대 모두 — 빈 화면·오류 없이
        for band, label in BANDS:
            page.click(f"[data-age-band='{band}']")
            page.wait_for_selector("[data-area-board] [data-podium]", timeout=15000)
            page.wait_for_timeout(900)
            body = page.inner_text("body")
            rows = page.locator("[data-area-board] [data-rank-me]").count()
            podium_ok = "명예의 전당" in body
            has_rank = rows >= 1
            check(podium_ok and has_rank, f"{label} 순위표 표시", f"내순위카드={rows}")
            if band != 10:
                check(
                    f"지금은 {label} 순위표예요" in body and "내 연령대(10대 이하)" in body,
                    f"{label} — 내 연령대 안내 문구",
                )
            if band == 20:
                sample_names = page.eval_on_selector_all(
                    "[data-area-board] [data-podium] *",
                    "els => els.map(e => e.innerText || '').filter(t => /^[가-힣]○[가-힣]{2}$/.test(t.trim()))",
                )
                check(len(sample_names) >= 1, "20대 순위표에 예시 참여자 표시", f"n={len(sample_names)}")

        # 대표 스크린샷 — 연령대 탭 + 내 연령대 순위표
        page.click("[data-age-band='10']")
        page.wait_for_timeout(1200)
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(300)
        shot = f"{SHOT}/{SHOT_NAME}.png"
        page.screenshot(path=shot, full_page=True)
        print(f"  스크린샷: {shot}")

        # 4) ⚙ 설정 — 2020년생으로 고치기
        page.get_by_role("button", name="설정").click()
        page.wait_for_timeout(700)
        page.get_by_role("button", name="내 정보 고치기").click()
        page.wait_for_timeout(700)
        years2 = page.eval_on_selector_all("#edit-birth option", "els => els.map(e => e.value)")
        check(len(years2) == 95 and years2[-1] == "2020", "내 정보 고치기도 2020년까지", f"n={len(years2)}")
        page.select_option("#edit-birth", "2020")
        save_btn = page.get_by_role("button", name="저장", exact=True)
        save_btn.scroll_into_view_if_needed()
        page.wait_for_timeout(300)
        save_btn.click()
        page.wait_for_timeout(1400)
        check("2020년생" in page.inner_text("body"), "설정 저장 후 2020년생으로 표시")
        page.keyboard.press("Escape")
        page.wait_for_timeout(700)

        # 5) 복지 화면 — 2020년생(6세)도 오류 없이 안내
        page.get_by_role("navigation").get_by_role("button", name="혜택", exact=True).click()
        page.wait_for_timeout(1800)
        body = page.inner_text("body")
        check("2020년생" in body, "복지 화면에 2020년생(6세) 기준 표시", [l for l in body.splitlines() if "년생" in l][:1])
        check("지금 나이에 맞는 혜택을 먼저" in body, "10대 이하용 안내 문구")
        check("내가 받을 수 있는 복지 한 번에 찾기" in body, "10대 이하 대표 혜택 노출")
        check("40·50대는" not in body, "10대 이하에는 40·50대 문구가 없음")

        # 6) 라이브 API — 8개 연령대 모두 응답
        if not LOCAL:
            for band, label in BANDS:
                try:
                    j = api_json(
                        f"/api/rankings?area=all&range=age&band={band}&weekId=2026-W47&today=2026-11-18"
                        "&sido=%EC%B6%A9%EC%B2%AD%EB%B6%81%EB%8F%84&sigungu=%EC%98%A5%EC%B2%9C%EA%B5%B0&birthYear=2012"
                    )
                    ok = bool(j.get("ok")) and isinstance(j.get("rows"), list) and len(j["rows"]) >= 3
                    check(ok, f"라이브 API band={band}({label}) 응답", f"rows={len(j.get('rows') or [])} total={j.get('total')}")
                except Exception as e:  # noqa: BLE001
                    check(False, f"라이브 API band={band}({label}) 응답", f"EXC {e}")

        browser.close()
    if httpd:
        httpd.shutdown()

    real_errors = [e for e in page_errors if "Failed to load resource" not in e and "t1.kakaocdn.net" not in e]
    check(len(real_errors) == 0, "콘솔/페이지 오류 0건", "; ".join(real_errors[:3]))
    print(f"\n결과: {sum(1 for v in results.values() if v)}/{len(results)} 통과")
    if errors:
        print("실패:", ", ".join(errors))
        sys.exit(1)


if __name__ == "__main__":
    main()
