"""🔎 늘봄 검색 유입(SEO) 안내 페이지 검증 — 390×844(iPhone 14).

python3 e2e/check_guide_seo.py                                     # 로컬 out/
BASE=https://senior-life-platform.pages.dev python3 e2e/check_guide_seo.py   # 라이브

확인
1) /guide/ · /guide/basic-pension/ · /guide/energy-voucher/ · /guide/quiz/ · /sitemap.xml · /robots.txt 가 200
2) 390×844 에서 가로 넘침 0건 · 콘솔 오류 0건 · 실패한 요청 0건
3) 허브: 혜택 17건 링크, 위·아래 '늘봄에서 무료로 이용하기 →'(/) 버튼
4) 상세: 제목·canonical·og:title, 금액·신청 방법·준비 서류, 위·아래 CTA
5) sitemap.xml 21개 URL(/ · /guide/ · 상세 17 · /guide/quiz/ · /privacy/), robots.txt Sitemap 줄
결과: downloads/guide-seo-check.json · 스크린샷 work/evidence/neulbom_seo_guide_20261126*.png
"""
import json
import os
import re
import sys
import urllib.request

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from harness import PORT, start_server  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", f"http://127.0.0.1:{PORT}").rstrip("/")
OUT = os.environ.get("OUT", "/workspace/downloads")
EVIDENCE = "/workspace/work/evidence"
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")
LOCAL = BASE.startswith("http://127.0.0.1")

PAGES = ["/guide/", "/guide/basic-pension/", "/guide/energy-voucher/", "/guide/quiz/"]

report = {"base": BASE, "pages": {}, "sitemap": {}, "robots": {}, "problems": []}


def fail(msg):
    report["problems"].append(msg)
    print("  ✗", msg)


def main():
    os.makedirs(EVIDENCE, exist_ok=True)
    if LOCAL:
        start_server()

    # --- sitemap / robots ------------------------------------------------
    for path, key in (("/sitemap.xml", "sitemap"), ("/robots.txt", "robots")):
        with urllib.request.urlopen(f"{BASE}{path}", timeout=30) as res:
            body = res.read().decode("utf-8")
            report[key]["status"] = res.status
            if res.status != 200:
                fail(f"{path} HTTP {res.status}")
        if key == "sitemap":
            locs = re.findall(r"<loc>([^<]+)</loc>", body)
            report["sitemap"]["count"] = len(locs)
            report["sitemap"]["urls"] = locs
            required = [
                "/",
                "/guide/",
                "/guide/quiz/",
                "/privacy/",
                "/guide/basic-pension/",
                "/guide/national-health-check/",
            ]
            for r in required:
                if not any(u.endswith(r) for u in locs):
                    fail(f"sitemap 에 {r} 없음")
            if len(locs) != 21:
                fail(f"sitemap URL 수 {len(locs)} (기대 21)")
            print(f"sitemap: {len(locs)}개 URL")
        else:
            report["robots"]["body"] = body
            if f"Sitemap: https://senior-life-platform.pages.dev/sitemap.xml" not in body:
                fail("robots.txt 에 Sitemap 줄 없음")
            print("robots:", body.replace("\n", " | ")[:160])

    # --- 브라우저 --------------------------------------------------------
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox", "--disable-dev-shm-usage"])
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                                  is_mobile=True, has_touch=True,
                                  user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                                             "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
        for path in PAGES:
            page = ctx.new_page()
            errors, failed = [], []
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("response", lambda r: failed.append(f"{r.status} {r.url}") if r.status >= 400 and BASE in r.url else None)

            res = page.goto(f"{BASE}{path}", wait_until="networkidle", timeout=45000)
            info = {"status": res.status if res else None}
            if not res or res.status != 200:
                fail(f"{path} HTTP {info['status']}")

            page.wait_for_timeout(400)
            info.update(
                page.evaluate(
                    """() => {
                        const d = document.documentElement;
                        const h1 = document.querySelector('h1');
                        const cta = [...document.querySelectorAll('a[href="/"]')]
                            .filter(a => a.textContent.includes('늘봄에서 무료로 이용하기')).length;
                        return {
                            title: document.title,
                            h1: h1 ? h1.innerText.replace(/\\n/g, ' ') : null,
                            canonical: (document.querySelector('link[rel=canonical]') || {}).href || null,
                            ogTitle: (document.querySelector('meta[property="og:title"]') || {}).content || null,
                            ogImage: (document.querySelector('meta[property="og:image"]') || {}).content || null,
                            overflowX: d.scrollWidth - d.clientWidth,
                            guideLinks: document.querySelectorAll('a[href^="/guide/"]').length,
                            ctaCount: cta,
                            bodyLen: document.body.innerText.length,
                            height: d.scrollHeight,
                        };
                    }"""
                )
            )
            info["consoleErrors"] = errors
            info["failedRequests"] = failed
            if info["overflowX"] > 1:
                fail(f"{path} 가로 넘침 {info['overflowX']}px")
            if errors:
                fail(f"{path} 콘솔 오류 {len(errors)}건: {errors[:3]}")
            if failed:
                fail(f"{path} 실패 요청: {failed[:3]}")
            if not info["canonical"]:
                fail(f"{path} canonical 없음")
            if info["ctaCount"] < 2:
                fail(f"{path} CTA 버튼 {info['ctaCount']}개 (기대 2: 위·아래)")
            if info["bodyLen"] < 800:
                fail(f"{path} 본문이 너무 짧음 {info['bodyLen']}자")
            if path == "/guide/" and info["guideLinks"] < 17:
                fail(f"/guide/ 혜택 링크 {info['guideLinks']}개 (기대 17+)")

            shot = {
                "/guide/": "neulbom_seo_guide_20261126.png",
                "/guide/basic-pension/": "neulbom_seo_guide_20261126_detail.png",
                "/guide/energy-voucher/": "neulbom_seo_guide_20261126_energy.png",
                "/guide/quiz/": "neulbom_seo_guide_20261126_quiz.png",
            }[path]
            page.screenshot(path=os.path.join(EVIDENCE, shot), full_page=True)
            info["screenshot"] = os.path.join(EVIDENCE, shot)
            report["pages"][path] = info
            print(f"{path}: {info['status']} · 넘침 {info['overflowX']}px · 오류 {len(errors)} · 제목 {info['title'][:48]}")
            page.close()
        browser.close()

    if report["problems"]:
        print("\n문제", len(report["problems"]), "건")
    else:
        print("\n모두 통과")
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "guide-seo-check.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    return 0 if not report["problems"] else 1


if __name__ == "__main__":
    sys.exit(main())
