/**
 * 가족안부달력 — 가족 일정 데이터 모델과 날짜 계산.
 *
 * 저장: AppState.familyEvents (localStorage) + /api/state (Supabase)
 * 날짜는 모두 `YYYY-MM-DD` (한국 시간 기준 달력 날짜)로 다룬다.
 */

export type FamilyEventKind = "birthday" | "anniversary" | "family" | "hospital";

export type FamilyEvent = {
  id: string;
  title: string;
  /** 첫 날짜. 매년 반복이면 이 날짜의 월·일을 해마다 쓴다. */
  date: string;
  repeatYearly: boolean;
  kind: FamilyEventKind;
  /** 메모 · 대상 (예: 큰딸, 손주) */
  memo?: string;
  createdAt: string;
};

export const EVENT_KINDS: {
  key: FamilyEventKind;
  label: string;
  emoji: string;
  /** 칸에 찍히는 점 색 */
  dot: string;
  chip: string;
}[] = [
  { key: "birthday", label: "생일", emoji: "🎂", dot: "bg-coral", chip: "bg-coral-light text-coral-dark" },
  { key: "anniversary", label: "기념일", emoji: "💐", dot: "bg-plum", chip: "bg-plum-light text-plum-dark" },
  { key: "family", label: "가족 일정", emoji: "👨‍👩‍👧", dot: "bg-brand", chip: "bg-brand-light text-brand-dark" },
  { key: "hospital", label: "병원·약속", emoji: "🏥", dot: "bg-leaf", chip: "bg-leaf-light text-leaf-dark" },
];

export function kindInfo(kind: FamilyEventKind) {
  return EVENT_KINDS.find((k) => k.key === kind) ?? EVENT_KINDS[2];
}

export function newEventId(): string {
  return `ev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/* ------------------------------------------------------------------ */
/* 날짜 계산                                                           */
/* ------------------------------------------------------------------ */

const DAY = 86400000;
const WEEK_SHORT = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");

export function isValidDateKey(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function toUTC(dateStr: string): number {
  return new Date(dateStr + "T00:00:00Z").getTime();
}

/** b - a (일). 같은 날이면 0 */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUTC(b) - toUTC(a)) / DAY);
}

export function weekdayOf(dateStr: string): number {
  return new Date(dateStr + "T00:00:00Z").getUTCDay();
}

export function weekdayShort(dateStr: string): string {
  return WEEK_SHORT[weekdayOf(dateStr)];
}

/** "11월 21일 (토)" */
export function dayTitle(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEK_SHORT[d.getUTCDay()]})`;
}

export type YearMonth = { year: number; month: number }; // month: 1~12

export function monthOf(dateStr: string): YearMonth {
  return { year: Number(dateStr.slice(0, 4)), month: Number(dateStr.slice(5, 7)) };
}

export function shiftMonth(ym: YearMonth, delta: number): YearMonth {
  const base = ym.year * 12 + (ym.month - 1) + delta;
  return { year: Math.floor(base / 12), month: (base % 12 + 12) % 12 + 1 };
}

export function monthTitle(ym: YearMonth): string {
  return `${ym.year}년 ${ym.month}월`;
}

export function dateKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** 그 달 달력 칸 (일요일 시작, 5~6주) — 달 앞뒤 빈 칸은 이전/다음 달 날짜로 채운다 */
export function monthMatrix(ym: YearMonth): { date: string; inMonth: boolean }[][] {
  const first = new Date(Date.UTC(ym.year, ym.month - 1, 1));
  const startOffset = first.getUTCDay(); // 0=일
  const start = new Date(first.getTime() - startOffset * DAY);
  const weeks: { date: string; inMonth: boolean }[][] = [];
  let cursor = start.getTime();
  for (let w = 0; w < 6; w++) {
    const row: { date: string; inMonth: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(cursor);
      const key = dt.toISOString().slice(0, 10);
      row.push({ date: key, inMonth: dt.getUTCMonth() + 1 === ym.month });
      cursor += DAY;
    }
    weeks.push(row);
  }
  // 아래쪽이 모두 다음 달인 줄은 달력에서 빼 빈 공간을 줄인다.
  while (weeks.length > 4 && !weeks[weeks.length - 1].some((c) => c.inMonth)) weeks.pop();
  return weeks;
}

/* ------------------------------------------------------------------ */
/* 반복(매년) 처리                                                     */
/* ------------------------------------------------------------------ */

/** 그 해에 이 일정이 놓이는 날짜 (반복이 아니면 원래 날짜가 그 해일 때만) */
export function occurrenceInYear(ev: FamilyEvent, year: number): string | null {
  const [sy, sm, sd] = ev.date.split("-").map(Number);
  if (!ev.repeatYearly) return sy === year ? ev.date : null;
  if (year < sy) return null;
  const lastDay = new Date(Date.UTC(year, sm, 0)).getUTCDate(); // 2월 29일 → 평년엔 말일
  return dateKey(year, sm, Math.min(sd, lastDay));
}

/** from(포함) 이후 가장 가까운 날짜. 없으면 null */
export function nextOccurrence(ev: FamilyEvent, from: string): string | null {
  const fromYear = Number(from.slice(0, 4));
  for (let y = fromYear; y <= fromYear + 2; y++) {
    const d = occurrenceInYear(ev, y);
    if (d && d >= from) return d;
  }
  // 반복이 아닌 지난 일정
  return null;
}

export function ddayOf(ev: FamilyEvent, from: string): number | null {
  const next = nextOccurrence(ev, from);
  return next ? daysBetween(from, next) : null;
}

export function ddayLabel(days: number): string {
  if (days === 0) return "오늘!";
  if (days === 1) return "내일";
  if (days > 0) return `D-${days}`;
  return `D+${Math.abs(days)}`;
}

export function occursOn(ev: FamilyEvent, date: string): boolean {
  const y = Number(date.slice(0, 4));
  return occurrenceInYear(ev, y) === date;
}

export function eventsOnDate(events: FamilyEvent[], date: string): FamilyEvent[] {
  return events.filter((ev) => occursOn(ev, date));
}

export type UpcomingEvent = { event: FamilyEvent; date: string; days: number };

/** from(오늘 포함)부터 withinDays 안에 오는 일정 — 가까운 순 */
export function upcomingEvents(
  events: FamilyEvent[],
  from: string,
  withinDays = 365,
  limit = 60
): UpcomingEvent[] {
  const out: UpcomingEvent[] = [];
  for (const ev of events) {
    const next = nextOccurrence(ev, from);
    if (!next) continue;
    const days = daysBetween(from, next);
    if (days > withinDays) continue;
    out.push({ event: ev, date: next, days });
  }
  out.sort((a, b) => (a.date === b.date ? a.event.title.localeCompare(b.event.title) : a.date < b.date ? -1 : 1));
  return out.slice(0, limit);
}

/** 달력 칸에 찍을 월 단위 일정 (그 달에 걸치는 반복 일정 포함) */
export function eventsInMonth(events: FamilyEvent[], ym: YearMonth): { event: FamilyEvent; date: string }[] {
  const out: { event: FamilyEvent; date: string }[] = [];
  for (const ev of events) {
    const d = occurrenceInYear(ev, ym.year);
    if (!d) continue;
    if (Number(d.slice(5, 7)) === ym.month) out.push({ event: ev, date: d });
  }
  return out;
}
