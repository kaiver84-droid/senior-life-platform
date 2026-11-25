import React from "react";
import Link from "next/link";

/**
 * 검색 유입용 안내 페이지(/guide/) 공용 조각.
 * 앱 화면과 달리 로그인 전에 열리는 공개 페이지라, 상태·훅이 없는 서버 컴포넌트로만 만든다.
 * (시니어 기준: 본문 19px 이상 · 고대비 · 56px 이상 버튼 · 말줄임 없는 줄바꿈)
 */

export function GuideFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[600px] bg-paper px-4 pb-12 pt-safe shadow-[0_0_70px_-24px_rgba(23,59,94,0.42)]">
      {/* 앱에서 고른 글씨 크기(보통·크게·아주 크게)를 공개 안내 페이지에서도 그대로 쓴다 */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "try{var v=JSON.parse(localStorage.getItem('seniorLife.v1')||'{}');var s=v.fontSize;if(s===18||s===21||s===24){document.documentElement.style.setProperty('--app-font',(s+1)+'px');}}catch(e){}",
        }}
      />
      {children}
    </main>
  );
}

export function GuideHeader() {
  return (
    <header className="flex min-h-[64px] items-center justify-between gap-3">
      <Link href="/" className="flex items-center gap-2" aria-label="늘봄 홈으로">
        <span
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-[0.9rem] bg-brand text-[1.02rem] font-black text-white"
        >
          봄
        </span>
        <span className="text-[1.3rem] font-black leading-none tracking-[-0.05em] text-ink">늘봄</span>
      </Link>
      <Link
        href="/"
        className="flex min-h-[44px] items-center rounded-full border-2 border-brand/25 bg-brand-light px-3 text-[0.92rem] font-extrabold text-brand-dark"
      >
        늘봄 열기
      </Link>
    </header>
  );
}

export function Breadcrumb({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="현재 위치" className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.86rem] font-semibold text-ink/60">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden>›</span>}
          {item.href ? (
            <Link href={item.href} className="underline decoration-ink/25 underline-offset-2">
              {item.label}
            </Link>
          ) : (
            <span className="text-ink/75">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/** 페이지 맨 위 요약 배지 (카테고리·마감) */
export function Pill({
  children,
  tone = "brand",
}: {
  children: React.ReactNode;
  tone?: "brand" | "sun" | "coral" | "leaf";
}) {
  const tones = {
    brand: "border-brand/30 bg-brand-light text-brand-dark",
    sun: "border-sun-dark/30 bg-sun-light text-[#8a5b00]",
    coral: "border-coral/35 bg-coral-light text-coral-dark",
    leaf: "border-leaf/30 bg-leaf-light text-leaf-dark",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border-2 px-3 py-1 text-[0.9rem] font-extrabold ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** 금액·대상·마감처럼 먼저 봐야 하는 한 줄 정보 */
export function FactRow({
  label,
  value,
  emoji,
}: {
  label: string;
  value: string;
  emoji: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-ink/10 py-3 last:border-b-0">
      <span aria-hidden className="text-[1.25rem] leading-none">
        {emoji}
      </span>
      <div className="min-w-0">
        <p className="text-[0.88rem] font-bold text-ink/60">{label}</p>
        <p className="mt-0.5 text-[1.1rem] font-extrabold leading-snug text-ink">{value}</p>
      </div>
    </div>
  );
}

export function Section({
  title,
  emoji,
  children,
}: {
  title: string;
  emoji?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="flex items-center gap-2 text-[1.16rem] font-extrabold leading-snug tracking-[-0.02em] text-ink">
        {emoji && <span aria-hidden>{emoji}</span>}
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/** 번호 붙은 신청 순서 */
export function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3 rounded-2xl bg-white p-3 shadow-soft">
          <span
            aria-hidden
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-[1rem] font-black text-white"
          >
            {i + 1}
          </span>
          <p className="min-w-0 text-[1.02rem] font-semibold leading-relaxed text-[#22384f]">{step}</p>
        </li>
      ))}
    </ol>
  );
}

export function ChipList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-full border-2 border-ink/12 bg-white px-3 py-1.5 text-[0.95rem] font-bold text-ink"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

/** 검색 유입 방문자를 앱으로 보내는 버튼 — 위아래 같은 모양으로 둔다 */
export function GuideCta({ note = "내 나이에 맞는 혜택만 골라서 보여 드려요" }: { note?: string }) {
  return (
    <div className="mt-6 rounded-xl3 bg-ink px-4 pb-4 pt-5 text-center shadow-lift">
      <p className="text-[1.02rem] font-bold leading-snug text-white/90">{note}</p>
      <Link href="/" className="touch-btn mt-3 w-full bg-sun text-ink shadow-sun">
        늘봄에서 무료로 이용하기 →
      </Link>
      <p className="mt-2 text-[0.9rem] font-semibold text-white/75">
        카카오톡으로 한 번만 로그인하면 바로 쓸 수 있어요
      </p>
    </div>
  );
}

export function GuideFooter() {
  return (
    <footer className="mt-8 border-t-2 border-ink/10 pt-4 text-[0.9rem] font-medium leading-relaxed text-ink/65">
      <nav className="flex flex-wrap gap-x-4 gap-y-2 text-[0.95rem] font-bold text-ink/80">
        <Link href="/guide/" className="underline underline-offset-2">
          혜택 17가지
        </Link>
        <Link href="/guide/quiz/" className="underline underline-offset-2">
          치매예방 퀴즈
        </Link>
        <Link href="/privacy/" className="underline underline-offset-2">
          개인정보처리방침
        </Link>
        <Link href="/" className="underline underline-offset-2">
          늘봄 홈
        </Link>
      </nav>
      <p className="mt-3 font-extrabold text-ink/75">늘봄 — 언제나, 늘 곁에 있는 시니어 생활 플랫폼</p>
      <p className="mt-1">
        금액·기준은 정부24·복지로·보건복지부 고시(2026년) 기준이에요. 지자체 사업은 지역마다 다르니 신청 전에
        주민센터나 보건복지상담센터(129)에 한 번 더 확인하세요.
      </p>
    </footer>
  );
}
