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
  pingGroup,
  rememberActiveGroup,
  rememberedActiveGroup,
  sendGroupAction,
  type GroupActionBody,
  type MeStatsInput,
} from "./groups";
import { localAction, localPayload } from "./group-local";
import { healthOf } from "./health";
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
  leave: () => Promise<ActionResult>;
  /** 모임 이름·지역·소개 바꾸기 */
  updateGroup: (patch: { name?: string; region?: string; description?: string }) => Promise<ActionResult>;
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
  /** 응원 요청이 날아가 있는 글 — 연타 방지 */
  const cheerBusy = useRef<Set<string>>(new Set());
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
    Object.entries(state.health ?? {}).forEach(([d, ids]) => {
      if (Array.isArray(ids) && ids.length && d >= start && d <= end) days.add(d);
    });
    const healthToday = healthOf(state.health, today);
    const todayDone = Boolean(todayDaily?.done) || days.has(today) || healthToday.length > 0;
    return {
      name: profile?.nickname,
      points: weekPoints,
      days: days.size,
      today: todayDone,
      health: healthToday,
    };
  }, [
    state.quizLogs,
    state.med,
    state.visits,
    state.health,
    todayDaily?.done,
    weekPoints,
    profile?.nickname,
  ]);
  meRef.current = me;

  const apply = useCallback((p: GroupsPayload) => {
    setPayload(p);
    const id = p.detail?.id ?? p.activeGroupId ?? null;
    activeRef.current = id;
    setActiveId(id);
    rememberActiveGroup(id);
  }, []);

  /** ping 이 알려 준 "지금 접속 중" 정보만 골라 화면 상태에 반영한다 */
  const applyPresence = useCallback((groupId: string, onlineCodes: string[], onlineCount: number) => {
    setPayload((prev) => {
      if (!prev) return prev;
      const set = new Set(onlineCodes);
      const groups = prev.groups.map((g) => (g.id === groupId ? { ...g, onlineCount } : g));
      const detail =
        prev.detail && prev.detail.id === groupId
          ? {
              ...prev.detail,
              onlineCount,
              members: prev.detail.members.map((m) => ({ ...m, online: set.has(m.code) || m.isMe })),
            }
          : prev.detail;
      return { ...prev, groups, detail };
    });
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
  }, [appReady, code, me.name, me.points, me.days, me.today, me.health?.join(","), refresh]);

  /* 접속 표시 — 앱을 열어 둔 동안 50초마다 "지금 보고 있어요"를 알리고 접속 인원을 새로 받는다 */
  useEffect(() => {
    if (!appReady || !code) return;
    let stopped = false;

    const tick = async () => {
      const gid = activeRef.current;
      if (!gid || stopped) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const ping = await pingGroup(code, gid);
      if (stopped || !ping) return;
      applyPresence(ping.groupId, ping.onlineCodes, ping.onlineCount);
    };

    const first = setTimeout(() => void tick(), 1500);
    const timer = setInterval(() => void tick(), 50_000);
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [appReady, code, applyPresence]);

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

  const leave = useCallback(async (): Promise<ActionResult> => {
    if (!activeRef.current) return { ok: false, message: "먼저 모임에 들어와 주세요." };
    const r = await runAction({ action: "leave", groupId: activeRef.current });
    return r.ok ? { ok: true, message: "모임에서 나왔어요." } : r;
  }, [runAction]);

  const updateGroup = useCallback(
    async (patch: { name?: string; region?: string; description?: string }): Promise<ActionResult> => {
      if (!activeRef.current) return { ok: false, message: "먼저 모임에 들어와 주세요." };
      const name = (patch.name ?? "").trim();
      if (patch.name !== undefined && name.length < 2)
        return { ok: false, message: "모임 이름을 두 글자 이상 적어 주세요." };
      const r = await runAction({
        action: "update",
        groupId: activeRef.current,
        name: patch.name !== undefined ? name : undefined,
        region: patch.region,
        description: patch.description,
      });
      return r.ok ? { ok: true, message: "모임 정보를 바꿨어요." } : r;
    },
    [runAction]
  );

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
      const gid = activeRef.current;
      if (!gid || cheerBusy.current.has(postId)) return;
      // 연타로 요청이 꼬이지 않게 같은 글은 한 번만 보낸다.
      cheerBusy.current.add(postId);

      // 1) 먼저 화면을 0ms 로 바꾼다 — 하트 채우고 숫자 +1 (서버 응답을 기다리지 않는다)
      let changed = false;
      setPayload((prev) => {
        if (!prev?.detail) return prev;
        const posts = prev.detail.posts.map((p) => {
          if (p.id !== postId || p.cheeredByMe) return p;
          changed = true;
          return { ...p, cheeredByMe: true, cheers: p.cheers + 1 };
        });
        return changed ? { ...prev, detail: { ...prev.detail, posts } } : prev;
      });

      try {
        // 2) 서버에 저장하고, 돌아온 최종 값으로 맞춘다(실패하면 그 값이 곧 롤백).
        const r = await runAction({ action: "cheer", groupId: gid, postId });
        if (!r.ok && changed) {
          setPayload((prev) => {
            if (!prev?.detail) return prev;
            return {
              ...prev,
              detail: {
                ...prev.detail,
                posts: prev.detail.posts.map((p) =>
                  p.id === postId ? { ...p, cheeredByMe: false, cheers: Math.max(0, p.cheers - 1) } : p
                ),
              },
            };
          });
        }
      } finally {
        cheerBusy.current.delete(postId);
      }
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
    updateGroup,
    addPost,
    cheer,
    inviteLink: (id?: string) => inviteLinkFor(id || activeId || "", profile?.id),
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
