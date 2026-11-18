"use client";

/**
 * 모임 오프라인 폴백.
 * 서버(/api/groups)·Supabase 를 쓸 수 없을 때(네트워크 끊김, 정적 미리보기)에도
 * 모임 만들기·가입·게시판이 이 기기 안에서 그대로 동작하도록 localStorage 에 저장한다.
 */
import type { GroupDetail, GroupMemberInfo, GroupPostInfo, GroupRole, GroupSummary, GroupsPayload } from "./types";
import {
  DEMO_GROUP_ID,
  DEMO_MEMBERS,
  demoAttendedSet,
  demoHealthIds,
  demoPoints,
  demoSeedPosts,
  demoWeekDays,
  randomGroupCode,
} from "./group-demo";
import { buildGroupHealth } from "./health";
import { kstDate, weekIdOf } from "./week";
import { GROUP_FULL_MESSAGE, GROUP_MAX_MEMBERS } from "./groups";
import { ACTIVE_GROUP_KEY, type MeStatsInput } from "./groups";

const KEY = "seniorLife.groups.v1";

type LocalMember = { code: string; name: string; role: GroupRole; joinedAt: string };
type LocalGroup = {
  id: string;
  name: string;
  description: string;
  /** 모임 지역(선택) */  region?: string;
  goalScore: number;
  weeklyGoal: number;
  creatorCode: string;
  isDemo: boolean;
  createdAt: string;
  members: LocalMember[];
};
type LocalPost = {
  id: string;
  groupId: string;
  userCode: string;
  authorName: string;
  content: string;
  createdAt: string;
  cheers: string[];
};
type LocalDb = { groups: LocalGroup[]; posts: LocalPost[]; seq: number };

function seed(): LocalDb {
  const now = new Date().toISOString();
  const demo: LocalGroup = {
    id: DEMO_GROUP_ID,
    name: "우리 가족 사랑방",
    description: "온 가족이 함께 치매예방 퀴즈로 건강을 챙기는 체험 모임이에요",
    goalScore: 500,
    weeklyGoal: 5,
    creatorCode: DEMO_MEMBERS[0].code,
    isDemo: true,
    createdAt: now,
    members: DEMO_MEMBERS.map((m) => ({
      code: m.code,
      name: m.name,
      role: "demo" as GroupRole,
      joinedAt: now,
    })),
  };
  const posts: LocalPost[] = demoSeedPosts().map((p, i) => ({
    id: `demo-${i + 1}`,
    groupId: DEMO_GROUP_ID,
    userCode: p.code,
    authorName: p.name,
    content: p.content,
    createdAt: new Date(Date.now() - p.hoursAgo * 3600_000).toISOString(),
    cheers: [],
  }));
  return { groups: [demo], posts, seq: 1 };
}

function read(): LocalDb {
  if (typeof window === "undefined") return seed();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as LocalDb;
    if (!parsed || !Array.isArray(parsed.groups) || !Array.isArray(parsed.posts)) return seed();
    if (!parsed.groups.some((g) => g.id === DEMO_GROUP_ID)) {
      const s = seed();
      parsed.groups.push(s.groups[0]);
      parsed.posts.push(...s.posts);
    }
    return parsed;
  } catch {
    return seed();
  }
}

function write(db: LocalDb) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* 저장 공간이 없어도 화면은 그대로 */
  }
}

/** 체험 모임원 — 서버(체험 모드)와 같은 규칙으로 지금 접속 중인 사람을 고른다 */
export function localDemoOnline(code: string): boolean {
  const kstHour = new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCHours();
  let n = 0;
  for (const ch of code) n = (n * 31 + ch.charCodeAt(0)) % 997;
  const busy = (kstHour >= 7 && kstHour <= 10) || (kstHour >= 18 && kstHour <= 22);
  // 열 명 중 아침·저녁에는 4명, 그 밖에는 2명꼴로 접속 중이 되게 시간마다 돌아간다(서버와 같은 규칙).
  return (n + kstHour * 7) % 10 < (busy ? 4 : 2);
}

function detailOf(db: LocalDb, g: LocalGroup, code: string, me?: MeStatsInput): GroupDetail {
  const today = kstDate();
  const week = weekIdOf(today);
  const demoAttended = demoAttendedSet(today);

  const healthDoneBy: { code: string; ids: string[] }[] = [];

  const members: GroupMemberInfo[] = g.members.map((m) => {
    const isMe = m.code === code;
    if (m.role === "demo") {
      healthDoneBy.push({ code: m.code, ids: demoHealthIds(m.code, today) });
      return {
        code: m.code,
        name: m.name,
        isMe: false,
        isLeader: false,
        isDemo: true,
        online: localDemoOnline(m.code),
        todayAttended: demoAttended.has(m.code),
        weekDays: demoWeekDays(m.code, week),
        points: demoPoints(m.code, week),
        rank: 0,
      };
    }
    const myHealth = isMe && Array.isArray(me?.health) ? me!.health!.filter((x) => typeof x === "string") : [];
    healthDoneBy.push({ code: m.code, ids: myHealth });
    return {
      code: m.code,
      name: m.name,
      isMe,
      isLeader: m.role === "leader",
      isDemo: false,
      online: isMe,
      todayAttended: (isMe ? Boolean(me?.today) : false) || myHealth.length > 0,
      weekDays: isMe ? Math.max(0, Math.round(me?.days ?? 0)) : 0,
      points: isMe ? Math.max(0, Math.round(me?.points ?? 0)) : 0,
      rank: 0,
    };
  });

  members.sort((a, b) => b.points - a.points || b.weekDays - a.weekDays || a.name.localeCompare(b.name));
  members.forEach((m, i) => {
    m.rank = i + 1;
  });

  const posts: GroupPostInfo[] = db.posts
    .filter((p) => p.groupId === g.id)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 30)
    .map((p) => ({
      id: p.id,
      authorCode: p.userCode,
      authorName: p.authorName,
      content: p.content,
      createdAt: p.createdAt,
      cheers: p.cheers.length,
      cheeredByMe: p.cheers.includes(code),
    }));

  const memberCount = members.length;
  const onlineCount = Math.max(1, members.filter((m) => m.online).length);
  const todayAttended = members.filter((m) => m.todayAttended).length;
  const weeklyGoal = Math.max(1, g.weeklyGoal);
  const weekSum = members.reduce((a, m) => a + m.weekDays, 0);
  const mine = members.find((m) => m.isMe) ?? null;

  return {
    id: g.id,
    name: g.name,
    description: g.description,
    isDemo: g.isDemo,
    memberCount,
    onlineCount,
    goalScore: g.goalScore,
    weeklyGoal,
    myRole: g.members.find((m) => m.code === code)?.role ?? "member",
    creatorCode: g.creatorCode,
    members,
    posts,
    todayAttended,
    attendanceRate: memberCount ? Math.round((todayAttended / memberCount) * 100) : 0,
    weeklyRate: memberCount ? Math.min(100, Math.round((weekSum / (memberCount * weeklyGoal)) * 100)) : 0,
    totalPoints: members.reduce((a, m) => a + m.points, 0),
    health: buildGroupHealth(healthDoneBy, code),
    myRank: mine?.rank ?? null,
    top: members[0] ? { name: members[0].name, points: members[0].points } : null,
  };
}

export function localPayload(
  code: string,
  opts: { groupId?: string | null; me?: MeStatsInput } = {}
): GroupsPayload {
  const db = read();
  const mine = db.groups.filter((g) => g.members.some((m) => m.code === code));
  const remembered =
    typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_GROUP_KEY) : null;
  const targetId =
    (opts.groupId && mine.some((g) => g.id === opts.groupId) && opts.groupId) ||
    (remembered && mine.some((g) => g.id === remembered) && remembered) ||
    mine[0]?.id ||
    null;

  const groups: GroupSummary[] = mine.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    isDemo: g.isDemo,
    memberCount: g.members.length,
    onlineCount: Math.max(
      1,
      g.members.filter((m) => m.code === code || (m.role === "demo" && localDemoOnline(m.code))).length
    ),
    goalScore: g.goalScore,
    weeklyGoal: g.weeklyGoal,
    myRole: g.members.find((m) => m.code === code)?.role ?? "member",
  }));

  const target = targetId ? db.groups.find((g) => g.id === targetId) : null;
  return {
    groups,
    activeGroupId: targetId,
    detail: target ? detailOf(db, target, code, opts.me) : null,
  };
}

export function localAction(
  body: {
    action: "create" | "join" | "select" | "leave" | "post" | "cheer" | "ping" | "update";
    code: string;
    groupId?: string | null;
    name?: string;
    description?: string;
    region?: string;
    content?: string;
    postId?: string;
    me?: MeStatsInput;
  }
): GroupsPayload & { ok: boolean; groupId?: string; message?: string } {
  const db = read();
  const code = body.code;
  const meName = (body.me?.name || body.name || "가족").slice(0, 12);
  let gid = body.groupId || null;

  if (body.action === "create") {
    let id = randomGroupCode(`${code}|${Date.now()}`);
    while (db.groups.some((g) => g.id === id)) id = randomGroupCode(`${code}|${Date.now()}|${Math.random()}`);
    const now = new Date().toISOString();
    db.groups.push({
      id,
      name: (body.name || "우리 모임").trim().slice(0, 20),
      description: (body.description || "").trim().slice(0, 80),
      region: (body.region || "").trim().slice(0, 20),
      goalScore: 500,
      weeklyGoal: 5,
      creatorCode: code,
      isDemo: false,
      createdAt: now,
      members: [{ code, name: meName, role: "leader", joinedAt: now }],
    });
    gid = id;
  } else if (body.action === "join" && body.groupId) {
    const g = db.groups.find((x) => x.id === body.groupId);
    if (g && !g.members.some((m) => m.code === code)) {
      // 오프라인 저장에서도 정원(100명)은 지킨다
      if (g.members.length >= GROUP_MAX_MEMBERS) {
        return { ...localPayload(code, { groupId: body.groupId, me: body.me }), ok: false, message: GROUP_FULL_MESSAGE };
      }
      g.members.push({ code, name: meName, role: "member", joinedAt: new Date().toISOString() });
    }
  } else if (body.action === "update" && body.groupId) {
    const g = db.groups.find((x) => x.id === body.groupId);
    if (g) {
      if (body.name !== undefined) g.name = body.name.trim().slice(0, 20) || g.name;
      if (body.description !== undefined) g.description = body.description.trim().slice(0, 80);
      if (body.region !== undefined) g.region = body.region.trim().slice(0, 20);
    }
  } else if (body.action === "leave" && body.groupId) {
    const g = db.groups.find((x) => x.id === body.groupId);
    if (g) {
      g.members = g.members.filter((m) => m.code !== code);
      if (!g.members.length && !g.isDemo) db.groups = db.groups.filter((x) => x.id !== g.id);
    }
    gid = null;
  } else if (body.action === "post" && body.groupId) {
    const content = (body.content || "").trim().slice(0, 80);
    const g = db.groups.find((x) => x.id === body.groupId);
    if (g && content) {
      db.seq += 1;
      db.posts.push({
        id: `local-${db.seq}`,
        groupId: g.id,
        userCode: code,
        authorName: meName,
        content,
        createdAt: new Date().toISOString(),
        cheers: [],
      });
    }
  } else if (body.action === "cheer" && body.postId) {
    const post = db.posts.find((p) => p.id === String(body.postId));
    if (post && !post.cheers.includes(code)) post.cheers.push(code);
  }

  write(db);
  if (gid) {
    try {
      window.localStorage.setItem(ACTIVE_GROUP_KEY, gid);
    } catch {
      /* 무시 */
    }
  }
  return { ok: true, groupId: gid || undefined, ...localPayload(code, { groupId: gid, me: body.me }) };
}
