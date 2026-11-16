"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppProvider, useApp, medToday, calcStreak } from "@/lib/storage";
import { ToastProvider, Badge, BigButton, Card, Divider, SectionTitle, useToast } from "@/components/ui";
import { koreanDate } from "@/lib/week";
import { shortSido } from "@/lib/regions";
import type { AppState } from "@/lib/types";

type RemoteState = {
  profile: { nickname: string; birthYear: number; sido: string; sigungu: string } | null;
  quizLogs: { date: string; points: number; correct: number; total: number }[];
  med: Record<string, { morning: boolean; evening: boolean }>;
  visits: string[];
};

function Dashboard() {
  const { profile, state, today, streak, code, weekPoints, ready } = useApp();
  const { show } = useToast();
  const [remote, setRemote] = useState<RemoteState | null>(null);
  const [lookupCode, setLookupCode] = useState("");
  const [loading, setLoading] = useState(false);

  const queryCode = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("code") || "";
  }, []);

  useEffect(() => {
    if (!ready || !queryCode || queryCode === code) return;
    setLoading(true);
    fetch(`/api/state?code=${encodeURIComponent(queryCode)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && j.state) {
          setRemote({
            profile: j.state.profile,
            quizLogs: j.state.quizLogs || [],
            med: j.state.med || {},
            visits: j.state.visits || [],
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ready, queryCode, code]);

  const useRemote = Boolean(remote) && !profile;
  const data: { name: string; birthYear: number; region: string; quizLogs: AppState["quizLogs"]; med: AppState["med"]; visits: string[] } =
    useRemote && remote
      ? {
          name: remote.profile?.nickname || "부모님",
          birthYear: remote.profile?.birthYear || 1955,
          region: `${shortSido(remote.profile?.sido || "")} ${remote.profile?.sigungu || ""}`.trim(),
          quizLogs: remote.quizLogs as AppState["quizLogs"],
          med: remote.med,
          visits: remote.visits,
        }
      : {
          name: profile?.nickname || "부모님",
          birthYear: profile?.birthYear || 1955,
          region: `${shortSido(profile?.sido || "")} ${profile?.sigungu || ""}`.trim(),
          quizLogs: state.quizLogs,
          med: state.med,
          visits: state.visits,
        };

  const todayMed = data.med[today] ?? { morning: false, evening: false };
  const todayLogs = data.quizLogs.filter((q) => q.date === today);
  const todayPoints = todayLogs.reduce((a, b) => a + b.points, 0);
  const visitedToday = data.visits.includes(today);
  const parentStreak = calcStreak(
    { ...state, quizLogs: data.quizLogs, med: data.med, visits: data.visits },
    today
  );

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });

  if (!ready) {
    return <div className="p-6 text-center font-bold text-ink/50">불러오는 중…</div>;
  }

  if (!profile && !remote && !queryCode) {
    return (
      <div className="mx-auto max-w-[460px] px-4 py-10">
        <Card>
          <p className="text-center text-[1.1rem] font-black">아직 연결된 부모님이 없어요</p>
          <p className="mt-2 text-center text-[0.95rem] font-semibold text-ink/60">
            부모님 휴대폰의 <b>가족 연결</b> 화면에서 6자리 가족 코드를 받아 아래에 넣어 주세요.
          </p>
          <Divider />
          <input
            className="field text-center text-[1.4rem] font-black tracking-[0.3em]"
            placeholder="가족 코드 6자리"
            value={lookupCode}
            maxLength={6}
            onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
          />
          <div className="mt-3">
            <BigButton
              full
              variant="brand"
              onClick={() => {
                if (lookupCode.length < 6) {
                  show("6자리 코드를 넣어 주세요.");
                  return;
                }
                window.location.href = `/family/?code=${lookupCode}`;
              }}
            >
              부모님 안부 확인하기
            </BigButton>
          </div>
        </Card>
        <Link href="/" className="mt-4 block text-center text-[0.95rem] font-bold text-brand">
          ← 처음 화면으로
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[460px] px-4 pb-10 pt-[calc(env(safe-area-inset-top,0px)+18px)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[0.82rem] font-extrabold text-brand">자녀 확인 화면</p>
          <h1 className="text-[1.45rem] font-black leading-tight">{data.name} 님의 오늘</h1>
          <p className="text-[0.9rem] font-semibold text-ink/55">
            {koreanDate(today)} · {data.region || "지역 미설정"} · {2026 - data.birthYear}세
          </p>
        </div>
        <Link href="/" className="whitespace-nowrap rounded-xl border-2 border-ink/12 bg-white px-3 py-2 text-[0.82rem] font-extrabold">
          부모님 화면
        </Link>
      </div>

      {loading ? <p className="mb-2 text-center text-[0.85rem] font-bold text-ink/50">불러오는 중…</p> : null}

      <Card className="mb-4 bg-gradient-to-br from-white to-brand-light/50">
        <div className="flex items-center gap-3">
          <div
            className={`grid h-14 w-14 place-items-center rounded-2xl text-[1.6rem] ${
              visitedToday ? "bg-leaf-light" : "bg-warm-light"
            }`}
          >
            {visitedToday ? "✅" : "⏰"}
          </div>
          <div>
            <p className="text-[1.1rem] font-black">
              {visitedToday ? "오늘 앱에 접속했어요" : "오늘 아직 접속하지 않았어요"}
            </p>
            <p className="text-[0.92rem] font-semibold text-ink/60">
              최근 접속 {data.visits.length > 0 ? data.visits[data.visits.length - 1] : "-"}
            </p>
          </div>
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-[0.85rem] font-extrabold text-ink/55">아침 약</p>
          <p className={`mt-1 text-[1.2rem] font-black ${todayMed.morning ? "text-leaf" : "text-ink/40"}`}>
            {todayMed.morning ? "✓ 먹었어요" : "○ 아직"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[0.85rem] font-extrabold text-ink/55">저녁 약</p>
          <p className={`mt-1 text-[1.2rem] font-black ${todayMed.evening ? "text-leaf" : "text-ink/40"}`}>
            {todayMed.evening ? "✓ 먹었어요" : "○ 아직"}
          </p>
        </Card>
      </div>

      <Card className="mb-4">
        <SectionTitle emoji="🧠">오늘의 두뇌 활동</SectionTitle>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[1.05rem] font-black">
              {todayLogs.length > 0 ? `퀴즈 ${todayLogs[0].correct}/${todayLogs[0].total} 정답` : "아직 퀴즈를 하지 않았어요"}
            </p>
            <p className="text-[0.9rem] font-semibold text-ink/60">
              {todayLogs.length > 0 ? `오늘 ${todayPoints}점 획득` : "1분이면 충분해요"}
            </p>
          </div>
          <Badge tone="leaf">🔥 {parentStreak}일 연속</Badge>
        </div>
        <Divider />
        <p className="mb-2 text-[0.85rem] font-extrabold text-ink/55">최근 7일</p>
        <div className="flex justify-between gap-1">
          {days.map((d) => {
            const did = data.visits.includes(d) || data.quizLogs.some((q) => q.date === d);
            const m = data.med[d];
            const tookMed = Boolean(m?.morning || m?.evening);
            return (
              <div key={d} className="flex-1 text-center">
                <div
                  className={`mx-auto mb-1 grid h-9 w-9 place-items-center rounded-full text-[0.8rem] font-black ${
                    did ? "bg-brand text-white" : "bg-ink/8 text-ink/35"
                  }`}
                >
                  {d.slice(8, 10)}
                </div>
                <span className={`text-[0.7rem] font-bold ${tookMed ? "text-leaf" : "text-ink/30"}`}>
                  {tookMed ? "약✓" : "·"}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="mb-4 bg-gradient-to-br from-white to-gold-light/60">
        <p className="text-[1.05rem] font-black">
          이번 주 {weekPoints}점
        </p>
        <p className="mt-1 text-[0.92rem] font-semibold text-ink/65">
          부모님이 꾸준히 참여하고 계세요. 전화 한 통 어떠세요?
        </p>
        <div className="mt-3">
          <BigButton
            variant="warm"
            full
            onClick={() => {
              window.location.href = `tel:`;
            }}
          >
            📞 부모님께 전화하기
          </BigButton>
        </div>
      </Card>

      <p className="mt-2 rounded-2xl bg-white/70 px-4 py-3 text-center text-[0.8rem] font-semibold leading-relaxed text-ink/50">
        이 화면은 부모님이 보낸 가족 코드로 열렸어요. 부모님 정보는 안부 확인 목적으로만 보여 드려요.
      </p>
    </div>
  );
}

export default function FamilyPage() {
  return (
    <AppProvider>
      <ToastProvider>
        <div className="min-h-dvh bg-[#F3ECDD]">
          <Dashboard />
        </div>
      </ToastProvider>
    </AppProvider>
  );
}
