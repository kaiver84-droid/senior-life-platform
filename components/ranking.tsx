"use client";

import React, { useEffect, useMemo, useState } from "react";
import { buildGroupRanking, buildRanking } from "@/lib/rankings";
import type {
  GroupRankingResult,
  GroupRankingRow,
  RankingResult,
  RankingScope,
  RankingRow,
} from "@/lib/types";
import { periodLabel, resetCountdown, weekIdOf } from "@/lib/week";
import { useApp } from "@/lib/storage";
import { useGroup } from "@/lib/group-store";
import { Badge, BigButton, Card, SectionTitle } from "./ui";
import { IconChevron, IconCrown, IconQuiz, IconSparkle, IconTrophy, IconUsers } from "./icons";
import { GroupRankingBanner } from "./groups";

const TABS: { key: RankingScope; label: string; emoji: string; desc: string }[] = [
  { key: "group", label: "우리 모임", emoji: "👥", desc: "가족·친구와 함께 겨루는 순위" },
  { key: "groups", label: "단체별", emoji: "🏆", desc: "모임끼리 겨루는 순위 — 우리 모임은 어디쯤일까요" },
  { key: "national", label: "전국", emoji: "🇰🇷", desc: "전국 어르신 순위" },
  { key: "region", label: "지역별", emoji: "🏘️", desc: "같은 시·군·구 어르신" },
  { key: "streak", label: "개근왕", emoji: "📅", desc: "연속 출석 일수" },
];

function useRanking(scope: RankingScope) {
  const { profile, weekPoints, streak } = useApp();
  const weekId = weekIdOf();
  const [data, setData] = useState<RankingResult | null>(null);
  const [loading, setLoading] = useState(true);

  const fallback = useMemo(
    () =>
      buildRanking({
        scope,
        weekId,
        sido: profile?.sido,
        sigungu: profile?.sigungu,
        birthYear: profile?.birthYear,
        myName: profile?.nickname,
        myPoints: weekPoints,
        myStreak: streak,
      }),
    [scope, weekId, profile, weekPoints, streak]
  );

  useEffect(() => {
    if (scope === "group" || scope === "groups") {
      setLoading(false);
      return;
    }
    const params = new URLSearchParams({
      scope,
      weekId,
      sido: profile?.sido || "",
      sigungu: profile?.sigungu || "",
      birthYear: String(profile?.birthYear || 1955),
      name: profile?.nickname || "나",
      points: String(weekPoints),
      streak: String(streak),
    });
    let alive = true;
    setLoading(true);
    fetch(`/api/rankings?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad"))))
      .then((j) => {
        if (!alive) return;
        if (j?.ok && Array.isArray(j.rows)) setData(j as RankingResult);
        else setData(fallback);
      })
      .catch(() => {
        if (alive) setData(fallback);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [scope, weekId, profile, weekPoints, streak, fallback]);

  return { view: data ?? fallback, loading };
}

/* ---------------------------------------------------------------- */
/* 시상대                                                             */
/* ---------------------------------------------------------------- */

function Podium({
  rows,
  scope,
}: {
  rows: RankingResult["rows"];
  scope: RankingScope;
}) {
  const first = rows[0];
  const second = rows[1];
  const third = rows[2];
  const value = (r?: RankingResult["rows"][number]) =>
    !r ? "" : scope === "streak" ? `${r.streak}일` : `${r.points}점`;

  const Column = ({
    row,
    place,
    height,
    bar,
    avatar,
  }: {
    row?: RankingResult["rows"][number];
    place: number;
    height: number;
    bar: string;
    avatar: string;
  }) => (
    <div className="flex flex-1 flex-col items-center">
      <div className="relative mb-1 flex h-[34px] items-end justify-center">
        {place === 1 ? <span className="text-[1.7rem] leading-none drop-shadow">👑</span> : null}
      </div>
      <div
        className={`grid place-items-center rounded-full text-[1.15rem] font-black text-white shadow-soft ${
          place === 1 ? "h-[62px] w-[62px] ring-4 ring-gold/60" : "h-[50px] w-[50px]"
        } ${avatar}`}
      >
        {row ? row.name.slice(0, 1) : "?"}
      </div>
      <p className={`mt-1.5 max-w-full truncate text-center ${place === 1 ? "text-[0.98rem]" : "text-[0.88rem]"} font-black text-ink`}>
        {row ? row.name : "-"}
      </p>
      <p className={`tabular text-center text-[0.82rem] font-extrabold ${place === 1 ? "text-gold-dark" : "text-ink/55"}`}>
        {value(row)}
      </p>
      <div
        className={`mt-1.5 w-full rounded-t-[0.9rem] ${bar} ${place === 1 ? "podium-rise" : ""}`}
        style={{ height }}
      >
        <p className="pt-2 text-center text-[0.95rem] font-black text-white/95">{place}위</p>
      </div>
    </div>
  );

  return (
    <div className="flex items-end gap-2">
      <Column row={second} place={2} height={62} bar="bg-[#9FB3C8]" avatar="bg-[#9FB3C8]" />
      <Column row={first} place={1} height={92} bar="bg-gradient-to-b from-gold to-[#E9AE20]" avatar="bg-gradient-to-br from-[#F7C346] to-[#E09A12]" />
      <Column row={third} place={3} height={46} bar="bg-[#D8A583]" avatar="bg-[#D8A583]" />
    </div>
  );
}

/** 4위부터의 목록 */
function RestList({ rows, scope }: { rows: RankingResult["rows"]; scope: RankingScope }) {
  if (!rows.length) return null;
  return (
    <Card className="p-3.5">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[0.86rem] font-black text-ink/60">4위 ~ {3 + rows.length}위</p>
        <p className="text-[0.76rem] font-bold text-ink/35">
          {scope === "streak" ? "연속 출석" : scope === "group" ? "이번 주 점수" : "이번 주 점수"}
        </p>
      </div>
      <div className="space-y-1">
        {rows.map((row) => (
          <div
            key={`${row.rank}-${row.name}`}
            className={`flex items-center gap-3 rounded-xl px-2.5 py-2 ${row.isMe ? "bg-brand-light" : ""}`}
          >
            <span className="w-6 text-center text-[0.92rem] font-black text-ink/45">{row.rank}</span>
            <span className={`flex-1 truncate text-[0.96rem] ${row.isMe ? "font-black text-brand-deep" : "font-bold text-ink/85"}`}>
              {row.name}
              {row.isMe ? <span className="ml-1 text-[0.74rem] font-extrabold text-brand">(나)</span> : null}
            </span>
            <span className="tabular text-[0.92rem] font-extrabold text-ink/70">
              {scope === "streak" ? `${row.streak}일` : `${row.points}점`}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- */
/* 우리 모임 순위 (실제 모임 회원 데이터)                              */
/* ---------------------------------------------------------------- */

function GroupRankingBoard({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { detail, active } = useGroup();
  const { weekPoints, streak } = useApp();

  if (!detail || !active) {
    return (
      <Card className="p-5 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-light text-brand-dark">
          <IconUsers size={26} />
        </span>
        <p className="mt-2 text-[1.05rem] font-black text-ink">아직 모임이 없어요</p>
        <p className="mt-1 text-[0.9rem] font-semibold leading-relaxed text-ink/55">
          모임에 들어가면 가족·친구와 함께
          <br />
          이번 주 순위를 겨룰 수 있어요.
        </p>
        <div className="mt-3">
          <BigButton variant="ink" full onClick={() => onNavigate?.("group")}>
            <IconUsers size={20} /> 우리 모임 시작하기
          </BigButton>
        </div>
      </Card>
    );
  }

  const rows: RankingRow[] = detail.members.map((m) => ({
    rank: m.rank,
    name: m.name,
    points: m.points,
    streak: m.weekDays,
    isMe: m.isMe,
  }));
  const rest = rows.slice(3, 10);
  const me = rows.find((r) => r.isMe);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-[1.6rem] bg-gradient-to-b from-[#FFF9EA] via-white to-[#F3FAF8] p-4 shadow-card">
        <div className="mb-1 flex items-center justify-center gap-1.5 text-[0.8rem] font-extrabold text-gold-dark">
          <IconTrophy size={16} /> {active.name} · {periodLabel()}
        </div>
        <Podium rows={rows.slice(0, 10)} scope="group" />

        <div className="mt-3 rounded-2xl bg-gradient-to-r from-plum to-[#5B4FA8] px-3.5 py-2.5 text-center">
          <p className="flex items-center justify-center gap-1.5 text-[0.9rem] font-black text-white">
            <IconSparkle size={16} className="text-[#FFE28A]" />
            {detail.top ? `${detail.top.name} 님, 우리 모임 1위예요!` : "이번 주 1위를 기다리고 있어요"}
          </p>
        </div>
      </div>

      <p className="text-center text-[0.8rem] font-semibold text-ink/45">
        오늘 {detail.todayAttended}명 참여 · 모임 회원 {detail.memberCount}명
      </p>

      <RestList rows={rest} scope="group" />

      <Card className="bg-gradient-to-br from-brand-light/70 to-white p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[0.8rem] font-bold text-ink/50">우리 모임 내 순위</p>
            <p className="mt-0.5 text-[1.5rem] font-black leading-none text-brand-deep">
              {detail.myRank ? (
                <>
                  {detail.myRank}
                  <span className="text-[0.92rem] font-extrabold text-ink/45">위 / {detail.memberCount}명</span>
                </>
              ) : (
                <span className="text-[1.05rem] text-ink/45">아직 참여 전이에요</span>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[0.8rem] font-bold text-ink/50">이번 주 점수</p>
            <p className="tabular text-[1.15rem] font-black text-brand-dark">{weekPoints}점</p>
            <p className="text-[0.82rem] font-extrabold text-leaf-dark">🔥 {streak}일 연속</p>
          </div>
        </div>
        {me ? (
          <p className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-center text-[0.86rem] font-bold text-ink/60">
            이번 주 {me.streak}일 참여했어요. 퀴즈를 풀면 점수가 더 올라가요!
          </p>
        ) : (
          <p className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-center text-[0.86rem] font-bold text-ink/60">
            퀴즈를 풀면 우리 모임 순위에 이름이 올라가요.
          </p>
        )}
      </Card>

      <GroupRankingBanner onNavigate={onNavigate} />

      <p className="rounded-2xl bg-white/70 px-4 py-3 text-center text-[0.8rem] font-semibold leading-relaxed text-ink/50">
        매주 월요일 0시에 우리 모임 순위도 새로 시작해요 (앞으로 {resetCountdown()}).
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* 단체별 순위 (모임 vs 모임)                                          */
/* ---------------------------------------------------------------- */

function useGroupRanking() {
  const { code, weekId } = useApp();
  const { active, detail } = useGroup();

  const fallback = useMemo<GroupRankingResult>(() => {
    const mine =
      active && detail
        ? [
            {
              id: active.id,
              name: active.name,
              memberCount: detail.memberCount,
              points: detail.members.reduce((sum, m) => sum + (m.points || 0), 0),
              attendedToday: detail.todayAttended,
            },
          ]
        : [];
    return buildGroupRanking({ weekId, myGroups: mine });
  }, [active, detail, weekId]);

  const [data, setData] = useState<GroupRankingResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams({ scope: "groups", weekId, code });
    setLoading(true);
    fetch(`/api/rankings?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad"))))
      .then((j) => {
        if (!alive) return;
        if (j?.ok && Array.isArray(j.rows)) setData(j as GroupRankingResult);
        else setData(fallback);
      })
      .catch(() => {
        if (alive) setData(fallback);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [weekId, code, fallback]);

  return { view: data ?? fallback, loading };
}

function GroupPodium({ rows }: { rows: GroupRankingRow[] }) {
  const Column = ({
    row,
    place,
    height,
    bar,
    avatar,
  }: {
    row?: GroupRankingRow;
    place: number;
    height: number;
    bar: string;
    avatar: string;
  }) => (
    <div className="flex min-w-0 flex-1 flex-col items-center">
      <div className="relative mb-1 flex h-[32px] items-end justify-center">
        {place === 1 ? <span className="text-[1.6rem] leading-none drop-shadow">👑</span> : null}
      </div>
      <div
        className={`grid place-items-center rounded-full text-[1.05rem] font-black text-white shadow-soft ${
          place === 1 ? "h-[56px] w-[56px] ring-4 ring-gold/60" : "h-[46px] w-[46px]"
        } ${avatar}`}
      >
        {row ? row.name.slice(0, 1) : "?"}
      </div>
      <p
        className={`mt-1.5 w-full truncate text-center ${
          place === 1 ? "text-[0.9rem]" : "text-[0.84rem]"
        } font-black text-ink`}
      >
        {row ? row.name : "-"}
      </p>
      <p className="w-full truncate text-center text-[0.72rem] font-bold text-ink/45">
        {row ? `${row.memberCount}명 · 출석 ${row.attendance}%` : ""}
      </p>
      <p className={`tabular text-center text-[0.8rem] font-extrabold ${place === 1 ? "text-gold-dark" : "text-ink/55"}`}>
        {row ? `평균 ${row.average}점` : ""}
      </p>
      <div
        className={`mt-1.5 w-full rounded-t-[0.9rem] ${bar} ${place === 1 ? "podium-rise" : ""}`}
        style={{ height }}
      >
        <p className="pt-2 text-center text-[0.95rem] font-black text-white/95">{place}위</p>
      </div>
    </div>
  );

  return (
    <div className="flex items-end gap-1.5">
      <Column row={rows[1]} place={2} height={62} bar="bg-[#9FB3C8]" avatar="bg-[#9FB3C8]" />
      <Column
        row={rows[0]}
        place={1}
        height={92}
        bar="bg-gradient-to-b from-gold to-[#E9AE20]"
        avatar="bg-gradient-to-br from-[#F7C346] to-[#E09A12]"
      />
      <Column row={rows[2]} place={3} height={46} bar="bg-[#D8A583]" avatar="bg-[#D8A583]" />
    </div>
  );
}

function GroupsBoard({
  onNavigate,
  loading,
}: {
  onNavigate?: (tab: string) => void;
  loading: boolean;
}) {
  const { view } = useGroupRanking();
  const rows = view.rows;
  const mine = rows.find((r) => r.isMine) ?? null;
  const rest = rows.slice(3);

  return (
    <div className="space-y-3" data-group-rank>
      <div className="overflow-hidden rounded-[1.6rem] bg-gradient-to-b from-[#FFF9EA] via-white to-[#F3FAF8] p-4 shadow-card">
        <div className="mb-1 flex items-center justify-center gap-1.5 text-[0.8rem] font-extrabold text-gold-dark">
          <IconTrophy size={16} /> {periodLabel()} 단체 명예의 전당
        </div>
        <GroupPodium rows={rows} />
        <div className="mt-3 rounded-2xl bg-gradient-to-r from-plum to-[#5B4FA8] px-3.5 py-2.5 text-center">
          <p className="flex items-center justify-center gap-1.5 text-[0.9rem] font-black text-white">
            <IconSparkle size={16} className="text-[#FFE28A]" />
            {rows[0] ? `${rows[0].name}, 이번 주 1위예요!` : "이번 주 1위를 기다리고 있어요"}
          </p>
        </div>
      </div>

      {mine ? (
        <div data-my-group-rank>
        <Card className="bg-gradient-to-br from-brand-light/70 to-white p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[0.8rem] font-bold text-ink/50">내 모임 순위</p>
              <p className="mt-0.5 text-[1.5rem] font-black leading-none text-brand-deep">
                {mine.rank}
                <span className="text-[0.92rem] font-extrabold text-ink/45">위 / {rows.length}개 모임</span>
              </p>
            </div>
            <div className="min-w-0 text-right">
              <p className="truncate text-[0.86rem] font-black text-ink">{mine.name}</p>
              <p className="tabular text-[0.86rem] font-extrabold text-brand-dark">
                평균 {mine.average}점 · 총 {mine.points}점
              </p>
              <p className="text-[0.8rem] font-extrabold text-leaf-dark">
                {mine.memberCount}명 · 오늘 출석 {mine.attendance}%
              </p>
            </div>
          </div>
        </Card>
        </div>
      ) : (
        <Card className="p-4 text-center">
          <p className="text-[0.98rem] font-black text-ink">아직 모임이 없어요</p>
          <p className="mt-1 text-[0.88rem] font-semibold leading-relaxed text-ink/55">
            모임에 들어가면 우리 모임도 단체 순위에 나와요.
          </p>
          <div className="mt-2.5">
            <BigButton variant="ink" full onClick={() => onNavigate?.("group")}>
              <IconUsers size={20} /> 우리 모임 시작하기
            </BigButton>
          </div>
        </Card>
      )}

      <Card className="p-3.5">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[0.86rem] font-black text-ink/60">4위 ~ {rows.length}위</p>
          <p className="text-[0.76rem] font-bold text-ink/35">이번 주 점수</p>
        </div>
        <div className="space-y-1">
          {rest.map((r) => (
            <div
              key={r.id}
              className={`flex items-center gap-2 rounded-xl px-2.5 py-2 ${r.isMine ? "bg-brand-light" : ""}`}
            >
              <span className="w-6 shrink-0 text-center text-[0.92rem] font-black text-ink/45">{r.rank}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1">
                  <span
                    className={`truncate text-[0.94rem] ${r.isMine ? "font-black text-brand-deep" : "font-bold text-ink/85"}`}
                  >
                    {r.name}
                  </span>
                  {r.isMine ? <Badge tone="brand">내 모임</Badge> : null}
                </span>
                <span className="block text-[0.76rem] font-bold text-ink/45">
                  {r.memberCount}명 · 출석 {r.attendance}%
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block tabular text-[0.9rem] font-black text-ink/75">평균 {r.average}점</span>
                <span className="block text-[0.72rem] font-bold text-ink/40">총 {r.points}점</span>
              </span>
            </div>
          ))}
        </div>
      </Card>

      <p className="rounded-2xl bg-white/70 px-4 py-3 text-center text-[0.8rem] font-semibold leading-relaxed text-ink/50">
        모임원 점수를 모두 더해 겨루고, 인원이 달라도 공평하게 보이도록 평균 점수도 함께 보여 드려요.
        {loading ? " 순위를 불러오는 중…" : ""}
        {view.sample ? " 이름 뒤에 ‘예시’ 모임이 함께 있어요. 실제 모임이 늘면 그대로 채워집니다." : ""}
      </p>
    </div>
  );
}

/** 랭킹 종류 탭 — 작은 화면에서도 글씨가 잘리지 않게 3열 · 2열 큰 버튼으로 나눈다 */
function RankingTabs({ value, onChange }: { value: RankingScope; onChange: (v: RankingScope) => void }) {
  const rows = [TABS.slice(0, 3), TABS.slice(3)];
  return (
    <div className="space-y-2" role="tablist" aria-label="랭킹 종류">
      {rows.map((group, rowIndex) => (
        <div
          key={rowIndex}
          className={`grid gap-2 ${group.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}
        >
          {group.map((t) => {
            const on = t.key === value;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={on}
                data-rank-tab={t.key}
                onClick={() => onChange(t.key)}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[0.94rem] font-extrabold transition ${
                  on ? "bg-ink text-white shadow-cta" : "bg-white text-ink/60 shadow-soft active:bg-paper"
                }`}
              >
                <span aria-hidden className="text-[1.02rem] leading-none">
                  {t.emoji}
                </span>
                <span className="whitespace-nowrap leading-tight">{t.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* 랭킹 보드 (탭 포함)                                                */
/* ---------------------------------------------------------------- */

export function RankingBoard({
  initialScope = "group",
  onNavigate,
}: {
  initialScope?: RankingScope;
  onNavigate?: (tab: string) => void;
}) {
  const [scope, setScope] = useState<RankingScope>(initialScope);
  const { view, loading } = useRanking(scope);
  const { streak, weekPoints, state, weekId } = useApp();
  const hasRecord = weekPoints > 0 || state.quizLogs.some((q) => q.weekId === weekId) || streak >= 2;
  const tab = TABS.find((t) => t.key === scope)!;
  const rest = view.rows.slice(3, 10);
  const meInList = view.rows.some((r) => r.isMe);
  const me = view.rows.find((r) => r.isMe);

  return (
    <div className="space-y-3">
      <RankingTabs value={scope} onChange={setScope} />
      <p className="text-center text-[0.8rem] font-semibold text-ink/45">{tab.desc}</p>

      {scope === "group" ? (
        <GroupRankingBoard onNavigate={onNavigate} />
      ) : scope === "groups" ? (
        <GroupsBoard onNavigate={onNavigate} loading={loading} />
      ) : (
        <>
          {/* 시상대 */}
          <div className="overflow-hidden rounded-[1.6rem] bg-gradient-to-b from-[#FFF9EA] via-white to-[#F3FAF8] p-4 shadow-card">
            <div className="mb-1 flex items-center justify-center gap-1.5 text-[0.8rem] font-extrabold text-gold-dark">
              <IconTrophy size={16} /> {periodLabel()} 명예의 전당
            </div>
            <Podium rows={view.rows} scope={scope} />

            <div className="mt-3 rounded-2xl bg-gradient-to-r from-plum to-[#5B4FA8] px-3.5 py-2.5 text-center">
              <p className="flex items-center justify-center gap-1.5 text-[0.9rem] font-black text-white">
                <IconSparkle size={16} className="text-[#FFE28A]" />
                {view.rows[0] ? `${view.rows[0].name} 님, 이번 주 1위를 축하합니다!` : "이번 주 1위를 기다리고 있어요"}
              </p>
            </div>
          </div>

          <RestList rows={rest} scope={scope} />

          {/* 내 순위 */}
          <Card className="bg-gradient-to-br from-brand-light/70 to-white p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[0.8rem] font-bold text-ink/50">내 순위</p>
                <p className="mt-0.5 text-[1.5rem] font-black leading-none text-brand-deep">
                  {hasRecord && view.myRank ? (
                    <>
                      {view.myRank}
                      <span className="text-[0.92rem] font-extrabold text-ink/45">위 / {view.total}명</span>
                    </>
                  ) : (
                    <span className="text-[1.05rem] text-ink/45">아직 기록이 없어요</span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[0.8rem] font-bold text-ink/50">{scope === "streak" ? "연속 출석" : "이번 주 점수"}</p>
                <p className="tabular text-[1.15rem] font-black text-brand-dark">
                  {scope === "streak" ? `${streak}일` : `${weekPoints}점`}
                </p>
                <p className="text-[0.82rem] font-extrabold text-leaf-dark">
                  {hasRecord && view.myPercentile && weekPoints > 0
                    ? view.myPercentile <= 50
                      ? `상위 ${view.myPercentile}% · 잘하고 있어요!`
                      : `상위 ${view.myPercentile}% · 더 풀면 올라가요`
                    : "퀴즈를 풀면 순위가 생겨요"}
                </p>
              </div>
            </div>
            {me && me.rank > 10 && weekPoints > 0 ? (
              <p className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-center text-[0.86rem] font-bold text-ink/60">
                {me.name} 님은 {me.rank}위예요. <span className="text-leaf-dark">상위 {view.myPercentile}%</span> 안에 들어요!
              </p>
            ) : null}
            {!meInList && hasRecord ? (
              <p className="mt-2 text-center text-[0.82rem] font-semibold text-ink/50">
                10위 안에 들면 이름이 여기에 보여요.
              </p>
            ) : null}
          </Card>

          <p className="rounded-2xl bg-white/70 px-4 py-3 text-center text-[0.8rem] font-semibold leading-relaxed text-ink/50">
            매주 월요일 0시에 새로 시작해요 (앞으로 {resetCountdown()}).
            <br />
            이름은 뒤 글자를 가려서 보여 드려요.
            {view.sample ? " 지금은 예시 순위이며, 참여자가 쌓이면 실제 순위로 바뀝니다." : ""}
            {loading ? " 순위를 새로 불러오는 중…" : ""}
          </p>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* 퀴즈 탭 안의 요약                                                  */
/* ---------------------------------------------------------------- */

export function RankingPanel({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  return (
    <section className="fade-up">
      <SectionTitle emoji="🏆" right={<span className="text-[0.78rem] font-bold text-ink/40">{periodLabel()}</span>}>
        명예의 전당
      </SectionTitle>
      <Card className="flex items-center justify-between gap-2 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[0.98rem] font-black leading-snug text-ink">우리 모임과 이웃 순위가 궁금하세요?</p>
          <p className="mt-0.5 text-[0.85rem] font-semibold text-ink/55">우리 모임 · 단체별 · 전국 · 지역별 · 개근왕</p>
        </div>
        <button
          onClick={() => onNavigate?.("ranking")}
          aria-label="랭킹 화면 열기"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink text-white shadow-cta"
        >
          <IconChevron size={24} />
        </button>
      </Card>
    </section>
  );
}

/* ---------------------------------------------------------------- */
/* 전용 랭킹 화면                                                     */
/* ---------------------------------------------------------------- */

export function RankingTab({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { profile, streak, weekPoints, todayDaily } = useApp();
  const { active } = useGroup();
  return (
    <div className="space-y-4">
      <section className="fade-up pt-1">
        <div className="flex items-center gap-2">
          <Badge tone="gold">🏆 명예의 전당</Badge>
          <Badge tone="brand">{periodLabel()}</Badge>
        </div>
        <h1 className="mt-1.5 text-[1.5rem] font-black leading-snug text-ink">
          {profile?.nickname} 님의 이번 주 순위
        </h1>
        <p className="mt-1 text-[0.9rem] font-semibold text-ink/55">
          🔥 {streak}일 연속 출석 · 이번 주 {weekPoints}점
          {active ? ` · ${active.name}` : ""}
        </p>
      </section>

      <RankingBoard onNavigate={onNavigate} />

      <div className="grid grid-cols-1 gap-2">
        <BigButton variant={todayDaily?.done ? "white" : "teal"} size="lg" full onClick={() => onNavigate("quiz")}>
          <IconQuiz size={22} /> {todayDaily?.done ? "퀴즈 결과 · 상장 보기" : "오늘 퀴즈 풀러 가기"}
        </BigButton>
        <BigButton variant="white" full onClick={() => onNavigate("group")}>
          <IconUsers size={20} /> 우리 모임 보기
        </BigButton>
      </div>
    </div>
  );
}
