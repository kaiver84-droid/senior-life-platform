/**
 * 퀴즈 문항 은행 점검 — 새로 더한 문항이 일일 퀴즈·연습 모드에서 실제로 출제되는지 확인한다.
 *
 * 사용:
 *   npx esbuild e2e/check_quiz_bank.ts --bundle --format=esm --platform=node --outfile=e2e/.quizbank.mjs
 *   node e2e/.quizbank.mjs
 */
import {
  ALL_QUESTIONS,
  QUIZ_POOLS,
  QUIZ_TOTAL_COUNT,
  QUIZ_TYPE_ORDER,
  dailyQuestions,
  practiceQuestions,
} from "../lib/quiz";

const NEW_IDS = [
  // 사자성어·속담·명소 (초성)
  "ch-idiom-saeong",
  "ch-idiom-baekbal",
  "ch-prov-gosaeng",
  "ch-prov-baneul",
  "ch-place-gyeongbok",
  "ch-place-dokdo",
  // 옛 노래 (가사·가수)
  "ly-sng-namhaeng",
  "ly-sng-mokpo",
  "ly-gichanori",
  "ly-akoe",
  // 생활·안전·보이스피싱·추억 (OX)
  "ox-voice-police",
  "ox-voice-112",
  "ox-med-expired",
  "ox-olympic-hodori",
  "ox-noraejarang-1980",
  "ox-sokdam-nuwo",
  "ox-haji",
  // 숫자·계절·명소·수수께끼 (넌센스)
  "ns-24jeolgi",
  "ns-60gapja",
  "ns-namhan-peak",
  "ns-newspaper",
  "ns-stone-pear",
  // 새 주제 3종 — 추억·보이스피싱/손주 말·제철
  "nos-01",
  "nos-24",
  "saf-01",
  "saf-16",
  "sea-01",
  "sea-33",
];

const byId = new Map(ALL_QUESTIONS.map((q) => [q.id, q]));
let failed = 0;

function check(cond: boolean, label: string, extra = "") {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (extra ? ` — ${extra}` : ""));
  if (!cond) failed += 1;
}

check(QUIZ_TOTAL_COUNT >= 433, "전체 문항 433개 이상", `${QUIZ_TOTAL_COUNT}문항`);
for (const type of QUIZ_TYPE_ORDER) {
  check(QUIZ_POOLS[type].length > 0, `${type} 문제 있음`, `${QUIZ_POOLS[type].length}문항`);
}
const missing = NEW_IDS.filter((id) => !byId.has(id));
check(missing.length === 0, "새 문항 id 가 문제 은행에 있음", missing.join(", ") || "모두 있음");

const newSet = new Set(NEW_IDS.filter((id) => byId.has(id)));

// 1) 일일 퀴즈 — 앞으로 120일 동안 새 문항이 실제로 나오는지
const dailySeen = new Set<string>();
const start = new Date("2026-11-18T00:00:00Z");
for (let i = 0; i < 120; i++) {
  const d = new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10);
  const qs = dailyQuestions(d);
  qs.forEach((q) => dailySeen.add(q.id));
  if (i === 0) {
    check(qs.length === 5 && new Set(qs.map((q) => q.id)).size === 5, "일일 퀴즈는 5문제(서로 다른 문제)", qs.map((q) => q.id).join(", "));
  }
}
const dailyNew = [...dailySeen].filter((id) => newSet.has(id));
check(dailyNew.length >= 5, "일일 퀴즈에 새 문항이 출제됨(120일 표본)", `${dailyNew.length}종: ${dailyNew.slice(0, 6).join(", ")}`);

// 2) 연습 모드 — 유형별로 60번 뽑아 새 문항이 나오는지
for (const type of QUIZ_TYPE_ORDER) {
  const seen = new Set<string>();
  for (let i = 0; i < 300; i++) {
    practiceQuestions([], type).forEach((q) => seen.add(q.id));
  }
  const poolNew = QUIZ_POOLS[type].filter((q) => newSet.has(q.id)).length;
  const hitNew = [...seen].filter((id) => newSet.has(id)).length;
  check(
    poolNew === 0 || hitNew > 0,
    `연습 모드(${type})에서 새 문항 출제`,
    `새 문항 ${poolNew}개 중 ${hitNew}개 확인`
  );
  check(
    seen.size >= Math.ceil(QUIZ_POOLS[type].length * 0.9),
    `연습 모드(${type})가 문제 은행을 고루 사용`,
    `${seen.size}/${QUIZ_POOLS[type].length}`
  );
}

// 3) 보기·해설 기본 품질
const badExplain = ALL_QUESTIONS.filter((q) => !q.explain.trim() || !q.hint.trim());
check(badExplain.length === 0, "모든 문항에 힌트·해설", badExplain.map((q) => q.id).join(", ") || "0건");
const badAnswer = ALL_QUESTIONS.filter((q) => q.answer < 0 || q.answer >= q.options.length);
check(badAnswer.length === 0, "정답 번호가 보기 범위 안", badAnswer.map((q) => q.id).join(", ") || "0건");

console.log(failed ? `\n실패 ${failed}건` : "\n✅ 퀴즈 은행 점검 통과");
if (failed) process.exit(1);
