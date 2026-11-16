"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dailyQuestions, calcPoints, QUIZ_TYPE_LABEL, QUIZ_TYPE_EMOJI, type Question } from "@/lib/quiz";
import { renderCertificate, downloadCanvas } from "@/lib/canvas";
import { shareCard, shareMessageText } from "@/lib/share";
import { useApp } from "@/lib/storage";
import { koreanDate } from "@/lib/week";
import { Badge, BigButton, Card, ProgressDots, SectionTitle, useToast } from "./ui";
import { IconDownload, IconShare } from "./icons";
import { RankingPanel } from "./ranking";

export function QuizTab({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { profile, today, todayDaily, completeQuiz, weekPoints, streak } = useApp();
  const { show } = useToast();
  const questions = useMemo(() => dailyQuestions(today), [today]);
  const [mode, setMode] = useState<"intro" | "play" | "done">(todayDaily?.done ? "done" : "intro");
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const startedAt = useRef<number>(0);
  const usedSeconds = useRef<number>(0);

  useEffect(() => {
    setMode(todayDaily?.done ? "done" : "intro");
  }, [todayDaily?.done]);

  useEffect(() => {
    if (mode !== "play") return;
    const t = setInterval(() => {
      setSeconds(Math.round((Date.now() - startedAt.current) / 1000) + usedSeconds.current);
    }, 1000);
    return () => clearInterval(t);
  }, [mode]);

  const start = () => {
    startedAt.current = Date.now();
    usedSeconds.current = 0;
    setIndex(0);
    setPicked(null);
    setCorrectCount(0);
    setMode("play");
  };

  const q: Question | undefined = questions[index];

  const choose = (i: number) => {
    if (picked !== null || !q) return;
    setPicked(i);
    if (i === q.answer) setCorrectCount((c) => c + 1);
  };

  const next = () => {
    if (!q) return;
    const lastCorrect = picked === q.answer ? 1 : 0;
    const totalCorrect = correctCount + (picked === q.answer ? 0 : 0);
    void lastCorrect;
    void totalCorrect;
    if (index + 1 >= questions.length) {
      const finalCorrect = correctCount;
      const secs = Math.max(5, Math.round((Date.now() - startedAt.current) / 1000));
      const points = calcPoints(finalCorrect, questions.length, secs);
      completeQuiz({
        correct: finalCorrect,
        total: questions.length,
        points,
        seconds: secs,
        types: questions.map((x) => x.type),
      });
      setMode("done");
      show(`오늘의 퀴즈 완료! ${finalCorrect}문제 정답, ${points}점이에요.`);
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
  };

  return (
    <div className="space-y-5">
      <section>
        <div className="mb-1 flex items-center gap-2">
          <Badge tone="brand">{koreanDate(today)}</Badge>
          <Badge tone="leaf">🔥 {streak}일 연속</Badge>
        </div>
        <h1 className="text-[1.55rem] font-black leading-snug">🧠 1분 두뇌 퀴즈</h1>
        <p className="mt-1 text-[0.98rem] font-semibold text-ink/60">
          하루 3문제 · 이번 주 {weekPoints}점
        </p>
      </section>

      {mode === "intro" ? (
        <Card className="fade-up">
          <p className="text-[1.05rem] font-bold leading-relaxed text-ink/85">
            오늘의 3문제가 준비됐어요.
            <br />
            <span className="text-ink/60">초성 · 옛날 노래 · 틀린 그림 찾기</span>
          </p>
          <div className="mt-4 space-y-2">
            {questions.map((qq, i) => (
              <div key={qq.id} className="flex items-center gap-3 rounded-xl bg-brand-light/60 px-3 py-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-[0.9rem] font-black text-brand-dark">
                  {i + 1}
                </span>
                <span className="text-[1rem] font-bold">
                  {QUIZ_TYPE_EMOJI[qq.type]} {QUIZ_TYPE_LABEL[qq.type]}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <BigButton variant="leaf" size="lg" full onClick={start}>
              퀴즈 시작하기
            </BigButton>
          </div>
          <p className="mt-2 text-center text-[0.82rem] font-medium text-ink/45">
            하루 3문제까지만 풀 수 있어요. 내일 또 만나요!
          </p>
        </Card>
      ) : null}

      {mode === "play" && q ? (
        <Card className="fade-up">
          <div className="flex items-center justify-between">
            <Badge tone="brand">
              {QUIZ_TYPE_EMOJI[q.type]} {QUIZ_TYPE_LABEL[q.type]}
            </Badge>
            <span className="tabular text-[0.95rem] font-black text-ink/60">
              {index + 1} / {questions.length}
            </span>
          </div>
          <div className="mt-2">
            <ProgressDots total={questions.length} current={index + (picked !== null ? 1 : 0)} />
          </div>

          {q.type === "spot" ? (
            <div className="mt-4">
              <p className="text-center text-[1.1rem] font-extrabold leading-snug">{q.prompt}</p>
              <p className="mt-1 text-center text-[0.9rem] font-semibold text-ink/55">{q.hint}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {q.options.map((cell, i) => {
                  const isPicked = picked === i;
                  const isAnswer = picked !== null && i === q.answer;
                  return (
                    <button
                      key={i}
                      onClick={() => choose(i)}
                      disabled={picked !== null}
                      className={`grid aspect-square place-items-center rounded-2xl border-2 text-[2rem] transition ${
                        isAnswer
                          ? "border-leaf bg-leaf-light"
                          : isPicked
                            ? "border-warm bg-warm-light"
                            : "border-ink/10 bg-[#FBF7EC]"
                      }`}
                      aria-label={`${i + 1}번째 그림`}
                    >
                      {cell}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <p
                className={`whitespace-pre-line rounded-2xl bg-[#FBF7EC] px-4 py-5 text-center font-black leading-snug ${
                  q.type === "choseong" ? "text-[2.6rem] tracking-[0.28em]" : "text-[1.2rem]"
                }`}
              >
                {q.type === "lyrics" ? q.prompt.replace("___", "＿＿＿＿") : q.prompt}
              </p>
              <p className="mt-2 text-center text-[0.92rem] font-semibold text-ink/55">힌트: {q.hint}</p>
              <div className="mt-4 space-y-2.5">
                {q.options.map((opt, i) => {
                  const isPicked = picked === i;
                  const isAnswer = picked !== null && i === q.answer;
                  return (
                    <button
                      key={opt}
                      onClick={() => choose(i)}
                      disabled={picked !== null}
                      className={`flex min-h-[58px] w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[1.08rem] font-bold transition ${
                        isAnswer
                          ? "border-leaf bg-leaf-light text-leaf"
                          : isPicked
                            ? "border-warm bg-warm-light text-[#A83509]"
                            : "border-ink/12 bg-white"
                      }`}
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink/5 text-[0.9rem] font-black">
                        {i + 1}
                      </span>
                      <span>{opt}</span>
                      {isAnswer ? <span className="ml-auto text-[1.2rem]">⭕</span> : null}
                      {isPicked && !isAnswer ? <span className="ml-auto text-[1.2rem]">❌</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {picked !== null ? (
            <div className="pop mt-4 rounded-2xl border-2 border-leaf/30 bg-leaf-light/70 p-4">
              <p className="text-[1.05rem] font-black text-leaf">
                {picked === q.answer ? "정답이에요! 참 잘하셨어요 👏" : "아쉽지만 괜찮아요. 정답을 확인해요"}
              </p>
              <p className="mt-1 text-[0.98rem] font-semibold leading-snug text-ink/80">{q.explain}</p>
              <div className="mt-3">
                <BigButton variant="leaf" full onClick={next}>
                  {index + 1 >= questions.length ? "결과 보기" : "다음 문제"}
                </BigButton>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-center text-[0.85rem] font-medium text-ink/45">
              답을 하나 골라 주세요 · {seconds}초 지났어요
            </p>
          )}
        </Card>
      ) : null}

      {mode === "done" ? (
        <ResultAndCertificate
          correct={todayDaily?.correct ?? correctCount}
          total={3}
          points={todayDaily?.points ?? weekPoints}
          show={show}
        />
      ) : null}

      <RankingPanel onNavigate={onNavigate} />
    </div>
  );
}

function ResultAndCertificate({
  correct,
  total,
  points,
  show,
}: {
  correct: number;
  total: number;
  points: number;
  show: (m: string) => void;
}) {
  const { profile, today } = useApp();
  const [showCert, setShowCert] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!showCert || !canvasRef.current || !profile) return;
    void renderCertificate(canvasRef.current, {
      name: profile.nickname,
      correct,
      total,
      points,
      dateLabel: koreanDate(today) + " · " + new Date().getFullYear(),
    });
  }, [showCert, profile, correct, total, points, today]);

  const save = useCallback(() => {
    if (!canvasRef.current || !profile) return;
    downloadCanvas(canvasRef.current, `상장_${profile.nickname}_${today}.png`);
    show("상장을 저장했어요. 사진첩에서 확인해 보세요.");
  }, [profile, today, show]);

  const send = useCallback(async () => {
    if (!canvasRef.current || !profile) return;
    const result = await shareCard({
      canvas: canvasRef.current,
      filename: `상장_${profile.nickname}_${today}.png`,
      title: `${profile.nickname} 님의 두뇌 퀴즈 상장`,
      description: `정답 ${correct}문제 · ${points}점`,
      text: `오늘의 두뇌 퀴즈 ${correct}/${total}문제 정답! ${profile.nickname} (시니어생활 도우미)`,
    });
    show(shareMessageText(result));
  }, [profile, correct, total, points, today, show]);

  return (
    <>
      <Card className="fade-up border-2 border-gold/40 bg-gradient-to-br from-white to-gold-light/60">
        <p className="text-center text-[0.9rem] font-extrabold text-gold">오늘의 퀴즈 결과</p>
        <p className="mt-1 text-center text-[2rem] font-black leading-none">
          {correct}
          <span className="text-[1.1rem] text-ink/50"> / {total}</span>
        </p>
        <p className="mt-1 text-center text-[0.98rem] font-bold text-ink/70">획득 {points}점</p>
        <div className="mt-3 rounded-2xl bg-white/80 p-3 text-center text-[0.95rem] font-semibold text-ink/75">
          내일 0시에 새로운 3문제가 열려요.
          <br />
          매주 월요일 0시에 순위가 새로 시작됩니다.
        </div>
        <div className="mt-3">
          <BigButton variant="gold" size="lg" full onClick={() => setShowCert((v) => !v)}>
            🏅 {showCert ? "상장 접기" : "금빛 상장 만들기"}
          </BigButton>
        </div>
      </Card>

      {showCert ? (
        <Card className="fade-up">
          <SectionTitle emoji="🏅">나의 상장</SectionTitle>
          <div className="overflow-hidden rounded-2xl border-2 border-ink/10 bg-[#FFFDF3]">
            <canvas ref={canvasRef} className="block w-full" style={{ aspectRatio: "1200 / 860" }} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <BigButton variant="white" onClick={save}>
              <IconDownload size={22} /> 저장
            </BigButton>
            <BigButton variant="warm" onClick={send}>
              <IconShare size={22} /> 자랑하기
            </BigButton>
          </div>
        </Card>
      ) : null}
    </>
  );
}
