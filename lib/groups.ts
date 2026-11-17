"use client";

import type { GroupsPayload } from "./types";

/** 한 모임에 들어갈 수 있는 최대 인원 — 서버(functions/api/groups.ts)와 같은 값 */
export const GROUP_MAX_MEMBERS = 100;
export const GROUP_FULL_MESSAGE = `이 모임은 정원(${GROUP_MAX_MEMBERS}명)이 다 찼어요. 새 모임을 만들거나 다른 모임에 들어가 주세요.`;

/** 친구가 보낸 초대 링크(?group=XXXXXX)를 기억해 두는 키 */
const INVITE_KEY = "seniorLife.pendingGroup";
/** 친구가 보낸 초대 링크의 ?ref=<초대한 사람 id> 를 기억해 두는 키 */
const REF_KEY = "seniorLife.inviteRef";
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
  action: "create" | "join" | "select" | "leave" | "post" | "cheer" | "ping" | "update";
  code: string;
  groupId?: string | null;
  name?: string;
  description?: string;
  /** 모임 수정 — 지역(‘옥천군’ 처럼 짧게) */
  region?: string;
  content?: string;
  postId?: string;
  me?: MeStatsInput;
};

/** 접속 알림(ping) 응답 — 지금 몇 명이 함께 보고 있는지 */
export type PresencePing = {
  groupId: string;
  onlineCount: number;
  memberCount: number;
  onlineCodes: string[];
};

export function siteOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || "https://senior-life-platform.pages.dev";
}

/** 모임 초대 링크 — 받은 사람은 로그인·초기 설정 직후 자동으로 모임에 들어온다 */
export function inviteLinkFor(groupId: string, ref?: string): string {
  const base = `${siteOrigin()}/?group=${encodeURIComponent(groupId)}`;
  return withInviteRef(base, ref);
}

/**
 * 초대 링크에 `ref=<내 id>` 를 붙인다 — 이 링크로 새로 가입한 사람이 몇 명인지 세어
 * 랭킹의 ‘초대왕’ 순위가 만들어진다.
 */
export function withInviteRef(url: string, ref?: string): string {
  if (!url || !ref) return url;
  try {
    const u = new URL(url, siteOrigin());
    u.searchParams.set("ref", ref);
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * 주소창의 ?group=XXXXXX · ?ref=내친구id 를 읽어 보관하고, 주소에서는 지운다.
 * (카카오 로그인 콜백의 ?code= 는 그대로 두어야 로그인이 이어진다)
 */
export function captureInviteFromUrl() {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const rawGroup = (url.searchParams.get("group") || "").trim().toUpperCase();
    const rawRef = (url.searchParams.get("ref") || "").trim();
    let changed = false;

    if (/^[A-Z0-9]{6}$/.test(rawGroup)) {
      window.localStorage.setItem(INVITE_KEY, rawGroup);
      url.searchParams.delete("group");
      changed = true;
    }
    if (rawRef) {
      // 내부 id(u_xxx · kakao_xxx)만 받는다 — 이상한 값은 무시
      if (/^[A-Za-z0-9_:-]{3,64}$/.test(rawRef)) window.localStorage.setItem(REF_KEY, rawRef);
      url.searchParams.delete("ref");
      changed = true;
    }
    if (!changed) return;
    const qs = url.searchParams.toString();
    window.history.replaceState({}, "", `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`);
  } catch {
    /* 주소를 읽지 못해도 화면은 그대로 */
  }
}

/** 초대 링크로 들어온 사람을 초대한 사람의 id(없으면 null) */
export function peekInviteRef(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = (window.localStorage.getItem(REF_KEY) || "").trim();
    return v || null;
  } catch {
    return null;
  }
}

export function clearInviteRef() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(REF_KEY);
  } catch {
    /* 무시 */
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
export type GroupActionRejection = { ok: false; error?: string; message?: string };

export async function sendGroupAction(
  body: GroupActionBody
): Promise<(GroupsPayload & { ok: true; groupId?: string }) | GroupActionRejection | null> {
  try {
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => null);
    // 서버가 이유를 말해 준 거절(정원 초과 등)은 그대로 화면에 전한다 — 오프라인 저장으로 넘기지 않는다
    if (!res.ok || !j?.ok) {
      if (res.status >= 400 && res.status < 500 && j && (j.message || j.error)) {
        return { ok: false, error: j.error, message: j.message };
      }
      return null;
    }
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

/**
 * "나 지금 보고 있어요" 신호 — 마지막 접속 시각을 서버에 남기고,
 * 지금 함께 접속해 있는 모임원 수를 받아 온다. 실패하면 null(화면은 그대로).
 */
export async function pingGroup(code: string, groupId: string): Promise<PresencePing | null> {
  if (!code || !groupId) return null;
  try {
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "ping", code, groupId }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    if (!j?.ok) return null;
    return {
      groupId: j.groupId || groupId,
      onlineCount: Math.max(1, Number(j.onlineCount) || 1),
      memberCount: Math.max(0, Number(j.memberCount) || 0),
      onlineCodes: Array.isArray(j.onlineCodes) ? j.onlineCodes.filter((x: unknown) => typeof x === "string") : [],
    };
  } catch {
    return null;
  }
}

/** 몇 분 전에 쓴 글인지 (게시판 표시용) */export function timeAgo(iso: string): string {
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
