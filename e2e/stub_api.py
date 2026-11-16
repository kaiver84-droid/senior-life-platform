"""로컬 검증용 스텁 서버.

- `out/` 정적 파일을 그대로 서빙하고,
- `/api/auth/kakao` 만 가짜로 응답해 **카카오 인가 → code 콜백** 흐름을 흉내 낸다.
- `/api/state` 는 실제 라이브(프로덕션 Pages Functions)로 그대로 넘겨
  Supabase 저장·조회가 진짜로 일어나게 한다.
"""
import functools
import http.server
import json
import os
import socketserver
import threading
import urllib.error
import urllib.request

ROOT = "/workspace/work/senior-platform/out"
PORT = 8099
# /api/state 요청은 같은 핸들러를 Node 로 돌리는 로컬 서버(e2e/local-api.ts)로 넘긴다.
LIVE = os.environ.get("LOCAL_API", "http://127.0.0.1:8098")
KAKAO_ID = os.environ.get("STUB_KAKAO_ID", "777000111")
KAKAO_NAME = os.environ.get("STUB_KAKAO_NAME", "카카오테스트")
KAKAO_YEAR = int(os.environ.get("STUB_KAKAO_YEAR", "0") or 0)


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):  # 조용히
        pass

    # ---------- helpers ----------
    def _json(self, obj, status=200):
        raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(raw)))
        self.send_header("cache-control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def _proxy(self, method):
        length = int(self.headers.get("content-length") or 0)
        body = self.rfile.read(length) if length else None
        req = urllib.request.Request(f"{LIVE}{self.path}", data=body, method=method)
        req.add_header("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15")
        if body:
            req.add_header("content-type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=25) as res:
                raw = res.read()
                self.send_response(res.status)
                self.send_header("content-type", res.headers.get("content-type", "application/json"))
                self.send_header("content-length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)
        except urllib.error.HTTPError as e:
            raw = e.read()
            self.send_response(e.code)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
        except Exception as e:  # noqa: BLE001
            self._json({"ok": False, "error": str(e)[:200], "proxy": True}, 502)

    # ---------- routes ----------
    def do_GET(self):
        path = self.path.split("?")[0].rstrip("/") or "/"
        if path == "/api/auth/kakao":
            if "start=1" in self.path:
                # 카카오 인가 화면을 건너뛰고 곧바로 code 콜백으로
                self.send_response(302)
                self.send_header("location", "/?code=STUB-AUTH-CODE")
                self.end_headers()
                return
            self._json(
                {
                    "ok": True,
                    "supabase": "connected",
                    "kakao": "configured",
                    "kakaoLoginConfigured": True,
                    # 서버 경유(302) 폴백 경로를 검증하려고 JS SDK 경로는 끈다
                    "kakaoJsConfigured": False,
                    "redirectUri": f"http://127.0.0.1:{PORT}/",
                }
            )
            return
        if path in ("/api/state", "/api/rankings"):
            self._proxy("GET")
            return
        if path == "/api/health":
            self._json({"ok": True, "stub": True})
            return
        return super().do_GET()

    def do_POST(self):
        path = self.path.split("?")[0].rstrip("/") or "/"
        if path == "/api/auth/kakao":
            length = int(self.headers.get("content-length") or 0)
            raw = self.rfile.read(length) if length else b"{}"
            try:
                body = json.loads(raw or b"{}")
            except Exception:  # noqa: BLE001
                body = {}
            if not body.get("code"):
                self._json({"ok": False, "error": "code_required"}, 400)
                return
            profile = {
                "id": f"kakao_{KAKAO_ID}",
                "nickname": KAKAO_NAME,
                "birthYear": KAKAO_YEAR,
                "sido": "",
                "sigungu": "",
                "source": "kakao",
                "createdAt": "2026-11-16T00:00:00.000Z",
            }
            self._json({"ok": True, "profile": profile, "needsProfile": True})
            return
        if path == "/api/state":
            self._proxy("POST")
            return
        self._json({"ok": False, "error": "not_found"}, 404)


class Quiet(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def start_server():
    handler = functools.partial(Handler, directory=ROOT)
    httpd = Quiet(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


if __name__ == "__main__":
    start_server()
    print(f"stub api on http://127.0.0.1:{PORT} (state -> {LIVE})")
    threading.Event().wait()
