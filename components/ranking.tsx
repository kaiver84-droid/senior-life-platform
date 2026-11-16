"use client";

import React, { useEffect, useMemo, useState } from "react";
import { buildRanking } from "@/lib/rankings";
import type { RankingResult, RankingScope } from "@/lib/types";
import { periodLabel, resetCountdown, weekIdOf } from "@/lib/week";
import { useApp } from "@/lib/storage";
import { Badge, Card, SectionTitle } from "./ui";

const TABS: { key: RankingScope; label: string; emoji: string }[] = [
  { key: "region", label: "우리 동네", emoji: "🏘️" },
  { key: "zodiac", label: "띠·나이", emoji: "🐯" },
  { key: "streak", label: "개근상", emoji: "📅" },
];

const MEDALS = ["🥇", "🥈", "🥉"];

export function RankingPanel() {
  const { profile, weekPoints, streak } = useApp();
  const [scope, setScope] = useState<RankingScope>("region");
  const [data, setData] = useState<RankingResult | null>(null);
  const [loading, setLoading] = useState(true);

  const weekId = weekIdOf();

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

  const view = data ?? fallback;

  return (
    <section className="fade-up">
      <SectionTitle
        emoji="🏆"
        right={<span className="text-[0.8rem] font-bold text-ink/50">{periodLabel()}</span>}
      >
        명예의 전당
      </SectionTitle>

      <div className="mb-3 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setScope(t.key)}
            aria-pressed={scope === t.key}
            className={`min-h-[48px] flex-1 rounded-2xl border-2 px-2 text-[0.95rem] font-extrabold transition ${
              scope === t.key
                ? "border-brand bg-brand text-white"
                : "border-ink/12 bg-white text-ink/70"
            }`}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      <Card className="bg-gradient-to-br from-white to-brand-light/40 p-4">
        <div className="flex items-center justify-between rounded-2xl bg-white/85 p-3">
          <div>
            <p className="text-[0.82rem] font-bold text-ink/55">내 순위</p>
            <p className="text-[1.5rem] font-black leading-tight">
              {view.myRank}
              <span className="text-[0.95rem] font-bold text-ink/50">위 / {view.total}명</span>
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
              상위 {view.myPercentile}%
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

        {view.myRank && view.myRank > 10 ? (
          <p className="mt-2 text-center text-[0.9rem] font-bold text-ink/60">
            내 순위는 {view.myRank}위, <span className="text-leaf">상위 {view.myPercentile}%</span>예요. 충분히 잘하고 있어요!
          </p>
        ) : null}

        <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-center text-[0.85rem] font-semibold leading-relaxed text-ink/60">
          매주 월요일 0시에 새로 시작해요 (다음 시작까지 {resetCountdown()}).
          <br />
          1~10위만 이름을 보여 드리고, 그 아래는 &lsquo;상위 ○%&rsquo;로 알려 드려요.
        </p>
        {view.sample ? (
          <p className="mt-1.5 text-center text-[0.76rem] font-medium text-ink/40">
            지금은 예시 순위예요. 참여자가 쌓이면 실제 순위로 바뀝니다.
          </p>
        ) : null}
      </Card>
    </section>
  );
}
