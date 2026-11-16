/**
 * 모임 API(/api/groups) 검증 — 빌드된 번들(out/_worker.js)을 Node 에서 직접 호출해
 * 실제 Supabase 에 대해 만들기·가입·글쓰기·응원·선택·나가기를 확인한다.
 *
 * 준비: npm run build && npx esbuild functions-entry.ts --bundle --format=esm --platform=browser --target=es2022 --outfile=out/_worker.js
 * 실행: node e2e/test_groups_api.mjs
 */
import fs from "node:fs";
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
copyFileSync(path.join(root, "out/_worker.js"), path.join(root, "e2e/.worker.mjs"));
const worker = (await import("./.worker.mjs")).default;

const env = {};
for (const line of fs.readFileSync(path.join(root, ".env.integrations"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const CODE = "G7TEST";

/** 테스트가 남긴 모임·글·응원을 지운다(체험 모임 게시판을 깨끗하게 유지) */
async function cleanup() {
  const token = fs.readFileSync(path.join(root, ".supabase_token"), "utf8").trim();
  const q = `
    delete from public.group_cheers where user_code = '${CODE}';
    delete from public.group_posts where user_code = '${CODE}';
    delete from public.group_members where user_code = '${CODE}';
    delete from public.groups where creator_code = '${CODE}';
  `;
  const res = await fetch("https://api.supabase.com/v1/projects/aaslirekynetqguajkpv/database/query", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: q }),
  });
  if (!res.ok) console.log("(정리 실패)", res.status, (await res.text()).slice(0, 200));
}

await cleanup();
const me = { name: "테스트", points: 88, days: 4, today: true };

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
  call("/api/groups", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

let fail = 0;
const check = (label, ok, extra = "") => {
  if (!ok) fail += 1;
  console.log(`${ok ? "✅" : "❌"} ${label}${extra ? " — " + extra : ""}`);
};

console.log("--- GET (가입 전)");
let r = await call(`/api/groups?code=${CODE}&meName=${encodeURIComponent(me.name)}&mePoints=88&meDays=4&meToday=1`);
check("GET 200", r.status === 200, JSON.stringify(r.j).slice(0, 160));

console.log("--- JOIN FAM101 (체험 모임)");
r = await post({ action: "join", code: CODE, groupId: "FAM101", name: me.name, me });
const d = r.j.detail;
check("JOIN ok", r.status === 200 && Boolean(d), r.status);
check("회원 11명(체험 10 + 나)", d?.memberCount === 11, String(d?.memberCount));
check("오늘 출석 8~9명", (d?.todayAttended ?? 0) >= 8, `${d?.todayAttended}/${d?.memberCount} (${d?.attendanceRate}%)`);
check("주간 달성률 60~100%", (d?.weeklyRate ?? 0) >= 60 && (d?.weeklyRate ?? 0) <= 100, `${d?.weeklyRate}%`);
check("모임 1위 있음", Boolean(d?.top?.name), JSON.stringify(d?.top));
check("내 순위 있음", Number(d?.myRank) > 0, String(d?.myRank));
check("게시글 3개", d?.posts?.length === 3, String(d?.posts?.length));
check("내 점수 반영(88점)", d?.members?.find((m) => m.isMe)?.points === 88);

console.log("--- POST 글쓰기");
r = await post({ action: "post", code: CODE, groupId: "FAM101", content: "반갑습니다! 오늘 퀴즈 3문제 다 맞혔어요.", me });
const posts = r.j.detail?.posts ?? [];
check("글 등록", posts.length === 4, String(posts.length));
check("내 이름으로 등록", posts[0]?.authorName === me.name, posts[0]?.authorName);
const pid = posts[0]?.id;

console.log("--- 응원");
r = await post({ action: "cheer", code: CODE, groupId: "FAM101", postId: pid, me });
const first = r.j.detail?.posts?.find((p) => p.id === pid);
check("응원 1", first?.cheers === 1, String(first?.cheers));
check("내가 응원함", first?.cheeredByMe === true);
r = await post({ action: "cheer", code: CODE, groupId: "FAM101", postId: pid, me });
check("중복 응원은 늘지 않음", r.j.detail?.posts?.find((p) => p.id === pid)?.cheers === 1);

console.log("--- 새 모임 만들기");
r = await post({ action: "create", code: CODE, name: "옥천 친구들 모임", me });
const newId = r.j.groupId;
check("모임 생성", r.status === 200 && Boolean(newId), newId);
check("6자리 초대 코드", /^[A-Z0-9]{6}$/.test(newId || ""), newId);
check("목록에 2개", r.j.groups?.length === 2, r.j.groups?.map((g) => `${g.id}:${g.name}`).join(", "));
check("새 모임 회원 1명·모임장", r.j.detail?.memberCount === 1 && r.j.detail?.myRole === "leader", r.j.detail?.myRole);

console.log("--- SELECT FAM101 (기본 선택 모임 저장)");
r = await post({ action: "select", code: CODE, groupId: "FAM101", me });
check("선택 반영", r.j.detail?.id === "FAM101", r.j.activeGroupId);
r = await call(`/api/groups?code=${CODE}`);
check("다시 불러와도 보던 모임", r.j.detail?.id === "FAM101", r.j.detail?.id);

console.log("--- LEAVE 새 모임");
r = await post({ action: "leave", code: CODE, groupId: newId, me });
check("목록에서 사라짐", r.j.groups?.length === 1, r.j.groups?.map((g) => g.id).join(","));

console.log("--- 오류 처리");
r = await post({ action: "join", code: CODE, groupId: "ZZZZZZ" });
check("없는 코드 404", r.status === 404, String(r.status));
r = await call("/api/groups");
check("코드 없으면 400", r.status === 400, String(r.status));

console.log("--- 정리: 테스트 회원 탈퇴");
r = await post({ action: "leave", code: CODE, groupId: "FAM101", me });
check("체험 모임도 나가기", r.j.groups?.length === 0, String(r.j.groups?.length));

const lastMe = (await post({ action: "post", code: CODE, groupId: "FAM101", content: "정리", me })).status;
console.log("(참고) 나간 뒤 글쓰기 상태:", lastMe);

await cleanup();

console.log(fail === 0 ? "\n전부 통과" : `\n실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
