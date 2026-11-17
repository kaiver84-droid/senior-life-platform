/**
 * 가족안부달력 — 가족 일정 데이터 모델과 날짜 계산.
 *
 * 저장: AppState.familyEvents (localStorage) + /api/state (Supabase)
 * 날짜는 모두 `YYYY-MM-DD` (한국 시간 기준 달력 날짜)로 다룬다.
 *
 * 음력 일정(calendarType === "lunar")만 예외다. 저장된 `date` 의 해·월·일을 **음력 연·월·일**로 읽고,
 * 화면에 보이는 날짜(달력 칸·다가오는 일정·알람)는 모두 그 해의 실제 양력 날짜로 바꿔 쓴다.
 * 예전에 저장한 일정(calendarType 없음)은 모두 양력이므로 그대로 동작한다.
 */

import { lunarText, lunarToSolar } from "./lunar";

export type FamilyEventKind = "birthday" | "anniversary" | "family" | "hospital";

/** 그 일정의 날짜를 어떤 달력으로 적었는지 — 없으면 양력 */
export type FamilyCalendarType = "solar" | "lunar";

/* ------------------------------------------------------------------ */
/* 알람 — 언제 미리 알려 줄지                                              */
/* ------------------------------------------------------------------ */

/** 알람 시점 — none(끄기) · 0(당일) · 1(1일 전) · 3(3일 전) */
export type FamilyEventAlarm = "none" | "0" | "1" | "3";

export const ALARM_MODES: { key: FamilyEventAlarm; label: string; offset: number }[] = [
  { key: "0", label: "당일", offset: 0 },
  { key: "1", label: "1일 전", offset: 1 },
  { key: "3", label: "3일 전", offset: 3 },
  { key: "none", label: "알람 없음", offset: -1 },
];

/** 알람 시각 — 시니어가 고르기 쉬운 세 가지 */
export const ALARM_TIMES: { value: string; label: string }[] = [
  { value: "09:00", label: "오전 9시" },
  { value: "12:00", label: "낮 12시" },
  { value: "18:00", label: "오후 6시" },
];

/** 알람을 정하지 않은 예전 일정은 ‘당일 오전 9시’로 본다 */
export const DEFAULT_ALARM: FamilyEventAlarm = "0";
export const DEFAULT_ALARM_TIME = "09:00";

export type FamilyEvent = {
  id: string;
  title: string;
  /** 첫 날짜. 매년 반복이면 이 날짜의 월·일을 해마다 쓴다. */
  date: string;
  repeatYearly: boolean;
  kind: FamilyEventKind;
  /** 메모 · 대상 (예: 큰딸, 손주) */
  memo?: string;
  /** 알람 시점 — 없으면(예전에 저장한 일정) 기본값 */
  alarm?: FamilyEventAlarm;
  /** 알람 시각 HH:MM — 없으면 기본값 */
  alarmTime?: string;
  /** 양력/음력 — 없으면(예전에 저장한 일정) 양력 */
  calendarType?: FamilyCalendarType;
  /** 음력 일정이 윤달인지 — 없으면 평달 */
  isLeapMonth?: boolean;
  createdAt: string;
};

/** 이 일정이 음력으로 적힌 일정인지 */
export function isLunarEvent(ev: FamilyEvent): boolean {
  return ev.calendarType === "lunar";
}

/** 음력 일정의 음력 월·일 (양력 일정이면 null) */
export function lunarPartsOf(ev: FamilyEvent): { year: number; month: number; day: number; leap: boolean } | null {
  if (!isLunarEvent(ev)) return null;
  const [y, m, d] = ev.date.split("-").map(Number);
  return { year: y, month: m, day: d, leap: Boolean(ev.isLeapMonth) };
}

/** “음력 10월 15일” — 음력 일정이 아니면 빈 글자 */
export function lunarTitleOf(ev: FamilyEvent): string {
  const l = lunarPartsOf(ev);
  return l ? lunarText(l) : "";
}

/**
 * 음력 일정이 그 양력 연도에 놓이는 날 — 12월 일정은 이듬해 1·2월에 온다.
 * 반복하지 않는 일정은 처음 정한 음력 해의 날짜 하나만 쓴다.
 */
function lunarOccurrenceInSolarYear(ev: FamilyEvent, solarYear: number): string | null {
  const [sy, sm, sd] = ev.date.split("-").map(Number);
  if (!Number.isFinite(sy) || !sm || !sd) return null;
  const leap = Boolean(ev.isLeapMonth);
  const lunarYears = ev.repeatYearly ? [solarYear - 1, solarYear] : [sy];
  for (const ly of lunarYears) {
    if (ev.repeatYearly && ly < sy) continue; // 반복은 처음 정한 해부터
    const solar = lunarToSolar(ly, sm, sd, leap);
    if (solar && Number(solar.slice(0, 4)) === solarYear) return solar;
  }
  return null;
}

/** 일정 카드·목록에 함께 보여 줄 음력·양력 날짜 (음력 일정이면 ‘음력 10월 15일 (양력 11월 23일)’) */
export function lunarBadgeText(ev: FamilyEvent, occurrence: string): string {
  const l = lunarPartsOf(ev);
  if (!l) return "";
  return `${lunarText(l)} (양력 ${dayTitle(occurrence)})`;
}

export function normalizeAlarm(value: unknown): FamilyEventAlarm {
  return value === "none" || value === "0" || value === "1" || value === "3" ? value : DEFAULT_ALARM;
}

export function normalizeAlarmTime(value: unknown): string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : DEFAULT_ALARM_TIME;
}

export function alarmModeOf(ev: FamilyEvent): FamilyEventAlarm {
  return normalizeAlarm(ev.alarm);
}

export function alarmTimeOf(ev: FamilyEvent): string {
  return normalizeAlarmTime(ev.alarmTime);
}

/** "09:00" → "오전 9시" */
export function alarmTimeLabel(value: string): string {
  const [h, m] = normalizeAlarmTime(value).split(":").map(Number);
  const period = h < 12 ? "오전" : "오후";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${period} ${hour}시` : `${period} ${hour}시 ${m}분`;
}

/** "당일 오전 9시" · 알람이 없으면 빈 글자 */
export function alarmLabel(ev: FamilyEvent): string {
  const mode = alarmModeOf(ev);
  if (mode === "none") return "";
  const label = ALARM_MODES.find((m) => m.key === mode)?.label ?? "당일";
  return `${label} ${alarmTimeLabel(alarmTimeOf(ev))}`;
}

/** 알람이 울리는 날 — 일정 날짜에서 며칠 앞. 알람이 없으면 null */
export function alarmDayOf(occurrence: string, ev: FamilyEvent): string | null {
  const mode = alarmModeOf(ev);
  if (mode === "none") return null;
  const offset = Number(mode);
  return new Date(toUTC(occurrence) - offset * DAY).toISOString().slice(0, 10);
}

export type DueAlarm = {
  event: FamilyEvent;
  /** 일정이 실제로 있는 날 */
  occurrence: string;
  /** 알람이 울리는 날 (= 오늘) */
  alarmDate: string;
  /** 알람 시각 HH:MM */
  time: string;
  /** 일정까지 남은 날 */
  daysLeft: number;
};

/**
 * 오늘 울릴 알람 — 오늘이 알람일이고, 지금 시각이 알람 시각을 지난 일정만.
 * 앱을 닫아 두었어도 다시 열면 그날 안에는 이 목록으로 안내한다.
 */
export function dueAlarms(events: FamilyEvent[], today: string, nowMinutes: number): DueAlarm[] {
  const out: DueAlarm[] = [];
  for (const ev of events) {
    const mode = alarmModeOf(ev);
    if (mode === "none") continue;
    const offset = Number(mode);
    const occurrence = new Date(toUTC(today) + offset * DAY).toISOString().slice(0, 10);
    if (!occursOn(ev, occurrence)) continue;
    const time = alarmTimeOf(ev);
    const [h, m] = time.split(":").map(Number);
    if (nowMinutes < h * 60 + m) continue; // 아직 알람 시각 전
    out.push({ event: ev, occurrence, alarmDate: today, time, daysLeft: offset });
  }
  // 알람이 임박한(일정이 가까운) 것부터
  out.sort((a, b) => (a.occurrence === b.occurrence ? a.time.localeCompare(b.time) : a.occurrence < b.occurrence ? -1 : 1));
  return out;
}

/** 알람이 걸린 일정의 다가오는 알람 시각 목록 (달력 목록에 🔔 배지로 쓴다) */
export function upcomingAlarms(events: FamilyEvent[], from: string, limit = 6): DueAlarm[] {
  const out: DueAlarm[] = [];
  for (const ev of events) {
    const mode = alarmModeOf(ev);
    if (mode === "none") continue;
    const offset = Number(mode);
    const next = nextOccurrence(ev, from);
    if (!next) continue;
    const alarmDate = new Date(toUTC(next) - offset * DAY).toISOString().slice(0, 10);
    if (alarmDate < from) continue;
    out.push({ event: ev, occurrence: next, alarmDate, time: alarmTimeOf(ev), daysLeft: offset });
  }
  out.sort((a, b) => (a.alarmDate === b.alarmDate ? a.time.localeCompare(b.time) : a.alarmDate < b.alarmDate ? -1 : 1));
  return out.slice(0, limit);
}

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
  if (isLunarEvent(ev)) return lunarOccurrenceInSolarYear(ev, year);
  const [sy, sm, sd] = ev.date.split("-").map(Number);
  if (!ev.repeatYearly) return sy === year ? ev.date : null;
  if (year < sy) return null;
  const lastDay = new Date(Date.UTC(year, sm, 0)).getUTCDate(); // 2월 29일 → 평년엔 말일
  return dateKey(year, sm, Math.min(sd, lastDay));
}

/**
 * 음력 월·일이 어떤 양력 날짜가 되는지 — 일정 폼 미리보기·.ics 내보내기가 함께 쓴다.
 * 윤달이 없는 해면 평달로 되돌아간다.
 */
export function lunarSolarDate(lunarYear: number, month: number, day: number, leap = false): string | null {
  return lunarToSolar(lunarYear, month, day, leap);
}

/** from(포함) 이후 가장 가까운 날짜. 없으면 null */
export function nextOccurrence(ev: FamilyEvent, from: string): string | null {
  const fromYear = Number(from.slice(0, 4));
  for (let y = fromYear; y <= fromYear + 2; y++) {
    // 음력 일정은 그 양력 해에 놓이는 날(12월 일정은 이듬해 1·2월)을 찾는다.
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
