import { buildGroupRanking, buildInviteRanking, buildRanking } from "../../lib/rankings";
import type { InviterInput, MyGroupInput } from "../../lib/rankings";
import { demoAttendedSet, demoPoints } from "../../lib/group-demo";
import { normalizeAvatarUrl } from "../../lib/avatar";
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

/** 내 카카오톡 프로필 사진 — 순위표 '나' 칸에 원형 사진으로 보여 준다. */
async function myAvatar(env: DbEnv, code: string): Promise<string | undefined> {
  if (!code || !supabaseConfig(env).configured) return undefined;
  try {
    const rows = await sbGet<{ avatar_url?: string | null }>(
      env,
      `users?code=eq.${enc(code)}&select=avatar_url&limit=1`
    );
    return normalizeAvatarUrl(rows[0]?.avatar_url);
  } catch {
    return undefined;
  }
}

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

/** 초대왕 재료 — users.invited_by 를 세어 초대한 사람별 성공 건수를 만든다. */
async function invitersFromDb(
  env: DbEnv,
  code: string
): Promise<{ inviters: InviterInput[]; myId: string; myName?: string; myInvites: number } | null> {
  if (!supabaseConfig(env).configured) return null;

  const meRows = code
    ? await sbGet<{ external_id?: string | null; nickname?: string }>(
        env,
        `users?code=eq.${enc(code)}&select=external_id,nickname&limit=1`
      )
    : [];
  const myId = meRows[0]?.external_id || "";
  const myName = meRows[0]?.nickname || undefined;

  const invited = await sbGet<{ invited_by: string }>(
    env,
    `users?invited_by=not.is.null&select=invited_by&limit=5000`
  );
  if (!invited.length) return { inviters: [], myId, myName, myInvites: 0 };

  const counts = new Map<string, number>();
  invited.forEach((r) => {
    const id = (r.invited_by || "").trim();
    if (!id) return;
    counts.set(id, (counts.get(id) || 0) + 1);
  });

  const topIds = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([id]) => id);
  if (!topIds.length) return { inviters: [], myId, myName, myInvites: counts.get(myId) || 0 };

  const profiles = await sbGet<{ external_id?: string | null; nickname?: string; avatar_url?: string | null }>(
    env,
    `users?external_id=in.(${topIds.map(enc).join(",")})&select=external_id,nickname,avatar_url&limit=50`
  ).catch(() => [] as { external_id?: string | null; nickname?: string; avatar_url?: string | null }[]);

  const profileBy = new Map<string, { nickname?: string; avatar_url?: string | null }>();
  profiles.forEach((p) => {
    if (p.external_id) profileBy.set(p.external_id, p);
  });

  const inviters: InviterInput[] = topIds.map((id) => {
    const prof = profileBy.get(id);
    return {
      name: prof?.nickname || "늘봄 친구",
      invites: counts.get(id) || 0,
      avatarUrl: normalizeAvatarUrl(prof?.avatar_url),
      isMe: Boolean(myId) && id === myId,
    };
  });

  return { inviters, myId, myName, myInvites: counts.get(myId) || 0 };
}

export const onRequestGet = async ({ request, env }: Ctx) => {
  const p = new URL(request.url).searchParams;
  const scopeParam = p.get("scope") || "region";
  const weekId = p.get("weekId") || weekIdOf();

  // 초대왕 — 초대 링크로 새로 가입한 사람이 많은 순서
  if (scopeParam === "invite") {
    const code = p.get("code") || "";
    let real: Awaited<ReturnType<typeof invitersFromDb>> = null;
    let myAvatarUrl: string | undefined;
    try {
      real = await invitersFromDb(env, code);
      myAvatarUrl = await myAvatar(env, code);
    } catch {
      real = null;
    }
    const result = buildInviteRanking({
      weekId,
      myName: real?.myName || p.get("name") || "나",
      myInvites: real?.myInvites ?? 0,
      myAvatarUrl,
      inviters: real?.inviters || [],
    });
    return json({ ok: true, ...result });
  }

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

  // 순위표에 내가 보이면 그 줄에 카톡 사진을 붙여 준다(다른 줄은 예시 이름이라 사진이 없다).
  const avatarUrl = await myAvatar(env, p.get("code") || "");
  const rows = avatarUrl
    ? result.rows.map((r) => (r.isMe ? { ...r, avatarUrl } : r))
    : result.rows;

  return json({ ok: true, ...result, rows });
};
