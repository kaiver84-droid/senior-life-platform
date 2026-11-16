"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useApp, medToday } from "@/lib/storage";
import { renderAnbuCard } from "@/lib/canvas";
import { shareCard, shareMessageText, shareText } from "@/lib/share";
import { koreanDate } from "@/lib/week";
import { Badge, BigButton, Card, Divider, SectionTitle, useToast } from "./ui";
import { IconCheck, IconChat, IconShare } from "./icons";

export function FamilyTab() {
  const { profile, state, today, toggleMed, streak, todayDaily, code } = useApp();
  const { show } = useToast();
  const med = medToday(state, today);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const timeLabel = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });

  useEffect(() => {
    if (!canvasRef.current || !profile) return;
    void renderAnbuCard(canvasRef.current, {
      name: profile.nickname,
      morning: med.morning,
      evening: med.evening,
      streak,
      quizDone: Boolean(todayDaily?.done),
      timeLabel,
      dateLabel: koreanDate(today),
    });
  }, [profile, med.morning, med.evening, streak, todayDaily?.done, timeLabel, today]);

  const sendAnbu = useCallback(async () => {
    if (!canvasRef.current || !profile) return;
    const result = await shareCard({
      canvas: canvasRef.current,
      filename: `안부카드_${profile.nickname}_${today}.png`,
      title: `${profile.nickname} 님의 오늘 안부`,
      description: "오늘도 잘 지내고 있어요",
      text: `${profile.nickname} 님: 오늘도 잘 지내고 있어요. (아침 약 ${med.morning ? "먹음" : "아직"}, 저녁 약 ${
        med.evening ? "먹음" : "아직"
      }) - 시니어생활 도우미`,
    });
    show(shareMessageText(result));
  }, [profile, today, med, show]);

  const sendLink = useCallback(async () => {
    const url = `${window.location.origin}/family/?code=${code}`;
    const result = await shareText({
      title: "부모님 오늘 안부 확인",
      text: `${profile?.nickname} 님의 오늘 안부예요. 아래 링크에서 확인하세요: ${url}`,
    });
    show(result === "failed" ? "링크를 복사하지 못했어요. 아래 주소를 직접 보내 주세요." : "자녀에게 보낼 링크를 준비했어요.");
  }, [profile?.nickname, code, show]);

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-[1.55rem] font-black leading-snug">👨‍👩‍👦 가족 연결</h1>
        <p className="mt-1 text-[0.98rem] font-semibold text-ink/60">복약 체크와 오늘 안부를 한 번에</p>
      </section>

      <Card className="fade-up">
        <SectionTitle emoji="💊" right={<Badge tone="leaf">{med.morning && med.evening ? "완료 ✓" : `${(med.morning?0:1)+(med.evening?0:1)}개 남음`}</Badge>}>
          오늘의 복약 체크
        </SectionTitle>
        <div className="mt-2 grid grid-cols-1 gap-3">
          <MedToggle
            label="아침 약"
            time="보통 오전 8시"
            on={med.morning}
            onClick={() => toggleMed("morning")}
          />
          <MedToggle label="저녁 약" time="보통 오후 7시" on={med.evening} onClick={() => toggleMed("evening")} />
        </div>
        <p className="mt-3 text-center text-[0.88rem] font-semibold text-ink/55">
          약을 드시면 큰 버튼을 한 번 눌러 주세요. 자녀 화면에 바로 표시돼요.
        </p>
      </Card>

      <Card className="fade-up">
        <SectionTitle emoji="💌">자녀에게 오늘 안부 보내기</SectionTitle>
        <p className="text-[0.95rem] font-semibold leading-snug text-ink/65">
          복약 상태와 출석 기록이 담긴 카드를 카카오톡으로 보내요.
        </p>
        <canvas ref={canvasRef} className="hidden" />
        <div className="mt-3 grid grid-cols-1 gap-2">
          <BigButton variant="warm" size="lg" onClick={sendAnbu}>
            <IconChat size={22} /> 안부 카드 보내기
          </BigButton>
          <BigButton variant="white" onClick={sendLink}>
            <IconShare size={20} /> 자녀 확인 화면 링크 보내기
          </BigButton>
        </div>
      </Card>

      <Card className="fade-up">
        <SectionTitle emoji="📊">자녀 확인 화면</SectionTitle>
        <div className="flex items-center justify-between rounded-2xl bg-brand-light/70 px-4 py-3">
          <div>
            <p className="text-[0.82rem] font-bold text-ink/55">가족 코드</p>
            <p className="tabular text-[1.5rem] font-black tracking-[0.2em] text-brand-dark">{code || "------"}</p>
          </div>
          <button
            onClick={() => {
              void navigator.clipboard?.writeText(code);
              show("가족 코드를 복사했어요.");
            }}
            className="rounded-xl border-2 border-brand/25 bg-white px-3 py-2 text-[0.9rem] font-extrabold text-brand-dark"
          >
            복사
          </button>
        </div>
        <Divider />
        <Link
          href="/family/"
          className="touch-btn w-full border-2 border-ink/15 bg-white text-[1.02rem] font-extrabold text-ink"
        >
          자녀 화면 미리 보기
        </Link>
        <p className="mt-2 text-center text-[0.82rem] font-medium leading-relaxed text-ink/50">
          같은 휴대폰이면 바로 보이고, 자녀 휴대폰에서는 위 코드를 넣으면 확인할 수 있어요.
        </p>
      </Card>

      <Card className="fade-up bg-gradient-to-br from-white to-leaf-light/50">
        <div className="flex items-center gap-2">
          <span className="text-[1.4rem]">🌱</span>
          <p className="text-[1.02rem] font-black">
            오늘 {streak}일 연속 출석 중이에요
          </p>
        </div>
        <p className="mt-1 text-[0.95rem] font-semibold text-ink/65">
          퀴즈 {todayDaily?.done ? "완료" : "아직"} · 이번 주 {state.quizLogs.filter((q) => q.date >= today.slice(0, 8) + "01").reduce((a, b) => a + b.points, 0)}점
        </p>
      </Card>
    </div>
  );
}

function MedToggle({
  label,
  time,
  on,
  onClick,
}: {
  label: string;
  time: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`flex min-h-[78px] w-full items-center gap-3 rounded-2xl border-2 px-4 text-left transition ${
        on ? "border-leaf bg-leaf-light" : "border-ink/12 bg-white"
      }`}
    >
      <span
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${
          on ? "bg-leaf text-white" : "bg-ink/8 text-ink/35"
        }`}
      >
        <IconCheck size={26} />
      </span>
      <span className="flex-1">
        <span className="block text-[1.1rem] font-black">{label}</span>
        <span className="block text-[0.85rem] font-semibold text-ink/50">{time}</span>
      </span>
      <span className={`text-[1rem] font-black ${on ? "text-leaf" : "text-ink/35"}`}>
        {on ? "먹었어요" : "눌러 주세요"}
      </span>
    </button>
  );
}
