/**
 * Cloudflare Pages Functions 진입점 (Advanced mode: `_worker.js`).
 * 정적 파일은 env.ASSETS 로 넘기고, /api/* 만 아래 핸들러가 처리합니다.
 * wrangler 없이 REST API 로 배포할 때 이 파일을 번들해 out/_worker.js 로 올립니다.
 */
import { onRequestGet as healthGet } from "./functions/api/health";
import { onRequestGet as statsGet } from "./functions/api/stats";
import { onRequestGet as rankingsGet } from "./functions/api/rankings";
import { onRequestGet as groupsGet, onRequestPost as groupsPost } from "./functions/api/groups";
import { onRequestGet as stateGet, onRequestPost as statePost } from "./functions/api/state";
import { onRequestGet as localNewsGet } from "./functions/api/local-news";
import { onRequestGet as weatherGet } from "./functions/api/weather";
import { onRequestGet as kakaoGet, onRequestPost as kakaoPost } from "./functions/api/auth/kakao";
import { onRequestGet as duelsGet, onRequestPost as duelsPost } from "./functions/api/duels";

type Env = Record<string, unknown> & { ASSETS?: { fetch: (r: Request) => Promise<Response> } };
type Ctx = { request: Request; env: any };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const ctx: Ctx = { request, env };

    try {
      if (path === "/api/health") return await healthGet(ctx);
      if (path === "/api/stats") return await statsGet(ctx);
      if (path === "/api/local-news") return await localNewsGet(ctx);
      if (path === "/api/weather") return await weatherGet(ctx);
      if (path === "/api/rankings") return await rankingsGet(ctx);
      if (path === "/api/groups") {
        return request.method === "POST" ? await groupsPost(ctx) : await groupsGet(ctx);
      }
      if (path === "/api/state") {
        return request.method === "POST" ? await statePost(ctx) : await stateGet(ctx);
      }
      if (path === "/api/duels") {
        return request.method === "POST" ? await duelsPost(ctx) : await duelsGet(ctx);
      }
      if (path === "/api/auth/kakao") {
        return request.method === "POST" ? await kakaoPost(ctx) : await kakaoGet(ctx);
      }
      if (path.startsWith("/api/")) {
        return new Response(JSON.stringify({ ok: false, error: "not_found" }), {
          status: 404,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: String(e).slice(0, 200) }), {
        status: 500,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    // 정적 파일은 Pages 의 ASSETS 바인딩으로 넘긴다.
    try {
      const assets = (env as any)?.ASSETS;
      if (assets && typeof assets.fetch === "function") return await assets.fetch(request);
    } catch {
      /* 아래 404 로 폴백 */
    }
    return new Response("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};
