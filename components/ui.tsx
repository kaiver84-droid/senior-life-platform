"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconClose } from "./icons";
import { normalizeAvatarUrl } from "@/lib/avatar";

/* ---------------------------------------------------------------- */
/* 버튼                                                              */
/* ---------------------------------------------------------------- */

type BtnVariant = "ink" | "teal" | "sun" | "coral" | "leaf" | "gold" | "white" | "ghost" | "brand";

type BtnProps = {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  size?: "md" | "lg";
  full?: boolean;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
  ariaLabel?: string;
  /** 터치 높이를 꼭 지정해야 할 때(px) — .touch-btn 기본값(56px)보다 우선한다 */
  height?: number;
};

const VARIANTS: Record<BtnVariant, string> = {
  ink: "bg-ink text-white shadow-cta active:bg-[#0F2C48]",
  brand: "bg-ink text-white shadow-cta active:bg-[#0F2C48]",
  teal: "bg-brand text-white shadow-soft active:bg-brand-dark",
  sun: "bg-sun text-ink shadow-sun active:bg-sun-dark",
  gold: "bg-gold text-ink shadow-sun active:bg-gold-dark",
  coral: "bg-coral text-white shadow-soft active:bg-coral-dark",
  leaf: "bg-leaf text-white shadow-soft active:bg-leaf-dark",
  white: "bg-white text-ink border-2 border-ink/10 shadow-soft active:bg-paper",
  ghost: "bg-transparent text-ink/70 border-2 border-ink/12",
};

export function BigButton({
  children,
  onClick,
  variant = "ink",
  size = "md",
  full,
  disabled,
  className = "",
  type = "button",
  ariaLabel,
  height,
}: BtnProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={height ? { minHeight: `${height}px` } : undefined}
      className={`touch-btn ${VARIANTS[variant]} ${
        size === "lg" ? "min-h-[64px] text-[1.12rem]" : ""
      } ${full ? "w-full" : ""} ${disabled ? "opacity-40 grayscale" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- */
/* 카드 · 배지                                                        */
/* ---------------------------------------------------------------- */

export function Card({
  children,
  className = "",
  ...rest
}: { children: React.ReactNode; className?: string } & Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "className">) {
  return (
    <div className={`card p-5 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({
  emoji,
  children,
  right,
}: {
  emoji?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-2.5 mt-1 flex items-end justify-between gap-2">
      <h2 className="section-title flex items-center gap-1.5 text-ink">
        {emoji ? <span aria-hidden>{emoji}</span> : null}
        <span>{children}</span>
      </h2>
      {right}
    </div>
  );
}

type Tone = "brand" | "sun" | "coral" | "leaf" | "gold" | "gray" | "plum" | "ink";

export function Badge({ children, tone = "brand" }: { children: React.ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    brand: "bg-brand-light text-brand-dark",
    sun: "bg-sun-light text-[#9A6A05]",
    coral: "bg-coral-light text-coral-dark",
    leaf: "bg-leaf-light text-leaf-dark",
    gold: "bg-gold-light text-[#8A6100]",
    gray: "bg-ink/6 text-ink/60",
    plum: "bg-plum-light text-plum-dark",
    ink: "bg-ink text-white",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.75rem] font-extrabold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Divider({ className = "" }: { className?: string }) {
  return <div className={`my-3.5 h-[1px] w-full bg-ink/8 ${className}`} />;
}

/* ---------------------------------------------------------------- */
/* 프로필 사진 (카톡 사진 · 없으면 이름 첫 글자)                       */
/* ---------------------------------------------------------------- */

/**
 * 원형 프로필 사진.
 * - `src`(카카오톡 프로필 사진)가 있으면 원형 사진으로 보여 준다.
 * - 사진이 없거나 불러오지 못하면 이름 첫 글자 원으로 안전하게 돌아간다.
 */
export function Avatar({
  name,
  src,
  size = 44,
  background = "bg-brand",
  ring,
  className = "",
  alt,
}: {
  name?: string;
  src?: string | null;
  size?: number;
  /** 사진을 못 불러왔을 때(그리고 사진이 없을 때) 원의 배경색 */
  background?: string;
  /** 테두리 강조 — 예: "ring-4 ring-gold/60" */
  ring?: string;
  className?: string;
  alt?: string;
}) {
  const url = normalizeAvatarUrl(src);
  const [failed, setFailed] = useState(false);
  // 사진 주소가 바뀌면(다시 로그인 등) 실패 표시를 초기화한다.
  useEffect(() => {
    setFailed(false);
  }, [url]);

  const initial = (name || "?").trim().slice(0, 1) || "?";
  const box = { width: size, height: size };
  const shape = `shrink-0 rounded-full ${ring ?? ""} ${className}`;

  if (url && !failed) {
    return (
      <span
        data-avatar="photo"
        className={`relative inline-block overflow-hidden ${background} ${shape}`}
        style={box}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={alt || (name ? `${name} 프로필 사진` : "프로필 사진")}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  return (
    <span
      data-avatar="initial"
      className={`inline-grid place-items-center font-black leading-none ${background} ${shape}`}
      style={{ ...box, fontSize: Math.max(11, Math.round(size * 0.42)) }}
      aria-label={name ? `${name} 프로필 사진 없음` : undefined}
    >
      {initial}
    </span>
  );
}

/** 화면 위에 겹쳐 띄우는 알약형 탭 */
export function PillTabs<T extends string>({
  tabs,
  value,
  onChange,
  className = "",
}: {
  tabs: { key: T; label: string; emoji?: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`flex gap-2 rounded-full bg-white p-1.5 shadow-soft ${className}`} role="tablist">
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={`min-h-[46px] flex-1 whitespace-nowrap rounded-full text-[0.86rem] font-extrabold transition ${
              active ? "bg-ink text-white shadow-soft" : "text-ink/55 active:bg-ink/5"
            }`}
          >
            {t.emoji ? <span aria-hidden className="mr-1">{t.emoji}</span> : null}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** 큰 아이콘 타일 (바로가기 · 목록) */
export function IconTile({
  children,
  bg = "bg-brand-light",
  className = "",
}: {
  children: React.ReactNode;
  bg?: string;
  className?: string;
}) {
  return (
    <span
      className={`grid h-12 w-12 shrink-0 place-items-center rounded-[1rem] ${bg} ${className}`}
      aria-hidden
    >
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- */
/* 포털 (화면 전체 덮개용)                                            */
/* ---------------------------------------------------------------- */

export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

/* ---------------------------------------------------------------- */
/* 토스트                                                             */
/* ---------------------------------------------------------------- */

type ToastCtx = { show: (msg: string) => void };
const ToastContext = createContext<ToastCtx>({ show: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3400);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        className={`pointer-events-none fixed inset-x-0 bottom-[124px] z-[70] flex justify-center px-4 transition-opacity duration-200 ${
          msg ? "opacity-100" : "opacity-0"
        }`}
      >
        {msg ? (
          <div className="max-w-[420px] rounded-2xl bg-ink px-5 py-3 text-center text-[0.98rem] font-bold leading-snug text-white shadow-lift">
            {msg}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/* ---------------------------------------------------------------- */
/* 하단 시트(모달)                                                    */
/* ---------------------------------------------------------------- */

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  hideBottomClose,
  hideTopClose,
  layer = "default",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** 시트 안에 이미 큰 닫기 버튼이 있으면(공유 시트 등) 아래 고정 닫기를 겹쳐 그리지 않는다 */
  hideBottomClose?: boolean;
  /** 닫기 버튼을 아래 고정 버튼 하나로만 두고 상단 ‘✕ 닫기’는 감춘다(버튼이 세 번 보이지 않게) */
  hideTopClose?: boolean;
  /** ‘top’ — 화면 맨 위(z-96)에 올린다. 추억상자(z-90)처럼 이미 떠 있는 화면에서 시트를 열 때 */
  layer?: "default" | "top";
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <Portal>
      {/* 아이폰 상태바·노치 아래로는 절대 올라가지 않게 위쪽 여백을 강제로 비운다
          (여백 = 최소 64px, 세이프에어리어가 더 크면 그만큼 더) */}
      <div
        className={`fixed inset-0 ${layer === "top" ? "z-[96]" : "z-[80]"} flex items-end justify-center`}
        style={{ paddingTop: "max(64px, calc(env(safe-area-inset-top, 0px) + 20px))" }}
      >
        <button aria-label="닫기" onClick={onClose} className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" />
        <div className="fade-up relative flex max-h-full w-full max-w-[460px] flex-col overflow-hidden rounded-t-[28px] bg-paper shadow-2xl">
          {/* 고정 헤더 — 스크롤해도 제목과 ‘✕ 닫기’가 늘 같은 자리에 있다 */}
          <div className="shrink-0 rounded-t-[28px] border-b border-ink/8 bg-white px-4 pb-2.5 pt-2">
            <div aria-hidden className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-ink/15" />
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                {title ? (
                  <h3 className="truncate text-[1.16rem] font-black leading-tight text-ink">{title}</h3>
                ) : null}
                {subtitle ? (
                  <p className="mt-0.5 truncate text-[0.84rem] font-semibold text-ink/55">{subtitle}</p>
                ) : null}
              </div>
              {hideTopClose ? null : (
                <button
                  type="button"
                  data-sheet-close
                  onClick={onClose}
                  aria-label="닫기"
                  className="flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center gap-1.5 rounded-full bg-ink px-4 text-[1rem] font-extrabold text-white shadow-soft active:bg-[#0F2C48]"
                >
                  <IconClose size={20} />
                  닫기
                </button>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-5 pb-4 pt-3.5">{children}</div>

          {/* 고정 하단 — 위를 보든 아래를 보든 큰 ‘닫기’가 늘 보인다 */}
          {footer || !hideBottomClose ? (
            <div
              className="shrink-0 border-t border-ink/8 bg-white/95 px-4 pt-2.5"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
            >
              {footer}
              {hideBottomClose ? null : (
                <div className={footer ? "mt-2" : ""}>
                  <BigButton variant="white" full height={54} onClick={onClose}>
                    <IconClose size={20} /> 닫기
                  </BigButton>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </Portal>
  );
}

/* ---------------------------------------------------------------- */
/* 기타                                                              */
/* ---------------------------------------------------------------- */

export function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center justify-center gap-2" aria-label={`${current} / ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-2.5 rounded-full transition-all ${
            i < current ? "w-7 bg-brand" : i === current ? "w-7 bg-brand/40" : "w-2.5 bg-ink/15"
          }`}
        />
      ))}
    </div>
  );
}

export function Stars({ n }: { n: number }) {
  return (
    <span className="text-[1.05rem] tracking-tight" aria-label={`${n}점`}>
      <span className="text-sun">{"★".repeat(n)}</span>
      <span className="text-ink/20">{"★".repeat(5 - n)}</span>
    </span>
  );
}

export function Skeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-6 w-2/3 rounded bg-ink/10" />
      <div className="h-24 rounded-2xl bg-ink/8" />
      <div className="h-24 rounded-2xl bg-ink/8" />
    </div>
  );
}
