/**
 * 건강생활 챌린지 저장·조회 API 검증 — /api/state 와 /api/groups 를 빌드된 번들(out/_worker.js)로 직접 호출한다.
 * 실제 Supabase(health_checks)에 쓰고 읽은 뒤 테스트 기록을 지운다.
 *
 * 준비: npm run build && esbuild functions-entry.ts --bundle --format=esm --target=es2022 --outfile=out/_worker.js
 * 실행: node e2e/test_health_api.mjs
 */
import fs from "node:fs";
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
copyFileSync(path.join(root, "out/_worker.js"), path.join(root, "e2e/.worker.mjs"));
const worker = (await import(`./.worker.mjs?t=${Date.now()}`)).default;

const env = {};
for (const line of fs.readFileSync(path.join(root, ".env.integrations"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const CODE = "H2TEST";
const TOKEN = fs.readFileSync(path.join(root, ".supabase_token"), "utf8").trim();
const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

const results = {};
const errors = [];

function check(cond, label, extra = "") {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (extra ? ` — ${extra}` : ""));
  results[label] = Boolean(cond);
  if (!cond) errors.push(label);
}

async function sql(query) {
  const res = await fetch("https://api.supabase.com/v1/projects/aaslirekynetqguajkpv/database/query", {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) console.log("(sql 실패)", res.status, (await res.text()).slice(0, 200));
  return res.ok ? res.json() : null;
}

async function cleanup() {
  await sql(`
    delete from public.health_checks where user_code = '${CODE}';
    delete from public.group_cheers where user_code = '${CODE}';
    delete from public.group_posts where user_code = '${CODE}';
    delete from public.group_members where user_code = '${CODE}';
    delete from public.groups where creator_code = '${CODE}';
    delete from public.quiz_logs where user_code = '${CODE}';
    delete from public.daily_visits where user_code = '${CODE}';
    delete from public.med_checks where user_code = '${CODE}';
    delete from public.family_events where user_code = '${CODE}';
    delete from public.users where code = '${CODE}';
  `);
}

async function call(p, init) {
  const res = await worker.fetch(new Request("http://localhost" + p, init), env);
  const text = await res.text();
  let j;
  try {
    j = JSON.parse(text);
  } catch {
    j = text;
  }
  return { status: res.status, j };
}

const post = (body) =>
  call("/api/state", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

async function main() {
  await cleanup();

  // 1) 프로필 + 건강 체크 저장
  const profile = {
    id: `u_${CODE.toLowerCase()}`,
    nickname: "건강순자",
    birthYear: 1952,
    birthTime: "묘시",
    sido: "충청북도",
    sigungu: "옥천군",
    source: "demo",
    createdAt: new Date().toISOString(),
    profileCompleted: true,
  };
  const save = await post({
    code: CODE,
    profile,
    health: { [today]: ["water", "walk", "stretch"] },
    today,
  });
  check(save.status === 200 && save.j.ok, "POST /api/state 건강 체크 저장", `status ${save.status}`);

  const rows = await sql(`select challenges from public.health_checks where user_code = '${CODE}' and check_date = '${today}';`);
  check(Array.isArray(rows) && rows.length === 1, "Supabase health_checks 한 줄", rows ? `${rows.length}줄` : "조회 실패");
  const savedIds = rows?.[0]?.challenges || [];
  check(
    savedIds.length === 3 && ["water", "walk", "stretch"].every((x) => savedIds.includes(x)),
    "저장된 챌린지 id 3개",
    JSON.stringify(savedIds)
  );

  // 2) GET /api/state 로 다시 읽기(재로그인·다른 기기 복원 경로)
  const got = await call(`/api/state?code=${CODE}`);
  const health = got.j?.state?.health || {};
  check(
    got.status === 200 && Array.isArray(health[today]) && health[today].length === 3,
    "GET /api/state 로 체크인 복원",
    JSON.stringify(health)
  );

  // 3) 하루 체크를 줄이면 그대로 반영(모두 해제하면 줄이 지워진다)
  const shrink = await post({ code: CODE, profile, health: { [today]: ["water"] }, today });
  const rows2 = await sql(`select challenges from public.health_checks where user_code = '${CODE}' and check_date = '${today}';`);
  check(shrink.status === 200 && rows2?.[0]?.challenges?.length === 1, "체크 줄이기 반영", JSON.stringify(rows2?.[0]?.challenges));

  // 4) 모임 상세에 오늘의 건강 챌린지 요약이 실린다
  await post({ code: CODE, profile, health: { [today]: ["water", "walk"] }, today });
  const joined = await call("/api/groups", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "join", code: CODE, groupId: "FAM101", name: "건강순자", me: { name: "건강순자", points: 0, days: 1, today: true, health: ["water", "walk"] } }),
  });
  const detail = joined.j?.detail;
  check(joined.status === 200 && Boolean(detail?.health), "모임 상세에 health 요약", JSON.stringify(detail?.health ?? null).slice(0, 120));
  check(detail?.health?.total === 5, "health.total = 5", String(detail?.health?.total));
  check(detail?.health?.myDone === 2, "내 체크 2개 반영", String(detail?.health?.myDone));
  check(Array.isArray(detail?.health?.cells) && detail.health.cells.length === 5, "챌린지별 인원 5칸", String(detail?.health?.cells?.length));
  check((detail?.health?.joined ?? 0) >= detail?.health?.myDone > 0, "모임 참여 인원 계산", `${detail?.health?.joined}/${detail?.health?.memberCount}`);

  // 5) 모임 달성률(오늘 출석)에 건강 체크가 반영된다 — 체험 회원 8명 + 나
  check((detail?.todayAttended ?? 0) >= 9, "오늘 참여 인원에 건강 체크 반영", `${detail?.todayAttended}/${detail?.memberCount}`);

  // 6) 테이블 정리 후에는 200 으로 빈 health 가 돌아온다(오류 아님)
  await cleanup();
  const after = await call(`/api/state?code=${CODE}`);
  check(after.status === 404 || after.status === 200, "정리 뒤 응답 정상", `status ${after.status}`);

  console.log(JSON.stringify(results, null, 1));
  console.log(`\n총 ${Object.keys(results).length}개 중 실패 ${errors.length}개`);
  process.exit(errors.length ? 1 : 0);
}

await main();
