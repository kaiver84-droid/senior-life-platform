/**
 * 로컬 검증 — 배포 전에 out/_worker.js 가 요청 주소마다 어떤 <title>·og:* 를 내려주는지 확인한다.
 * env.ASSETS 대신 out/ 폴더를 읽는 가짜 바인딩을 넣어 실제 worker 코드를 그대로 부른다.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../out");

const ASSETS = {
  async fetch(req) {
    const url = new URL(req.url);
    let file = path.join(OUT, decodeURIComponent(url.pathname));
    try {
      const body = await readFile(file);
      return new Response(body, { status: 200, headers: { "content-type": "text/html" } });
    } catch {
      try {
        const body = await readFile(path.join(file, "index.html"));
        return new Response(body, { status: 200, headers: { "content-type": "text/html" } });
      } catch {
        return new Response("not found", { status: 404 });
      }
    }
  },
};

const env = {
  ASSETS,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

const worker = (await import(path.join(path.dirname(fileURLToPath(import.meta.url)), ".worker.mjs"))).default;

const targets = [
  "/",
  "/?group=ZEPCVS",
  "/?join=ZEPCVS",
  "/?group=ZZZZZZ",
  "/family/?code=TF1J4S",
  "/?tab=quiz",
  "/?tab=welfare",
  "/?tab=ranking",
  "/?tab=groups",
  "/?share=greeting",
  "/?share=fortune",
  "/?tab=quiz&ref=u_test",
  "/privacy",
];

for (const t of targets) {
  const res = await worker.fetch(new Request(`https://senior-life-platform.pages.dev${t}`), env);
  const html = await res.text();
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
  const ogTitle = (html.match(/<meta property="og:title" content="([^"]*)"/) || [])[1];
  const ogDesc = (html.match(/<meta property="og:description" content="([^"]*)"/) || [])[1];
  const ogUrl = (html.match(/<meta property="og:url" content="([^"]*)"/) || [])[1];
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1];
  console.log(`\n${t}  [${res.status}] ${res.headers.get("x-neulbom-meta") || "-"}`);
  console.log(`  title     : ${title}`);
  console.log(`  og:title  : ${ogTitle}`);
  console.log(`  og:desc   : ${ogDesc}`);
  console.log(`  og:url    : ${ogUrl}`);
  console.log(`  desc match: ${desc === ogDesc ? "ok" : "MISMATCH"}`);
  console.log(`  html tags : <title>${(html.match(/<title>/g) || []).length} · og:title ${(html.match(/og:title/g) || []).length}`);
}
