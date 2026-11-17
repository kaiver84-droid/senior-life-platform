/** 연령대 계산 단위 점검 — `bun e2e/check_age_bands.ts` */
import { AGE_BANDS, ageBandLabel, ageBandOf } from "../lib/league";

const cases: [number, number][] = [
  [2020, 10], // 6세 — 10대 이하
  [2012, 10], // 14세
  [2007, 10], // 만 19세
  [2006, 20], // 만 20세
  [1997, 20], // 만 29세
  [1996, 30], // 만 30세
  [1987, 30], // 만 39세
  [1986, 40], // 만 40세
  [1976, 50],
  [1966, 60],
  [1956, 70],
  [1946, 80], // 만 80세
  [1926, 80],
];

let fail = 0;
for (const [year, want] of cases) {
  const got = ageBandOf(year);
  const ok = got === want;
  if (!ok) fail += 1;
  console.log(`${ok ? "OK  " : "FAIL"} ${year}년생 → ${got} (${ageBandLabel(got)}) · 기대 ${want}`);
}
console.log("AGE_BANDS", AGE_BANDS.join(","), AGE_BANDS.length === 8 ? "OK(8개)" : "FAIL");
console.log("라벨", AGE_BANDS.map(ageBandLabel).join(" / "));
console.log("태어난 해 없음 →", ageBandOf(undefined), ageBandLabel(ageBandOf(undefined)));
if (fail) {
  console.log(`실패 ${fail}건`);
  process.exit(1);
}
console.log("전부 통과");
