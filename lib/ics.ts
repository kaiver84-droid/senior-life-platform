/**
 * 휴대폰 기본 캘린더(iPhone 캘린더 · 삼성 캘린더 · 구글 캘린더)에 넣을 알람 파일(.ics).
 *
 * 앱을 닫아 두어도 실제 휴대폰 알람이 울리게 하려면 휴대폰 캘린더에 일정을 넣어야 한다.
 * 알람이 울리는 날(alarmDate)의 알람 시각에 15분짜리 일정을 만들고 VALARM(TRIGGER:-PT0M)을
 * 붙여, 등록하자마자 그 시각에 알림이 울리도록 한다.
 *
 * 음력 일정은 해마다 양력 날짜가 달라지므로 RRULE:FREQ=YEARLY 로 넣으면 안 된다.
 * 대신 실제로 바뀐 양력 날짜를 앞으로 5년치 각각의 VEVENT 로 넣어 준다.
 */
import {
  ALARM_MODES,
  alarmModeOf,
  alarmTimeOf,
  alarmTimeLabel,
  dayTitle,
  weekdayShort,
  isLunarEvent,
  lunarTitleOf,
  type FamilyEvent,
} from "./calendar";
import { solarToLunar, lunarToSolar } from "./lunar";

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-11-21" + "09:00" → "20261121T090000" (휴대폰 현지 시각으로 읽히는 floating time) */
function icsLocal(dateKey: string, time: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return `${y}${pad(m)}${pad(d)}T${pad(hh)}${pad(mm)}00`;
}

/** 긴 줄은 74바이트에서 접는다 (RFC 5545) */
function fold(line: string): string {
  const out: string[] = [];
  let cur = "";
  let curLen = 0;
  for (const ch of line) {
    const len = new TextEncoder().encode(ch).length;
    if (curLen + len > 73) {
      out.push(cur);
      cur = " " + ch;
      curLen = 1 + len;
    } else {
      cur += ch;
      curLen += len;
    }
  }
  out.push(cur);
  return out.join("\r\n");
}

function escapeText(text: string): string {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export type IcsOptions = {
  /** 일정이 실제로 있는 날 (반복이면 그 해의 날짜) */
  occurrence: string;
  /** 알람이 울리는 날 — 없으면 occurrence 로 본다 */
  alarmDate?: string;
  /** 고유 번호(같은 일정을 다시 넣어도 중복이 쌓이지 않게) */
  uid?: string;
  /** 음력 일정을 몇 해치 넣을지 (반복 일정) */
  lunarYearsAhead?: number;
};

/** 음력 일정의 ics 앞으로 몇 해치를 넣을지 */
const LUNAR_ICS_YEARS = 5;

/**
 * .ics 에 넣을 실제 양력 날짜들.
 * 양력 일정은 한 번(반복은 RRULE), 음력 일정은 해마다 바뀌므로 5년치를 각각 넣는다.
 */
function occurrenceList(ev: FamilyEvent, base: string, ahead: number): string[] {
  if (!isLunarEvent(ev) || !ev.repeatYearly) return [base];
  const lunar = solarToLunar(base);
  if (!lunar) return [base];
  const out = [base];
  for (let i = 1; i < Math.max(1, ahead); i++) {
    const next = lunarToSolar(lunar.year + i, lunar.month, lunar.day, lunar.leap);
    if (!next) break;
    out.push(next);
  }
  return out;
}

/** 알람 시점(며칠 전) 만큼 앞선 날 */
function alarmDayFor(occurrence: string, ev: FamilyEvent): string {
  const mode = alarmModeOf(ev);
  const offset = Math.max(0, ALARM_MODES.find((m) => m.key === mode)?.offset ?? 0);
  const [y, m, d] = occurrence.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - offset * 86400000).toISOString().slice(0, 10);
}

/** 일정 하나(반복이면 그 해의 한 번)를 VEVENT 글자로 */
function veventLines(ev: FamilyEvent, occurrence: string, alarmDate: string | undefined, uid: string): string[] {
  const mode = alarmModeOf(ev);
  const time = alarmTimeOf(ev);
  const when = alarmDate ?? alarmDayFor(occurrence, ev);

  const start = icsLocal(when, time);
  const [hh, mm] = time.split(":").map(Number);
  const endMinutes = hh * 60 + mm + 15;
  const end = icsLocal(when, `${pad(Math.floor(endMinutes / 60) % 24)}:${pad(endMinutes % 60)}`);

  const modeLabel = ALARM_MODES.find((m) => m.key === mode)?.label ?? "당일";
  const lunarTitle = lunarTitleOf(ev);
  const summary = `🔔 ${ev.title} (${modeLabel} 알람)`;
  const description = [
    `${ev.title} — ${dayTitle(occurrence)} (${weekdayShort(occurrence)})`,
    lunarTitle ? `${lunarTitle}을 양력으로 옮긴 날이에요. (음력 날짜라 해마다 양력 날짜가 달라져요)` : "",
    ev.repeatYearly ? (lunarTitle ? "매년 음력으로 반복하는 날이에요." : "매년 반복하는 날이에요.") : "",
    ev.memo ? `메모: ${ev.memo}` : "",
    `늘봄 가족안부달력에서 ${modeLabel} ${alarmTimeLabel(time)}에 알려 드려요.`,
  ]
    .filter(Boolean)
    .join("\n");

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  // 음력 일정은 RRULE 없이 해마다 따로 넣으므로 UID 도 날짜마다 다르게 둔다
  const yearlyRule = ev.repeatYearly && !isLunarEvent(ev) ? ["RRULE:FREQ=YEARLY"] : [];

  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    ...yearlyRule,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(summary)}`,
    "TRIGGER:-PT0M",
    "END:VALARM",
    "END:VEVENT",
  ];
}

/** 알람이 걸린 일정 하나를 .ics 파일 글자로 만든다 */
export function eventIcsText(ev: FamilyEvent, opts: IcsOptions): string {
  const base = opts.occurrence || ev.date;
  const occurrences = occurrenceList(ev, base, opts.lunarYearsAhead ?? LUNAR_ICS_YEARS);

  const bodies = occurrences.flatMap((occurrence, i) => {
    // 첫 번째는 부르는 쪽이 알람 날짜를 알려 줄 수 있다(오늘 알림 카드)
    const alarmDate = i === 0 ? opts.alarmDate : undefined;
    const uid =
      opts.uid ??
      (occurrences.length > 1 || isLunarEvent(ev) ? `${ev.id}-${occurrence}@neulbom` : `${ev.id}-${alarmDate ?? alarmDayFor(occurrence, ev)}@neulbom`);
    return veventLines(ev, occurrence, alarmDate, uid);
  });

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Neulbom//Family Calendar//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...bodies,
    "END:VCALENDAR",
    "",
  ];
  return lines.map(fold).join("\r\n");
}

/** 여러 일정을 한 파일로 (오늘 알림 여러 건을 한 번에 휴대폰 알람에 넣을 때) */
export function eventsIcsText(items: { event: FamilyEvent; occurrence: string; alarmDate?: string }[]): string {
  const bodies = items.flatMap((it) => {
    const occurrences = occurrenceList(it.event, it.occurrence, LUNAR_ICS_YEARS);
    return occurrences.flatMap((occurrence, i) =>
      veventLines(
        it.event,
        occurrence,
        i === 0 ? it.alarmDate : undefined,
        `${it.event.id}-${occurrence}@neulbom`
      )
    );
  });
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Neulbom//Family Calendar//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...bodies,
    "END:VCALENDAR",
    "",
  ]
    .map(fold)
    .join("\r\n");
}

/** 파일 이름 — 휴대폰 캘린더가 알아보기 쉬운 이름으로 */
export function icsFileName(ev: FamilyEvent, occurrence: string): string {
  const safe = ev.title.replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 24) || "가족일정";
  return `늘봄_${safe}_${occurrence.replace(/-/g, "")}.ics`;
}
