"""늘봄 라이브 E2E — 전체 사용자 여정을 390×844·DPR3 모바일에서 실제로 눌러 본다.

BASE=https://senior-life-platform.pages.dev python3 e2e/audit_deep.py
결과: /workspace/tool-results/audit-deep.json + downloads/neulbom_audit/*.png
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", "https://senior-life-platform.pages.dev").rstrip("/")
SHOT = "/workspace/downloads/neulbom_audit"
os.makedirs(SHOT, exist_ok=True)
KAKAO_ID = os.environ.get("AUDIT_KAKAO_ID", "999000111")
STUB_CODE = "AUDIT-CODE-0001"

console_errors = []
page_errors = []
http_fails = []
failed_requests = []
results = []
notes = []


def check(name, fn, detail=""):
    t0 = time.time()
    try:
        ok, info = fn()
    except Exception as e:  # noqa: BLE001
        ok, info = False, f"EXC {type(e).__name__}: {str(e)[:220]}"
    results.append({"name": name, "ok": bool(ok), "info": str(info)[:600], "ms": int((time.time() - t0) * 1000), "pre": detail})
    print(("PASS " if ok else "FAIL ") + name + " — " + str(info)[:200])
    return ok


def attach(page):
    page.on("console", lambda m: console_errors.append(f"{m.type}: {m.text[:300]}") if m.type == "error" else None)
    page.on("pageerror", lambda e: page_errors.append(str(e)[:300]))
    page.on("response", lambda r: http_fails.append(f"{r.status} {r.request.method} {r.url[:120]}") if r.status >= 400 else None)
    page.on(
        "requestfailed",
        lambda r: failed_requests.append(f"{r.failure} {r.url[:120]}")
        if "cancelled" not in str(r.failure).lower() and "ERR_ABORTED" not in str(r.failure)
        else None,
    )


def stub_kakao(page):
    def _kakao(route, request):
        if "start=1" in request.url:
            route.fulfill(status=302, headers={"location": f"/?code={STUB_CODE}"})
        elif request.method == "POST":
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(
                    {
                        "ok": True,
                        "profile": {
                            "id": f"kakao_{KAKAO_ID}",
                            "nickname": "점검테스트",
                            "birthYear": 1952,
                            "avatarUrl": "",
                            "source": "kakao",
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
                        "redirectUri": BASE,
                    }
                ),
            )

    page.route("**/api/auth/kakao**", _kakao)
    page.route(
        "**kauth.kakao.com/**",
        lambda route, request: route.fulfill(status=302, headers={"location": f"{BASE}/?code={STUB_CODE}"}),
    )


def images_ok(page):
    imgs = page.evaluate(
        "() => Array.from(document.images).map(i => ({src: (i.currentSrc||i.src).slice(-70), w: i.naturalWidth, h: i.naturalHeight}))"
    )
    bad = [i for i in imgs if i["w"] == 0]
    return (len(bad) == 0, f"images={len(imgs)} broken={bad[:3]}")


def no_overflow(page):
    d = page.evaluate(
        """() => {
          const d = document.documentElement;
          const over = [];
          document.querySelectorAll('*').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.right > window.innerWidth + 2) over.push((el.tagName+'.'+(el.className||'')).slice(0,60));
          });
          return {sw: d.scrollWidth, iw: window.innerWidth, over: over.slice(0,5)};
        }"""
    )
    return (d["sw"] <= d["iw"] + 1 and not d["over"], f"scrollW={d['sw']} innerW={d['iw']} over={d['over']}")


def shot(page, name):
    page.screenshot(path=f"{SHOT}/{name}.png")


def text(page):
    return page.locator("main").inner_text()


def has(page, needle):
    return needle in text(page)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=3,
            locale="ko-KR",
            is_mobile=True,
            has_touch=True,
            timezone_id="Asia/Seoul",
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
            permissions=["clipboard-read", "clipboard-write"],
        )
        page = ctx.new_page()
        attach(page)
        stub_kakao(page)

        # ================= A. 온보딩 =================
        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
        page.wait_for_timeout(1000)
        check("온보딩 이미지 깨짐 없음", lambda: images_ok(page))
        check(
            "온보딩 히어로 원본 해상도",
            lambda: (
                lambda info: (info >= 1170, f"hero naturalWidth={info}")
            )(page.eval_on_selector("section img", "i => i.naturalWidth")),
        )
        check("온보딩 가로 스크롤 없음", lambda: no_overflow(page))
        shot(page, "10-onboarding")

        page.get_by_role("button", name="카카오톡으로 시작하기").click()
        page.wait_for_selector("#setup-nick, nav[aria-label='주요 메뉴']", timeout=40000)
        if page.query_selector("#setup-nick"):
            years = page.eval_on_selector_all("#setup-birth option", "els => els.map(e => e.value)")
            check(
                "생년월일 1926~2020 전 연령 95개",
                lambda: (len(years) == 95 and years[0] == "1926" and years[-1] == "2020", f"{years[0]}~{years[-1]} n={len(years)}"),
            )
            order = page.eval_on_selector_all("[data-birthtime]", "els => els.map(e => e.getAttribute('data-birthtime'))")
            check("12시진 '모르겠음' 최상단", lambda: (order[0] == "모름" and len(order) == 13, f"first={order[0]} n={len(order)}"))
            page.fill("#setup-nick", "점검테스트")
            page.select_option("#setup-birth", "1987")
            page.click('[data-birthtime="모름"]')
            page.select_option("#setup-sido", "충청북도")
            page.wait_for_timeout(400)
            sig = page.eval_on_selector_all("#setup-sigungu option", "els => els.map(e => e.value)")
            check("지역 연동(충북→옥천군)", lambda: ("옥천군" in sig, f"n={len(sig)} has={'옥천군' in sig}"))
            page.select_option("#setup-sigungu", "옥천군")
            page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=40000)
        page.wait_for_timeout(2500)
        check("설정 저장 후 홈 진입", lambda: (page.locator("nav[aria-label='주요 메뉴']").count() == 1, "nav ok"))

        # ================= B. 홈 =================
        check("홈 이미지 깨짐 없음", lambda: images_ok(page))
        check("홈 가로 스크롤 없음", lambda: no_overflow(page))
        check(
            "홈 날씨 실제 값 표시",
            lambda: (
                lambda t: (re.search(r"\d+°", t) is not None and "확인하고 있어요" not in t, re.search(r"\d+°[^\n]{0,40}", t).group(0) if re.search(r"\d+°[^\n]{0,40}", t) else t[:80])
            )(text(page)),
        )
        check(
            "홈 건강 챌린지 5종 존재",
            lambda: (page.locator("[data-health-item]").count() == 5, f"n={page.locator('[data-health-item]').count()}"),
        )

        # 글씨 크게
        def font_toggle():
            before = page.eval_on_selector("html", "h => getComputedStyle(h).fontSize")
            lbl = page.locator("header button[aria-label*='글씨 크기']")
            before_lbl = lbl.get_attribute("aria-label")
            lbl.click()
            page.wait_for_timeout(600)
            after = page.eval_on_selector("html", "h => getComputedStyle(h).fontSize")
            after_lbl = lbl.get_attribute("aria-label")
            ok = before != after and before_lbl != after_lbl
            check("글씨 크게 1단계 후 레이아웃", lambda: no_overflow(page))
            lbl.click(); page.wait_for_timeout(400); lbl.click(); page.wait_for_timeout(500)
            return ok, f"{before}->{after} / {before_lbl} -> {after_lbl}"

        check("글씨 크게 토글 동작", font_toggle)

        # 운세 시트
        def fortune():
            page.get_by_role("button", name=re.compile("오늘의 운세")).first.click()
            page.wait_for_selector("[data-sheet-close]", timeout=8000)
            page.wait_for_timeout(700)
            has_top = page.locator("[data-sheet-close]").first.is_visible()
            has_bottom = page.get_by_role("button", name=re.compile("^닫기$")).count()
            body = page.locator("[data-sheet-close]").first.inner_text()
            speak = page.get_by_role("button", name=re.compile("운세 소리로 듣기")).count()
            shot(page, "11-fortune")
            page.locator("[data-sheet-close]").first.click()
            page.wait_for_timeout(500)
            closed = page.locator("[data-sheet-close]").count() == 0
            return (has_top and has_bottom >= 1 and speak == 1 and closed, f"top={body!r} bottomN={has_bottom} speak={speak} closed={closed}")

        check("운세 시트 열기·상하단 닫기", fortune)

        # 날씨 시트
        def weather():
            page.get_by_role("button", name=re.compile("오늘의 날씨와 생활팁")).first.click()
            page.wait_for_selector("[data-sheet-close]", timeout=8000)
            page.wait_for_timeout(700)
            body = page.locator("body").inner_text()
            live = "실시간 날씨" in body or "날씨를 불러오지 못해" in body
            shot(page, "12-weather")
            page.locator("[data-sheet-close]").first.click()
            page.wait_for_timeout(400)
            return (live and page.locator("[data-sheet-close]").count() == 0, "실시간/폴백 문구 확인" if live else body[-200:])

        check("날씨 시트 열기·닫기", weather)

        # 건강 챌린지 도장 5종
        def health():
            # 앞선 실행에서 찍은 도장이 남아 있을 수 있으니 먼저 모두 해제한다.
            for i in range(page.locator("[data-health-item]").count()):
                if page.locator("[data-health-item]").nth(i).get_attribute("aria-pressed") == "true":
                    page.locator("[data-health-item]").nth(i).click()
                    page.wait_for_timeout(220)
            page.wait_for_timeout(400)
            base = page.locator("[data-health-done='1']").count()
            for i in range(5):
                page.locator("[data-health-item]").nth(i).click()
                page.wait_for_timeout(260)
            page.wait_for_timeout(600)
            done = page.locator("[data-health-done='1']").count()
            badge = page.locator("[aria-label*='완료']").first.get_attribute("aria-label")
            complete = "건강 챌린지 완성" in page.locator("body").inner_text()
            page.locator("[data-health-item]").nth(2).click()
            page.wait_for_timeout(500)
            undone = page.locator("[data-health-done='1']").count()
            page.locator("[data-health-item]").nth(2).click()
            page.wait_for_timeout(700)
            return (base == 0 and done == 5 and complete and undone == 4, f"시작={base} done={done} badge={badge} 완성문구={complete} 해제후={undone}")

        check("건강 챌린지 5종 도장·달성률", health)

        # 바로가기 타일 이동
        def shortcuts():
            out = []
            cases = [
                ("오늘의 퀴즈", "quiz"),
                ("정부 지원금", "welfare"),
                ("돋보기", "tools"),
                ("복약 체크", "family"),
                ("생활 가이드", "tools"),
            ]
            for name, expect in cases:
                page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name="홈").click()
                page.wait_for_timeout(600)
                page.get_by_role("button", name=re.compile(f"^{name}")).first.click()
                page.wait_for_timeout(1000)
                body = page.locator("main").inner_text()
                ok = {
                    "quiz": "1분 치매예방 퀴즈" in body,
                    "welfare": "복지" in body,
                    "tools": "돋보기" in body,
                    "family": ("복약" in body or "가족" in body),
                }[expect]
                out.append(f"{name}:{'ok' if ok else 'NO'}")
                page.wait_for_timeout(200)
            page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name="홈").click()
            page.wait_for_timeout(700)
            return (all(x.endswith("ok") for x in out), ",".join(out))

        check("홈 바로가기 6타일 이동", shortcuts)

        # 설치 안내 · 달력 배너
        def install_and_calendar():
            page.get_by_role("button", name=re.compile("주소창 없이 앱처럼 쓰기")).first.click()
            page.wait_for_timeout(900)
            guide = page.locator("[data-install-guide]").count()
            page.keyboard.press("Escape")
            page.wait_for_timeout(500)
            page.get_by_role("button", name=re.compile("가족안부달력")).first.click()
            page.wait_for_timeout(1400)
            cal = page.locator("[aria-label='달력 닫기']").count()
            shot(page, "13-calendar")
            if cal:
                page.locator("[aria-label='달력 닫기']").first.click()
            page.wait_for_timeout(500)
            return (guide >= 1 and cal >= 1, f"installGuide={guide} calendarClose={cal}")

        check("설치 안내·가족안부달력 열기", install_and_calendar)

        # ================= C. 모임 =================
        page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name="모임").click()
        page.wait_for_timeout(1200)

        def join_demo():
            btn = page.get_by_role("button", name=re.compile("체험 모임 들어가기"))
            if btn.count():
                btn.first.click()
                # 모임 자료를 서버에서 불러오는 데 1~3초 걸린다 — 최대 12초까지 기다린다.
                try:
                    page.wait_for_selector("text=오늘 출석 현황", timeout=12000)
                except Exception:  # noqa: BLE001
                    pass
                page.wait_for_timeout(1200)
            body = text(page)
            ok = "우리 가족 사랑방" in body and "오늘 출석 현황" in body
            return (ok, ("이미 입장" if not btn.count() else "입장 클릭") + " | " + body[:80].replace("\n", " "))

        check("체험 모임(FAM101) 입장", join_demo)

        check(
            "모임 출석·접속·복약 배지",
            lambda: (
                lambda b: ("지금 접속" in b and "약" in b and "접속 중" in b, f"online={b.count('접속 중')} med={'약' in b}")
            )(text(page)),
        )
        check("모임 이미지·아바타 깨짐 없음", lambda: images_ok(page))
        check("모임 가로 스크롤 없음", lambda: no_overflow(page))
        shot(page, "20-group")

        # 게시판 글 + 응원 즉시 반응
        def board():
            msg = f"점검 테스트 안부 글 {int(time.time()) % 10000}"
            page.get_by_label("모임 게시판에 남길 말").fill(msg)
            page.get_by_role("button", name="남기기").click()
            page.wait_for_timeout(2800)
            appeared = msg in page.locator("body").inner_text()
            post = page.locator("div", has_text=msg).last
            cheers = post.get_by_role("button", name=re.compile("응원"))
            n0 = cheers.first.inner_text()
            t0 = time.time()
            cheers.first.click()
            page.wait_for_timeout(60)
            n1 = post.get_by_role("button", name=re.compile("응원")).first.inner_text()
            dt = int((time.time() - t0) * 1000)
            page.wait_for_timeout(2000)
            n2 = post.get_by_role("button", name=re.compile("응원")).first.inner_text()
            num = lambda s: int(re.sub(r"\D", "", s) or 0)
            immediate = num(n1) > num(n0)
            persisted = num(n2) > num(n0)
            return (appeared and immediate and persisted, f"글={appeared} 응원 {n0}->{n1}({dt}ms)->{n2}")

        check("게시판 글 작성·응원 낙관적 반영", board)

        # 초대 시트 · 복사 · 카톡 공유 시트
        def invite():
            page.get_by_role("button", name=re.compile("카카오톡으로 우리 모임 초대하기")).first.click()
            page.wait_for_selector("[data-sheet-close]", timeout=8000)
            page.wait_for_timeout(800)
            body = page.locator("body").inner_text()
            has_code = "FAM101" in body
            link_line = re.search(r"https://senior-life-platform\.pages\.dev/?[^\s]*", body)
            page.get_by_role("button", name=re.compile("초대 링크 복사")).click()
            page.wait_for_timeout(800)
            copied = page.locator("body").inner_text().count("복사했어요")
            clip = page.evaluate("() => navigator.clipboard.readText().catch(() => '')")
            shot(page, "21-invite")
            page.get_by_role("button", name=re.compile("카카오톡으로 초대장 보내기")).click()
            page.wait_for_timeout(1200)
            share = page.locator("[data-share-sheet]").count()
            share_close = page.locator("[data-share-close]").count()
            shot(page, "22-share")
            if share_close:
                page.locator("[data-share-close]").first.click()
            page.wait_for_timeout(600)
            if page.locator("[data-sheet-close]").count():
                page.locator("[data-sheet-close]").first.click()
            page.wait_for_timeout(400)
            return (
                has_code and copied >= 1 and share >= 1 and share_close >= 1 and bool(clip),
                f"code={has_code} 토스트={copied} 클립보드={clip[:40]!r} 공유시트={share} 닫기={share_close}",
            )

        check("초대 번호·링크 복사·공유 시트", invite)

        # 새 모임 만들기 → 수정 → 전환 → 탈퇴 (테스트 모임)
        def group_lifecycle():
            page.get_by_role("button", name=re.compile("새 모임 만들기")).first.click()
            page.wait_for_selector("#group-name", timeout=8000)
            page.fill("#group-name", "점검이 테스트 모임")
            page.get_by_role("button", name=re.compile("모임 만들기|만드는 중")).last.click()
            # 서버에 모임을 만들고 목록을 다시 받아오는 데 2~5초 걸린다
            try:
                page.wait_for_selector("text=점검이 테스트 모임", timeout=15000)
            except Exception:  # noqa: BLE001
                pass
            page.wait_for_timeout(800)
            made = "점검이 테스트 모임" in page.locator("body").inner_text()
            rows = page.locator("[data-group-row]")
            n_groups = rows.count()
            page.get_by_role("button", name=re.compile("모임 수정")).first.click()
            page.wait_for_selector("#group-edit-name", timeout=8000)
            page.fill("#group-edit-name", "점검이 모임(수정)")
            page.fill("#group-edit-region", "충북 옥천군")
            page.get_by_role("button", name=re.compile("바꾼 내용 저장하기|저장하는 중")).click()
            try:
                page.wait_for_selector("text=점검이 모임(수정)", timeout=15000)
            except Exception:  # noqa: BLE001
                pass
            page.wait_for_timeout(800)
            edited = "점검이 모임(수정)" in page.locator("body").inner_text()
            # 모임 전환
            page.locator("[data-group-row='FAM101']").first.click()
            page.wait_for_timeout(2500)
            switched = "우리 가족 사랑방" in page.locator("body").inner_text()
            # 테스트 모임으로 되돌아가 탈퇴
            test_row = page.locator("[data-group-row]", has_text="점검이 모임(수정)")
            left = None
            if test_row.count():
                test_row.first.click()
                page.wait_for_timeout(2500)
                page.get_by_role("button", name=re.compile("모임 탈퇴")).first.click()
                page.wait_for_selector("[data-sheet-close]", timeout=8000)
                page.wait_for_timeout(600)
                shot(page, "23-leave")
                page.get_by_role("button", name=re.compile("그만두기 \\(모임에 남기\\)")).click()
                page.wait_for_timeout(900)
                still = "점검이 모임(수정)" in page.locator("body").inner_text()
                page.get_by_role("button", name=re.compile("모임 탈퇴")).first.click()
                page.wait_for_selector("[data-sheet-close]", timeout=8000)
                page.wait_for_timeout(500)
                page.get_by_role("button", name=re.compile("^🚪 모임 탈퇴하기$")).last.click()
                page.wait_for_timeout(3000)
                gone = "점검이 모임(수정)" not in page.locator("body").inner_text()
                left = (still and gone, f"그만두기후 유지={still} 탈퇴후 제거={gone}")
            return (made and n_groups >= 2 and edited and switched and bool(left and left[0]), f"생성={made} 모임수={n_groups} 수정={edited} 전환={switched} 탈퇴={left}")

        check("모임 생성·수정·전환·탈퇴", group_lifecycle)

        # ================= D. 퀴즈 =================
        page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name="퀴즈").click()
        page.wait_for_timeout(1200)
        check(
            "퀴즈 5종 주제 버튼",
            lambda: (
                lambda labels: (
                    all(any(x in l for l in labels) for x in ["초성 퀴즈", "옛날 노래 가사", "틀린 그림 찾기", "OX 건강 상식", "넌센스·아재개그"]),
                    labels,
                )
            )([x.replace("\n", " ") for x in page.eval_on_selector_all("[data-quiz-topic]", "els => els.map(e => e.innerText)")]),
        )
        check("퀴즈 가로 스크롤 없음", lambda: no_overflow(page))
        shot(page, "30-quiz-intro")

        def quiz_modes():
            out = []
            for t in ["choseong", "lyrics", "spot", "ox", "nonsense"]:
                # 주제를 고르면 바로 연습 모드 3문제가 시작된다(점수·순위와 무관).
                btn = page.locator(f"[data-quiz-topic='{t}']")
                if btn.count() == 0:
                    out.append(f"{t}:no-btn")
                    break
                btn.first.click()
                page.wait_for_timeout(1400)
                opts = page.locator("[data-quiz-option]").count()
                body = page.locator("body").inner_text()
                badge = "연습 모드" in body
                speak = page.get_by_role("button", name=re.compile("문제 소리로 듣기")).count()
                out.append(f"{t}:opts{opts}/badge{int(badge)}/speak{speak}")
                # 다음 주제를 고르기 위해 퀴즈 탭을 나갔다 들어온다
                page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name="홈").click()
                page.wait_for_timeout(500)
                page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name="퀴즈").click()
                page.wait_for_timeout(900)
            return (
                len(out) == 5 and all("speak1" in o and "badge1" in o and "opts0" not in o for o in out),
                "|".join(out),
            )

        check("퀴즈 5종 모드 전환·음성 버튼", quiz_modes)

        # 주제 연습을 마치고 오늘의 3문제(점수 반영) 화면으로 돌아간다
        page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name="홈").click()
        page.wait_for_timeout(500)
        page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name="퀴즈").click()
        page.wait_for_timeout(1200)

        def quiz_play():
            page.get_by_role("button", name=re.compile("퀴즈 시작하기")).click()
            page.wait_for_timeout(1500)
            steps = []
            for qn in range(3):
                opts = page.locator("[data-quiz-option]")
                if opts.count() == 0:
                    steps.append(f"q{qn}:no-options")
                    break
                speak = page.get_by_role("button", name=re.compile("문제 소리로 듣기")).count()
                opts.first.click()
                page.wait_for_timeout(400)
                page.get_by_role("button", name=re.compile("정답 확인")).click()
                page.wait_for_timeout(700)
                feedback = page.locator("body").inner_text()
                good = ("정답이에요" in feedback) or ("아쉽지만 괜찮아요" in feedback)
                steps.append(f"q{qn}:opts={opts.count()},speak={speak},fb={good}")
                page.get_by_role("button", name=re.compile("다음 문제|결과 보기")).first.click()
                page.wait_for_timeout(900)
            page.wait_for_timeout(1200)
            body = page.locator("body").inner_text()
            done_view = ("오늘의 결과" in body) or ("결과" in body and "점" in body)
            shot(page, "31-quiz-result")
            return (all("fb=True" in s for s in steps) and done_view, f"{steps} result={done_view}")

        check("퀴즈 풀이 3문제·정답확인·음성", quiz_play)

        def practice():
            # 결과 화면 → 연습 모드
            btn = page.get_by_role("button", name=re.compile("연습 모드 시작하기"))
            if not btn.count():
                page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name="퀴즈").click()
                page.wait_for_timeout(1200)
                btn = page.get_by_role("button", name=re.compile("연습 모드 시작하기"))
            if btn.count():
                btn.first.click()
                page.wait_for_timeout(1500)
            else:
                # 연습 시작 (주제 골라 바로 풀기)
                page.locator("[data-quiz-topic='ox']").first.click()
                page.wait_for_timeout(1500)
            body = page.locator("body").inner_text()
            practice_badge = "연습 모드" in body
            opts = page.locator("[data-quiz-option]").count()
            return (practice_badge and opts > 0, f"badge={practice_badge} opts={opts}")

        check("연습 모드 진입", practice)

        # ================= E. 랭킹 =================
        page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name="랭킹").click()
        page.wait_for_timeout(1500)

        def rank_tabs():
            tabs = page.eval_on_selector_all("[data-rank-tab]", "els => els.map(e => [e.getAttribute('data-rank-tab'), e.innerText.trim()])")
            out = []
            for key, label in tabs:
                page.locator(f"[data-rank-tab='{key}']").first.click()
                page.wait_for_timeout(1400)
                m = page.locator("main").inner_text()
                broke = page.evaluate("() => Array.from(document.images).filter(i => i.naturalWidth === 0).length")
                over = page.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth + 1")
                nonempty = len(m.strip()) > 120
                out.append(f"{label}:{'ok' if (nonempty and broke==0 and over) else 'NO'}({len(m)}ch,img{broke})")
                if key in ("national", "region"):
                    shot(page, f"40-rank-{key}")
            return (len(tabs) == 6 and all(":ok" in o for o in out), f"tabs={len(tabs)} " + ",".join(out))

        check("랭킹 6탭 렌더링", rank_tabs)
        check("랭킹 가로 스크롤 없음", lambda: no_overflow(page))

        # ================= F. 혜택 =================
        page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name="혜택").click()
        page.wait_for_timeout(1500)
        check("혜택 화면 가로 스크롤 없음", lambda: no_overflow(page))

        def welfare():
            chips = page.locator("[data-welfare-filters] button")
            n = chips.count()
            names = [chips.nth(i).inner_text().strip() for i in range(n)]
            page.get_by_role("button", name=re.compile("일자리")).first.click()
            page.wait_for_timeout(1200)
            job_body = page.locator("main").inner_text()
            job_ok = "일자리" in job_body and "국민내일배움카드" in job_body
            shot(page, "50-welfare-job")
            page.get_by_role("button", name=re.compile("신청 방법 자세히 보기")).first.click()
            page.wait_for_selector("[data-sheet-close]", timeout=8000)
            page.wait_for_timeout(700)
            detail_body = page.locator("body").inner_text()
            detail_ok = "신청" in detail_body
            shot(page, "51-welfare-detail")
            page.locator("[data-sheet-close]").first.click()
            page.wait_for_timeout(500)
            closed = page.locator("[data-sheet-close]").count() == 0
            return (n >= 8 and job_ok and detail_ok and closed, f"필터 n={n} {names} 일자리={job_ok} 상세={detail_ok} 닫힘={closed}")

        check("혜택 필터·3단계 상세 시트", welfare)

        # ================= G. 가족안부달력 (일정 추가/삭제 + 지역 변경) =================
        def calendar_flow():
            page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name="더보기").click()
            page.wait_for_timeout(900)
            page.get_by_role("button", name=re.compile("가족안부달력")).first.click()
            page.wait_for_timeout(1600)
            body = page.locator("body").inner_text()
            local_news = "우리동네 소식" in body or "동네 소식" in body
            check("달력 가로 스크롤 없음", lambda: no_overflow(page))
            shot(page, "60-calendar")

            # 일정 추가 → 조회 → 수정 → 삭제
            page.get_by_role("button", name=re.compile("일정 추가|^\+?\s*일정$")).first.click()
            page.wait_for_selector("#ev-title", timeout=8000)
            page.wait_for_timeout(500)
            page.fill("#ev-title", "점검이 생일")
            page.get_by_role("button", name=re.compile("생일")).first.click()
            page.get_by_role("button", name=re.compile("일정 저장하기")).click()
            page.wait_for_timeout(1500)
            added = "점검이 생일" in page.locator("body").inner_text()
            shot(page, "61-calendar-event")
            # 수정
            page.get_by_role("button", name=re.compile("^수정$")).first.click()
            page.wait_for_selector("#ev-title", timeout=8000)
            page.fill("#ev-title", "점검이 생일(수정)")
            page.get_by_role("button", name=re.compile("고친 내용 저장")).click()
            page.wait_for_timeout(1400)
            edited = "점검이 생일(수정)" in page.locator("body").inner_text()
            # 삭제
            page.get_by_role("button", name=re.compile("^삭제$")).first.click()
            page.wait_for_timeout(600)
            page.get_by_role("button", name=re.compile("^지우기$")).click()
            page.wait_for_timeout(1200)
            gone = "점검이 생일" not in page.locator("body").inner_text()

            # 우리동네 소식 지역 변경 (서울 강남구)
            page.get_by_label("우리동네 소식 지역 바꾸기").first.click()
            page.wait_for_selector("#news-sido", timeout=8000)
            page.wait_for_timeout(400)
            page.select_option("#news-sido", "서울특별시")
            page.wait_for_timeout(500)
            sig = page.eval_on_selector_all("#news-sigungu option", "els => els.map(e => e.value)")
            page.select_option("#news-sigungu", sig[0])
            page.wait_for_timeout(300)
            page.get_by_role("button", name=re.compile("소식 보기$")).first.click()
            page.wait_for_timeout(1500)
            area = page.get_by_label("우리동네 소식 지역 바꾸기").first.inner_text()
            changed = "서울" in area
            shot(page, "62-calendar-seoul")
            # 내 지역으로 되돌리고 달력 닫기
            page.get_by_label("우리동네 소식 지역 바꾸기").first.click()
            page.wait_for_selector("#news-sido", timeout=8000)
            page.get_by_role("button", name=re.compile("내 지역.*돌아가기")).first.click()
            page.wait_for_timeout(1200)
            back = "옥천" in page.get_by_label("우리동네 소식 지역 바꾸기").first.inner_text()
            page.get_by_label("달력 닫기").first.click()
            page.wait_for_timeout(700)
            closed = page.get_by_label("달력 닫기").count() == 0
            return (
                local_news and added and edited and gone and changed and back and closed,
                f"소식={local_news} 추가={added} 수정={edited} 삭제={gone} 서울={changed} 복귀={back} 닫힘={closed} area={area.strip()[:30]!r} sigungu n={len(sig)}",
            )

        check("가족안부달력 일정 추가·수정·삭제 + 지역 변경", calendar_flow)

        # ================= H. 도구 =================
        def tools():
            page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name="더보기").click()
            page.wait_for_timeout(800)
            check("더보기 가로 스크롤 없음", lambda: no_overflow(page))
            page.get_by_role("button", name=re.compile("도구 모음")).first.click()
            page.wait_for_timeout(1200)
            body = page.locator("main").inner_text()
            items = {"돋보기": "돋보기" in body, "손전등": "손전등" in body, "가이드": "가이드" in body or "카드뉴스" in body}
            shot(page, "70-tools")
            page.get_by_role("button", name=re.compile("돋보기")).first.click()
            page.wait_for_timeout(1800)
            zoom_body = page.locator("body").inner_text()
            has_zoom = page.locator("[aria-label='확대 키우기']").count() > 0
            shot(page, "71-magnifier")
            page.locator("[aria-label='돋보기 닫기']").first.click()
            page.wait_for_timeout(800)
            closed_zoom = page.locator("[aria-label='돋보기 닫기']").count() == 0
            return (all(items.values()) and has_zoom and closed_zoom, f"{items} magnifier={has_zoom} 닫힘={closed_zoom} {zoom_body[:60]!r}")

        check("도구(돋보기·손전등·가이드)", tools)

        # ================= I. 가족 확인 화면 =================
        def family():
            page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name="더보기").click()
            page.wait_for_timeout(800)
            page.get_by_role("button", name=re.compile("가족 확인 화면")).first.click()
            page.wait_for_timeout(1500)
            body = page.locator("main").inner_text()
            shot(page, "80-family")
            med = "복약" in body
            # 복약 체크 버튼
            btn = page.get_by_role("button", name=re.compile("아침|저녁|약"))
            clicked = False
            if btn.count():
                btn.first.click()
                page.wait_for_timeout(900)
                clicked = True
            return (med, f"복약문구={med} 버튼={btn.count()} 클릭={clicked} {body[:100]!r}")

        check("가족 화면(복약 체크)", family)

        # /family/ 자녀 대시보드
        def family_page():
            p2 = ctx.new_page()
            attach(p2)
            p2.goto(BASE + "/family/", wait_until="domcontentloaded")
            p2.wait_for_timeout(2500)
            body = p2.locator("body").inner_text()
            shot(p2, "81-family-dashboard")
            ok = ("부모" in body or "어머니" in body or "아버지" in body or "점검테스트" in body) and ("복약" in body)
            link_ok = "가족 연결 번호" in body or "연결" in body
            p2.close()
            return (ok, f"{body[:160]!r} 연결문구={link_ok}")

        check("/family/ 자녀 대시보드", family_page)

        # ================= 정적 자산 · 해시 바로가기 =================
        def assets():
            codes = {}
            for path in [
                "/manifest.json",
                "/sw.js",
                "/icon-512.png",
                "/apple-touch-icon.png",
                "/images/home-hero.webp",
                "/images/onboarding-hero.webp",
                "/images/icon-3d-quiz-trophy.webp",
                "/family/",
            ]:
                try:
                    req = urllib.request.Request(
                        BASE + path,
                        headers={"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"},
                    )
                    with urllib.request.urlopen(req, timeout=20) as r:
                        codes[path] = r.status
                except Exception as e:  # noqa: BLE001
                    codes[path] = str(e)[:30]
            return (all(v == 200 for v in codes.values()), codes)

        check("정적 자산·PWA 파일 200", assets)

        def hash_link():
            p3 = ctx.new_page()
            attach(p3)
            p3.goto(BASE + "/#tools", wait_until="domcontentloaded")
            p3.wait_for_timeout(2500)
            body = p3.locator("main").inner_text()
            ok = "돋보기" in body and "손전등" in body
            p3.close()
            return (ok, body[:70].replace("\n", " "))

        check("해시 바로가기(#tools)", hash_link)

        # ================= 안드로이드 크롬 호환 =================
        def android():
            actx = browser.new_context(
                viewport={"width": 360, "height": 800},
                device_scale_factor=3,
                locale="ko-KR",
                is_mobile=True,
                has_touch=True,
                user_agent="Mozilla/5.0 (Linux; Android 14; SM-S911N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
            )
            ap = actx.new_page()
            before = len(console_errors)
            attach(ap)
            stub_kakao(ap)
            ap.goto(BASE + "/", wait_until="domcontentloaded")
            ap.wait_for_selector("text=카카오톡으로 시작하기", timeout=30000)
            ap.wait_for_timeout(1000)
            ap.get_by_role("button", name="카카오톡으로 시작하기").click()
            ap.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=40000)
            ap.wait_for_timeout(2000)
            body = ap.locator("main").inner_text()
            over = ap.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth + 1")
            ap.screenshot(path=f"{SHOT}/99-android-home.png")
            ap.get_by_role("button", name=re.compile("주소창 없이 앱처럼 쓰기")).first.click()
            ap.wait_for_timeout(1200)
            guide = ap.locator("[data-install-guide]").count()
            plat = ap.locator("[data-install-guide]").first.get_attribute("data-platform") if guide else None
            ap.screenshot(path=f"{SHOT}/99-android-install.png")
            ap.close()
            actx.close()
            errs = len(console_errors) - before
            return ("안녕하세요" in body and over and guide >= 1 and errs == 0, f"홈={('안녕하세요' in body)} 가로={over} 설치안내={guide} plat={plat} 새오류={errs}")

        check("안드로이드 크롬 렌더링·설치 안내", android)

        # ================= J. 설정 =================
        def settings():
            page.locator("header button[aria-label='설정']").click()
            page.wait_for_selector("[data-sheet-close]", timeout=8000)
            page.wait_for_timeout(700)
            body = page.locator("body").inner_text()
            code = re.search(r"\b[A-Z0-9]{6}\b", body)
            page.get_by_role("button", name="내 정보 고치기").click()
            page.wait_for_selector("#edit-nick", timeout=8000)
            page.fill("#edit-nick", "점검테스트2")
            page.get_by_role("button", name=re.compile("^저장$")).click()
            page.wait_for_timeout(1200)
            saved = "점검테스트2" in page.locator("body").inner_text()
            shot(page, "90-settings")
            page.locator("[data-sheet-close]").first.click()
            page.wait_for_timeout(500)
            header = page.locator("header").inner_text()
            return (bool(code) and saved, f"가족번호={code.group(0) if code else None} 저장={saved} header={header[:40]!r}")

        check("설정: 가족번호·프로필 수정", settings)

        # 로그아웃(처음부터 다시 시작) — 마지막에
        def logout():
            page.locator("header button[aria-label='설정']").click()
            page.wait_for_selector("[data-sheet-close]", timeout=8000)
            page.wait_for_timeout(600)
            page.get_by_role("button", name=re.compile("처음부터 다시 시작")).click()
            page.wait_for_timeout(1800)
            back = page.get_by_role("button", name="카카오톡으로 시작하기").count()
            return (back >= 1, f"온보딩 복귀={back}")

        check("로그아웃 → 온보딩 복귀", logout)

        out = {
            "base": BASE,
            "results": results,
            "console_errors": console_errors,
            "page_errors": page_errors,
            "http_fails": http_fails,
            "failed_requests": failed_requests,
        }
        os.makedirs("/workspace/tool-results", exist_ok=True)
        with open("/workspace/tool-results/audit-deep.json", "w") as f:
            json.dump(out, f, ensure_ascii=False, indent=1)
        browser.close()

    fails = [r for r in results if not r["ok"]]
    print("\n=== FAILS", len(fails), "of", len(results))
    for r in fails:
        print(" -", r["name"], "|", r["info"])
    print("console_errors", len(console_errors), console_errors[:8])
    print("page_errors", len(page_errors), page_errors[:5])
    print("http_fails", len(http_fails), http_fails[:10])
    print("requestfailed", len(failed_requests), failed_requests[:6])


if __name__ == "__main__":
    main()
