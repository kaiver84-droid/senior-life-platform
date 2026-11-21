import { buildAreaRanking, buildGroupBattle, buildGroupRanking } from "../../lib/rankings";
import type { RankParticipant } from "../../lib/rankings";
import { demoAttendedSet, demoPoints } from "../../lib/group-demo";
import { normalizeAvatarUrl } from "../../lib/avatar";
import { sbRequest, supabaseConfig } from "../../lib/db";
import type { DbEnv } from "../../lib/db";
import { kstDate, weekIdOf } from "../../lib/week";
import { normalizeSido, sidoLabel } from "../../lib/regions";
import {
  LEAGUE_DAILY_CAP,
  LEAGUE_POINTS,
  ageBandOf,
  isLeagueArea,
  weekDatesOf,
  type LeagueArea,
} from "../../lib/league";
import type { GroupBattleResult, RankingRange } from "../../lib/types";
import { badgeCards, emptyStats, gradeChipOf, gradeOf, nextGradeMessage } from "../../lib/grades";
import type { LifetimeStats } from "../../lib/grades";

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

/* ------------------------------------------------------------------ */
/* 7개 영역 — 실제 참여자 집계                                          */
/* ------------------------------------------------------------------ */

type UserRow = {
  code: string;
  nickname: string;
  sido?: string | null;
  sigungu?: string | null;
  birth_year?: number | null;
  avatar_url?: string | null;
  external_id?: string | null;
  ranking_visible?: boolean | null;
  created_at?: string | null;
  invited_by?: string | null;
};

/** ISO 시각 → 한국 날짜(YYYY-MM-DD) */
function kstDayOf(iso?: string | null): string {
  if (!iso) return "";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  return new Date(t.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

type LifetimeRow = {
  code: string;
  lifetime_points: number;
  attend_days: number;
  quiz_days: number;
  quiz_correct: number;
  health_days: number;
  welfare_days: number;
  group_days: number;
  invite_count: number;
  group_count: number;
  group_mates: number;
};

/** 누적 점수(등급) — 모든 참여자의 누적 점수를 한 번에 받아 이름 옆 배지로 붙인다 */
async function lifetimeMap(env: DbEnv): Promise<Map<string, LifetimeRow>> {
  const map = new Map<string, LifetimeRow>();
  try {
    const rows = await sbGet<LifetimeRow>(
      env,
      `v_user_lifetime?select=code,lifetime_points,attend_days,quiz_days,quiz_correct,health_days,welfare_days,group_days,invite_count,group_count,group_mates&limit=2000`
    );
    rows.forEach((r) => map.set(r.code, r));
  } catch {
    /* 누적 점수 뷰가 없어도 순위표는 그대로 그린다 */
  }
  return map;
}

/** 이어진 연속 출석 일수 — 오늘(또는 어제)부터 거꾸로 센다 */
function streakOf(dates: string[], today: string): number {
  const set = new Set(dates);
  const toDate = (s: string) => new Date(s + "T00:00:00Z").getTime();
  let cursor = today;
  if (!set.has(cursor)) {
    const yesterday = new Date(toDate(today) - 86400000).toISOString().slice(0, 10);
    if (!set.has(yesterday)) return 0;
    cursor = yesterday;
  }
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = new Date(toDate(cursor) - 86400000).toISOString().slice(0, 10);
  }
  return streak;
}

function parseArea(raw: string | null, scope: string): LeagueArea {
  if (isLeagueArea(raw)) return raw as LeagueArea;
  if (scope === "invite") return "share";
  if (scope === "streak") return "attend";
  return "all";
}

function parseRange(raw: string | null, scope: string): RankingRange {
  const v = raw || scope;
  if (v === "region" || v === "national" || v === "age" || v === "group") return v;
  if (v === "zodiac") return "age";
  if (v === "group" || v === "groups") return "group";
  return "national";
}

/** 클라이언트가 보낸 ‘내 날짜별 값’ — 서버 저장값과 큰 쪽을 쓴다(방금 한 활동도 바로 반영) */
function parseMyDaily(raw: string | null, area: LeagueArea): number[] | null {
  if (!raw) return null;
  const nums = raw
    .split(",")
    .slice(0, 7)
    .map((x) => Number(x));
  if (!nums.length) return null;
  const cap = area === "all" ? LEAGUE_DAILY_CAP : 2000;
  return weekDatesOf().map((_, i) => Math.max(0, Math.min(cap, Math.round(nums[i] || 0))));
}

type LeagueAggregate = {
  others: RankParticipant[];
  me: RankParticipant | null;
  invitesByDay: Record<string, number>;
};

/**
 * 이번 주 실제 참여자를 영역별 날짜 점수로 만든다.
 * 출석(＋10) · 퀴즈(＋30) · 건강(＋20) · 복지 확인(＋10) · 모임 미션(＋20) · 초대(＋50/명)를
 * 하루 최대 140점으로 자른 뒤 합산한다 — 화면과 같은 규칙(lib/league.ts)을 쓴다.
 * 랭킹 참여를 끈 사람(users.ranking_visible = false)은 순위표에서 빠진다.
 */
async function leagueAggregate(
  env: DbEnv,
  opts: {
    area: LeagueArea;
    range: RankingRange;
    weekId: string;
    today: string;
    sido: string;
    sigungu: string;
    band: number;
    code: string;
    myDaily: number[] | null;
    visible: boolean;
    /** 누적 점수(등급 배지) — 있으면 순위표 이름 옆에 붙인다 */
    lifetime?: Map<string, LifetimeRow>;
  }
): Promise<LeagueAggregate> {
  const empty: LeagueAggregate = { others: [], me: null, invitesByDay: {} };
  if (!supabaseConfig(env).configured) return empty;

  const dates = weekDatesOf(opts.today);
  const start = dates[0];
  const end = dates[6];

  const [users, visits, quiz, health, acts] = await Promise.all([
    sbGet<UserRow>(
      env,
      `users?select=code,nickname,sido,sigungu,birth_year,avatar_url,external_id,ranking_visible,created_at,invited_by&limit=1000`
    ),
    sbGet<{ user_code: string; visit_date: string }>(
      env,
      `daily_visits?visit_date=gte.${start}&visit_date=lte.${end}&select=user_code,visit_date&limit=8000`
    ).catch(() => [] as { user_code: string; visit_date: string }[]),
    sbGet<{ user_code: string; quiz_date: string; points: number; correct: number; total: number }>(
      env,
      `quiz_logs?week_id=eq.${enc(opts.weekId)}&select=user_code,quiz_date,points,correct,total&limit=8000`
    ).catch(() => [] as { user_code: string; quiz_date: string; points: number; correct: number; total: number }[]),
    sbGet<{ user_code: string; check_date: string; challenges: string[] }>(
      env,
      `health_checks?check_date=gte.${start}&check_date=lte.${end}&select=user_code,check_date,challenges&limit=8000`
    ).catch(() => [] as { user_code: string; check_date: string; challenges: string[] }[]),
    sbGet<{ user_code: string; activity_date: string; kind: string }>(
      env,
      `activity_logs?activity_date=gte.${start}&activity_date=lte.${end}&select=user_code,activity_date,kind&limit=8000`
    ).catch(() => [] as { user_code: string; activity_date: string; kind: string }[]),
  ]);

  if (!users.length) return empty;

  const idToCode = new Map<string, string>();
  users.forEach((u) => {
    if (u.external_id) idToCode.set(u.external_id, u.code);
  });

  type Flags = { attend: boolean[]; quiz: number[]; done: boolean[]; health: number[]; welfare: boolean[]; group: boolean[]; invites: number[] };
  const blank = (): Flags => ({
    attend: new Array(7).fill(false),
    quiz: new Array(7).fill(0),
    done: new Array(7).fill(false),
    health: new Array(7).fill(0),
    welfare: new Array(7).fill(false),
    group: new Array(7).fill(false),
    invites: new Array(7).fill(0),
  });
  const flags = new Map<string, Flags>();
  const of = (code: string) => {
    if (!flags.has(code)) flags.set(code, blank());
    return flags.get(code)!;
  };

  visits.forEach((v) => {
    const i = dates.indexOf(v.visit_date);
    if (i >= 0) of(v.user_code).attend[i] = true;
  });
  const accuracy = new Map<string, { correct: number; total: number }>();
  quiz.forEach((q) => {
    const i = dates.indexOf(q.quiz_date);
    if (i < 0) return;
    const f = of(q.user_code);
    f.quiz[i] += Number(q.points || 0);
    f.done[i] = true;
    const acc = accuracy.get(q.user_code) || { correct: 0, total: 0 };
    acc.correct += Number(q.correct || 0);
    acc.total += Number(q.total || 0);
    accuracy.set(q.user_code, acc);
  });
  health.forEach((h) => {
    const i = dates.indexOf(h.check_date);
    if (i < 0) return;
    of(h.user_code).health[i] = Array.isArray(h.challenges) ? h.challenges.length : 0;
  });
  acts.forEach((a) => {
    const i = dates.indexOf(a.activity_date);
    if (i < 0) return;
    if (a.kind === "welfare") of(a.user_code).welfare[i] = true;
    else if (a.kind === "group") of(a.user_code).group[i] = true;
  });
  users.forEach((u) => {
    const inviter = (u.invited_by || "").trim();
    if (!inviter) return;
    const inviterCode = idToCode.get(inviter);
    if (!inviterCode || inviterCode === u.code) return;
    const day = kstDayOf(u.created_at);
    const i = dates.indexOf(day);
    if (i >= 0) of(inviterCode).invites[i] += 1;
  });

  const dailyOf = (f: Flags | undefined, area: LeagueArea): number[] =>
    dates.map((_, i) => {
      const g = f ?? blank();
      const inv = g.invites[i] || 0;
      switch (area) {
        case "brain":
          return g.quiz[i] || 0;
        case "health":
          return g.health[i] || 0;
        case "attend":
          return g.attend[i] ? 1 : 0;
        case "save":
          return g.welfare[i] ? 1 : 0;
        case "share":
          return inv;
        default: {
          const raw =
            (g.attend[i] ? LEAGUE_POINTS.attend : 0) +
            (g.done[i] ? LEAGUE_POINTS.quiz : 0) +
            ((g.health[i] || 0) > 0 ? LEAGUE_POINTS.health : 0) +
            (g.welfare[i] ? LEAGUE_POINTS.welfare : 0) +
            (g.group[i] ? LEAGUE_POINTS.group : 0) +
            inv * LEAGUE_POINTS.invite;
          return Math.min(LEAGUE_DAILY_CAP, raw);
        }
      }
    });

  const scoreOf = (daily: number[]) => daily.reduce((s, v) => s + Math.max(0, v), 0);

  const persons: RankParticipant[] = [];
  let me: RankParticipant | null = null;
  const myFlags = flags.get(opts.code);
  // ‘지역별’은 시·군·구가 아니라 광역 시·도 단위로 묶는다 — 약칭·정식 명칭이 섞여도 같은 도로 본다.
  const mySido = normalizeSido(opts.sido);

  users.forEach((u) => {
    if (u.ranking_visible === false) return; // 랭킹 참여 OFF — 공개 순위표에서 빠진다
    if (opts.range === "region" && normalizeSido(u.sido) !== mySido) return;
    if (opts.range === "age" && ageBandOf(u.birth_year) !== opts.band) return;

    let daily = dailyOf(flags.get(u.code), opts.area);
    if (u.code === opts.code && opts.myDaily) {
      // 방금 이 기기에서 한 활동까지 반영(서버 저장값과 큰 쪽) — 아직 오지 않은 날은 세지 않는다.
      daily = daily.map((v, i) =>
        dates[i] > opts.today ? v : Math.max(v, opts.myDaily![i] || 0)
      );
    }
    const total = scoreOf(daily);
    if (u.code === opts.code) {
      if (!opts.visible || total <= 0) return;
      const acc = accuracy.get(u.code);
      me = {
        name: u.nickname || "나",
        key: u.code,
        avatarUrl: normalizeAvatarUrl(u.avatar_url),
        isMe: true,
        daily,
        grade: gradeChipOf(opts.lifetime?.get(u.code)?.lifetime_points),
        note:
          opts.area === "brain" && acc && acc.total > 0
            ? `정답률 ${Math.round((acc.correct / acc.total) * 100)}%`
            : undefined,
      };
      return;
    }
    if (total <= 0) return; // 이번 주에 참여하지 않은 사람은 순위표에 올리지 않는다
    const acc = accuracy.get(u.code);
    persons.push({
      name: u.nickname,
      key: u.code,
      avatarUrl: normalizeAvatarUrl(u.avatar_url),
      daily,
      grade: gradeChipOf(opts.lifetime?.get(u.code)?.lifetime_points),
      note:
        opts.area === "brain" && acc && acc.total > 0
          ? `정답률 ${Math.round((acc.correct / acc.total) * 100)}%`
          : undefined,
    });
  });

  persons.sort((a, b) => scoreOf(b.daily) - scoreOf(a.daily));
  const myInvites = dailyOf(myFlags, "share");
  const invitesByDay: Record<string, number> = {};
  dates.forEach((d, i) => {
    if (myInvites[i] > 0) invitesByDay[d] = myInvites[i];
  });

  return { others: persons.slice(0, 200), me, invitesByDay };
}

/* ------------------------------------------------------------------ */
/* 단체(모임)별 순위                                                    */
/* ------------------------------------------------------------------ */

type GroupRow = { id: string; name: string; is_demo: boolean };
type MemberRow = { group_id: string; user_code: string; name: string; role: string };

async function groupsFromDb(
  env: DbEnv,
  weekId: string,
  code: string,
  myPoints: number
): Promise<{ myGroups: { id: string; name: string; memberCount: number; points: number; attendedToday: number }[]; total: number } | null> {
  if (!supabaseConfig(env).configured) return null;
  const today = kstDate();

  // 체험 모임(is_demo)은 예시 회원으로 채워진 모임이라 단체 순위에서 뺀다.
  const groups = (await sbGet<GroupRow>(env, `groups?select=id,name,is_demo&limit=200`)).filter(
    (g) => !g.is_demo
  );
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

  const mine: { id: string; name: string; memberCount: number; points: number; attendedToday: number }[] = [];
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
      points = Math.max(points, myPoints);
      mine.push({ id: g.id, name: g.name, memberCount: list.length, points, attendedToday });
    }
  });

  return { myGroups: mine, total: groups.length };
}


/* ------------------------------------------------------------------ */
/* 모임 대항전 — 모임별 이번 주 점수                                     */
/* ------------------------------------------------------------------ */

function weekScoreOf(flags: {
  attend: boolean[];
  quiz: boolean[];
  health: number[];
  welfare: boolean[];
  group: boolean[];
  invites: number[];
}): number {
  let total = 0;
  for (let i = 0; i < flags.attend.length; i++) {
    const raw =
      (flags.attend[i] ? LEAGUE_POINTS.attend : 0) +
      (flags.quiz[i] ? LEAGUE_POINTS.quiz : 0) +
      ((flags.health[i] || 0) > 0 ? LEAGUE_POINTS.health : 0) +
      (flags.welfare[i] ? LEAGUE_POINTS.welfare : 0) +
      (flags.group[i] ? LEAGUE_POINTS.group : 0) +
      Math.max(0, flags.invites[i] || 0) * LEAGUE_POINTS.invite;
    total += Math.min(LEAGUE_DAILY_CAP, raw);
  }
  return total;
}

async function groupBattleScores(
  env: DbEnv,
  weekId: string,
  today: string,
  code: string
): Promise<{ id: string; name: string; memberCount: number; score: number }[] | null> {
  const dates = weekDatesOf(today);
  const start = dates[0];
  const end = dates[6];
  // 체험 모임(is_demo)은 예시 회원으로 채워진 모임이라 랭킹 집계에서 뺀다.
  const groups = await sbGet<{ id: string; name: string; is_demo?: boolean }>(
    env,
    `groups?select=id,name,is_demo&limit=200`
  )
    .then((rows) => rows.filter((g) => !g.is_demo))
    .catch(() => [] as { id: string; name: string; is_demo?: boolean }[]);
  if (!groups.length) return null;
  const members = await sbGet<{ group_id: string; user_code: string; role: string }>(
    env,
    `group_members?select=group_id,user_code,role&limit=5000`
  ).catch(() => []);
  if (!members.length) return null;

  const [users, visits, quiz, health, acts] = await Promise.all([
    sbGet<UserRow>(
      env,
      `users?select=code,nickname,external_id,created_at&limit=1000`
    ).catch(() => [] as UserRow[]),
    sbGet<{ user_code: string; visit_date: string }>(
      env,
      `daily_visits?visit_date=gte.${start}&visit_date=lte.${end}&select=user_code,visit_date&limit=8000`
    ).catch(() => [] as { user_code: string; visit_date: string }[]),
    sbGet<{ user_code: string; quiz_date: string }>(
      env,
      `quiz_logs?week_id=eq.${enc(weekId)}&select=user_code,quiz_date&limit=8000`
    ).catch(() => [] as { user_code: string; quiz_date: string }[]),
    sbGet<{ user_code: string; check_date: string; challenges: string[] }>(
      env,
      `health_checks?check_date=gte.${start}&check_date=lte.${end}&select=user_code,check_date,challenges&limit=8000`
    ).catch(() => [] as { user_code: string; check_date: string; challenges: string[] }[]),
    sbGet<{ user_code: string; activity_date: string; kind: string }>(
      env,
      `activity_logs?activity_date=gte.${start}&activity_date=lte.${end}&select=user_code,activity_date,kind&limit=8000`
    ).catch(() => [] as { user_code: string; activity_date: string; kind: string }[]),
  ]);

  const blank = () => ({
    attend: new Array(7).fill(false) as boolean[],
    quiz: new Array(7).fill(false) as boolean[],
    health: new Array(7).fill(0) as number[],
    welfare: new Array(7).fill(false) as boolean[],
    group: new Array(7).fill(false) as boolean[],
    invites: new Array(7).fill(0) as number[],
  });
  const flags = new Map<string, ReturnType<typeof blank>>();
  const of = (c: string) => {
    if (!flags.has(c)) flags.set(c, blank());
    return flags.get(c)!;
  };

  visits.forEach((v) => {
    const i = dates.indexOf(v.visit_date);
    if (i >= 0) of(v.user_code).attend[i] = true;
  });
  quiz.forEach((q) => {
    const i = dates.indexOf(q.quiz_date);
    if (i >= 0) of(q.user_code).quiz[i] = true;
  });
  health.forEach((h) => {
    const i = dates.indexOf(h.check_date);
    if (i >= 0) of(h.user_code).health[i] = Array.isArray(h.challenges) ? h.challenges.length : 0;
  });
  acts.forEach((a) => {
    const i = dates.indexOf(a.activity_date);
    if (i < 0) return;
    if (a.kind === "welfare") of(a.user_code).welfare[i] = true;
    else if (a.kind === "group") of(a.user_code).group[i] = true;
  });
  const idToCode = new Map<string, string>();
  users.forEach((u) => {
    if (u.external_id) idToCode.set(u.external_id, u.code);
  });
  users.forEach((u) => {
    const by = (u.invited_by || "").trim();
    if (!by) return;
    const inviter = idToCode.get(by);
    if (!inviter) return;
    const i = dates.indexOf(kstDayOf(u.created_at));
    if (i >= 0) of(inviter).invites[i] += 1;
  });

  const pointsBy = new Map<string, number>();
  flags.forEach((f, c) => pointsBy.set(c, weekScoreOf(f)));

  return groups
    .map((g) => {
      const list = members.filter((m) => m.group_id === g.id);
      if (!list.length) return null;
      let score = 0;
      list.forEach((m) => {
        if (m.role === "demo") score += demoPoints(m.user_code, weekId);
        else score += pointsBy.get(m.user_code) || 0;
      });
      return { id: g.id, name: g.name, memberCount: list.length, score };
    })
    .filter((x): x is { id: string; name: string; memberCount: number; score: number } => Boolean(x));
}

export const onRequestGet = async ({ request, env }: Ctx) => {
  const p = new URL(request.url).searchParams;
  const scopeParam = p.get("scope") || "";
  const weekId = p.get("weekId") || weekIdOf();
  const todayParam = p.get("today") || "";
  const today = /^\d{4}-\d{2}-\d{2}$/.test(todayParam) ? todayParam : kstDate();

  // 단체(모임)별 순위 — 모임 하나가 한 줄
  if (scopeParam === "groups") {
    const code = p.get("code") || "";
    const myPoints = Number(p.get("points") || 0);
    let real: Awaited<ReturnType<typeof groupsFromDb>> = null;
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

  // 내 등급·배지 요약 — 누적 점수(등급)·활동 배지·연속 출석
  if (scopeParam === "profile" || scopeParam === "me") {
    const code = p.get("code") || "";
    let stats: LifetimeStats = emptyStats();
    let sample = true;
    try {
      const rows = await sbGet<LifetimeRow>(
        env,
        `v_user_lifetime?code=eq.${enc(code)}&select=code,lifetime_points,attend_days,quiz_days,quiz_correct,health_days,welfare_days,group_days,invite_count,group_count,group_mates`
      );
      const row = rows[0];
      if (row) {
        const visits = await sbGet<{ visit_date: string }>(
          env,
          `daily_visits?user_code=eq.${enc(code)}&select=visit_date&order=visit_date.desc&limit=120`
        ).catch(() => [] as { visit_date: string }[]);
        stats = {
          ...emptyStats(),
          lifetimePoints: Math.max(0, Number(row.lifetime_points) || 0),
          attendDays: Math.max(0, Number(row.attend_days) || 0),
          streak: streakOf(visits.map((v) => v.visit_date), today),
          quizCorrect: Math.max(0, Number(row.quiz_correct) || 0),
          quizDays: Math.max(0, Number(row.quiz_days) || 0),
          healthDays: Math.max(0, Number(row.health_days) || 0),
          welfareDays: Math.max(0, Number(row.welfare_days) || 0),
          groupDays: Math.max(0, Number(row.group_days) || 0),
          inviteCount: Math.max(0, Number(row.invite_count) || 0),
          groupMates: Math.max(0, Number(row.group_mates) || 0),
          groupCount: Math.max(0, Number(row.group_count) || 0),
        };
        sample = false;
      }
    } catch {
      sample = true;
    }
    const gv = gradeOf(stats.lifetimePoints);
    return json({
      ok: true,
      totalPoints: stats.lifetimePoints,
      grade: {
        key: gv.grade.key,
        level: gv.grade.level,
        label: gv.grade.label,
        emoji: gv.grade.emoji,
        min: gv.grade.min,
        remaining: gv.remaining,
        percent: gv.percent,
      },
      next: gv.next ? { label: gv.next.label, emoji: gv.next.emoji, min: gv.next.min } : null,
      badges: badgeCards(stats),
      stats,
      message: nextGradeMessage(gv),
      sample,
    });
  }

  // 모임 대항전 — 모임별 이번 주 점수와 공동 목표 진행률
  if (scopeParam === "groupbattle") {
    const code = p.get("code") || "";
    let groups: { id: string; name: string; memberCount: number; score: number }[] = [];
    let sample = true;
    try {
      const real = await groupBattleScores(env, weekId, today, code);
      if (real) {
        groups = real;
        sample = false;
      }
    } catch {
      groups = [];
    }
    const result: GroupBattleResult = buildGroupBattle({ weekId, groups });
    return json({ ok: true, ...result, sample: sample || result.sample });
  }

  const area = parseArea(p.get("area"), scopeParam);
  const range = parseRange(p.get("range") || p.get("scope"), scopeParam);
  const code = p.get("code") || "";
  const visible = p.get("visible") !== "0";
  const sido = normalizeSido(p.get("sido") || "");
  const sigungu = p.get("sigungu") || "";
  const band = Number(p.get("band") || 0) || ageBandOf(Number(p.get("birthYear") || 1955));

  // 모임왕·우리 모임 범위는 모임 자료로 그린다(화면이 모임 상세·단체별 순위를 직접 쓴다)
  if (area === "group" || range === "group") {
    return json({
      ok: true,
      area,
      range,
      scope: "group",
      weekId,
      periodLabel: "",
      rows: [],
      total: 0,
      myRank: null,
      myPercentile: null,
      sample: false,
      delegate: "group",
    });
  }

  let agg: LeagueAggregate = { others: [], me: null, invitesByDay: {} };
  try {
    agg = await leagueAggregate(env, {
      area,
      range,
      weekId,
      today,
      sido,
      sigungu,
      band,
      code,
      myDaily: parseMyDaily(p.get("myd"), area),
      visible,
      lifetime: await lifetimeMap(env),
    });
  } catch {
    agg = { others: [], me: null, invitesByDay: {} };
  }

  const result = buildAreaRanking({
    area,
    range,
    weekId,
    today,
    sido,
    sigungu,
    band,
    others: agg.others,
    me: agg.me,
  });

  return json({
    ok: true,
    ...result,
    // ‘지역별’ 기준 이름 — 시·군·구가 아니라 정식 시·도 명칭(충청북도 등)을 돌려준다.
    regionLabel: range === "region" ? sidoLabel(sido) : undefined,
    invitesByDay: agg.invitesByDay,
  });
};
