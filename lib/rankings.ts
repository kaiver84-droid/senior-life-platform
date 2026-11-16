import type { RankingResult, RankingScope } from "./types";
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
        : `${weekId}|streak`;

  const rnd = mulberry32(hashStr(seedBase));
  const count = 46 + Math.floor(rnd() * 14); // 46 ~ 59명
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
        : Math.floor(30 + rnd() * 150) + Math.floor(rnd() * 6) * 4;
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
  if (scope === "region") return `${sigungu || sido || "우리 동네"}`;
  if (scope === "zodiac") return "같은 띠·나이";
  return "개근상";
}
