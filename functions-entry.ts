/**
 * Cloudflare Pages Functions 진입점 (Advanced mode: `_worker.js`).
 * 정적 파일은 env.ASSETS 로 넘기고, /api/* 만 아래 핸들러가 처리합니다.
 * wrangler 없이 REST API 로 배포할 때 이 파일을 번들해 out/_worker.js 로 올립니다.
 *
 * 한 가지 더 — 화면(/, /family/)을 내려보낼 때는 요청의 경로·쿼리(?group=·?tab=·?share=)에 맞춰
 * 제목·설명(OG 메타태그)을 바꿔 넣습니다. 카카오톡에 링크를 붙였을 때 늘 같은 미리보기가
 * 뜨던 문제를 여기서 해결합니다(lib/og.ts 가 문구의 단일 출처).
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
import { applyShareMeta, SITE_ORIGIN, type ShareMeta } from "./lib/og";
import { shareMetaForRequest } from "./functions/og";

type Env = Record<string, unknown> & { ASSETS?: { fetch: (r: Request) => Promise<Response> } };
type Ctx = { request: Request; env: any };

/** 화면 HTML 이 있는 경로 — 나머지 정적 파일은 그대로 흘려보낸다 */
type HtmlPage = { asset: string; route: "home" | "family" | "page" };

function htmlAssetFor(path: string): HtmlPage | null {
  if (path === "/" || path === "/index.html") return { asset: "/index.html", route: "home" };
  if (path === "/family" || path === "/family/index.html") return { asset: "/family/index.html", route: "family" };
  // 개인정보처리방침처럼 상황 문구가 따로 없는 페이지는 그 페이지의 제목·설명을 그대로 미리보기에 쓴다.
  if (path === "/privacy" || path === "/privacy/index.html") return { asset: "/privacy/index.html", route: "page" };
  return null;
}

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

    // 화면 HTML — 상황별 제목·설명을 넣어 내려보낸다(실패하면 원본 그대로).
    // Next 의 RSC 데이터 요청(헤더 RSC: 1 · ?_rsc=)은 HTML 이 아니므로 건드리지 않는다.
    const wantsHtml =
      request.method === "GET" && request.headers.get("RSC") !== "1" && !url.searchParams.has("_rsc");
    const htmlAsset = wantsHtml ? htmlAssetFor(path) : null;    if (htmlAsset) {
      const rewritten = await serveHtmlWithMeta(request, env, url, htmlAsset).catch(() => null);
      if (rewritten) return rewritten;
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

async function serveHtmlWithMeta(
  request: Request,
  env: Env,
  url: URL,
  page: HtmlPage
): Promise<Response | null> {
  const assets = (env as any)?.ASSETS;
  if (!assets || typeof assets.fetch !== "function") return null;

  // 조건부 요청(If-None-Match 등)은 떼고 원본 HTML 을 받는다 — 304 로 본문이 비면 바꿔 넣을 수 없다.
  const assetRes = await assets.fetch(
    new Request(new URL(page.asset, url.origin).toString(), {
      method: "GET",
      headers: { accept: "text/html" },
    })
  );
  if (!assetRes.ok) return null;

  const html = await assetRes.text();
  const meta =
    page.route === "page" ? pageMetaFromHtml(html) : await shareMetaForRequest(env, url);
  const body = applyShareMeta(html, meta, {
    url: url.toString(),
    imageUrl: `${SITE_ORIGIN}${meta.image}`,
  });

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // 링크 미리보기는 매번 새로 읽어야 한다(?group=·?tab= 마다 문구가 다르다).
      "cache-control": "public, max-age=0, must-revalidate",
      "x-neulbom-meta": "dynamic",
    },
  });
}

/** 상황 문구가 따로 없는 페이지(/privacy) — 그 페이지의 제목·설명을 미리보기에 그대로 쓴다 */
function pageMetaFromHtml(html: string): ShareMeta {
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1]?.trim() || "늘봄";
  const description =
    (html.match(/<meta name="description" content="([^"]*)"/) || [])[1]?.trim() ||
    "언제나, 늘 곁에 있는 시니어 생활 플랫폼 늘봄";
  return { title, description, buttonTitle: "늘봄 열기", image: "/share-card.png" };
}
