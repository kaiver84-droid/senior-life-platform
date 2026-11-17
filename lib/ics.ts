/**
 * 휴대폰 기본 캘린더(iPhone 캘린더 · 삼성 캘린더 · 구글 캘린더)에 넣을 알람 파일(.ics).
 *
 * 앱을 닫아 두어도 실제 휴대폰 알람이 울리게 하려면 휴대폰 캘린더에 일정을 넣어야 한다.
 * 알람이 울리는 날(alarmDate)의 알람 시각에 15분짜리 일정을 만들고 VALARM(TRIGGER:-PT0M)을
 * 붙여, 등록하자마자 그 시각에 알림이 울리도록 한다.
 */
import {
  ALARM_MODES,
  alarmModeOf,
  alarmTimeOf,
  alarmTimeLabel,
  dayTitle,
  weekdayShort,
  type FamilyEvent,
} from "./calendar";

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
};

/** 알람이 걸린 일정 하나를 .ics 파일 글자로 만든다 */
export function eventIcsText(ev: FamilyEvent, opts: IcsOptions): string {
  const occurrence = opts.occurrence || ev.date;
  const mode = alarmModeOf(ev);
  const offset = ALARM_MODES.find((m) => m.key === mode)?.offset ?? 0;
  const [y, m, d] = occurrence.split("-").map(Number);
  const alarmDate =
    opts.alarmDate ??
    new Date(Date.UTC(y, m - 1, d) - Math.max(0, offset) * 86400000).toISOString().slice(0, 10);
  const time = alarmTimeOf(ev);

  const start = icsLocal(alarmDate, time);
  const [hh, mm] = time.split(":").map(Number);
  const endMinutes = hh * 60 + mm + 15;
  const end = icsLocal(alarmDate, `${pad(Math.floor(endMinutes / 60) % 24)}:${pad(endMinutes % 60)}`);

  const modeLabel = ALARM_MODES.find((m) => m.key === mode)?.label ?? "당일";
  const summary = `🔔 ${ev.title} (${modeLabel} 알람)`;
  const description = [
    `${ev.title} — ${dayTitle(occurrence)} (${weekdayShort(occurrence)})`,
    ev.repeatYearly ? "매년 반복하는 날이에요." : "",
    ev.memo ? `메모: ${ev.memo}` : "",
    `늘봄 가족안부달력에서 ${modeLabel} ${alarmTimeLabel(time)}에 알려 드려요.`,
  ]
    .filter(Boolean)
    .join("\n");

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const uid = opts.uid || `${ev.id}-${alarmDate}@neulbom`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Neulbom//Family Calendar//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    ...(ev.repeatYearly ? ["RRULE:FREQ=YEARLY"] : []),
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(summary)}`,
    "TRIGGER:-PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ];
  return lines.map(fold).join("\r\n");
}

/** 여러 일정을 한 파일로 (오늘 알림 여러 건을 한 번에 휴대폰 알람에 넣을 때) */
export function eventsIcsText(items: { event: FamilyEvent; occurrence: string; alarmDate?: string }[]): string {
  const bodies = items.map((it) =>
    eventIcsText(it.event, { occurrence: it.occurrence, alarmDate: it.alarmDate })
      .replace("BEGIN:VCALENDAR\r\n", "")
      .split("END:VCALENDAR")[0]
      .replace(/^(VERSION|PRODID|CALSCALE|METHOD):.*\r\n/gm, "")
  );
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Neulbom//Family Calendar//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...bodies,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

/** 파일 이름 — 휴대폰 캘린더가 알아보기 쉬운 이름으로 */
export function icsFileName(ev: FamilyEvent, occurrence: string): string {
  const safe = ev.title.replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 24) || "가족일정";
  return `늘봄_${safe}_${occurrence.replace(/-/g, "")}.ics`;
}
