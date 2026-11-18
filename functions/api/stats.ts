/**
 * 늘봄 현황 API — /api/stats?code=내코드
 *
 * 더보기 탭의 ‘🌱 늘봄 현황’ 카드가 쓰는 두 가지 숫자.
 *   totalUsers  : 실제 가입자 수 (Supabase public.users 행 수 그대로)
 *   onlineUsers : 최근 10분 안에 앱을 연 사람 수 (내 코드가 있으면 지금 시각으로 접속 표시)
 *
 * 접속 표시는 두 곳에 남는다.
 *   - users.last_seen_at          : 앱이 /api/state 로 저장할 때 + 이 API 를 부를 때
 *   - group_members.last_seen_at  : 모임 화면을 열 때(/api/groups)
 * 그래서 두 곳을 합쳐 **사람 코드 기준 고유 인원**을 센다(체험 모임원 role='demo' 는 빼고).
 */
import { sbRequest, supabaseConfig } from "../../lib/db";
import type { DbEnv } from "../../lib/db";

type Ctx = { request: Request; env: DbEnv };

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const enc = encodeURIComponent;

/** ‘지금 접속 중’으로 볼 시간 창 (10분) */
const ONLINE_WINDOW_MS = 10 * 60 * 1000;
/** 시계가 조금 앞선 기기가 있어도 접속으로 인정하는 여유 (1분) */
const FUTURE_TOLERANCE_MS = 60 * 1000;

/** 전체 가입자 수 — Count 헤더(Content-Range)로 센다. 헤더가 없으면 코드 목록 길이로 센다. */
async function countUsers(env: DbEnv): Promise<number> {
  const res = await sbRequest(env, "users?select=code", {
    headers: { Prefer: "count=exact", Range: "0-0" },
  });
  if (!res.ok) throw new Error(`supabase users ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const total = Number((res.headers.get("content-range") || "").split("/")[1]);
  if (Number.isFinite(total)) return Math.max(0, total);
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? rows.length : 0;
}

/** 최근 창 안에 마지막 접속이 찍힌 사람 코드들 (표가 없거나 열이 없으면 빈 목록) */
async function recentCodes(env: DbEnv, path: string, column: string, since: string, now: number) {
  const res = await sbRequest(env, path);
  if (!res.ok) return [] as string[];
  const rows = await res.json().catch(() => []);
  if (!Array.isArray(rows)) return [] as string[];
  const out: string[] = [];
  for (const row of rows as Record<string, unknown>[]) {
    const code = String(row[column] || "").trim().toUpperCase();
    if (!code) continue;
    const at = new Date(String(row.last_seen_at || since)).getTime();
    // 시계가 앞선 기기에서 찍힌 값(미래 시각)은 이번 창의 접속으로 보지 않는다.
    if (Number.isFinite(at) && at - now > FUTURE_TOLERANCE_MS) continue;
    out.push(code);
  }
  return out;
}

export const onRequestGet = async ({ request, env }: Ctx) => {
  if (!supabaseConfig(env).configured) return json({ ok: false, error: "db_not_configured" }, 503);

  const code = (new URL(request.url).searchParams.get("code") || "").trim().toUpperCase();
  const now = Date.now();

  // 지금 이 화면을 보고 있는 사람을 접속으로 남긴다(계정이 없으면 아무 일도 일어나지 않는다).
  // 저장이 실제로 된 경우에만 ‘나’를 접속 인원에 더한다 — 없는 코드로 숫자를 부풀리지 않는다.
  let selfKnown = false;
  if (code) {
    try {
      const res = await sbRequest(env, `users?code=eq.${enc(code)}&select=code`, {
        method: "PATCH",
        body: JSON.stringify({ last_seen_at: new Date(now).toISOString() }),
        headers: { Prefer: "return=representation" },
      });
      const rows = res.ok ? await res.json().catch(() => []) : [];
      selfKnown = Array.isArray(rows) && rows.length > 0;
    } catch {
      /* 접속 표시는 부가 정보 — 숫자는 그대로 보여 준다 */
    }
  }

  const since = new Date(now - ONLINE_WINDOW_MS).toISOString();

  try {
    const [totalUsers, userCodes, memberCodes] = await Promise.all([
      countUsers(env),
      recentCodes(
        env,
        `users?last_seen_at=gte.${enc(since)}&select=code,last_seen_at`,
        "code",
        since,
        now
      ),
      recentCodes(
        env,
        `group_members?last_seen_at=gte.${enc(since)}&role=neq.demo&select=user_code,last_seen_at`,
        "user_code",
        since,
        now
      ),
    ]);

    const online = new Set<string>([...userCodes, ...memberCodes]);
    if (selfKnown) online.add(code); // 저장이 끝난 내 기록은 바로 접속으로 센다.

    return json({
      ok: true,
      totalUsers,
      // 화면을 열어 둔 사람은 최소 한 명 — 0명으로 보이지 않게 한다.
      onlineUsers: Math.max(1, online.size),
      windowMinutes: ONLINE_WINDOW_MS / 60000,
      serverTime: new Date(now).toISOString(),
    });
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 200) }, 500);
  }
};
