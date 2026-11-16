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
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / ".env.integrations"
ACCOUNT = os.environ.get("CF_ACCOUNT_ID", "bbddf7735b353b9656460deab2744f9b")
PROJECT = os.environ.get("CF_PROJECT", "senior-life-platform")
API = "https://api.cloudflare.com/client/v4"
SITE = os.environ.get("SITE_URL", "https://senior-life-platform.pages.dev")
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
    # node_modules 가 이미 있으면 npm install 을 건너뛴다.
    # (package-lock.json 의 optional fsevents 항목에 version 이 비어 있어 `npm install` 이
    #  `Invalid Version` 으로 실패하는 상태 — 의존성은 이미 설치돼 있으므로 빌드에는 영향 없음)
    if (ROOT / "node_modules").is_dir():
        print("node_modules 있음 → npm install 건너뜀")
    else:
        run(["npm", "install", "--no-audit", "--no-fund", "--omit=optional"], ROOT)
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


def get_json(path: str, method: str = "GET", body: dict | None = None) -> tuple[int, dict]:
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        SITE + path,
        data=data,
        method=method,
        headers={"User-Agent": "Mozilla/5.0", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return res.status, json.loads(res.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, {"raw": e.read().decode()[:300]}


def verify() -> int:
    """라이브 검증: health(DB 연결) → state 쓰기/읽기(Supabase 왕복) → rankings.

    주의: lib/db.ts 의 dbStatus() 는 연결 시 `"connected"` 를 돌려준다(구버전 표기 `"ok"` 도 허용).
    """
    ok = True

    status, health = get_json("/api/health")
    print(f"health  [{status}]", json.dumps(health, ensure_ascii=False))
    supabase_ok = status == 200 and health.get("supabase") in ("connected", "ok")
    ok = ok and supabase_ok

    code = "VERIFY01"
    today = subprocess.run(["date", "-u", "+%Y-%m-%d"], capture_output=True, text=True).stdout.strip()
    profile = {
        "id": "verify",
        "nickname": "연동검증",
        "birthYear": 1955,
        "sido": "충청북도",
        "sigungu": "옥천군",
        "source": "demo",
        "createdAt": today + "T00:00:00Z",
    }
    status, saved = get_json(
        "/api/state",
        "POST",
        {"code": code, "profile": profile, "today": today,
         "quizLogs": [{"date": today, "weekId": "VERIFY-W", "correct": 2, "total": 3, "points": 20, "seconds": 40, "types": ["add"]}]},
    )
    print(f"state POST [{status}]", json.dumps(saved, ensure_ascii=False))
    ok = ok and status == 200 and bool(saved.get("ok")) and saved.get("mode") == "connected"

    status, state = get_json(f"/api/state?code={code}")
    print(f"state GET  [{status}]", json.dumps(state, ensure_ascii=False)[:300])
    got_profile = ((state.get("state") or {}).get("profile") or {}).get("nickname")
    ok = ok and status == 200 and got_profile == profile["nickname"]

    status, rankings = get_json("/api/rankings?scope=region&sido=충청북도&sigungu=옥천군&points=20&streak=1")
    print(f"rankings   [{status}]", json.dumps(rankings, ensure_ascii=False)[:200])
    ok = ok and status == 200 and bool(rankings.get("ok"))

    status, kakao = get_json("/api/auth/kakao")
    print(f"kakao      [{status}]", json.dumps(kakao, ensure_ascii=False)[:200], "(카카오 키는 이번 범위 아님)")

    if not ok:
        print("주의: 아직 demo 상태입니다. 키 값과 Cloudflare 변수 타입(secret_text), 재배포 여부를 확인하세요.")
    else:
        print("검증 통과: Supabase 실연동 확인(health/state 쓰기·읽기/rankings).")
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
        # 부분 연동 허용: 없는 키는 건너뛰고 경고만 남긴다(예: 카카오 키 없이 Supabase만 연결).
        print("넘어갈 키(값 없음):", ", ".join(missing), file=sys.stderr)
    if not values.get("NEXT_PUBLIC_SUPABASE_URL"):
        sys.exit("NEXT_PUBLIC_SUPABASE_URL 이 없으면 아무것도 연결할 수 없습니다.")
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
