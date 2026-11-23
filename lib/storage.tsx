"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AppState, DailyQuiz, HealthChecks, Profile, QuizLog, QuizType } from "./types";
import { HEALTH_IDS, healthOf, mergeHealth } from "./health";
import type { FamilyEvent } from "./calendar";
import { isValidDateKey, newEventId, normalizeAlarm, normalizeAlarmTime } from "./calendar";
import { kstDate, weekIdOf } from "./week";
import { makeCode } from "./code";

// 화면 곳곳에서 `@/lib/storage` 에서 그대로 가져다 쓴다(계산식은 lib/code.ts 한 곳).
export { makeCode };

const KEY = "seniorLife.v1";

function emptyState(): AppState {
  return {
    version: 1,
    profile: null,
    quizLogs: [],
    daily: null,
    med: {},
    visits: [],
    familyEvents: [],
    health: {},
    missions: {},
    rankingVisible: true,
    fontSize: 18,
    lastVisit: "",
  };
}

function read(): AppState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed || parsed.version !== 1) return emptyState();
    const merged = { ...emptyState(), ...parsed };
    // 예전에 저장된 기록에는 가족 일정·건강 체크가 없으므로 빈 값으로 채운다.
    if (!Array.isArray(merged.familyEvents)) merged.familyEvents = [];
    if (!merged.health || typeof merged.health !== "object" || Array.isArray(merged.health)) merged.health = {};
    if (!merged.missions || typeof merged.missions !== "object" || Array.isArray(merged.missions)) merged.missions = {};
    if (typeof merged.rankingVisible !== "boolean") merged.rankingVisible = true;
    return merged;
  } catch {
    return emptyState();
  }
}

function write(state: AppState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* 저장 공간이 없으면 화면은 그대로 동작 */
  }
}

/**
 * 서버(다른 기기)에 남은 퀴즈 기록을 이 기기 기록과 합친다 — 날짜당 한 줄.
 * 같은 날짜는 하루 미션을 마친 기록(total > 0)을 남기고, 점수는 두 쪽 중 큰 쪽을 쓴다
 * (연습으로 모은 점수와 미션 점수가 한 줄에 쌓이므로 작은 쪽으로 덮어쓰지 않는다).
 */
function mergeQuizLogs(local: QuizLog[], remote: QuizLog[]): QuizLog[] {
  const byDate = new Map<string, QuizLog>();
  local.forEach((q) => {
    if (q?.date) byDate.set(q.date, q);
  });
  remote.forEach((r) => {
    if (!r?.date) return;
    const cur = byDate.get(r.date);
    if (!cur) {
      byDate.set(r.date, r);
      return;
    }
    const mission = (Number(cur.total) || 0) > 0 ? cur : (Number(r.total) || 0) > 0 ? r : cur;
    const practice = Math.max(Number(cur.practice) || 0, Number(r.practice) || 0);
    byDate.set(r.date, {
      ...mission,
      points: Math.max(Number(cur.points) || 0, Number(r.points) || 0),
      ...(practice ? { practice } : {}),
    });
  });
  return Array.from(byDate.values())
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(-120);
}

/** 오늘 또는 어제까지 이어진 활동 일수를 센다 */
export function calcStreak(state: AppState, today: string = kstDate()): number {
  const days = new Set<string>();
  state.quizLogs.forEach((q) => days.add(q.date));
  Object.entries(state.med).forEach(([d, m]) => {
    if (m.morning || m.evening) days.add(d);
  });
  Object.entries(state.health ?? {}).forEach(([d, ids]) => {
    if (Array.isArray(ids) && ids.length) days.add(d);
  });
  state.visits.forEach((d) => days.add(d));

  const toDate = (s: string) => new Date(s + "T00:00:00Z").getTime();
  let cursor = today;
  if (!days.has(cursor)) {
    const y = new Date(toDate(today) - 86400000).toISOString().slice(0, 10);
    if (!days.has(y)) return 0;
    cursor = y;
  }
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = new Date(toDate(cursor) - 86400000).toISOString().slice(0, 10);
  }
  return streak;
}

type CompleteInput = { correct: number; total: number; points: number; seconds: number; types: QuizType[] };

export type FamilyEventInput = {
  title: string;
  date: string;
  repeatYearly: boolean;
  kind: FamilyEvent["kind"];
  memo?: string;
  /** 알람 시점 — none(끄기) · 0(당일) · 1(1일 전) · 3(3일 전) */
  alarm?: FamilyEvent["alarm"];
  /** 알람 시각 HH:MM */
  alarmTime?: string;
  /** 양력/음력 — 안 적으면 양력 */
  calendarType?: FamilyEvent["calendarType"];
  /** 음력 윤달인지 */
  isLeapMonth?: boolean;
};

type Ctx = {
  ready: boolean;
  state: AppState;
  profile: Profile | null;
  streak: number;
  fontSize: 18 | 21 | 24;
  code: string;
  today: string;
  weekId: string;
  weekPoints: number;
  todayDaily: DailyQuiz | null;
  /** 오늘 찍은 건강 챌린지 id 목록 */
  healthToday: string[];
  /** 건강 챌린지를 찍거나 풀 때 — 이제 체크되어 있으면 true */
  toggleHealth: (id: string) => boolean;
  /** 오늘 확인한 미션 id 목록(복지·모임) */
  missionsToday: string[];
  /** 복지·생활정보 확인(welfare)·모임 공동 미션(group) 기록 — 새로 기록됐으면 true */
  recordMission: (id: "welfare" | "group") => boolean;
  /** 랭킹 참여 ON/OFF */
  rankingVisible: boolean;
  setRankingVisible: (on: boolean) => void;
  /** 서버에 저장된 기록을 이 기기 기록과 합친다(다른 기기에서 찍은 도장 포함) */
  syncFromServer: () => Promise<void>;
  saveProfile: (p: Omit<Profile, "id" | "createdAt"> & { id?: string }) => Profile;
  updateProfile: (patch: Partial<Profile>) => void;
  logout: () => void;
  toggleMed: (slot: "morning" | "evening") => void;
  completeQuiz: (input: CompleteInput) => void;
  /** 연습 모드(무한 연습 포함)에서 정답 하나를 맞힐 때마다 그날 기록에 1점을 더한다.
   *  하루 미션(daily.done)은 건드리지 않는다. */
  addPracticePoint: () => void;
  addFamilyEvent: (input: FamilyEventInput) => FamilyEvent | null;
  updateFamilyEvent: (id: string, patch: Partial<FamilyEventInput>) => void;
  removeFamilyEvent: (id: string) => void;
  setFontSize: (size: 18 | 21 | 24) => void;
  refresh: () => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(emptyState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loaded = read();
    const today = kstDate();
    const visits = loaded.visits.includes(today) ? loaded.visits : [...loaded.visits, today].slice(-60);
    const next = { ...loaded, visits, lastVisit: today };
    setState(next);
    write(next);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    // 시니어 기준 기본 본문 19px — ‘크게/아주 크게’는 22px·25px 로 같은 비율을 지킨다
    document.documentElement.style.setProperty("--app-font", `${state.fontSize + 1}px`);
    write(state);
  }, [state, ready]);

  // 서버(또는 Supabase)와 조용히 동기화 — 실패해도 화면은 그대로 동작
  // 퀴즈 완료·복약 체크 등 기록이 바뀔 때마다 1.2초 뒤 한 번씩 저장한다.
  useEffect(() => {
    if (!ready || !state.profile) return;
    const t = setTimeout(() => {
      void fetch("/api/state", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: makeCode(state.profile!.id),
          profile: state.profile,
          quizLogs: state.quizLogs.slice(-40),
          med: state.med,
          visits: state.visits.slice(-30),
          familyEvents: state.familyEvents,
          health: state.health,
          missions: state.missions,
          rankingVisible: state.rankingVisible,
          today: kstDate(),
        }),
      }).catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [
    ready,
    state.profile,
    state.quizLogs,
    state.med,
    state.visits,
    state.familyEvents,
    state.health,
    state.missions,
    state.rankingVisible,
  ]);

  // 앱을 열 때 서버에 남아 있는 기록(다른 기기에서 찍은 도장 포함)을 한 번 합쳐 온다.
  const syncedRef = useRef(false);
  const profileId = state.profile?.id ?? "";
  useEffect(() => {
    if (!ready || !profileId || syncedRef.current) return;
    syncedRef.current = true;
    void syncFromServer();
    // syncFromServer 는 profile 이 바뀔 때 새로 만들어지지만, 여기서는 한 번만 부른다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, profileId]);

  const saveProfile = useCallback((p: Omit<Profile, "id" | "createdAt"> & { id?: string }) => {
    const now = new Date();
    // 카카오 로그인이면 kakao_xxx 를 그대로 쓴다 — 다른 기기에서 다시 로그인해도 같은 사람으로 이어진다.
    const id = p.id || `u_${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    const profile: Profile = { ...p, id, createdAt: now.toISOString() };
    setState((s) => ({ ...s, profile }));
    return profile;
  }, []);

  const updateProfile = useCallback((patch: Partial<Profile>) => {
    setState((s) => (s.profile ? { ...s, profile: { ...s.profile, ...patch } } : s));
  }, []);

  const logout = useCallback(() => {
    setState((s) => ({ ...emptyState(), fontSize: s.fontSize }));
  }, []);

  const toggleMed = useCallback((slot: "morning" | "evening") => {
    const today = kstDate();
    setState((s) => {
      const cur = s.med[today] ?? { morning: false, evening: false };
      const med = { ...s.med, [today]: { ...cur, [slot]: !cur[slot] } };
      return { ...s, med };
    });
  }, []);

  const completeQuiz = useCallback((input: CompleteInput) => {
    const today = kstDate();
    setState((s) => {
      if (s.daily?.date === today && s.daily.done) return s;
      // 그날 연습 모드로 먼저 모은 점수가 있으면 그 위에 하루 미션 점수를 더한다.
      // 하루 기록은 날짜당 한 줄로 유지해 서버(quiz_logs · user_code+quiz_date)와도 어긋나지 않는다.
      const idx = s.quizLogs.findIndex((q) => q.date === today);
      const prev = idx >= 0 ? s.quizLogs[idx] : null;
      const log: QuizLog = {
        date: today,
        weekId: weekIdOf(today),
        correct: input.correct,
        total: input.total,
        points: (Number(prev?.points) || 0) + Math.max(0, Number(input.points) || 0),
        seconds: input.seconds,
        types: input.types,
        at: new Date().toISOString(),
        ...(prev?.practice ? { practice: prev.practice } : {}),
      };
      const daily: DailyQuiz = {
        date: today,
        answered: input.total,
        correct: input.correct,
        points: input.points,
        done: true,
        answeredIds: [],
      };
      return {
        ...s,
        quizLogs: prev
          ? s.quizLogs.map((q, i) => (i === idx ? log : q))
          : [...s.quizLogs, log].slice(-120),
        daily,
        visits: s.visits.includes(today) ? s.visits : [...s.visits, today].slice(-60),
      };
    });
  }, []);

  /** 연습 모드 정답 1개 = 1점 — 오늘 기록에 바로 더한다 */
  const addPracticePoint = useCallback(() => {
    const today = kstDate();
    setState((s) => {
      const idx = s.quizLogs.findIndex((q) => q.date === today);
      const prev = idx >= 0 ? s.quizLogs[idx] : null;
      const log: QuizLog = prev
        ? {
            ...prev,
            points: (Number(prev.points) || 0) + 1,
            practice: (Number(prev.practice) || 0) + 1,
          }
        : {
            date: today,
            weekId: weekIdOf(today),
            correct: 0,
            total: 0,
            points: 1,
            seconds: 0,
            types: [],
            at: new Date().toISOString(),
            practice: 1,
          };
      return {
        ...s,
        quizLogs: prev
          ? s.quizLogs.map((q, i) => (i === idx ? log : q))
          : [...s.quizLogs, log].slice(-120),
      };
    });
  }, []);

  const addFamilyEvent = useCallback((input: FamilyEventInput): FamilyEvent | null => {
    const title = input.title.trim();
    if (!title || !isValidDateKey(input.date)) return null;
    const ev: FamilyEvent = {
      id: newEventId(),
      title: title.slice(0, 30),
      date: input.date,
      repeatYearly: Boolean(input.repeatYearly),
      kind: input.kind,
      memo: input.memo?.trim().slice(0, 40) || undefined,
      alarm: normalizeAlarm(input.alarm),
      alarmTime: normalizeAlarmTime(input.alarmTime),
      calendarType: input.calendarType === "lunar" ? "lunar" : "solar",
      isLeapMonth: input.calendarType === "lunar" && input.isLeapMonth ? true : undefined,
      createdAt: new Date().toISOString(),
    };
    setState((s) => ({ ...s, familyEvents: [...s.familyEvents, ev] }));
    return ev;
  }, []);

  const updateFamilyEvent = useCallback((id: string, patch: Partial<FamilyEventInput>) => {
    setState((s) => ({
      ...s,
      familyEvents: s.familyEvents.map((ev) => {
        if (ev.id !== id) return ev;
        const next: FamilyEvent = { ...ev, ...patch, memo: patch.memo?.trim() || ev.memo };
        if (patch.title !== undefined) next.title = patch.title.trim().slice(0, 30) || ev.title;
        if (patch.date !== undefined && !isValidDateKey(patch.date)) next.date = ev.date;
        if (patch.alarm !== undefined) next.alarm = normalizeAlarm(patch.alarm);
        if (patch.alarmTime !== undefined) next.alarmTime = normalizeAlarmTime(patch.alarmTime);
        if (patch.calendarType !== undefined) {
          next.calendarType = patch.calendarType === "lunar" ? "lunar" : "solar";
          next.isLeapMonth = next.calendarType === "lunar" && patch.isLeapMonth ? true : undefined;
        } else if (patch.isLeapMonth !== undefined) {
          next.isLeapMonth = next.calendarType === "lunar" && patch.isLeapMonth ? true : undefined;
        }
        return next;
      }),
    }));
  }, []);

  const removeFamilyEvent = useCallback((id: string) => {
    setState((s) => ({ ...s, familyEvents: s.familyEvents.filter((ev) => ev.id !== id) }));
  }, []);

  /** 복지·생활정보 확인(welfare)·모임 공동 미션 참여(group) — 하루 한 번, 늘봄왕 점수에 들어간다 */
  const recordMission = useCallback((id: "welfare" | "group") => {
    const today = kstDate();
    const list = state.missions?.[today] ?? [];
    if (list.includes(id)) return false;
    setState((s) => {
      const cur = s.missions?.[today] ?? [];
      if (cur.includes(id)) return s;
      return { ...s, missions: { ...s.missions, [today]: [...cur, id] } };
    });
    return true;
  }, [state.missions]);

  const setRankingVisible = useCallback((on: boolean) => {
    setState((s) => ({ ...s, rankingVisible: Boolean(on) }));
  }, []);

  const toggleHealth = useCallback((id: string) => {
    if (!HEALTH_IDS.includes(id)) return false;
    const today = kstDate();
    const cur = healthOf(state.health, today);
    const on = !cur.includes(id);
    setState((s) => {
      const list = healthOf(s.health, today);
      const nextIds = on ? [...list, id] : list.filter((x) => x !== id);
      const health: HealthChecks = { ...s.health };
      if (nextIds.length) health[today] = nextIds;
      else delete health[today];
      return { ...s, health };
    });
    return on;
  }, [state.health]);

  /**
   * 서버(Supabase)에 남아 있는 기록을 이 기기와 합친다.
   * 다른 기기에서 찍은 건강 챌린지 도장·복약·퀴즈 기록이 새로고침·재로그인 뒤에도 이어진다.
   * 서버가 없거나 비어 있으면 이 기기 기록을 그대로 둔다.
   */
  const syncFromServer = useCallback(async () => {
    if (typeof window === "undefined") return;
    const profile = state.profile;
    if (!profile) return;
    try {
      const res = await fetch(`/api/state?code=${encodeURIComponent(makeCode(profile.id))}`, {
        headers: { accept: "application/json" },
      });
      if (!res.ok) return;
      const j = await res.json();
      const remote = j?.ok ? j.state : null;
      if (!remote) return;
      setState((s) => {
        const health = mergeHealth(s.health, remote.health);
        const med = { ...(remote.med ?? {}), ...s.med };
        const quizLogs = mergeQuizLogs(
          s.quizLogs,
          Array.isArray(remote.quizLogs) ? (remote.quizLogs as QuizLog[]) : []
        );
        const familyEvents =
          s.familyEvents.length === 0 && Array.isArray(remote.familyEvents) ? remote.familyEvents : s.familyEvents;
        // 다른 기기에서 카톡으로 로그인해 사진이 저장됐으면 내 프로필에도 붙여 준다.
        const remoteAvatar = typeof remote.profile?.avatarUrl === "string" ? remote.profile.avatarUrl : "";
        const profile =
          s.profile && remoteAvatar && !s.profile.avatarUrl
            ? { ...s.profile, avatarUrl: remoteAvatar, avatar: remoteAvatar }
            : s.profile;
        // 다른 기기에서 확인한 미션(복지·모임)도 합친다 — 오늘 점수가 기기마다 달라지지 않게
        const missions: Record<string, string[]> = { ...(s.missions ?? {}) };
        Object.entries(remote.missions ?? {}).forEach(([d, ids]) => {
          if (!Array.isArray(ids) || !ids.length) return;
          missions[d] = Array.from(new Set([...(missions[d] ?? []), ...ids]));
        });
        return {
          ...s,
          profile,
          health,
          med,
          missions,
          rankingVisible:
            typeof remote.rankingVisible === "boolean" ? remote.rankingVisible : s.rankingVisible,
          quizLogs,
          familyEvents,
        };
      });
    } catch {
      /* 서버를 못 봐도 이 기기 기록으로 그대로 동작 */
    }
  }, [state.profile]);

  const setFontSize = useCallback((size: 18 | 21 | 24) => {
    setState((s) => ({ ...s, fontSize: size }));
  }, []);

  const refresh = useCallback(() => setState(read()), []);

  const today = kstDate();
  const weekId = weekIdOf(today);
  const streak = useMemo(() => calcStreak(state, today), [state, today]);
  const weekPoints = useMemo(
    () => state.quizLogs.filter((q) => q.weekId === weekId).reduce((a, b) => a + b.points, 0),
    [state.quizLogs, weekId]
  );
  const todayDaily = state.daily && state.daily.date === today ? state.daily : null;
  const healthToday = healthOf(state.health, today);
  const missionsToday = state.missions?.[today] ?? [];
  const code = state.profile ? makeCode(state.profile.id) : "";

  const value: Ctx = {
    ready,
    state,
    profile: state.profile,
    streak,
    fontSize: state.fontSize,
    code,
    today,
    weekId,
    weekPoints,
    todayDaily,
    healthToday,
    missionsToday,
    recordMission,
    rankingVisible: state.rankingVisible !== false,
    setRankingVisible,
    toggleHealth,
    syncFromServer,
    saveProfile,
    updateProfile,
    logout,
    toggleMed,
    completeQuiz,
    addPracticePoint,
    addFamilyEvent,
    updateFamilyEvent,
    removeFamilyEvent,
    setFontSize,
    refresh,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export function medToday(state: AppState, today = kstDate()) {
  return state.med[today] ?? { morning: false, evening: false };
}
