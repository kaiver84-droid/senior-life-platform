import { dbStatus, getState, saveFamilyEvents, saveMed, saveQuizLog, saveVisit, upsertUser } from "../../lib/db";
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
      sido: string;
      sigungu: string;
      source: string;
      createdAt: string;
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
    const latest = body.quizLogs?.[body.quizLogs.length - 1];
    if (latest) await saveQuizLog(env, body.code, latest);
    const med = body.med?.[today];
    if (med) await saveMed(env, body.code, today, med.morning, med.evening);
    if (Array.isArray(body.familyEvents)) await saveFamilyEvents(env, body.code, body.familyEvents);
    await saveVisit(env, body.code, today);
    return json({ ok: true, mode, savedAt: new Date().toISOString() });
  } catch (e) {
    return json({ ok: false, mode, error: String(e).slice(0, 300) }, 500);
  }
};
