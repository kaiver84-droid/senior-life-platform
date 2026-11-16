"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* ---------------------------------------------------------------- */
/* 버튼                                                              */
/* ---------------------------------------------------------------- */

type BtnProps = {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "brand" | "warm" | "leaf" | "ghost" | "white" | "gold";
  size?: "md" | "lg";
  full?: boolean;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
  ariaLabel?: string;
};

const VARIANTS: Record<string, string> = {
  brand: "bg-brand text-white border-2 border-brand-dark/30 shadow-[0_4px_0_#0E3B78]",
  warm: "bg-warm text-white border-2 border-[#A83509] shadow-[0_4px_0_#A83509]",
  leaf: "bg-leaf text-white border-2 border-[#145033] shadow-[0_4px_0_#145033]",
  gold: "bg-gold text-white border-2 border-[#8A5A0B] shadow-[0_4px_0_#8A5A0B]",
  white: "bg-white text-ink border-2 border-ink/15 shadow-[0_4px_0_rgba(20,33,58,0.12)]",
  ghost: "bg-transparent text-ink border-2 border-ink/20",
};

export function BigButton({
  children,
  onClick,
  variant = "brand",
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
      className={`touch-btn ${VARIANTS[variant]} ${size === "lg" ? "text-[1.15rem] min-h-[64px]" : ""} ${
        full ? "w-full" : ""
      } ${disabled ? "opacity-45 grayscale" : ""} ${className}`}
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
    <div className="mb-2 mt-1 flex items-end justify-between gap-2">
      <h2 className="section-title flex items-center gap-1.5">
        {emoji ? <span aria-hidden>{emoji}</span> : null}
        <span>{children}</span>
      </h2>
      {right}
    </div>
  );
}

export function Badge({
  children,
  tone = "brand",
}: {
  children: React.ReactNode;
  tone?: "brand" | "warm" | "leaf" | "gold" | "gray";
}) {
  const tones: Record<string, string> = {
    brand: "bg-brand-light text-brand-dark",
    warm: "bg-warm-light text-[#A83509]",
    leaf: "bg-leaf-light text-leaf",
    gold: "bg-gold-light text-[#8A5A0B]",
    gray: "bg-ink/8 text-ink/70",
  };
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.78rem] font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Divider({ className = "" }: { className?: string }) {
  return <div className={`my-3 h-[2px] w-full rounded bg-ink/8 ${className}`} />;
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
    timer.current = setTimeout(() => setMsg(null), 3200);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        className={`pointer-events-none fixed inset-x-0 bottom-[112px] z-[70] flex justify-center px-4 transition-opacity duration-200 ${
          msg ? "opacity-100" : "opacity-0"
        }`}
      >
        {msg ? (
          <div className="max-w-[420px] rounded-2xl bg-ink px-5 py-3 text-center text-[1rem] font-bold text-white shadow-lg">
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
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
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
      <button
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
      />
      <div className="fade-up relative w-full max-w-[460px] rounded-t-[1.6rem] border-t-2 border-ink/10 bg-paper p-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] shadow-2xl">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-ink/15" />
        {title ? <h3 className="mb-3 text-center text-[1.2rem] font-black">{title}</h3> : null}
        <div className="max-h-[70vh] overflow-y-auto no-scrollbar">{children}</div>
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
          className={`h-3 rounded-full transition-all ${
            i < current ? "w-8 bg-leaf" : i === current ? "w-8 bg-brand/40" : "w-3 bg-ink/15"
          }`}
        />
      ))}
    </div>
  );
}

export function Stars({ n }: { n: number }) {
  return (
    <span className="text-[1.05rem] tracking-tight" aria-label={`${n}점`}>
      {"★".repeat(n)}
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
