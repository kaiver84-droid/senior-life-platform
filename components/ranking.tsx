"use client";

import React, { useEffect, useMemo, useState } from "react";
import { buildAreaRanking, buildGroupRanking } from "@/lib/rankings";
import type {
  AppState,
  GroupRankingResult,
  GroupRankingRow,
  RankingChange,
  RankingRange,
  RankingResult,
  RankingRow,
} from "@/lib/types";
import { periodLabel, resetCountdown, weekIdOf } from "@/lib/week";
import { useApp } from "@/lib/storage";
import { useGroup } from "@/lib/group-store";
import {
  AGE_BANDS,
  LEAGUE_AREAS,
  LEAGUE_DAILY_CAP,
  LEAGUE_MISSIONS,
  LEAGUE_POINTS,
  ageBandLabel,
  ageBandOf,
  areaInfo,
  formatAreaValue,
  gapMessage,
  leagueWeek,
  myAreaValue,
  weekDatesOf,
  type LeagueArea,
} from "@/lib/league";
import { Avatar, Badge, BigButton, Card, SectionTitle } from "./ui";
import { IconChevron, IconQuiz, IconSparkle, IconTrophy, IconUsers } from "./icons";
import { GroupRankingBanner } from "./groups";

/* ------------------------------------------------------------------ */
/* 공통                                                                */
/* ------------------------------------------------------------------ */

const RANGES: { key: RankingRange; label: string; emoji: string }[] = [
  { key: "group", label: "우리 모임", emoji: "👥" },
  { key: "region", label: "지역별", emoji: "🏘️" },
  { key: "national", label: "전국", emoji: "🇰🇷" },
  { key: "age", label: "연령대", emoji: "🎂" },
];

/** 미션 화면으로 넘어가며 그 카드가 보이게 내려 준다(잠깐 노란 테두리) */
function revealLater(selector: string, tries = 0) {
  if (typeof document === "undefined") return;
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) {
    if (tries < 8) window.setTimeout(() => revealLater(selector, tries + 1), 160);
    return;
  }
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("ring-4", "ring-gold/70");
  window.setTimeout(() => el.classList.remove("ring-4", "ring-gold/70"), 1600);
}

/** 순위 변동 배지 — ▲2 · ▼1 · 신규 · － */
function ChangeBadge({ change }: { change?: RankingChange }) {
  if (change === undefined) return null;
  const text = change === null ? "신규" : change > 0 ? `▲${change}` : change < 0 ? `▼${Math.abs(change)}` : "－";
  const tone =
    change === null
      ? "bg-brand-light text-brand-deep"
      : change > 0
        ? "bg-leaf-light text-leaf-dark"
        : change < 0
          ? "bg-coral-light text-coral-dark"
          : "bg-ink/8 text-ink/45";
  return (
    <span
      data-change={change === null ? "new" : String(change)}
      className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[0.78rem] font-black leading-none ${tone}`}
    >
      {text}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* 영역 · 범위 고르기                                                   */
/* ------------------------------------------------------------------ */

function AreaTabs({
  value,
  onChange,
  myTotal,
}: {
  value: LeagueArea;
  onChange: (v: LeagueArea) => void;
  myTotal: number;
}) {
  const [main, ...rest] = LEAGUE_AREAS;
  const on = value === main.key;
  return (
    <div className="space-y-2" role="tablist" aria-label="랭킹 영역">
      <button
        role="tab"
        aria-selected={on}
        data-rank-tab={main.key}
        data-area-tab={main.key}
        onClick={() => onChange(main.key)}
        className={`flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left transition ${
          on ? "bg-ink text-white shadow-cta" : "bg-white text-ink shadow-soft active:bg-paper"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className="text-[1.5rem] leading-none">
            {main.emoji}
          </span>
          <span className="min-w-0">
            <span className="block text-[1.05rem] font-black leading-tight">{main.label}</span>
            <span className={`block text-[0.82rem] font-bold ${on ? "text-white/75" : "text-ink/45"}`}>
              주간 종합 리그
            </span>
          </span>
        </span>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[0.82rem] font-black ${
            on ? "bg-white/15 text-white" : "bg-brand-light text-brand-deep"
          }`}
        >
          내 {myTotal}점
        </span>
      </button>

      <div className="grid grid-cols-3 gap-2">
        {rest.map((a) => {
          const selected = a.key === value;
          return (
            <button
              key={a.key}
              role="tab"
              aria-selected={selected}
              data-rank-tab={a.key}
              data-area-tab={a.key}
              onClick={() => onChange(a.key)}
              className={`flex min-h-[70px] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 transition ${
                selected ? "bg-ink text-white shadow-cta" : "bg-white text-ink/65 shadow-soft active:bg-paper"
              }`}
            >
              <span aria-hidden className="text-[1.05rem] leading-none">
                {a.emoji}
              </span>
              <span className="whitespace-nowrap text-[0.94rem] font-extrabold leading-tight">{a.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RangeTabs({
  value,
  onChange,
  band,
  onBand,
}: {
  value: RankingRange;
  onChange: (v: RankingRange) => void;
  band: number;
  onBand: (v: number) => void;
}) {
  return (
    <div className="space-y-2" data-range-tabs>
      <div className="grid grid-cols-2 gap-2">
        {RANGES.map((r) => {
          const on = r.key === value;
          return (
            <button
              key={r.key}
              data-range-tab={r.key}
              aria-pressed={on}
              onClick={() => onChange(r.key)}
              className={`flex min-h-[52px] items-center justify-center gap-1.5 rounded-2xl px-2 text-[0.96rem] font-extrabold transition ${
                on ? "bg-brand text-white shadow-soft" : "bg-white text-ink/60 shadow-soft active:bg-paper"
              }`}
            >
              <span aria-hidden>{r.emoji}</span>
              <span className="whitespace-nowrap">{r.label}</span>
            </button>
          );
        })}
      </div>
      {value === "age" ? (
        <div className="grid grid-cols-4 gap-2" data-age-bands>
          {AGE_BANDS.map((b) => {
            const on = b === band;
            return (
              <button
                key={b}
                data-age-band={b}
                aria-pressed={on}
                onClick={() => onBand(b)}
                className={`min-h-[48px] rounded-xl px-1 text-[0.9rem] font-extrabold transition ${
                  on ? "bg-ink text-white" : "bg-white text-ink/55 shadow-soft"
                }`}
              >
                {ageBandLabel(b)}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function OptInCard() {
  const { rankingVisible, setRankingVisible } = useApp();
  return (
    <div
      data-ranking-optin={rankingVisible ? "on" : "off"}
      className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-3 shadow-soft"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[0.98rem] font-black leading-tight text-ink">랭킹 참여</p>
        <p className="mt-0.5 text-[0.82rem] font-semibold leading-snug text-ink/55">
          {rankingVisible
            ? "순위표에 내 이름이 보여요. 끄면 나만 볼 수 있어요."
            : "지금은 순위표에 나오지 않아요. 내 점수는 그대로 남아요."}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={rankingVisible}
        aria-label="랭킹 참여"
        onClick={() => setRankingVisible(!rankingVisible)}
        className={`relative h-[44px] w-[78px] shrink-0 rounded-full transition ${
          rankingVisible ? "bg-leaf" : "bg-ink/25"
        }`}
      >
        <span
          className={`absolute top-[4px] grid h-[36px] w-[36px] place-items-center rounded-full bg-white text-[0.74rem] font-black text-ink shadow transition-all ${
            rankingVisible ? "left-[38px]" : "left-[4px]"
          }`}
        >
          {rankingVisible ? "ON" : "OFF"}
        </span>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 오늘의 종합 미션 (늘봄왕)                                           */
/* ------------------------------------------------------------------ */

function LeagueMissionCard({
  invitesByDay,
  onGo,
}: {
  invitesByDay?: Record<string, number>;
  onGo: (area: LeagueArea) => void;
}) {
  const { state, today, missionsToday, healthToday, todayDaily } = useApp();
  const week = leagueWeek(state, { today, invitesByDay });
  const score = week.today;
  const percent = Math.min(100, Math.round((score.total / LEAGUE_DAILY_CAP) * 100));
  const invitesToday = Math.max(0, Math.round(invitesByDay?.[today] ?? 0));

  const doneOf = (id: string) =>
    id === "attend"
      ? state.visits.includes(today)
      : id === "quiz"
        ? Boolean(todayDaily?.done)
        : id === "health"
          ? healthToday.length > 0
          : missionsToday.includes(id);

  return (
    <Card
      className="p-4"
      data-league-missions
      data-league-today={score.total}
      data-league-week={week.total}
      data-league-cap={LEAGUE_DAILY_CAP}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[1.02rem] font-black text-ink">
            <span aria-hidden>🌟</span> 오늘의 종합 미션
          </p>
          <p className="mt-0.5 text-[0.82rem] font-semibold text-ink/50">
            하나씩 해 볼수록 늘봄왕 점수가 쌓여요
          </p>
        </div>
        <span
          data-league-score={`${score.total}/${LEAGUE_DAILY_CAP}`}
          className={`shrink-0 rounded-full px-2.5 py-1 text-[0.82rem] font-black ${
            score.total >= LEAGUE_DAILY_CAP ? "bg-gold text-ink" : "bg-brand-light text-brand-deep"
          }`}
        >
          오늘 {score.total}점
        </span>
      </div>

      <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-ink/8">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand to-leaf transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 text-right text-[0.78rem] font-bold text-ink/40">하루 최대 {LEAGUE_DAILY_CAP}점</p>

      <div className="mt-1 space-y-1.5">
        {LEAGUE_MISSIONS.map((m) => {
          const done = doneOf(m.id);
          return (
            <button
              key={m.id}
              type="button"
              data-league-mission={m.id}
              data-league-done={done ? "1" : "0"}
              aria-pressed={done}
              onClick={() => onGo(m.area)}
              className={`flex min-h-[56px] w-full items-center gap-2.5 rounded-2xl border-2 px-3 py-2 text-left transition active:scale-[0.995] ${
                done ? "border-leaf bg-leaf-light" : "border-ink/8 bg-paper"
              }`}
            >
              <span aria-hidden className="text-[1.2rem] leading-none">
                {m.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[0.98rem] font-black leading-tight ${done ? "text-leaf-dark" : "text-ink"}`}>
                  {m.label}
                </span>
                <span className="mt-0.5 block text-[0.78rem] font-semibold text-ink/45">{m.note}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-[0.86rem] font-black text-brand-dark">+{m.points}점</span>
                <span className="block text-[0.74rem] font-extrabold text-ink/40">
                  {done ? "완료 ✅" : "눌러서 가기"}
                </span>
              </span>
            </button>
          );
        })}
        <div
          data-league-mission="invite"
          className="flex min-h-[52px] items-center gap-2.5 rounded-2xl border-2 border-ink/8 bg-paper px-3 py-2"
        >
          <span aria-hidden className="text-[1.2rem] leading-none">
            🎁
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.98rem] font-black leading-tight text-ink">친구 초대 성공</span>
            <span className="mt-0.5 block text-[0.78rem] font-semibold text-ink/45">
              한 명마다 · 오늘 {invitesToday}명 초대
            </span>
          </span>
          <span className="shrink-0 text-[0.86rem] font-black text-brand-dark">+{LEAGUE_POINTS.invite}점</span>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* 시상대 · 4위 이하 목록                                              */
/* ------------------------------------------------------------------ */

function Podium({ rows, area }: { rows: RankingResult["rows"]; area: LeagueArea }) {
  const first = rows[0];
  const second = rows[1];
  const third = rows[2];
  const value = (r?: RankingRow) => (!r ? "" : r.display || formatAreaValue(area, r.points));

  const Column = ({
    row,
    place,
    height,
    bar,
    tone,
  }: {
    row?: RankingRow;
    place: number;
    height: number;
    bar: string;
    tone: string;
  }) => (
    <div className="flex min-w-0 flex-1 flex-col items-center">
      <div className="relative mb-1 flex h-[34px] items-end justify-center">
        {place === 1 ? <span className="text-[1.7rem] leading-none drop-shadow">👑</span> : null}
      </div>
      <Avatar
        name={row?.name}
        src={row?.avatarUrl}
        size={place === 1 ? 62 : 50}
        ring={place === 1 ? "ring-4 ring-gold/60" : undefined}
        background={tone}
        className="text-white shadow-soft"
        alt={row ? `${row.name} 님 프로필 사진` : undefined}
      />
      <p
        className={`mt-1.5 max-w-full truncate text-center ${
          place === 1 ? "text-[0.98rem]" : "text-[0.88rem]"
        } font-black text-ink`}
      >
        {row ? row.name : "-"}
      </p>
      {row ? <ChangeBadge change={row.change} /> : null}
      <p className={`tabular mt-0.5 text-center text-[0.82rem] font-extrabold ${place === 1 ? "text-gold-dark" : "text-ink/55"}`}>
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
      <Column row={second} place={2} height={62} bar="bg-[#9FB3C8]" tone="bg-[#9FB3C8]" />
      <Column
        row={first}
        place={1}
        height={92}
        bar="bg-gradient-to-b from-gold to-[#E9AE20]"
        tone="bg-gradient-to-br from-[#F7C346] to-[#E09A12]"
      />
      <Column row={third} place={3} height={46} bar="bg-[#D8A583]" tone="bg-[#D8A583]" />
    </div>
  );
}

function RestList({ rows, area }: { rows: RankingResult["rows"]; area: LeagueArea }) {
  if (!rows.length) return null;
  return (
    <Card className="p-3.5" data-rest-list>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[0.86rem] font-black text-ink/60">4위 ~ {3 + rows.length}위</p>
        <p className="text-[0.76rem] font-bold text-ink/35">어제 대비</p>
      </div>
      <div className="space-y-1">
        {rows.map((row) => (
          <div
            key={`${row.rank}-${row.name}`}
            className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 ${row.isMe ? "bg-brand-light" : ""}`}
          >
            <span className="w-6 shrink-0 text-center text-[0.92rem] font-black text-ink/45">{row.rank}</span>
            <Avatar
              name={row.name}
              src={row.avatarUrl}
              size={30}
              background="bg-white"
              className="text-brand-dark shadow-soft"
              alt={row.name ? `${row.name} 님 프로필 사진` : undefined}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span
                  className={`truncate text-[0.96rem] ${
                    row.isMe ? "font-black text-brand-deep" : "font-bold text-ink/85"
                  }`}
                >
                  {row.name}
                  {row.isMe ? <span className="ml-1 text-[0.74rem] font-extrabold text-brand">(나)</span> : null}
                </span>
                <ChangeBadge change={row.change} />
              </span>
              {row.note ? <span className="block text-[0.76rem] font-semibold text-ink/40">{row.note}</span> : null}
            </span>
            <span className="shrink-0 tabular text-[0.92rem] font-extrabold text-ink/70">
              {row.display || formatAreaValue(area, row.points)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* 내 순위 · 격차 안내                                                 */
/* ------------------------------------------------------------------ */

function MyRankCard({
  view,
  area,
  localValue,
  localNote,
}: {
  view: RankingResult;
  area: LeagueArea;
  localValue: number;
  localNote?: string;
}) {
  const { rankingVisible, setRankingVisible } = useApp();
  const info = areaInfo(area);

  if (!rankingVisible) {
    return (
      <Card className="bg-gradient-to-br from-brand-light/70 to-white p-4" data-rank-me="off">
        <p className="text-[1rem] font-black text-ink">랭킹 참여를 꺼 두었어요</p>
        <p className="mt-1 text-[0.86rem] font-semibold leading-relaxed text-ink/60">
          내 점수는 나만 볼 수 있고, 공개 순위표에는 나오지 않아요.
        </p>
        <div className="mt-2.5">
          <BigButton variant="teal" full onClick={() => setRankingVisible(true)}>
            랭킹 참여 켜기
          </BigButton>
        </div>
      </Card>
    );
  }

  const gap = view.myGap;
  const rank = view.myRank;
  const display = view.myDisplay ?? formatAreaValue(area, localValue);
  const note = view.myNote ?? localNote;

  return (
    <Card className="bg-gradient-to-br from-brand-light/70 to-white p-4" data-rank-me="on">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[0.8rem] font-bold text-ink/50">내 순위</p>
          <p className="mt-0.5 text-[1.5rem] font-black leading-none text-brand-deep">
            {rank ? (
              <>
                {rank}
                <span className="text-[0.92rem] font-extrabold text-ink/45">위 / {view.total}명</span>
              </>
            ) : (
              <span className="text-[1.05rem] text-ink/45">아직 기록이 없어요</span>
            )}
          </p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[0.8rem] font-bold text-ink/50">내 {info.label.replace("왕", "")} 기록</p>
          <p className="t-num tabular text-brand-dark" data-rank-my-value={display}>
            {display}
          </p>
          <p className="text-[0.82rem] font-extrabold text-leaf-dark">
            {rank ? <ChangeBadge change={view.myChange} /> : note || ""}
          </p>
        </div>
      </div>
      <p
        data-rank-gap
        className="mt-2 rounded-xl bg-white/85 px-3 py-2 text-center text-[0.92rem] font-bold leading-snug text-brand-deep"
      >
        {gapMessage({ rank, aheadDiff: gap?.aheadDiff, top10Diff: gap?.top10Diff, total: view.total })}
      </p>
      {note && rank ? (
        <p className="mt-1 text-center text-[0.78rem] font-semibold text-ink/45">{note}</p>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* 우리 모임 순위 (모임 회원 자료)                                      */
/* ------------------------------------------------------------------ */

function GroupRankingBoard({
  onNavigate,
  compact = false,
}: {
  onNavigate?: (tab: string) => void;
  compact?: boolean;
}) {
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

  const rows: RankingRow[] = detail.members
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((m) => ({
      rank: m.rank,
      name: m.name,
      points: m.points,
      streak: m.weekDays,
      isMe: m.isMe,
      avatarUrl: m.avatarUrl,
      display: `${m.points}점`,
    }));
  const rest = rows.slice(3, 10);
  const me = rows.find((r) => r.isMe);

  return (
    <div className="space-y-3">
      <div
        data-podium
        className="overflow-hidden rounded-[1.6rem] bg-gradient-to-b from-[#FFF9EA] via-white to-[#F3FAF8] p-4 shadow-card"
      >
        <div className="mb-1 flex items-center justify-center gap-1.5 text-[0.8rem] font-extrabold text-gold-dark">
          <IconTrophy size={16} /> {active.name} · {periodLabel()}
        </div>
        <Podium rows={rows.slice(0, 10)} area="brain" />

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

      <RestList rows={rest} area="brain" />

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
            <p className="t-num tabular text-brand-dark">{weekPoints}점</p>
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

      {compact ? null : <GroupRankingBanner onNavigate={onNavigate} />}

      <p className="rounded-2xl bg-white/70 px-4 py-3 text-center text-[0.8rem] font-semibold leading-relaxed text-ink/50">
        매주 월요일 0시에 우리 모임 순위도 새로 시작해요 (앞으로 {resetCountdown()}).
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 단체별 순위 (모임 vs 모임)                                          */
/* ------------------------------------------------------------------ */

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
    tone,
  }: {
    row?: GroupRankingRow;
    place: number;
    height: number;
    bar: string;
    tone: string;
  }) => (
    <div className="flex min-w-0 flex-1 flex-col items-center">
      <div className="relative mb-1 flex h-[32px] items-end justify-center">
        {place === 1 ? <span className="text-[1.6rem] leading-none drop-shadow">👑</span> : null}
      </div>
      <Avatar
        name={row?.name}
        size={place === 1 ? 56 : 46}
        ring={place === 1 ? "ring-4 ring-gold/60" : undefined}
        background={tone}
        className="text-white shadow-soft"
      />
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
      <Column row={rows[1]} place={2} height={62} bar="bg-[#9FB3C8]" tone="bg-[#9FB3C8]" />
      <Column
        row={rows[0]}
        place={1}
        height={92}
        bar="bg-gradient-to-b from-gold to-[#E9AE20]"
        tone="bg-gradient-to-br from-[#F7C346] to-[#E09A12]"
      />
      <Column row={rows[2]} place={3} height={46} bar="bg-[#D8A583]" tone="bg-[#D8A583]" />
    </div>
  );
}

function GroupsBoard({ onNavigate, loading }: { onNavigate?: (tab: string) => void; loading: boolean }) {
  const { view } = useGroupRanking();
  const rows = view.rows;
  const mine = rows.find((r) => r.isMine) ?? null;
  const rest = rows.slice(3);

  return (
    <div className="space-y-3" data-group-rank>
      <div
        data-podium
        className="overflow-hidden rounded-[1.6rem] bg-gradient-to-b from-[#FFF9EA] via-white to-[#F3FAF8] p-4 shadow-card"
      >
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
                    className={`truncate text-[0.94rem] ${
                      r.isMine ? "font-black text-brand-deep" : "font-bold text-ink/85"
                    }`}
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

/* ------------------------------------------------------------------ */
/* 영역 순위표 + 내 순위                                                */
/* ------------------------------------------------------------------ */

/** 이 기기 기록으로 만든 내 날짜별 값 — 서버 집계에 함께 보내 바로 반영한다 */
function localDaily(area: LeagueArea, state: AppState, today: string): number[] {
  const dates = weekDatesOf(today);
  const missions = state.missions ?? {};
  const health = state.health ?? {};
  const quizLogs = state.quizLogs ?? [];
  const visits = state.visits ?? [];
  if (area === "all") {
    const week = leagueWeek({ ...state, missions }, { today });
    return week.scores.map((s) => s.total);
  }
  return dates.map((d) => {
    if (d > today) return 0;
    switch (area) {
      case "brain":
        return quizLogs.filter((q) => q.date === d).reduce((sum, q) => sum + (Number(q.points) || 0), 0);
      case "health":
        return (health[d] ?? []).length;
      case "attend":
        return visits.includes(d) ? 1 : 0;
      case "save":
        return (missions[d] ?? []).includes("welfare") ? 1 : 0;
      default:
        return 0;
    }
  });
}

function useAreaRanking(area: LeagueArea, range: RankingRange, band: number) {
  const { profile, streak, weekPoints, code, today, state, rankingVisible } = useApp();
  const weekId = weekIdOf(today);
  const [data, setData] = useState<RankingResult | null>(null);
  const [loading, setLoading] = useState(true);

  const myDaily = useMutableDaily(area, state, today);

  const fallback = useMemo(
    () =>
      buildAreaRanking({
        area,
        range,
        weekId,
        today,
        sido: profile?.sido,
        sigungu: profile?.sigungu,
        band,
        me: rankingVisible
          ? {
              name: profile?.nickname || "나",
              avatarUrl: profile?.avatarUrl || profile?.avatar,
              isMe: true,
              daily: myDaily,
            }
          : null,
      }),
    [area, range, weekId, today, profile?.sido, profile?.sigungu, profile?.nickname, profile?.avatarUrl, profile?.avatar, band, rankingVisible, myDaily]
  );

  useEffect(() => {
    if (range === "group" || area === "group") {
      setLoading(false);
      setData(null);
      return;
    }
    const params = new URLSearchParams({
      area,
      range,
      weekId,
      today,
      code: code || "",
      sido: profile?.sido || "",
      sigungu: profile?.sigungu || "",
      birthYear: String(profile?.birthYear || 1955),
      band: String(band),
      visible: rankingVisible ? "1" : "0",
      myd: myDaily.join(","),
    });
    let alive = true;
    setLoading(true);
    setData(null);
    fetch(`/api/rankings?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad"))))
      .then((j) => {
        if (!alive) return;
        if (j?.ok && Array.isArray(j.rows) && !j.delegate) setData(j as RankingResult);
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
  }, [area, range, weekId, today, code, profile?.sido, profile?.sigungu, profile?.birthYear, band, rankingVisible, myDaily, fallback]);

  return { view: data ?? fallback, loading, streak, weekPoints };
}

/** 배열이 매번 새로 만들어지지 않도록 문자열로 비교한다(불필요한 재요청 방지) */
function useMutableDaily(area: LeagueArea, state: AppState, today: string) {
  const key = `${area}|${today}|${(state.visits ?? []).join(",")}|${(state.quizLogs ?? [])
    .map((q) => `${q.date}:${q.points}`)
    .join(",")}|${JSON.stringify(state.health ?? {})}|${JSON.stringify(state.missions ?? {})}`;
  return useMemo(() => localDaily(area, state, today), [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

function AreaBoard({
  area,
  range,
  band,
  onNavigate,
  onGo,
  invitesByDay,
}: {
  area: LeagueArea;
  range: RankingRange;
  band: number;
  onNavigate?: (tab: string) => void;
  onGo: (area: LeagueArea) => void;
  invitesByDay?: Record<string, number>;
}) {
  const { view, loading } = useAreaRanking(area, range, band);
  const { state, today, rankingVisible, streak } = useApp();
  const info = areaInfo(area);
  const rest = view.rows.slice(3, 10);
  const invites = view.invitesByDay ?? invitesByDay;
  const localValue =
    area === "all"
      ? leagueWeek({ ...state, missions: state.missions ?? {} }, { today, invitesByDay: invites }).total
      : myAreaValue(area, { ...state, missions: state.missions ?? {} }, { today, invites: view.myInvites });

  return (
    <div className="space-y-3" data-area-board={area}>
      {area === "all" ? <LeagueMissionCard invitesByDay={invites} onGo={onGo} /> : null}
      <div
        data-podium
        className="overflow-hidden rounded-[1.6rem] bg-gradient-to-b from-[#FFF9EA] via-white to-[#F3FAF8] p-4 shadow-card"
      >
        <div className="mb-1 flex items-center justify-center gap-1.5 text-[0.8rem] font-extrabold text-gold-dark">
          <IconTrophy size={16} /> {periodLabel()} {info.label} 명예의 전당
        </div>
        <Podium rows={view.rows} area={area} />
        <div className="mt-3 rounded-2xl bg-gradient-to-r from-plum to-[#5B4FA8] px-3.5 py-2.5 text-center">
          <p className="flex items-center justify-center gap-1.5 text-[0.9rem] font-black text-white">
            <IconSparkle size={16} className="text-[#FFE28A]" />
            {view.rows[0]
              ? `${view.rows[0].name} 님, 이번 주 ${info.label} 1위를 축하합니다!`
              : `이번 주 ${info.label} 1위를 기다리고 있어요`}
          </p>
        </div>
      </div>

      <RestList rows={rest} area={area} />

      <MyRankCard view={view} area={area} localValue={localValue} />

      <p className="rounded-2xl bg-white/70 px-4 py-3 text-center text-[0.8rem] font-semibold leading-relaxed text-ink/50">
        공개 순위표에는 10위까지만 보여 드려요. 매주 월요일 0시에 새로 시작해요 (앞으로 {resetCountdown()}).
        <br />
        {rankingVisible
          ? `이름은 뒤 글자를 가려서 보여 드려요.${view.sample ? " 지금은 예시 순위가 함께 있어요." : ""}`
          : "랭킹 참여를 끄면 내 이름은 다른 사람에게 보이지 않아요."}
        {loading ? " 순위를 새로 불러오는 중…" : ""}
        {streak >= 3 ? ` 🔥 ${streak}일 연속 출석 중이에요.` : ""}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 랭킹 보드 (영역 + 범위)                                             */
/* ------------------------------------------------------------------ */

export function RankingBoard({
  initialScope = "all",
  onNavigate,
  invitesByDay,
}: {
  initialScope?: "all" | LeagueArea;
  onNavigate?: (tab: string) => void;
  invitesByDay?: Record<string, number>;
}) {
  const { profile, state, today } = useApp();
  const [area, setArea] = useState<LeagueArea>(initialScope);
  const [range, setRange] = useState<RankingRange>("region");
  const [band, setBand] = useState<number>(() => ageBandOf(profile?.birthYear));
  const [groupView, setGroupView] = useState<"my" | "all">("my");

  const myTotal = leagueWeek({ ...state, missions: state.missions ?? {} }, { today, invitesByDay }).total;

  const go = (target: LeagueArea) => {
    if (target === "all") {
      revealLater("[data-league-missions]");
      return;
    }
    if (!onNavigate) return;
    if (target === "brain") onNavigate("quiz");
    else if (target === "health") {
      onNavigate("home");
      revealLater("[data-health-card]");
    } else if (target === "attend") {
      onNavigate("home");
      revealLater("[data-home-hero]");
    } else if (target === "group") {
      onNavigate("group");
      revealLater("[data-group-mission]");
    } else if (target === "share") {
      onNavigate("group");
      window.setTimeout(() => window.dispatchEvent(new CustomEvent("neulbom:invite")), 260);
    } else if (target === "save") {
      onNavigate("welfare");
      revealLater("[data-welfare-filters]");
    }
  };

  return (
    <div className="space-y-3">
      <AreaTabs value={area} onChange={setArea} myTotal={myTotal} />

      <p className="text-center text-[0.8rem] font-semibold text-ink/45">{areaInfo(area).desc}</p>

      {area === "group" ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            data-group-view="my"
            aria-pressed={groupView === "my"}
            onClick={() => setGroupView("my")}
            className={`min-h-[52px] rounded-2xl text-[0.96rem] font-extrabold ${
              groupView === "my" ? "bg-ink text-white shadow-cta" : "bg-white text-ink/60 shadow-soft"
            }`}
          >
            우리 모임
          </button>
          <button
            data-group-view="all"
            aria-pressed={groupView === "all"}
            onClick={() => setGroupView("all")}
            className={`min-h-[52px] rounded-2xl text-[0.96rem] font-extrabold ${
              groupView === "all" ? "bg-ink text-white shadow-cta" : "bg-white text-ink/60 shadow-soft"
            }`}
          >
            단체별
          </button>
        </div>
      ) : (
        <RangeTabs value={range} onChange={setRange} band={band} onBand={setBand} />
      )}

      <OptInCard />

      {area === "group" ? (
        groupView === "my" ? (
          <GroupRankingBoard onNavigate={onNavigate} compact />
        ) : (
          <GroupsBoard onNavigate={onNavigate} loading={false} />
        )
      ) : range === "group" ? (
        <GroupRankingBoard onNavigate={onNavigate} compact />
      ) : (
        <AreaBoard
          area={area}
          range={range}
          band={band}
          onNavigate={onNavigate}
          onGo={go}
          invitesByDay={invitesByDay}
        />
      )}

      <div data-area-mission={area}>
        <BigButton variant="teal" size="lg" full onClick={() => go(area)}>
          <IconSparkle size={20} /> {area === "all" ? areaInfo("all").action : areaInfo(area).action}
        </BigButton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 퀴즈 탭 안의 요약                                                  */
/* ------------------------------------------------------------------ */

export function RankingPanel({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  return (
    <section className="fade-up">
      <SectionTitle
        emoji="🏆"
        right={<span className="text-[0.78rem] font-bold text-ink/40">{periodLabel()}</span>}
      >
        명예의 전당
      </SectionTitle>
      <Card className="flex items-center justify-between gap-2 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[0.98rem] font-black leading-snug text-ink">우리 모임과 이웃 순위가 궁금하세요?</p>
          <p className="mt-0.5 text-[0.85rem] font-semibold text-ink/55">
            늘봄왕 · 두뇌왕 · 건강왕 · 출석왕 · 모임왕 · 나눔왕 · 알뜰왕
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

/* ------------------------------------------------------------------ */
/* 전용 랭킹 화면                                                     */
/* ------------------------------------------------------------------ */

export function RankingTab({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { profile, streak, state, today, todayDaily, rankingVisible, code } = useApp();
  const { active } = useGroup();

  // 친구 초대 성공(+50점/명)은 서버만 안다 — 날짜별 초대 수를 한 번 받아 온다.
  const [invitesByDay, setInvitesByDay] = useState<Record<string, number> | undefined>(undefined);
  useEffect(() => {
    if (!code) return;
    const params = new URLSearchParams({
      area: "share",
      range: "national",
      weekId: weekIdOf(today),
      today,
      code,
    });
    let alive = true;
    fetch(`/api/rankings?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j?.invitesByDay) setInvitesByDay(j.invitesByDay as Record<string, number>);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [code, today]);

  const week = leagueWeek({ ...state, missions: state.missions ?? {} }, { today, invitesByDay });

  return (
    <div className="space-y-4">
      <section className="fade-up pt-1">
        <div className="flex items-center gap-2">
          <Badge tone="gold">🏆 명예의 전당</Badge>
          <Badge tone="brand">{periodLabel()}</Badge>
        </div>
        <h1 className="t-title mt-1.5 text-ink">{profile?.nickname} 님의 이번 주 순위</h1>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="t-sub font-semibold text-ink/60">🔥 {streak}일 연속 출석 · 이번 주 늘봄왕</span>
          <span className="t-num text-brand-deep" data-league-total={week.total}>
            {week.total}점
          </span>
          {active ? <span className="t-sub text-ink/60">· {active.name}</span> : null}
        </div>
        {!rankingVisible ? (
          <p className="mt-1.5 rounded-xl bg-white/80 px-3 py-2 text-[0.82rem] font-bold text-ink/55">
            랭킹 참여를 꺼 두었어요 — 내 점수는 나만 볼 수 있어요.
          </p>
        ) : null}
      </section>

      <RankingBoard onNavigate={onNavigate} invitesByDay={invitesByDay} />

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
