"use client";

import React, { useMemo, useState } from "react";
import { matchPrograms, WELFARE_CATEGORIES } from "@/lib/welfare";
import type { WelfareProgram } from "@/lib/types";
import { useApp } from "@/lib/storage";
import { REGIONS, sigunguList, shortSido } from "@/lib/regions";
import { shareText } from "@/lib/share";
import { Badge, BigButton, Card, SectionTitle, Sheet, useToast } from "./ui";
import { SpeakButton } from "./speak";
import { IconBank, IconBell, IconChevron, IconPhone, IconPin, IconSend } from "./icons";
import { AssetImage } from "./art";
import { BIRTH_YEARS } from "./profile-fields";
import { AdFitBanner } from "./adfit-banner";

const CATEGORY_EMOJI: Record<string, string> = {
  전체: "🗂️",
  연금: "💰",
  교통: "🚌",
  의료: "🏥",
  생활비: "🍚",
  돌봄: "🤝",
  주거: "🏠",
  일자리: "💼",
};

/* 긴 안내문에서 첫 문장만 (카드 요약용) */
function firstSentence(text: string): string {
  const i = text.indexOf(". ");
  return i > 10 ? text.slice(0, i + 1) : text;
}

const STEP_ORDER = ["첫째", "둘째", "셋째", "넷째", "다섯째"];

/** 신청 방법을 소리로 읽어 줄 글 — 화면에 보이는 순서 그대로 */
function stepsSpeech(program: WelfareProgram, limit?: number): string {
  const steps = (limit ? program.steps.slice(0, limit) : program.steps)
    .map((s, i) => `${STEP_ORDER[i] || `${i + 1}번째`}, ${s}`)
    .join(". ");
  const docs = program.documents.length ? ` 챙길 것은 ${program.documents.join(", ")}입니다.` : "";
  const phone = program.phone ? ` 전화번호는 ${program.phone}입니다.` : "";
  return `${program.title}. ${program.amount}. 신청 방법을 알려 드릴게요. ${steps}.${docs} 문의는 ${program.org}입니다.${phone}`;
}

export function WelfareTab({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { profile, updateProfile, recordMission } = useApp();
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
  // 65세 이상은 기초연금을, 40·50대는 직업훈련·건강검진, 10~30대는 지금 나이에 맞는 복지를 먼저 보여 준다.
  const heroId = age >= 65 ? "basic-pension" : age >= 18 ? "training-card" : "bokjiro-search";
  const hero = filtered.find((p) => p.id === heroId) ?? filtered[0];
  const others = filtered.filter((p) => p.id !== hero?.id);
  const openProgram = matched.find((p) => p.id === openId) ?? null;

  /** 혜택을 자세히 열어 보면 ‘복지·생활정보 확인’ 미션이 자동으로 기록된다(늘봄왕 +10점) */
  const openDetail = (id: string) => {
    setOpenId(id);
    recordMission("welfare");
  };

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

      {/* 분류 — 옆으로 잘리지 않고 화면 안에 꼭 차는 2열 큰 버튼 */}
      <div className="grid grid-cols-2 gap-2" data-welfare-filters>
        {WELFARE_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={`flex min-h-[56px] items-center justify-center gap-1.5 rounded-2xl border-2 px-2 text-[1rem] font-extrabold transition ${
              category === c
                ? "border-ink bg-ink text-white shadow-soft"
                : "border-ink/8 bg-white text-ink/70 shadow-soft active:bg-paper"
            }`}
          >
            <span aria-hidden className="text-[1.1rem] leading-none">
              {CATEGORY_EMOJI[c] || "🎁"}
            </span>
            {c}
          </button>
        ))}
      </div>

      {age > 0 && age < 60 ? (
        <p className="fade-up rounded-2xl bg-leaf-light px-3.5 py-2.5 text-[0.84rem] font-semibold leading-snug text-leaf-dark">
          {age >= 40
            ? "40·50대는 직업훈련·건강검진처럼 지금부터 챙길 수 있는 혜택을 먼저 보여 드려요. 예순이 되면 연금·돌봄 혜택도 함께 열려요."
            : "지금 나이에 맞는 혜택을 먼저 보여 드려요. 예순이 되면 연금·돌봄 혜택도 함께 열려요."}
        </p>
      ) : null}

      {hero ? (
        <div className="fade-up overflow-hidden rounded-[1.7rem] bg-white shadow-card">
          <div className="relative h-[212px] overflow-hidden bg-[#D7E9F5]">
            <AssetImage
              name="welfare-pension-bg"
              alt="맑은 하늘 아래 숲과 어우러진 밝은 공공기관 건물"
              priority
              className="absolute inset-0 h-full w-full object-cover object-[58%_center]"
            />
            {/* 글자 자리(아래쪽)에만 흰색을 올린다 — 사진 위쪽은 원본 그대로 보이게 */}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[64%]"
              style={{
                background:
                  "linear-gradient(to top, #FFFFFF 0%, rgba(255,255,255,0.96) 32%, rgba(255,255,255,0.62) 64%, rgba(255,255,255,0))",
              }}
            />
            <div className="relative flex h-full flex-col justify-end px-4 pb-3">
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
              <div className="mb-2">
                <p className="text-[0.86rem] font-black text-[#96700B]">이렇게 신청해요</p>
              </div>
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
              <div className="mt-2.5">
                <SpeakButton
                  text={stepsSpeech(hero, 3)}
                  label="신청 방법 소리로 듣기"
                  dataName="welfare-hero"
                  tone="white"
                />
              </div>
            </div>

            <div className="mt-3">
              <BigButton variant="ink" size="lg" full onClick={() => openDetail(hero.id)}>
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
              onClick={() => openDetail(p.id)}
              className="card flex w-full items-center gap-3 p-3.5 text-left active:scale-[0.99]"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[0.9rem] bg-sky text-[1.2rem]">
                {CATEGORY_EMOJI[p.category] || "🎁"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-keep text-[min(0.98rem,22px)] font-black leading-snug text-ink">{p.title}</span>
                <span className="mt-0.5 block break-keep text-[min(0.84rem,20px)] font-extrabold leading-snug text-coral-dark">{p.amount}</span>
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

      {/* 가족에게 안부 전송 */}
      <div className="fade-up overflow-hidden rounded-[1.6rem] bg-white p-3 shadow-card">
        <div className="flex items-center gap-3">
          <div className="relative h-[98px] w-[116px] shrink-0 overflow-hidden rounded-[1.15rem] bg-[#F3EEE2] shadow-soft">
            <AssetImage
              name="family-greeting-couple"
              alt="거실에서 휴대폰으로 가족에게 안부를 전하는 어르신 부부"
              className="h-full w-full object-cover object-[center_32%]"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[1.04rem] font-black leading-snug text-ink">가족에게 안부 보내기</p>
            <p className="mt-0.5 text-[0.85rem] font-semibold leading-snug text-ink/55">
              사랑하는 가족에게 오늘도 안부를 전하세요.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={shareAnbu}
          className="touch-btn mt-3 min-h-[56px] w-full bg-[#0FBF7F] text-white shadow-[0_8px_18px_-9px_rgba(15,191,127,0.9)] active:bg-[#0CA96F]"
        >
          <IconSend size={20} /> 카카오톡으로 안부 전송
        </button>
      </div>

      <p className="rounded-2xl bg-white/70 px-4 py-3 text-center text-[0.8rem] font-semibold leading-relaxed text-ink/50">
        2026년 기준으로 정리한 안내예요. 지자체 예산과 기준은 달라질 수 있으니,
        <br />
        신청 전에 주민센터(129)로 한 번 더 확인하시면 확실해요.
      </p>

      {/* 광고 — 혜택 목록 맨 아래, 버튼·카드와 떨어뜨린 자리. 광고 단위 ID 가 없으면 아무것도 안 그린다. */}
      <AdFitBanner placement="welfare" />

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
          <div className="mt-2.5">
            <SpeakButton
              text={stepsSpeech(program)}
              label="신청 방법 소리로 듣기"
              dataName="welfare-detail"
              tone="white"
            />
          </div>
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
  const years = BIRTH_YEARS;

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
