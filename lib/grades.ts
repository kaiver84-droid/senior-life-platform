/**
 * 늘봄 랭킹 고도화 2차 — 등급(누적 점수)과 활동 배지.
 *
 * 화면(클라이언트)과 서버(/api/rankings?scope=profile)가 **같은 표**를 써서
 * 등급 경계·배지 조건이 서로 어긋나지 않게 한다.
 */

export type GradeKey = "sprout" | "sun" | "happy" | "gold" | "honor";

export type Grade = {
  key: GradeKey;
  /** 1 ~ 5 (높을수록 높은 등급) */
  level: number;
  label: string;
  emoji: string;
  /** 이 등급이 시작되는 누적 점수 */
  min: number;
  /** 이 등급의 끝(다음 등급 시작 - 1). 가장 높은 등급은 null */
  max: number | null;
  /** 화면 색 — 배지 배경 */
  tone: string;
  /** 화면 색 — 글자 */
  ink: string;
};

/** 누적 점수 기반 5단계 등급 (IMG_4877 기준) */
export const GRADES: Grade[] = [
  { key: "sprout", level: 1, label: "새싹", emoji: "🌱", min: 0, max: 499, tone: "bg-leaf-light", ink: "text-leaf-dark" },
  { key: "sun", level: 2, label: "햇살", emoji: "☀️", min: 500, max: 1499, tone: "bg-sun-light", ink: "text-[#9A6A05]" },
  { key: "happy", level: 3, label: "행복", emoji: "🌸", min: 1500, max: 2999, tone: "bg-coral-light", ink: "text-coral-dark" },
  { key: "gold", level: 4, label: "금빛", emoji: "👑", min: 3000, max: 5999, tone: "bg-gold-light", ink: "text-[#8A6100]" },
  { key: "honor", level: 5, label: "늘봄 명예회원", emoji: "🏆", min: 6000, max: null, tone: "bg-plum-light", ink: "text-plum-dark" },
];

export type GradeView = {
  grade: Grade;
  /** 다음 등급 (가장 높은 등급이면 null) */
  next: Grade | null;
  /** 다음 등급까지 남은 점수 (가장 높은 등급이면 0) */
  remaining: number;
  /** 이번 등급 안에서 다음 등급까지의 진행률(%) */
  percent: number;
  /** 지금 등급의 누적 점수 시작값 */
  from: number;
};

/** 누적 점수 → 등급 · 다음 등급까지 남은 점수 */
export function gradeOf(points: number): GradeView {
  const total = Math.max(0, Math.round(Number(points) || 0));
  let idx = 0;
  for (let i = GRADES.length - 1; i >= 0; i--) {
    if (total >= GRADES[i].min) {
      idx = i;
      break;
    }
  }
  const grade = GRADES[idx];
  const next = GRADES[idx + 1] ?? null;
  const span = next ? next.min - grade.min : 1;
  const percent = next ? Math.max(0, Math.min(100, Math.round(((total - grade.min) / span) * 100))) : 100;
  return {
    grade,
    next,
    remaining: next ? Math.max(0, next.min - total) : 0,
    percent,
    from: grade.min,
  };
}

/** 순위표 한 줄에 붙는 작은 등급 표시 */
export type GradeChip = { key: GradeKey; label: string; emoji: string };

export function gradeChipOf(points: number | null | undefined): GradeChip | undefined {
  if (points === null || points === undefined || !Number.isFinite(Number(points))) return undefined;
  const { grade } = gradeOf(Number(points));
  return { key: grade.key, label: grade.label, emoji: grade.emoji };
}

/* ------------------------------------------------------------------ */
/* 활동 배지 컬렉션                                                    */
/* ------------------------------------------------------------------ */

/** 등급·배지 계산에 쓰는 누적 기록 — 서버(v_user_lifetime)와 기기 기록이 같은 모양을 쓴다 */
export type LifetimeStats = {
  /** 누적 점수 (늘봄왕 규칙·하루 140점 상한) */
  lifetimePoints: number;
  /** 누적 출석 일수 */
  attendDays: number;
  /** 지금 이어진 연속 출석 일수 */
  streak: number;
  /** 누적 퀴즈 정답 수 */
  quizCorrect: number;
  /** 누적 퀴즈 참여 일수 */
  quizDays: number;
  /** 건강 미션 완료 일수 */
  healthDays: number;
  /** 복지·생활정보 확인 일수 */
  welfareDays: number;
  /** 이번 주 모임 공동 미션 참여 일수 */
  groupDays: number;
  /** 친구 초대 성공 인원 */
  inviteCount: number;
  /** 나와 함께하는 모임원 수(나 제외) */
  groupMates: number;
  /** 들어가 있는 모임 수 */
  groupCount: number;
};

export function emptyStats(): LifetimeStats {
  return {
    lifetimePoints: 0,
    attendDays: 0,
    streak: 0,
    quizCorrect: 0,
    quizDays: 0,
    healthDays: 0,
    welfareDays: 0,
    groupDays: 0,
    inviteCount: 0,
    groupMates: 0,
    groupCount: 0,
  };
}

export type BadgeId = "attend7" | "attend30" | "brain" | "health" | "invite" | "family";

export type BadgeDef = {
  id: BadgeId;
  label: string;
  emoji: string;
  /** 무엇을 하면 받는지 — 획득하지 못한 배지에 그대로 보여 준다 */
  how: string;
  /** 목표 값 */
  goal: number;
  /** 목표의 단위 — ‘일’ · ‘문제’ · ‘명’ */
  unit: string;
  /** 지금까지 쌓인 값 */
  value: (s: LifetimeStats) => number;
};

/** 활동 배지 6종 — 획득·미획득을 한 화면(컬렉션)에 모아 보여 준다 */
export const BADGES: BadgeDef[] = [
  {
    id: "attend7",
    label: "7일 연속 출석왕",
    emoji: "🔥",
    how: "7일 내리 출석하면 받아요",
    goal: 7,
    unit: "일",
    value: (s) => s.streak,
  },
  {
    id: "attend30",
    label: "30일 개근왕",
    emoji: "📅",
    how: "모두 30일 출석하면 받아요",
    goal: 30,
    unit: "일",
    value: (s) => s.attendDays,
  },
  {
    id: "brain",
    label: "기억 박사",
    emoji: "🧠",
    how: "퀴즈 정답 50문제를 모으면 받아요",
    goal: 50,
    unit: "문제",
    value: (s) => s.quizCorrect,
  },
  {
    id: "health",
    label: "건강 미션왕",
    emoji: "🏃",
    how: "건강 미션 30일을 채우면 받아요",
    goal: 30,
    unit: "일",
    value: (s) => s.healthDays,
  },
  {
    id: "invite",
    label: "친구 초대왕",
    emoji: "🎁",
    how: "친구 3명을 초대하면 받아요",
    goal: 3,
    unit: "명",
    value: (s) => s.inviteCount,
  },
  {
    id: "family",
    label: "가족 참여왕",
    emoji: "👥",
    how: "모임에 가족·친구 3명이 함께하면 받아요",
    goal: 3,
    unit: "명",
    value: (s) => s.groupMates + (s.groupMates > 0 ? 1 : 0),
  },
];

export type BadgeCard = {
  id: BadgeId;
  label: string;
  emoji: string;
  how: string;
  goal: number;
  unit: string;
  value: number;
  earned: boolean;
  /** 목표까지 몇 남았는지(획득했으면 0) */
  left: number;
  /** 진행률(%) */
  percent: number;
};

/** 배지 컬렉션 — 획득/미획득과 ‘몇 개 남았는지’까지 */
export function badgeCards(stats: LifetimeStats): BadgeCard[] {
  return BADGES.map((b) => {
    const raw = Math.max(0, Math.round(Number(b.value(stats)) || 0));
    const value = Math.min(raw, b.goal);
    const earned = raw >= b.goal;
    return {
      id: b.id,
      label: b.label,
      emoji: b.emoji,
      how: b.how,
      goal: b.goal,
      unit: b.unit,
      value,
      earned,
      left: Math.max(0, b.goal - raw),
      percent: Math.max(0, Math.min(100, Math.round((value / b.goal) * 100))),
    };
  });
}

/** 등급 안내 한 줄 — ‘다음 등급까지 320점’ */
export function nextGradeMessage(view: GradeView): string {
  if (!view.next) return "가장 높은 등급이에요. 늘봄 명예회원을 지켜 주세요!";
  return `${view.next.emoji} ${view.next.label} 등급까지 ${view.remaining}점 남았어요`;
}

/** 배지 달성 안내 한 줄 */
export function badgeProgressText(card: BadgeCard): string {
  if (card.earned) return "획득했어요";
  return `${card.left}${card.unit} 더 하면 받아요`;
}

/* ------------------------------------------------------------------ */
/* 이 기기 기록으로 만든 누적 통계 (서버를 못 볼 때의 대체값)            */
/* ------------------------------------------------------------------ */

import type { AppState, QuizLog } from "./types";
import { dayLeagueScore } from "./league";

/**
 * 이 기기에 남은 기록으로 누적 점수·배지 값을 되살린다.
 * 서버(v_user_lifetime)를 볼 수 없을 때도 등급 카드·배지 컬렉션이 비지 않게 하는 용도이며,
 * 기록이 길게 남지 않는 기기 특성상 서버 값이 있으면 서버 값을 먼저 쓴다.
 */
export function localLifetime(
  state: Pick<AppState, "visits" | "quizLogs" | "health" | "missions">,
  opts: {
    today: string;
    streak: number;
    invitesByDay?: Record<string, number>;
    inviteCount?: number;
    groupMates?: number;
    groupCount?: number;
  }
): LifetimeStats {
  const visits = Array.isArray(state.visits) ? state.visits : [];
  const quizLogs: QuizLog[] = Array.isArray(state.quizLogs) ? state.quizLogs : [];
  const health = state.health ?? {};
  const missions = state.missions ?? {};

  const dates = new Set<string>();
  visits.forEach((d) => dates.add(d));
  quizLogs.forEach((q) => q.date && dates.add(q.date));
  Object.keys(health).forEach((d) => dates.add(d));
  Object.keys(missions).forEach((d) => dates.add(d));

  let points = 0;
  dates.forEach((d) => {
    if (d > opts.today) return;
    points += dayLeagueScore({
      attend: visits.includes(d),
      quiz: quizLogs.some((q) => q.date === d) || (d === opts.today && Boolean(state.quizLogs?.some((q) => q.date === d))),
      health: (health[d] ?? []).length > 0,
      welfare: (missions[d] ?? []).includes("welfare"),
      group: (missions[d] ?? []).includes("group"),
      invites: Math.max(0, Math.round(opts.invitesByDay?.[d] ?? 0)),
    }).total;
  });

  return {
    lifetimePoints: points,
    attendDays: new Set(visits).size,
    streak: Math.max(0, Math.round(opts.streak || 0)),
    quizCorrect: quizLogs.reduce((s, q) => s + Math.max(0, Number(q.correct) || 0), 0),
    quizDays: new Set(quizLogs.map((q) => q.date)).size,
    healthDays: Object.values(health).filter((ids) => Array.isArray(ids) && ids.length > 0).length,
    welfareDays: Object.values(missions).filter((ids) => Array.isArray(ids) && ids.includes("welfare")).length,
    groupDays: Object.values(missions).filter((ids) => Array.isArray(ids) && ids.includes("group")).length,
    inviteCount: Math.max(0, Math.round(opts.inviteCount ?? 0)),
    groupMates: Math.max(0, Math.round(opts.groupMates ?? 0)),
    groupCount: Math.max(0, Math.round(opts.groupCount ?? 0)),
  };
}
