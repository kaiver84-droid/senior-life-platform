/**
 * 로컬 검증용 /api/state 서버 — 배포된 Pages Functions 대신 같은 핸들러를 Node 로 돌린다.
 * Supabase 는 실제 프로젝트(.env.integrations)를 그대로 쓴다.
 *
 * 빌드: npx esbuild e2e/local-api.ts --bundle --format=esm --platform=node --outfile=e2e/.local-api.mjs
 * 실행: node e2e/.local-api.mjs   (PORT=8098)
 */
import http from "node:http";
import { onRequestGet, onRequestPost } from "../functions/api/state";
import { onRequestGet as rankingsGet } from "../functions/api/rankings";

const env = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

const PORT = Number(process.env.PORT || 8098);

const server = http.createServer(async (req, res) => {
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const url = `http://127.0.0.1:${PORT}${req.url || "/"}`;
    const request = new Request(url, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
    });
    const ctx = { request, env };
    const path = new URL(url).pathname;
    const response =
      path.startsWith("/api/rankings") && req.method === "GET"
        ? await rankingsGet(ctx as never)
        : req.method === "POST"
          ? await onRequestPost(ctx as never)
          : await onRequestGet(ctx as never);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: String(e).slice(0, 300) }));
  }
});

server.listen(PORT, "127.0.0.1", () => console.log(`local state api on http://127.0.0.1:${PORT}`));
