"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dailyQuestions, calcPoints, QUIZ_TYPE_LABEL, QUIZ_TYPE_EMOJI, type Question } from "@/lib/quiz";
import { renderCertificate, downloadCanvas } from "@/lib/canvas";
import { shareCard, shareMessageText } from "@/lib/share";
import { useApp } from "@/lib/storage";
import { koreanDate } from "@/lib/week";
import { Badge, BigButton, Card, SectionTitle, Sheet, useToast } from "./ui";
import { IconChevron, IconClock, IconDownload, IconShare, IconTrophy } from "./icons";
import { RankingPanel } from "./ranking";

export function QuizTab({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { today, todayDaily, completeQuiz, weekPoints, streak } = useApp();
  const { show } = useToast();
  const questions = useMemo(() => dailyQuestions(today), [today]);
  const [mode, setMode] = useState<"intro" | "play" | "done">(todayDaily?.done ? "done" : "intro");
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const startedAt = useRef<number>(0);

  useEffect(() => {
    setMode(todayDaily?.done ? "done" : "intro");
  }, [todayDaily?.done]);

  useEffect(() => {
    if (mode !== "play") return;
    const t = setInterval(() => {
      setSeconds(Math.round((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [mode]);

  const start = () => {
    startedAt.current = Date.now();
    setIndex(0);
    setPicked(null);
    setChecked(false);
    setCorrectCount(0);
    setSeconds(0);
    setMode("play");
  };

  const q: Question | undefined = questions[index];

  const choose = (i: number) => {
    if (checked || !q) return;
    setPicked(i);
  };

  const confirm = () => {
    if (picked === null || checked || !q) return;
    setChecked(true);
    if (picked === q.answer) setCorrectCount((c) => c + 1);
  };

  const next = () => {
    if (!q) return;
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
    setChecked(false);
  };

  return (
    <div className="space-y-4">
      <section className="fade-up flex items-start justify-between gap-2 pt-1">
        <div>
          <p className="text-[0.86rem] font-extrabold tracking-tight text-brand-dark/80">오늘의 두뇌 건강</p>
          <h1 className="mt-0.5 text-[1.5rem] font-black leading-tight text-ink">1분 두뇌 퀴즈</h1>
          <p className="mt-1 text-[0.88rem] font-semibold text-ink/55">
            하루 3문제 · 이번 주 {weekPoints}점 {streak > 0 ? `· 🔥 ${streak}일 연속` : ""}
          </p>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-full bg-gold-light text-gold-dark">
          <IconTrophy size={24} />
        </span>
      </section>

      {mode === "intro" ? (
        <Card className="fade-up overflow-hidden p-5">
          <div className="rounded-[1.4rem] bg-gradient-to-br from-sky to-[#F4F9FD] p-5 text-center">
            <div className="text-[2.6rem] leading-none">🧠</div>
            <p className="mt-2 text-[1.15rem] font-black leading-snug text-ink">
              오늘의 3문제가
              <br />
              준비됐어요
            </p>
            <p className="mt-1 text-[0.9rem] font-semibold text-ink/55">초성 · 옛날 노래 · 틀린 그림 찾기</p>
          </div>

          <div className="mt-4 space-y-2">
            {questions.map((qq, i) => (
              <div key={qq.id} className="flex items-center gap-3 rounded-2xl bg-paper px-3.5 py-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-[0.86rem] font-black text-brand-dark shadow-soft">
                  {i + 1}
                </span>
                <span className="text-[0.98rem] font-bold text-ink/80">
                  {QUIZ_TYPE_EMOJI[qq.type]} {QUIZ_TYPE_LABEL[qq.type]}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <BigButton variant="ink" size="lg" full onClick={start}>
              퀴즈 시작하기 <IconChevron size={20} />
            </BigButton>
          </div>
          <p className="mt-2 text-center text-[0.8rem] font-medium text-ink/45">
            하루 3문제까지만 풀 수 있어요. 내일 또 만나요!
          </p>
        </Card>
      ) : null}

      {mode === "play" && q ? (
        <div className="fade-up space-y-3">
          {/* 진행 바 */}
          <div className="flex items-center gap-3 rounded-full bg-ink px-4 py-2.5 shadow-cta">
            <span className="tabular whitespace-nowrap text-[0.9rem] font-extrabold text-white">
              {index + 1} / {questions.length} 문제
            </span>
            <span className="flex flex-1 items-center justify-center gap-1.5">
              {questions.map((_, i) => (
                <span
                  key={i}
                  className={`h-2.5 rounded-full transition-all ${
                    i === index ? "w-4 bg-sun" : i < index ? "w-2.5 bg-white/75" : "w-2.5 bg-white/25"
                  }`}
                />
              ))}
            </span>
            {checked ? (
              <span className="flex items-center gap-0.5 text-[0.78rem] font-bold text-white/70">
                <IconClock size={14} />
                {seconds}초
              </span>
            ) : null}
            <IconTrophy size={20} className="shrink-0 text-sun" />
          </div>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <Badge tone="brand">
                {QUIZ_TYPE_EMOJI[q.type]} {QUIZ_TYPE_LABEL[q.type]}
              </Badge>
              {!checked ? (
                <span className="flex items-center gap-1 text-[0.78rem] font-bold text-ink/40">
                  <IconClock size={14} /> {seconds}초
                </span>
              ) : null}
            </div>

            {q.type === "spot" ? (
              <div className="mt-3">
                <p className="text-center text-[1.08rem] font-extrabold leading-snug">{q.prompt}</p>
                <p className="mt-1 text-center text-[0.88rem] font-semibold text-ink/50">{q.hint}</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {q.options.map((cell, i) => {
                    const isPicked = picked === i;
                    const isAnswer = checked && i === q.answer;
                    return (
                      <button
                        key={i}
                        onClick={() => choose(i)}
                        disabled={checked}
                        className={`grid aspect-square place-items-center rounded-2xl border-2 text-[2rem] transition ${
                          isAnswer
                            ? "border-leaf bg-leaf-light"
                            : isPicked
                              ? "border-brand bg-brand-light"
                              : "border-ink/8 bg-paper"
                        }`}
                        aria-label={`${i + 1}번째 그림`}
                        data-quiz-option={i}
                      >
                        {cell}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <div className="rounded-[1.4rem] bg-sky px-4 py-6 text-center">
                  <p
                    className={`whitespace-pre-line font-black leading-snug text-ink ${
                      q.type === "choseong" ? "text-[2.5rem] tracking-[0.22em]" : "text-[1.16rem]"
                    }`}
                  >
                    {q.type === "lyrics" ? q.prompt.replace("___", "＿＿＿＿") : q.prompt}
                  </p>
                </div>
                <p className="mt-2 text-center text-[0.88rem] font-semibold text-ink/50">힌트: {q.hint}</p>

                <div className="mt-3 space-y-2">
                  {q.options.map((opt, i) => {
                    const isPicked = picked === i;
                    const isAnswer = checked && i === q.answer;
                    const isWrong = checked && isPicked && i !== q.answer;
                    return (
                      <button
                        key={opt}
                        onClick={() => choose(i)}
                        disabled={checked}
                        data-quiz-option={i}
                        className={`flex min-h-[58px] w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[1.04rem] font-bold transition ${
                          isAnswer
                            ? "border-leaf bg-leaf-light text-leaf-dark"
                            : isWrong
                              ? "border-coral bg-coral-light text-coral-dark"
                              : isPicked
                                ? "border-brand bg-brand-light text-brand-deep"
                                : "border-ink/8 bg-white text-ink"
                        }`}
                      >
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink/5 text-[0.84rem] font-black text-ink/60">
                          {i + 1}
                        </span>
                        <span className="flex-1">{opt}</span>
                        {isAnswer ? <span className="text-[1.1rem]">⭕</span> : null}
                        {isWrong ? <span className="text-[1.1rem]">❌</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {!checked ? (
              <div className="mt-4">
                <BigButton variant="ink" size="lg" full onClick={confirm} disabled={picked === null}>
                  정답 확인 <IconChevron size={20} />
                </BigButton>
                <p className="mt-2 text-center text-[0.8rem] font-medium text-ink/40">
                  답을 하나 고른 뒤 눌러 주세요
                </p>
              </div>
            ) : (
              <div className="pop mt-4">
                <div
                  className={`rounded-2xl px-4 py-3.5 ${
                    picked === q.answer ? "bg-leaf-light" : "bg-coral-light"
                  }`}
                >
                  <p
                    className={`text-[1rem] font-black ${
                      picked === q.answer ? "text-leaf-dark" : "text-coral-dark"
                    }`}
                  >
                    {picked === q.answer ? "정답이에요! 참 잘하셨어요 👏" : "아쉽지만 괜찮아요. 정답을 확인해요"}
                  </p>
                  <p className="mt-1 text-[0.95rem] font-semibold leading-snug text-ink/75">{q.explain}</p>
                </div>
                <div className="mt-3">
                  <BigButton variant="ink" size="lg" full onClick={next}>
                    {index + 1 >= questions.length ? "결과 보기" : "다음 문제"}
                  </BigButton>
                </div>
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {mode === "done" ? (
        <ResultAndCertificate
          correct={todayDaily?.correct ?? correctCount}
          total={questions.length}
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
  const [certOpen, setCertOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);


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
      text: `오늘의 두뇌 퀴즈 ${correct}/${total}문제 정답! ${profile.nickname} (늘봄)`,
    });
    show(shareMessageText(result));
  }, [profile, correct, total, points, today, show]);

  const praise =
    correct === total ? "완벽해요! 오늘 두뇌가 아주 맑아요" : correct > 0 ? "잘하셨어요! 내일도 함께해요" : "괜찮아요. 내일 다시 도전해요";

  return (
    <>
      <Card className="fade-up overflow-hidden border-2 border-gold/50 bg-gradient-to-br from-[#FFFDF3] via-gold-light to-[#FFEBB5] p-5 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/80 text-gold-dark shadow-soft">
          <IconTrophy size={30} />
        </span>
        <p className="mt-2 text-[0.88rem] font-extrabold text-[#98720C]">오늘의 퀴즈 결과</p>
        <p className="mt-1 text-[2.6rem] font-black leading-none text-ink">
          {correct}
          <span className="text-[1.2rem] font-extrabold text-ink/45"> / {total}</span>
        </p>
        <p className="mt-1 text-[1rem] font-black text-[#8A6100]">{praise}</p>
        <div className="mt-3 flex items-center justify-center gap-2">
          <Badge tone="gold">획득 {points}점</Badge>
          <Badge tone="brand">이번 주 모아요</Badge>
        </div>
        <div className="mt-4">
          <BigButton variant="ink" size="lg" full onClick={() => setCertOpen(true)}>
            🏅 금빛 상장 만들기
          </BigButton>
        </div>
        <p className="mt-2 text-[0.82rem] font-semibold leading-relaxed text-ink/50">
          내일 0시에 새로운 3문제가 열려요.
          <br />
          매주 월요일 0시에 순위가 새로 시작됩니다.
        </p>
      </Card>

      <Sheet
        open={certOpen}
        onClose={() => setCertOpen(false)}
        title="나의 금빛 상장"
        subtitle="자랑하고 싶은 분께 보내 보세요"
      >
        <div className="overflow-hidden rounded-[1.4rem] bg-[#FFFDF3] shadow-soft">
          <CertPreview
            canvasRef={canvasRef}
            name={profile?.nickname || ""}
            correct={correct}
            total={total}
            points={points}
            dateLabel={koreanDate(today) + " · " + new Date().getFullYear()}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <BigButton variant="white" onClick={save}>
            <IconDownload size={22} /> 저장
          </BigButton>
          <BigButton variant="sun" onClick={send}>
            <IconShare size={22} /> 자랑하기
          </BigButton>
        </div>
      </Sheet>
    </>
  );
}

/** 시트가 열린 뒤(=포털 마운트 뒤) 상장을 그리는 캔버스 */
function CertPreview({
  canvasRef,
  name,
  correct,
  total,
  points,
  dateLabel,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  name: string;
  correct: number;
  total: number;
  points: number;
  dateLabel: string;
}) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !name) return;
    void renderCertificate(canvas, { name, correct, total, points, dateLabel }).catch(() => {});
  }, [canvasRef, name, correct, total, points, dateLabel]);
  return <canvas ref={canvasRef} className="block w-full" style={{ aspectRatio: "1200 / 860" }} />;
}
