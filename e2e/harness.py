"""로컬 정적 빌드(out/)를 서빙하며 Playwright 로 검증하는 공용 도구."""
import http.server
import socketserver
import threading
import functools
import os
import sys

ROOT = "/workspace/work/senior-platform/out"
PORT = 8099


def start_server():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True

    class Quiet(socketserver.ThreadingTCPServer):
        allow_reuse_address = True
        daemon_threads = True

    httpd = Quiet(("127.0.0.1", PORT), handler)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd


def onboard(page, name="순자", birth="1952", sido="충청북도", sigungu="옥천군"):
    page.goto(f"http://127.0.0.1:{PORT}/", wait_until="domcontentloaded")
    page.wait_for_selector("#nick", timeout=15000)
    page.fill("#nick", name)
    page.select_option("#birth", birth)
    page.select_option("#sido", sido)
    page.select_option("#sigungu", sigungu)
    page.get_by_role("button", name="시작하기", exact=True).click()
    page.wait_for_selector("nav[aria-label='주요 메뉴']", timeout=15000)
    page.wait_for_timeout(800)
