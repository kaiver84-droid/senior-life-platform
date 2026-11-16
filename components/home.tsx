"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getFortune, shortFortuneLine } from "@/lib/fortune";
import { fetchWeather, type WeatherInfo } from "@/lib/weather";
import { renderGreetingCard, downloadCanvas, THEMES, type GreetingTheme } from "@/lib/canvas";
import { kakaoConfig, shareCard, shareMessageText } from "@/lib/share";
import { useApp } from "@/lib/storage";
import { koreanDate } from "@/lib/week";
import { shortSido } from "@/lib/regions";
import { Badge, BigButton, Card, SectionTitle, Stars, useToast } from "./ui";
import { IconDownload, IconShare, IconStar } from "./icons";

const PRESETS = ["오늘도 건강하세요", "행복한 하루 보내세요", "손주가 보고 싶은 날", "우리 함께 힘내요"];

export function HomeTab({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { profile, streak, today, todayDaily, weekPoints } = useApp();
  const { show } = useToast();
  const [weather, setWeather] = useState<WeatherInfo | null>(null);

  const fortune = useMemo(
    () => getFortune(profile?.nickname || "이용자", profile?.birthYear || 1955, today),
    [profile?.nickname, profile?.birthYear, today]
  );

  useEffect(() => {
    if (!profile) return;
    let alive = true;
    fetchWeather(profile.sido, profile.sigungu).then((w) => {
      if (alive) setWeather(w);
    });
    return () => {
      alive = false;
    };
  }, [profile]);

  return (
    <div className="space-y-5">
      {/* 인사 */}
      <section className="fade-up">
        <div className="mb-1 flex items-center gap-2">
          <Badge tone="gold">{koreanDate(today)}</Badge>
          {streak > 0 ? <Badge tone="warm">🔥 {streak}일 연속</Badge> : null}
        </div>
        <h1 className="text-[1.6rem] font-black leading-snug">
          {profile?.nickname} 님,
          <br />
          오늘도 반갑습니다 🌻
        </h1>
        <p className="mt-1 text-[0.98rem] font-semibold text-ink/60">
          {shortSido(profile?.sido || "")} {profile?.sigungu} · {fortune.zodiacEmoji} {fortune.zodiac}띠
        </p>
      </section>

      {/* 오늘의 운세 */}
      <Card className="fade-up bg-gradient-to-br from-white to-[#FFF7E4]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="section-title">🔮 오늘의 운세</h2>
            <p className="mt-0.5 text-[0.92rem] font-semibold text-ink/60">
              {profile?.birthYear}년생 · {fortune.zodiac}띠
            </p>
          </div>
          <ScoreRing score={fortune.score} />
        </div>

        <div className="mt-3 rounded-2xl bg-white/80 p-3.5 text-center">
          <p className="text-[1.12rem] font-black text-brand-dark">{fortune.headline}</p>
          <Stars n={fortune.stars} />
        </div>

        <div className="mt-3 space-y-2.5">
          <FortuneRow emoji="🍀" label="총운" text={fortune.general} />
          <FortuneRow emoji="💰" label="금전" text={fortune.money} />
          <FortuneRow emoji="💚" label="건강" text={fortune.health} />
          <FortuneRow emoji="🤝" label="인연" text={fortune.social} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
          <LuckyBox label="행운의 색" value={fortune.luckyColor.name} swatch={fortune.luckyColor.hex} />
          <LuckyBox label="행운의 숫자" value={`${fortune.luckyNumber}`} />
          <LuckyBox label="행운의 방향" value={fortune.luckyDirection} />
          <LuckyBox label="좋은 시간" value={fortune.luckyTime} />
        </div>

        <p className="mt-3 rounded-xl bg-gold-light/70 px-3 py-2.5 text-center text-[0.98rem] font-bold text-[#7A5209]">
          “{fortune.advice}”
        </p>
      </Card>

      {/* 날씨 생활 팁 */}
      <Card className="fade-up">
        <h2 className="section-title">🌤️ 오늘 날씨 생활 팁</h2>
        {weather ? (
          <>
            <div className="mt-2 flex items-center gap-3">
              <div className="text-[2.6rem] leading-none">{weather.emoji}</div>
              <div>
                <p className="text-[1.5rem] font-black leading-none">
                  {weather.temp}
                  <span className="text-[1rem] font-bold">°C</span>
                </p>
                <p className="text-[0.95rem] font-bold text-ink/65">
                  {weather.label} · 최저 {weather.min}° / 최고 {weather.max}°
                </p>
              </div>
            </div>
            <ul className="mt-3 space-y-2">
              {weather.tips.map((t) => (
                <li key={t} className="flex gap-2 text-[1rem] font-semibold leading-snug text-ink/85">
                  <span aria-hidden className="mt-0.5 text-gold">
                    ●
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[0.78rem] font-medium text-ink/40">
              {weather.source === "live"
                ? "실시간 날씨(Open-Meteo) 기준 · 옷차림과 외출 전 확인에 활용하세요"
                : "날씨를 불러오지 못해 기본 안내를 보여 드려요"}
            </p>
          </>
        ) : (
          <p className="mt-2 text-[1rem] font-semibold text-ink/55">날씨를 불러오는 중이에요…</p>
        )}
      </Card>

      {/* 오늘의 안부 인사카드 */}
      <GreetingStudio show={show} />

      {/* 바로가기 */}
      <section className="fade-up">
        <SectionTitle emoji="⚡">바로가기</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <BigButton variant={todayDaily?.done ? "white" : "leaf"} size="lg" onClick={() => onNavigate("quiz")}>
            🧠 {todayDaily?.done ? "오늘 퀴즈 완료" : "1분 퀴즈 풀기"}
          </BigButton>
          <BigButton variant="white" size="lg" onClick={() => onNavigate("welfare")}>
            💰 내 지원금 찾기
          </BigButton>
        </div>
        <button
          onClick={() => onNavigate("ranking")}
          className="mt-3 flex w-full items-center justify-between rounded-2xl border-2 border-gold/40 bg-gold-light/60 px-4 py-3 text-left"
        >
          <span className="text-[0.98rem] font-black text-[#7A5209]">
            🏆 이번 주 퀴즈 점수 <span className="tabular text-[1.12rem]">{weekPoints}</span>점 · 랭킹 보기
          </span>
          <span className="text-[1.1rem] font-black text-[#7A5209]">›</span>
        </button>
      </section>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const filled = (score / 100) * c;
  return (
    <div className="relative h-[84px] w-[84px] shrink-0">
      <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
        <circle cx="38" cy="38" r={r} fill="none" stroke="rgba(20,33,58,0.10)" strokeWidth="9" />
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke="#B07A16"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-[1.35rem] font-black leading-none text-[#8A5A0B]">{score}</span>
        <span className="text-[0.68rem] font-bold text-ink/50">점</span>
      </div>
    </div>
  );
}

function FortuneRow({ emoji, label, text }: { emoji: string; label: string; text: string }) {
  return (
    <div className="flex gap-2.5">
      <span aria-hidden className="text-[1.2rem] leading-6">
        {emoji}
      </span>
      <p className="text-[1rem] font-semibold leading-snug text-ink/85">
        <span className="mr-1 font-black text-ink">{label}</span>
        {text}
      </p>
    </div>
  );
}

function LuckyBox({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
  return (
    <div className="rounded-xl bg-white/90 px-2 py-2.5">
      <p className="text-[0.76rem] font-bold text-ink/50">{label}</p>
      <p className="mt-0.5 flex items-center justify-center gap-1.5 text-[0.98rem] font-black text-ink">
        {swatch ? (
          <span className="inline-block h-3.5 w-3.5 rounded-full border border-ink/20" style={{ background: swatch }} />
        ) : null}
        {value}
      </p>
    </div>
  );
}

function GreetingStudio({ show }: { show: (m: string) => void }) {
  const { profile, today } = useApp();
  const [theme, setTheme] = useState<GreetingTheme>("spring");
  const [message, setMessage] = useState(PRESETS[0]);
  const [rendering, setRendering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const fortune = useMemo(
    () => getFortune(profile?.nickname || "이용자", profile?.birthYear || 1955, today),
    [profile?.nickname, profile?.birthYear, today]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !profile) return;
    let alive = true;
    setRendering(true);
    renderGreetingCard(canvas, {
      theme,
      name: profile.nickname,
      message,
      dateLabel: koreanDate(today),
      fortuneLine: shortFortuneLine(fortune),
    })
      .catch(() => {})
      .finally(() => {
        if (alive) setRendering(false);
      });
    return () => {
      alive = false;
    };
  }, [theme, message, profile, today, fortune]);

  const save = useCallback(() => {
    if (!canvasRef.current || !profile) return;
    downloadCanvas(canvasRef.current, `인사카드_${profile.nickname}_${today}.png`);
    show("인사카드를 저장했어요. 사진첩에서 확인해 보세요.");
  }, [profile, today, show]);

  const send = useCallback(async () => {
    if (!canvasRef.current || !profile) return;
    const result = await shareCard({
      canvas: canvasRef.current,
      filename: `인사카드_${profile.nickname}_${today}.png`,
      title: `${profile.nickname} 님의 오늘 안부`,
      description: message,
      text: `${message} - ${profile.nickname} 드림 (시니어생활 도우미)`,
    });
    show(shareMessageText(result));
  }, [profile, today, message, show]);

  return (
    <Card className="fade-up">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="section-title">💌 오늘의 안부 인사카드</h2>
          <p className="mt-0.5 text-[0.92rem] font-semibold text-ink/60">
            내 이름이 들어간 카드를 만들어 카카오톡으로 보내요
          </p>
        </div>
        <IconStar className="shrink-0 text-gold" size={26} />
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {THEMES.map((t) => (
          <button
            key={t.key}
            onClick={() => setTheme(t.key)}
            aria-pressed={theme === t.key}
            className={`flex flex-col items-center gap-1 rounded-xl border-2 px-1 py-1.5 transition ${
              theme === t.key ? "border-brand bg-brand-light" : "border-ink/10 bg-white"
            }`}
          >
            <span
              className="h-9 w-full rounded-md"
              style={{ background: `linear-gradient(160deg, ${t.colors[0]}, ${t.colors[1]})` }}
            />
            <span className="whitespace-nowrap text-[0.64rem] font-extrabold tracking-tight">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border-2 border-ink/10 bg-[#F4EEE1]">
        <canvas ref={canvasRef} className="block w-full" style={{ aspectRatio: "1080 / 1350" }} />
      </div>
      {rendering ? <p className="mt-1 text-center text-[0.8rem] font-semibold text-ink/50">카드를 그리는 중…</p> : null}

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
              className={`rounded-full border-2 px-3 py-1.5 text-[0.85rem] font-bold ${
                message === p ? "border-brand bg-brand-light text-brand-dark" : "border-ink/12 bg-white text-ink/70"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <BigButton variant="white" onClick={save}>
          <IconDownload size={22} /> 저장
        </BigButton>
        <BigButton variant="warm" onClick={send}>
          <IconShare size={22} /> 카톡으로 보내기
        </BigButton>
      </div>
      <p className="mt-2 text-center text-[0.78rem] font-medium text-ink/45">
        {kakaoConfig().configured
          ? "카카오톡 공유 카드로 바로 보낼 수 있어요. 친구를 고르면 끝나요."
          : "휴대폰 공유창으로 보낼 수 있어요. 카카오 앱 키를 넣으면 카카오톡 공유 카드로 바뀌어요."}
      </p>
    </Card>
  );
}
