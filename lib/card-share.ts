"use client";

/**
 * 내가 만든 카드(안부 인사카드·퀴즈 상장)를 **카카오톡 피드 이미지 주소**로 미리 준비해 둔다.
 *
 * 왜 미리 올리나
 * - 카카오 피드의 imageUrl 은 카카오 서버가 내려받는 공개 주소여야 한다(캔버스 그림은 그럴 수 없다).
 * - [카카오톡으로 바로 보내기]는 iOS 사파리에서 **클릭과 같은 콜스택에서 동기로** 불러야 앱이 열린다.
 *   그래서 클릭할 때 올리면(await) 카톡이 열리지 않는다.
 * - 그래서 카드가 그려지는 순간(문구를 고치면 350ms 뒤) 조용히 올려 두고,
 *   클릭 순간에는 이미 받아 둔 주소를 곧바로 넘긴다. 아직이면 그 상황의 기본 카드로 보낸다.
 *
 * 올린 주소: /api/share-image?k=<종류>&h=<해시> (functions/api/share-image.ts)
 */

import { renderFramedShareCard, type ShareCardInput } from "./canvas";
import { shareImageUrlFor, type CardImageKind, type ShareSituation } from "./og";

const DEBOUNCE_MS = 350;
const TTL_MS = 6 * 60 * 60 * 1000; // 서버에는 7일 두지만, 화면은 이 시간이 지나면 새로 올린다
const MAX_BYTES = 1_400_000;

type Prepared = { url: string; hash: string; sig: string; at: number };

const prepared = new Map<string, Prepared>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const inflight = new Map<string, Promise<Prepared | null>>();

/** 캔버스 내용이 바뀌었는지 싸게 알아보는 지문 — 작게 줄여 그린 픽셀 몇 개를 더한다 */
function signatureOf(canvas: HTMLCanvasElement): string {
  try {
    const w = 32;
    const h = 17;
    const small = document.createElement("canvas");
    small.width = w;
    small.height = h;
    const ctx = small.getContext("2d", { willReadFrequently: true });
    if (!ctx) return "";
    ctx.drawImage(canvas, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum = (sum * 31 + data[i] + data[i + 1] * 3 + data[i + 2] * 7 + data[i + 3]) % 2147483647;
    }
    return `${w}x${h}:${sum}:${data.length}`;
  } catch {
    return "";
  }
}

/** 이미 올려 둔 그 카드(없거나 오래됐으면 null) */
export function preparedCard(kind: CardImageKind): { url: string; hash: string } | null {
  const hit = prepared.get(kind);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    prepared.delete(kind);
    return null;
  }
  return { url: hit.url, hash: hit.hash };
}

/**
 * 공유에 쓸 이미지 주소 — **동기로** 곧바로 돌려준다(클릭 콜스택에서 그대로 사용).
 * 올려 둔 내 카드가 있으면 그 카드, 아니면 그 상황의 기본 카드.
 */
export function cardImageFor(kind: CardImageKind, situation: ShareSituation): string {
  return preparedCard(kind)?.url || shareImageUrlFor(situation);
}

/** 링크에 붙일 값(?card=<종류>&h=<해시>) — 링크를 그대로 붙여 넣어도 같은 카드가 뜨게 */
export function preparedCardLink(kind: CardImageKind): { kind: CardImageKind; hash: string } | null {
  const hit = preparedCard(kind);
  return hit ? { kind, hash: hit.hash } : null;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function canvasToPngDataUrl(canvas: HTMLCanvasElement): Promise<string> {
  const toBlob = (type: string, quality?: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

  const png = await toBlob("image/png");
  if (png && png.size > 0 && png.size <= MAX_BYTES) return blobToDataUrl(png);
  // 아주 무거운 카드는 JPEG 로 낮춰 올린다(카카오는 둘 다 받는다).
  const jpg = await toBlob("image/jpeg", 0.86);
  if (jpg && jpg.size > 0 && jpg.size <= MAX_BYTES) return blobToDataUrl(jpg);
  return png ? blobToDataUrl(png) : "";
}

async function upload(canvas: HTMLCanvasElement, kind: CardImageKind, sig: string): Promise<Prepared | null> {
  try {
    const dataUrl = await canvasToPngDataUrl(canvas);
    if (!dataUrl) return null;
    const res = await fetch("/api/share-image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ k: kind, d: dataUrl }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const out = (await res.json()) as { ok?: boolean; url?: string; hash?: string };
    if (!out.ok || !out.url || !out.hash) return null;
    const entry: Prepared = { url: out.url, hash: out.hash, sig, at: Date.now() };
    prepared.set(kind, entry);
    return entry;
  } catch {
    return null; // 실패해도 공유는 기본 카드로 계속된다.
  }
}

/**
 * 카드가 그려진 뒤(문구가 바뀐 뒤) 조용히 올려 둔다. 같은 내용이면 다시 올리지 않는다.
 * 연속으로 그려지면 마지막 것만 올린다(디바운스 350ms).
 */
export function scheduleCardUpload(canvas: HTMLCanvasElement | null, kind: CardImageKind, delayMs = DEBOUNCE_MS): void {
  if (!canvas || !canvas.width || !canvas.height) return;
  const sig = signatureOf(canvas);
  const hit = prepared.get(kind);
  if (hit && sig && hit.sig === sig && Date.now() - hit.at <= TTL_MS) return;

  const prev = timers.get(kind);
  if (prev) clearTimeout(prev);
  // 올리는 동안에는 그 종류의 예전 카드를 쓰지 않는다(다른 문구의 카드가 나가면 안 되니까).
  prepared.delete(kind);

  const timer = setTimeout(() => {
    timers.delete(kind);
    const existing = inflight.get(kind);
    if (existing) return; // 같은 종류를 이미 올리는 중 — 끝나면 그 주소를 쓴다
    const job = upload(canvas, kind, sig).finally(() => inflight.delete(kind));
    inflight.set(kind, job);
  }, delayMs);
  timers.set(kind, timer);
}

/** 이미 그려 둔 카드(1200×630 이 아닌 인사카드·상장)를 피드 카드로 감싸서 올려 둔다 */
export function scheduleFramedCardUpload(
  srcCanvas: HTMLCanvasElement | null,
  card: ShareCardInput,
  kind: CardImageKind
): void {
  if (!srcCanvas || !srcCanvas.width) return;
  const framed = document.createElement("canvas");
  void renderFramedShareCard(framed, card, srcCanvas)
    .then(() => scheduleCardUpload(framed, kind))
    .catch(() => {});
}

/** 화면을 떠날 때 남은 예약을 정리한다 */
export function cancelCardUpload(kind: CardImageKind): void {
  const timer = timers.get(kind);
  if (timer) clearTimeout(timer);
  timers.delete(kind);
}
