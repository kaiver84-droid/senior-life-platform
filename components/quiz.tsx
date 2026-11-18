"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  dailyQuestions,
  practiceQuestions,
  calcPoints,
  QUIZ_TYPE_LABEL,
  QUIZ_TYPE_EMOJI,
  QUIZ_TYPE_ORDER,
  QUIZ_TOTAL_COUNT,
  type Question,
} from "@/lib/quiz";
import { renderCertificate, downloadCanvas } from "@/lib/canvas";
import { useApp } from "@/lib/storage";
import { useGroup } from "@/lib/group-store";
import { siteOrigin } from "@/lib/groups";
import { koreanDate } from "@/lib/week";
import { Badge, BigButton, Card, SectionTitle, Sheet, useToast } from "./ui";
import { SpeakButton } from "./speak";
import { IconChevron, IconClock, IconDownload, IconShare, IconTrophy } from "./icons";
import { AssetImage, Icon3D } from "./art";
import { RankingPanel } from "./ranking";
import { SharePreviewSheet, type ShareSheetData } from "./share-sheet";
import type { QuizType } from "@/lib/types";

/** 초성을 소리로 읽을 때 쓰는 이름 — “ㅅ ㄹ”을 “시옷, 리을”로 읽어 준다 */
const JAMO_NAME: Record<string, string> = {
  ㄱ: "기역", ㄲ: "쌍기역", ㄴ: "니은", ㄷ: "디귿", ㄸ: "쌍디귿", ㄹ: "리을",
  ㅁ: "미음", ㅂ: "비읍", ㅃ: "쌍비읍", ㅅ: "시옷", ㅆ: "쌍시옷", ㅇ: "이응",
  ㅈ: "지읒", ㅉ: "쌍지읒", ㅊ: "치읓", ㅋ: "키읔", ㅌ: "티읕", ㅍ: "피읖", ㅎ: "히읗",
  ㅏ: "아", ㅑ: "야", ㅓ: "어", ㅕ: "여", ㅗ: "오", ㅛ: "요", ㅜ: "우", ㅠ: "유", ㅡ: "으", ㅣ: "이",
};

/** 문제 하나를 소리로 읽어 줄 글 — 보기까지 차례대로 */
function questionSpeech(q: Question): string {
  const typeLabel = QUIZ_TYPE_LABEL[q.type];
  const plain = q.prompt.replace(/_{2,}/g, "빈칸").replace(/\n+/g, ". ");
  const options = q.options.map((o, i) => `${i + 1}번, ${o}`).join(". ");
  if (q.type === "choseong") {
    const letters = plain.replace(/\s/g, "").split("").map((ch) => JAMO_NAME[ch] || ch).join(", ");
    return `${typeLabel}. 초성 ${letters}. 힌트, ${q.hint}. 보기는 ${options} 입니다.`;
  }
  if (q.type === "spot") {
    return `${typeLabel}. ${plain}. 힌트, ${q.hint}. 그림 아홉 개 중에서 다른 하나를 찾아 눌러 주세요.`;
  }
  if (q.type === "ox") {
    return `${typeLabel}. ${plain}. 힌트, ${q.hint}. 맞으면 맞아요, 틀리면 아니에요를 눌러 주세요.`;
  }
  return `${typeLabel}. ${plain}. ${q.hint ? `힌트, ${q.hint}.` : ""} 보기는 ${options} 입니다.`;
}

export function QuizTab({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { today, todayDaily, completeQuiz, weekPoints, streak } = useApp();
  const { detail: groupDetail, active: activeGroup } = useGroup();
  const { show } = useToast();
  const dailyQs = useMemo(() => dailyQuestions(today), [today]);
  const [mode, setMode] = useState<"intro" | "play" | "done" | "practiceDone">(todayDaily?.done ? "done" : "intro");
  /** 지금 풀고 있는 문제 세트 (오늘의 3문제 또는 연습 3문제) */
  const [qs, setQs] = useState<Question[]>(dailyQs);
  const [isPractice, setIsPractice] = useState(false);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const startedAt = useRef<number>(0);

  useEffect(() => {
    setMode(todayDaily?.done ? "done" : "intro");
    if (!todayDaily?.done) setQs(dailyQs);
  }, [todayDaily?.done, dailyQs]);

  useEffect(() => {
    if (mode !== "play") return;
    const t = setInterval(() => {
      setSeconds(Math.round((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [mode]);

  const startSet = (list: Question[], practice: boolean) => {
    startedAt.current = Date.now();
    setQs(list);
    setIsPractice(practice);
    setIndex(0);
    setPicked(null);
    setChecked(false);
    setCorrectCount(0);
    setSeconds(0);
    setMode("play");
  };

  const start = () => startSet(dailyQs, false);

  /**
   * 연습 모드: 점수·연속 출석·순위와 무관한 기억 훈련용 3문제.
   * `only` 를 주면 그 주제(초성·노래·그림·OX·넌센스)에서만 3문제를 낸다.
   */
  const startPractice = (excludeFrom?: Question[], only?: QuizType) => {
    const exclude = [...dailyQs, ...(excludeFrom ?? [])].map((x) => x.id);
    startSet(practiceQuestions(exclude, only), true);
  };

  const q: Question | undefined = qs[index];

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
    if (index + 1 >= qs.length) {
      if (isPractice) {
        setMode("practiceDone");
        return;
      }
      const finalCorrect = correctCount;
      const secs = Math.max(5, Math.round((Date.now() - startedAt.current) / 1000));
      const points = calcPoints(finalCorrect, qs.length, secs);
      completeQuiz({
        correct: finalCorrect,
        total: qs.length,
        points,
        seconds: secs,
        types: qs.map((x) => x.type),
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
          <p className="text-[0.86rem] font-extrabold tracking-tight text-brand-dark/80">오늘의 기억 건강</p>
          <h1 className="mt-0.5 text-[1.5rem] font-black leading-tight text-ink">1분 치매예방 퀴즈</h1>
          <p className="mt-1 text-[0.88rem] font-semibold text-ink/55">
            하루 3문제 · 이번 주 {weekPoints}점 {streak > 0 ? `· 🔥 ${streak}일 연속` : ""}
          </p>
          <p
            data-quiz-bank={QUIZ_TOTAL_COUNT}
            className="mt-1 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[0.76rem] font-extrabold text-brand-dark shadow-soft"
          >
            📚 지금 {QUIZ_TOTAL_COUNT}문제가 준비돼 있어요
          </p>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-full bg-gold-light text-gold-dark">
          <IconTrophy size={24} />
        </span>
      </section>

      {activeGroup && groupDetail ? (
        <div className="fade-up flex items-center justify-between gap-2 rounded-2xl bg-white px-3.5 py-2.5 shadow-soft">
          <Badge tone="coral">👥 우리 모임 공동 퀴즈</Badge>
          <p className="text-[0.84rem] font-extrabold text-ink/60">
            우리 모임 참여자{" "}
            <span className="tabular text-brand-dark">
              {groupDetail.todayAttended} / {groupDetail.memberCount}명
            </span>
          </p>
        </div>
      ) : null}

      {mode === "intro" ? (
        <Card className="fade-up overflow-hidden p-5">
          <div className="rounded-[1.4rem] bg-gradient-to-br from-sky to-[#F4F9FD] p-5 text-center">
            <div className="mx-auto w-fit drop-shadow-[0_10px_18px_rgba(120,60,80,0.18)]">
              <Icon3D name="icon-3d-brain" size={78} alt="치매예방 퀴즈" />
            </div>
            <p className="mt-2 text-[1.15rem] font-black leading-snug text-ink">
              오늘의 3문제가
              <br />
              준비됐어요
            </p>
            <p className="mt-1 text-[0.9rem] font-semibold text-ink/55">
              초성 · 옛날 노래 · 틀린 그림 · OX · 넌센스
            </p>
          </div>

          <div className="mt-4 space-y-2">
            {dailyQs.map((qq, i) => (
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
            하루 3문제는 점수에 들어가요. 다 푼 뒤에는 연습 모드로 더 즐길 수 있어요.
          </p>

          {/* 주제 골라 바로 풀기 — OX·넌센스를 오늘 바로 만나 볼 수 있다 */}
          <div className="mt-4 border-t border-ink/8 pt-3.5">
            <p className="text-[0.92rem] font-extrabold text-ink/65">주제 골라 바로 풀기</p>
            <p className="mt-0.5 text-[0.78rem] font-semibold text-ink/45">
              점수와 상관없이 좋아하는 주제로 3문제를 풀어 볼 수 있어요.
            </p>
            <p
              data-quiz-bank={QUIZ_TOTAL_COUNT}
              className="mt-1 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[0.76rem] font-extrabold text-brand-dark shadow-soft"
            >
              📚 지금 {QUIZ_TOTAL_COUNT}문제가 준비돼 있어요
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5" data-quiz-topics>
              {QUIZ_TYPE_ORDER.map((t) => (
                <button
                  key={t}
                  type="button"
                  data-quiz-topic={t}
                  onClick={() => startPractice(undefined, t)}
                  className="flex min-h-[42px] items-center gap-1 rounded-full border-2 border-ink/10 bg-white px-3 text-[0.84rem] font-extrabold text-ink/75"
                >
                  <span aria-hidden>{QUIZ_TYPE_EMOJI[t]}</span>
                  {QUIZ_TYPE_LABEL[t]}
                </button>
              ))}
              <button
                type="button"
                onClick={() => startPractice()}
                className="flex min-h-[42px] items-center gap-1 rounded-full border-2 border-brand/30 bg-brand-light px-3 text-[0.84rem] font-extrabold text-brand-dark"
              >
                <span aria-hidden>🎲</span> 섞어서 3문제
              </button>
            </div>
          </div>
        </Card>
      ) : null}

      {mode === "play" && q ? (
        <div className="fade-up space-y-3">
          {/* 진행 바 */}
          <div className="flex items-center gap-3 rounded-full bg-ink px-4 py-2.5 shadow-cta">
            <span className="tabular whitespace-nowrap text-[0.9rem] font-extrabold text-white">
              {index + 1} / {qs.length} 문제
            </span>
            <span className="flex flex-1 items-center justify-center gap-1.5">
              {qs.map((_, i) => (
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
              <span className="flex items-center gap-2">
                {isPractice ? <Badge tone="gold">연습 모드</Badge> : null}
                {!checked ? (
                  <span className="flex items-center gap-1 text-[0.78rem] font-bold text-ink/40">
                    <IconClock size={14} /> {seconds}초
                  </span>
                ) : null}
              </span>
            </div>

            {/* 글씨가 어려운 분을 위해 문제와 보기를 소리로 읽어 준다 */}
            <div className="mt-2.5">
              <SpeakButton text={questionSpeech(q)} label="문제 소리로 듣기" dataName="quiz" />
            </div>

            {q.type === "ox" ? (
              <div className="mt-3">
                <div className="rounded-[1.4rem] bg-sky px-4 py-7 text-center">
                  <p className="text-[0.84rem] font-extrabold tracking-tight text-brand-dark/70">이 말이 맞을까요?</p>
                  <p className="mt-2 text-[1.28rem] font-black leading-snug text-ink">{q.prompt}</p>
                  <p className="mt-2 text-[0.86rem] font-semibold text-ink/50">힌트: {q.hint}</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2.5">
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
                        aria-label={i === 0 ? "맞아요" : "아니에요"}
                        className={`flex min-h-[132px] flex-col items-center justify-center gap-1 rounded-[1.4rem] border-2 px-2 py-3 transition ${
                          isAnswer
                            ? "border-leaf bg-leaf-light"
                            : isWrong
                              ? "border-coral bg-coral-light"
                              : isPicked
                                ? "border-brand bg-brand-light"
                                : "border-ink/8 bg-white"
                        }`}
                      >
                        <span className="text-[2.6rem] leading-none">{i === 0 ? "⭕" : "❌"}</span>
                        <span className="text-[1.02rem] font-black text-ink">
                          {i === 0 ? "맞아요" : "아니에요"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : q.type === "spot" ? (
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
                      q.type === "choseong"
                        ? q.prompt.length <= 5
                          ? "text-[2.5rem] tracking-[0.22em]"
                          : q.prompt.length <= 13
                            ? "text-[1.8rem] tracking-[0.12em]"
                            : "text-[1.35rem] tracking-[0.06em]"
                        : "text-[1.16rem]"
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
                    {index + 1 >= qs.length ? (isPractice ? "연습 결과 보기" : "결과 보기") : "다음 문제"}
                  </BigButton>
                </div>
              </div>
            )}
          </Card>

          {/* 하단 응원 배너 — 답을 고르는 영역을 가리지 않도록 문제 카드 아래에 둔다 */}
          <QuizCheerBanner />
        </div>
      ) : null}

      {mode === "done" ? (
        <ResultAndCertificate
          correct={todayDaily?.correct ?? correctCount}
          total={dailyQs.length}
          points={todayDaily?.points ?? weekPoints}
          show={show}
          onPractice={() => startPractice()}
        />
      ) : null}

      {mode === "practiceDone" ? (
        <PracticeResult
          correct={correctCount}
          total={qs.length}
          onAgain={() => startPractice(qs)}
          onBack={() => setMode(todayDaily?.done ? "done" : "intro")}
        />
      ) : null}

      <RankingPanel onNavigate={onNavigate} />
    </div>
  );
}

/** 연습 모드 결과 — 점수·순위에 들어가지 않는다는 점을 분명히 안내 */
function QuizCheerBanner() {
  return (
    <div className="relative flex items-end justify-between gap-1 overflow-hidden rounded-[1.6rem] bg-gradient-to-r from-[#FFF6E2] via-[#FFFCF2] to-[#F8F4E6] pl-4 pr-0.5 shadow-soft">
      <div className="pb-4 pt-4">
        <p className="hand text-[1.42rem] leading-[1.18] text-ink">하루 3문제로</p>
        <p className="hand text-[1.42rem] leading-[1.18] text-ink">
          가볍게! <span className="text-coral">♡</span>
        </p>
      </div>
      <AssetImage
        name="quiz-couple"
        alt="활짝 웃으며 엄지를 치켜든 어르신 부부"
        className="h-[108px] w-auto max-w-[46%] shrink-0 self-end object-contain mix-blend-multiply"
      />
    </div>
  );
}
function PracticeResult({
  correct,
  total,
  onAgain,
  onBack,
}: {
  correct: number;
  total: number;
  onAgain: () => void;
  onBack: () => void;
}) {
  const praise =
    correct === total
      ? "완벽해요! 머리가 아주 맑으시네요"
      : correct > 0
        ? "잘하셨어요! 한 세트 더 해 볼까요?"
        : "괜찮아요. 한 번 더 하면 금방 익숙해져요";

  return (
    <Card className="fade-up overflow-hidden border-2 border-brand/30 bg-gradient-to-br from-white via-sky to-[#EDF5FB] p-5 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white text-[1.8rem] shadow-soft">
        🧠
      </span>
      <p className="mt-2 text-[0.88rem] font-extrabold text-brand-dark/80">연습 모드 결과</p>
      <p className="mt-1 text-[2.4rem] font-black leading-none text-ink">
        {correct}
        <span className="text-[1.2rem] font-extrabold text-ink/45"> / {total}</span>
      </p>
      <p className="mt-1 text-[1rem] font-black text-brand-deep">{praise}</p>
      <p className="mt-2 text-[0.85rem] font-semibold leading-relaxed text-ink/55">
        연습 모드는 점수와 순위에 들어가지 않아요.
        <br />
        마음 편히 기억 훈련으로 즐겨 주세요.
      </p>
      <div className="mt-4 space-y-2">
        <BigButton variant="ink" size="lg" full onClick={onAgain}>
          다른 문제 더 풀어보기 <IconChevron size={20} />
        </BigButton>
        <BigButton variant="white" full onClick={onBack}>
          오늘의 퀴즈로 돌아가기
        </BigButton>
      </div>
      <p className="mt-2 text-[0.78rem] font-medium text-ink/40">
        전체 {QUIZ_TOTAL_COUNT}문제 중에서 새로 골라 드려요
      </p>
    </Card>
  );
}

function ResultAndCertificate({
  correct,
  total,
  points,
  show,
  onPractice,
}: {
  correct: number;
  total: number;
  points: number;
  show: (m: string) => void;
  onPractice: () => void;
}) {
  const { profile, today } = useApp();
  const { detail: groupDetail, inviteLink } = useGroup();
  const [certOpen, setCertOpen] = useState(false);
  /** 공유 미리보기 시트 — 상장 그대로 / 모임에 알리기 */
  const [share, setShare] = useState<null | "cert" | "group">(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const save = useCallback(() => {
    if (!canvasRef.current || !profile) return;
    downloadCanvas(canvasRef.current, `상장_${profile.nickname}_${today}.png`);
    show("상장을 저장했어요. 사진첩에서 확인해 보세요.");
  }, [profile, today, show]);

  const praise =
    correct === total ? "완벽해요! 오늘 기억력이 아주 좋아요" : correct > 0 ? "잘하셨어요! 내일도 함께해요" : "괜찮아요. 내일 다시 도전해요";

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
        {groupDetail ? (
          <div className="mt-2">
            <BigButton variant="sun" full onClick={() => setShare("group")}>
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[#FEE500] text-[0.58rem] font-black text-[#3C1E1E]">
                TALK
              </span>
              모임에 결과 알리기
            </BigButton>
          </div>
        ) : null}
        <p className="mt-2 text-[0.82rem] font-semibold leading-relaxed text-ink/50">
          내일 0시에 새로운 3문제가 열려요.
          <br />
          매주 월요일 0시에 순위가 새로 시작됩니다.
        </p>
      </Card>

      <Card className="fade-up border-2 border-brand/30 bg-white p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sky text-[1.3rem]">🧠</span>
          <div className="flex-1">
            <p className="text-[1.02rem] font-black leading-snug text-ink">다른 문제 더 풀어보기</p>
            <p className="mt-1 text-[0.85rem] font-semibold leading-relaxed text-ink/55">
              연습 모드로 새 3문제를 계속 풀 수 있어요. 점수·순위에는 들어가지 않아요.
            </p>
          </div>
        </div>
        <div className="mt-3">
          <BigButton variant="brand" size="lg" full onClick={onPractice}>
            연습 모드 시작하기 <IconChevron size={20} />
          </BigButton>
        </div>
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
          <BigButton variant="sun" onClick={() => setShare("cert")}>
            <IconShare size={22} /> 자랑하기
          </BigButton>
        </div>
      </Sheet>

      <SharePreviewSheet
        open={share !== null}
        onClose={() => setShare(null)}
        sourceCanvas={canvasRef}
        data={{
          kind: "quiz",
          badge: "오늘의 치매예방 퀴즈",
          emoji: correct === total ? "🏆" : "🧠",
          headline: `${profile?.nickname || "가족"} 님, ${total}문제 중 ${correct}문제 정답!`,
          sub: `오늘 ${points}점을 모았어요.`,
          message: groupDetail ? `${groupDetail.name}에서 함께 겨뤄요.` : undefined,
          stats: [
            { value: `${correct}/${total}`, label: "정답" },
            { value: `${points}점`, label: "획득" },
          ],
          name: profile?.nickname,
          dateLabel: koreanDate(today),
          title:
            share === "group"
              ? `${profile?.nickname || "가족"} 님의 오늘 치매예방 퀴즈 결과`
              : `${profile?.nickname || "가족"} 님의 치매예방 퀴즈 상장`,
          description:
            share === "group" && groupDetail
              ? `${total}문제 중 ${correct}문제 정답! ${groupDetail.name}에서 함께 겨뤄요.`
              : `정답 ${correct}문제 · ${points}점`,
          buttonTitle: share === "group" ? "모임에서 함께하기" : "나도 해보기",
          text: `오늘의 치매예방 퀴즈 ${correct}/${total}문제 정답! ${points}점 (늘봄)`,
          link:
            share === "group" && groupDetail
              ? inviteLink(groupDetail.id) || siteOrigin()
              : siteOrigin(),
          filename: `상장_${profile?.nickname || "늘봄"}_${today}.png`,
          sheetTitle: share === "group" ? "모임에 결과 알리기" : "퀴즈 상장 자랑하기",
          sheetSubtitle:
            share === "group"
              ? "가족 단톡방에 결과 카드를 보내요"
              : "단톡방에 상장이 이렇게 보여요",
        }}
      />
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
