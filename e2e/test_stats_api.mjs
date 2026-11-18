/**
 * /api/stats 핸들러 점검 (배포 전, 실제 Supabase 사용).
 *
 *   set -a; . ./.env.integrations; set +a
 *   node e2e/test_stats_api.mjs
 *
 * functions-entry.ts 를 esbuild 로 묶은 번들을 그대로 불러 fetch() 를 흉내 낸다.
 */
import worker from "../tmp_worker_stats.mjs";

const env = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

for (const q of ["", "?code=ZZZZZZ", "?code=tf1j4s"]) {
  const res = await worker.fetch(new Request(`https://senior-life-platform.pages.dev/api/stats${q}`), env);
  console.log(q || "(no code)", res.status, await res.text());
}
const health = await worker.fetch(new Request("https://x/api/health"), env);
console.log("health", health.status, (await health.text()).slice(0, 120));
