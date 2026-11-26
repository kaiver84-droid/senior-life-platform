"""🔒 늘봄 개인정보처리방침 문의처(운영자 이메일) 검증 — 390×844(iPhone 14).

python3 e2e/check_privacy_contact.py                                     # 로컬 out/
BASE=https://senior-life-platform.pages.dev python3 e2e/check_privacy_contact.py   # 라이브

확인
1) /privacy/ 200 · canonical /privacy/
2) '10. 문의' 아래 '연락처 — kaiver84@gmail.com' 표시 + mailto:kaiver84@gmail.com 링크
3) 390×844 가로 넘침 0px · 콘솔 오류 0건 · 실패 요청 0건 (글씨 보통·크게·아주 크게 3단계)
4) 스크린샷 work/evidence/neulbom_privacy_contact_20261126.png (전체) · _view.png (문의처 화면)
결과: downloads/privacy-contact-check.json
"""
import json
import os
import sys

sys.path.insert(0, "/workspace/work/senior-platform/e2e")
from harness import PORT, start_server  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

BASE = os.environ.get("BASE", f"http://127.0.0.1:{PORT}").rstrip("/")
OUT = os.environ.get("OUT", "/workspace/downloads")
EVIDENCE = "/workspace/work/evidence"
CHROME = os.environ.get("CHROME_PATH", "/workspace/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome")
LOCAL = BASE.startswith("http://127.0.0.1")
CONTACT = "kaiver84@gmail.com"
FONT_SIZES = ((18, "보통"), (21, "크게"), (24, "아주 크게"))

report = {"base": BASE, "checks": {}, "problems": []}


def fail(msg):
    report["problems"].append(msg)
    print("  ✗", msg)


def main():
    os.makedirs(EVIDENCE, exist_ok=True)
    if LOCAL:
        start_server()

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox", "--disable-dev-shm-usage"])
        for size, label in FONT_SIZES:
            ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                                      is_mobile=True, has_touch=True,
                                      user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                                                 "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
            page = ctx.new_page()
            errors, failed = [], []
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("response", lambda r: failed.append(f"{r.status} {r.url}") if r.status >= 400 and BASE in r.url else None)

            if size != 18:
                page.add_init_script(
                    """(() => { try {
                        const raw = localStorage.getItem('seniorLife.v1');
                        const v = raw ? JSON.parse(raw) : {};
                        v.fontSize = %d;
                        localStorage.setItem('seniorLife.v1', JSON.stringify(v));
                    } catch (e) {} })()""" % size
                )

            res = page.goto(f"{BASE}/privacy/", wait_until="networkidle", timeout=45000)
            status = res.status if res else None
            if status != 200:
                fail(f"/privacy/ HTTP {status}")
            page.wait_for_timeout(400)

            info = page.evaluate(
                """(contact) => {
                    const d = document.documentElement;
                    const links = [...document.querySelectorAll('a[href^="mailto:"]')];
                    const hit = links.find(a => a.getAttribute('href') === 'mailto:' + contact);
                    const section = [...document.querySelectorAll('section')]
                        .find(s => (s.querySelector('h2') || {}).textContent?.trim().startsWith('10. 문의'));
                    return {
                        title: document.title,
                        canonical: (document.querySelector('link[rel=canonical]') || {}).href || null,
                        overflowX: d.scrollWidth - d.clientWidth,
                        fontPx: getComputedStyle(d).getPropertyValue('--app-font').trim(),
                        sectionText: section ? section.innerText.replace(/\\n/g, ' | ') : null,
                        mailtoHref: hit ? hit.getAttribute('href') : null,
                        mailtoText: hit ? hit.innerText.trim() : null,
                        mailtoVisible: hit ? (hit.getBoundingClientRect().width > 0 && hit.getBoundingClientRect().height > 0) : false,
                        mailtoColor: hit ? getComputedStyle(hit).color : null,
                        bodyHasContact: document.body.innerText.includes(contact),
                    };
                }""",
                CONTACT,
            )
            report["checks"][label] = {**info, "status": status, "consoleErrors": errors, "failedRequests": failed}

            tag = f"[{label}]"
            print(tag, "font", info["fontPx"] or "-(기본)", "| 문의처", info["mailtoText"], "| 넘침", info["overflowX"], "px",
                  "| 콘솔", len(errors), "| 실패", len(failed))
            print(tag, "문의 절:", info["sectionText"])

            if not info["mailtoHref"]:
                fail(f"{tag} mailto:{CONTACT} 링크 없음")
            if not info["bodyHasContact"]:
                fail(f"{tag} 본문에 {CONTACT} 없음")
            if info["mailtoHref"] and not info["mailtoVisible"]:
                fail(f"{tag} 문의처 링크가 화면에 그려지지 않음")
            if info["overflowX"] > 1:
                fail(f"{tag} 가로 넘침 {info['overflowX']}px")
            if errors:
                fail(f"{tag} 콘솔 오류 {len(errors)}건: {errors[:3]}")
            if failed:
                fail(f"{tag} 실패 요청: {failed[:3]}")
            if not info["canonical"]:
                fail(f"{tag} canonical 없음")
            if info["sectionText"] and CONTACT not in info["sectionText"]:
                fail(f"{tag} '10. 문의' 절에 연락처 없음")

            if size == 18:
                page.screenshot(path=f"{EVIDENCE}/neulbom_privacy_contact_20261126.png", full_page=True)
                page.locator("text=10. 문의").scroll_into_view_if_needed()
                page.wait_for_timeout(250)
                page.screenshot(path=f"{EVIDENCE}/neulbom_privacy_contact_20261126_view.png")
            ctx.close()
        browser.close()

    report["ok"] = not report["problems"]
    with open(f"{OUT}/privacy-contact-check.json", "w") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print("결과:", "OK" if report["ok"] else f"{len(report['problems'])} 문제", "|", f"{OUT}/privacy-contact-check.json")
    sys.exit(0 if report["ok"] else 1)


if __name__ == "__main__":
    main()
