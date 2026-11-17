import { buildGroupRanking, buildRanking } from "../../lib/rankings";
import type { MyGroupInput } from "../../lib/rankings";
import { demoAttendedSet, demoPoints } from "../../lib/group-demo";
import { sbRequest, supabaseConfig } from "../../lib/db";
import type { DbEnv } from "../../lib/db";
import { kstDate, weekIdOf } from "../../lib/week";
import type { RankingScope } from "../../lib/types";

type Ctx = { request: Request; env: DbEnv };

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const enc = encodeURIComponent;

async function sbGet<T>(env: DbEnv, path: string): Promise<T[]> {
  const res = await sbRequest(env, path);
  if (!res.ok) throw new Error(`supabase ${res.status}`);
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? (data as T[]) : [];
}

type GroupRow = { id: string; name: string; is_demo: boolean };
type MemberRow = { group_id: string; user_code: string; name: string; role: string };

/**
 * 실제 모임(groups · group_members) + 이번 주 퀴즈 점수 + 오늘 출석으로
 * 모임별 합산·평균 점수와 오늘 출석률을 만든다. 실패하면 null(화면은 예시 순위로 채운다).
 */
async function groupsFromDb(
  env: DbEnv,
  weekId: string,
  code: string,
  myPoints: number
): Promise<{ myGroups: MyGroupInput[]; total: number } | null> {
  if (!supabaseConfig(env).configured) return null;
  const today = kstDate();

  const groups = await sbGet<GroupRow>(env, `groups?select=id,name,is_demo&limit=200`);
  if (!groups.length) return null;
  const members = await sbGet<MemberRow>(
    env,
    `group_members?select=group_id,user_code,name,role&limit=5000`
  );
  const quiz = await sbGet<{ user_code: string; points: number }>(
    env,
    `quiz_logs?week_id=eq.${enc(weekId)}&select=user_code,points`
  ).catch(() => [] as { user_code: string; points: number }[]);
  const visits = await sbGet<{ user_code: string }>(
    env,
    `daily_visits?visit_date=eq.${enc(today)}&select=user_code`
  ).catch(() => [] as { user_code: string }[]);

  const pointsBy = new Map<string, number>();
  quiz.forEach((q) => pointsBy.set(q.user_code, (pointsBy.get(q.user_code) || 0) + Number(q.points || 0)));
  const attended = new Set(visits.map((v) => v.user_code));
  const demoToday = demoAttendedSet(today);

  const mine: MyGroupInput[] = [];
  groups.forEach((g) => {
    const list = members.filter((m) => m.group_id === g.id);
    if (!list.length) return;
    let points = 0;
    let attendedToday = 0;
    list.forEach((m) => {
      if (m.role === "demo") {
        points += demoPoints(m.user_code, weekId);
        if (demoToday.has(m.user_code)) attendedToday += 1;
      } else {
        points += pointsBy.get(m.user_code) || 0;
        if (attended.has(m.user_code)) attendedToday += 1;
      }
    });
    if (list.some((m) => m.user_code === code)) {
      // 방금 퀴즈를 풀고 서버 저장 전인 내 점수까지 반영(모자라지 않게 큰 쪽)
      points = Math.max(points, myPoints);
      mine.push({ id: g.id, name: g.name, memberCount: list.length, points, attendedToday });
    }
  });

  return { myGroups: mine, total: groups.length };
}

export const onRequestGet = async ({ request, env }: Ctx) => {
  const p = new URL(request.url).searchParams;
  const scopeParam = p.get("scope") || "region";
  const weekId = p.get("weekId") || weekIdOf();

  // 단체(모임)별 순위 — 모임 하나가 한 줄
  if (scopeParam === "groups") {
    const code = p.get("code") || "";
    const myPoints = Number(p.get("points") || 0);
    let real: { myGroups: MyGroupInput[]; total: number } | null = null;
    try {
      real = await groupsFromDb(env, weekId, code, myPoints);
    } catch {
      real = null;
    }
    const result = buildGroupRanking({
      weekId,
      myGroups: real?.myGroups,
      totalMembers: real?.total,
    });
    return json({ ok: true, ...result });
  }

  const scope: RankingScope =
    scopeParam === "zodiac" || scopeParam === "streak" || scopeParam === "national"
      ? (scopeParam as RankingScope)
      : "region";

  const result = buildRanking({
    scope,
    weekId,
    sido: p.get("sido") || "",
    sigungu: p.get("sigungu") || "",
    birthYear: Number(p.get("birthYear") || 1955),
    myName: p.get("name") || "나",
    myPoints: Number(p.get("points") || 0),
    myStreak: Number(p.get("streak") || 0),
  });

  return json({ ok: true, ...result });
};
