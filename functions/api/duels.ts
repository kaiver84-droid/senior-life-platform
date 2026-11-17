import { sbRequest, supabaseConfig } from "../../lib/db";
import type { DbEnv } from "../../lib/db";
import { kstDate, weekIdOf } from "../../lib/week";
import { LEAGUE_DAILY_CAP, LEAGUE_POINTS } from "../../lib/league";

/**
 * 친구와 1:1 대결 — 오늘 하루 점수(퀴즈 점수 또는 늘봄왕 종합 점수)를 겨룬다.
 *
 * GET  /api/duels?code=내코드&today=YYYY-MM-DD
 *      → 오늘의 대결 목록 · 받은 신청 · 보낸 신청 · 함께 겨룰 모임원
 * POST /api/duels  { action: "create" | "accept" | "decline" | "cancel" | "link", ... }
 *      → 처리 뒤 같은 모양의 최신 목록을 돌려준다.
 *
 * 점수는 저장값을 믿지 않고 **읽을 때마다** 오늘 기록으로 다시 계산한다
 * (친구가 방금 퀴즈를 풀어도 새로 고치면 바로 반영된다).
 */

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

async function sbWrite(env: DbEnv, path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) {
  const res = await sbRequest(env, path, {
    method,
    headers: { "content-type": "application/json", prefer: "return=representation" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`supabase ${res.status} ${text.slice(0, 160)}`);
  }
  return res.json().catch(() => []);
}

/* ------------------------------------------------------------------ */
/* 오늘 하루 기록                                                      */
/* ------------------------------------------------------------------ */

type DayStat = {
  attend: boolean;
  quizPoints: number;
  quizDone: boolean;
  health: number;
  welfare: boolean;
  group: boolean;
  invites: number;
};

const blankDay = (): DayStat => ({
  attend: false,
  quizPoints: 0,
  quizDone: false,
  health: 0,
  welfare: false,
  group: false,
  invites: 0,
});

type UserLite = { code: string; nickname: string; external_id?: string | null };

async function dayStats(env: DbEnv, date: string, codes: string[]): Promise<Map<string, DayStat>> {
  const out = new Map<string, DayStat>();
  const list = [...new Set(codes.filter(Boolean))];
  if (!list.length) return out;
  list.forEach((c) => out.set(c, blankDay()));
  const inList = `in.(${list.map(enc).join(",")})`;

  const [visits, quiz, health, acts, users, invitees] = await Promise.all([
    sbGet<{ user_code: string }>(env, `daily_visits?visit_date=eq.${enc(date)}&user_code=${inList}&select=user_code`).catch(
      () => []
    ),
    sbGet<{ user_code: string; points: number }>(
      env,
      `quiz_logs?quiz_date=eq.${enc(date)}&user_code=${inList}&select=user_code,points`
    ).catch(() => []),
    sbGet<{ user_code: string; challenges: string[] }>(
      env,
      `health_checks?check_date=eq.${enc(date)}&user_code=${inList}&select=user_code,challenges`
    ).catch(() => []),
    sbGet<{ user_code: string; kind: string }>(
      env,
      `activity_logs?activity_date=eq.${enc(date)}&user_code=${inList}&select=user_code,kind`
    ).catch(() => []),
    sbGet<UserLite>(env, `users?code=${inList}&select=code,nickname,external_id`).catch(() => [] as UserLite[]),
    sbGet<{ invited_by: string }>(
      env,
      `users?created_at=gte.${enc(date)}T00:00:00%2B09:00&created_at=lt.${enc(date)}T24:00:00%2B09:00&select=invited_by&limit=2000`
    ).catch(() => [] as { invited_by: string }[]),
  ]);

  visits.forEach((v) => {
    const s = out.get(v.user_code);
    if (s) s.attend = true;
  });
  quiz.forEach((q) => {
    const s = out.get(q.user_code);
    if (!s) return;
    s.quizPoints += Number(q.points || 0);
    s.quizDone = true;
  });
  health.forEach((h) => {
    const s = out.get(h.user_code);
    if (!s) return;
    s.health = Array.isArray(h.challenges) ? h.challenges.length : 0;
  });
  acts.forEach((a) => {
    const s = out.get(a.user_code);
    if (!s) return;
    if (a.kind === "welfare") s.welfare = true;
    else if (a.kind === "group") s.group = true;
  });

  const idToCode = new Map<string, string>();
  users.forEach((u) => {
    if (u.external_id) idToCode.set(u.external_id, u.code);
  });
  invitees.forEach((row) => {
    const by = (row.invited_by || "").trim();
    if (!by) return;
    const code = idToCode.get(by);
    if (!code) return;
    const s = out.get(code);
    if (s) s.invites += 1;
  });

  return out;
}

function scoreOf(kind: "quiz" | "total", stat: DayStat | undefined, date: string, today: string): number {
  if (!stat || date > today) return 0;
  if (kind === "quiz") return Math.max(0, Math.round(stat.quizPoints));
  const raw =
    (stat.attend ? LEAGUE_POINTS.attend : 0) +
    (stat.quizDone ? LEAGUE_POINTS.quiz : 0) +
    (stat.health > 0 ? LEAGUE_POINTS.health : 0) +
    (stat.welfare ? LEAGUE_POINTS.welfare : 0) +
    (stat.group ? LEAGUE_POINTS.group : 0) +
    Math.max(0, stat.invites) * LEAGUE_POINTS.invite;
  return Math.min(LEAGUE_DAILY_CAP, raw);
}

/* ------------------------------------------------------------------ */
/* 대결 목록                                                           */
/* ------------------------------------------------------------------ */

type DuelRow = {
  id: string;
  duel_date: string;
  week_id: string;
  kind: "quiz" | "total";
  challenger_code: string;
  challenger_name: string;
  opponent_code: string;
  opponent_name: string;
  status: "pending" | "accepted" | "declined";
  from_link: boolean;
  created_at: string;
};

const KIND_LABEL: Record<"quiz" | "total", string> = {
  quiz: "오늘 퀴즈 점수",
  total: "오늘 종합 점수",
};

/** 지고 있어도 상처 주지 않는 격려 문구 (시니어 배려) */
function duelMessage(input: {
  status: "pending" | "accepted" | "declined";
  iAmChallenger: boolean;
  myScore: number;
  otherScore: number;
}): string {
  const { status, iAmChallenger, myScore, otherScore } = input;
  if (status === "declined") {
    return iAmChallenger
      ? "오늘은 친구가 다음에 겨루자고 해요. 내일 다시 신청해 보세요."
      : "오늘은 겨루지 않기로 했어요. 함께 걸어도 좋아요.";
  }
  if (status === "pending") {
    return iAmChallenger
      ? "친구가 수락하면 오늘 점수로 겨뤄요."
      : "수락하면 오늘 점수로 겨루기 시작해요!";
  }
  if (myScore > otherScore) return "지금 내가 앞서고 있어요! 이대로면 오늘 내가 이겨요 👏";
  if (myScore === otherScore) return "지금 동점이에요. 한 문제면 뒤집혀요!";
  return "오늘도 멋진 도전이었어요! 내일 다시 겨뤄 봐요 — 조금만 더 하면 이길 수 있어요.";
}

async function buildPayload(env: DbEnv, code: string, today: string) {
  const myName = await sbGet<UserLite>(env, `users?code=eq.${enc(code)}&select=code,nickname,external_id`).catch(() => []);
  const nameOfMe = myName[0]?.nickname || "나";

  let rows: DuelRow[] = [];
  try {
    rows = await sbGet<DuelRow>(
      env,
      `duels?duel_date=eq.${enc(today)}&or=(challenger_code.eq.${enc(code)},opponent_code.eq.${enc(code)})&order=created_at.desc&limit=40`
    );
  } catch {
    rows = [];
  }

  const codes: string[] = [];
  rows.forEach((r) => codes.push(r.challenger_code, r.opponent_code));
  const stats = await dayStats(env, today, codes);

  const duels = rows.map((r) => {
    const iAmChallenger = r.challenger_code === code;
    const otherCode = iAmChallenger ? r.opponent_code : r.challenger_code;
    const otherName = iAmChallenger ? r.opponent_name : r.challenger_name;
    const myScore = scoreOf(r.kind, stats.get(code), today, today);
    const otherScore = scoreOf(r.kind, stats.get(otherCode), today, today);
    return {
      id: r.id,
      kind: r.kind,
      kindLabel: KIND_LABEL[r.kind] ?? KIND_LABEL.total,
      status: r.status,
      iAmChallenger,
      otherName,
      myName: nameOfMe,
      myScore,
      otherScore,
      lead: myScore > otherScore ? "win" : myScore < otherScore ? "lose" : "tie",
      message: duelMessage({ status: r.status, iAmChallenger, myScore, otherScore }),
      fromLink: Boolean(r.from_link),
      createdAt: r.created_at,
      duelDate: r.duel_date,
    } as const;
  });

  // 함께 겨룰 수 있는 모임원 — 체험(demo) 회원은 실제로 응답할 수 없으니 뺀다.
  type MemberRow = { group_id: string; user_code: string; name: string; role: string };
  type GroupLite = { id: string; name: string };
  let partners: { code: string; name: string; groupName: string }[] = [];
  try {
    const mine = await sbGet<MemberRow>(env, `group_members?user_code=eq.${enc(code)}&select=group_id,user_code,name,role`);
    const groupIds = mine.map((m) => m.group_id).filter(Boolean);
    if (groupIds.length) {
      const members = await sbGet<MemberRow>(
        env,
        `group_members?group_id=in.(${groupIds.map(enc).join(",")})&role=neq.demo&select=group_id,user_code,name,role&limit=1000`
      );
      const groups = await sbGet<GroupLite>(
        env,
        `groups?id=in.(${groupIds.map(enc).join(",")})&select=id,name`
      ).catch(() => [] as GroupLite[]);
      const groupName = new Map(groups.map((g) => [g.id, g.name]));
      const seen = new Set<string>();
      members.forEach((m) => {
        if (m.user_code === code || seen.has(m.user_code)) return;
        seen.add(m.user_code);
        partners.push({ code: m.user_code, name: m.name, groupName: groupName.get(m.group_id) || "우리 모임" });
      });
    }
  } catch {
    partners = [];
  }

  const sorted = [...duels].sort((a, b) => (a.status === "pending" ? -1 : 0) - (b.status === "pending" ? -1 : 0));
  return {
    ok: true,
    today,
    myCode: code,
    myName: nameOfMe,
    duels: sorted,
    incoming: duels.filter((d) => !d.iAmChallenger && d.status === "pending"),
    outgoing: duels.filter((d) => d.iAmChallenger && d.status === "pending"),
    partners,
  };
}

/* ------------------------------------------------------------------ */
/* GET · POST                                                          */
/* ------------------------------------------------------------------ */

export const onRequestGet = async ({ request, env }: Ctx) => {
  const p = new URL(request.url).searchParams;
  const code = (p.get("code") || "").trim();
  if (!code) return json({ ok: false, error: "code_required" }, 400);
  const todayParam = p.get("today") || "";
  const today = /^\d{4}-\d{2}-\d{2}$/.test(todayParam) ? todayParam : kstDate();
  if (!supabaseConfig(env).configured) {
    return json({ ok: true, today, myCode: code, myName: "나", duels: [], incoming: [], outgoing: [], partners: [] });
  }
  try {
    return json(await buildPayload(env, code, today));
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 200) }, 500);
  }
};

export const onRequestPost = async ({ request, env }: Ctx) => {
  let body: {
    action?: string;
    code?: string;
    opponentCode?: string;
    challengerCode?: string;
    kind?: string;
    id?: string;
    today?: string;
  };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }
  const code = (body.code || "").trim();
  const action = body.action || "";
  if (!code) return json({ ok: false, error: "code_required" }, 400);
  const today = /^\d{4}-\d{2}-\d{2}$/.test(body.today || "") ? (body.today as string) : kstDate();
  if (!supabaseConfig(env).configured) return json({ ok: false, error: "db_not_configured" }, 503);

  const kind: "quiz" | "total" = body.kind === "quiz" ? "quiz" : "total";

  try {
    if (action === "create") {
      const opponent = (body.opponentCode || "").trim();
      if (!opponent || opponent === code) return json({ ok: false, error: "bad_opponent" }, 400);
      const rows = await sbGet<UserLite>(env, `users?code=eq.${enc(opponent)}&select=code,nickname`).catch(() => []);
      const me = await sbGet<UserLite>(env, `users?code=eq.${enc(code)}&select=code,nickname`).catch(() => []);
      if (!rows.length) return json({ ok: false, error: "no_opponent" }, 404);
      if (!me.length) return json({ ok: false, error: "no_me" }, 404);
      await sbWrite(env, "duels?on_conflict=duel_date,challenger_code,opponent_code,kind", "POST", [
        {
          duel_date: today,
          week_id: weekIdOf(today),
          kind,
          challenger_code: code,
          challenger_name: me[0].nickname,
          opponent_code: opponent,
          opponent_name: rows[0].nickname,
          status: "pending",
          from_link: false,
        },
      ]);
      // 같은 날 반대 방향 신청이 이미 있으면 서로 겨루는 것으로 맞춰 준다.
      await sbWrite(
        env,
        `duels?duel_date=eq.${enc(today)}&challenger_code=eq.${enc(opponent)}&opponent_code=eq.${enc(code)}&status=eq.pending`,
        "PATCH",
        { status: "accepted", accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      ).catch(() => []);
    } else if (action === "link") {
      // 대결 링크(?duel=신청한사람코드)로 들어온 사람이 수락 → 바로 겨루기 시작
      const challenger = (body.challengerCode || "").trim();
      if (!challenger || challenger === code) return json({ ok: false, error: "bad_challenger" }, 400);
      const rows = await sbGet<UserLite>(env, `users?code=eq.${enc(challenger)}&select=code,nickname`).catch(() => []);
      const me = await sbGet<UserLite>(env, `users?code=eq.${enc(code)}&select=code,nickname`).catch(() => []);
      if (!rows.length) return json({ ok: false, error: "no_challenger" }, 404);
      if (!me.length) return json({ ok: false, error: "no_me" }, 404);
      await sbWrite(env, "duels?on_conflict=duel_date,challenger_code,opponent_code,kind", "POST", [
        {
          duel_date: today,
          week_id: weekIdOf(today),
          kind,
          challenger_code: challenger,
          challenger_name: rows[0].nickname,
          opponent_code: code,
          opponent_name: me[0].nickname,
          status: "accepted",
          from_link: true,
          accepted_at: new Date().toISOString(),
        },
      ]);
    } else if (action === "accept" || action === "decline") {
      const id = (body.id || "").trim();
      if (!id) return json({ ok: false, error: "id_required" }, 400);
      await sbWrite(
        env,
        `duels?id=eq.${enc(id)}&opponent_code=eq.${enc(code)}`,
        "PATCH",
        {
          status: action === "accept" ? "accepted" : "declined",
          accepted_at: action === "accept" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }
      );
    } else if (action === "cancel") {
      const id = (body.id || "").trim();
      if (!id) return json({ ok: false, error: "id_required" }, 400);
      await sbWrite(env, `duels?id=eq.${enc(id)}&challenger_code=eq.${enc(code)}`, "DELETE");
    } else {
      return json({ ok: false, error: "bad_action" }, 400);
    }
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 200) }, 500);
  }

  try {
    return json(await buildPayload(env, code, today));
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 200) }, 500);
  }
};
