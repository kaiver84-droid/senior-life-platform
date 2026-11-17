"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { speakKorean, stopSpeaking, ttsSupported } from "@/lib/tts";

/**
 * `🔊 소리로 듣기` 버튼 — 읽는 동안에는 `⏹ 멈추기` 로 바뀐다.
 *
 * - 이 기기에서 소리가 안 나오면 눌렀을 때 안내 문구를 보여 준다(아무 일도 안 일어나는
 *   버튼으로 두지 않는다).
 * - 화면을 닫거나 사라지면 읽던 소리를 멈춘다.
 */
export function SpeakButton({
  text,
  label = "소리로 듣기",
  stopLabel = "멈추기",
  tone = "sky",
  size = "md",
  full = false,
  dataName,
  hint,
}: {
  /** 읽어 줄 글 — 화면에 보이는 그대로 넣으면 된다 */
  text: string;
  label?: string;
  stopLabel?: string;
  tone?: "sky" | "white" | "sun";
  size?: "md" | "lg";
  full?: boolean;
  /** 검증·기록용 이름 (data-tts) */
  dataName?: string;
  /** 소리가 안 나올 때 보여 줄 한 줄 (없으면 기본 안내) */
  hint?: string;
}) {
  const [speaking, setSpeaking] = useState(false);
  const [notice, setNotice] = useState("");
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stopSpeaking();
    };
  }, []);

  // 다른 곳에서 새로 읽기 시작하면 이 버튼은 원래대로 돌아온다
  useEffect(() => {
    if (!speaking) return;
    const t = window.setInterval(() => {
      if (!window.speechSynthesis?.speaking) setSpeaking(false);
    }, 900);
    return () => window.clearInterval(t);
  }, [speaking]);

  const onClick = useCallback(() => {
    setNotice("");
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    if (!ttsSupported()) {
      setNotice(hint || "이 기기에서는 소리로 읽어 주지 못해요. 화면의 글씨를 봐 주세요.");
      return;
    }
    const started = speakKorean(text, {
      onStart: () => {
        if (alive.current) setSpeaking(true);
      },
      onEnd: () => {
        if (alive.current) setSpeaking(false);
      },
    });
    if (!started) {
      setNotice(hint || "이 기기에서는 소리로 읽어 주지 못해요. 화면의 글씨를 봐 주세요.");
      return;
    }
    setSpeaking(true);
  }, [speaking, text, hint]);

  const tones = {
    sky: speaking ? "bg-brand text-white shadow-soft" : "bg-brand-light text-brand-dark border-brand/20",
    white: speaking ? "bg-ink text-white shadow-soft" : "bg-white text-ink border-ink/12",
    sun: speaking ? "bg-sun-dark text-white" : "bg-sun text-ink border-sun-dark/20",
  } as const;

  return (
    <div className={full ? "w-full" : ""}>
      <button
        type="button"
        onClick={onClick}
        data-tts={dataName}
        data-tts-state={speaking ? "speaking" : "idle"}
        aria-pressed={speaking}
        aria-label={speaking ? `${label} 멈추기` : label}
        className={`flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 px-3 font-extrabold transition active:scale-[0.99] ${
          tones[tone]
        } ${size === "lg" ? "min-h-[58px] text-[1.05rem]" : "min-h-[52px] text-[0.98rem]"}`}
      >
        <span aria-hidden className="text-[1.15rem] leading-none">
          {speaking ? "⏹" : "🔊"}
        </span>
        <span className="leading-tight">{speaking ? stopLabel : label}</span>
      </button>
      <p
        aria-live="polite"
        className={`mt-1 text-center text-[0.78rem] font-bold leading-snug ${
          notice ? "text-coral-dark" : "text-ink/45"
        }`}
      >
        {notice || (speaking ? "읽고 있어요… 멈추려면 한 번 더 눌러 주세요." : "")}
      </p>
    </div>
  );
}
