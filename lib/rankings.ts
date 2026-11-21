import type {
  GroupBattleResult,
  GroupBattleRow,
  GroupRankingResult,
  GroupRankingRow,
  RankingChange,
  RankingRange,
  RankingResult,
  RankingRow,
  RankingScope,
} from "./types";
import type { LeagueArea } from "./league";
import { formatAreaValue, weekDatesOf } from "./league";
import { normalizeSido, sidoLabel } from "./regions";
import { periodLabel, weekIdOf } from "./week";

/**
 * 순위표는 **실제 가입자 기록만**으로 만든다.
 * (2026-11-22 사용자 지시 — 예시 참여자·예시 모임을 섞지 않는다)
 * 실제 참여자가 적으면 순위표가 짧게 나오는 것이 정상이며, 화면은 빈 상태 문구로 안내한다.
 */

export function scopeLabel(scope: RankingScope, sido?: string, sigungu?: string): string {
  if (scope === "groups") return "단체별";
  if (scope === "group") return "우리 모임";
  if (scope === "national") return "전국";
  if (scope === "invite") return "초대왕";
  // ‘지역별’ 범위는 시·군·구가 아니라 광역 시·도(충청북도·대전광역시 등) 기준이다.
  if (scope === "region") return sidoLabel(sido);
  if (scope === "zodiac") return "같은 띠·나이";
  return "개근상";
}

/* ------------------------------------------------------------------ */
/* 단체(모임)별 순위                                                   */
/* ------------------------------------------------------------------ */

export type MyGroupInput = {
  id?: string;
  name: string;
  memberCount: number;
  /** 이번 주 모임 합산 점수 */
  points: number;
  /** 오늘 출석한 모임원 수 */
  attendedToday: number;
};

/**
 * 모임 vs 모임 순위 — 서버가 준 실제 모임 합산 점수만 줄 세운다.
 * 모임이 하나뿐이면 그 모임이 1위, 하나도 없으면 빈 순위표가 된다.
 */
export function buildGroupRanking(input: {
  weekId?: string;
  myGroups?: MyGroupInput[];
  totalMembers?: number;
}): GroupRankingResult {
  const weekId = input.weekId || weekIdOf();

  const rows: Omit<GroupRankingRow, "rank">[] = [];

  (input.myGroups || []).forEach((g, i) => {
    const memberCount = Math.max(1, Math.round(g.memberCount));
    const points = Math.max(0, Math.round(g.points));
    rows.push({
      id: g.id || `MINE-${i}`,
      name: g.name,
      memberCount,
      attendance: Math.max(0, Math.min(100, Math.round((g.attendedToday / memberCount) * 100))),
      points,
      average: Math.round(points / memberCount),
      isMine: true,
    });
  });

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.average !== a.average) return b.average - a.average;
    return b.attendance - a.attendance;
  });

  const total = input.totalMembers && input.totalMembers > rows.length ? input.totalMembers : rows.length;
  const ranked = rows.map((r, i) => ({ ...r, rank: i + 1 }));
  const mine = ranked.find((r) => r.isMine) ?? null;

  return {
    weekId,
    scope: "groups",
    periodLabel: periodLabel(),
    rows: ranked,
    total,
    myRank: mine ? mine.rank : null,
    myPercentile: mine ? Math.max(1, Math.round((mine.rank / ranked.length) * 100)) : null,
    sample: false,
  };
}

/* ------------------------------------------------------------------ */
/* 7개 영역 순위표                                                     */
/*   늘봄왕(종합) · 퀴즈왕 · 출석왕 · 모임왕 · 초대왕 · 지식왕 */
/* ------------------------------------------------------------------ */

export type RankParticipant = {
  name: string;
  /** 사람을 가르는 값(사용자 코드) — 이름이 같은 사람이 있어도 서로 덮어쓰지 않게 */
  key?: string;
  avatarUrl?: string;
  isMe?: boolean;
  /** 누적 점수로 정한 등급 배지 — 순위표 이름 옆에 작게 보여 준다 */
  grade?: { key: string; label: string; emoji: string };
  /** 누적 점수(등급 계산용) */
  lifetime?: number;
  /** 월요일부터 날짜별 값(그 영역 기준 점수·개수) */
  daily: number[];
  /** 정답률 같은 덧붙임 */
  note?: string;
};

export type AreaRankingInput = {
  area: LeagueArea;
  range: RankingRange;
  weekId: string;
  today: string;
  sido?: string;
  sigungu?: string;
  band?: number;
  /** 실제 참여자(나 제외) */
  others?: RankParticipant[];
  /** 나 — 랭킹 참여를 꺼 두었으면 null */
  me?: RankParticipant | null;
  /** 공개 순위표에 보여 줄 최대 인원 (기본 10명) */
  limit?: number;
};

const sumOf = (arr: number[], upto = arr.length - 1) =>
  arr.reduce((s, v, i) => (i <= upto ? s + Math.max(0, Math.floor(Number(v) || 0)) : s), 0);

/**
 * 영역별 순위표를 만든다.
 * - 실제 참여자(others·me)만 줄 세운다 — 예시 참여자는 넣지 않는다.
 * - 순위 변동(▲/▼/신규)은 ‘어제까지의 점수’로 한 번 더 줄을 세워 비교한다(같은 자료라 새로 고쳐도 흔들리지 않는다).
 */
export function buildAreaRanking(input: AreaRankingInput): RankingResult {
  const limit = Math.max(1, input.limit ?? 10);
  const dates = weekDatesOf(input.today);
  const todayIndex = Math.max(0, Math.min(dates.length - 1, dates.indexOf(input.today)));
  const sido = normalizeSido(input.sido);

  const pool: RankParticipant[] = [];
  const seen = new Set<string>();
  const push = (p: RankParticipant) => {
    const key = (p.key || p.name || "").trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    pool.push(p);
  };
  (input.others || []).forEach(push);
  if (input.me) push(input.me);

  const total = (p: RankParticipant) => sumOf(p.daily);
  const asOf = (p: RankParticipant, k: number) => (k < 0 ? 0 : sumOf(p.daily, k));
  const byName = (a: RankParticipant, b: RankParticipant) => a.name.localeCompare(b.name);

  const nowSorted = [...pool].sort((a, b) => total(b) - total(a) || byName(a, b));
  // 어제까지의 점수로 같은 사람들을 한 번 더 줄 세운다(모두 같은 인원으로 비교해야 변동이 크게 흔들리지 않는다).
  const prevSorted =
    todayIndex > 0
      ? [...pool].sort((a, b) => asOf(b, todayIndex - 1) - asOf(a, todayIndex - 1) || byName(a, b))
      : [];
  const nowRank = new Map<RankParticipant, number>();
  nowSorted.forEach((p, i) => nowRank.set(p, i + 1));
  const prevRank = new Map<RankParticipant, number>();
  prevSorted.forEach((p, i) => prevRank.set(p, i + 1));

  const rows: RankingRow[] = nowSorted.slice(0, limit).map((p) => {
    const rank = nowRank.get(p)!;
    const prev = prevRank.get(p);
    // 어제 점수가 0이면 ‘신규’, 어제 순위가 있으면 그 차이, 비교할 자료가 없으면 변동 없음(0)
    const yesterday = asOf(p, todayIndex - 1);
    const change: RankingChange =
      todayIndex === 0 ? 0 : yesterday <= 0 ? null : prev === undefined ? 0 : prev - rank;
    const value = total(p);
    return {
      rank,
      name: p.name,
      points: value,
      streak: p.daily.filter((v) => v > 0).length,
      isMe: Boolean(p.isMe),
      avatarUrl: p.avatarUrl,
      display: formatAreaValue(input.area, value),
      change,
      note: p.note,
      grade: p.grade,
    };
  });

  const mine = input.me ?? null;
  const myRank = mine ? nowRank.get(mine) ?? null : null;
  const myValue = mine ? total(mine) : 0;

  let myGap: RankingResult["myGap"] = undefined;
  if (mine && myRank) {
    const ahead = myRank > 1 ? nowSorted[myRank - 2] : null;
    const top10 = myRank > limit ? nowSorted[limit - 1] : null;
    myGap = {
      rank: myRank,
      aheadName: ahead?.name,
      aheadDiff: ahead ? total(ahead) - myValue : 0,
      top10Diff: top10 ? total(top10) - myValue : 0,
      total: pool.length,
    };
  }

  const scope: RankingScope = input.range === "age" ? "zodiac" : input.range;

  return {
    weekId: input.weekId,
    scope,
    periodLabel: periodLabel(),
    rows,
    total: pool.length,
    myRank,
    myPercentile: myRank ? Math.max(1, Math.round((myRank / pool.length) * 100)) : null,
    sample: false,
    area: input.area,
    regionLabel: input.range === "region" ? sidoLabel(sido) : undefined,
    myGap,
    myDisplay: mine ? formatAreaValue(input.area, myValue) : undefined,
    myInvites: input.area === "share" ? myValue : undefined,
    myChange:
      mine && myRank
        ? todayIndex === 0 || sumOf(mine.daily, todayIndex - 1) <= 0
          ? null
          : (prevRank.get(mine) ?? myRank) - myRank
        : undefined,
    myNote: mine?.note,
  };
}

/* ------------------------------------------------------------------ */
/* 모임 대항전 — 모임 vs 모임 (이번 주 공동 목표)                        */
/* ------------------------------------------------------------------ */

export type GroupBattleInput = {
  weekId: string;
  /** 실제 모임 — 서버가 모임원 점수를 모두 더해 준 값 */
  groups?: { id: string; name: string; memberCount: number; score: number }[];
};

/**
 * 모임 대항전 순위 — 이번 주 실제 모임 점수를 겨루고, 우리 모임의 공동 목표 진행률을 함께 준다.
 * 모임 점수는 모임원들의 이번 주 늘봄왕 점수 합계이고,
 * 목표는 ‘모임원 한 사람에 100점’(최소 100점)이라 인원이 다른 모임도 같은 기준으로 겨룬다.
 * 예시 모임으로 빈자리를 채우지 않는다.
 */
export function buildGroupBattle(input: GroupBattleInput): GroupBattleResult {
  const weekId = input.weekId;
  const rows: Omit<GroupBattleRow, "rank">[] = [];

  (input.groups || []).forEach((g) => {
    const memberCount = Math.max(1, Math.round(g.memberCount));
    const score = Math.max(0, Math.round(g.score));
    const goal = Math.max(100, memberCount * 100);
    rows.push({
      id: g.id,
      name: g.name,
      memberCount,
      score,
      goal,
      rate: Math.max(0, Math.min(100, Math.round((score / goal) * 100))),
      isMine: true,
      sample: false,
    });
  });

  rows.sort((a, b) => b.score - a.score || b.rate - a.rate || a.name.localeCompare(b.name));
  const ranked = rows.map((r, i) => ({ ...r, rank: i + 1 }));
  const mine = ranked.find((r) => r.isMine) ?? null;
  const first = ranked[0];
  const gapToFirst = mine && first ? Math.max(0, first.score - mine.score) : 0;

  let message = "모임에 들어가면 우리 모임도 대항전에 나가요";
  if (mine && first) {
    message =
      mine.rank === 1
        ? "우리 모임이 이번 주 1등이에요! 이 자리를 함께 지켜요 👏"
        : `우리 모임이 1등까지 ${gapToFirst}점 남았어요! 오늘 퀴즈로 힘 보태기`;
  }

  return {
    weekId,
    periodLabel: periodLabel(),
    rows: ranked,
    myGroup: mine,
    total: ranked.length,
    gapToFirst,
    message,
    sample: false,
  };
}
