"""늘봄 라이브 검증 — ① 모임 부제 ‘멤버 N/M명 · 이번 주 달성률 N%’ 한 줄 ② 랭킹 시상대 카톡 프로필 사진.

- 임시 계정 4명(나 + 시상대 3명)을 충청북도로 DB 에 만들고 이번 주 점수를 채운다.
- 390×844 라이브 화면에서 글씨 보통/크게/아주 크게 3단계로 잰다.
- 끝나면 임시 계정·활동 기록을 모두 지운다.

실행: LD_LIBRARY_PATH=/workspace/.libs/usr/lib/x86_64-linux-gnu \
      python3 e2e/check_group_1line_podium.py
"""
import json
import os
import re
import sys
import urllib.request

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from playwright.sync_api import sync_playwright  # noqa: E402

TOKEN = open("/workspace/work/senior-platform/.supabase_token").read().strip()
PROJECT = "aaslirekynetqguajkpv"
BASE = os.environ.get("BASE", "https://senior-life-platform.pages.dev").rstrip("/")
SHOT = "/workspace/downloads"
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")
os.environ.setdefault("LD_LIBRARY_PATH", "/workspace/.libs/usr/lib/x86_64-linux-gnu")
TODAY = "2026-11-20"
WEEK = "2026-W47"
DATES = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"]
PHOTO1 = f"{BASE}/images/profile-sample.jpg"
PHOTO2 = f"{BASE}/images/family-greeting-couple.jpg"


def make_code(seed: str) -> str:
    h = 2166136261
    for ch in seed:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    out = ""
    n = h
    while n:
        n, r = divmod(n, 36)
        out = digits[r] + out
    return out.upper()[-6:].rjust(6, "0")


ID_ME = "zz-1line-podium-me"
NICK_ME = "한줄점검"
CODE_ME = make_code(ID_ME)

# (이름, 사진 주소, 날짜별 활동 목록) — 450점 / 420점 / 400점, 모두 기존 1~3위(337~359점)보다 높다
FULL = ["attend", "quiz", "health", "welfare", "group"]  # 90점
PODIUM = [
    ("김영희", PHOTO1, [FULL, FULL, FULL, FULL, FULL]),
    ("박철수", PHOTO2, [FULL, FULL, FULL, FULL, ["attend", "quiz", "health"]]),
    ("이정숙", None, [FULL, FULL, FULL, FULL, ["attend", "quiz"]]),
]
POD_USERS = [
    {
        "id": f"zz-1line-podium-{i}",
        "code": make_code(f"zz-1line-podium-{i}"),
        "name": name,
        "photo": photo,
        "days": days,
    }
    for i, (name, photo, days) in enumerate(PODIUM)
]
ALL_CODES = [CODE_ME] + [u["code"] for u in POD_USERS]

errors = []
results = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
    results.append(bool(cond))
    if not cond:
        errors.append(label)


def sql(query):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT}/database/query",
        data=json.dumps({"query": query}).encode(),
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.loads(res.read() or b"[]")


def cleanup():
    codes = ",".join(f"'{c}'" for c in ALL_CODES)
    for q in [
        f"delete from public.group_members where user_code in ({codes});",
        f"delete from public.groups where creator_code in ({codes});",
        f"delete from public.daily_visits where user_code in ({codes});",
        f"delete from public.quiz_logs where user_code in ({codes});",
        f"delete from public.health_checks where user_code in ({codes});",
        f"delete from public.activity_logs where user_code in ({codes});",
        f"delete from public.med_checks where user_code in ({codes});",
        f"delete from public.family_events where user_code in ({codes});",
        f"delete from public.anbu_messages where user_code in ({codes});",
        f"delete from public.users where code in ({codes});",
    ]:
        try:
            sql(q)
        except Exception as e:  # noqa: BLE001
            print("  (cleanup skip)", q[:70], e)


def seed():
    cleanup()
    # 나 — 모임 화면·랭킹 화면을 여는 계정(충청북도 옥천군)
    sql(
        "insert into public.users (code, external_id, nickname, birth_year, birth_time, sido, sigungu, source, ranking_visible, profile_completed, created_at) "
        f"values ('{CODE_ME}','{ID_ME}','{NICK_ME}',1952,'모름','충청북도','옥천군','demo',true,true,'{DATES[0]} 00:10:00+00');"
    )
    for u in POD_USERS:
        photo = f"'{u['photo']}'" if u["photo"] else "null"
        sql(
            "insert into public.users (code, external_id, nickname, birth_year, birth_time, sido, sigungu, source, avatar_url, ranking_visible, profile_completed, created_at) "
            f"values ('{u['code']}','{u['id']}','{u['name']}',1950,'모름','충청북도','옥천군','kakao',{photo},true,true,'{DATES[0]} 00:20:00+00');"
        )
        for d, kinds in zip(DATES, u["days"]):
            if "attend" in kinds:
                sql(f"insert into public.daily_visits (user_code, visit_date) values ('{u['code']}','{d}');")
            if "quiz" in kinds:
                sql(
                    "insert into public.quiz_logs (user_code, quiz_date, week_id, correct, total, points) "
                    f"values ('{u['code']}','{d}','{WEEK}',3,3,30);"
                )
            if "health" in kinds:
                sql(
                    "insert into public.health_checks (user_code, check_date, challenges) "
                    f"values ('{u['code']}','{d}',array['walk']);"
                )
            acts = [k for k in kinds if k in ("welfare", "group")]
            if acts:
                vals = ",".join(f"('{u['code']}','{d}','{k}')" for k in acts)
                sql(f"insert into public.activity_logs (user_code, activity_date, kind) values {vals};")
    print("  임시 계정:", ", ".join(f"{u['name']}({u['code']})" for u in POD_USERS), f"· 나 {NICK_ME}({CODE_ME})")


def local_state(font_size: int) -> dict:
    quiz = [
        {
            "date": d,
            "weekId": WEEK,
            "correct": 3,
            "total": 3,
            "points": 30,
            "seconds": 40,
            "types": ["choseong", "lyrics", "ox"],
            "at": f"{d}T09:00:00+09:00",
        }
        for d in ["2026-11-20"]
    ]
    return {
        "version": 1,
        "profile": {
            "id": ID_ME,
            "nickname": NICK_ME,
            "birthYear": 1952,
            "birthTime": "모름",
            "sido": "충청북도",
            "sigungu": "옥천군",
            "createdAt": f"{DATES[0]}T00:10:00.000Z",
            "source": "demo",
            "profileCompleted": True,
        },
        "quizLogs": quiz,
        "daily": {"date": TODAY, "answered": 3, "correct": 3, "points": 30, "done": True, "answeredIds": []},
        "med": {},
        "visits": ["2026-11-20"],
        "familyEvents": [],
        "health": {},
        "missions": {},
        "rankingVisible": True,
        "fontSize": font_size,
        "lastVisit": TODAY,
    }


GROUP_MEASURE = """
() => {
  const line = document.querySelector('[data-group-subline]');
  const sub = document.querySelector('[data-weekly-rate="sub"]');
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = Array.from(range.getClientRects()).filter((x) => x.width > 0.5 && x.height > 0.5);
    const tops = Array.from(new Set(rects.map((x) => Math.round(x.top))));
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
    return {
      text: (el.textContent || '').replace(/\\s+/g, ' ').trim(),
      w: Math.round(r.width),
      h: Math.round(r.height),
      top: Math.round(r.top),
      tops: tops.length,
      lines: Math.max(1, Math.round(r.height / lh)),
      scrollW: el.scrollWidth,
      clientW: el.clientWidth,
      overflow: Math.max(0, el.scrollWidth - el.clientWidth),
      right: Math.round(r.right),
      font: cs.fontSize,
      ws: cs.whiteSpace,
    };
  };
  const doc = document.documentElement;
  const clipped = (el) => {
    if (el.getAttribute('aria-hidden') === 'true' || el.closest('[aria-hidden="true"]')) return true;
    let p = el.parentElement;
    while (p) {
      const s = getComputedStyle(p);
      if (s.overflowX === 'hidden' || s.overflowX === 'clip') return true;
      p = p.parentElement;
    }
    return false;
  };
  const over = Array.from(document.querySelectorAll('main *'))
    .filter((el) => el.getBoundingClientRect().right > doc.clientWidth + 1 && !clipped(el))
    .slice(0, 6)
    .map((el) => (el.tagName + '.' + (el.className || '')).slice(0, 70));
  return {
    root: getComputedStyle(doc).fontSize,
    viewport: doc.clientWidth,
    scrollW: doc.scrollWidth,
    pageOver: over,
    line: box(line),
    sub: box(sub),
    invite: box(document.querySelector('[data-group-invite-top]')),
  };
}
"""

PODIUM_MEASURE = """
() => {
  const podium = document.querySelector('[data-hero-podium]');
  const cols = Array.from(document.querySelectorAll('[data-podium-column]')).map((col) => {
    const place = Number(col.getAttribute('data-podium-column'));
    const av = col.querySelector('[data-avatar]');
    const img = col.querySelector('[data-avatar] img');
    const badge = col.querySelector('[data-podium-badge]');
    const r = av ? av.getBoundingClientRect() : null;
    const b = badge ? badge.getBoundingClientRect() : null;
    const cs = av ? getComputedStyle(av) : null;
    const bc = badge ? getComputedStyle(badge) : null;
    const nameEl = col.querySelector('p');
    return {
      place,
      avatarKind: av ? av.getAttribute('data-avatar') : null,
      avatarSize: r ? [Math.round(r.width), Math.round(r.height)] : null,
      avatarRadius: cs ? cs.borderRadius : null,
      avatarRing: cs ? cs.boxShadow : null,
      imgSrc: img ? img.getAttribute('src') : null,
      imgFit: img ? getComputedStyle(img).objectFit : null,
      imgLoaded: img ? img.naturalWidth > 0 : null,
      imgRadius: img ? getComputedStyle(img).borderRadius : null,
      badge: badge ? (badge.textContent || '').trim() : null,
      badgeBg: bc ? bc.backgroundImage || bc.backgroundColor : null,
      badgeCenterX: b ? Math.round(b.left + b.width / 2) : null,
      badgeCenterY: b ? Math.round(b.top + b.height / 2) : null,
      avatarCenterX: r ? Math.round(r.left + r.width / 2) : null,
      avatarBottom: r ? Math.round(r.bottom) : null,
      name: nameEl ? (nameEl.textContent || '').trim() : null,
      colTop: Math.round(col.getBoundingClientRect().top),
      colCenterX: Math.round(col.getBoundingClientRect().left + col.getBoundingClientRect().width / 2),
    };
  });
  const champ = document.querySelector('[data-week-champion]');
  const champAv = champ ? champ.querySelector('[data-avatar]') : null;
  const champImg = champAv ? champAv.querySelector('img') : null;
  const heroText = podium ? podium.innerText : '';
  const doc = document.documentElement;
  const clipped = (el) => {
    if (el.getAttribute('aria-hidden') === 'true' || el.closest('[aria-hidden="true"]')) return true;
    let p = el.parentElement;
    while (p) {
      const s = getComputedStyle(p);
      if (s.overflowX === 'hidden' || s.overflowX === 'clip') return true;
      p = p.parentElement;
    }
    return false;
  };
  const over = Array.from(document.querySelectorAll('main *'))
    .filter((el) => el.getBoundingClientRect().right > doc.clientWidth + 1 && !clipped(el))
    .slice(0, 6)
    .map((el) => (el.tagName + '.' + (el.className || '')).slice(0, 70));
  return {
    root: getComputedStyle(doc).fontSize,
    viewport: doc.clientWidth,
    scrollW: doc.scrollWidth,
    pageOver: over,
    podiumText: heroText.replace(/\\n/g, ' | '),
    cols,
    champion: champAv
      ? {
          kind: champAv.getAttribute('data-avatar'),
          src: champImg ? champImg.getAttribute('src') : null,
          loaded: champImg ? champImg.naturalWidth > 0 : null,
          text: champ.innerText.replace(/\\n/g, ' | '),
        }
      : null,
  };
}
"""


def set_state(page, font_size: int):
    page.evaluate(
        "(s) => localStorage.setItem('seniorLife.v1', JSON.stringify(s))",
        local_state(font_size),
    )
    page.reload(wait_until="domcontentloaded")
    page.wait_for_timeout(1800)


def open_group(page):
    page.get_by_role("navigation").get_by_role("button", name="모임").click()
    page.wait_for_timeout(1600)
    demo = page.get_by_role("button", name=re.compile("체험 모임 들어가기"))
    if demo.count():
        demo.first.click()
        page.wait_for_timeout(2500)


def open_ranking(page):
    page.get_by_role("navigation").get_by_role("button", name="랭킹").click()
    page.wait_for_timeout(2200)


def main():
    seed()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
            ctx = browser.new_context(
                viewport={"width": 390, "height": 844},
                device_scale_factor=3,
                locale="ko-KR",
                is_mobile=True,
                has_touch=True,
            )
            page = ctx.new_page()
            errs = []
            page.on("pageerror", lambda e: errs.append(str(e)))
            page.goto(f"{BASE}/", wait_until="domcontentloaded")
            page.wait_for_timeout(1500)

            names = {18: "보통", 21: "크게", 24: "아주 크게"}

            # ── ① 모임 부제 한 줄 ────────────────────────────────────
            print("\n=== ① 모임 부제 한 줄 ===")
            for size in (18, 21, 24):
                set_state(page, size)
                open_group(page)
                page.evaluate("() => window.scrollTo(0, 0)")
                page.wait_for_timeout(500)
                info = page.evaluate(GROUP_MEASURE)
                root = int(round(float(info["root"].replace("px", ""))))
                label = names.get(root, f"root {root}")
                line = info["line"]
                print(f"\n[{label}] root {info['root']} viewport {info['viewport']} scrollW {info['scrollW']}")
                print("   line ", {k: line[k] for k in ("text", "w", "font", "lines", "overflow", "ws")} if line else None)
                check(bool(line), f"{label}: 모임 부제 줄 확인")
                if line:
                    check(line["lines"] == 1, f"{label}: 부제 전체가 한 줄", f"{line['lines']}줄 · {line['text']}")
                    check(line["overflow"] == 0, f"{label}: 부제 가로 넘침 없음", f"{line['overflow']}px")
                    check(
                        re.match(r"^멤버 \d+/\d+명 · 이번 주 달성률 \d+%$", line["text"]) is not None,
                        f"{label}: 부제 문구 형태(멤버 N/M명 · 이번 주 달성률 N%)",
                        line["text"],
                    )
                    check(
                        line["right"] <= info["viewport"],
                        f"{label}: 부제가 화면 안",
                        f"{line['right']}>{info['viewport']}",
                    )
                    if info["invite"]:
                        check(
                            line["top"] >= info["invite"]["top"] + info["invite"]["h"] - 8,
                            f"{label}: 부제가 초대 버튼 아래(전체 폭) 줄에 있음",
                            f"line top {line['top']} · invite {info['invite']['top']}+{info['invite']['h']}",
                        )
                check(not info["pageOver"], f"{label}: 화면 가로 넘침 없음", str(info["pageOver"]))
                check(info["scrollW"] <= info["viewport"] + 1, f"{label}: 문서 가로 스크롤 없음", f"{info['scrollW']}/{info['viewport']}")
                page.screenshot(path=f"{SHOT}/_podium_group_{size}.png")
                if size == 24:
                    page.screenshot(path=f"{SHOT}/neulbom_group_1line_fix.png")
                if size == 21:
                    page.screenshot(path=f"{SHOT}/_podium_group_21.png")

            # ── ② 랭킹 시상대 카톡 프로필 사진 ───────────────────────
            print("\n=== ② 랭킹 시상대 ===")
            for size in (21, 24):
                set_state(page, size)
                open_ranking(page)
                page.wait_for_selector("[data-hero-podium]", timeout=20000)
                page.wait_for_timeout(800)
                info = page.evaluate(PODIUM_MEASURE)
                root = int(round(float(info["root"].replace("px", ""))))
                label = names.get(root, f"root {root}")
                print(f"\n[{label}] {info['podiumText']}")
                cols = {c["place"]: c for c in info["cols"]}
                print("   cols", json.dumps(cols, ensure_ascii=False))
                check(len(cols) == 3, f"{label}: 시상대 3칸", str(sorted(cols)))
                for place in (1, 2, 3):
                    c = cols.get(place)
                    if not c:
                        check(False, f"{label}: {place}위 칸")
                        continue
                    check(bool(c["avatarSize"]), f"{label}: {place}위 원형 아바타", str(c["avatarSize"]))
                    if place <= 2:
                        check(c["avatarKind"] == "photo", f"{label}: {place}위 카톡 프로필 사진", c["avatarKind"])
                        check(bool(c["imgSrc"]), f"{label}: {place}위 <img> 주소", (c["imgSrc"] or "")[:60])
                        check(c["imgLoaded"] is True, f"{label}: {place}위 사진 로딩", str(c["imgLoaded"]))
                        check(c["imgFit"] == "cover", f"{label}: {place}위 사진 object-cover", str(c["imgFit"]))
                        check(c["avatarRadius"].startswith("50%") or "9999px" in c["avatarRadius"], f"{label}: {place}위 원형", c["avatarRadius"])
                    else:
                        check(c["avatarKind"] == "initial", f"{label}: {place}위 사진 없는 사용자 → 이니셜 아바타", c["avatarKind"])
                    check(c["badge"] == f"{place}위", f"{label}: {place}위 등수 배지", c["badge"])
                    if c["avatarSize"] and c["badgeCenterX"] and c["avatarCenterX"]:
                        check(
                            abs(c["badgeCenterX"] - c["avatarCenterX"]) <= 3,
                            f"{label}: {place}위 배지가 사진 가운데",
                            f"{c['badgeCenterX']} / {c['avatarCenterX']}",
                        )
                        check(
                            c["avatarBottom"] - 4 <= c["badgeCenterY"] <= c["avatarBottom"] + 10,
                            f"{label}: {place}위 배지가 사진 아래 테두리에 겹침",
                            f"badge y {c['badgeCenterY']} · photo bottom {c['avatarBottom']}",
                        )
                    check(bool(c["name"]), f"{label}: {place}위 이름", c["name"])
                if 1 in cols and 2 in cols:
                    check(
                        cols[1]["avatarSize"][0] > cols[2]["avatarSize"][0],
                        f"{label}: 1위 사진이 2·3위보다 큼",
                        f"{cols[1]['avatarSize'][0]} / {cols[2]['avatarSize'][0]}",
                    )
                    check(
                        cols[1]["avatarSize"][0] >= 68 and cols[1]["avatarSize"][0] <= 76,
                        f"{label}: 1위 사진 크기 68~76px", str(cols[1]["avatarSize"][0]),
                    )
                    check(
                        52 <= cols[2]["avatarSize"][0] <= 60 and 52 <= cols[3]["avatarSize"][0] <= 60,
                        f"{label}: 2·3위 사진 크기 52~60px",
                        f"{cols[2]['avatarSize'][0]} / {cols[3]['avatarSize'][0]}",
                    )
                    check(
                        abs(cols[1]["colCenterX"] - info["viewport"] / 2) <= 6,
                        f"{label}: 1위가 가운데",
                        f"{cols[1]['colCenterX']} vs {info['viewport'] / 2}",
                    )
                    check(
                        [c["place"] for c in info["cols"]] == [2, 1, 3],
                        f"{label}: 시상대 순서(2-1-3)",
                        str([c["place"] for c in info["cols"]]),
                    )
                if info["champion"]:
                    check(info["champion"]["kind"] == "photo", f"{label}: 주간 명예의 전당 사진", info["champion"]["kind"])
                    check(info["champion"]["loaded"] is True, f"{label}: 명예의 전당 사진 로딩", str(info["champion"]["loaded"]))
                check(not info["pageOver"], f"{label}: 화면 가로 넘침 없음", str(info["pageOver"]))
                check(info["scrollW"] <= info["viewport"] + 1, f"{label}: 문서 가로 스크롤 없음", f"{info['scrollW']}/{info['viewport']}")

                page.evaluate("() => window.scrollTo(0, 0)")
                page.wait_for_timeout(400)
                page.screenshot(path=f"{SHOT}/_podium_rank_{size}.png")
                page.locator("[data-hero-podium]").screenshot(path=f"{SHOT}/_podium_card_{size}.png")
                if size == 21:
                    page.screenshot(path=f"{SHOT}/neulbom_ranking_podium_photo.png")
                    page.locator("[data-ranking-hero]").screenshot(path=f"{SHOT}/neulbom_ranking_hero_podium.png")

            if errs:
                errors.append(f"페이지 오류: {errs[:3]}")
                print("  페이지 오류:", errs[:3])
            browser.close()
    finally:
        cleanup()
        left = sql(
            f"select (select count(*) from public.users where code in ({','.join(repr(c) for c in ALL_CODES)})) as users, "
            f"(select count(*) from public.daily_visits where user_code in ({','.join(repr(c) for c in ALL_CODES)})) as visits, "
            f"(select count(*) from public.quiz_logs where user_code in ({','.join(repr(c) for c in ALL_CODES)})) as quiz"
        )
        print("\n잔여 행(삭제 후):", left)

    print(f"\n=== 결과: {sum(results)}개 통과 / {len(results)}개 · 문제 {len(errors)} ===")
    if errors:
        for e in errors:
            print("  ✗", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
