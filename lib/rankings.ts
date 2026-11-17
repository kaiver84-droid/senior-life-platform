import type { GroupRankingResult, GroupRankingRow, RankingResult, RankingScope } from "./types";
import { periodLabel, weekIdOf } from "./week";

const SURNAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황", "안", "송", "전", "홍"];
const LAST = ["자", "순", "례", "옥", "분", "희", "영", "숙", "자", "순", "덕", "임", "남", "정", "미", "경"];

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type RankingInput = {
  scope: RankingScope;
  weekId?: string;
  sido?: string;
  sigungu?: string;
  birthYear?: number;
  myName?: string;
  myPoints?: number;
  myStreak?: number;
};

/**
 * 주차·지역별로 항상 같은 '이웃 순위'를 만든다.
 * 실제 참여자가 쌓이기 전까지 화면이 비어 보이지 않도록 하는 예시 데이터이며,
 * 응답의 `sample: true` 로 표시해 화면에서도 예시임을 알린다.
 */
export function buildRanking(input: RankingInput): RankingResult {
  const weekId = input.weekId || weekIdOf();
  const scope = input.scope;
  const seedBase =
    scope === "region"
      ? `${weekId}|${input.sido || ""}|${input.sigungu || ""}`
      : scope === "zodiac"
        ? `${weekId}|zodiac|${Math.floor((input.birthYear || 1955) / 12)}`
        : scope === "national"
          ? `${weekId}|national`
          : `${weekId}|streak`;

  const rnd = mulberry32(hashStr(seedBase));
  const count = scope === "national" ? 120 + Math.floor(rnd() * 30) : 46 + Math.floor(rnd() * 14); // 46 ~ 59명
  const used = new Set<string>();
  const rows: { name: string; points: number; streak: number; isMe: boolean }[] = [];

  for (let i = 0; i < count; i++) {
    let name = "";
    do {
      name = `${SURNAMES[Math.floor(rnd() * SURNAMES.length)]}○${LAST[Math.floor(rnd() * LAST.length)]}`;
    } while (used.has(name));
    used.add(name);

    const streak = 1 + Math.floor(rnd() * 7);
    const points =
      scope === "streak"
        ? 20 + Math.floor(rnd() * 60)
        : Math.floor(15 + rnd() * 95) + Math.floor(rnd() * 5) * 3;
    rows.push({ name, points, streak, isMe: false });
  }

  const me = {
    name: input.myName || "나",
    points: Math.max(0, Math.round(input.myPoints ?? 0)),
    streak: Math.max(0, Math.round(input.myStreak ?? 0)),
    isMe: true,
  };
  rows.push(me);

  rows.sort((a, b) => {
    if (scope === "streak") {
      if (b.streak !== a.streak) return b.streak - a.streak;
      return b.points - a.points;
    }
    if (b.points !== a.points) return b.points - a.points;
    return b.streak - a.streak;
  });

  const total = rows.length;
  const ranked = rows.map((r, i) => ({ ...r, rank: i + 1 }));
  const meRow = ranked.find((r) => r.isMe)!;

  return {
    weekId,
    scope,
    periodLabel: periodLabel(),
    rows: ranked.slice(0, 10),
    total,
    myRank: meRow.rank,
    myPercentile: Math.max(1, Math.round((meRow.rank / total) * 100)),
    sample: true,
  };
}

export function scopeLabel(scope: RankingScope, sido?: string, sigungu?: string): string {
  if (scope === "groups") return "단체별";
  if (scope === "group") return "우리 모임";
  if (scope === "national") return "전국";
  if (scope === "region") return `${sigungu || sido || "우리 동네"}`;
  if (scope === "zodiac") return "같은 띠·나이";
  return "개근상";
}

/* ------------------------------------------------------------------ */
/* 단체(모임)별 순위                                                   */
/* ------------------------------------------------------------------ */

/** 실제 모임 데이터가 부족할 때 순위표를 채우는 동네·가족 모임 예시 */
const GROUP_SAMPLES: { id: string; name: string; memberCount: number; base: number }[] = [
  { id: "GROUP-S1", name: "우리 가족 사랑방", memberCount: 10, base: 74 },
  { id: "GROUP-S2", name: "옥천 효도회", memberCount: 18, base: 71 },
  { id: "GROUP-S3", name: "청주 시니어 배움터", memberCount: 24, base: 68 },
  { id: "GROUP-S4", name: "서울 강남 실버합창단", memberCount: 15, base: 66 },
  { id: "GROUP-S5", name: "대전 둔산 경로당", memberCount: 12, base: 63 },
  { id: "GROUP-S6", name: "부산 해운대 친구들", memberCount: 9, base: 61 },
  { id: "GROUP-S7", name: "광주 빛고을 모임", memberCount: 7, base: 58 },
];

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
 * 모임 vs 모임 순위.
 * - 서버가 실제 모임 합산 점수를 주면(myGroups) 그것을 먼저 넣고, 빈자리는 예시 모임으로 채운다.
 * - 주차로만 값이 정해져 새로 고쳐도 같은 순위가 나온다.
 */
export function buildGroupRanking(input: {
  weekId?: string;
  myGroups?: MyGroupInput[];
  totalMembers?: number;
}): GroupRankingResult {
  const weekId = input.weekId || weekIdOf();
  const rnd = mulberry32(hashStr(`${weekId}|groups`));

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

  const used = new Set(rows.map((r) => r.name));
  GROUP_SAMPLES.forEach((s) => {
    if (used.has(s.name) || rows.length >= 10) return;
    const jitter = Math.floor(rnd() * 9) - 4; // -4 ~ +4
    const average = Math.max(30, s.base + jitter);
    const attendance = Math.max(45, Math.min(100, 58 + Math.floor(rnd() * 40)));
    rows.push({
      id: s.id,
      name: s.name,
      memberCount: s.memberCount,
      attendance,
      points: average * s.memberCount,
      average,
      isMine: false,
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
    sample: ranked.some((r) => !r.isMine) || !mine,
  };
}
