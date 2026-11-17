/**
 * 한국 음력 ↔ 양력 변환 — 의존성 없는 순수 TypeScript 구현.
 *
 * 표는 한국천문연구원 음양력 자료(1900~2049년)를 바탕으로 한 계산 결과를 연 단위로 압축해 담았다.
 *   [0] 그해 음력 1월 1일의 양력 날짜(1970-01-01 을 0 으로 센 일수)
 *   [1] 그해 윤달이 든 음력 달 (없으면 0)
 *   [2] 달 길이 비트 — 달차례대로 1 이면 큰달(30일), 0 이면 작은달(29일)
 * 설날(음 1/1)·추석(음 8/15)·윤달을 알려진 양력 날짜와 맞춰 검증했다(e2e/test_lunar_unit.ts 참고).
 *
 * 앱에서는 음력 일정의 월·일만 쓰므로, 1900~2049년 범위를 벗어나면 null 을 돌려주고
 * 부르는 쪽에서 양력으로 안전하게 되돌아간다.
 */

export type LunarDate = {
  year: number;
  month: number;
  day: number;
  /** 윤달인지 */
  leap: boolean;
};

export const LUNAR_MIN_YEAR = 1900;
export const LUNAR_MAX_YEAR = 2049;

const DAY = 86400000;
const EPOCH = Date.UTC(1970, 0, 1);
const pad = (n: number) => String(n).padStart(2, "0");

const TABLE: [number, number, number][] = [
  [-25537, 8, 0x16d2], // 1900
  [-25153, 0, 0x752], // 1901
  [-24799, 0, 0xea5], // 1902
  [-24444, 5, 0x164a], // 1903
  [-24061, 0, 0x64b], // 1904
  [-23707, 0, 0xa9b], // 1905
  [-23352, 4, 0x1556], // 1906
  [-22968, 0, 0x56a], // 1907
  [-22614, 0, 0xb59], // 1908
  [-22259, 2, 0x1752], // 1909
  [-21875, 0, 0x752], // 1910
  [-21521, 6, 0x1b25], // 1911
  [-21137, 0, 0xb25], // 1912
  [-20783, 0, 0xa4b], // 1913
  [-20429, 5, 0x129b], // 1914
  [-20045, 0, 0xaad], // 1915
  [-19690, 0, 0x56a], // 1916
  [-19336, 2, 0xb69], // 1917
  [-18952, 0, 0xba9], // 1918
  [-18597, 7, 0x1b52], // 1919
  [-18213, 0, 0xd92], // 1920
  [-17859, 0, 0xd25], // 1921
  [-17505, 5, 0x1a4d], // 1922
  [-17121, 0, 0x956], // 1923
  [-16767, 0, 0x2b5], // 1924
  [-16413, 4, 0x15ad], // 1925
  [-16028, 0, 0x6d4], // 1926
  [-15674, 0, 0xda9], // 1927
  [-15319, 2, 0x1d92], // 1928
  [-14935, 0, 0xe92], // 1929
  [-14581, 6, 0xd26], // 1930
  [-14198, 0, 0x527], // 1931
  [-13844, 0, 0xa57], // 1932
  [-13489, 5, 0x12b6], // 1933
  [-13105, 0, 0xada], // 1934
  [-12750, 0, 0x6d4], // 1935
  [-12396, 3, 0xea9], // 1936
  [-12012, 0, 0x749], // 1937
  [-11658, 7, 0x1693], // 1938
  [-11274, 0, 0xa93], // 1939
  [-10920, 0, 0x52b], // 1940
  [-10566, 6, 0xa5b], // 1941
  [-10182, 0, 0x96d], // 1942
  [-9827, 0, 0xb6a], // 1943
  [-9472, 4, 0x1b54], // 1944
  [-9088, 0, 0xba4], // 1945
  [-8734, 0, 0xb49], // 1946
  [-8380, 2, 0x1a93], // 1947
  [-7996, 0, 0xa95], // 1948
  [-7642, 7, 0x152b], // 1949
  [-7258, 0, 0x52d], // 1950
  [-6904, 0, 0xaad], // 1951
  [-6549, 5, 0x156a], // 1952
  [-6165, 0, 0xdb2], // 1953
  [-5810, 0, 0xda4], // 1954
  [-5456, 3, 0x1d49], // 1955
  [-5072, 0, 0xd4a], // 1956
  [-4718, 8, 0x1a95], // 1957
  [-4334, 0, 0xa96], // 1958
  [-3980, 0, 0x556], // 1959
  [-3626, 6, 0xab5], // 1960
  [-3242, 0, 0xad5], // 1961
  [-2887, 0, 0x6d2], // 1962
  [-2533, 4, 0xea5], // 1963
  [-2149, 0, 0xea5], // 1964
  [-1794, 0, 0xe4a], // 1965
  [-1440, 3, 0xc96], // 1966
  [-1057, 0, 0xa9b], // 1967
  [-702, 7, 0x1556], // 1968
  [-318, 0, 0x56a], // 1969
  [36, 0, 0xb59], // 1970
  [391, 5, 0x1752], // 1971
  [775, 0, 0x752], // 1972
  [1129, 0, 0x725], // 1973
  [1483, 4, 0x164b], // 1974
  [1867, 0, 0xa4b], // 1975
  [2221, 8, 0x12ab], // 1976
  [2605, 0, 0x2ad], // 1977
  [2959, 0, 0x56b], // 1978
  [3314, 6, 0xb69], // 1979
  [3698, 0, 0xda9], // 1980
  [4053, 0, 0xd92], // 1981
  [4407, 4, 0x1b25], // 1982
  [4791, 0, 0xd25], // 1983
  [5145, 10, 0x1a4d], // 1984
  [5529, 0, 0xa56], // 1985
  [5883, 0, 0x2b6], // 1986
  [6237, 6, 0x15ad], // 1987
  [6622, 0, 0x6d4], // 1988
  [6976, 0, 0xda9], // 1989
  [7331, 5, 0x1d92], // 1990
  [7715, 0, 0xe92], // 1991
  [8069, 0, 0xd26], // 1992
  [8423, 3, 0xa56], // 1993
  [8806, 0, 0xa57], // 1994
  [9161, 8, 0x12b6], // 1995
  [9545, 0, 0xb5a], // 1996
  [9900, 0, 0x6d4], // 1997
  [10254, 5, 0xec9], // 1998
  [10638, 0, 0x749], // 1999
  [10992, 0, 0x693], // 2000
  [11346, 4, 0x1527], // 2001
  [11730, 0, 0x52b], // 2002
  [12084, 0, 0xa5b], // 2003
  [12439, 2, 0x155a], // 2004
  [12823, 0, 0x36a], // 2005
  [13177, 7, 0x1b55], // 2006
  [13562, 0, 0xba4], // 2007
  [13916, 0, 0xb49], // 2008
  [14270, 5, 0x1a93], // 2009
  [14654, 0, 0xa95], // 2010
  [15008, 0, 0x52d], // 2011
  [15362, 3, 0xa5d], // 2012
  [15746, 0, 0xaad], // 2013
  [16101, 9, 0x15aa], // 2014
  [16485, 0, 0x5d2], // 2015
  [16839, 0, 0xda5], // 2016
  [17194, 5, 0x1d4a], // 2017
  [17578, 0, 0xd4a], // 2018
  [17932, 0, 0xa95], // 2019
  [18286, 4, 0x152d], // 2020
  [18670, 0, 0x556], // 2021
  [19024, 0, 0xab5], // 2022
  [19379, 2, 0x15aa], // 2023
  [19763, 0, 0x6d2], // 2024
  [20117, 6, 0xea5], // 2025
  [20501, 0, 0xea5], // 2026
  [20856, 0, 0xe4a], // 2027
  [21210, 5, 0xc96], // 2028
  [21593, 0, 0xc9b], // 2029
  [21948, 0, 0x55a], // 2030
  [22302, 3, 0xad5], // 2031
  [22686, 0, 0xb69], // 2032
  [23041, 11, 0x1752], // 2033
  [23425, 0, 0x752], // 2034
  [23779, 0, 0xb25], // 2035
  [24133, 6, 0x164b], // 2036
  [24517, 0, 0xa4b], // 2037
  [24871, 0, 0x4ab], // 2038
  [25225, 5, 0x55b], // 2039
  [25609, 0, 0x56d], // 2040
  [25964, 0, 0xb69], // 2041
  [26319, 2, 0x1b52], // 2042
  [26703, 0, 0xd92], // 2043
  [27057, 7, 0x1d25], // 2044
  [27441, 0, 0xd25], // 2045
  [27795, 0, 0xa4d], // 2046
  [28149, 5, 0x14ad], // 2047
  [28533, 0, 0x2b6], // 2048
  [28887, 0, 0x5b5], // 2049
];

/** 1970-01-01 을 0 으로 센 일수 */
function dayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / DAY);
}

function keyOf(n: number): string {
  const d = new Date(EPOCH + n * DAY);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function rowOf(year: number): [number, number, number] | null {
  if (!Number.isInteger(year) || year < LUNAR_MIN_YEAR || year > LUNAR_MAX_YEAR) return null;
  return TABLE[year - LUNAR_MIN_YEAR];
}

export type LunarMonth = { month: number; leap: boolean; days: number };

const monthCache = new Map<number, LunarMonth[]>();

/** 그 음력 해의 달차례 (윤달은 평달 바로 뒤에 들어간다) */
export function lunarMonths(year: number): LunarMonth[] {
  const cached = monthCache.get(year);
  if (cached) return cached;
  const row = rowOf(year);
  if (!row) return [];
  const [, leapMonth, mask] = row;
  const count = leapMonth ? 13 : 12;
  const out: LunarMonth[] = [];
  let bit = 0;
  for (let m = 1; m <= 12 && bit < count; m++) {
    out.push({ month: m, leap: false, days: (mask >> bit) & 1 ? 30 : 29 });
    bit++;
    if (m === leapMonth && bit < count) {
      out.push({ month: m, leap: true, days: (mask >> bit) & 1 ? 30 : 29 });
      bit++;
    }
  }
  monthCache.set(year, out);
  return out;
}

/** 그해 윤달이 든 달 (없으면 0) */
export function leapMonthOf(year: number): number {
  const row = rowOf(year);
  return row ? row[1] : 0;
}

/** 그해 그 달에 윤달이 있는지 */
export function hasLeapMonth(year: number, month: number): boolean {
  return leapMonthOf(year) === month;
}

/** 그해 그 달의 날수 (29·30). 윤달이 없는 해에 윤달을 물으면 평달 날수를 돌려준다 */
export function lunarMonthDays(year: number, month: number, leap = false): number {
  const months = lunarMonths(year);
  const exact = months.find((m) => m.month === month && m.leap === leap);
  if (exact) return exact.days;
  const plain = months.find((m) => m.month === month);
  return plain ? plain.days : 29;
}

/** 음력 그해 첫날(음 1/1)의 양력 날짜 */
export function lunarNewYear(year: number): string | null {
  const row = rowOf(year);
  return row ? keyOf(row[0]) : null;
}

/** 양력 날짜(YYYY-MM-DD) → 음력 */
export function solarToLunar(dateKey: string): LunarDate | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const n = dayNumber(dateKey);
  let year = -1;
  for (let y = LUNAR_MAX_YEAR; y >= LUNAR_MIN_YEAR; y--) {
    const row = rowOf(y);
    if (row && row[0] <= n) {
      year = y;
      break;
    }
  }
  if (year < 0) return null;
  const months = lunarMonths(year);
  if (!months.length) return null;
  let offset = n - (rowOf(year) as [number, number, number])[0];
  for (const m of months) {
    if (offset < m.days) return { year, month: m.month, day: offset + 1, leap: m.leap };
    offset -= m.days;
  }
  return null; // 표 범위 밖(다음 해 설날 이후)
}

/** 음력 → 양력. 그해에 그 윤달이 없으면 평달로 안전하게 되돌아간다 */
export function lunarToSolar(year: number, month: number, day: number, leap = false): string | null {
  const row = rowOf(year);
  if (!row) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1) return null;
  const months = lunarMonths(year);
  const want = months.find((m) => m.month === month && m.leap === (leap && hasLeapMonth(year, month)));
  const plain = months.find((m) => m.month === month && !m.leap);
  const target = want ?? plain;
  if (!target) return null;
  let before = 0;
  for (const m of months) {
    if (m.month === target.month && m.leap === target.leap) break;
    before += m.days;
  }
  const safeDay = Math.min(day, target.days);
  return keyOf(row[0] + before + safeDay - 1);
}

/** 그 음력 달에 실제로 있는 마지막 날 (없는 날을 고르면 말일로 맞춘다) */
export function clampLunarDay(year: number, month: number, day: number, leap = false): number {
  const days = lunarMonthDays(year, month, leap && hasLeapMonth(year, month));
  return Math.min(Math.max(1, Math.trunc(day || 1)), days);
}

/** "음력 10월 15일" · "음력 윤5월 2일" */
export function lunarText(l: { month: number; day: number; leap?: boolean }): string {
  return `음력 ${l.leap ? "윤" : ""}${l.month}월 ${l.day}일`;
}

/** "음력 10.15" — 좁은 자리에 쓰는 짧은 표기 */
export function lunarShortText(l: { month: number; day: number; leap?: boolean }): string {
  return `음력 ${l.leap ? "윤" : ""}${l.month}.${l.day}`;
}

/** 양력 날짜 하나로 짧은 음력 표기 — "음력 10.9" (표 범위 밖이면 빈 글자) */
export function lunarShortOf(dateKey: string): string {
  const l = solarToLunar(dateKey);
  return l ? lunarShortText(l) : "";
}
