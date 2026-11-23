/**
 * 요청 주소 → 카카오톡 미리보기(OG) 정보.
 *
 * 정적 export 된 페이지는 제목·설명이 하나로 고정돼 있어서, 카톡에 링크를 붙이면
 * 어떤 상황이든 늘 같은 미리보기(“늘봄 / 운세 · 치매예방 퀴즈 …”)가 떴다.
 * 여기서 요청의 경로·쿼리(?group=·?tab=·?share=·/family/)를 읽어 상황별 문구를 만들고,
 * 모임 초대 링크면 Supabase 에서 모임 이름까지 찾아 넣는다.
 */
import { sbRequest, type DbEnv } from "../lib/db";
import {
  groupCodeFromParams,
  shareMetaFor,
  shareSituationFor,
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

/** 지금 요청에 내려보낼 OG 제목·설명 */
export async function shareMetaForRequest(env: Env, url: URL): Promise<ShareMeta> {
  const situation = shareSituationFor(url.pathname, url.searchParams);
  const groupCode = groupCodeFromParams(url.searchParams);
  const groupName = situation === "invite" && groupCode ? await groupNameFor(env, groupCode) : "";
  return shareMetaFor(situation, { groupCode, groupName });
}
