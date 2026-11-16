"use client";

import React, { useEffect, useMemo, useState } from "react";
import { buildRanking } from "@/lib/rankings";
import type { RankingResult, RankingScope } from "@/lib/types";
import { periodLabel, resetCountdown, weekIdOf } from "@/lib/week";
import { useApp } from "@/lib/storage";
import { Badge, BigButton, Card, PillTabs, SectionTitle } from "./ui";
import { IconChevron, IconCrown, IconQuiz, IconSparkle, IconTrophy } from "./icons";

const TABS: { key: RankingScope; label: string; emoji: string; desc: string }[] = [
  { key: "region", label: "우리 동네", emoji: "🏘️", desc: "같은 시·군·구 어르신" },
  { key: "zodiac", label: "출생연도", emoji: "🐯", desc: "같은 띠 · 비슷한 나이" },
  { key: "streak", label: "개근왕", emoji: "📅", desc: "연속 출석 일수" },
];

const MEDALS = ["🥇", "🥈", "🥉"];

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
    medal,
    avatar,
  }: {
    row?: RankingResult["rows"][number];
    place: number;
    height: number;
    bar: string;
    medal: string;
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
      <Column row={second} place={2} height={62} bar="bg-[#9FB3C8]" medal="🥈" avatar="bg-[#9FB3C8]" />
      <Column row={first} place={1} height={92} bar="bg-gradient-to-b from-gold to-[#E9AE20]" medal="🥇" avatar="bg-gradient-to-br from-[#F7C346] to-[#E09A12]" />
      <Column row={third} place={3} height={46} bar="bg-[#D8A583]" medal="🥉" avatar="bg-[#D8A583]" />
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* 랭킹 보드 (탭 포함)                                                */
/* ---------------------------------------------------------------- */

export function RankingBoard({ initialScope = "region" }: { initialScope?: RankingScope }) {
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
      <PillTabs tabs={TABS.map((t) => ({ key: t.key, label: t.label, emoji: t.emoji }))} value={scope} onChange={setScope} />
      <p className="text-center text-[0.8rem] font-semibold text-ink/45">{tab.desc}</p>

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

      {/* 4~10위 */}
      {rest.length > 0 ? (
        <Card className="p-3.5">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[0.86rem] font-black text-ink/60">4위 ~ 10위</p>
            <p className="text-[0.76rem] font-bold text-ink/35">{scope === "streak" ? "연속 출석" : "이번 주 점수"}</p>
          </div>
          <div className="space-y-1">
            {rest.map((row) => (
              <div
                key={`${row.rank}-${row.name}`}
                className={`flex items-center gap-3 rounded-xl px-2.5 py-2 ${
                  row.isMe ? "bg-brand-light" : ""
                }`}
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
      ) : null}

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
                ? `상위 ${view.myPercentile}% · 잘하고 있어요!`
                : "퀴즈를 풀면 순위가 생겨요"}
            </p>
          </div>
        </div>
        {me && me.rank > 10 && weekPoints > 0 ? (
          <p className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-center text-[0.86rem] font-bold text-ink/60">
            {me.name} 님은 {me.rank}위예요.{" "}
            <span className="text-leaf-dark">상위 {view.myPercentile}%</span> 안에 들어요!
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
          <p className="text-[0.98rem] font-black leading-snug text-ink">내 순위와 이웃 순위가 궁금하세요?</p>
          <p className="mt-0.5 text-[0.85rem] font-semibold text-ink/55">
            우리 동네 · 출생연도 · 개근왕
          </p>
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
        </p>
      </section>

      <RankingBoard />

      <div className="grid grid-cols-1 gap-2">
        <BigButton variant={todayDaily?.done ? "white" : "teal"} size="lg" full onClick={() => onNavigate("quiz")}>
          <IconQuiz size={22} /> {todayDaily?.done ? "퀴즈 결과 · 상장 보기" : "오늘 퀴즈 풀러 가기"}
        </BigButton>
        <BigButton variant="white" full onClick={() => onNavigate("home")}>
          홈으로
        </BigButton>
      </div>
    </div>
  );
}
