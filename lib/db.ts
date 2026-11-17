/**
 * 데이터 저장 레이어.
 * - `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`(또는 anon key)가 있으면 Supabase(PostgreSQL)에 저장
 * - 없으면 프로세스 메모리에만 저장(데모 모드). 화면 기능은 어느 쪽이든 동일하게 동작한다.
 *
 * Supabase 는 PostgREST(REST) 로 접근하므로 별도 SDK 없이 fetch 만 사용한다.
 */
import { normalizeAvatarUrl } from "./avatar";

export type DbEnv = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  NEXT_PUBLIC_KAKAO_JS_KEY?: string;
  KAKAO_CLIENT_ID?: string;
  KAKAO_CLIENT_SECRET?: string;
  KAKAO_REDIRECT_URI?: string;
};

export type StoredProfile = {
  id: string;
  nickname: string;
  birthYear: number;
  /** 십이시진 이름("자시" … "해시") 또는 "모름" */
  birthTime?: string;
  sido: string;
  sigungu: string;
  source: string;
  createdAt: string;
  /** 최초 1회 초기 설정을 마쳤는지 — true 면 다시 로그인해도 설정 화면을 건너뛴다 */
  profileCompleted?: boolean;
  /** 카카오톡 프로필 사진(https) — 랭킹·모임 출석 현황에 원형 사진으로 보인다 */
  avatarUrl?: string;
  /** 예전 이름(avatarUrl 과 같은 값) */
  avatar?: string;
};

export type StoredQuizLog = {
  date: string;
  weekId: string;
  correct: number;
  total: number;
  points: number;
  seconds: number;
  types: string[];
};

export type StoredFamilyEvent = {
  id: string;
  title: string;
  date: string;
  repeatYearly: boolean;
  kind: string;
  memo?: string;
  /** 알람 시점 — none(끄기) · 0(당일) · 1(1일 전) · 3(3일 전). 없는 예전 일정은 기본값으로 읽힌다 */
  alarm?: string;
  /** 알람 시각 HH:MM */
  alarmTime?: string;
  /** 양력/음력 — 없는 예전 일정은 양력으로 읽힌다 */
  calendarType?: string;
  /** 음력 윤달인지 */
  isLeapMonth?: boolean;
  createdAt?: string;
};

/** 날짜(YYYY-MM-DD) → 그날 체크한 건강 챌린지 id 목록 */
export type StoredHealth = Record<string, string[]>;

export type StoredState = {
  code: string;
  profile: StoredProfile | null;
  quizLogs: StoredQuizLog[];
  med: Record<string, { morning: boolean; evening: boolean }>;
  visits: string[];
  /** 가족안부달력 일정 (한 사람당 한 줄에 JSON 배열로 저장) */
  familyEvents: StoredFamilyEvent[];
  /** 건강생활 챌린지 체크인 (날짜별) */
  health: StoredHealth;
  updatedAt: string;
};

export function supabaseConfig(env: DbEnv) {
  const url = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return { url, key, configured: Boolean(url && key) };
}

const TABLE = {
  users: "users",
  quiz: "quiz_logs",
  med: "med_checks",
  visits: "daily_visits",
  rankings: "rankings_weekly",
  family: "family_events",
  health: "health_checks",
};

/** PostgREST 호출 (모임 API 등 다른 모듈에서도 같은 키·헤더로 쓴다) */
export async function sbRequest(env: DbEnv, path: string, init: RequestInit = {}): Promise<Response> {
  const { url, key } = supabaseConfig(env);
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
      ...(init.headers || {}),
    },
  });
}

/* ------------------------------------------------------------------ */
/* 메모리 폴백                                                         */
/* ------------------------------------------------------------------ */

type GlobalStore = { __seniorPlatformStore?: Map<string, StoredState> };
const g = globalThis as unknown as GlobalStore;
const store: Map<string, StoredState> = (g.__seniorPlatformStore ||= new Map());

function memoryGet(code: string): StoredState | null {
  return store.get(code) ?? null;
}

function memoryMerge(code: string, patch: Partial<StoredState>): StoredState {
  const cur: StoredState =
    store.get(code) ?? {
      code,
      profile: null,
      quizLogs: [],
      med: {},
      visits: [],
      familyEvents: [],
      health: {},
      updatedAt: new Date().toISOString(),
    };
  const next: StoredState = {
    ...cur,
    ...patch,
    profile: patch.profile ?? cur.profile,
    quizLogs: patch.quizLogs ?? cur.quizLogs,
    med: patch.med ?? cur.med,
    visits: patch.visits ?? cur.visits,
    familyEvents: patch.familyEvents ?? cur.familyEvents,
    health: patch.health ?? cur.health ?? {},
    updatedAt: new Date().toISOString(),
  };
  store.set(code, next);
  return next;
}

/* ------------------------------------------------------------------ */
/* 공개 API                                                            */
/* ------------------------------------------------------------------ */

export function dbStatus(env: DbEnv) {
  const { configured } = supabaseConfig(env);
  return {
    supabase: configured ? "connected" : "demo",
    // REST API 키만 있으면 카카오 로그인·공유가 동작한다(Client Secret 은 콘솔에서 '사용 안 함' 가능).
    kakao: env.KAKAO_CLIENT_ID
      ? "configured"
      : env.NEXT_PUBLIC_KAKAO_JS_KEY
        ? "js-only"
        : "not-configured",
  };
}

export async function upsertUser(env: DbEnv, code: string, profile: StoredProfile) {
  const { configured } = supabaseConfig(env);
  if (!configured) {
    memoryMerge(code, { profile });
    return { ok: true, mode: "demo" as const };
  }
  const res = await sbRequest(env, `${TABLE.users}?on_conflict=code`, {
    method: "POST",
    body: JSON.stringify([
      {
        code,
        nickname: profile.nickname,
        birth_year: profile.birthYear,
        birth_time: profile.birthTime || "모름",
        sido: profile.sido,
        sigungu: profile.sigungu,
        source: profile.source,
        external_id: profile.id,
        profile_completed: Boolean(profile.profileCompleted),
        last_seen_at: new Date().toISOString(),
        // 사진이 없을 때는 이 열을 보내지 않는다 — 다른 기기에서 저장된 사진을 지우지 않게.
        ...(() => {
          const avatarUrl = normalizeAvatarUrl(profile.avatarUrl || profile.avatar);
          return avatarUrl ? { avatar_url: avatarUrl } : {};
        })(),
      },
    ]),
  });
  if (!res.ok) throw new Error(`supabase users ${res.status}: ${await res.text()}`);
  return { ok: true, mode: "supabase" as const };
}

/**
 * 초대왕 집계 — ‘누가 초대했는지’(invited_by)를 계정마다 한 번만 적는다.
 * 이미 초대한 사람이 있으면 그대로 두고(first touch), 자기 자신 초대는 세지 않는다.
 */
export async function rememberInviter(env: DbEnv, code: string, myId: string, inviterId?: string) {
  const inviter = (inviterId || "").trim();
  if (!inviter || !myId || inviter === myId) return;
  const { configured } = supabaseConfig(env);
  if (!configured) return;
  try {
    await sbRequest(
      env,
      `${TABLE.users}?code=eq.${encodeURIComponent(code)}&invited_by=is.null`,
      {
        method: "PATCH",
        body: JSON.stringify({ invited_by: inviter }),
        headers: { Prefer: "return=minimal" },
      }
    );
  } catch {
    /* 초대 기록은 부가 정보 — 실패해도 저장은 그대로 */
  }
}

export async function saveQuizLog(env: DbEnv, code: string, log: StoredQuizLog) {
  const { configured } = supabaseConfig(env);
  if (!configured) {
    const cur = memoryGet(code);
    const logs = (cur?.quizLogs ?? []).filter((l) => !(l.date === log.date && l.weekId === log.weekId));
    memoryMerge(code, { quizLogs: [...logs, log] });
    return { ok: true, mode: "demo" as const };
  }
  const res = await sbRequest(env, `${TABLE.quiz}?on_conflict=user_code,quiz_date`, {
    method: "POST",
    body: JSON.stringify([
      {
        user_code: code,
        quiz_date: log.date,
        week_id: log.weekId,
        correct: log.correct,
        total: log.total,
        points: log.points,
        seconds: log.seconds,
        types: log.types,
      },
    ]),
  });
  if (!res.ok) throw new Error(`supabase quiz ${res.status}: ${await res.text()}`);
  return { ok: true, mode: "supabase" as const };
}

export async function saveMed(env: DbEnv, code: string, date: string, morning: boolean, evening: boolean) {
  const { configured } = supabaseConfig(env);
  if (!configured) {
    const cur = memoryGet(code);
    const med = { ...(cur?.med ?? {}), [date]: { morning, evening } };
    memoryMerge(code, { med });
    return { ok: true, mode: "demo" as const };
  }
  const res = await sbRequest(env, `${TABLE.med}?on_conflict=user_code,check_date`, {
    method: "POST",
    body: JSON.stringify([{ user_code: code, check_date: date, morning, evening, updated_at: new Date().toISOString() }]),
  });
  if (!res.ok) throw new Error(`supabase med ${res.status}: ${await res.text()}`);
  return { ok: true, mode: "supabase" as const };
}

export async function saveFamilyEvents(env: DbEnv, code: string, events: StoredFamilyEvent[]) {
  const { configured } = supabaseConfig(env);
  if (!configured) {
    memoryMerge(code, { familyEvents: events });
    return { ok: true, mode: "demo" as const };
  }
  // 가족 일정은 사용자당 한 줄에 통째로 저장한다(추가·수정·삭제가 한 번에 반영된다).
  const res = await sbRequest(env, `${TABLE.family}?on_conflict=user_code`, {
    method: "POST",
    body: JSON.stringify([{ user_code: code, events, updated_at: new Date().toISOString() }]),
  });
  if (!res.ok) throw new Error(`supabase family_events ${res.status}: ${await res.text()}`);
  return { ok: true, mode: "supabase" as const };
}

/**
 * 건강생활 챌린지 체크인 — 날짜별 한 줄에 체크한 id 배열을 저장한다.
 * 빈 배열이면 그날 도장을 모두 지운다(모두 해제한 경우).
 */
export async function saveHealth(env: DbEnv, code: string, date: string, ids: string[]) {
  const { configured } = supabaseConfig(env);
  const clean = Array.from(new Set(ids.filter((x) => typeof x === "string" && x))).slice(0, 10);
  if (!configured) {
    const cur = memoryGet(code);
    const health: StoredHealth = { ...(cur?.health ?? {}) };
    if (clean.length) health[date] = clean;
    else delete health[date];
    memoryMerge(code, { health });
    return { ok: true, mode: "demo" as const };
  }
  if (!clean.length) {
    const res = await sbRequest(env, `${TABLE.health}?user_code=eq.${encodeURIComponent(code)}&check_date=eq.${date}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
    if (!res.ok) throw new Error(`supabase health delete ${res.status}: ${await res.text()}`);
    return { ok: true, mode: "supabase" as const };
  }
  const res = await sbRequest(env, `${TABLE.health}?on_conflict=user_code,check_date`, {
    method: "POST",
    body: JSON.stringify([
      { user_code: code, check_date: date, challenges: clean, updated_at: new Date().toISOString() },
    ]),
  });
  if (!res.ok) throw new Error(`supabase health ${res.status}: ${await res.text()}`);
  return { ok: true, mode: "supabase" as const };
}

export async function saveVisit(env: DbEnv, code: string, date: string) {
  const { configured } = supabaseConfig(env);
  if (!configured) {
    const cur = memoryGet(code);
    const visits = Array.from(new Set([...(cur?.visits ?? []), date])).slice(-60);
    memoryMerge(code, { visits });
    return { ok: true, mode: "demo" as const };
  }
  const res = await sbRequest(env, `${TABLE.visits}?on_conflict=user_code,visit_date`, {
    method: "POST",
    body: JSON.stringify([{ user_code: code, visit_date: date }]),
  });
  if (!res.ok) throw new Error(`supabase visits ${res.status}: ${await res.text()}`);
  return { ok: true, mode: "supabase" as const };
}

export async function getState(env: DbEnv, code: string): Promise<StoredState | null> {
  const { configured } = supabaseConfig(env);
  if (!configured) return memoryGet(code);

  const [users, quiz, med, visits, family, health] = await Promise.all([
    sbRequest(env, `${TABLE.users}?code=eq.${encodeURIComponent(code)}&limit=1`).then((r) => (r.ok ? r.json() : [])),
    sbRequest(
      env,
      `${TABLE.quiz}?user_code=eq.${encodeURIComponent(code)}&order=quiz_date.desc&limit=40`
    ).then((r) => (r.ok ? r.json() : [])),
    sbRequest(env, `${TABLE.med}?user_code=eq.${encodeURIComponent(code)}&order=check_date.desc&limit=30`).then((r) =>
      r.ok ? r.json() : []
    ),
    sbRequest(env, `${TABLE.visits}?user_code=eq.${encodeURIComponent(code)}&order=visit_date.desc&limit=30`).then((r) =>
      r.ok ? r.json() : []
    ),
    sbRequest(env, `${TABLE.family}?user_code=eq.${encodeURIComponent(code)}&limit=1`).then((r) =>
      r.ok ? r.json() : []
    ),
    sbRequest(
      env,
      `${TABLE.health}?user_code=eq.${encodeURIComponent(code)}&order=check_date.desc&limit=30`
    ).then((r) => (r.ok ? r.json() : [])),
  ]);

  const u = Array.isArray(users) ? users[0] : null;
  if (!u && (!Array.isArray(quiz) || quiz.length === 0)) return null;

  const medMap: Record<string, { morning: boolean; evening: boolean }> = {};
  (Array.isArray(med) ? med : []).forEach((m: { check_date: string; morning: boolean; evening: boolean }) => {
    medMap[m.check_date] = { morning: m.morning, evening: m.evening };
  });

  const healthMap: StoredHealth = {};
  (Array.isArray(health) ? health : []).forEach((h: { check_date: string; challenges: string[] }) => {
    if (!h?.check_date) return;
    const ids = Array.isArray(h.challenges) ? h.challenges.filter((x) => typeof x === "string") : [];
    if (ids.length) healthMap[h.check_date] = ids;
  });

  return {
    code,
    profile: u
      ? {
          id: u.external_id || code,
          nickname: u.nickname,
          birthYear: u.birth_year,
          birthTime: u.birth_time || "모름",
          sido: u.sido,
          sigungu: u.sigungu,
          source: u.source || "demo",
          createdAt: u.created_at,
          profileCompleted: Boolean(u.profile_completed),
          avatarUrl: normalizeAvatarUrl(u.avatar_url),
          avatar: normalizeAvatarUrl(u.avatar_url),
        }
      : null,
    quizLogs: (Array.isArray(quiz) ? quiz : []).map(
      (q: {
        quiz_date: string;
        week_id: string;
        correct: number;
        total: number;
        points: number;
        seconds: number;
        types: string[];
      }) => ({
        date: q.quiz_date,
        weekId: q.week_id,
        correct: q.correct,
        total: q.total,
        points: q.points,
        seconds: q.seconds,
        types: q.types || [],
      })
    ),
    med: medMap,
    visits: (Array.isArray(visits) ? visits : []).map((v: { visit_date: string }) => v.visit_date),
    familyEvents: (Array.isArray(family) && family[0] && Array.isArray(family[0].events)
      ? family[0].events
      : []) as StoredFamilyEvent[],
    health: healthMap,
    updatedAt: new Date().toISOString(),
  };
}

/** 주차별 실제 참여자 순위 (Supabase 연결 시) */
export async function getWeeklyRanking(env: DbEnv, weekId: string, limit = 200) {
  const { configured } = supabaseConfig(env);
  if (!configured) return null;
  const res = await sbRequest(
    env,
    `${TABLE.quiz}?week_id=eq.${encodeURIComponent(weekId)}&select=user_code,points,quiz_date&limit=${limit}`
  );
  if (!res.ok) return null;
  return (await res.json()) as { user_code: string; points: number; quiz_date: string }[];
}
