"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getFortune, shortFortuneLine, type Fortune } from "@/lib/fortune";
import { shareLinkFor } from "@/lib/og";
import { JISIN_LINES } from "@/lib/birthtime";
import { fetchWeather, type WeatherInfo } from "@/lib/weather";
import { renderGreetingCard, downloadCanvas, THEMES, type GreetingTheme } from "@/lib/canvas";
import { kakaoConfig } from "@/lib/share";
import { useApp } from "@/lib/storage";
import { koreanDate } from "@/lib/week";
import { lunarShortOf } from "@/lib/lunar";
import { ENABLE_MEMORY_BOX } from "@/lib/flags";
import { shortSido } from "@/lib/regions";
import { ddayLabel, upcomingEvents } from "@/lib/calendar";
import { useGroup } from "@/lib/group-store";
import { matchPrograms } from "@/lib/welfare";
import { buildGroupRanking } from "@/lib/rankings";
import { weekIdOf } from "@/lib/week";
import { BigButton, Stars, Sheet, useToast } from "./ui";
import { TodayAlarmCard } from "./calendar";
import { HealthChallengeCard } from "./health";
import { SharePreviewSheet } from "./share-sheet";
import { MemoryBox } from "./memory-box";
import { SpeakButton } from "./speak";
import { AssetImage, Icon3D, NeulbomMark, RaisedTile, WeatherArt } from "./art";
import { IconChevron, IconDownload, IconShare, IconSparkle } from "./icons";

const PRESETS = ["오늘도 건강하세요", "행복한 하루 보내세요", "손주가 보고 싶은 날", "우리 함께 힘내요"];

/** 크리스마스 카드를 골랐을 때만 함께 보여 주는 인사말 */
const CHRISTMAS_PRESETS = ["메리 크리스마스! 행복한 연말 보내세요", "성탄절에도 늘 건강하세요", "따뜻한 연말 보내세요"];

/** 오늘의 운세를 소리로 읽어 줄 글 */
function fortuneSpeech(fortune: Fortune): string {
  const parts = [
    `오늘의 운세입니다. ${fortune.headline}.`,
    `별 다섯 개 중 ${fortune.stars}개, ${fortune.score}점입니다.`,
    fortune.timeTrait ? `${fortune.timeTrait}` : "",
    `총운, ${fortune.general}`,
    `금전, ${fortune.money}`,
    `건강, ${fortune.health}`,
    `인연, ${fortune.social}`,
    fortune.timeTip ? `${fortune.birthTime} 태생 팁, ${fortune.timeTip}` : "",
    `행운의 색은 ${fortune.luckyColor.name}, 행운의 숫자는 ${fortune.luckyNumber}, 행운의 방향은 ${fortune.luckyDirection}, 좋은 시간은 ${fortune.luckyTime}입니다.`,
    `오늘의 한마디. ${fortune.advice}`,
  ];
  return parts.filter(Boolean).join(" ");
}

export function HomeTab({
  onNavigate,
  onOpenCalendar,
}: {
  onNavigate: (tab: string) => void;
  onOpenCalendar?: () => void;
}) {
  const { profile, today, todayDaily, state, code, weekId, recordMission } = useApp();
  const { show } = useToast();
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [weatherBusy, setWeatherBusy] = useState(false);
  const [fortuneOpen, setFortuneOpen] = useState(false);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [studio, setStudio] = useState<{ open: boolean; autoShare: boolean }>({ open: false, autoShare: false });

  const fortune = useMemo(
    () => getFortune(profile?.nickname || "이용자", profile?.birthYear || 1955, today, profile?.birthTime),
    [profile?.nickname, profile?.birthYear, profile?.birthTime, today]
  );
  /** 맑음·구름은 3D 날씨 아이콘, 비·눈·안개는 상태를 살린 그림을 그대로 쓴다 */
  const weather3D = !/비|눈|소나기|천둥|이슬비|안개/.test(weather?.label || "맑음");

  useEffect(() => {
    if (!profile) return;
    let alive = true;
    setWeatherBusy(true);
    fetchWeather(profile.sido, profile.sigungu).then((w) => {
      if (alive) {
        setWeather(w);
        setWeatherBusy(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [profile]);

  /** 날씨 ‘다시 확인’ — 서버(/api/weather)에 한 번 더 물어본다 */
  const retryWeather = useCallback(async () => {
    if (!profile || weatherBusy) return;
    setWeatherBusy(true);
    const w = await fetchWeather(profile.sido, profile.sigungu);
    setWeather(w);
    setWeatherBusy(false);
  }, [profile, weatherBusy]);

  /* 지금 보고 있는 모임 — 모임 요약 카드에 쓴다 */
  const { active, detail } = useGroup();

  /**
   * 우리 모임이 이번 주 몇 위인지.
   * 랭킹 탭과 같은 기준을 쓰도록 같은 API(scope=groups)를 부르고,
   * 서버가 대답하지 못하면 랭킹 탭과 똑같은 계산(buildGroupRanking)으로 채운다.
   */
  const localRank = useMemo(() => {
    if (!active || !detail) return null;
    const view = buildGroupRanking({
      weekId: weekId || weekIdOf(),
      myGroups: [
        {
          id: active.id,
          name: active.name,
          memberCount: detail.memberCount,
          points: detail.members.reduce((sum, m) => sum + (m.points || 0), 0),
          attendedToday: detail.todayAttended,
        },
      ],
    });
    return view.myRank ?? null;
  }, [active, detail, weekId]);

  const [groupRank, setGroupRank] = useState<number | null>(null);
  useEffect(() => {
    if (!active || !detail) {
      setGroupRank(null);
      return;
    }
    let alive = true;
    const params = new URLSearchParams({
      scope: "groups",
      weekId: weekId || weekIdOf(),
      code: code || "",
    });
    fetch(`/api/rankings?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad"))))
      .then((j) => {
        if (!alive) return;
        // 지금 보고 있는 모임의 순위를 보여 준다 — 예시 참여자가 빠져 순위표가 짧아졌으므로
        // ‘내가 낀 모임 중 가장 높은 순위(myRank)'가 아니라 이 모임의 줄을 찾아 쓴다.
        const rows: { id?: string; rank?: number }[] = Array.isArray(j?.rows) ? j.rows : [];
        const row = rows.find((r) => r.id === active.id);
        if (typeof row?.rank === "number") setGroupRank(row.rank);
        else setGroupRank(typeof j?.myRank === "number" ? j.myRank : localRank);
      })
      .catch(() => {
        if (alive) setGroupRank(localRank);
      });
    return () => {
      alive = false;
    };
  }, [active, detail, code, weekId, localRank]);

  /* 우리 동네에서 지금 받을 수 있는 복지 혜택 수 — 혜택 탭과 같은 기준 */
  const benefitCount = useMemo(
    () => matchPrograms(profile?.birthYear || 1955, profile?.sido || "", profile?.sigungu || "").length,
    [profile?.birthYear, profile?.sido, profile?.sigungu]
  );

  /* 가족안부달력 — 가장 가까이 다가온 일정 하나 */
  const nextEvent = useMemo(() => upcomingEvents(state.familyEvents, today, 120, 1)[0], [state.familyEvents, today]);

  return (
    <div className="space-y-2 pb-2">
      {/* 🎁 오늘의 추억상자 — 지금은 숨김(lib/flags.ts ENABLE_MEMORY_BOX). 켜면 오늘 처음 접속에 한 번 뜬다. */}
      {ENABLE_MEMORY_BOX ? <MemoryBox /> : null}

      {/* 🔔 오늘 일정 알람 — 알람 시간이 되면 홈 맨 위에 먼저 보인다 */}
      <TodayAlarmCard where="home" />

      {/* 인사 배너 — 인물 사진은 오른쪽에만 작게, 왼쪽은 인사와 날씨 */}
      <section
        data-home-hero
        className="fade-up relative overflow-hidden rounded-[1.55rem] bg-[#E8F5FC] shadow-card"
      >
        <AssetImage
          name="home-hero"
          alt="봄 마을 정원에서 환하게 손을 흔드는 어르신"
          priority
          className="absolute inset-y-0 right-0 h-full w-[56%] object-cover object-[74%_14%]"
        />
        {/* 사진이 왼쪽 글자 자리로 번지지 않게 하는 부드러운 경계 */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, #E8F5FC 0%, #E8F5FC 40%, rgba(232,245,252,0.94) 52%, rgba(232,245,252,0.55) 64%, rgba(232,245,252,0) 80%)",
          }}
        />
        <div className="relative px-4 py-2">
          <p className="truncate text-[1.1rem] font-black leading-tight tracking-tight text-ink">
            {profile?.nickname}님,
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[1.1rem] font-black leading-tight tracking-tight text-ink">
            <span className="truncate">오늘도 행복하세요!</span>
            <span aria-hidden className="shrink-0">
              😊
            </span>
          </p>
          <button
            type="button"
            onClick={() => setWeatherOpen(true)}
            aria-label="오늘의 날씨와 생활팁 보기"
            className="mt-1.5 inline-flex max-w-full flex-wrap items-center gap-x-1 gap-y-0 rounded-full bg-white/95 px-2.5 py-0.5 shadow-soft active:scale-[0.99]"
          >
            {weather3D ? (
              <Icon3D name="icon-3d-weather" size={20} />
            ) : (
              <span aria-hidden className="shrink-0 text-[0.95rem] leading-none">
                🌤️
              </span>
            )}
            <span className="tabular whitespace-nowrap text-[0.82rem] font-extrabold text-ink">
              {weather ? `${weather.temp}°C` : "날씨 확인 중"}
            </span>
            <span aria-hidden className="text-[0.8rem] font-bold text-ink/25">
              |
            </span>
            <span className="whitespace-nowrap text-[0.82rem] font-extrabold text-ink">{koreanDate(today)}</span>
            {lunarShortOf(today) ? (
              <span className="whitespace-nowrap text-[0.78rem] font-bold text-plum-dark">({lunarShortOf(today)})</span>
            ) : null}
          </button>
        </div>
      </section>

      {/* 우리 모임 · 모임 랭킹 — 한 줄 두 칸 */}
      <div className="fade-up grid grid-cols-[1.62fr_1fr] gap-2">
        <button
          type="button"
          onClick={() => onNavigate("group")}
          aria-label="우리 모임 열기"
          className="flex min-w-0 flex-col justify-center rounded-[1.25rem] border border-brand/15 bg-white px-2.5 py-2 text-left shadow-soft active:scale-[0.995]"
        >
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-light text-[0.95rem]"
            >
              👥
            </span>
            <span className="line-clamp-2 min-w-0 flex-1 text-[0.94rem] font-black leading-tight text-ink">
              {active ? active.name : "모임 고르기"}
            </span>
            <IconChevron size={15} className="shrink-0 text-ink/30" />
          </span>
          <span className="mt-1 block text-[0.76rem] font-bold leading-snug text-ink/55">
            {detail ? (
              <>
                <span className="block whitespace-nowrap">오늘 출석 {detail.todayAttended}/{detail.memberCount}명</span>
                {/* 좁은 2칸 카드 — ‘이번 주 참여율 73%’가 중간에서 끊기지 않게 한 줄로 두고 글씨 상한을 둔다 */}
                <span data-weekly-rate="home" className="block whitespace-nowrap text-[min(0.9rem,17px)]">
                  이번 주 참여율 {detail.weeklyRate}%
                </span>
              </>
            ) : (
              "모임을 만들어요"
            )}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate("ranking")}
          aria-label="모임 랭킹 보기"
          className="flex min-w-0 items-center justify-center gap-1.5 overflow-hidden rounded-[1.25rem] bg-gradient-to-br from-gold-light via-[#FFF3CE] to-[#FFE7A6] px-2 py-2 text-left shadow-soft active:scale-[0.995]"
        >
          <span aria-hidden className="shrink-0 text-[1.4rem] leading-none drop-shadow">
            🏆
          </span>
          <span className="min-w-0">
            <span className="block text-[0.76rem] font-black leading-tight text-[#8A6100]">모임 랭킹</span>
            <span className="tabular block text-[1.05rem] font-black leading-tight text-[#C0453A]">
              {groupRank ? `${groupRank}위` : "—"}
            </span>
          </span>
        </button>
      </div>

      {/* 오늘의 공동 미션 — 치매예방 퀴즈 */}
      <button
        type="button"
        data-group-mission={todayDaily?.done ? "done" : "open"}
        onClick={() => {
          recordMission("group");
          onNavigate("quiz");
        }}
        className="fade-up relative block w-full overflow-hidden rounded-[1.4rem] px-3 py-2.5 text-left shadow-soft active:scale-[0.995]"
        style={{ background: "linear-gradient(135deg, #FFE9CB 0%, #FFD6A6 55%, #FFC98C 100%)" }}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#EE7413] px-2.5 py-1 text-[0.78rem] font-black leading-none text-white shadow-soft">
            🎯 오늘의 공동 미션
          </span>
          <span className="shrink-0 rounded-full bg-white/90 px-2 py-0.5 text-[0.72rem] font-black leading-tight text-[#B4530A]">
            함께해요!
          </span>
        </span>
        <span className="mt-1.5 flex items-start gap-1">
          <span className="min-w-0 flex-1">
            <span className="block text-[1.08rem] font-black leading-snug tracking-tight text-[#5A2A00]">
              {todayDaily?.done ? "오늘 퀴즈를 마쳤어요!" : "치매예방 퀴즈에 도전하세요!"}
            </span>
            <span className="mt-1 block text-[0.84rem] font-bold leading-snug text-[#8A4A0C]">
              퀴즈를 풀고, 포인트도 받아요!
            </span>
          </span>
          <Icon3D
            name="icon-3d-brain"
            size={54}
            className="shrink-0 drop-shadow-[0_8px_14px_rgba(180,83,10,0.3)]"
          />
        </span>
        <span className="mt-1.5 flex min-h-[40px] items-center justify-center gap-1 rounded-full bg-[#EE7413] text-[0.94rem] font-black text-white shadow-cta">
          ▶ {todayDaily?.done ? "오늘 결과 보기" : "지금 바로 참여하기"} <IconChevron size={16} />
        </span>
      </button>

      {/* 가족안부달력 · 오늘의 운세 — 나란히 두 칸
          아이폰 사파리는 <button> 안의 flex 자식을 기본값으로 늘리지 않아
          알약 버튼이 글자 폭만큼만 작아지고 왼쪽에 붙는다 → w-full 을 직접 준다. */}
      <div className="fade-up grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onOpenCalendar?.()}
          className="flex w-full min-w-0 flex-col rounded-[1.25rem] bg-[#F3EEFF] p-3 text-left shadow-soft active:scale-[0.995]"
        >
          <span className="flex w-full items-center gap-1">
            <span aria-hidden className="shrink-0 text-[1rem] leading-none">
              📅
            </span>
            {/* 좁은 2열 카드라 ‘가족안부달력’은 단어 중간에서 끊기지 않도록
                제로폭 띄어쓰기로 ‘가족안부 / 달력’ 자리만 끊을 수 있게 둔다 */}
            <span className="min-w-0 flex-1 break-words text-[1rem] font-black leading-tight text-ink">
              가족안부{"\u200B"}달력
            </span>
          </span>
          <span className="mt-1.5 block min-h-[1.3rem] flex-1 break-words text-[0.78rem] font-bold leading-snug text-ink/60">
            {nextEvent
              ? `${nextEvent.event.title} ${ddayLabel(nextEvent.days)}`
              : "생일·기념일 추가"}
          </span>
          <span className="mt-3 flex min-h-[40px] w-full items-center justify-center rounded-full bg-plum px-3 text-[clamp(15px,0.9rem,20px)] font-black leading-tight text-white">
            달력 보기
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFortuneOpen(true)}
          className="flex w-full min-w-0 flex-col rounded-[1.25rem] bg-[#E9F7EE] p-3 text-left shadow-soft active:scale-[0.995]"
        >
          <span className="flex w-full items-center gap-1">
            <span aria-hidden className="shrink-0 text-[1rem] leading-none">
              🌙
            </span>
            <span className="min-w-0 flex-1 break-words text-[1rem] font-black leading-tight text-ink">
              오늘의 운세
            </span>
          </span>
          <span className="mt-1.5 block min-h-[1.3rem] flex-1 break-words text-[0.78rem] font-bold leading-snug text-ink/60">
            {fortune.headline}
          </span>
          <span className="mt-3 flex min-h-[40px] w-full items-center justify-center rounded-full bg-leaf px-3 text-[clamp(15px,0.9rem,20px)] font-black leading-tight text-white">
            운세 보기
          </span>
        </button>
      </div>

      {/* 안부 인사 보내기 — 한 줄 */}
      <button
        type="button"
        data-home-greeting
        onClick={() => setStudio({ open: true, autoShare: false })}
        className="fade-up flex w-full items-center gap-2.5 rounded-[1.25rem] bg-white px-3 py-1.5 text-left shadow-soft active:scale-[0.995]"
      >
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-leaf-light text-[1.1rem]"
        >
          💬
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="min-w-0 text-[0.94rem] font-black leading-tight text-ink">안부 인사 보내기</span>
            <span className="flex min-h-[32px] shrink-0 items-center gap-0.5 rounded-full bg-leaf px-2.5 text-[0.8rem] font-black text-white">
              보내기 <IconChevron size={13} />
            </span>
          </span>
          <span className="mt-0.5 block text-[0.78rem] font-bold leading-snug text-ink/55">
            “오늘도 건강하세요! 😊” 마음을 전해요
          </span>
        </span>
      </button>

      {/* 오늘의 혜택 — 한 줄 */}
      <button
        type="button"
        data-home-end
        onClick={() => onNavigate("welfare")}
        className="fade-up flex w-full items-center gap-2.5 rounded-[1.25rem] bg-white px-3 py-1.5 text-left shadow-soft active:scale-[0.995]"
      >
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold-light text-[1.1rem]"
        >
          🎁
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="min-w-0 text-[0.94rem] font-black leading-tight text-ink">오늘의 혜택</span>
            <span className="flex min-h-[32px] shrink-0 items-center gap-0.5 rounded-full bg-[#EE7413] px-2.5 text-[0.8rem] font-black text-white">
              확인하기 <IconChevron size={13} />
            </span>
          </span>
          <span className="mt-0.5 block text-[0.78rem] font-bold leading-snug text-ink/55">
            우리 동네 복지 혜택 {benefitCount}건이 있어요!
          </span>
        </span>
      </button>

      {/* 오늘의 건강생활 챌린지 — 원터치 완료 도장 */}
      <HealthChallengeCard />

      <p className="flex items-center justify-center gap-1.5 pb-1 pt-1 text-[0.76rem] font-semibold text-ink/35">
        <span className="t-notice flex items-center gap-1.5">
          <NeulbomMark size={16} /> 늘봄과 함께, 더 편안한 하루
        </span>
      </p>

      <Sheet
        open={fortuneOpen}
        onClose={() => setFortuneOpen(false)}
        title="오늘의 운세"
        subtitle={`${koreanDate(today)} · ${fortune.zodiac}띠${fortune.birthTime ? ` · ${fortune.birthTime}생` : ""}`}
      >
        <FortuneDetail fortune={fortune} />
      </Sheet>

      <Sheet
        open={weatherOpen}
        onClose={() => setWeatherOpen(false)}
        title="오늘의 날씨와 생활팁"
        subtitle={`${shortSido(profile?.sido || "")} ${profile?.sigungu}`}
      >
        <WeatherDetail weather={weather} onRetry={retryWeather} busy={weatherBusy} />
      </Sheet>

      {studio.open ? (
        <GreetingSheet
          autoShare={studio.autoShare}
          onClose={() => setStudio({ open: false, autoShare: false })}
          show={show}
        />
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- */

function FortuneDetail({ fortune }: { fortune: Fortune }) {
  const rows: [string, string, string][] = [
    ["🍀", "총운", fortune.general],
    ["💰", "금전", fortune.money],
    ["💚", "건강", fortune.health],
    ["🤝", "인연", fortune.social],
  ];
  const jisin = fortune.birthTime ? JISIN_LINES[fortune.birthTime] : undefined;
  return (
    <div className="space-y-3">
      <div className="rounded-[1.5rem] bg-white p-5 text-center shadow-soft">
        <div className="mx-auto mb-2 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-[#FFE6D6] to-[#FFD3C4] text-[2rem]">
          {jisin?.emoji || fortune.zodiacEmoji}
        </div>
        <p className="t-notice leading-snug !text-brand-deep">{fortune.headline}</p>
        <div className="mt-1 flex items-center justify-center gap-2">
          <Stars n={fortune.stars} />
          <span className="tabular text-[0.95rem] font-extrabold text-ink/55">{fortune.score}점</span>
        </div>
        {fortune.timeTrait ? (
          <p className="t-body mt-2 !text-ink/60">{fortune.timeTrait}</p>
        ) : null}

        {/* 글씨가 어려운 분을 위해 운세 전체를 소리로 읽어 준다 */}
        <div className="mt-3">
          <SpeakButton
            text={fortuneSpeech(fortune)}
            label="운세 소리로 듣기"
            size="lg"
            dataName="fortune"
          />
        </div>
      </div>

      <div className="rounded-[1.5rem] bg-white p-4 shadow-soft">
        <div className="space-y-3">
          {rows.map(([emoji, label, text]) => (
            <div key={label} className="flex gap-2.5">
              <span aria-hidden className="text-[1.2rem] leading-6">
                {emoji}
              </span>
              <p className="text-[0.98rem] font-semibold leading-snug text-ink/80">
                <span className="mr-1 font-black text-ink">{label}</span>
                {text}
              </p>
            </div>
          ))}
          {fortune.timeTip ? (
            <div className="flex gap-2.5">
              <span aria-hidden className="text-[1.2rem] leading-6">
                {jisin?.emoji || "🕰️"}
              </span>
              <p className="text-[0.98rem] font-semibold leading-snug text-ink/80">
                <span className="mr-1 font-black text-ink">{fortune.birthTime} 팁</span>
                {fortune.timeTip}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <LuckyBox label="행운의 색" value={fortune.luckyColor.name} swatch={fortune.luckyColor.hex} />
        <LuckyBox label="행운의 숫자" value={`${fortune.luckyNumber}`} />
        <LuckyBox label="행운의 방향" value={fortune.luckyDirection} />
        <LuckyBox label="좋은 시간" value={fortune.luckyTime} />
      </div>

      <p className="rounded-2xl bg-gold-light px-4 py-3 text-center text-[0.98rem] font-bold leading-relaxed text-[#7A5600]">
        “{fortune.advice}”
      </p>
    </div>
  );
}

function LuckyBox({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
  return (
    <div className="rounded-2xl bg-white px-3 py-2.5 shadow-soft">
      <p className="text-[0.74rem] font-bold text-ink/45">{label}</p>
      <p className="mt-0.5 flex items-center justify-center gap-1.5 text-[0.95rem] font-black text-ink">
        {swatch ? (
          <span
            className="inline-block h-3.5 w-3.5 rounded-full border border-ink/15"
            style={{ background: swatch }}
          />
        ) : null}
        {value}
      </p>
    </div>
  );
}

function WeatherDetail({
  weather,
  onRetry,
  busy,
}: {
  weather: WeatherInfo | null;
  onRetry?: () => void;
  busy?: boolean;
}) {
  if (!weather) {
    return <p className="py-8 text-center text-[1rem] font-semibold text-ink/55">날씨를 불러오는 중이에요…</p>;
  }
  const live = weather.source === "live";
  return (
    <div className="space-y-3">
      {live ? (
        <div className="flex items-center gap-4 rounded-[1.5rem] bg-white p-5 shadow-soft">
          <WeatherArt label={weather.label} size={62} />
          <div>
            <p className="tabular text-[2rem] font-black leading-none text-ink">
              {weather.temp}
              <span className="text-[1.1rem] font-bold">°C</span>
            </p>
            <p className="mt-1 text-[0.95rem] font-bold text-ink/60">
              {weather.label} · 최저 {weather.min}° / 최고 {weather.max}°
            </p>
            <p className="text-[0.82rem] font-semibold text-ink/45">
              체감 {weather.feels}° · 습도 {weather.humidity}% · 바람 {weather.wind}m/s
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-[1.5rem] bg-white p-5 text-center shadow-soft">
          <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-full bg-sun-light text-[1.7rem]">
            🌤️
          </div>
          <p className="text-[1.08rem] font-black leading-snug text-ink">지금은 날씨를 불러오지 못했어요</p>
          <p className="t-notice mt-1 text-ink/55">
            잠시 뒤 &lsquo;다시 확인&rsquo;을 눌러 주세요.
            <br />
            그동안에도 아래 생활팁은 그대로 도움이 돼요.
          </p>
          {onRetry ? (
            <div className="mt-3">
              <BigButton variant="teal" full height={56} onClick={onRetry} disabled={busy}>
                {busy ? "다시 확인하는 중…" : "🔄 날씨 다시 확인하기"}
              </BigButton>
            </div>
          ) : null}
        </div>
      )}

      <div className="rounded-[1.5rem] bg-white p-4 shadow-soft">
        <p className="mb-2 flex items-center gap-1.5 text-[0.95rem] font-black text-ink">
          <IconSparkle size={18} className="text-sun" /> 오늘의 생활팁
        </p>
        <ul className="space-y-2.5">
          {weather.tips.map((t) => (
            <li key={t} className="flex gap-2 text-[0.98rem] font-semibold leading-snug text-ink/80">
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sun" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-center text-[0.76rem] font-medium text-ink/40">
        {live
          ? `실시간 날씨(${weather.provider === "met-no" ? "MET Norway" : "Open-Meteo"}) 기준 · 외출 전 한 번 더 확인하세요`
          : "날씨를 불러오지 못해 기본 안내를 보여 드려요"}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* 인사카드 만들기 시트                                               */
/* ---------------------------------------------------------------- */

function GreetingSheet({
  autoShare,
  onClose,
  show,
}: {
  autoShare: boolean;
  onClose: () => void;
  show: (m: string) => void;
}) {
  const { profile, today } = useApp();
  const [theme, setTheme] = useState<GreetingTheme>("chrysanthemum");
  const [message, setMessage] = useState(PRESETS[0]);
  const [rendering, setRendering] = useState(true);
  const [drawn, setDrawn] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shared = useRef(false);

  const fortune = useMemo(
    () => getFortune(profile?.nickname || "이용자", profile?.birthYear || 1955, today, profile?.birthTime),
    [profile?.nickname, profile?.birthYear, profile?.birthTime, today]
  );

  // 카드 캔버스는 시트 포털이 그려진 뒤에 마운트되므로, 그릴 준비 상태를 자식이 알려 준다.
  const handleCardState = useCallback((busy: boolean, done: boolean) => {
    setRendering(busy);
    setDrawn(done);
  }, []);

  const save = useCallback(() => {
    if (!canvasRef.current || !profile) return;
    downloadCanvas(canvasRef.current, `인사카드_${profile.nickname}_${today}.png`);
    show("인사카드를 저장했어요. 사진첩에서 확인해 보세요.");
  }, [profile, today, show]);

  // 홈의 '카카오톡으로 보내기' → 카드가 그려진 뒤 공유 미리보기 시트를 한 번만 연다
  useEffect(() => {
    if (!autoShare || shared.current || !drawn) return;
    if (!canvasRef.current || !canvasRef.current.width) return;
    shared.current = true;
    setShareOpen(true);
  }, [autoShare, drawn]);

  return (
    <Sheet open onClose={onClose} title="오늘의 안부 인사카드" subtitle="내 이름이 들어간 카드를 만들어 보내요">
      {/* 카드 고르기 — 열한 가지가 한 줄에 다 들어가지 않으므로 옆으로 넘겨 고른다.
          칸 너비를 rem 으로 두어 ‘아주 크게’에서도 글씨가 넘치지 않고 함께 커진다. */}
      <div
        role="group"
        aria-label="카드 그림 고르기"
        className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1.5 pt-0.5"
      >
        {THEMES.map((t) => {
          const on = theme === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTheme(t.key);
                // 크리스마스 카드를 고르면, 아직 손대지 않은 기본 문구를 성탄 인사로 바꿔 준다.
                if (t.key === "christmas" && message === PRESETS[0]) setMessage(CHRISTMAS_PRESETS[0]);
              }}
              aria-pressed={on}
              data-greeting-theme={t.key}
              className={`flex w-[5.4rem] shrink-0 flex-col items-center gap-1 rounded-2xl border-2 p-1.5 transition ${
                on ? "border-brand bg-brand-light" : "border-ink/8 bg-white"
              }`}
            >
              <span
                className="relative block h-[4.9rem] w-full overflow-hidden rounded-xl"
                style={t.thumb ? undefined : { background: `linear-gradient(160deg, ${t.colors[0]}, ${t.colors[1]})` }}
              >
                {t.thumb ? (
                  <img
                    src={t.thumb}
                    alt=""
                    width={320}
                    height={400}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : null}
                {on ? (
                  <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[0.72rem] font-black leading-none text-white shadow">
                    ✓
                  </span>
                ) : null}
              </span>
              <span className="w-full text-center text-[0.68rem] font-extrabold leading-[1.15] tracking-tight">
                {t.thumb ? t.label : `${t.emoji} ${t.label}`}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 overflow-hidden rounded-[1.4rem] bg-[#F4EEE1] shadow-soft">
        <GreetingPreview
          canvasRef={canvasRef}
          theme={theme}
          name={profile?.nickname || ""}
          message={message}
          dateLabel={koreanDate(today)}
          fortuneLine={shortFortuneLine(fortune)}
          onState={handleCardState}
        />
      </div>
      {rendering ? (
        <p className="mt-1 text-center text-[0.78rem] font-semibold text-ink/45">카드를 그리는 중…</p>
      ) : null}

      <div className="mt-3">
        <label htmlFor="msg" className="mb-1.5 block text-[0.95rem] font-extrabold">
          카드에 쓸 말
        </label>
        <input
          id="msg"
          className="field"
          value={message}
          maxLength={40}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {(theme === "christmas" ? [...CHRISTMAS_PRESETS, ...PRESETS] : PRESETS).map((p) => (
            <button
              key={p}
              onClick={() => setMessage(p)}
              className={`rounded-full border-2 px-3 py-1.5 text-[0.82rem] font-bold ${
                message === p
                  ? "border-brand bg-brand-light text-brand-dark"
                  : "border-ink/10 bg-white text-ink/65"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <BigButton variant="white" onClick={save}>
          <IconDownload size={22} /> 저장
        </BigButton>
        <BigButton variant="sun" onClick={() => setShareOpen(true)}>
          <IconShare size={22} /> 카톡으로 보내기
        </BigButton>
      </div>
      <p className="mt-2 text-center text-[0.78rem] font-medium leading-relaxed text-ink/45">
        {kakaoConfig().configured
          ? "카카오톡 공유 카드로 바로 보낼 수 있어요. 친구를 고르면 끝나요."
          : "휴대폰 공유창으로 보낼 수 있어요. 카카오톡 공유 설정이 아직 준비되지 않아 공유창으로 보내요."}
      </p>

      <SharePreviewSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        sourceCanvas={canvasRef}
        data={{
          kind: "greeting",
          badge: "오늘의 안부 인사",
          emoji: "💌",
          headline: `${profile?.nickname || "가족"} 님이 보내는 안부`,
          sub: message,
          message: shortFortuneLine(fortune),
          name: profile?.nickname,
          dateLabel: koreanDate(today),
          title: `${profile?.nickname || "가족"} 님의 오늘 안부`,
          description: message,
          buttonTitle: "답장 보내기",
          text: `${message} - ${profile?.nickname || ""} 드림 (늘봄)`,
          // 링크는 ‘안부 인사’ 상황 주소로 — 카톡 미리보기도 안부 문구로 뜼다.
          link: shareLinkFor("greeting"),
          filename: `인사카드_${profile?.nickname || "늘봄"}_${today}.png`,
          sheetTitle: "카카오톡으로 안부 보내기",
          sheetSubtitle: "단톡방에 이렇게 보여요",
        }}
      />
    </Sheet>
  );
}

/** 시트가 열린 뒤(=포털 마운트 뒤) 캔버스를 그리고 알려 주는 미리보기 */
function GreetingPreview({
  canvasRef,
  theme,
  name,
  message,
  dateLabel,
  fortuneLine,
  onState,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  theme: GreetingTheme;
  name: string;
  message: string;
  dateLabel: string;
  fortuneLine: string;
  onState: (busy: boolean, done: boolean) => void;
}) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !name) return;
    let alive = true;
    onState(true, false);
    renderGreetingCard(canvas, { theme, name, message, dateLabel, fortuneLine })
      .catch(() => {})
      .finally(() => {
        if (alive) onState(false, true);
      });
    return () => {
      alive = false;
    };
  }, [canvasRef, theme, name, message, dateLabel, fortuneLine, onState]);

  return (
    <canvas
      ref={canvasRef}
      data-greeting-card=""
      className="block w-full"
      style={{ aspectRatio: "1080 / 1350" }}
    />
  );
}
