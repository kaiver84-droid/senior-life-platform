"use client";

/**
 * 더보기 탭 맨 위 ‘🌱 늘봄 현황’ 카드.
 * 왼쪽 ‘전체 가입 N명’ · 오른쪽 ‘● 현재 접속 N명’ — 더보기 탭을 열 때마다 /api/stats 로 최신 숫자를 받는다.
 * 숫자를 받기 전에는 ‘—’ 를 같은 자리에 두어 카드 높이가 흔들리지 않는다.
 */
import { useEffect, useState } from "react";
import { useApp } from "@/lib/storage";
import { fetchCommunityStats, type CommunityStats } from "@/lib/stats";

/** 화면을 오래 열어 두어도 ‘현재 접속’이 멈춰 보이지 않게 1분마다 다시 센다 */
const REFRESH_MS = 60 * 1000;

function StatTile({
  label,
  count,
  live,
}: {
  label: string;
  count: number | null;
  live?: boolean;
}) {
  return (
    <div data-stat-tile={live ? "online" : "total"} className="rounded-[1.1rem] bg-paper px-2 py-2 text-center">
      <p className="flex items-center justify-center gap-1 whitespace-nowrap text-[0.82rem] font-bold leading-tight text-ink/55">
        {live ? <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full bg-leaf" /> : null}
        {label}
      </p>
      <p className="mt-0.5 text-[1.12rem] font-black leading-tight text-ink tabular-nums">
        {count === null ? "—" : `${count.toLocaleString("ko-KR")}명`}
      </p>
    </div>
  );
}

export function CommunityStatsCard() {
  const { code } = useApp();
  const [stats, setStats] = useState<CommunityStats | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const next = await fetchCommunityStats(code);
      if (alive && next) setStats(next);
    };
    void load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [code]);

  return (
    <section data-stats-card aria-label="늘봄 현황" className="fade-up card p-3.5">
      <p className="flex items-center gap-1.5 text-[0.98rem] font-black text-ink">
        <span aria-hidden className="text-[1.05rem]">
          🌱
        </span>
        늘봄 현황
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <StatTile label="전체 가입" count={stats ? stats.totalUsers : null} />
        <StatTile label="현재 접속" count={stats ? stats.onlineUsers : null} live />
      </div>
    </section>
  );
}
