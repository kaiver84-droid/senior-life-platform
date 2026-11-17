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
    // 아직 저장된 기록이 없는 번호(처음 로그인한 분)는 오류가 아니라 ‘빈 상태’다.
    // 404 를 주면 브라우저 콘솔·네트워크에 빨간 오류가 남아, 화면이 멀쩡해도 고장처럼 보인다.
    if (!state) return json({ ok: true, state: null, found: false, ...dbStatus(env) });
    return json({ ok: true, state, found: true, ...dbStatus(env) });
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

  // 잘못된 값(이름 없음·태어난 해 범위 밖)은 DB 오류(500)로 터지지 않게 미리 막는다.
  // 화면에는 ‘무엇이 잘못됐는지’만 알려 주고, DB 오류 문구는 밖으로 내보내지 않는다.
  const nick = String(body.profile.nickname ?? "").trim();
  const birthYear = Number(body.profile.birthYear);
  if (!nick || nick.length > 20 || !Number.isInteger(birthYear) || birthYear < 1900 || birthYear > 2020) {
    return json({ ok: false, error: "invalid_profile", message: "이름과 태어난 해를 다시 확인해 주세요." }, 400);
  }

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
