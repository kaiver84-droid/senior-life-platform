"""시·도 기준 지역 랭킹 라이브 검증 — 같은 도의 다른 시·군은 함께, 다른 도는 따로.

- 임시 계정 3개를 DB 에 만들고(충청북도 청주시 / 약칭 '충북' 청주시 / 대전광역시 서구)
  이번 주 점수를 채운 뒤 /api/rankings?range=region 으로 확인하고, 끝나면 모두 지운다.
- 실행: python3 e2e/verify_region_sido.py
"""
import json
import os
import sys
import urllib.parse
import urllib.request

TOKEN = open("/workspace/work/senior-platform/.supabase_token").read().strip()
PROJECT = "aaslirekynetqguajkpv"
BASE = os.environ.get("BASE", "https://senior-life-platform.pages.dev").rstrip("/")
TODAY = "2026-11-19"
DATES = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"]
WEEK = "2026-W47"

A = {"code": "ZZREG01", "name": "청주검증", "sido": "충청북도", "sigungu": "청주시"}
B = {"code": "ZZREG02", "name": "충북약칭검증", "sido": "충북", "sigungu": "청주시"}
C = {"code": "ZZREG03", "name": "대전검증", "sido": "대전광역시", "sigungu": "서구"}

errors = []


def check(cond, label, extra=""):
    print(("  OK   " if cond else "  FAIL ") + label + (f" — {extra}" if extra else ""))
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


def api(params):
    url = f"{BASE}/api/rankings?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
            "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read())


def cleanup():
    codes = ",".join(f"'{u['code']}'" for u in (A, B, C))
    for table, col in (
        ("daily_visits", "user_code"),
        ("quiz_logs", "user_code"),
        ("health_checks", "user_code"),
        ("activity_logs", "user_code"),
        ("group_members", "user_code"),
        ("users", "code"),
    ):
        try:
            sql(f"delete from public.{table} where {col} in ({codes});")
        except Exception as e:  # noqa: BLE001
            print("  (cleanup skip)", table, e)


def seed():
    cleanup()
    for u in (A, B, C):
        sql(
            "insert into public.users (code, nickname, sido, sigungu, birth_year, source, ranking_visible, profile_completed, created_at) "
            f"values ('{u['code']}','{u['name']}','{u['sido']}','{u['sigungu']}',1952,'demo',true,true,'{DATES[0]} 00:10:00+00');"
        )
        for d in DATES:
            sql(
                f"insert into public.daily_visits (user_code, visit_date) values ('{u['code']}','{d}');"
            )
            sql(
                "insert into public.quiz_logs (user_code, quiz_date, week_id, correct, total, points) "
                f"values ('{u['code']}','{d}','{WEEK}',3,3,30);"
            )
            sql(
                "insert into public.health_checks (user_code, check_date, challenges) "
                f"values ('{u['code']}','{d}',array['walk']);"
            )
            sql(
                "insert into public.activity_logs (user_code, activity_date, kind) "
                f"values ('{u['code']}','{d}','welfare'),('{u['code']}','{d}','group');"
            )


def names(res):
    return [(r.get("name"), r.get("points")) for r in res.get("rows", [])]


def main():
    seed()
    try:
        res_cb = api({"area": "all", "range": "region", "sido": "충청북도", "today": TODAY, "code": "TF1J4S"})
        print("\n[충청북도] regionLabel =", res_cb.get("regionLabel"), "| total =", res_cb.get("total"))
        print("  rows:", names(res_cb))
        check(res_cb.get("regionLabel") == "충청북도", "응답 regionLabel = 충청북도", str(res_cb.get("regionLabel")))
        n_cb = [n for n, _ in names(res_cb)]
        check(A["name"] in n_cb, "충청북도 청주시 사용자가 지역 랭킹에 함께 묶임", str(n_cb))
        check(B["name"] in n_cb, "약칭 '충북' 사용자도 충청북도로 정규화되어 함께 묶임", str(n_cb))
        check(C["name"] not in n_cb, "대전광역시 사용자는 충청북도 랭킹에서 빠짐")

        res_alias = api({"area": "all", "range": "region", "sido": "충북", "today": TODAY, "code": "TF1J4S"})
        check(res_alias.get("regionLabel") == "충청북도", "약칭 '충북'으로 물어도 regionLabel = 충청북도")
        check(names(res_alias) and names(res_alias)[0][0] == names(res_cb)[0][0], "약칭·정식 명칭이 같은 순위표를 돌려줌")

        res_dj = api({"area": "all", "range": "region", "sido": "대전광역시", "today": TODAY, "code": "TF1J4S"})
        print("\n[대전광역시] regionLabel =", res_dj.get("regionLabel"), "| rows:", names(res_dj))
        n_dj = [n for n, _ in names(res_dj)]
        check(C["name"] in n_dj, "대전 사용자는 대전광역시 랭킹에 들어감", str(n_dj))
        check(A["name"] not in n_dj, "청주 사용자는 대전 랭킹에 없음")
    finally:
        cleanup()
        left = sql("select code from public.users where code like 'ZZREG%'")
        check(not left, "임시 검증 계정 삭제 완료")

    print("\n결과:", "통과" if not errors else f"실패 {errors}")
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
