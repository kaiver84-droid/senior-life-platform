"use client";

import React, { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useApp, medToday } from "@/lib/storage";
import { renderAnbuCard } from "@/lib/canvas";
import { shareCard, shareMessageText, shareText } from "@/lib/share";
import { shareLinkFor } from "@/lib/og";
import { koreanDate } from "@/lib/week";
import { Badge, BigButton, Card, SectionTitle, useToast } from "./ui";
import { FamilyCalendarCard } from "./calendar";
import { AssetImage } from "./art";
import {
  IconCheck,
  IconChat,
  IconChevron,
  IconFamily,
  IconQuiz,
  IconShare,
} from "./icons";

export function FamilyTab({
  onNavigate,
  onOpenCalendar,
}: {
  onNavigate?: (tab: string) => void;
  onOpenCalendar?: () => void;
}) {
  const { profile, state, today, toggleMed, streak, todayDaily, code } = useApp();
  const { show } = useToast();
  const med = medToday(state, today);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const timeLabel = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  const doneCount = (todayDaily?.done ? 1 : 0) + (med.morning || med.evening ? 1 : 0) + (state.visits.includes(today) ? 1 : 0);

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
      text: `${profile.nickname} 님: 오늘도 잘 지내고 있어요. (아침 약 ${
        med.morning ? "먹음" : "아직"
      }, 저녁 약 ${med.evening ? "먹음" : "아직"}) - 늘봄`,
      // 자녀가 받는 링크 — 가족 안부 상황으로 미리보기가 뜼다
      link: shareLinkFor("family", { familyCode: code }),
    });
    show(shareMessageText(result));
  }, [profile, today, med, code, show]);

  const sendLink = useCallback(async () => {
    const url = shareLinkFor("family", { familyCode: code });
    const result = await shareText({
      title: "부모님 오늘 안부 확인",
      text: `${profile?.nickname} 님의 오늘 안부예요. 아래 링크에서 확인하세요: ${url}`,
      link: url,
    });
    show(
      result === "failed"
        ? "링크를 복사하지 못했어요. 아래 주소를 직접 보내 주세요."
        : "자녀에게 보낼 링크를 준비했어요."
    );
  }, [profile?.nickname, code, show]);

  return (
    <div className="space-y-4">
      <section className="fade-up flex items-start justify-between gap-2 pt-1">
        <div>
          <p className="text-[0.86rem] font-extrabold tracking-tight text-brand-dark/80">가족과 연결</p>
          <h1 className="mt-0.5 text-[1.5rem] font-black leading-tight text-ink">가족에게 안부 전하기</h1>
          <p className="mt-1 text-[0.88rem] font-semibold text-ink/55">복약 체크와 오늘 안부를 한 번에</p>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-coral-light text-coral-dark">
          <IconFamily size={24} />
        </span>
      </section>

      {/* 가족안부달력 */}
      <FamilyCalendarCard onOpen={() => onOpenCalendar?.()} />

      {/* 따뜻한 가족 사진 배너 */}
      <div className="fade-up overflow-hidden rounded-[1.7rem] bg-white shadow-card">
        <div className="relative h-[160px] w-full overflow-hidden bg-[#F3EEE2]">
          <AssetImage
            name="family-greeting-couple"
            alt="거실에서 함께 휴대폰을 보며 웃는 어르신 부부"
            className="h-full w-full object-cover object-[center_30%]"
          />
          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white via-white/40 to-transparent" />
        </div>
        <div className="px-4 pb-4 pt-3">
          <p className="text-[1.05rem] font-black leading-snug text-ink">부모님의 안부를 자녀에게 전송해요</p>
          <p className="mt-0.5 text-[0.84rem] font-semibold text-ink/55">
            오늘 하루를 카카오톡으로 전해 보세요.
          </p>
          <button
            onClick={sendAnbu}
            className="mt-3 flex min-h-[50px] w-full items-center justify-center gap-1.5 rounded-2xl bg-coral text-[1rem] font-extrabold text-white shadow-soft active:bg-coral-dark"
          >
            안부 전송하기 <IconChevron size={18} />
          </button>
        </div>
      </div>

      {/* 오늘의 활동 */}
      <Card className="fade-up p-4">
        <SectionTitle emoji="💊" right={<Badge tone="leaf">{doneCount} / 3 활동</Badge>}>
          오늘의 활동
        </SectionTitle>

        <div className="mt-1 space-y-1.5">
          <ActivityRow
            icon={<IconQuiz size={20} />}
            title="치매예방 퀴즈"
            sub={todayDaily?.done ? `${todayDaily.correct}문제 정답` : "아직 안 했어요"}
            done={Boolean(todayDaily?.done)}
            action={
              todayDaily?.done ? null : (
                <button
                  onClick={() => onNavigate?.("quiz")}
                  className="rounded-full bg-brand-light px-3 py-1.5 text-[0.78rem] font-extrabold text-brand-deep"
                >
                  풀기
                </button>
              )
            }
          />
          <ActivityRow
            icon={<span className="text-[1rem]">💊</span>}
            title="복약 체크"
            sub={`아침 ${med.morning ? "완료" : "아직"} · 저녁 ${med.evening ? "완료" : "아직"}`}
            done={med.morning && med.evening}
            action={<Badge tone={med.morning && med.evening ? "leaf" : "gray"}>{med.morning && med.evening ? "완료" : `${(med.morning ? 0 : 1) + (med.evening ? 0 : 1)}개 남음`}</Badge>}
          />
          <ActivityRow
            icon={<span className="text-[1rem]">🌱</span>}
            title="오늘 출석"
            sub={`${streak}일 연속으로 함께하고 있어요`}
            done
            action={<Badge tone="leaf">출석 완료</Badge>}
          />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2">
          <MedToggle label="아침 약" time="보통 오전 8시" on={med.morning} onClick={() => toggleMed("morning")} />
          <MedToggle label="저녁 약" time="보통 오후 7시" on={med.evening} onClick={() => toggleMed("evening")} />
        </div>
        <p className="mt-2 text-center text-[0.82rem] font-semibold text-ink/45">
          약을 드시면 큰 버튼을 한 번 눌러 주세요. 자녀 화면에 바로 표시돼요.
        </p>
      </Card>

      {/* 안부 카드 · 자녀 확인 */}
      <Card className="fade-up p-4">
        <SectionTitle emoji="💌">자녀에게 오늘 안부 보내기</SectionTitle>
        <p className="text-[0.9rem] font-semibold leading-snug text-ink/60">
          복약 상태와 출석 기록이 담긴 카드를 카카오톡으로 보내요.
        </p>
        <canvas ref={canvasRef} className="hidden" />
        <div className="mt-3 grid grid-cols-1 gap-2">
          <BigButton variant="coral" size="lg" onClick={sendAnbu}>
            <IconChat size={22} /> 안부 카드 보내기
          </BigButton>
          <BigButton variant="white" onClick={sendLink}>
            <IconShare size={20} /> 자녀 확인 링크 보내기
          </BigButton>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-2xl bg-brand-light/70 px-4 py-3">
          <div>
            <p className="text-[0.8rem] font-bold text-ink/50">가족 연결 번호</p>
            <p className="tabular text-[1.35rem] font-black tracking-[0.18em] text-brand-deep">{code || "------"}</p>
          </div>
          <button
            onClick={() => {
              void navigator.clipboard?.writeText(code);
              show("가족 연결 번호를 복사했어요.");
            }}
            className="rounded-xl bg-white px-3.5 py-2 text-[0.86rem] font-extrabold text-brand-deep shadow-soft"
          >
            복사
          </button>
        </div>
        <Link
          href="/family/"
          className="touch-btn mt-2 w-full border-2 border-ink/10 bg-white text-[1rem] font-extrabold text-ink shadow-soft"
        >
          자녀 화면 미리 보기
        </Link>
        <p className="mt-2 text-center text-[0.78rem] font-medium leading-relaxed text-ink/45">
          같은 휴대폰이면 바로 보이고, 자녀 휴대폰에서는 위 번호를 넣으면 확인할 수 있어요.
        </p>
      </Card>

      <div className="fade-up flex items-center gap-2 rounded-[1.5rem] bg-gradient-to-r from-leaf-light to-white px-4 py-3 shadow-soft">
        <span className="text-[1.3rem]">🌱</span>
        <p className="text-[0.92rem] font-bold text-ink/75">
          오늘 {streak}일 연속 출석 중이에요 · 이번 주 퀴즈{" "}
          {state.quizLogs.filter((q) => q.date >= today.slice(0, 8) + "01").reduce((a, b) => a + b.points, 0)}점
        </p>
      </div>
    </div>
  );
}

function ActivityRow({
  icon,
  title,
  sub,
  done,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  done: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl px-1 py-2">
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
          done ? "bg-leaf-light text-leaf-dark" : "bg-ink/5 text-ink/40"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.98rem] font-black leading-snug text-ink">{title}</span>
        <span className="block truncate text-[0.82rem] font-semibold text-ink/50">{sub}</span>
      </span>
      {action ?? (
        <span className={`grid h-7 w-7 place-items-center rounded-full ${done ? "bg-leaf text-white" : "bg-ink/10 text-white"}`}>
          <IconCheck size={16} />
        </span>
      )}
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
      className={`flex min-h-[74px] w-full items-center gap-3 rounded-2xl border-2 px-4 text-left transition ${
        on ? "border-leaf bg-leaf-light" : "border-ink/8 bg-white"
      }`}
    >
      <span
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${
          on ? "bg-leaf text-white" : "bg-ink/6 text-ink/30"
        }`}
      >
        <IconCheck size={26} />
      </span>
      <span className="flex-1">
        <span className="block text-[1.05rem] font-black text-ink">{label}</span>
        <span className="block text-[0.8rem] font-semibold text-ink/45">{time}</span>
      </span>
      <span className={`text-[0.92rem] font-black ${on ? "text-leaf-dark" : "text-ink/35"}`}>
        {on ? "먹었어요" : "눌러 주세요"}
      </span>
    </button>
  );
}
