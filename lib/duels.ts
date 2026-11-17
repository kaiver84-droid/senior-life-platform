"use client";

import type { DuelPayload } from "./types";

/**
 * 친구와 1:1 대결 — 대결 링크(?duel=…) 주고받기와 /api/duels 호출.
 *
 * 대결 링크 모양
 *   https://senior-life-platform.pages.dev/?duel=<신청한 사람 코드>&dn=<이름>&k=total
 * 받은 사람은 링크를 열면 ‘수락’ 버튼 한 번으로 오늘의 대결이 시작된다.
 */

const PENDING_KEY = "seniorLife.pendingDuel";

export type PendingDuel = { code: string; name: string; kind: "quiz" | "total" };

function origin(): string {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || "https://senior-life-platform.pages.dev";
}

/** 대결 링크 — 내 코드를 담아 친구에게 보낸다 */
export function duelLinkFor(code: string, name?: string, kind: "quiz" | "total" = "total"): string {
  const q = new URLSearchParams({ duel: code, k: kind });
  if (name) q.set("dn", name);
  return `${origin()}/?${q.toString()}`;
}

/**
 * 주소창의 ?duel=… 를 읽어 보관하고 주소에서는 지운다.
 * (카카오 로그인 콜백의 ?code= 는 그대로 두어야 로그인이 이어진다)
 */
export function captureDuelFromUrl() {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const rawCode = (url.searchParams.get("duel") || "").trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(rawCode)) return;
    const name = (url.searchParams.get("dn") || "").trim().slice(0, 20);
    const kind = url.searchParams.get("k") === "quiz" ? "quiz" : "total";
    window.localStorage.setItem(PENDING_KEY, JSON.stringify({ code: rawCode, name, kind }));
    url.searchParams.delete("duel");
    url.searchParams.delete("dn");
    url.searchParams.delete("k");
    const qs = url.searchParams.toString();
    window.history.replaceState({}, "", `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`);
  } catch {
    /* 주소를 읽지 못해도 화면은 그대로 */
  }
}

export function peekPendingDuel(): PendingDuel | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as PendingDuel;
    if (!v || !/^[A-Z0-9]{6}$/.test(v.code || "")) return null;
    return { code: v.code, name: (v.name || "").slice(0, 20), kind: v.kind === "quiz" ? "quiz" : "total" };
  } catch {
    return null;
  }
}

export function clearPendingDuel() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PENDING_KEY);
  } catch {
    /* 무시 */
  }
}

export async function fetchDuels(code: string, today: string): Promise<DuelPayload | null> {
  if (!code) return null;
  try {
    const q = new URLSearchParams({ code, today });
    const res = await fetch(`/api/duels?${q.toString()}`, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const j = await res.json();
    if (!j?.ok) return null;
    return {
      ok: true,
      today: j.today,
      myCode: j.myCode,
      myName: j.myName,
      duels: Array.isArray(j.duels) ? j.duels : [],
      incoming: Array.isArray(j.incoming) ? j.incoming : [],
      outgoing: Array.isArray(j.outgoing) ? j.outgoing : [],
      partners: Array.isArray(j.partners) ? j.partners : [],
    };
  } catch {
    return null;
  }
}

export type DuelAction =
  | { action: "create"; code: string; today: string; opponentCode: string; kind: "quiz" | "total" }
  | { action: "link"; code: string; today: string; challengerCode: string; kind: "quiz" | "total" }
  | { action: "accept"; code: string; today: string; id: string }
  | { action: "decline"; code: string; today: string; id: string }
  | { action: "cancel"; code: string; today: string; id: string };

/** 대결 신청·수락·거절·취소 — 처리한 뒤 최신 목록을 돌려준다 */
export async function postDuel(body: DuelAction): Promise<DuelPayload | null> {
  try {
    const res = await fetch("/api/duels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.ok) return null;
    return {
      ok: true,
      today: j.today,
      myCode: j.myCode,
      myName: j.myName,
      duels: Array.isArray(j.duels) ? j.duels : [],
      incoming: Array.isArray(j.incoming) ? j.incoming : [],
      outgoing: Array.isArray(j.outgoing) ? j.outgoing : [],
      partners: Array.isArray(j.partners) ? j.partners : [],
    };
  } catch {
    return null;
  }
}

export const DUEL_KIND_LABEL: Record<"quiz" | "total", string> = {
  quiz: "오늘 퀴즈 점수",
  total: "오늘 종합 점수",
};
