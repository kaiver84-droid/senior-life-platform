import { dbStatus, getState, rememberInviter, saveFamilyEvents, saveHealth, saveMed, saveQuizLog, saveVisit, upsertUser } from "../../lib/db";
import type { DbEnv, StoredFamilyEvent } from "../../lib/db";

type Ctx = { request: Request; env: DbEnv };

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export const onRequestGet = async ({ request, env }: Ctx) => {
  const code = new URL(request.url).searchParams.get("code");
  if (!code) return json({ ok: false, error: "code_required", ...dbStatus(env) }, 400);
  try {
    const state = await getState(env, code);
    if (!state) return json({ ok: false, error: "not_found", code, ...dbStatus(env) }, 404);
    return json({ ok: true, state, ...dbStatus(env) });
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 300), ...dbStatus(env) }, 500);
  }
};

export const onRequestPost = async ({ request, env }: Ctx) => {
  let body: {
    code?: string;
    profile?: {
      id: string;
      nickname: string;
      birthYear: number;
      birthTime?: string;
      sido: string;
      sigungu: string;
      source: string;
      createdAt: string;
      profileCompleted?: boolean;
      /** 카카오톡 프로필 사진(https) */
      avatarUrl?: string;
      /** 예전 이름(avatarUrl 과 같은 값) */
      avatar?: string;
    };
    quizLogs?: {
      date: string;
      weekId: string;
      correct: number;
      total: number;
      points: number;
      seconds: number;
      types: string[];
    }[];
    med?: Record<string, { morning: boolean; evening: boolean }>;
    visits?: string[];
    familyEvents?: StoredFamilyEvent[];
    /** 날짜별 건강 챌린지 체크인 — { "2026-11-16": ["water","walk"] } */
    health?: Record<string, string[]>;
    /** 초대 링크(?ref=)로 처음 가입했을 때 — 초대한 사람의 내부 id(초대왕 순위) */
    invitedBy?: string;
    today?: string;
  };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  if (!body.code || !body.profile) return json({ ok: false, error: "code_and_profile_required" }, 400);

  const today = body.today || new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const mode = dbStatus(env).supabase;

  try {
    await upsertUser(env, body.code, body.profile);
    if (body.invitedBy) await rememberInviter(env, body.code, body.profile.id, body.invitedBy);
    const latest = body.quizLogs?.[body.quizLogs.length - 1];
    if (latest) await saveQuizLog(env, body.code, latest);
    const med = body.med?.[today];
    if (med) await saveMed(env, body.code, today, med.morning, med.evening);
    if (Array.isArray(body.familyEvents)) await saveFamilyEvents(env, body.code, body.familyEvents);
    if (body.health && typeof body.health === "object") {
      // 오늘 것을 먼저, 이어서 최근 날짜 몇 개까지 저장한다(다른 기기에서 찍은 도장도 함께).
      const todayIds = Array.isArray(body.health[today]) ? body.health[today] : [];
      await saveHealth(env, body.code, today, todayIds);
      const others = Object.entries(body.health)
        .filter(([d]) => d !== today && /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .slice(0, 6);
      for (const [d, ids] of others) {
        if (Array.isArray(ids)) await saveHealth(env, body.code, d, ids);
      }
    }
    await saveVisit(env, body.code, today);
    return json({ ok: true, mode, savedAt: new Date().toISOString() });
  } catch (e) {
    return json({ ok: false, mode, error: String(e).slice(0, 300) }, 500);
  }
};
