"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "./storage";
import { useToast } from "@/components/ui";
import {
  captureInviteFromUrl,
  clearPendingInvite,
  fetchGroups,
  inviteLinkFor,
  peekPendingInvite,
  rememberActiveGroup,
  rememberedActiveGroup,
  sendGroupAction,
  type GroupActionBody,
  type MeStatsInput,
} from "./groups";
import { localAction, localPayload } from "./group-local";
import { kstDate, weekRange } from "./week";
import type { GroupDetail, GroupSummary, GroupsPayload } from "./types";

type ActionResult = { ok: boolean; message: string; id?: string };

type GroupCtx = {
  ready: boolean;
  online: boolean;
  groups: GroupSummary[];
  detail: GroupDetail | null;
  activeId: string | null;
  active: GroupSummary | null;
  me: MeStatsInput;
  todayDone: boolean;
  select: (id: string) => Promise<void>;
  create: (name: string, description?: string) => Promise<ActionResult>;
  join: (groupId: string) => Promise<ActionResult>;
  leave: () => Promise<void>;
  addPost: (content: string) => Promise<ActionResult>;
  cheer: (postId: string) => Promise<void>;
  inviteLink: (id?: string) => string;
  reload: () => void;
};

const Ctx = createContext<GroupCtx | null>(null);

export function GroupProvider({ children }: { children: React.ReactNode }) {
  const { ready: appReady, profile, state, code, todayDaily, weekPoints } = useApp();
  const { show } = useToast();

  const [payload, setPayload] = useState<GroupsPayload | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(false);

  const activeRef = useRef<string | null>(null);
  const meRef = useRef<MeStatsInput>({});
  const pendingRef = useRef<string | null>(null);
  const autoJoinRef = useRef(false);
  /** 늦게 도착한 옛 응답이 새 상태를 덮어쓰지 않도록 요청 순번을 센다 */
  const reqSeq = useRef(0);

  /* 내 이번 주 참여 일수 · 오늘 참여 여부 (기기 기록 기준) */
  const me = useMemo<MeStatsInput>(() => {
    const today = kstDate();
    const { start, end } = weekRange(today);
    const days = new Set<string>();
    state.quizLogs.forEach((q) => {
      if (q.date >= start && q.date <= end) days.add(q.date);
    });
    Object.entries(state.med).forEach(([d, m]) => {
      if ((m.morning || m.evening) && d >= start && d <= end) days.add(d);
    });
    state.visits.forEach((d) => {
      if (d >= start && d <= end) days.add(d);
    });
    const todayDone = Boolean(todayDaily?.done) || days.has(today);
    return {
      name: profile?.nickname,
      points: weekPoints,
      days: days.size,
      today: todayDone,
    };
  }, [state.quizLogs, state.med, state.visits, todayDaily?.done, weekPoints, profile?.nickname]);
  meRef.current = me;

  const apply = useCallback((p: GroupsPayload) => {
    setPayload(p);
    const id = p.detail?.id ?? p.activeGroupId ?? null;
    activeRef.current = id;
    setActiveId(id);
    rememberActiveGroup(id);
  }, []);

  const refresh = useCallback(
    async (gid?: string | null) => {
      if (!code) return;
      const want = gid !== undefined ? gid : activeRef.current;
      const seq = ++reqSeq.current;
      setLoading(true);
      try {
        const remote = await fetchGroups({ code, groupId: want, me: meRef.current });
        if (seq !== reqSeq.current) return; // 그사이 새 요청이 있었다 — 이 응답은 버린다
        setOnline(Boolean(remote));
        apply(remote ?? localPayload(code, { groupId: want, me: meRef.current }));
      } finally {
        if (seq === reqSeq.current) setLoading(false);
      }
    },
    [code, apply]
  );

  /* 첫 진입: 초대 링크 확인 + 마지막으로 보던 모임 기억 */
  useEffect(() => {
    captureInviteFromUrl();
    pendingRef.current = peekPendingInvite();
    activeRef.current = rememberedActiveGroup();
  }, []);

  /* 로그인·초기설정이 끝나면 모임을 불러온다. 퀴즈를 풀어 내 기록이 바뀌면 다시 계산한다. */
  useEffect(() => {
    if (!appReady || !code) return;
    const t = setTimeout(() => {
      void refresh();
    }, 250);
    return () => clearTimeout(t);
  }, [appReady, code, me.name, me.points, me.days, me.today, refresh]);

  const runAction = useCallback(
    async (body: Omit<GroupActionBody, "code" | "me">): Promise<ActionResult & { groupId?: string }> => {
      if (!code) return { ok: false, message: "로그인 정보를 찾지 못했어요." };
      const full: GroupActionBody = { ...body, code, me: meRef.current };
      const seq = ++reqSeq.current;
      const remote = await sendGroupAction(full);
      if (seq !== reqSeq.current) return { ok: true, message: "" };
      if (remote?.ok) {
        setOnline(true);
        apply({ groups: remote.groups, activeGroupId: remote.activeGroupId, detail: remote.detail });
        return { ok: true, message: "", id: remote.groupId, groupId: remote.groupId };
      }
      setOnline(false);
      const local = localAction(full);
      apply(local);
      return { ok: true, message: "", id: local.groupId, groupId: local.groupId };
    },
    [code, apply]
  );

  const select = useCallback(
    async (id: string) => {
      activeRef.current = id;
      setActiveId(id);
      rememberActiveGroup(id);
      await runAction({ action: "select", groupId: id });
    },
    [runAction]
  );

  const create = useCallback(
    async (name: string, description?: string): Promise<ActionResult> => {
      const clean = name.trim().slice(0, 20);
      if (clean.length < 2) return { ok: false, message: "모임 이름을 두 글자 이상 적어 주세요." };
      const r = await runAction({ action: "create", name: clean, description });
      if (!r.ok) return r;
      return { ok: true, message: `‘${clean}’ 모임을 만들었어요. 카카오톡으로 초대해 보세요!`, id: r.id };
    },
    [runAction]
  );

  const join = useCallback(
    async (groupId: string): Promise<ActionResult> => {
      const r = await runAction({ action: "join", groupId, name: meRef.current.name });
      if (!r.ok) return r;
      return { ok: true, message: "모임에 들어왔어요!" };
    },
    [runAction]
  );

  const leave = useCallback(async () => {
    if (!activeRef.current) return;
    await runAction({ action: "leave", groupId: activeRef.current });
  }, [runAction]);

  const addPost = useCallback(
    async (content: string): Promise<ActionResult> => {
      const clean = content.trim().slice(0, 80);
      if (!clean) return { ok: false, message: "남길 말을 적어 주세요." };
      if (!activeRef.current) return { ok: false, message: "먼저 모임에 들어와 주세요." };
      const r = await runAction({ action: "post", groupId: activeRef.current, content: clean });
      return r.ok ? { ok: true, message: "모임 게시판에 남겼어요." } : r;
    },
    [runAction]
  );

  const cheer = useCallback(
    async (postId: string) => {
      if (!activeRef.current) return;
      await runAction({ action: "cheer", groupId: activeRef.current, postId });
    },
    [runAction]
  );

  /* 초대 링크(?group=CODE)로 들어온 사람 — 로그인·초기설정 직후 자동 가입 */
  useEffect(() => {
    if (!appReady || !code || !payload) return;
    const gid = pendingRef.current;
    if (!gid) return;
    if (payload.groups.some((g) => g.id === gid)) {
      pendingRef.current = null;
      clearPendingInvite();
      return;
    }
    if (autoJoinRef.current) return;
    autoJoinRef.current = true;
    pendingRef.current = null;
    clearPendingInvite();
    void join(gid).then((r) => {
      show(r.ok ? "초대받은 모임에 들어왔어요! 🎉" : "초대 링크의 모임을 찾지 못했어요.");
    });
  }, [appReady, code, payload, join, show]);

  const groups = payload?.groups ?? [];
  const detail = payload?.detail ?? null;
  const active = groups.find((g) => g.id === activeId) ?? detail ?? null;

  const value: GroupCtx = {
    ready: Boolean(payload) && !loading,
    online,
    groups,
    detail,
    activeId,
    active: active as GroupSummary | null,
    me,
    todayDone: Boolean(todayDaily?.done),
    select,
    create,
    join,
    leave,
    addPost,
    cheer,
    inviteLink: (id?: string) => inviteLinkFor(id || activeId || ""),
    reload: () => void refresh(),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGroup(): GroupCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGroup must be used inside GroupProvider");
  return ctx;
}

/** 모임을 아직 고르지 않았을 때 화면에서 쓰는 짧은 안내 */
export function groupHint(hasGroup: boolean): string {
  return hasGroup ? "" : "모임을 만들면 가족과 함께 퀴즈 순위를 겨룰 수 있어요.";
}
