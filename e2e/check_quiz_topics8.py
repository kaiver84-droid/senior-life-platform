#!/usr/bin/env python3
"""늘봄 치매예방 퀴즈 — 새 주제 3종(추억·보이스피싱/손주 말·제철) 8주제 배치 검증.

로컬 빌드(out/) 또는 라이브에서 390×844 로 확인한다.
  1) 주제 고르기에 8개 주제 + 섞어서 풀기가 2열로 잘리지 않고 배치되는지
     (보통·크게·아주 크게 글씨)
  2) 새 주제 3개에 각각 들어가 문제를 풀고 정답 +1점([data-practice-point])이 뜨는지

사용:
  python3 e2e/check_quiz_topics8.py           # 로컬 out/ (기본, 포트 8100)
  python3 e2e/check_quiz_topics8.py --live    # 라이브 https://senior-life-platform.pages.dev
"""
import functools
import http.server
import json
import os
import re
import socketserver
import sys
import threading

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

ROOT = "/workspace/work/senior-platform/out"
SHOT = "/workspace/downloads"
CHROME = "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome"
LIVE = "--live" in sys.argv
BASE = "https://senior-life-platform.pages.dev" if LIVE else "http://127.0.0.1:8100"
TAG = "live" if LIVE else "local"

sys.path.insert(0, "/workspace/work/senior-platform/scripts")
CHO = list("ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ")


def parse_pool(name):
    src = open("/workspace/work/senior-platform/lib/quiz.ts", encoding="utf-8").read()
    m = re.search(rf"const {name}: Question\[\] = \[\n(.*?)\n\];", src, re.S)
    body = m.group(1)
    chunks = re.split(r"\n  \},\n  \{\n", "\n" + body + "\n")
    out = {}
    for chunk in chunks:
        chunk = chunk.strip()
        if not chunk.startswith("{"):
            chunk = "{\n" + chunk
        prompt = json.loads(re.search(r'prompt: (".*?"),\n', chunk, re.S).group(1))
        opts_src = re.search(r"options: \[\n(.*?)\n    \],", chunk, re.S).group(1)
        opts = [json.loads(x) for x in re.findall(r'("(?:[^"\\]|\\.)*"),', opts_src)]
        ans = int(re.search(r"answer: (\d+),", chunk).group(1))
        out[prompt] = opts[ans]
    return out


ANSWERS = {}
for name in ("NOSTALGIA", "SAFETY_SLANG", "SEASONAL"):
    ANSWERS.update(parse_pool(name))

TOPICS = [
    ("choseong", "초성 퀴즈"),
    ("lyrics", "옛날 노래 가사"),
    ("spot", "틀린 그림 찾기"),
    ("ox", "OX 건강 상식"),
    ("nonsense", "넌센스·아재개그"),
    ("nostalgia", "그때 그 시절 추억"),
    ("safety_slang", "보이스피싱·손주 말"),
    ("seasonal", "제철 음식·약초 지혜"),
]

problems = []
notes = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
    if not cond:
        problems.append(label + (f": {extra}" if extra else ""))


def start_server():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)

    class Quiet(socketserver.ThreadingTCPServer):
        allow_reuse_address = True
        daemon_threads = True

    httpd = Quiet(("127.0.0.1", 8100), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def seed_profile(page):
    """로그인 없이(라이브 테스트 계정을 만들지 않도록) 이 기기에 저장된 프로필로 들어간다."""
    page.goto(BASE + "/", wait_until="domcontentloaded")
    page.wait_for_timeout(800)
    state = {
        "version": 1,
        "profile": {
            "id": "quiz8check",
            "nickname": "점검이",
            "birthYear": 1952,
            "birthTime": "묘시",
            "sido": "충청북도",
            "sigungu": "옥천군",
            "createdAt": "2026-11-23T00:00:00.000Z",
            "source": "demo",
            "profileCompleted": True,
        },
        "quizLogs": [],
        "daily": None,
        "med": {},
        "visits": ["2026-11-23"],
        "familyEvents": [],
        "health": {},
        "missions": {},
        "rankingVisible": False,
        "fontSize": 18,
        "lastVisit": "2026-11-23T00:00:00.000Z",
    }
    page.evaluate("s => window.localStorage.setItem('seniorLife.v1', JSON.stringify(s))", state)
    page.reload(wait_until="domcontentloaded")
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=30000)
    page.wait_for_timeout(1500)


def grid_info(page):
    return page.evaluate(
        """() => {
          const els = Array.from(document.querySelectorAll("[data-quiz-topic]"));
          const rects = els.map(e => {
            const r = e.getBoundingClientRect();
            const label = e.querySelector("span:last-child");
            const lr = label ? label.getBoundingClientRect() : null;
            return {
              k: e.getAttribute("data-quiz-topic"),
              text: e.innerText.split(String.fromCharCode(10)).join(" ").split(String.fromCharCode(8203)).join(""),
              x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
              clip: e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 2,
              labelOut: lr ? (lr.right > r.right + 1 || lr.left < r.left - 1 || lr.bottom > r.bottom + 1) : false,
            };
          });
          const doc = document.documentElement;
          const wide = Array.from(document.querySelectorAll("main *, nav *"))
            .filter(el => el.getBoundingClientRect().right > doc.clientWidth + 1)
            .slice(0, 5)
            .map(el => (el.tagName + "." + (el.className || "")).slice(0, 70));
          return { rects, docW: doc.scrollWidth, clientW: doc.clientWidth, wide };
        }"""
    )


def play_correct(page, count=1):
    """현재 문제의 정답 보기를 찾아 누르고, 정답 +1점 표시를 확인한다."""
    done = 0
    for _ in range(count):
        page.wait_for_selector("[data-quiz-option]", timeout=20000)
        page.wait_for_timeout(350)
        body = page.locator("body").inner_text()
        prompt = next((p for p in ANSWERS if p in body), None)
        if prompt is None:
            problems.append("화면에서 새 주제 문제를 찾지 못함")
            return done
        ans = ANSWERS[prompt]
        idx = page.evaluate(
            """(ans) => {
              const btns = [...document.querySelectorAll('[data-quiz-option]')];
              return btns.findIndex(b => {
                const spans = [...b.querySelectorAll('span')];
                const t = spans.length ? spans[spans.length - 1].innerText.trim() : '';
                const all = b.innerText.replace(/\\n/g, ' ').trim();
                return t === ans || all === ans || all.endsWith(' ' + ans);
              });
            }""",
            ans,
        )
        if idx < 0:
            problems.append(f"정답 보기를 누르지 못함: {ans!r}")
            return done
        page.locator("[data-quiz-option]").nth(idx).click()
        page.get_by_role("button", name=re.compile("정답 확인")).click()
        page.wait_for_timeout(500)
        ok = page.get_by_text(re.compile("정답이에요")).count() > 0
        plus = page.locator("[data-practice-point]").count() > 0
        if not ok:
            problems.append(f"정답 처리 실패: {prompt[:30]}")
            return done
        if not plus:
            problems.append(f"정답 +1점 표시 없음: {prompt[:30]}")
        done += 1
        page.get_by_role("button", name=re.compile("^다음 문제$")).click()
        page.wait_for_timeout(500)
    return done


def main():
    httpd = start_server() if not LIVE else None
    print(f"== {TAG} 검증 · {BASE}")
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        ctx = b.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=3,
            locale="ko-KR",
            is_mobile=True,
            has_touch=True,
        )
        page = ctx.new_page()
        errs = []
        bad_http = []
        page.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
        page.on(
            "console",
            lambda m: errs.append(f"console: {m.text}")
            if (m.type == "error" and "Failed to load resource" not in m.text)
            else None,
        )
        page.on(
            "response",
            lambda r: bad_http.append(f"{r.status} {r.url}")
            if ((r.status >= 500 or r.status >= 400) and "/api/" not in r.url)
            else None,
        )

        if LIVE:
            # 라이브 점검은 읽기만 한다 — 이 기기의 임시 프로필이 실제 DB 에 남지 않도록 쓰기 요청은 막는다.
            def _read_only(route, request):
                if request.method in ("POST", "PUT", "PATCH", "DELETE"):
                    route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True}))
                else:
                    route.continue_()

            page.route("**/api/**", _read_only)

        seed_profile(page)
        try:
            banner = page.locator("[data-install-banner]")
            if banner.count():
                banner.click()
                page.wait_for_timeout(700)
                page.keyboard.press("Escape")
                page.wait_for_timeout(400)
        except Exception:
            pass

        def nav(name):
            page.locator("nav[aria-label='주요 메뉴']").get_by_role("button", name=name).click()
            page.wait_for_timeout(1200)

        nav("퀴즈")
        page.wait_for_selector("[data-quiz-topics]", timeout=20000)
        page.wait_for_timeout(500)

        # ---------- 1. 8주제 배치 (3단계 글씨) ----------
        for label in ("보통", "크게", "아주 크게"):
            page.locator("[data-quiz-topics]").scroll_into_view_if_needed()
            page.wait_for_timeout(500)
            info = grid_info(page)
            rects = info["rects"]
            check(len(rects) == 9, f"[{label}] 주제 버튼 9개(8주제+섞어서)", f"{len(rects)}개")
            keys = [r["k"] for r in rects]
            check(keys == [k for k, _ in TOPICS] + ["mix"], f"[{label}] 8주제 순서", ",".join(keys))
            labels = [re.sub(r"·\s+", "·", r["text"].replace("\u200b", "")) for r in rects[:8]]
            check(
                all(any(name in t for t in labels) for _, name in TOPICS),
                f"[{label}] 새 3주제 이름이 모두 보임",
                " / ".join(labels),
            )
            topic_x = sorted({r["x"] for r in rects[:8]})
            topic_y = sorted({r["y"] for r in rects[:8]})
            check(len(topic_x) == 2, f"[{label}] 2열 정렬", f"열 x={topic_x}")
            check(len(topic_y) == 4, f"[{label}] 8주제 4행", f"행 y={topic_y}")
            mix = rects[-1]
            check(mix["w"] > (mix["w"] / 2) + 20 and mix["y"] > topic_y[-1], f"[{label}] 섞어서 풀기는 마지막 한 줄", f"w={mix['w']}")
            clipped = [f"{r['k']}({r['text']})" for r in rects if r["clip"]]
            labelout = [r["k"] for r in rects[:8] if r["labelOut"]]
            check(not clipped, f"[{label}] 버튼 안 텍스트 잘림 없음", ",".join(clipped))
            check(not labelout, f"[{label}] 버튼 밖으로 넘친 이름 없음", ",".join(labelout))
            check(info["docW"] <= info["clientW"] + 1, f"[{label}] 가로 넘침 없음", f"{info['docW']}>{info['clientW']} {info['wide']}")
            notes.append(
                f"[{label}] 버튼 높이 {sorted({r['h'] for r in rects[:8]})} · 줄 수 {[r['text'] for r in rects[5:]]}"
            )
            page.screenshot(path=f"{SHOT}/quiz8_{TAG}_topics_{label.replace(' ', '_')}.png")
            if label != "아주 크게":
                page.get_by_role("button", name=re.compile("글씨 크기 바꾸기")).first.click()
                page.wait_for_timeout(700)
        # 글씨 크기를 보통으로 되돌린다 — 버튼 이름(지금 보통/크게/아주 크게)을 보며 맞춘다
        font_btn = page.get_by_role("button", name=re.compile("글씨 크기 바꾸기")).first
        for _ in range(4):
            if "지금 보통" in (font_btn.get_attribute("aria-label") or ""):
                break
            font_btn.click()
            page.wait_for_timeout(500)

        # ---------- 2. 새 주제 3개 — 문제 풀기 + 정답 1점 ----------
        for key, name in TOPICS[5:]:
            page.locator("[data-quiz-topics]").scroll_into_view_if_needed()
            page.wait_for_timeout(300)
            page.locator(f"[data-quiz-topic='{key}']").first.click()
            page.wait_for_timeout(1000)
            body = page.locator("body").inner_text()
            check("무한 연습" in body and "그만 풀기" in body, f"[{key}] 무한 연습 진입")
            played = play_correct(page, 2)
            check(played == 2, f"[{key}] 정답 2문제 +1점", f"{played}문제")
            page.evaluate("window.scrollTo(0, 0)")
            page.wait_for_timeout(500)
            page.screenshot(path=f"{SHOT}/quiz8_{TAG}_{key}.png")
            solved = page.locator("[data-quiz-solved]").inner_text() if page.locator("[data-quiz-solved]").count() else ""
            check("정답 2개" in solved, f"[{key}] 정답 개수 표시", solved)
            page.locator("[data-quiz-stop]").first.click()
            page.wait_for_timeout(900)
            page.get_by_role("button", name=re.compile("퀴즈 홈으로 돌아가기")).click()
            page.wait_for_timeout(800)

        # 저장된 연습 점수 — 주제 3개 × 2문제 = 6점
        stored = page.evaluate("() => JSON.parse(window.localStorage.getItem('seniorLife.v1') || '{}')")
        logs = stored.get("quizLogs") or []
        practice = logs[0].get("practice") if logs else None
        check(practice == 6, "연습 정답 6개가 이번 주 점수에 저장됨", f"practice={practice}")
        page.screenshot(path=f"{SHOT}/quiz8_{TAG}_home.png")

        real_errs = [e for e in errs if "blocked" not in e.lower()]
        check(not real_errs, "콘솔 오류 없음", " | ".join(real_errs[:3]))
        check(not bad_http, "HTTP 4xx/5xx 없음", " | ".join(bad_http[:3]))
        b.close()
    if httpd:
        httpd.shutdown()

    for n in notes:
        print("  note", n)
    print("\n" + ("✅ 8주제 배치·새 주제 3종 동작 확인 완료" if not problems else f"❌ 문제 {len(problems)}건"))
    for p in problems:
        print(" -", p)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
