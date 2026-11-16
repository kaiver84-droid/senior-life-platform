"use client";

import React, { useEffect, useMemo, useState } from "react";
import { buildRanking } from "@/lib/rankings";
import type { RankingResult, RankingScope } from "@/lib/types";
import { periodLabel, resetCountdown, weekIdOf } from "@/lib/week";
import { useApp } from "@/lib/storage";
import { Badge, BigButton, Card, SectionTitle } from "./ui";
import { IconChevron, IconQuiz } from "./icons";

const TABS: { key: RankingScope; label: string; emoji: string; desc: string }[] = [
  { key: "region", label: "우리 동네", emoji: "🏘️", desc: "같은 시·군·구 어르신" },
  { key: "zodiac", label: "띠·나이", emoji: "🐯", desc: "같은 띠·비슷한 나이" },
  { key: "streak", label: "개근상", emoji: "📅", desc: "연속 출석 일수" },
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

/** 랭킹 3종 탭 + 명단 (퀴즈 탭·랭킹 탭에서 함께 사용) */
export function RankingBoard({ initialScope = "region" }: { initialScope?: RankingScope }) {
  const [scope, setScope] = useState<RankingScope>(initialScope);
  const { view, loading } = useRanking(scope);
  const { streak, weekPoints, state, weekId } = useApp();
  const hasRecord = state.quizLogs.some((q) => q.weekId === weekId) || streak > 0;
  const tab = TABS.find((t) => t.key === scope)!;

  return (
    <div>
      <div className="mb-2 grid grid-cols-3 gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setScope(t.key)}
            aria-pressed={scope === t.key}
            className={`min-h-[56px] rounded-2xl border-2 px-1 text-[0.92rem] font-extrabold transition ${
              scope === t.key ? "border-brand bg-brand text-white" : "border-ink/12 bg-white text-ink/70"
            }`}
          >
            <span className="block text-[1.1rem] leading-tight">{t.emoji}</span>
            <span className="block whitespace-nowrap leading-tight">{t.label}</span>
          </button>
        ))}
      </div>
      <p className="mb-2 text-center text-[0.82rem] font-semibold text-ink/50">{tab.desc}</p>

      <Card className="bg-gradient-to-br from-white to-brand-light/40 p-4">
        <div className="flex items-center justify-between rounded-2xl bg-white/85 p-3">
          <div>
            <p className="text-[0.82rem] font-bold text-ink/55">내 순위</p>
            <p className="text-[1.5rem] font-black leading-tight">
              {hasRecord ? (
                <>
                  {view.myRank}
                  <span className="text-[0.95rem] font-bold text-ink/50">위 / {view.total}명</span>
                </>
              ) : (
                <span className="text-[1.15rem]">아직 기록 없음</span>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[0.82rem] font-bold text-ink/55">
              {scope === "streak" ? "연속 출석" : "이번 주 점수"}
            </p>
            <p className="text-[1.15rem] font-black text-brand-dark">
              {scope === "streak" ? `${streak}일` : `${weekPoints}점`}
            </p>
            <p className="text-[0.85rem] font-extrabold text-leaf">
              {hasRecord ? `상위 ${view.myPercentile}%` : "퀴즈를 풀면 순위가 생겨요"}
            </p>
          </div>
        </div>

        <div className="mt-3 space-y-1.5">
          {view.rows.map((row) => (
            <div
              key={`${row.rank}-${row.name}`}
              className={`flex items-center gap-3 rounded-xl px-2.5 py-2 ${
                row.isMe ? "border-2 border-brand/40 bg-brand-light" : "bg-white/70"
              }`}
            >
              <span className="w-7 text-center text-[1rem] font-black text-ink/70">
                {row.rank <= 3 ? MEDALS[row.rank - 1] : row.rank}
              </span>
              <span className={`flex-1 truncate text-[1rem] ${row.isMe ? "font-black" : "font-bold"}`}>
                {row.name}
                {row.isMe ? <span className="ml-1 text-[0.78rem] font-extrabold text-brand">(나)</span> : null}
              </span>
              {scope === "streak" ? (
                <span className="tabular text-[0.98rem] font-extrabold text-leaf">{row.streak}일</span>
              ) : (
                <span className="tabular text-[0.98rem] font-extrabold text-ink/80">{row.points}점</span>
              )}
            </div>
          ))}
        </div>

        {hasRecord && view.myRank && view.myRank > 10 ? (
          <p className="mt-2 text-center text-[0.9rem] font-bold text-ink/60">
            내 순위는 {view.myRank}위, <span className="text-leaf">상위 {view.myPercentile}%</span>예요. 충분히 잘하고 있어요!
          </p>
        ) : null}

        <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-center text-[0.85rem] font-semibold leading-relaxed text-ink/60">
          매주 월요일 0시에 새로 시작해요 (앞으로 {resetCountdown()}).
          <br />
          1~10위만 이름을 보여 드리고, 그 아래는 &lsquo;상위 ○%&rsquo;로 알려 드려요.
        </p>
        {view.sample ? (
          <p className="mt-1.5 text-center text-[0.76rem] font-medium text-ink/40">
            지금은 예시 순위예요. 참여자가 쌓이면 실제 순위로 바뀝니다.
          </p>
        ) : null}
        {loading ? <p className="mt-1 text-center text-[0.74rem] font-medium text-ink/35">순위를 새로 불러오는 중…</p> : null}
      </Card>
    </div>
  );
}

/** 퀴즈 탭 안의 요약 (랭킹 탭으로 이동) */
export function RankingPanel({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  return (
    <section className="fade-up">
      <SectionTitle
        emoji="🏆"
        right={<span className="text-[0.8rem] font-bold text-ink/50">{periodLabel()}</span>}
      >
        명예의 전당
      </SectionTitle>
      <Card className="flex items-center justify-between gap-2 p-4">
        <div className="min-w-0">
          <p className="text-[1rem] font-black">내 순위와 이웃 순위가 궁금하세요?</p>
          <p className="mt-0.5 text-[0.88rem] font-semibold text-ink/55">
            랭킹 탭에서 우리 동네 · 띠 · 개근상을 한 번에 봐요
          </p>
        </div>
        <button
          onClick={() => onNavigate?.("ranking")}
          aria-label="랭킹 화면 열기"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-white"
        >
          <IconChevron size={24} />
        </button>
      </Card>
    </section>
  );
}

/** 전용 랭킹 화면 */
export function RankingTab({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { profile, streak, weekPoints, todayDaily } = useApp();
  return (
    <div className="space-y-5">
      <section>
        <div className="mb-1 flex items-center gap-2">
          <Badge tone="gold">🏆 명예의 전당</Badge>
          <Badge tone="brand">{periodLabel()}</Badge>
        </div>
        <h1 className="text-[1.55rem] font-black leading-snug">
          {profile?.nickname} 님의
          <br />
          이번 주 순위
        </h1>
        <p className="mt-1 text-[0.96rem] font-semibold text-ink/60">
          🔥 {streak}일 연속 출석 · 이번 주 {weekPoints}점
        </p>
      </section>

      <Card className="bg-gradient-to-br from-gold-light/70 to-white p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-[1.3rem]">🏅</span>
          <div className="min-w-0 flex-1">
            <p className="whitespace-nowrap text-[0.95rem] font-black leading-snug">월요일 0시에 새로 시작해요</p>
            <p className="mt-0.5 text-[0.84rem] font-semibold text-ink/60">
              이번 주 {periodLabel()} · 다음 시작 {resetCountdown()}
            </p>
          </div>
        </div>
      </Card>

      <RankingBoard />

      <div className="grid grid-cols-1 gap-2">
        <BigButton variant={todayDaily?.done ? "white" : "leaf"} size="lg" full onClick={() => onNavigate("quiz")}>
          <IconQuiz size={22} /> {todayDaily?.done ? "퀴즈 결과 · 상장 보기" : "오늘 퀴즈 풀러 가기"}
        </BigButton>
        <BigButton variant="white" full onClick={() => onNavigate("home")}>
          홈으로
        </BigButton>
      </div>

      <p className="rounded-2xl bg-white/70 px-4 py-3 text-center text-[0.8rem] font-semibold leading-relaxed text-ink/50">
        순위는 퀴즈 점수와 출석 기록으로 매겨져요. 이름은 뒤 글자를 가려서 보여 드려요.
      </p>
    </div>
  );
}
