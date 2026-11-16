/**
 * 건강생활 챌린지 — 매일 원터치로 찍는 완료 도장 5가지.
 *
 * - 체크인은 이 기기(localStorage `seniorLife.v1.health`)에 남고,
 *   같은 내용이 Supabase `health_checks` 에도 저장되어 다시 로그인해도 이어진다.
 * - 모임원들의 오늘 체크 수는 `/api/groups` 가 모아 모임 달성률에 함께 반영한다.
 */
import type { AppState, GroupHealthSummary, HealthChecks } from "./types";

export type HealthChallenge = {
  /** 저장 키 (영문 소문자) */
  id: string;
  emoji: string;
  title: string;
  /** 한 줄 설명 — 큰 글씨 화면의 보조 문구 */
  desc: string;
  /** 체크했을 때 격려 문구 */
  done: string;
};

export const HEALTH_CHALLENGES: HealthChallenge[] = [
  {
    id: "water",
    emoji: "💧",
    title: "물 마시기 5잔",
    desc: "목이 마르기 전에 한 잔씩",
    done: "물 한 잔, 몸이 좋아해요",
  },
  {
    id: "walk",
    emoji: "🚶",
    title: "15분 걷기",
    desc: "동네 한 바퀴, 천천히",
    done: "15분 걷기 완료! 다리가 가벼워요",
  },
  {
    id: "stretch",
    emoji: "🤸",
    title: "스트레칭",
    desc: "어깨·허리 5분 풀기",
    done: "어깨가 한결 편해졌어요",
  },
  {
    id: "medicine",
    emoji: "💊",
    title: "복약 챙기기",
    desc: "아침·저녁 약 잊지 않기",
    done: "약 챙기기 완료! 오늘도 안전해요",
  },
  {
    id: "family",
    emoji: "☎️",
    title: "가족에게 안부",
    desc: "짧은 전화 한 통",
    done: "안부 인사 한 통, 마음이 따뜻해져요",
  },
];

export const HEALTH_TOTAL = HEALTH_CHALLENGES.length;

export const HEALTH_IDS = HEALTH_CHALLENGES.map((c) => c.id);

export function challengeById(id: string): HealthChallenge | undefined {
  return HEALTH_CHALLENGES.find((c) => c.id === id);
}

/** 그날 체크한 챌린지 id 목록 (없으면 빈 배열) */
export function healthOf(health: HealthChecks | undefined, date: string): string[] {
  const list = health?.[date];
  if (!Array.isArray(list)) return [];
  const valid = list.filter((id) => HEALTH_IDS.includes(id));
  return Array.from(new Set(valid));
}

export function healthCount(health: HealthChecks | undefined, date: string): number {
  return healthOf(health, date).length;
}

/** 오늘(또는 그날) 달성률 % — 5개 중 몇 개 */
export function healthRate(health: HealthChecks | undefined, date: string): number {
  return Math.round((healthCount(health, date) / HEALTH_TOTAL) * 100);
}

/** 이번 주에 건강 챌린지를 한 날 수 (모임 참여 일수 계산용) */
export function healthDaysIn(health: HealthChecks | undefined, start: string, end: string): string[] {
  if (!health) return [];
  return Object.keys(health)
    .filter((d) => d >= start && d <= end && healthOf(health, d).length > 0)
    .sort();
}

/** 두 기기의 체크인을 합친다(날짜별 합집합) — 서버에서 받아올 때 사용 */
export function mergeHealth(a: HealthChecks | undefined, b: HealthChecks | undefined): HealthChecks {
  const out: HealthChecks = {};
  const dates = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  dates.forEach((d) => {
    const ids = Array.from(new Set([...(a?.[d] ?? []), ...(b?.[d] ?? [])])).filter((id) =>
      HEALTH_IDS.includes(id)
    );
    if (ids.length) out[d] = ids;
  });
  return out;
}

/**
 * 모임 상세에 넣을 오늘의 건강 챌린지 요약.
 * `doneBy` 는 모임원별로 오늘 체크한 id 목록(체험 모임원 포함).
 */
export function buildGroupHealth(
  doneBy: { code: string; ids: string[] }[],
  myCode: string
): GroupHealthSummary {
  const memberCount = doneBy.length;
  const joined = doneBy.filter((m) => m.ids.length > 0).length;
  const mine = doneBy.find((m) => m.code === myCode);
  return {
    total: HEALTH_TOTAL,
    memberCount,
    joined,
    rate: memberCount ? Math.round((joined / memberCount) * 100) : 0,
    myDone: mine ? mine.ids.length : 0,
    cells: HEALTH_CHALLENGES.map((c) => ({
      id: c.id,
      label: c.title,
      emoji: c.emoji,
      done: doneBy.filter((m) => m.ids.includes(c.id)).length,
    })),
  };
}

/** 기기 상태에서 바로 만드는 요약(서버에 못 붙었을 때 화면용) */
export function localGroupHealth(
  state: Pick<AppState, "health">,
  date: string,
  codes: string[],
  myCode: string
): GroupHealthSummary {
  const mine = healthOf(state.health, date);
  const doneBy = codes.map((code) => ({ code, ids: code === myCode ? mine : [] }));
  return buildGroupHealth(doneBy, myCode);
}
