/**
 * ‘내가 만든 카드’(안부 인사카드·퀴즈 상장)를 카카오톡 피드 이미지로 쓰기 위한 임시 저장소.
 *
 * 카카오 피드의 imageUrl 은 **카카오 서버가 직접 내려받는 공개 HTTPS 주소**여야 한다.
 * 캔버스로 그린 카드는 브라우저 안에만 있으므로, 화면이 뜰 때(문구를 고칠 때) 미리 올려 두고
 * [카톡으로 보내기]를 누르는 순간에는 이미 받아 둔 주소를 동기로 넘긴다(await 없음).
 *
 *   POST /api/share-image   { k: "greeting", d: "data:image/png;base64,…" }
 *        → { ok: true, url: "/api/share-image?k=greeting&h=…", abs, hash }
 *   GET  /api/share-image?k=greeting&h=…   → image/png (없으면 그 상황의 기본 카드로 302)
 *
 * 저장은 Supabase Storage 공개 버킷 `share-cards`(cards/<종류>-<해시>.png).
 * - 파일 이름이 내용 해시라 같은 카드를 다시 올리면 덮어쓰기(중복 없음).
 * - 7일이 지난 파일은 가끔(올릴 때 15% 확률) 정리한다 — 임시 이미지라 오래 둘 이유가 없다.
 * - 공개 버킷이지만 올리기·지우기는 서버(서비스 키)만 한다. 브라우저는 이 API 로만 올린다.
 */

type Env = Record<string, unknown>;

const BUCKET = "share-cards";
const PREFIX = "cards/";
const MAX_BYTES = 1_500_000; // 카카오가 받아 가기 좋은 선 (1200×630 PNG 는 보통 150~400KB)
const KEEP_DAYS = 7;
const KINDS = ["greeting", "quiz", "welfare", "group", "family", "fortune", "memory"] as const;
type Kind = (typeof KINDS)[number];

const DEFAULT_CARD: Record<Kind, string> = {
  greeting: "/images/share-greeting.png",
  quiz: "/images/share-quiz.png",
  welfare: "/images/share-welfare.png",
  group: "/images/share-group.png",
  family: "/images/share-family.png",
  fortune: "/images/share-fortune.png",
  memory: "/share-card.png",
};

function siteOrigin(request: Request): string {
  try {
    return new URL(request.url).origin;
  } catch {
    return "https://senior-life-platform.pages.dev";
  }
}

function supabase(env: Env): { url: string; key: string } | null {
  const url = String(env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
  if (!url || !key) return null;
  return { url, key };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}

function cleanKind(raw: string | null): Kind | null {
  const k = (raw || "").toLowerCase().trim();
  return (KINDS as readonly string[]).includes(k) ? (k as Kind) : null;
}

/** PNG/JPEG 인지 — 앞 몇 바이트만 본다 */
function imageTypeOf(bytes: Uint8Array): string {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return "";
}

function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function shortHash(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return toHex(digest).slice(0, 24);
}

/* ------------------------------------------------------------------ */
/* POST — 카드 PNG 올리기                                              */
/* ------------------------------------------------------------------ */

export async function onRequestPost(ctx: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = ctx;
  const store = supabase(env);
  if (!store) return json({ ok: false, error: "storage_not_configured" }, 503);

  let payload: { k?: string; d?: string };
  try {
    payload = (await request.json()) as { k?: string; d?: string };
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }

  const kind = cleanKind(payload.k || null);
  if (!kind) return json({ ok: false, error: "bad_kind" }, 400);

  const data = String(payload.d || "");
  const m = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=\s]+)$/.exec(data);
  if (!m) return json({ ok: false, error: "bad_image" }, 400);

  const bytes = base64ToBytes(m[2].replace(/\s+/g, ""));
  if (bytes.length < 200) return json({ ok: false, error: "too_small" }, 400);
  if (bytes.length > MAX_BYTES) return json({ ok: false, error: "too_large", limit: MAX_BYTES }, 413);
  const type = imageTypeOf(bytes);
  if (!type) return json({ ok: false, error: "not_image" }, 400);

  const hash = await shortHash(bytes);
  const path = `${PREFIX}${kind}-${hash}.png`;

  try {
    const res = await fetch(`${store.url}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: {
        apikey: store.key,
        authorization: `Bearer ${store.key}`,
        "content-type": type,
        "cache-control": `public, max-age=${KEEP_DAYS * 24 * 60 * 60}`,
        "x-upsert": "true",
      },
      body: bytes,
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      return json({ ok: false, error: "upload_failed", status: res.status, detail }, 502);
    }
  } catch (e) {
    return json({ ok: false, error: "upload_error", detail: String(e).slice(0, 200) }, 502);
  }

  // 가끔 오래된 임시 카드를 정리한다(응답을 막지 않게 실패는 무시).
  if (Math.random() < 0.15) {
    try {
      await pruneOld(store, fetch);
    } catch {
      /* 정리는 다음 기회에 */
    }
  }

  const origin = siteOrigin(request);
  return json({
    ok: true,
    kind,
    hash,
    url: `${origin}/api/share-image?k=${kind}&h=${hash}`,
    abs: `${origin}/api/share-image?k=${kind}&h=${hash}`,
    bytes: bytes.length,
  });
}

/* ------------------------------------------------------------------ */
/* GET — 카카오 서버가 그대로 받아 가는 이미지                          */
/* ------------------------------------------------------------------ */

export async function onRequestGet(ctx: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const kind = cleanKind(url.searchParams.get("k"));
  const hash = (url.searchParams.get("h") || "").toLowerCase();

  // 잘못된 주소·없는 카드면 그 상황의 기본 카드로 보낸다(카톡에 빈 칸이 뜨지 않게).
  const fallback = new Response(null, {
    status: 302,
    headers: { location: `${siteOrigin(request)}${kind ? DEFAULT_CARD[kind] : "/share-card.png"}`, "cache-control": "no-store" },
  });
  if (!kind || !/^[a-f0-9]{8,64}$/.test(hash)) return fallback;

  const store = supabase(env);
  if (!store) return fallback;

  const path = `${PREFIX}${kind}-${hash}.png`;
  try {
    const res = await fetch(`${store.url}/storage/v1/object/public/${BUCKET}/${path}`, {
      headers: { apikey: store.key },
    });
    if (!res.ok || !res.body) return fallback;
    return new Response(res.body, {
      status: 200,
      headers: {
        "content-type": res.headers.get("content-type") || "image/png",
        // 내용이 해시로 고정된 주소라 오래 캐시해도 된다(카카오·브라우저 모두).
        "cache-control": "public, max-age=604800, immutable",
        "x-neulbom-card": `${kind}:${hash}`,
        "access-control-allow-origin": "*",
      },
    });
  } catch {
    return fallback;
  }
}

/* ------------------------------------------------------------------ */
/* 오래된 임시 파일 정리                                               */
/* ------------------------------------------------------------------ */

type StorageRow = { name?: string; created_at?: string; updated_at?: string };

async function pruneOld(store: { url: string; key: string }, _fetch: typeof fetch): Promise<number> {
  const listRes = await fetch(`${store.url}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: {
      apikey: store.key,
      authorization: `Bearer ${store.key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ prefix: PREFIX, limit: 100, offset: 0, sortBy: { column: "created_at", order: "asc" } }),
  });
  if (!listRes.ok) return 0;
  const rows = (await listRes.json()) as StorageRow[];
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  const stale = rows
    .filter((r) => {
      const at = Date.parse(r.created_at || r.updated_at || "");
      return Boolean(r.name) && Number.isFinite(at) && at < cutoff;
    })
    .map((r) => `${PREFIX}${r.name}`);
  if (!stale.length) return 0;

  const delRes = await fetch(`${store.url}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: {
      apikey: store.key,
      authorization: `Bearer ${store.key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ prefixes: stale }),
  });
  return delRes.ok ? stale.length : 0;
}
