/**
 * 늘봄 랭킹 고도화 1차 — 7개 영역과 주간 종합 리그(늘봄왕) 점수 규칙.
 *
 * 화면(클라이언트)과 서버(집계 API)가 **같은 표**로 점수를 계산해
 * 하루 최대 점수(상한)와 활동별 점수가 어긋나지 않게 한다.
 */
import type { AppState } from "./types";
import { addDays, kstDate, weekIdOf, weekRange } from "./week";

/** 6개 영역 — 늘봄왕(종합)이 첫 번째(기본) 영역이고, 나머지 5개는 분야별 순위다. */
export type LeagueArea = "all" | "brain" | "health" | "attend" | "group" | "share" | "save";

/** 하루에 모을 수 있는 최대 점수 — 반복 조작·점수 독점 방지 */
export const LEAGUE_DAILY_CAP = 140;

/** 활동별 점수 */
export const LEAGUE_POINTS = {
  attend: 10,
  quiz: 30,
  health: 20,
  welfare: 10,
  group: 20,
  invite: 50,
} as const;

export type LeagueMissionId = "attend" | "quiz" | "health" | "welfare" | "group";

export type LeagueMission = {
  id: LeagueMissionId;
  /** 화면에 보여 줄 이름 */
  label: string;
  emoji: string;
  points: number;
  /** 하루 1회 · 앱을 열면 자동 같은 안내 */
  note: string;
  /** 이 미션으로 올라가는 영역 */
  area: LeagueArea;
  /** 랭킹 화면의 바로가기 버튼 이름 */
  action: string;
};

/** 오늘의 종합 미션 — 화면 체크리스트와 점수 계산이 이 표 하나를 함께 쓴다. */
export const LEAGUE_MISSIONS: LeagueMission[] = [
  {
    id: "attend",
    label: "매일 출석",
    emoji: "📅",
    points: LEAGUE_POINTS.attend,
    note: "하루 1번 · 앱을 열면 자동",
    area: "attend",
    action: "출석 체크하기",
  },
  {
    id: "quiz",
    label: "오늘의 퀴즈 완료",
    emoji: "🧠",
    points: LEAGUE_POINTS.quiz,
    note: "하루 1번 · 3문제",
    area: "brain",
    action: "오늘의 추가 퀴즈 풀기",
  },
  {
    id: "health",
    label: "건강 미션 1개 이상",
    emoji: "🏃",
    points: LEAGUE_POINTS.health,
    note: "하루 1번 · 건강 챌린지",
    area: "health",
    action: "건강 미션 하러 가기",
  },
  {
    id: "welfare",
    label: "복지·생활정보 확인",
    emoji: "💰",
    points: LEAGUE_POINTS.welfare,
    note: "하루 1번 · 혜택 자세히 보기",
    area: "save",
    action: "복지·혜택 보러 가기",
  },
  {
    id: "group",
    label: "모임 공동 미션 참여",
    emoji: "👥",
    points: LEAGUE_POINTS.group,
    note: "하루 1번 · 우리 모임 미션",
    area: "group",
    action: "우리 모임 미션 보기",
  },
];

export type LeagueAreaInfo = {
  key: LeagueArea;
  label: string;
  emoji: string;
  desc: string;
  /** 분야 카드처럼 좁은 자리에 쓰는 짧은 설명 */
  short?: string;
  /** 이 영역 순위표 아래 큰 버튼 이름 */
  action: string;
};

/** 6개 영역 탭 — 첫 칸(늘봄왕)이 기본·대표 랭킹이고, 건강왕은 화면에서 뺐다. */
export const LEAGUE_AREAS: LeagueAreaInfo[] = [
  {
    key: "all",
    label: "늘봄왕",
    short: "이번 주 활동 모두 합친 순위",
    emoji: "🌟",
    desc: "이번 주 활동을 모두 합친 종합 순위",
    action: "오늘의 종합 미션 보기",
  },
  {
    key: "brain",
    label: "퀴즈왕",
    short: "퀴즈 점수 · 정답률",
    emoji: "🧠",
    desc: "이번 주 퀴즈 점수와 정답률로 겨루는 순위",
    action: "오늘의 추가 퀴즈 풀기",
  },
  {
    key: "attend",
    label: "출석왕",
    short: "이번 주 출석 일수",
    emoji: "🔥",
    desc: "이번 주에 출석한 날이 많은 사람 순위",
    action: "출석 체크하기",
  },
  {
    key: "group",
    label: "모임왕",
    short: "모임 참여 순위",
    emoji: "👥",
    desc: "우리 모임과 단체별 참여 순위",
    action: "우리 모임 미션 보기",
  },
  {
    key: "share",
    label: "초대왕",
    short: "친구 초대 인원",
    emoji: "🎁",
    desc: "친구·가족을 많이 초대한 사람 순위",
    action: "친구 초대하기",
  },
  {
    key: "save",
    label: "지식왕",
    short: "생활정보 확인 수",
    emoji: "📚",
    desc: "복지·생활정보를 많이 확인한 사람 순위",
    action: "복지·혜택 보러 가기",
  },
];

export function areaInfo(area: LeagueArea): LeagueAreaInfo {
  return LEAGUE_AREAS.find((a) => a.key === area) ?? LEAGUE_AREAS[0];
}

export function isLeagueArea(v: string | null | undefined): v is LeagueArea {
  return LEAGUE_AREAS.some((a) => a.key === v);
}

/* ------------------------------------------------------------------ */
/* 하루 · 한 주 점수                                                   */
/* ------------------------------------------------------------------ */

export type DayActivity = {
  date: string;
  /** 앱을 열어 출석 도장을 찍었는지 */
  attend: boolean;
  /** 그날 퀴즈를 풀었는지(3문제 이상 또는 참여) */
  quiz: boolean;
  /** 건강 미션을 1개 이상 했는지 */
  health: boolean;
  /** 복지·생활정보를 확인했는지 */
  welfare: boolean;
  /** 모임 공동 미션에 참여했는지 */
  group: boolean;
  /** 그날 친구 초대에 성공한 사람 수 */
  invites: number;
};

export type DayScore = {
  /** 상한을 적용하기 전 점수 */
  raw: number;
  /** 상한(140점)을 적용한 점수 */
  total: number;
  /** 상한에 걸렸는지 */
  capped: boolean;
  parts: { id: LeagueMissionId | "invite"; points: number; done: boolean }[];
};

/** 하루 활동 → 늘봄왕 점수 (활동별 합계, 하루 최대 140점) */
export function dayLeagueScore(a: Partial<DayActivity>): DayScore {
  const invites = Math.max(0, Math.floor(Number(a.invites) || 0));
  const parts: DayScore["parts"] = [
    { id: "attend", points: LEAGUE_POINTS.attend, done: Boolean(a.attend) },
    { id: "quiz", points: LEAGUE_POINTS.quiz, done: Boolean(a.quiz) },
    { id: "health", points: LEAGUE_POINTS.health, done: Boolean(a.health) },
    { id: "welfare", points: LEAGUE_POINTS.welfare, done: Boolean(a.welfare) },
    { id: "group", points: LEAGUE_POINTS.group, done: Boolean(a.group) },
  ];
  const raw =
    parts.reduce((sum, p) => sum + (p.done ? p.points : 0), 0) + invites * LEAGUE_POINTS.invite;
  const total = Math.min(raw, LEAGUE_DAILY_CAP);
  return { raw, total, capped: raw > LEAGUE_DAILY_CAP, parts };
}

/** 이번 주 월요일 ~ 일요일 날짜 7개 */
export function weekDatesOf(reference: string = kstDate()): string[] {
  const { start } = weekRange(reference);
  return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(start, i));
}

/** 이 기기에 남은 기록으로 그날 활동을 되살린다 */
export function activityOfDay(
  state: Pick<AppState, "visits" | "quizLogs" | "daily" | "health"> & { missions?: Record<string, string[]> },
  date: string,
  invites = 0
): DayActivity {
  const today = date;
  const healthIds = state.health?.[today];
  const done = state.missions?.[today] ?? [];
  return {
    date: today,
    attend: Array.isArray(state.visits) && state.visits.includes(today),
    quiz:
      (Array.isArray(state.quizLogs) && state.quizLogs.some((q) => q.date === today)) ||
      Boolean(state.daily && state.daily.date === today && state.daily.done),
    health: Array.isArray(healthIds) && healthIds.length > 0,
    welfare: done.includes("welfare"),
    group: done.includes("group"),
    invites: Math.max(0, Math.floor(invites)),
  };
}

export type LeagueWeek = {
  days: DayActivity[];
  /** 날짜별 점수 (오늘 이후는 0) */
  scores: DayScore[];
  /** 이번 주 늘봄왕 점수 */
  total: number;
  today: DayScore;
  todayDate: string;
};

/** 이 기기 기록 + 서버가 알려 준 날짜별 초대 수로 이번 주 늘봄왕 점수를 계산 */
export function leagueWeek(
  state: Pick<AppState, "visits" | "quizLogs" | "daily" | "health"> & { missions?: Record<string, string[]> },
  opts: { today?: string; invitesByDay?: Record<string, number> } = {}
): LeagueWeek {
  const today = opts.today || kstDate();
  const dates = weekDatesOf(today);
  const days = dates.map((d) => activityOfDay(state, d, opts.invitesByDay?.[d] ?? 0));
  const scores = days.map((d) => dayLeagueScore(d.date > today ? {} : d));
  const total = days.reduce((sum, d, i) => (d.date > today ? sum : sum + scores[i].total), 0);
  const todayIndex = Math.max(0, dates.indexOf(today));
  return { days, scores, total, today: scores[todayIndex], todayDate: today };
}

/* ------------------------------------------------------------------ */
/* 영역별 값 표시                                                      */
/* ------------------------------------------------------------------ */

/** 순위표에 보여 줄 값 — 영역마다 단위가 다르다 */
export function formatAreaValue(area: LeagueArea, value: number): string {
  const n = Math.max(0, Math.round(value));
  switch (area) {
    case "health":
      return `${n}개 완료`;
    case "attend":
      return `${n}일 출석`;
    case "share":
      return `${n}명 초대`;
    case "save":
      return `${n}건 확인`;
    default:
      return `${n}점`;
  }
}

/** 이번 주 내 영역 값 (초대왕은 서버가 알려 주는 초대 수를 넘긴다) */
export function myAreaValue(
  area: LeagueArea,
  state: Pick<AppState, "visits" | "quizLogs" | "daily" | "health"> & { missions?: Record<string, string[]> },
  opts: { today?: string; invitesByDay?: Record<string, number>; invites?: number } = {}
): number {
  const today = opts.today || kstDate();
  const dates = weekDatesOf(today).filter((d) => d <= today);
  switch (area) {
    case "all":
      return leagueWeek(state, opts).total;
    case "brain":
      return (state.quizLogs ?? [])
        .filter((q) => q.weekId === weekIdOf(today))
        .reduce((sum, q) => sum + (Number(q.points) || 0), 0);
    case "health":
      return dates.reduce((sum, d) => sum + (state.health?.[d]?.length ?? 0), 0);
    case "attend":
      return dates.filter((d) => (state.visits ?? []).includes(d)).length;
    case "save":
      return dates.filter((d) => (state.missions?.[d] ?? []).includes("welfare")).length;
    case "share":
      return Math.max(0, Math.round(opts.invites ?? 0));
    default:
      return 0;
  }
}

/** 내 순위 안내 문구 — 1위 / 10위 안 / 10위 밖을 나눠 말한다 */
export function gapMessage(gap: {
  rank: number | null;
  aheadName?: string;
  aheadDiff?: number;
  top10Diff?: number;
  total?: number;
}): string {
  if (!gap.rank) return "아직 기록이 없어요. 오늘 미션 하나면 순위가 생겨요.";
  if (gap.rank === 1) return "현재 1위예요! 👑";
  if (gap.rank <= 10) {
    const diff = Math.max(0, Math.round(gap.aheadDiff ?? 0));
    return diff > 0
      ? `현재 ${gap.rank}위입니다 · 바로 위(${gap.rank - 1}위)와 ${diff}점 차이예요`
      : `현재 ${gap.rank}위입니다 · 바로 위(${gap.rank - 1}위)와 같은 점수예요`;
  }
  const need = Math.max(0, Math.round(gap.top10Diff ?? 0));
  return need > 0
    ? `현재 ${gap.rank}위 · 10위권까지 ${need}점 차이`
    : `현재 ${gap.rank}위 · 조금만 더 하면 10위권이에요`;
}

/**
 * 태어난 해 → 연령대(10대 이하 · 20대 … 70대 · 80대 이상).
 * 만 나이(올해 - 태어난 해)를 기준으로 하고, 해가 바뀌는 순간에도 화면과 서버가
 * 같은 연령대를 보도록 오늘 날짜는 한국 시간(KST)으로 읽는다.
 */
export function ageBandOf(birthYear: number | undefined | null): number {
  const year = Number(kstDate().slice(0, 4)) || new Date().getFullYear();
  const raw = Number(birthYear || 0);
  // 태어난 해를 모르면 1950년대생(70대) 기준으로 본다 — 예전 화면과 같은 자리에 서도록.
  const born = Number.isFinite(raw) && raw > 1900 ? raw : 1955;
  const age = Math.max(0, year - born);
  if (age < 20) return 10;
  if (age >= 80) return 80;
  return Math.floor(age / 10) * 10;
}

/** 전 연령 연령대 — 10대 이하부터 80대 이상까지 8개 */
export const AGE_BANDS = [10, 20, 30, 40, 50, 60, 70, 80];

export function ageBandLabel(band: number): string {
  if (band <= 10) return "10대 이하";
  if (band >= 80) return "80대 이상";
  return `${band}대`;
}
