"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getFortune, shortFortuneLine, type Fortune } from "@/lib/fortune";
import { JISIN_LINES } from "@/lib/birthtime";
import { fetchWeather, type WeatherInfo } from "@/lib/weather";
import { renderGreetingCard, downloadCanvas, THEMES, type GreetingTheme } from "@/lib/canvas";
import { kakaoConfig } from "@/lib/share";
import { useApp } from "@/lib/storage";
import { koreanDate } from "@/lib/week";
import { shortSido } from "@/lib/regions";
import { BigButton, SectionTitle, Stars, Sheet, useToast } from "./ui";
import { HomeCalendarBanner, TodayAlarmCard } from "./calendar";
import { GroupMissionBanner, GroupSelectorBanner, TodayGroupCard } from "./groups";
import { HealthChallengeCard } from "./health";
import { SharePreviewSheet } from "./share-sheet";
import { SpeakButton } from "./speak";
import { AssetImage, Icon3D, NeulbomMark, RaisedTile, WeatherArt, type Icon3DName } from "./art";
import {
  IconBank,
  IconBook,
  IconCalendar,
  IconChevron,
  IconDownload,
  IconMail,
  IconPill,
  IconSend,
  IconShare,
  IconSparkle,
  IconTools,
  IconTrophy,
} from "./icons";

const PRESETS = ["오늘도 건강하세요", "행복한 하루 보내세요", "손주가 보고 싶은 날", "우리 함께 힘내요"];

const WEEKDAY = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

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

function longKoreanDate(dateStr: string): { date: string; day: string } {
  const d = new Date(dateStr + "T00:00:00Z");
  return {
    date: `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`,
    day: WEEKDAY[d.getUTCDay()],
  };
}

export function HomeTab({
  onNavigate,
  onOpenCalendar,
}: {
  onNavigate: (tab: string) => void;
  onOpenCalendar?: () => void;
}) {
  const { profile, streak, today, todayDaily, weekPoints } = useApp();
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
  const dateLabel = longKoreanDate(today);
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

  const tiles: { key: string; label: string; sub: string; icon: Icon3DName; go: () => void }[] = [
    {
      key: "quiz",
      label: "오늘의 퀴즈",
      sub: todayDaily?.done ? "완료했어요" : "3문제 · 1분",
      icon: "icon-3d-quiz-trophy",
      go: () => onNavigate("quiz"),
    },
    {
      key: "welfare",
      label: "정부 지원금",
      sub: "내게 맞는 혜택",
      icon: "icon-3d-welfare-gift",
      go: () => onNavigate("welfare"),
    },
    {
      key: "tools",
      label: "돋보기",
      sub: "크게 보기",
      icon: "icon-3d-magnifier",
      go: () => onNavigate("tools"),
    },
    {
      key: "med",
      label: "복약 체크",
      sub: "아침 · 저녁 약",
      icon: "icon-3d-pill",
      go: () => onNavigate("family"),
    },
    {
      key: "anbu",
      label: "안부 전송",
      sub: "카톡으로 인사",
      icon: "icon-3d-mail",
      go: () => onNavigate("family"),
    },
    {
      key: "guide",
      label: "생활 가이드",
      sub: "1분 카드뉴스",
      icon: "icon-3d-book",
      go: () => onNavigate("tools"),
    },
  ];

  return (
    <div className="space-y-4 pb-2">
      {/* 🔔 오늘 일정 알람 — 알람 시간이 되면 홈 맨 위에 먼저 보인다 */}
      <TodayAlarmCard where="home" />

      {/* 인사 히어로 — 아침 햇살 가득한 봄 마을, 손 흔드는 어르신 */}
      <section data-home-hero className="fade-up overflow-hidden rounded-[1.9rem] bg-[#CFE7F7] shadow-card">
        <div className="relative h-[224px] overflow-hidden">
          <AssetImage
            name="home-hero"
            alt="아침 햇살이 비치는 봄 마을 정원에서 환하게 손을 흔드는 어르신"
            priority
            className="absolute inset-0 h-full w-full object-cover object-[54%_36%]"
          />
          {/* 아래쪽 글자 자리에만 깔리는 딥네이비 그라디언트 — 그림 위쪽은 가리지 않는다 */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[74%]"
            style={{
              background:
                "linear-gradient(to top, rgba(11,34,51,0.95) 0%, rgba(11,34,51,0.74) 24%, rgba(11,34,51,0.36) 52%, rgba(11,34,51,0))",
            }}
          />
          <div className="absolute left-3.5 top-3.5 flex items-center gap-1.5 rounded-2xl bg-white/95 px-2.5 py-1.5 shadow-soft backdrop-blur">
            <IconCalendar size={19} className="text-brand" />
            <div className="leading-tight">
              <p className="tabular text-[0.82rem] font-black text-ink">{dateLabel.date}</p>
              <p className="text-[0.68rem] font-bold text-ink/50">{dateLabel.day}</p>
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 px-4 pb-3.5">
            <p className="text-[0.84rem] font-extrabold tracking-tight text-white/90">안녕하세요,</p>
            <h1 className="mt-0.5 flex items-center gap-1.5 text-[1.72rem] font-black leading-tight text-white drop-shadow-[0_2px_6px_rgba(8,24,38,0.45)]">
              <span className="truncate">{profile?.nickname}</span>
              <span className="text-[1.42rem]">😊</span>
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {streak > 0 ? (
                <span className="rounded-full bg-white/95 px-2.5 py-1 text-[0.74rem] font-extrabold text-[#C0453A] shadow-soft">
                  🔥 {streak}일 연속
                </span>
              ) : null}
              <span className="text-[0.8rem] font-bold text-white/85">
                {shortSido(profile?.sido || "")} {profile?.sigungu}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 우리 모임 — 지금 보고 있는 모임과 오늘의 현황 */}
      <GroupSelectorBanner />
      <TodayGroupCard />

      {/* 감성 인사카드 히어로 — 고화질 국화 사진 */}
      <section className="fade-up overflow-hidden rounded-[1.75rem] bg-white shadow-card">
        <div className="relative h-[228px] overflow-hidden bg-[#CFE7F7]">
          <AssetImage
            name="greeting-chrysanthemum"
            alt="파란 하늘 아래 활짝 핀 노란 국화꽃"
            priority
            className="absolute inset-0 h-full w-full object-cover object-[64%_center]"
          />
          {/* 왼쪽 손글씨 자리만 덮는 흰 그라디언트 — 국화 사진 오른쪽은 원본 그대로 선명하게 */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-[78%]"
            style={{
              background:
                "linear-gradient(to right, #FFFFFF 0%, rgba(255,255,255,0.96) 32%, rgba(255,255,255,0.66) 58%, rgba(255,255,255,0))",
            }}
          />
          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white/45 via-white/10 to-transparent" />
          <div className="relative flex h-full flex-col justify-center gap-1 px-4">
            <button
              type="button"
              onClick={() => setStudio({ open: true, autoShare: false })}
              className="mb-1 inline-flex w-fit items-center gap-1 rounded-full bg-ink/85 px-3 py-1.5 text-[0.76rem] font-extrabold text-white shadow-soft backdrop-blur"
            >
              오늘의 안부 인사 <IconChevron size={13} />
            </button>
            <p className="hand text-[2rem] leading-[1.2] text-[#122A44]">
              {fortune.score >= 85 ? "오늘도 건강하고" : "천천히, 편안하게"}
              <br />
              행복하세요! <span className="text-coral">♡</span>
            </p>
          </div>
        </div>

        <div className="space-y-2 px-4 py-3">
          <p className="flex items-center justify-center gap-1.5 pb-0.5 text-[0.8rem] font-bold text-ink/55">
            <IconSparkle size={14} className="text-sun-dark" /> {shortFortuneLine(fortune)}
          </p>
          <button
            type="button"
            onClick={() => setStudio({ open: true, autoShare: false })}
            className="touch-btn min-h-[54px] w-full bg-gold text-ink shadow-sun active:bg-gold-dark"
          >
            <IconSend size={21} /> 인사카드 만들기
          </button>
          <button
            type="button"
            onClick={() => setStudio({ open: true, autoShare: true })}
            className="touch-btn min-h-[52px] w-full bg-white text-ink shadow-soft"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#FEE500] text-[0.6rem] font-black text-[#3C1E1E]">
              TALK
            </span>
            카카오톡으로 보내기
          </button>
        </div>
      </section>

      {/* 오늘의 모임 미션 */}
      <GroupMissionBanner onJoin={() => onNavigate("quiz")} />

      {/* 오늘의 건강생활 챌린지 — 원터치 완료 도장 */}
      <HealthChallengeCard where="home" />

      {/* 가족 안부 달력 — 생일·기념일과 동네 소식을 오늘의 운세보다 위에 둔다 */}
      <HomeCalendarBanner onOpen={() => onOpenCalendar?.()} />

      {/* 오늘의 운세 */}
      <button
        type="button"
        onClick={() => setFortuneOpen(true)}
        className="card fade-up flex w-full items-center gap-3 p-3.5 text-left"
      >
        <Icon3D
          name="icon-3d-sun-fortune"
          size={56}
          className="drop-shadow-[0_10px_16px_rgba(196,138,40,0.32)]"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[1.04rem] font-black leading-snug text-ink">오늘의 운세</span>
          <span className="mt-0.5 block truncate text-[0.9rem] font-semibold text-ink/60">
            {fortune.headline} · {fortune.zodiac}띠
          </span>
        </span>
        <IconChevron size={22} className="shrink-0 text-ink/30" />
      </button>

      {/* 오늘의 날씨와 생활팁 */}
      <button
        type="button"
        onClick={() => setWeatherOpen(true)}
        className="card fade-up flex w-full items-center gap-3 p-3.5 text-left"
      >
        {weather3D ? (
          <Icon3D name="icon-3d-weather" size={56} className="drop-shadow-[0_10px_16px_rgba(60,120,180,0.32)]" />
        ) : (
          <RaisedTile tone="sky" size={56}>
            <WeatherArt label={weather?.label || "맑음"} size={36} />
          </RaisedTile>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[1.04rem] font-black leading-snug text-ink">오늘의 날씨와 생활팁</span>
          <span className="mt-0.5 block truncate text-[0.9rem] font-semibold text-ink/60">
            {!weather
              ? "날씨를 확인하고 있어요…"
              : weather.source === "live"
                ? `${weather.temp}° ${weather.label} · ${weather.tips[0]}`
                : "눌러서 오늘 날씨를 다시 확인해요"}
          </span>
        </span>
        <IconChevron size={22} className="shrink-0 text-ink/30" />
      </button>

      {/* 2×3 바로가기 */}
      <section className="fade-up">
        <SectionTitle right={<span className="text-[0.78rem] font-bold text-ink/40">자주 찾는 메뉴</span>}>
          바로가기
        </SectionTitle>
        <div className="grid grid-cols-3 gap-2.5">
          {tiles.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={t.go}
              className="card flex flex-col items-start gap-1.5 p-3 text-left active:scale-[0.98]"
            >
              <Icon3D name={t.icon} size={44} className="drop-shadow-[0_6px_10px_rgba(60,80,70,0.16)]" />
              <span className="block text-[0.9rem] font-black leading-tight text-ink">{t.label}</span>
              <span className="block text-[0.7rem] font-bold leading-tight text-ink/45">{t.sub}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 명예의 전당 배너 */}
      <button
        type="button"
        onClick={() => onNavigate("ranking")}
        className="fade-up flex w-full items-center gap-3 rounded-[1.5rem] bg-gradient-to-r from-gold-light via-[#FFF1C4] to-[#FFE7A6] px-4 py-3.5 text-left shadow-soft"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/80 text-gold-dark">
          <IconTrophy size={24} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[1rem] font-black leading-tight text-[#7A5600]">
            이번 주 {weekPoints}점 · 명예의 전당
          </span>
          <span className="block text-[0.82rem] font-bold text-[#8A6A16]/80">
            우리 동네 순위 보기
          </span>
        </span>
        <IconChevron size={22} className="shrink-0 text-[#8A6A16]" />
      </button>

      <p className="flex items-center justify-center gap-1.5 pb-1 text-[0.76rem] font-semibold text-ink/35">
        <NeulbomMark size={16} /> 늘봄과 함께, 더 편안한 하루
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
        <p className="text-[1.3rem] font-black leading-snug text-brand-deep">{fortune.headline}</p>
        <div className="mt-1 flex items-center justify-center gap-2">
          <Stars n={fortune.stars} />
          <span className="tabular text-[0.95rem] font-extrabold text-ink/55">{fortune.score}점</span>
        </div>
        {fortune.timeTrait ? (
          <p className="mt-2 text-[0.86rem] font-semibold leading-relaxed text-ink/45">{fortune.timeTrait}</p>
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
          <p className="mt-1 text-[0.92rem] font-semibold leading-relaxed text-ink/55">
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
      <div className="grid grid-cols-3 gap-2">
        {THEMES.map((t) => (
          <button
            key={t.key}
            onClick={() => setTheme(t.key)}
            aria-pressed={theme === t.key}
            className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-1 py-1.5 transition ${
              theme === t.key ? "border-brand bg-brand-light" : "border-ink/8 bg-white"
            }`}
          >
            {t.key === "chrysanthemum" ? (
              <span className="h-9 w-full overflow-hidden rounded-xl bg-[#CFE8F8]">
                <AssetImage name="greeting-chrysanthemum" alt="" className="h-full w-full object-cover" />
              </span>
            ) : (
              <span
                className="h-9 w-full rounded-xl"
                style={{ background: `linear-gradient(160deg, ${t.colors[0]}, ${t.colors[1]})` }}
              />
            )}
            <span className="whitespace-nowrap text-[0.66rem] font-extrabold tracking-tight">
              {t.emoji} {t.label}
            </span>
          </button>
        ))}
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
          {PRESETS.map((p) => (
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
          link: typeof window !== "undefined" ? window.location.origin : "",
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

  return <canvas ref={canvasRef} className="block w-full" style={{ aspectRatio: "1080 / 1350" }} />;
}
