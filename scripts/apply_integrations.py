#!/usr/bin/env python3
"""시니어 플랫폼 실서비스 연동 마무리 스크립트.

하는 일
1) `work/senior-platform/.env.integrations` (git 제외) 에 적힌 값을 읽어
   Cloudflare Pages 프로젝트의 **secret_text 환경변수**로 넣는다.
   - secret_text 는 `wrangler pages deploy` 로 배포해도 지워지지 않는다(실측).
   - 이미 있는 다른 변수는 그대로 둔다(읽어서 병합).
2) `--deploy` 를 주면 빌드 → `out/_worker.js` 번들 → wrangler 로 프로덕션 배포 →
   라이브 `/api/health`, `/api/auth/kakao` 검증까지 한다.

`.env.integrations` 예시 (값은 절대 저장소에 커밋하지 않는다 — .gitignore 의 .env* 규칙에 걸림)

    NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
    SUPABASE_SERVICE_ROLE_KEY=eyJ...
    NEXT_PUBLIC_KAKAO_JS_KEY=abcdef...
    KAKAO_CLIENT_ID=abcdef...
    KAKAO_CLIENT_SECRET=xyz...

사용
    python3 scripts/apply_integrations.py                  # 환경변수만 등록
    python3 scripts/apply_integrations.py --deploy          # 등록 + 빌드 + 배포 + 검증
"""
import argparse
import json
import os
import pathlib
import re
import subprocess
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / ".env.integrations"
ACCOUNT = os.environ.get("CF_ACCOUNT_ID", "bbddf7735b353b9656460deab2744f9b")
PROJECT = os.environ.get("CF_PROJECT", "senior-life-platform")
API = "https://api.cloudflare.com/client/v4"
NODE_BIN = "/workspace/work/.tools/node-v20.18.0-linux-x64/bin"

RUNTIME_KEYS = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_KAKAO_JS_KEY",
    "KAKAO_CLIENT_ID",
    "KAKAO_CLIENT_SECRET",
    "KAKAO_REDIRECT_URI",
    "NEXT_PUBLIC_SITE_URL",
]


def token() -> str:
    value = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    if value:
        return value
    path = ROOT / ".cloudflare_token"
    if not path.exists():
        sys.exit(".cloudflare_token 이 없습니다.")
    return path.read_text().strip()


def call(path: str, method: str = "GET", body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        API + path,
        data=data,
        method=method,
        headers={"Authorization": "Bearer " + token(), "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.loads(response.read().decode())


def read_env_file() -> dict:
    if not ENV_FILE.exists():
        sys.exit(f"{ENV_FILE} 가 없습니다. 키를 적은 뒤 다시 실행하세요.")
    values = {}
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if key:
            values[key] = value
    return values


def apply_env(values: dict) -> None:
    project = call(f"/accounts/{ACCOUNT}/pages/projects/{PROJECT}")["result"]
    for env_name in ("production", "preview"):
        current = (project["deployment_configs"].get(env_name) or {}).get("env_vars") or {}
        merged = dict(current)
        for key in RUNTIME_KEYS:
            if values.get(key):
                merged[key] = {"type": "secret_text", "value": values[key]}
        body = {"deployment_configs": {env_name: {"env_vars": merged}}}
        call(f"/accounts/{ACCOUNT}/pages/projects/{PROJECT}", "PATCH", body)
        print(f"  {env_name}: " + ", ".join(sorted(k for k in merged if k in RUNTIME_KEYS)))


def run(cmd: list, cwd: pathlib.Path, env_extra: dict | None = None) -> None:
    env = os.environ.copy()
    env["PATH"] = NODE_BIN + os.pathsep + env.get("PATH", "")
    env.update(env_extra or {})
    print("$", " ".join(cmd))
    subprocess.run(cmd, cwd=cwd, env=env, check=True)


def deploy(values: dict) -> None:
    build_env = {k: v for k, v in values.items() if k.startswith("NEXT_PUBLIC_")}
    build_env.setdefault("NEXT_PUBLIC_SITE_URL", "https://senior-life-platform.pages.dev")
    run(["npm", "install", "--no-audit", "--no-fund"], ROOT)
    run(["npm", "run", "build"], ROOT, build_env)
    run(
        ["npx", "--yes", "esbuild@0.24.0", "functions-entry.ts", "--bundle", "--format=esm",
         "--platform=browser", "--target=es2022", "--outfile=out/_worker.js"],
        ROOT,
    )
    run(
        ["npx", "--yes", "wrangler@3", "pages", "deploy", "out",
         "--project-name=" + PROJECT, "--branch=main", "--commit-dirty=true"],
        ROOT,
        {"CLOUDFLARE_API_TOKEN": token(), "CLOUDFLARE_ACCOUNT_ID": ACCOUNT},
    )


def verify() -> int:
    health = urllib.request.urlopen(
        urllib.request.Request(
            "https://senior-life-platform.pages.dev/api/health",
            headers={"User-Agent": "Mozilla/5.0"},
        ),
        timeout=30,
    ).read().decode()
    kakao = urllib.request.urlopen(
        urllib.request.Request(
            "https://senior-life-platform.pages.dev/api/auth/kakao",
            headers={"User-Agent": "Mozilla/5.0"},
        ),
        timeout=30,
    ).read().decode()
    print("health:", health)
    print("kakao :", kakao)
    ok = '"supabase":"ok"' in health.replace(" ", "") and '"kakaoConfigured":true' in kakao.replace(" ", "")
    if not ok:
        print("주의: 아직 demo/not-configured 입니다. 키 값과 Cloudflare 변수 타입(secret_text)을 확인하세요.")
    return 0 if ok else 1


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--deploy", action="store_true")
    args = parser.parse_args()

    if not ENV_FILE.exists():
        sys.exit(f"{ENV_FILE} 가 없습니다. 키를 적은 뒤 다시 실행하세요.")
    values = read_env_file()
    optional = ("KAKAO_REDIRECT_URI", "NEXT_PUBLIC_SITE_URL")
    missing = [k for k in RUNTIME_KEYS if not values.get(k) and k not in optional]
    if missing:
        print("빠진 키:", ", ".join(missing), file=sys.stderr)
        sys.exit(1)
    values.setdefault("KAKAO_REDIRECT_URI", "https://senior-life-platform.pages.dev/")

    print("Cloudflare Pages 환경변수 등록(secret_text):")
    apply_env(values)

    if args.deploy:
        deploy(values)
        sys.exit(verify())
    print("환경변수만 등록했습니다. 배포하려면 --deploy 를 붙여 다시 실행하세요.")
    print("(환경변수는 배포 시점에 바인딩되므로, 값 변경 후에는 반드시 재배포해야 합니다.)")


if __name__ == "__main__":
    main()
