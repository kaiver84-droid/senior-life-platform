"""늘봄 카카오 로그인 전용 첫 화면 + 최초 1회 프로필 설정 흐름 검증.

- 카카오 인가만 스텁(e2e/stub_api.py)으로 흉내 내고,
  로그인 이후의 저장·조회는 배포와 같은 핸들러(functions/api/state.ts)를 Node 로 띄운
  로컬 API + 실제 Supabase 프로젝트로 검증한다.
- ① 첫 화면에 입력 폼이 없고 카카오 버튼만 있는지
- ② 로그인 직후 초기 설정(이름·태어난해·태어난시간·시도·시군구)이 뜨고 저장되는지
- ③ 저장 후 DB(users)에 profile_completed/birth_time 이 남는지
- ④ 새 브라우저(다른 기기)에서 다시 로그인하면 설정 화면을 건너뛰고 홈으로 가는지
- ⑤ ⚙ 설정에서 태어난 시간까지 고칠 수 있는지
를 확인하고 스크린샷을 downloads/ 에 남긴다.

사용법: python3 e2e/test_kakao_onboarding.py
"""
import base64
import json
import os
import socket
import subprocess
import sys
import time
import urllib.request

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from stub_api import start_server, PORT, KAKAO_ID, KAKAO_NAME, LIVE  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

SHOT = "/workspace/downloads"
TMP = "/workspace/downloads/_tiles_kakao_onboarding"
# 이 샌드박스의 헤드리스 셸은 시스템 라이브러리가 빠져 있어, 전체 chromium 바이너리를 쓴다.
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")
SUPA_TOKEN = open("/workspace/work/senior-platform/.supabase_token").read().strip()
PROJECT = "aaslirekynetqguajkpv"
BASE = f"http://127.0.0.1:{PORT}"

results = {}


def sql(query):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT}/database/query",
        data=json.dumps({"query": query}).encode(),
        headers={"Authorization": f"Bearer {SUPA_TOKEN}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read() or b"[]")


def js_make_code(seed: str) -> str:
    h = -2128831035  # 2166136261 as int32

    def i32(x):
        x &= 0xFFFFFFFF
        return x - 0x100000000 if x >= 0x80000000 else x

    for ch in seed:
        h = i32(h ^ ord(ch))
        h = i32(h * 16777619)
    n = h & 0xFFFFFFFF
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    out = ""
    while n:
        n, r = divmod(n, 36)
        out = digits[r] + out
    out = (out or "0").upper()
    return out[-6:].rjust(6, "0")


CODE = js_make_code(f"kakao_{KAKAO_ID}")
print("예상 가족 코드:", CODE)


# ---------- 로컬 /api/state 서버(같은 핸들러 + 실제 Supabase) ----------
NODE = "/workspace/work/.tools/node-v20.18.0-linux-x64/bin/node"

def load_env_file(path):
    env = {}
    for line in open(path):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
    return env


def wait_port(port, timeout=20):
    end = time.time() + timeout
    while time.time() < end:
        with socket.socket() as s:
            s.settimeout(0.5)
            if s.connect_ex(("127.0.0.1", port)) == 0:
                return True
        time.sleep(0.2)
    return False


def start_local_api():
    env = os.environ.copy()
    env.update(load_env_file("/workspace/work/senior-platform/.env.integrations"))
    env["PORT"] = "8098"
    proc = subprocess.Popen(
        [NODE, "/workspace/work/senior-platform/e2e/.local-api.mjs"],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if not wait_port(8098):
        proc.kill()
        raise RuntimeError("로컬 /api/state 서버가 뜨지 않았다")
    return proc


def crisp(page, path, wait=700):
    page.wait_for_timeout(wait)
    page.screenshot(path=path)
    return path


def compose(paths, out, labels=None):
    from PIL import Image, ImageDraw, ImageFont

    raws = [Image.open(p).convert("RGB") for p in paths]
    # 높이가 제각각이면 가장 낮은 높이에 맞춰 위를 기준으로 자른다
    w = min(im.size[0] for im in raws)
    h = min(im.size[1] for im in raws)
    imgs = [im.resize((round(im.size[0] * h / im.size[1]), h), Image.LANCZOS) for im in raws]
    gap, pad, cap = 26, 26, 56 if labels else 0
    total_w = pad * 2 + sum(im.size[0] for im in imgs) + gap * (len(imgs) - 1)
    total_h = pad * 2 + h + cap
    canvas = Image.new("RGB", (total_w, total_h), "#EFEDE4")
    d = ImageDraw.Draw(canvas)
    font = ImageFont.truetype("/usr/share/fonts/pickle-hwp/NotoSansCJKkr-Regular.otf", 26) if labels else None
    x = pad
    for i, im in enumerate(imgs):
        mask = Image.new("L", im.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.size[0], im.size[1]], radius=26, fill=255)
        canvas.paste(im, (x, pad + cap), mask)
        if labels:
            d.text((x + 4, pad + 10), labels[i], font=font, fill="#173B5E")
        x += im.size[0] + gap
    canvas.save(out, optimize=True)
    print("saved", out, canvas.size)


def main():
    os.makedirs(TMP, exist_ok=True)
    # 이전 실행의 테스트 레코드가 남아 있으면 "첫 로그인"이 아니게 되므로 지운다
    sql(f"delete from public.users where code = '{CODE}';")
    api = start_local_api()
    start_server()
    errors = []

    def check(cond, label):
        print(("  OK   " if cond else "  FAIL ") + label)
        if not cond:
            errors.append(label)

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME if os.path.exists(CHROME) else None)

        # ---------- ① 첫 화면 : 카카오 로그인 전용 ----------
        ctx = browser.new_context(viewport={"width": 402, "height": 874}, device_scale_factor=2,
                                  locale="ko-KR", timezone_id="Asia/Seoul")
        page = ctx.new_page()
        page.goto(BASE + "/", wait_until="networkidle")
        page.wait_for_selector("text=카카오톡으로 시작하기", timeout=20000)
        shot_login = crisp(page, f"{TMP}/01_login.png", 900)
        check(page.query_selector("#setup-nick") is None, "로그인 전에는 이름 입력 폼이 없다")
        check(page.query_selector("#nick") is None, "로그인 전에는 이름 입력 폼(구버전)도 없다")
        check(page.query_selector("#setup-birth") is None, "로그인 전에는 태어난 해 선택이 없다")
        check(page.get_by_role("button", name="카카오톡으로 시작하기").is_visible(), "카카오톡으로 시작하기 버튼이 보인다")
        check(page.get_by_role("button", name="카카오 없이 둘러보기 (개발용)").count() == 0,
              "프로덕션(카카오 설정됨)에서는 개발용 둘러보기가 숨겨진다")

        # ---------- ② 카카오 로그인 → 최초 1회 설정 ----------
        page.get_by_role("button", name="카카오톡으로 시작하기").click()
        page.wait_for_selector("#setup-nick", timeout=25000)
        page.wait_for_timeout(500)
        check(page.query_selector("#setup-time") is not None, "태어난 시간 선택이 있다")
        options = page.eval_on_selector_all("#setup-time [data-birthtime]", "els => els.map(e => e.getAttribute('aria-label') || e.innerText.trim())")
        print("   시간 옵션:", options)
        check(len(options) == 13, "태어난 시간은 모르겠음 + 12시진(13개)")
        check(options[0].startswith("모르겠음"), "맨 위 첫 항목은 모르겠음")
        check(options[1].startswith("자시") and "밤 11시" in options[1], "자시 버튼에 밤 11시~새벽 1시 표기")
        check(options[2].startswith("축시") and "새벽 1시" in options[2], "축시 버튼에 새벽 1시~3시 표기")
        years = page.eval_on_selector_all("#setup-birth option", "els => els.map(e => e.value)")
        check(years[0] == "1926" and years[-1] == "2020", "태어난 해 범위 1926~2020(전 연령)")
        nick_value = page.input_value("#setup-nick")
        print("   카카오 닉네임 기본값:", nick_value)
        shot_setup = crisp(page, f"{TMP}/02_setup.png", 500)

        # 입력 후 저장
        page.fill("#setup-nick", "테스트순자")
        page.select_option("#setup-birth", "1948")
        page.click('[data-birthtime="묘시"]')
        page.select_option("#setup-sido", "충청북도")
        page.select_option("#setup-sigungu", "옥천군")
        shot_setup_filled = crisp(page, f"{TMP}/02b_setup_filled.png", 300)
        page.get_by_role("button", name="저장하고 늘봄 시작하기").click()
        page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=20000)
        page.wait_for_timeout(2200)  # /api/state 저장(1.2s 디바운스 + 왕복) 기다림
        shot_home = crisp(page, f"{TMP}/03_home.png", 800)
        check(page.query_selector("nav[aria-label='주요 메뉴']") is not None, "저장 후 홈 화면으로 간다")
        stored = page.evaluate("() => JSON.parse(localStorage.getItem('seniorLife.v1')).profile")
        print("   localStorage 프로필:", stored)
        check(stored.get("profileCompleted") is True, "localStorage 에 profileCompleted=true")
        check(stored.get("birthTime") == "묘시", "localStorage 에 birthTime=묘시")

        # ---------- ③ DB(Supabase users) 확인 ----------
        row = sql(
            "select code, nickname, birth_year, birth_time, sido, sigungu, source, profile_completed "
            f"from public.users where code = '{CODE}' limit 1;"
        )
        print("   Supabase users 행:", row)
        check(bool(row), "Supabase users 에 레코드가 생겼다")
        if row:
            r = row[0]
            check(r["profile_completed"] is True, "DB profile_completed = true")
            check(r["birth_time"] == "묘시", "DB birth_time = 묘시")
            check(r["birth_year"] == 1948, "DB birth_year = 1948")
            check(r["nickname"] == "테스트순자", "DB nickname = 테스트순자")
            check(r["sido"] == "충청북도" and r["sigungu"] == "옥천군", "DB 시도/시군구 저장")

        # ---------- ⑤ ⚙ 설정에서 프로필 수정 ----------
        page.get_by_role("button", name="설정").click()
        page.wait_for_selector("text=내 정보 · 설정", timeout=8000)
        check(page.get_by_text("태어난 시간 · 묘시 (새벽 5시~7시)").count() >= 1, "설정에 태어난 시간이 보인다")
        page.get_by_role("button", name="내 정보 고치기").click()
        page.wait_for_selector("#edit-time", timeout=8000)
        page.click('[data-birthtime="진시"]')
        shot_edit = crisp(page, f"{TMP}/04_settings_edit.png", 400)
        page.get_by_role("button", name="저장", exact=True).click()
        page.wait_for_timeout(1500)
        check(page.get_by_text("태어난 시간 · 진시 (아침 7시~9시)").count() >= 1, "설정에서 태어난 시간 수정 반영")
        page.wait_for_timeout(1800)
        row2 = sql(f"select birth_time from public.users where code = '{CODE}' limit 1;")
        check(bool(row2) and row2[0]["birth_time"] == "진시", "수정한 태어난 시간이 DB에도 반영")
        ctx.close()

        # ---------- ④ 다른 기기(빈 브라우저)에서 재로그인 → 설정 건너뛰기 ----------
        ctx2 = browser.new_context(viewport={"width": 402, "height": 874}, device_scale_factor=2,
                                   locale="ko-KR", timezone_id="Asia/Seoul")
        page2 = ctx2.new_page()
        page2.goto(BASE + "/", wait_until="networkidle")
        page2.wait_for_selector("text=카카오톡으로 시작하기", timeout=20000)
        check(
            page2.evaluate("() => (JSON.parse(localStorage.getItem('seniorLife.v1')||'{}').profile) || null") is None,
            "새 브라우저에는 저장된 프로필이 없다",
        )
        page2.get_by_role("button", name="카카오톡으로 시작하기").click()
        page2.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=25000)
        page2.wait_for_timeout(1200)
        check(page2.query_selector("#setup-nick") is None, "재로그인 시 초기 설정 화면을 건너뛴다")
        restored = page2.evaluate("() => JSON.parse(localStorage.getItem('seniorLife.v1')).profile")
        print("   복원된 프로필:", restored)
        check(restored.get("nickname") == "테스트순자", "DB에서 이름을 불러왔다")
        check(restored.get("birthTime") == "진시", "DB에서 태어난 시간을 불러왔다")
        check(restored.get("profileCompleted") is True, "복원된 프로필은 완료 상태")
        shot_relogin = crisp(page2, f"{TMP}/05_relogin_home.png", 700)

        # ---------- 태어난 시간이 운세에 반영되는지 ----------
        page2.get_by_role("button", name="오늘의 운세").first.click()
        page2.wait_for_selector("text=진시 팁", timeout=8000)
        check(page2.get_by_text("아침에 태어나").count() >= 1, "운세에 시진 성향이 보인다")
        shot_fortune = crisp(page2, f"{TMP}/06_fortune.png", 500)
        page2.keyboard.press("Escape")
        ctx2.close()
        browser.close()

    # ---------- 스크린샷 합성 ----------
    compose(
        [shot_login, shot_setup_filled, shot_home],
        f"{SHOT}/neulbom_kakao_onboarding.png",
        ["① 첫 화면 · 카카오톡 로그인 전용", "② 로그인 후 최초 1회 설정", "③ 저장하면 바로 홈"],
    )
    compose(
        [shot_relogin, shot_edit, shot_fortune],
        f"{SHOT}/neulbom_kakao_relogin_skip.png",
        ["④ 다른 기기에서 재로그인 → 설정 건너뜀", "⑤ 설정에서 태어난 시간 수정", "⑥ 운세에 시간대 팁"],
    )

    print()
    api.terminate()
    if errors:
        print("실패:", len(errors))
        for e in errors:
            print(" -", e)
        sys.exit(1)
    print("모든 확인 통과 ✅  (테스트 계정 코드:", CODE, ")")


if __name__ == "__main__":
    main()
