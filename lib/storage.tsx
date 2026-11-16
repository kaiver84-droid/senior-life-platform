"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AppState, DailyQuiz, Profile, QuizLog, QuizType } from "./types";
import type { FamilyEvent } from "./calendar";
import { isValidDateKey, newEventId } from "./calendar";
import { kstDate, weekIdOf } from "./week";

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
    // 예전에 저장된 기록에는 가족 일정이 없으므로 빈 목록으로 채운다.
    if (!Array.isArray(merged.familyEvents)) merged.familyEvents = [];
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

export function makeCode(seed?: string): string {
  const base = seed || Math.random().toString(36).slice(2);
  let h = 2166136261;
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const n = (h >>> 0).toString(36).toUpperCase();
  return n.slice(-6).padStart(6, "0");
}

/** 오늘 또는 어제까지 이어진 활동 일수를 센다 */
export function calcStreak(state: AppState, today: string = kstDate()): number {
  const days = new Set<string>();
  state.quizLogs.forEach((q) => days.add(q.date));
  Object.entries(state.med).forEach(([d, m]) => {
    if (m.morning || m.evening) days.add(d);
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
  saveProfile: (p: Omit<Profile, "id" | "createdAt"> & { id?: string }) => Profile;
  updateProfile: (patch: Partial<Profile>) => void;
  logout: () => void;
  toggleMed: (slot: "morning" | "evening") => void;
  completeQuiz: (input: CompleteInput) => void;
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
    document.documentElement.style.setProperty("--app-font", `${state.fontSize}px`);
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
          today: kstDate(),
        }),
      }).catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [ready, state.profile, state.quizLogs, state.med, state.visits, state.familyEvents]);

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
      const log: QuizLog = {
        date: today,
        weekId: weekIdOf(today),
        correct: input.correct,
        total: input.total,
        points: input.points,
        seconds: input.seconds,
        types: input.types,
        at: new Date().toISOString(),
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
        quizLogs: [...s.quizLogs, log].slice(-120),
        daily,
        visits: s.visits.includes(today) ? s.visits : [...s.visits, today].slice(-60),
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
        return next;
      }),
    }));
  }, []);

  const removeFamilyEvent = useCallback((id: string) => {
    setState((s) => ({ ...s, familyEvents: s.familyEvents.filter((ev) => ev.id !== id) }));
  }, []);

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
    saveProfile,
    updateProfile,
    logout,
    toggleMed,
    completeQuiz,
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
