"use client";

import React, { useMemo, useState } from "react";
import { matchPrograms, WELFARE_CATEGORIES } from "@/lib/welfare";
import type { WelfareProgram } from "@/lib/types";
import { useApp } from "@/lib/storage";
import { REGIONS, sigunguList, shortSido } from "@/lib/regions";
import { shareText } from "@/lib/share";
import { Badge, BigButton, Card, SectionTitle, Sheet, useToast } from "./ui";
import { IconBank, IconBell, IconChevron, IconPhone, IconPin } from "./icons";

const CATEGORY_EMOJI: Record<string, string> = {
  연금: "💰",
  교통: "🚌",
  의료: "🏥",
  생활비: "🍚",
  돌봄: "🤝",
  주거: "🏠",
};

/* 도시 · 관공서 느낌의 하이라이트 배경 */
function CityScene({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <linearGradient id="ct-sky" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#CFE7F3" />
          <stop offset="0.65" stopColor="#EAF4FA" />
          <stop offset="1" stopColor="#FDFBF4" />
        </linearGradient>
        <linearGradient id="ct-glass" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#BFDCEA" />
          <stop offset="1" stopColor="#8FB9CE" />
        </linearGradient>
      </defs>
      <rect width="400" height="240" fill="url(#ct-sky)" />
      <circle cx="330" cy="46" r="30" fill="#FFE6A8" opacity="0.85" />
      <g opacity="0.9">
        <rect x="18" y="96" width="58" height="120" rx="6" fill="#DCE6EA" />
        <rect x="86" y="70" width="66" height="146" rx="6" fill="#CBD9DF" />
        <rect x="160" y="112" width="48" height="104" rx="6" fill="#E3EBEE" />
        <rect x="216" y="52" width="74" height="164" rx="8" fill="url(#ct-glass)" />
        <rect x="298" y="96" width="66" height="120" rx="6" fill="#D7E3E7" />
      </g>
      {[0, 1, 2, 3, 4].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <rect
            key={`w-${r}-${c}`}
            x={228 + c * 15}
            y={68 + r * 26}
            width="9"
            height="14"
            rx="2"
            fill="#FFFFFF"
            opacity={0.55}
          />
        ))
      )}
      {[0, 1, 2, 3].map((r) => (
        <rect key={`b-${r}`} x="100" y={84 + r * 28} width="38" height="12" rx="3" fill="#FFFFFF" opacity="0.5" />
      ))}
      <rect y="196" width="400" height="44" fill="#E7EEDF" />
      <g fill="#9CC08C">
        <circle cx="46" cy="192" r="16" />
        <circle cx="68" cy="196" r="12" />
        <circle cx="352" cy="190" r="18" />
        <circle cx="376" cy="196" r="12" />
      </g>
      <rect x="0" y="212" width="400" height="28" fill="#C9DCC0" />
    </svg>
  );
}

/** 긴 안내문에서 첫 문장만 (카드 요약용) */
function firstSentence(text: string): string {
  const i = text.indexOf(". ");
  return i > 10 ? text.slice(0, i + 1) : text;
}

export function WelfareTab({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { profile, updateProfile } = useApp();
  const { show } = useToast();
  const [category, setCategory] = useState<string>("전체");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const matched = useMemo(
    () => matchPrograms(profile?.birthYear || 1955, profile?.sido || "", profile?.sigungu || ""),
    [profile?.birthYear, profile?.sido, profile?.sigungu]
  );

  const age = profile ? new Date().getFullYear() - profile.birthYear : 0;
  const filtered = category === "전체" ? matched : matched.filter((p) => p.category === category);
  const hero = filtered.find((p) => p.id === "basic-pension") ?? filtered[0];
  const others = filtered.filter((p) => p.id !== hero?.id);
  const openProgram = matched.find((p) => p.id === openId) ?? null;

  const shareAnbu = async () => {
    const result = await shareText({
      title: "늘봄 안부 인사",
      text: `${profile?.nickname || "부모님"} 님의 오늘 안부예요. 늘봄에서 함께 챙겨요.`,
    });
    show(
      result === "failed"
        ? "공유를 열지 못했어요. 가족 화면에서 안부 카드를 보내 보세요."
        : "공유 창이 열렸어요. 카카오톡을 골라 주세요."
    );
  };

  return (
    <div className="space-y-4">
      <section className="fade-up flex items-start justify-between gap-2 pt-1">
        <div>
          <p className="text-[0.86rem] font-extrabold tracking-tight text-brand-dark/80">놓치면 아쉬운 혜택</p>
          <h1 className="mt-0.5 text-[1.5rem] font-black leading-tight text-ink">내게 맞는 복지 혜택</h1>
          <p className="mt-1 text-[0.88rem] font-semibold text-ink/55">
            {profile?.birthYear}년생({age}세) · {shortSido(profile?.sido || "")} {profile?.sigungu} 기준
          </p>
        </div>
        <button
          onClick={() => show("새로 생긴 지원금이 있으면 알려 드릴게요.")}
          aria-label="혜택 알림"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-ink/60 shadow-soft"
        >
          <IconBell size={22} />
        </button>
      </section>

      {/* 알약형 필터 */}
      <div className="fade-up flex gap-2">
        <button
          onClick={() => setEditOpen(true)}
          className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-3 text-[0.88rem] font-extrabold text-ink shadow-soft"
        >
          <span className="text-[0.95rem]">🎂</span> 만 {age}세 <IconChevron size={16} className="rotate-90 text-ink/35" />
        </button>
        <button
          onClick={() => setEditOpen(true)}
          className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-3 text-[0.88rem] font-extrabold text-ink shadow-soft"
        >
          <IconPin size={17} className="text-brand" /> {profile?.sigungu || "지역"} <IconChevron size={16} className="rotate-90 text-ink/35" />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {WELFARE_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={`min-h-[44px] rounded-full px-2 text-[0.84rem] font-extrabold transition ${
              category === c ? "bg-ink text-white" : "bg-white text-ink/60 shadow-soft"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {hero ? (
        <div className="fade-up overflow-hidden rounded-[1.7rem] bg-white shadow-card">
          <div className="relative">
            <CityScene className="absolute inset-0 h-full w-full" />
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/55 to-white" />
            <div className="relative px-4 pb-3 pt-6">
              <div className="flex items-center gap-1.5">
                <Badge tone="brand">{hero.category}</Badge>
                {hero.tags.includes("가장 먼저 챙기세요") ? <Badge tone="coral">먼저 챙기세요</Badge> : null}
              </div>
              <h2 className="mt-2 text-[1.5rem] font-black leading-tight text-ink">{hero.title}</h2>
              <p className="mt-0.5 text-[1.02rem] font-extrabold text-coral-dark">{hero.amount}</p>
              <p className="mt-1 line-clamp-2 text-[0.88rem] font-semibold leading-snug text-ink/60">
                {firstSentence(hero.summary)}
              </p>
            </div>
          </div>

          <div className="px-4 pb-4">
            <div className="rounded-[1.3rem] bg-[#FFF9EA] p-3.5">
              <p className="mb-2 text-[0.82rem] font-black text-[#96700B]">이렇게 신청해요</p>
              <ol className="space-y-1.5">
                {hero.steps.slice(0, 3).map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#F0B429] text-[0.7rem] font-black text-white">
                      {i + 1}
                    </span>
                    <p className="line-clamp-2 text-[0.88rem] font-semibold leading-snug text-ink/75">{s}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-3">
              <BigButton variant="ink" size="lg" full onClick={() => setOpenId(hero.id)}>
                신청 방법 자세히 보기 <IconChevron size={20} />
              </BigButton>
            </div>
          </div>
        </div>
      ) : (
        <Card>
          <p className="py-4 text-center text-[0.98rem] font-semibold text-ink/60">
            이 분류에는 찾은 지원이 없어요. 다른 분류를 눌러 보세요.
          </p>
        </Card>
      )}

      {/* 보조 혜택 */}
      <section>
        <SectionTitle
          right={<Badge tone="leaf">받을 수 있어요 {filtered.length}개</Badge>}
        >
          함께 챙길 혜택
        </SectionTitle>
        <div className="space-y-2">
          {others.map((p) => (
            <button
              key={p.id}
              onClick={() => setOpenId(p.id)}
              className="card flex w-full items-center gap-3 p-3.5 text-left active:scale-[0.99]"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[0.9rem] bg-sky text-[1.2rem]">
                {CATEGORY_EMOJI[p.category] || "🎁"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.98rem] font-black leading-snug text-ink">{p.title}</span>
                <span className="block truncate text-[0.84rem] font-extrabold text-coral-dark">{p.amount}</span>
              </span>
              <IconChevron size={20} className="shrink-0 text-ink/25" />
            </button>
          ))}
          {others.length === 0 ? (
            <p className="rounded-2xl bg-white/70 px-4 py-3 text-center text-[0.86rem] font-semibold text-ink/50">
              다른 분류를 눌러 더 많은 혜택을 확인해 보세요.
            </p>
          ) : null}
        </div>
      </section>

      {/* 카톡 안부 전송 */}
      <div className="fade-up overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-[#EAF7EC] via-[#F3FBF4] to-[#FFF7E6] p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#FEE500] text-[0.62rem] font-black text-[#3C1E1E]">
            TALK
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[1rem] font-black leading-snug text-ink">가족에게 안부 보내기</p>
            <p className="text-[0.84rem] font-semibold text-ink/55">오늘도 잘 지내고 있다고 전해 보세요.</p>
          </div>
        </div>
        <div className="mt-3">
          <BigButton variant="sun" full onClick={shareAnbu}>
            카카오톡으로 안부 전송
          </BigButton>
        </div>
      </div>

      <p className="rounded-2xl bg-white/70 px-4 py-3 text-center text-[0.8rem] font-semibold leading-relaxed text-ink/50">
        2026년 기준으로 정리한 안내예요. 지자체 예산과 기준은 달라질 수 있으니,
        <br />
        신청 전에 주민센터(129)로 한 번 더 확인하시면 확실해요.
      </p>

      {/* 지원금 상세 */}
      <Sheet
        open={!!openProgram}
        onClose={() => setOpenId(null)}
        title={openProgram?.title}
        subtitle={openProgram ? `${openProgram.org} · ${openProgram.amount}` : undefined}
      >
        {openProgram ? (
          <ProgramDetail
            program={openProgram}
            onClose={() => setOpenId(null)}
            onFamily={() => {
              setOpenId(null);
              onNavigate?.("family");
            }}
          />
        ) : null}
      </Sheet>

      {/* 나이 · 지역 변경 */}
      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title="나이 · 지역 바꾸기">
        <ProfileEditor
          initial={{
            birthYear: profile?.birthYear || 1952,
            sido: profile?.sido || "",
            sigungu: profile?.sigungu || "",
          }}
          onSave={(v) => {
            updateProfile(v);
            setEditOpen(false);
            show("내 조건을 바꿨어요. 지원금을 다시 찾았습니다.");
          }}
        />
      </Sheet>
    </div>
  );
}

function ProgramDetail({
  program,
  onClose,
  onFamily,
}: {
  program: WelfareProgram;
  onClose: () => void;
  onFamily: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-[1.5rem] bg-white p-5 shadow-soft">
        <div className="flex items-center gap-1.5">
          <Badge tone="brand">{program.category}</Badge>
          {program.tags.slice(0, 2).map((t) => (
            <Badge key={t} tone="gray">
              {t}
            </Badge>
          ))}
        </div>
        <p className="mt-2 text-[1.15rem] font-black text-coral-dark">{program.amount}</p>
        <p className="mt-1 text-[0.95rem] font-semibold leading-relaxed text-ink/70">{firstSentence(program.summary)}</p>

        <div className="mt-3 rounded-2xl bg-[#FFF9EA] p-3.5">
          <p className="mb-2 text-[0.82rem] font-black text-[#96700B]">이렇게 하세요 (3단계)</p>
          <ol className="space-y-2">
            {program.steps.map((s, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#F0B429] text-[0.75rem] font-black text-white">
                  {i + 1}
                </span>
                <p className="text-[0.94rem] font-semibold leading-snug text-ink/80">{s}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-3 rounded-2xl bg-paper p-3.5">
          <p className="text-[0.82rem] font-black text-ink/50">챙길 것</p>
          <p className="mt-0.5 text-[0.95rem] font-semibold">{program.documents.join(" · ")}</p>
          <p className="mt-2 text-[0.82rem] font-black text-ink/50">문의</p>
          <p className="text-[0.95rem] font-semibold">
            {program.org}
            {program.phone ? ` · ${program.phone}` : ""}
          </p>
          {program.deadline ? (
            <p className="mt-1 text-[0.88rem] font-bold text-coral-dark">⏰ {program.deadline}</p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {program.phone ? (
          <a
            href={`tel:${program.phone}`}
            className="touch-btn border-2 border-ink/10 bg-white text-[0.96rem] font-extrabold text-ink shadow-soft"
          >
            <IconPhone size={20} /> 전화하기
          </a>
        ) : (
          <a
            href="tel:129"
            className="touch-btn border-2 border-ink/10 bg-white text-[0.96rem] font-extrabold text-ink shadow-soft"
          >
            <IconPhone size={20} /> 129 안내
          </a>
        )}
        <a
          href={program.url}
          target="_blank"
          rel="noreferrer"
          className="touch-btn bg-ink text-[0.96rem] font-extrabold text-white shadow-cta"
        >
          <IconBank size={20} /> 신청 페이지
        </a>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <BigButton variant="white" onClick={onClose}>
          닫기
        </BigButton>
        <BigButton variant="teal" onClick={onFamily}>
          가족과 상의
        </BigButton>
      </div>
    </div>
  );
}

function ProfileEditor({
  initial,
  onSave,
}: {
  initial: { birthYear: number; sido: string; sigungu: string };
  onSave: (v: { birthYear: number; sido: string; sigungu: string }) => void;
}) {
  const [birthYear, setBirthYear] = useState(initial.birthYear);
  const [sido, setSido] = useState(initial.sido || REGIONS[0].name);
  const [sigungu, setSigungu] = useState(initial.sigungu || sigunguList(initial.sido || REGIONS[0].name)[0]);

  const options = sigunguList(sido);
  const years = Array.from({ length: 44 }, (_, i) => 1930 + i);

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="e-birth" className="mb-1 block text-[0.95rem] font-extrabold">
          태어난 해
        </label>
        <select id="e-birth" className="field" value={birthYear} onChange={(e) => setBirthYear(Number(e.target.value))}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}년 ({2026 - y}세)
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="e-sido" className="mb-1 block text-[0.95rem] font-extrabold">
          시·도
        </label>
        <select
          id="e-sido"
          className="field"
          value={sido}
          onChange={(e) => {
            setSido(e.target.value);
            setSigungu(sigunguList(e.target.value)[0]);
          }}
        >
          {REGIONS.map((r) => (
            <option key={r.name} value={r.name}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="e-sigungu" className="mb-1 block text-[0.95rem] font-extrabold">
          시·군·구
        </label>
        <select id="e-sigungu" className="field" value={sigungu} onChange={(e) => setSigungu(e.target.value)}>
          {options.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <BigButton variant="ink" full onClick={() => onSave({ birthYear, sido, sigungu })}>
        저장하기
      </BigButton>
    </div>
  );
}
