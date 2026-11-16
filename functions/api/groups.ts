/**
 * 모임 API — /api/groups
 *
 * GET  /api/groups?code=내코드[&group=초대코드][&mePoints=..&meDays=..&meToday=1]
 *   → 내가 가입한 모임 목록 + 지금 보고 있는 모임의 회원·게시판·출석률
 *
 * POST /api/groups  { action: "create" | "join" | "select" | "leave" | "post" | "cheer", code, ... }
 *   → 처리 뒤의 목록·상세를 그대로 돌려준다(화면이 한 번에 갱신된다).
 *
 * 저장은 Supabase(PostgREST, service_role) — 테이블 정의는 supabase/groups.sql.
 */
import { sbRequest, supabaseConfig } from "../../lib/db";
import type { DbEnv } from "../../lib/db";
import {
  DEMO_MEMBERS,
  demoAttendedSet,
  demoPoints,
  demoWeekDays,
  randomGroupCode,
} from "../../lib/group-demo";
import { kstDate, weekIdOf, weekRange } from "../../lib/week";
import type {
  GroupDetail,
  GroupMemberInfo,
  GroupPostInfo,
  GroupRole,
  GroupSummary,
  GroupsPayload,
} from "../../lib/types";

type Ctx = { request: Request; env: DbEnv };

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const enc = encodeURIComponent;

const GROUP_COLUMNS = "id,name,description,goal_score,weekly_goal,creator_code,is_demo";

type GroupRow = {
  id: string;
  name: string;
  description: string;
  goal_score: number;
  weekly_goal: number;
  creator_code: string | null;
  is_demo: boolean;
};
type MemberRow = { group_id: string; user_code: string; name: string; role: GroupRole; joined_at?: string };
type PostRow = {
  id: number | string;
  user_code: string;
  author_name: string;
  content: string;
  created_at: string;
  group_cheers?: { user_code: string }[];
};
type QuizRow = { user_code: string; points: number; quiz_date?: string };
type VisitRow = { user_code: string; visit_date: string };

export type MeStats = { name?: string; points?: number; days?: number; today?: boolean };

async function sbGet<T>(env: DbEnv, path: string): Promise<T[]> {
  const res = await sbRequest(env, path);
  if (!res.ok) throw new Error(`supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? (data as T[]) : [];
}

async function sbWrite(
  env: DbEnv,
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
  prefer = "resolution=merge-duplicates,return=representation"
) {
  const res = await sbRequest(env, path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { Prefer: prefer },
  });
  if (!res.ok) throw new Error(`supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** 모임 하나의 상세(회원 · 오늘 출석 · 이번 주 달성률 · 게시판) */
async function buildDetail(
  env: DbEnv,
  groupId: string,
  code: string,
  me?: MeStats
): Promise<GroupDetail | null> {
  const today = kstDate();
  const week = weekIdOf(today);
  const { start, end } = weekRange(today);

  const groupRows = await sbGet<GroupRow>(
    env,
    `groups?id=eq.${enc(groupId)}&select=${GROUP_COLUMNS}&limit=1`
  );
  if (!groupRows.length) return null;
  const g = groupRows[0];

  const memberRows = await sbGet<MemberRow>(
    env,
    `group_members?group_id=eq.${enc(groupId)}&select=user_code,name,role,joined_at&order=joined_at.asc`
  );
  const realCodes = Array.from(
    new Set(memberRows.filter((m) => m.role !== "demo").map((m) => m.user_code))
  );
  const inList = realCodes.length ? `(${realCodes.map(enc).join(",")})` : null;

  const [quizRows, visitRows] = inList
    ? await Promise.all([
        sbGet<QuizRow>(
          env,
          `quiz_logs?week_id=eq.${enc(week)}&user_code=in.${inList}&select=user_code,points,quiz_date`
        ),
        sbGet<VisitRow>(
          env,
          `daily_visits?visit_date=gte.${start}&visit_date=lte.${end}&user_code=in.${inList}&select=user_code,visit_date`
        ),
      ])
    : [[], []];

  const pointsBy = new Map<string, number>();
  const quizToday = new Set<string>();
  quizRows.forEach((q) => {
    pointsBy.set(q.user_code, (pointsBy.get(q.user_code) || 0) + Number(q.points || 0));
    if (q.quiz_date === today) quizToday.add(q.user_code);
  });
  const daysBy = new Map<string, Set<string>>();
  visitRows.forEach((v) => {
    const set = daysBy.get(v.user_code) ?? new Set<string>();
    set.add(v.visit_date);
    daysBy.set(v.user_code, set);
  });

  const demoAttended = demoAttendedSet(today);

  const members: GroupMemberInfo[] = memberRows.map((m) => {
    const isMe = m.user_code === code;
    if (m.role === "demo") {
      return {
        code: m.user_code,
        name: m.name,
        isMe: false,
        isLeader: false,
        isDemo: true,
        todayAttended: demoAttended.has(m.user_code),
        weekDays: demoWeekDays(m.user_code, week),
        points: demoPoints(m.user_code, week),
        rank: 0,
      };
    }
    const myDays = daysBy.get(m.user_code) ?? new Set<string>();
    let points = pointsBy.get(m.user_code) ?? 0;
    let weekDays = myDays.size;
    let todayAttended = myDays.has(today) || quizToday.has(m.user_code);
    // 내 기록은 기기 기록이 서버보다 앞설 수 있어 큰 쪽을 쓴다(퀴즈를 막 풀고 저장 전인 순간).
    if (isMe && me) {
      points = Math.max(points, Math.round(Number(me.points) || 0));
      weekDays = Math.max(weekDays, Math.round(Number(me.days) || 0));
      todayAttended = todayAttended || Boolean(me.today);
    }
    return {
      code: m.user_code,
      name: m.name,
      isMe,
      isLeader: m.role === "leader",
      isDemo: false,
      todayAttended,
      weekDays,
      points,
      rank: 0,
    };
  });

  members.sort((a, b) => b.points - a.points || b.weekDays - a.weekDays || a.name.localeCompare(b.name));
  members.forEach((m, i) => {
    m.rank = i + 1;
  });

  const postRows = await sbGet<PostRow>(
    env,
    `group_posts?group_id=eq.${enc(groupId)}&select=id,user_code,author_name,content,created_at,group_cheers(user_code)&order=created_at.desc&limit=30`
  );
  const posts: GroupPostInfo[] = postRows.map((p) => {
    const cheers = p.group_cheers ?? [];
    return {
      id: String(p.id),
      authorCode: p.user_code,
      authorName: p.author_name,
      content: p.content,
      createdAt: p.created_at,
      cheers: cheers.length,
      cheeredByMe: cheers.some((c) => c.user_code === code),
    };
  });

  const memberCount = members.length;
  const todayAttended = members.filter((m) => m.todayAttended).length;
  const attendanceRate = memberCount ? Math.round((todayAttended / memberCount) * 100) : 0;
  const weeklyGoal = Math.max(1, Number(g.weekly_goal) || 5);
  const weekSum = members.reduce((a, m) => a + m.weekDays, 0);
  const weeklyRate = memberCount
    ? Math.min(100, Math.round((weekSum / (memberCount * weeklyGoal)) * 100))
    : 0;
  const totalPoints = members.reduce((a, m) => a + m.points, 0);
  const mine = members.find((m) => m.isMe) ?? null;
  const myMembership = memberRows.find((m) => m.user_code === code);

  return {
    id: g.id,
    name: g.name,
    description: g.description || "",
    isDemo: Boolean(g.is_demo),
    memberCount,
    goalScore: Number(g.goal_score) || 0,
    weeklyGoal,
    myRole: myMembership?.role ?? "member",
    creatorCode: g.creator_code || "",
    members,
    posts,
    todayAttended,
    attendanceRate,
    weeklyRate,
    totalPoints,
    myRank: mine?.rank ?? null,
    top: members[0] ? { name: members[0].name, points: members[0].points } : null,
  };
}

/** 내 모임 목록 + 보고 있는 모임 상세 */
async function buildPayload(
  env: DbEnv,
  code: string,
  opts: { groupId?: string | null; me?: MeStats } = {}
): Promise<GroupsPayload> {
  const memberships = await sbGet<MemberRow>(
    env,
    `group_members?user_code=eq.${enc(code)}&select=group_id,name,role&order=joined_at.asc`
  );
  const ids = Array.from(new Set(memberships.map((m) => m.group_id)));
  const list = ids.length ? ids.map(enc).join(",") : "";

  const [rows, countRows, prefRows] = await Promise.all([
    list
      ? sbGet<GroupRow>(env, `groups?id=in.(${list})&select=${GROUP_COLUMNS}`)
      : Promise.resolve([] as GroupRow[]),
    list
      ? sbGet<{ group_id: string }>(env, `group_members?group_id=in.(${list})&select=group_id`)
      : Promise.resolve([] as { group_id: string }[]),
    sbGet<{ active_group_id?: string | null }>(
      env,
      `users?code=eq.${enc(code)}&select=active_group_id&limit=1`
    ),
  ]);

  const byId = new Map(rows.map((r) => [r.id, r]));
  const countMap = new Map<string, number>();
  countRows.forEach((c) => countMap.set(c.group_id, (countMap.get(c.group_id) || 0) + 1));

  const groups: GroupSummary[] = memberships
    .filter((m) => byId.has(m.group_id))
    .map((m) => {
      const r = byId.get(m.group_id)!;
      return {
        id: r.id,
        name: r.name,
        description: r.description || "",
        isDemo: Boolean(r.is_demo),
        memberCount: countMap.get(r.id) || 0,
        goalScore: Number(r.goal_score) || 0,
        weeklyGoal: Number(r.weekly_goal) || 5,
        myRole: m.role,
      };
    });

  const preferred = prefRows[0]?.active_group_id || null;
  const targetId =
    opts.groupId && groups.some((g) => g.id === opts.groupId)
      ? opts.groupId
      : preferred && groups.some((g) => g.id === preferred)
        ? preferred
        : (groups[0]?.id ?? null);

  const detail = targetId ? await buildDetail(env, targetId, code, opts.me) : null;

  return {
    groups,
    activeGroupId: detail?.id ?? preferred ?? null,
    detail,
  };
}

/* ------------------------------------------------------------------ */

export const onRequestGet = async ({ request, env }: Ctx) => {
  if (!supabaseConfig(env).configured) return json({ ok: false, error: "db_not_configured" }, 503);
  const p = new URL(request.url).searchParams;
  const code = (p.get("code") || "").trim().toUpperCase();
  if (!code) return json({ ok: false, error: "code_required" }, 400);
  const groupId = (p.get("group") || "").trim().toUpperCase() || null;
  const me: MeStats = {
    name: p.get("meName") || undefined,
    points: Number(p.get("mePoints") || 0),
    days: Number(p.get("meDays") || 0),
    today: p.get("meToday") === "1",
  };

  try {
    const payload = await buildPayload(env, code, { groupId, me });
    return json({ ok: true, ...payload });
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 300) }, 500);
  }
};

type PostBody = {
  action?: string;
  code?: string;
  groupId?: string;
  name?: string;
  content?: string;
  postId?: string | number;
  description?: string;
  goalScore?: number;
  me?: MeStats;
};

export const onRequestPost = async ({ request, env }: Ctx) => {
  if (!supabaseConfig(env).configured) return json({ ok: false, error: "db_not_configured" }, 503);

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const code = (body.code || "").trim().toUpperCase();
  if (!code) return json({ ok: false, error: "code_required" }, 400);
  const action = body.action || "";
  const me = body.me;

  try {
    if (action === "create") {
      const name = (body.name || "").trim().slice(0, 20);
      if (name.length < 2) return json({ ok: false, error: "name_too_short" }, 400);
      const description = (body.description || "").trim().slice(0, 80);
      const goalScore = Math.max(50, Math.min(5000, Math.round(Number(body.goalScore) || 500)));

      let id = randomGroupCode(`${code}|${Date.now()}`);
      for (let i = 0; i < 6; i++) {
        const dup = await sbGet<{ id: string }>(
          env,
          `groups?id=eq.${enc(id)}&select=id&limit=1`
        );
        if (!dup.length) break;
        id = randomGroupCode(`${code}|${Date.now()}|${i}`);
      }

      await sbWrite(env, "groups", "POST", [
        {
          id,
          name,
          description,
          goal_score: goalScore,
          weekly_goal: 5,
          creator_code: code,
          is_demo: false,
        },
      ]);
      await sbWrite(env, "group_members", "POST", [
        { group_id: id, user_code: code, name: (body.me?.name || "모임장").slice(0, 12), role: "leader" },
      ]);
      await sbWrite(env, `users?code=eq.${enc(code)}`, "PATCH", { active_group_id: id }, "return=minimal");

      const payload = await buildPayload(env, code, { groupId: id, me });
      return json({ ok: true, groupId: id, ...payload });
    }

    if (action === "join") {
      const groupId = (body.groupId || "").trim().toUpperCase();
      if (!groupId) return json({ ok: false, error: "group_required" }, 400);
      const rows = await sbGet<GroupRow>(
        env,
        `groups?id=eq.${enc(groupId)}&select=${GROUP_COLUMNS}&limit=1`
      );
      if (!rows.length) return json({ ok: false, error: "group_not_found" }, 404);

      const name = (body.name || me?.name || "가족").trim().slice(0, 12);
      await sbWrite(
        env,
        "group_members",
        "POST",
        [{ group_id: groupId, user_code: code, name, role: "member" }],
        "resolution=ignore-duplicates,return=minimal"
      );
      // 이름을 새로 고쳐 부르게 된 경우(프로필 이름 변경) 반영
      await sbWrite(
        env,
        `group_members?group_id=eq.${enc(groupId)}&user_code=eq.${enc(code)}`,
        "PATCH",
        { name },
        "return=minimal"
      );
      await sbWrite(env, `users?code=eq.${enc(code)}`, "PATCH", { active_group_id: groupId }, "return=minimal");

      const payload = await buildPayload(env, code, { groupId, me });
      return json({ ok: true, groupId, ...payload });
    }

    if (action === "select") {
      const groupId = (body.groupId || "").trim().toUpperCase();
      await sbWrite(env, `users?code=eq.${enc(code)}`, "PATCH", { active_group_id: groupId || null }, "return=minimal");
      const payload = await buildPayload(env, code, { groupId, me });
      return json({ ok: true, ...payload });
    }

    if (action === "leave") {
      const groupId = (body.groupId || "").trim().toUpperCase();
      if (!groupId) return json({ ok: false, error: "group_required" }, 400);
      await sbWrite(
        env,
        `group_members?group_id=eq.${enc(groupId)}&user_code=eq.${enc(code)}`,
        "DELETE",
        undefined,
        "return=minimal"
      );
      const left = await sbGet<{ user_code: string }>(
        env,
        `group_members?group_id=eq.${enc(groupId)}&select=user_code&limit=1`
      );
      const groupRow = await sbGet<GroupRow>(
        env,
        `groups?id=eq.${enc(groupId)}&select=id,is_demo&limit=1`
      );
      if (!left.length && groupRow[0] && !groupRow[0].is_demo) {
        await sbWrite(env, `groups?id=eq.${enc(groupId)}`, "DELETE", undefined, "return=minimal");
      }
      const payload = await buildPayload(env, code, { me });
      return json({ ok: true, ...payload });
    }

    if (action === "post") {
      const groupId = (body.groupId || "").trim().toUpperCase();
      const content = (body.content || "").trim().slice(0, 80);
      if (!groupId) return json({ ok: false, error: "group_required" }, 400);
      if (!content) return json({ ok: false, error: "content_required" }, 400);
      const member = await sbGet<MemberRow>(
        env,
        `group_members?group_id=eq.${enc(groupId)}&user_code=eq.${enc(code)}&select=name,role&limit=1`
      );
      if (!member.length) return json({ ok: false, error: "not_member" }, 403);
      await sbWrite(env, "group_posts", "POST", [
        {
          group_id: groupId,
          user_code: code,
          author_name: (me?.name || member[0].name || "가족").slice(0, 12),
          content,
        },
      ]);
      const payload = await buildPayload(env, code, { groupId, me });
      return json({ ok: true, ...payload });
    }

    if (action === "cheer") {
      const groupId = (body.groupId || "").trim().toUpperCase();
      const postId = Number(body.postId);
      if (!groupId || !postId) return json({ ok: false, error: "post_required" }, 400);
      await sbWrite(
        env,
        "group_cheers",
        "POST",
        [{ post_id: postId, user_code: code }],
        "resolution=ignore-duplicates,return=minimal"
      );
      const payload = await buildPayload(env, code, { groupId, me });
      return json({ ok: true, ...payload });
    }

    return json({ ok: false, error: "unknown_action" }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 300) }, 500);
  }
};

/** 체험 모임의 기본 회원 목록(다른 모듈이 참조할 수 있게 함께 내보낸다) */
export const demoMembersForSeed = DEMO_MEMBERS;
