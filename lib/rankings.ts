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
import { LEAGUE_DAILY_CAP, LEAGUE_POINTS, formatAreaValue, weekDatesOf } from "./league";
import { periodLabel, weekIdOf } from "./week";

const SURNAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황", "안", "송", "전", "홍"];
/** 어르신 세대(60대 이상) 이름 — 예전 그대로 */
const LAST = ["자", "순", "례", "옥", "분", "희", "영", "숙", "자", "순", "덕", "임", "남", "정", "미", "경"];
/** 40~50대 이름 */
const MID_LAST = ["지훈", "수진", "은지", "성훈", "미경", "상현", "혜영", "재민", "보라", "동욱", "선영", "태호"];
/** 10~30대 이름 */
const YOUNG_LAST = ["민준", "서연", "지우", "하준", "예린", "도윤", "수아", "지호", "유진", "민서", "현우", "채원"];

/** 연령대에 맞는 예시 참여자 이름 — 20대 순위표에 ‘김○자’ 같은 이름이 섞이지 않게 */
function givenNamesFor(opts: { range: RankingRange; band?: number }): string[] {
  const band = opts.band ?? 0;
  if (opts.range !== "age" || !band) return LAST;
  if (band <= 30) return YOUNG_LAST;
  if (band <= 50) return MID_LAST;
  return LAST;
}

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
  // 초대왕은 초대 건수로 겨루는 별도 순위표를 쓴다.
  if (scope === "invite") return buildInviteRanking({ weekId, myName: input.myName });
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
  if (scope === "invite") return "초대왕";
  if (scope === "region") return `${sigungu || sido || "우리 동네"}`;
  if (scope === "zodiac") return "같은 띠·나이";
  return "개근상";
}

/* ------------------------------------------------------------------ */
/* 초대왕 — 친구를 많이 초대한 사람 순위                                 */
/* ------------------------------------------------------------------ */

/** 실제 초대 기록이 적을 때 순위표를 채우는 예시 (이름·건수 모두 날짜로만 정해진다) */
const INVITER_SAMPLES: { name: string; invites: number }[] = [
  { name: "김영숙", invites: 9 },
  { name: "박정자", invites: 8 },
  { name: "이말순", invites: 7 },
  { name: "최순희", invites: 6 },
  { name: "정옥분", invites: 6 },
  { name: "강영자", invites: 5 },
  { name: "조정순", invites: 5 },
  { name: "윤미숙", invites: 4 },
  { name: "장덕임", invites: 4 },
  { name: "임경자", invites: 3 },
  { name: "한복순", invites: 3 },
  { name: "오금순", invites: 2 },
];

export type InviterInput = {
  /** 초대한 사람 이름 */
  name: string;
  /** 초대에 성공한 사람 수 */
  invites: number;
  avatarUrl?: string;
  isMe?: boolean;
};

/**
 * 초대왕 순위 — 초대 링크로 새로 가입한 사람이 많은 순서.
 * 실제 가입자(inviters)를 먼저 넣고, 빈자리는 예시 회원으로 채워 화면이 비어 보이지 않게 한다.
 */
export function buildInviteRanking(input: {
  weekId?: string;
  myName?: string;
  myInvites?: number;
  myAvatarUrl?: string;
  inviters?: InviterInput[];
}): RankingResult {
  const weekId = input.weekId || weekIdOf();
  const rnd = mulberry32(hashStr(`${weekId}|invite`));

  const rows: { name: string; invites: number; avatarUrl?: string; isMe: boolean }[] = [];
  const used = new Set<string>();

  (input.inviters || [])
    .filter((x) => x && x.name && Number.isFinite(x.invites) && x.invites > 0)
    .sort((a, b) => b.invites - a.invites)
    .forEach((x) => {
      if (used.has(x.name)) return;
      used.add(x.name);
      rows.push({ name: x.name, invites: Math.round(x.invites), avatarUrl: x.avatarUrl, isMe: Boolean(x.isMe) });
    });

  INVITER_SAMPLES.forEach((s) => {
    if (used.has(s.name) || rows.length >= 12) return;
    used.add(s.name);
    rows.push({
      name: s.name,
      invites: s.invites,
      isMe: false,
    });
  });

  // 나 — 실제 초대 성공 건수와 카톡 사진을 그대로 보여 준다.
  const myName = (input.myName || "나").trim() || "나";
  const existingMe = rows.find((r) => r.isMe);
  if (existingMe) {
    existingMe.name = myName;
    existingMe.invites = Math.max(existingMe.invites, Math.round(input.myInvites ?? existingMe.invites));
    existingMe.avatarUrl = input.myAvatarUrl || existingMe.avatarUrl;
  } else if (!used.has(myName)) {
    rows.push({
      name: myName,
      invites: Math.max(0, Math.round(input.myInvites ?? 0)),
      avatarUrl: input.myAvatarUrl,
      isMe: true,
    });
  }

  // 동점이면 이름 순으로 안정적으로 정렬(새로 고쳐도 순서가 흔들리지 않게)
  rows.sort((a, b) => b.invites - a.invites || a.name.localeCompare(b.name) || (rnd() - 0.5));

  const total = rows.length;
  const ranked = rows.map((r, i) => ({
    rank: i + 1,
    name: r.name,
    points: 0,
    streak: 0,
    invites: r.invites,
    avatarUrl: r.avatarUrl,
    isMe: r.isMe,
  }));
  const meRow = ranked.find((r) => r.isMe);

  return {
    weekId,
    scope: "invite",
    periodLabel: periodLabel(),
    rows: ranked.slice(0, 10),
    total,
    myRank: meRow ? meRow.rank : null,
    myPercentile: meRow ? Math.max(1, Math.round((meRow.rank / total) * 100)) : null,
    sample: true,
    myInvites: meRow?.invites ?? 0,
  };
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

/* ------------------------------------------------------------------ */
/* 7개 영역 순위표                                                     */
/*   늘봄왕(종합) · 기억왕 · 건강왕 · 출석왕 · 모임왕 · 나눔왕 · 알뜰왕 */
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
  /** 화면에서 채워 넣은 예시 참여자인지 */
  sample?: boolean;
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
 * - 실제 참여자(others·me)를 먼저 넣고, 모자란 자리는 주차·범위로만 정해지는 예시 참여자로 채운다.
 * - 순위 변동(▲/▼/신규)은 ‘어제까지의 점수’로 한 번 더 줄을 세워 비교한다(같은 자료라 새로 고쳐도 흔들리지 않는다).
 */
export function buildAreaRanking(input: AreaRankingInput): RankingResult {
  const limit = Math.max(1, input.limit ?? 10);
  const dates = weekDatesOf(input.today);
  const todayIndex = Math.max(0, Math.min(dates.length - 1, dates.indexOf(input.today)));

  const pool: RankParticipant[] = [];
  const seen = new Set<string>();
  const push = (p: RankParticipant) => {
    const key = (p.key || p.name || "").trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    pool.push(p);
  };
  (input.others || []).forEach(push);
  sampleParticipants({
    area: input.area,
    range: input.range,
    weekId: input.weekId,
    sido: input.sido,
    sigungu: input.sigungu,
    band: input.band,
    todayIndex,
    length: dates.length,
  }).forEach(push);
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
    sample: rows.some((r) => (pool.find((p) => p.name === r.name)?.sample ?? false)),
    area: input.area,
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

/** 예시 참여자 — 주차·범위(지역·연령대)로만 값이 정해져 새로 고쳐도 같은 순위가 나온다 */
function sampleParticipants(input: {
  area: LeagueArea;
  range: RankingRange;
  weekId: string;
  sido?: string;
  sigungu?: string;
  band?: number;
  todayIndex: number;
  length: number;
}): RankParticipant[] {
  const seedBase = `${input.weekId}|${input.area}|${input.range}|${input.sido || ""}|${input.sigungu || ""}|${
    input.band ?? ""
  }`;
  const head = mulberry32(hashStr(`${seedBase}|count`));
  const count = input.range === "national" ? 120 + Math.floor(head() * 30) : 46 + Math.floor(head() * 14);
  const used = new Set<string>();
  const out: RankParticipant[] = [];
  const givenNames = givenNamesFor({ range: input.range, band: input.band });

  for (let i = 0; i < count; i++) {
    const rnd = mulberry32(hashStr(`${seedBase}|${i}`));
    let name = "";
    do {
      name = `${SURNAMES[Math.floor(rnd() * SURNAMES.length)]}○${givenNames[Math.floor(rnd() * givenNames.length)]}`;
    } while (used.has(name));
    used.add(name);

    const loyalty = 0.15 + rnd() * 0.72;
    // 사람마다 ‘늘 하던 만큼’이 비슷하도록 기준값을 두고 날마다 조금씩만 흔든다
    // (날마다 크게 튀면 순위 변동 배지가 ▲14처럼 과장되어 보인다)
    const baseAll = 20 + loyalty * 60;
    const baseBrain = 20 + loyalty * 70;
    const daily: number[] = [];
    for (let d = 0; d < input.length; d++) {
      if (d > input.todayIndex) {
        daily.push(0);
        continue;
      }
      const engaged = rnd() < 0.72 + loyalty * 0.24;
      switch (input.area) {
        case "brain": {
          daily.push(engaged ? Math.round(baseBrain * (0.9 + rnd() * 0.2)) : 0);
          break;
        }
        case "health": {
          daily.push(engaged ? 1 + Math.floor(loyalty * 3) : 0);
          break;
        }
        case "attend": {
          daily.push(engaged ? 1 : 0);
          break;
        }
        case "save": {
          daily.push(rnd() < 0.3 + loyalty * 0.4 ? 1 : 0);
          break;
        }
        case "share": {
          daily.push(rnd() < 0.05 ? 1 : 0);
          break;
        }
        default: {
          if (!engaged) {
            daily.push(0);
            break;
          }
          let v = Math.round(baseAll * (0.92 + rnd() * 0.16));
          if (rnd() < 0.05) v += LEAGUE_POINTS.invite;
          daily.push(Math.min(LEAGUE_DAILY_CAP, v));
        }
      }
    }

    out.push({
      name,
      daily,
      sample: true,
      note: input.area === "brain" ? `정답률 ${50 + Math.floor(rnd() * 50)}%` : undefined,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 모임 대항전 — 모임 vs 모임 (이번 주 공동 목표)                        */
/* ------------------------------------------------------------------ */

/** 실제 모임이 적을 때 대항전 순위표를 채우는 예시 모임 (단체 순위와 같은 이름) */
const BATTLE_SAMPLES: { id: string; name: string; memberCount: number; perMember: number }[] = [
  { id: "BATTLE-S1", name: "우리 가족 사랑방", memberCount: 10, perMember: 82 },
  { id: "BATTLE-S2", name: "옥천 효도회", memberCount: 18, perMember: 76 },
  { id: "BATTLE-S3", name: "청주 시니어 배움터", memberCount: 24, perMember: 71 },
  { id: "BATTLE-S4", name: "서울 강남 실버합창단", memberCount: 15, perMember: 68 },
  { id: "BATTLE-S5", name: "대전 둔산 경로당", memberCount: 12, perMember: 63 },
  { id: "BATTLE-S6", name: "부산 해운대 친구들", memberCount: 9, perMember: 58 },
  { id: "BATTLE-S7", name: "광주 빛고을 모임", memberCount: 7, perMember: 52 },
];

export type GroupBattleInput = {
  weekId: string;
  /** 실제 모임 — 서버가 모임원 점수를 모두 더해 준 값 */
  groups?: { id: string; name: string; memberCount: number; score: number }[];
  /** 모임이 하나도 없을 때도 화면이 비지 않게 예시를 채울지 */
  fill?: boolean;
};

/**
 * 모임 대항전 순위 — 이번 주 모임 점수를 겨루고, 우리 모임의 공동 목표 진행률을 함께 준다.
 * 모임 점수는 모임원들의 이번 주 늘봄왕 점수 합계이고,
 * 목표는 ‘모임원 한 사람에 100점’(최소 100점)이라 인원이 다른 모임도 같은 기준으로 겨룬다.
 */
export function buildGroupBattle(input: GroupBattleInput): GroupBattleResult {
  const weekId = input.weekId;
  const rnd = mulberry32(hashStr(`${weekId}|battle`));
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

  if (input.fill !== false) {
    const used = new Set(rows.map((r) => r.name));
    BATTLE_SAMPLES.forEach((s) => {
      if (used.has(s.name) || rows.length >= 8) return;
      const jitter = Math.floor(rnd() * 11) - 5; // -5 ~ +5
      const perMember = Math.max(20, s.perMember + jitter);
      const score = perMember * s.memberCount;
      const goal = Math.max(100, s.memberCount * 100);
      rows.push({
        id: s.id,
        name: s.name,
        memberCount: s.memberCount,
        score,
        goal,
        rate: Math.max(0, Math.min(100, Math.round((score / goal) * 100))),
        isMine: false,
        sample: true,
      });
    });
  }

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
    sample: ranked.some((r) => r.sample),
  };
}
