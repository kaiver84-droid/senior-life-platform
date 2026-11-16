/**
 * 체험 모임('우리 가족 사랑방')의 예시 회원 활동.
 *
 * 서버(functions/api/groups.ts)와 오프라인 폴백(lib/group-local.ts)이 **같은 계산**을 쓰도록
 * 여기에 모아 둔다. 날짜·주차·회원코드로만 값이 정해지므로, 언제 열어도 오늘 출석 8명 ·
 * 이번 주 점수가 그대로 재현되고 주가 바뀌면 자연히 새 점수로 시작한다.
 */

export const DEMO_GROUP_ID = "FAM101";

export type DemoMember = { code: string; name: string };

export const DEMO_MEMBERS: DemoMember[] = [
  { code: "FAM1A1", name: "김영희" },
  { code: "FAM2B3", name: "박철수" },
  { code: "FAM3C5", name: "이정숙" },
  { code: "FAM4D7", name: "최민수" },
  { code: "FAM5E9", name: "정순자" },
  { code: "FAM6F2", name: "강옥분" },
  { code: "FAM7G4", name: "조말순" },
  { code: "FAM8H6", name: "윤정희" },
  { code: "FAM9J8", name: "장미숙" },
  { code: "FAMA0K", name: "임금자" },
];

function fnv(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 이번 주 퀴즈 점수 (62 ~ 95점) — 모임 1위가 90점대가 되도록 */
export function demoPoints(code: string, weekId: string): number {
  return 62 + (fnv(`${weekId}|p|${code}`) % 34);
}

/** 이번 주 참여 일수 (3 ~ 5일) — 주간 달성률이 80% 안팎이 되도록 */
export function demoWeekDays(code: string, weekId: string): number {
  return 3 + (fnv(`${weekId}|d|${code}`) % 3);
}

/** 오늘 출석한 회원인지 — 그날 해시가 큰 8명이 출석한다(정확히 8/10명) */
export function demoAttendedSet(date: string): Set<string> {
  const ranked = DEMO_MEMBERS.map((m) => ({ code: m.code, h: fnv(`${date}|a|${m.code}`) })).sort(
    (a, b) => b.h - a.h
  );
  return new Set(ranked.slice(0, 8).map((r) => r.code));
}

export function demoTattended(code: string, date: string): boolean {
  return demoAttendedSet(date).has(code);
}

/**
 * 체험 회원이 오늘 찍은 건강 챌린지 (0~5개).
 * 출석한 회원은 2~5개, 출석하지 않은 회원은 0~1개가 되도록 날짜·코드로만 정해진다.
 * 모임의 ‘오늘 건강 챌린지 참여 인원’이 매일 조금씩 달라 보이게 한다.
 */
export function demoHealthIds(code: string, date: string): string[] {
  const ids = ["water", "walk", "stretch", "medicine", "family"];
  const attended = demoAttendedSet(date).has(code);
  const h = fnv(`${date}|h|${code}`);
  const count = attended ? 2 + (h % 4) : h % 2;
  return ids.slice(0, Math.min(ids.length, count));
}

/** 체험 모임의 첫 게시글 (DB 가 비어 있을 때만 쓰인다) */
export function demoSeedPosts(): { code: string; name: string; content: string; hoursAgo: number }[] {
  return [
    { code: "FAM1A1", name: "김영희", content: "오늘 아침 날씨가 참 좋네요. 다들 퀴즈 풀고 좋은 하루 보내세요! 💐", hoursAgo: 3 },
    { code: "FAM2B3", name: "박철수", content: "어제 노래 문제가 어렵더라고요. 오늘은 꼭 맞혀 볼게요!", hoursAgo: 6 },
    { code: "FAM3C5", name: "이정숙", content: "손녀가 저녁에 놀러 온대요. 같이 퀴즈 풀어 보려고요 😊", hoursAgo: 24 },
  ];
}

/** 초대 코드에 쓰지 않는 글자(0/O, 1/I)를 뺀 6자리 코드 */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomGroupCode(seed?: string): string {
  let h = seed ? fnv(seed) : Math.floor(Math.random() * 4294967296);
  let out = "";
  for (let i = 0; i < 6; i++) {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    out += CODE_ALPHABET[h % CODE_ALPHABET.length];
  }
  return out;
}
