"use client";

import type { GroupsPayload } from "./types";

/** 친구가 보낸 초대 링크(?group=XXXXXX)를 기억해 두는 키 */
const INVITE_KEY = "seniorLife.pendingGroup";
/** 마지막으로 보던 모임 */
export const ACTIVE_GROUP_KEY = "seniorLife.activeGroup";

export type MeStatsInput = {
  name?: string;
  points?: number;
  days?: number;
  today?: boolean;
  /** 오늘 이 기기에서 찍은 건강 챌린지 id — 서버 저장 전에도 모임 달성률에 바로 반영한다 */
  health?: string[];
};

export type GroupActionBody = {
  action: "create" | "join" | "select" | "leave" | "post" | "cheer";
  code: string;
  groupId?: string | null;
  name?: string;
  description?: string;
  content?: string;
  postId?: string;
  me?: MeStatsInput;
};

export function siteOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || "https://senior-life-platform.pages.dev";
}

/** 모임 초대 링크 — 받은 사람은 로그인·초기 설정 직후 자동으로 모임에 들어온다 */
export function inviteLinkFor(groupId: string): string {
  return `${siteOrigin()}/?group=${encodeURIComponent(groupId)}`;
}

/**
 * 주소창의 ?group=XXXXXX 를 읽어 보관하고, 주소에서는 지운다.
 * (카카오 로그인 콜백의 ?code= 는 그대로 두어야 로그인이 이어진다)
 */
export function captureInviteFromUrl() {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const raw = (url.searchParams.get("group") || "").trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(raw)) return;
    window.localStorage.setItem(INVITE_KEY, raw);
    url.searchParams.delete("group");
    const qs = url.searchParams.toString();
    window.history.replaceState({}, "", `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`);
  } catch {
    /* 주소를 읽지 못해도 화면은 그대로 */
  }
}

export function peekPendingInvite(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = (window.localStorage.getItem(INVITE_KEY) || "").trim().toUpperCase();
    return /^[A-Z0-9]{6}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

export function clearPendingInvite() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(INVITE_KEY);
  } catch {
    /* 무시 */
  }
}

export function rememberActiveGroup(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(ACTIVE_GROUP_KEY, id);
    else window.localStorage.removeItem(ACTIVE_GROUP_KEY);
  } catch {
    /* 무시 */
  }
}

export function rememberedActiveGroup(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_GROUP_KEY);
  } catch {
    return null;
  }
}

/** 서버(/api/groups)에서 내 모임 목록 + 보고 있는 모임 상세를 받는다. 실패하면 null */
export async function fetchGroups(params: {
  code: string;
  groupId?: string | null;
  me?: MeStatsInput;
}): Promise<GroupsPayload | null> {
  const q = new URLSearchParams({ code: params.code });
  if (params.groupId) q.set("group", params.groupId);
  if (params.me?.name) q.set("meName", params.me.name);
  q.set("mePoints", String(Math.max(0, Math.round(params.me?.points ?? 0))));
  q.set("meDays", String(Math.max(0, Math.round(params.me?.days ?? 0))));
  if (params.me?.today) q.set("meToday", "1");
  const health = (params.me?.health ?? []).filter((x) => typeof x === "string" && x);
  if (health.length) q.set("meHealth", health.join(","));
  try {
    const res = await fetch(`/api/groups?${q.toString()}`, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const j = await res.json();
    if (!j?.ok || !Array.isArray(j.groups)) return null;
    return {
      groups: j.groups,
      activeGroupId: j.activeGroupId ?? null,
      detail: j.detail ?? null,
    };
  } catch {
    return null;
  }
}

/** 모임 만들기·가입·글쓰기 같은 동작. 성공하면 갱신된 목록·상세를 돌려준다 */
export async function sendGroupAction(
  body: GroupActionBody
): Promise<(GroupsPayload & { ok: boolean; groupId?: string }) | null> {
  try {
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const j = await res.json();
    if (!j?.ok) return null;
    return {
      ok: true,
      groupId: j.groupId,
      groups: Array.isArray(j.groups) ? j.groups : [],
      activeGroupId: j.activeGroupId ?? null,
      detail: j.detail ?? null,
    };
  } catch {
    return null;
  }
}

/** 몇 분 전에 쓴 글인지 (게시판 표시용) */
export function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  if (diff < 60_000) return "방금";
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}일 전`;
  const d = new Date(t);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
