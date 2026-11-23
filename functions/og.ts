/**
 * 요청 주소 → 카카오톡 미리보기(OG) 정보.
 *
 * 정적 export 된 페이지는 제목·설명이 하나로 고정돼 있어서, 카톡에 링크를 붙이면
 * 어떤 상황이든 늘 같은 미리보기(“늘봄 / 운세 · 치매예방 퀴즈 …”)가 떴다.
 * 여기서 요청의 경로·쿼리(?group=·?tab=·?share=·/family/)를 읽어 상황별 문구를 만들고,
 * 모임 초대 링크면 Supabase 에서 모임 이름까지 찾아 넣는다.
 */
import { sbRequest, type DbEnv } from "../lib/db";
import { WELFARE } from "../lib/welfare";
import type { WelfareProgram } from "../lib/types";
import {
  programShareMeta,
  groupCodeFromParams,
  isCardImageKind,
  shareMetaFor,
  shareSituationFor,
  SITE_ORIGIN,
  type ShareMeta,
} from "../lib/og";

type Env = Record<string, unknown>;

/** 모임 이름 조회 결과를 잠깐 기억한다(같은 초대 링크를 여러 명이 열 때 Supabase 를 반복 호출하지 않게) */
const NAME_TTL_MS = 5 * 60 * 1000;
const nameCache = new Map<string, { name: string; at: number }>();

/** Supabase 모임 표에서 이름만 읽는다. 실패·지연이면 빈 문자열(초대 전용 문구로 나간다) */
export async function groupNameFor(env: Env, code: string): Promise<string> {
  const key = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(key)) return "";

  const hit = nameCache.get(key);
  if (hit && Date.now() - hit.at < NAME_TTL_MS) return hit.name;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await sbRequest(
      env as unknown as DbEnv,
      `groups?id=eq.${encodeURIComponent(key)}&select=name&limit=1`,
      { signal: controller.signal }
    ).finally(() => clearTimeout(timer));
    if (!res.ok) return "";
    const rows = (await res.json()) as { name?: string }[];
    const name = String(rows?.[0]?.name ?? "").trim();
    if (name) nameCache.set(key, { name, at: Date.now() });
    return name;
  } catch {
    // 못 찾아도 초대 링크는 그대로 열린다 — 이름 없는 초대 문구를 쓴다.
    return "";
  }
}

/**
 * 링크에 붙은 `?card=<종류>&h=<해시>` → 업로드해 둔 그 카드의 이미지 주소.
 * 값이 없거나 형식이 틀리면 빈 문자열(호출한 쪽이 상황별 기본 카드를 쓴다).
 */
export function cardImageUrlFromParams(url: URL): string {
  const kind = (url.searchParams.get("card") || "").toLowerCase();
  const hash = (url.searchParams.get("h") || "").toLowerCase();
  if (!isCardImageKind(kind) || !/^[a-f0-9]{8,64}$/.test(hash)) return "";
  return `${SITE_ORIGIN}/api/share-image?k=${kind}&h=${hash}`;
}

/**
 * `?tab=welfare&program=<id>` → 그 혜택. 링크를 카톡에 붙였을 때
 * “늘봄 오늘의 복지 혜택”이 아니라 그 혜택의 이름·금액·문의가 미리보기에 뜽다.
 */
export function welfareProgramFromParams(url: URL): WelfareProgram | null {
  const id = (url.searchParams.get("program") || "").trim();
  if (!id) return null;
  return WELFARE.find((p) => p.id === id) ?? null;
}

/** 지금 요청에 내려보낼 OG 제목·설명 */
export async function shareMetaForRequest(env: Env, url: URL): Promise<ShareMeta> {
  const situation = shareSituationFor(url.pathname, url.searchParams);

  // 혜택 하나를 가리키는 링크면 그 혜택 문구·카드를 쓴다.
  if (situation === "welfare") {
    const program = welfareProgramFromParams(url);
    if (program) return programShareMeta(program);
  }

  const groupCode = groupCodeFromParams(url.searchParams);
  const groupName = situation === "invite" && groupCode ? await groupNameFor(env, groupCode) : "";
  return shareMetaFor(situation, { groupCode, groupName });
}
