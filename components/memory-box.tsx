"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/lib/storage";
import {
  MEMORY_BOX_IMAGE,
  MEMORY_BOX_IMAGE_PNG,
  markMemoryBoxSeen,
  memoryBoxSeenToday,
  memoryEraFor,
  memoryPhotoFor,
  playMemoryChime,
} from "@/lib/memory-box";
import { renderMemoryPhotoCard } from "@/lib/canvas";
import { siteOrigin } from "@/lib/og";
import { BigButton } from "./ui";
import { SharePreviewSheet } from "./share-sheet";

/**
 * 오늘의 추억상자 — 오늘 처음 접속했을 때 화면 가운데에 한 번 떠오른다.
 * 상자를 누르면 소리가 나고, 그 사람이 20~30대였던 시절의 추억 사진이 열린다.
 * 화면에는 이름·그림·한 줄 안내·닫기 하나만 둔다(중간 부연설명 없음).
 *
 * 지금은 숨김 — components/home.tsx 가 lib/flags.ts 의 ENABLE_MEMORY_BOX(false)로
 * 이 컴포넌트를 그리지 않는다. 이 파일·사진·localStorage 키는 그대로 둔 채
 * 플래그만 true 로 바꾸면 그대로 돌아온다(2026-11-27 "일단 숨겨놔 줘").
 */
export function MemoryBox() {
  const { profile, today } = useApp();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  /** box(상자) → opening(열리는 중) → photo(추억 사진) */
  const [stage, setStage] = useState<"box" | "opening" | "photo">("box");
  const timer = useRef<number | null>(null);
  /** 카톡 공유 시트 — 사진을 본 뒤 가족·친구에게 바로 보낼 수 있다 */
  const [shareOpen, setShareOpen] = useState(false);
  /** 공유 카드(사진 + 시대 + 한 줄)를 미리 그려 두는 캔버스 — 버튼을 누를 때 기다리지 않게 */
  const cardRef = useRef<HTMLCanvasElement | null>(null);

  const era = useMemo(() => memoryEraFor(profile?.birthYear), [profile?.birthYear]);
  const photo = useMemo(() => memoryPhotoFor(era, today), [era, today]);

  useEffect(() => setMounted(true), []);

  /** 닫기 — 열지 않고 닫아도 오늘은 다시 뜨지 않는다 */
  const close = useCallback(() => {
    markMemoryBoxSeen(today);
    if (timer.current) window.clearTimeout(timer.current);
    setOpen(false);
  }, [today]);

  /* 오늘 아직 안 열었으면 잠깐 뒤에 떠오른다 — 홈 화면이 먼저 보이게 */
  useEffect(() => {
    if (!profile) return;
    if (memoryBoxSeenToday(today)) return;
    const t = window.setTimeout(() => setOpen(true), 380);
    return () => window.clearTimeout(t);
  }, [profile, today]);

  /* 상자가 떠 있는 동안 뒤 화면이 함께 스크롤되지 않게 하고, Esc 로도 닫는다 */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  /* 사진이 열리면 카톡에 보낼 카드도 미리 그려 둔다(사진·시대·한 줄) */
  useEffect(() => {
    if (stage !== "photo" || typeof document === "undefined") return;
    const canvas = cardRef.current ?? document.createElement("canvas");
    cardRef.current = canvas;
    void renderMemoryPhotoCard(canvas, {
      src: photo.src,
      title: era.label,
      subtitle: "20~30대 시절의 추억",
      line: photo.line,
    })
      .catch(() => {});
  }, [stage, photo, era.label]);

  /** 상자를 누른 순간 — 소리는 반드시 이 클릭 핸들러 안에서 낸다(iOS 사파리) */
  const openBox = useCallback(() => {
    if (stage !== "box") return;
    markMemoryBoxSeen(today);
    playMemoryChime();
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      try {
        navigator.vibrate(18);
      } catch {
        /* 진동을 못 주는 기기는 그대로 */
      }
    }
    setStage("opening");
    timer.current = window.setTimeout(() => setStage("photo"), 360);
  }, [stage, today]);

  if (!mounted || !open || !profile) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="오늘의 추억상자"
      className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto px-4"
      style={{
        paddingTop: "max(28px, calc(env(safe-area-inset-top, 0px) + 16px))",
        paddingBottom: "max(28px, calc(env(safe-area-inset-bottom, 0px) + 16px))",
      }}
    >
      <button aria-label="닫기" onClick={close} className="fixed inset-0 bg-[#2A1806]/70 backdrop-blur-[3px]" />

      {stage === "photo" ? (
        /* 열린 뒤 — 시대 이름 · 사진 · 한 줄 · 닫기 하나 */
        <div
          data-memory-box-photo
          className="fade-up relative w-full max-w-[23rem] overflow-hidden rounded-[1.8rem] bg-[#FFFCF5] shadow-[0_26px_70px_-18px_rgba(45,24,0,0.75)]"
        >
          <div className="bg-gradient-to-b from-[#FFF1CE] to-[#FBE3B6] px-4 py-3">
            <p className="text-center text-[1.02rem] font-black leading-snug tracking-tight text-[#6B3F05]">
              <span className="block">{era.label}</span>
              <span className="block text-[0.86em] font-extrabold text-[#8A5A10]">20~30대 시절의 추억</span>
            </p>
          </div>

          <picture>
            <source srcSet={photo.src} type="image/webp" />
            <img
              src={photo.srcPng}
              alt={photo.alt}
              width={1536}
              height={1024}
              decoding="async"
              className="block aspect-[4/3] w-full object-cover"
            />
          </picture>

          <p className="px-5 pb-1 pt-3 text-center text-[1rem] font-bold leading-relaxed text-[#5A3A12]">
            “{photo.line}”
          </p>

          <div className="space-y-2 px-4 pb-4 pt-2.5">
            <BigButton
              variant="sun"
              full
              height={56}
              className="rounded-full !text-[1.02rem]"
              onClick={() => setShareOpen(true)}
            >
              <span aria-hidden className="text-[1.2rem] leading-none">
                💬
              </span>
              가족·친구에게 카톡으로 보내기
            </BigButton>
            <button
              type="button"
              data-memory-box-close
              onClick={close}
              className="min-h-[52px] w-full rounded-full bg-[#8A5A10] px-4 text-[1.05rem] font-black text-white shadow-soft active:bg-[#6B4308]"
            >
              닫기
            </button>
          </div>
        </div>
      ) : (
        /* 처음 — 이름 · 초고화질 선물 상자 · 짧은 안내 · 닫기 하나 */
        <div
          data-memory-box-card
          className={`relative w-full max-w-[21.5rem] rounded-[1.9rem] border border-[#F1DDB4] bg-[radial-gradient(120%_100%_at_50%_0%,#FFFBEC_0%,#FFF4DA_52%,#F8E6C0_100%)] px-3.5 pb-3.5 pt-3 shadow-[0_28px_70px_-18px_rgba(45,24,0,0.75)] ${
            stage === "opening" ? "memory-box-away" : "pop"
          }`}
        >
          <p className="text-center text-[1.3rem] font-black leading-tight tracking-tight text-[#6B3F05]">오늘의 추억상자</p>

          <button
            type="button"
            onClick={openBox}
            aria-label="오늘의 추억상자 열어보기"
            data-memory-box-open
            className="relative mt-1.5 block w-full rounded-[1.4rem] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8B44A]/70"
          >
            <span
              aria-hidden
              className="memory-box-glow pointer-events-none absolute left-1/2 top-1/2 h-[15rem] w-[15rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
            />
            <span aria-hidden className="memory-box-sparkle pointer-events-none absolute left-[8%] top-[14%] text-[1.1rem] text-[#F7C346]">
              ✦
            </span>
            <span
              aria-hidden
              className="memory-box-sparkle pointer-events-none absolute right-[10%] top-[6%] text-[0.85rem] text-[#F5B82E]"
              style={{ animationDelay: "1.1s" }}
            >
              ✦
            </span>
            <span
              aria-hidden
              className="memory-box-sparkle pointer-events-none absolute bottom-[18%] right-[4%] text-[1.25rem] text-[#FFD672]"
              style={{ animationDelay: "2.2s" }}
            >
              ✦
            </span>

            <picture>
              <source srcSet={MEMORY_BOX_IMAGE} type="image/webp" />
              <img
                src={MEMORY_BOX_IMAGE_PNG}
                alt="금빛 리본을 묶은 고급 선물 상자"
                width={1402}
                height={1122}
                decoding="async"
                className="memory-box-float relative block w-full rounded-[1.4rem] object-cover shadow-[0_16px_34px_-16px_rgba(120,70,0,0.6)] ring-1 ring-[#E8C98A]/70"
              />
            </picture>
          </button>

          <p className="mt-2 text-center text-[1.02rem] font-extrabold leading-snug text-[#8A5A10]">
            눌러서 열어보세요
          </p>

          <button
            type="button"
            onClick={close}
            data-memory-box-dismiss
            className="mt-2.5 min-h-[50px] w-full rounded-full bg-white/90 px-4 text-[1.04rem] font-extrabold text-[#8A5A10] shadow-soft active:bg-white"
          >
            닫기
          </button>
        </div>
      )}

      {/* 가족·친구에게 카톡으로 보내기 — 이미 있는 카카오 공유 시트를 그대로 쓴다(사진 카드를 피드 카드로) */}
      <SharePreviewSheet
        open={shareOpen}
        layer="top"
        onClose={() => setShareOpen(false)}
        sourceCanvas={cardRef}
        data={{
          kind: "memory",
          cardKind: "memory",
          badge: "오늘의 추억상자",
          emoji: "🎞️",
          headline: `${era.label}, 그 시절의 추억`,
          sub: photo.line,
          name: profile?.nickname,
          title: `${era.label}의 추억 사진이 도착했어요`,
          description: `${photo.line} — 늘봄 오늘의 추억상자`,
          buttonTitle: "나도 추억상자 열기",
          text: `오늘 열린 추억 사진이에요.\n“${photo.line}” (늘봄 오늘의 추억상자)`,
          link: `${siteOrigin()}/`,
          filename: `추억상자_${today}.png`,
          sheetTitle: "가족·친구에게 보내기",
          sheetSubtitle: "가족 단톡방에 추억 사진 카드가 이렇게 보여요",
        }}
      />
    </div>,
    document.body
  );
}
