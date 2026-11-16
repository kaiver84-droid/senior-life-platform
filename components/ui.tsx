"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
}: BtnProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
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

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card p-5 ${className}`}>{children}</div>;
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
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
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
      <div className="fixed inset-0 z-[80] flex items-end justify-center">
        <button aria-label="닫기" onClick={onClose} className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" />
        <div className="fade-up relative w-full max-w-[460px] rounded-t-[2rem] bg-paper px-5 pb-[calc(env(safe-area-inset-bottom,0px)+22px)] pt-3 shadow-2xl">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-ink/15" />
          {title ? (
            <div className="mb-3 text-center">
              <h3 className="text-[1.2rem] font-black leading-snug">{title}</h3>
              {subtitle ? <p className="mt-1 text-[0.88rem] font-semibold text-ink/55">{subtitle}</p> : null}
            </div>
          ) : null}
          <div className="max-h-[74vh] overflow-y-auto no-scrollbar">{children}</div>
          {footer ? <div className="mt-4">{footer}</div> : null}
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
