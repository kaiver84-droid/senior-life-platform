#!/usr/bin/env python3
"""Cloudflare Pages 에 out/ 를 직접 업로드한다 (wrangler 없이 REST API).

사전 준비:
  npm run build                # out/ 생성
  bun build functions-entry.ts --target browser --format esm --outfile out/_worker.js
  .cloudflare_token 파일에 Pages:Edit 권한 토큰

실행: python3 deploy_cloudflare.py
"""
import hashlib
import json
import mimetypes
import os
import pathlib
import sys
import time
import urllib.error
import urllib.request
import uuid

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "out"
TOKEN = (ROOT / ".cloudflare_token").read_text().strip()
ACCOUNT = os.environ.get("CF_ACCOUNT_ID", "bbddf7735b353b9656460deab2744f9b")
PROJECT = os.environ.get("CF_PROJECT", "senior-life-platform")
API = "https://api.cloudflare.com/client/v4"


def api(path, method="GET", body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        API + path,
        data=data,
        method=method,
        headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read().decode()[:1500], file=sys.stderr)
        raise


def ensure_project():
    res = api(f"/accounts/{ACCOUNT}/pages/projects")
    names = [p["name"] for p in res.get("result", [])]
    if PROJECT in names:
        print("project exists:", PROJECT)
        return
    res = api(
        f"/accounts/{ACCOUNT}/pages/projects",
        method="POST",
        body={"name": PROJECT, "production_branch": "main"},
    )
    print("project created:", res["result"]["name"], res["result"].get("subdomain"))


def collect():
    files = []
    for p in sorted(OUT.rglob("*")):
        if p.is_file():
            rel = "/" + p.relative_to(OUT).as_posix()
            data = p.read_bytes()
            files.append((rel, hashlib.sha256(data).hexdigest(), data))
    return files


def multipart(fields, files):
    boundary = "----pickle" + uuid.uuid4().hex
    body = b""
    for k, v in fields.items():
        body += b"--" + boundary.encode() + b"\r\n"
        body += f'Content-Disposition: form-data; name="{k}"\r\n\r\n'.encode()
        body += v.encode() + b"\r\n"
    for name, filename, data, ctype in files:
        body += b"--" + boundary.encode() + b"\r\n"
        body += f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode()
        body += f"Content-Type: {ctype}\r\n\r\n".encode()
        body += data + b"\r\n"
    body += b"--" + boundary.encode() + b"--\r\n"
    return body, boundary


def deploy(files, style="hash-name"):
    manifest = {rel: h for rel, h, _ in files}
    parts = []
    for rel, h, data in files:
        ctype = mimetypes.guess_type(rel)[0] or "application/octet-stream"
        if style == "hash-name":
            parts.append((h, rel, data, ctype))
        else:
            parts.append((rel, rel, data, ctype))
    body, boundary = multipart({"manifest": json.dumps(manifest)}, parts)
    req = urllib.request.Request(
        f"{API}/accounts/{ACCOUNT}/pages/projects/{PROJECT}/deployments",
        data=body,
        method="POST",
        headers={
            "Authorization": "Bearer " + TOKEN,
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        print("deploy HTTP", e.code, e.read().decode()[:2000], file=sys.stderr)
        raise


def main():
    if not OUT.exists():
        print("out/ 가 없습니다. 먼저 빌드하세요.", file=sys.stderr)
        sys.exit(1)
    ensure_project()
    files = collect()
    total = sum(len(d) for _, _, d in files)
    print(f"uploading {len(files)} files ({total/1024/1024:.1f} MB)")
    res = deploy(files)
    d = res["result"]
    print("deployment:", d.get("id"), d.get("url"), d.get("environment"))
    dep_id = d["id"]
    for i in range(40):
        time.sleep(3)
        cur = api(f"/accounts/{ACCOUNT}/pages/projects/{PROJECT}/deployments/{dep_id}")["result"]
        stage = cur.get("latest_stage", {}).get("name")
        status = cur.get("latest_stage", {}).get("status")
        print(i, stage, status, cur.get("url"), flush=True)
        if status in ("success", "failure"):
            print(json.dumps({"url": "https://" + (cur.get("url") or ""), "status": status}))
            return
    print("timeout waiting for deployment")


if __name__ == "__main__":
    main()
