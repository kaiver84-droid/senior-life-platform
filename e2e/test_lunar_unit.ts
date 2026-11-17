/**
 * 음력 변환 단위 검증 — `node --experimental-strip-types e2e/test_lunar_unit.ts`
 *
 * ① 알려진 설날·추석 양력 날짜(한국천문연구원 월력요항, 2024~2031)
 * ② 오늘(2026-11-17)의 음력 날짜
 * ③ 윤달 (2025 윤6월 · 2028 윤5월) 과, 윤달이 없는 해에 윤달을 고를 때의 평달 폴백
 * ④ 1900~2049년 모든 날의 양력→음력→양력 왕복 일치, 달 길이 합과 다음 해 설날 간격 일치
 */
import {
  LUNAR_MAX_YEAR,
  LUNAR_MIN_YEAR,
  clampLunarDay,
  hasLeapMonth,
  leapMonthOf,
  lunarMonthDays,
  lunarMonths,
  lunarNewYear,
  lunarShortOf,
  lunarText,
  lunarToSolar,
  solarToLunar,
} from "../lib/lunar.ts";

let pass = 0;
const fails: string[] = [];

function check(cond: boolean, label: string, extra = "") {
  if (cond) pass++;
  else fails.push(label + (extra ? ` — ${extra}` : ""));
}

/* ① 설날(음 1/1) · 추석(음 8/15) — 한국천문연구원 월력요항 기준 */
const HOLIDAYS: [number, string, string][] = [
  [2024, "2024-02-10", "2024-09-17"],
  [2025, "2025-01-29", "2025-10-06"],
  [2026, "2026-02-17", "2026-09-25"],
  [2027, "2027-02-07", "2027-09-15"],
  [2028, "2028-01-27", "2028-10-03"],
  [2029, "2029-02-13", "2029-09-22"],
  [2030, "2030-02-03", "2030-09-12"],
  [2031, "2031-01-23", "2031-10-01"],
];
for (const [y, seollal, chuseok] of HOLIDAYS) {
  check(lunarToSolar(y, 1, 1) === seollal, `${y}년 설날 = ${seollal}`, String(lunarToSolar(y, 1, 1)));
  check(lunarToSolar(y, 8, 15) === chuseok, `${y}년 추석 = ${chuseok}`, String(lunarToSolar(y, 8, 15)));
  const back = solarToLunar(seollal);
  check(back?.year === y && back.month === 1 && back.day === 1, `${seollal} → 음 1/1`, JSON.stringify(back));
  const back2 = solarToLunar(chuseok);
  check(back2?.year === y && back2.month === 8 && back2.day === 15, `${chuseok} → 음 8/15`, JSON.stringify(back2));
}

/* ② 오늘 — 2026-11-17 은 음력 10월 9일 */
const today = solarToLunar("2026-11-17");
check(today?.year === 2026 && today.month === 10 && today.day === 9 && today.leap === false, "2026-11-17 = 음 10/9", JSON.stringify(today));
check(lunarShortOf("2026-11-17") === "음력 10.9", "짧은 표기 ‘음력 10.9’", lunarShortOf("2026-11-17"));
check(lunarText(today!) === "음력 10월 9일", "긴 표기 ‘음력 10월 9일’", lunarText(today!));
/* 2026년에는 윤달이 없다 */
check(leapMonthOf(2026) === 0, "2026년 윤달 없음", String(leapMonthOf(2026)));
check(lunarToSolar(2026, 10, 15) === "2026-11-23", "2026 음 10/15 = 11/23", String(lunarToSolar(2026, 10, 15)));
check(lunarToSolar(2026, 10, 16) === "2026-11-24", "2026 음 10/16 = 11/24", String(lunarToSolar(2026, 10, 16)));

/* ③ 윤달 */
check(hasLeapMonth(2025, 6), "2025년 윤6월 있음");
check(lunarToSolar(2025, 6, 1, true) === "2025-07-25", "2025 윤6/1 = 07-25", String(lunarToSolar(2025, 6, 1, true)));
check(lunarToSolar(2025, 6, 1, false) === "2025-06-25", "2025 6/1(평달) = 06-25", String(lunarToSolar(2025, 6, 1, false)));
check(hasLeapMonth(2028, 5), "2028년 윤5월 있음");
check(lunarToSolar(2028, 5, 1, true) === "2028-06-23", "2028 윤5/1 = 06-23", String(lunarToSolar(2028, 5, 1, true)));
/* 윤달이 없는 해에 윤달을 고르면 평달로 안전 폴백 */
check(lunarToSolar(2026, 6, 1, true) === lunarToSolar(2026, 6, 1, false), "윤달 없는 해 → 평달 폴백", String(lunarToSolar(2026, 6, 1, true)));
check(lunarToSolar(2027, 3, 5, true) === lunarToSolar(2027, 3, 5, false), "2027 윤3월 없음 → 평달 폴백");
/* 없는 날(음 2/30)은 말일로 */
check(lunarMonthDays(2026, 2, false) === 29 ? clampLunarDay(2026, 2, 30) === 29 : true, "없는 날은 말일로", String(clampLunarDay(2026, 2, 30)));

/* ④ 왕복 + 달 길이 합 */
const DAY = 86400000;
const toNum = (k: string) => Math.round((Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)) - Date.UTC(1970, 0, 1)) / DAY);
let roundTrip = 0;
let roundTripBad = 0;
let lengthBad = 0;
for (let y = LUNAR_MIN_YEAR; y <= LUNAR_MAX_YEAR; y++) {
  const start = lunarNewYear(y);
  const next = lunarNewYear(y + 1);
  if (!start) {
    fails.push(`설날 없음 ${y}`);
    continue;
  }
  const months = lunarMonths(y);
  const sum = months.reduce((a, m) => a + m.days, 0);
  if (next && toNum(next) - toNum(start) !== sum) {
    lengthBad++;
    fails.push(`달 길이 합 불일치 ${y}: 표 ${next ? toNum(next) - toNum(start) : "-"} vs ${sum}`);
  }
  const last = next ? toNum(next) : toNum(start) + sum;
  for (let n = toNum(start); n < last; n++) {
    const d = new Date(Date.UTC(1970, 0, 1) + n * DAY).toISOString().slice(0, 10);
    const l = solarToLunar(d);
    if (!l) {
      roundTripBad++;
      continue;
    }
    const back = lunarToSolar(l.year, l.month, l.day, l.leap);
    if (back === d) roundTrip++;
    else roundTripBad++;
  }
}
check(roundTripBad === 0 && roundTrip > 50000, "1900~2049 모든 날 왕복 일치", `ok=${roundTrip} bad=${roundTripBad}`);
check(lengthBad === 0, "해마다 달 길이 합 = 다음 설날까지 날수", String(lengthBad));

/* 윤달이 낀 해는 13달, 아니면 12달 */
let monthCountBad = 0;
for (let y = LUNAR_MIN_YEAR; y <= LUNAR_MAX_YEAR; y++) {
  const want = leapMonthOf(y) ? 13 : 12;
  if (lunarMonths(y).length !== want) monthCountBad++;
}
check(monthCountBad === 0, "윤달 해는 13달 · 평년은 12달", String(monthCountBad));

/* 표 범위 밖은 null 로 안전하게 */
check(lunarToSolar(1899, 1, 1) === null, "1900년 이전은 null");
check(lunarToSolar(2050, 1, 1) === null, "2050년은 null");
check(solarToLunar("1899-12-31") === null, "1899-12-31 은 null");

console.log(`음력 단위 검증: ${pass} / ${pass + fails.length} 통과`);
if (fails.length) {
  console.log("실패:", fails.slice(0, 12));
  process.exit(1);
}
