/** 주차 계산 · 한국 시간(KST) 기준 */

const KST_OFFSET = 9 * 60 * 60 * 1000;

export function kstDate(d: Date = new Date()): string {
  const t = new Date(d.getTime() + KST_OFFSET);
  return t.toISOString().slice(0, 10);
}

export function kstDateObj(d: Date = new Date()): Date {
  const t = new Date(d.getTime() + KST_OFFSET);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
}

const DAY = 86400000;

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return new Date(d.getTime() + n * DAY).toISOString().slice(0, 10);
}

/** 목요일 기준 ISO 주차 */
export function weekIdOf(dateStr: string = kstDate()): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / DAY + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** 이번 주 월요일 ~ 일요일 */
export function weekRange(dateStr: string = kstDate()): { start: string; end: string } {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay() || 7; // 월=1 ... 일=7
  const start = new Date(d.getTime() - (day - 1) * DAY);
  const end = new Date(start.getTime() + 6 * DAY);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function periodLabel(dateStr: string = kstDate()): string {
  const { start, end } = weekRange(dateStr);
  const f = (s: string) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;
  return `${f(start)} ~ ${f(end)}`;
}

export function resetCountdown(now: Date = new Date()): string {
  // 다음 월요일 00:00 KST 까지 남은 시간
  const cur = new Date(now.getTime() + KST_OFFSET);
  const day = cur.getUTCDay(); // 0=일, 1=월 ... 6=토
  const untilMon = (8 - day) % 7; // 월요일이면 0
  const add = untilMon === 0 ? 7 : untilMon; // 오늘이 월요일이면 다음 주 월요일
  const next = new Date(
    Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate() + add, 0, 0, 0)
  );
  const diff = next.getTime() - cur.getTime();
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours >= 24) return `${Math.ceil(hours / 24)}일 후`;
  return `${hours}시간 ${mins}분 후`;
}

export function koreanDate(dateStr: string = kstDate()): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${days[d.getUTCDay()]})`;
}
