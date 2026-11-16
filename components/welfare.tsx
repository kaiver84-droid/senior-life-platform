"use client";

import React, { useMemo, useState } from "react";
import { matchPrograms, WELFARE_CATEGORIES } from "@/lib/welfare";
import type { WelfareProgram } from "@/lib/types";
import { useApp } from "@/lib/storage";
import { REGIONS, sigunguList, shortSido } from "@/lib/regions";
import { Badge, BigButton, Card, SectionTitle, Sheet, useToast } from "./ui";
import { IconChevron, IconPhone } from "./icons";

export function WelfareTab() {
  const { profile, updateProfile } = useApp();
  const { show } = useToast();
  const [category, setCategory] = useState<string>("전체");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const matched = useMemo(
    () => matchPrograms(profile?.birthYear || 1955, profile?.sido || "", profile?.sigungu || ""),
    [profile?.birthYear, profile?.sido, profile?.sigungu]
  );

  const list = category === "전체" ? matched : matched.filter((p) => p.category === category);
  const age = profile ? new Date().getFullYear() - profile.birthYear : 0;

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-[1.55rem] font-black leading-snug">💰 내게 맞는 지원금</h1>
        <p className="mt-1 text-[0.98rem] font-semibold text-ink/60">
          {profile?.birthYear}년생({age}세) · {shortSido(profile?.sido || "")} {profile?.sigungu} 기준
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Badge tone="leaf">받을 수 있어요 {matched.length}개</Badge>
          <button
            onClick={() => setEditOpen(true)}
            className="rounded-full border-2 border-ink/12 bg-white px-3 py-1 text-[0.82rem] font-bold text-ink/70"
          >
            지역·나이 바꾸기
          </button>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {WELFARE_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={`min-h-[46px] shrink-0 rounded-full border-2 px-4 text-[0.95rem] font-extrabold transition ${
              category === c ? "border-brand bg-brand text-white" : "border-ink/12 bg-white text-ink/70"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {list.map((p) => (
          <ProgramCard
            key={p.id}
            program={p}
            open={openId === p.id}
            onToggle={() => setOpenId(openId === p.id ? null : p.id)}
            onCopy={(m) => show(m)}
          />
        ))}
        {list.length === 0 ? (
          <Card>
            <p className="text-center text-[1rem] font-semibold text-ink/60">
              이 분류에는 찾은 지원이 없어요. 다른 분류를 눌러 보세요.
            </p>
          </Card>
        ) : null}
      </div>

      <p className="rounded-2xl bg-white/70 px-4 py-3 text-center text-[0.82rem] font-semibold leading-relaxed text-ink/55">
        2026년 기준으로 정리한 안내예요. 지자체 예산과 기준은 달라질 수 있으니,
        <br />
        신청 전에 주민센터(129)로 한 번 더 확인하시면 확실해요.
      </p>

      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title="지역·나이 바꾸기">
        <ProfileEditor
          initial={{ birthYear: profile?.birthYear || 1952, sido: profile?.sido || "", sigungu: profile?.sigungu || "" }}
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

function ProgramCard({
  program,
  open,
  onToggle,
  onCopy,
}: {
  program: WelfareProgram;
  open: boolean;
  onToggle: () => void;
  onCopy: (m: string) => void;
}) {
  return (
    <div className={`card overflow-hidden transition ${open ? "border-brand/40" : ""}`}>
      <button onClick={onToggle} className="w-full px-4 py-4 text-left" aria-expanded={open}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <Badge tone={program.tags.includes("가장 먼저 챙기세요") ? "warm" : "brand"}>
                {program.category}
              </Badge>
              {program.tags.slice(0, 2).map((t) => (
                <Badge key={t} tone="gray">
                  {t}
                </Badge>
              ))}
            </div>
            <h3 className="text-[1.15rem] font-black leading-snug">{program.title}</h3>
            <p className="mt-0.5 text-[1rem] font-extrabold text-warm">{program.amount}</p>
          </div>
          <IconChevron
            size={24}
            className={`mt-1 shrink-0 text-ink/40 transition-transform ${open ? "rotate-90" : ""}`}
          />
        </div>
        <p className="mt-2 line-clamp-2 text-[0.95rem] font-semibold leading-snug text-ink/65">{program.summary}</p>
      </button>

      {open ? (
        <div className="fade-up border-t-2 border-ink/8 bg-[#FDFAF2] px-4 py-4">
          <p className="text-[0.9rem] font-black text-ink/70">이렇게 하세요 (3단계)</p>
          <ol className="mt-2 space-y-2.5">
            {program.steps.map((s, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-[0.85rem] font-black text-white">
                  {i + 1}
                </span>
                <p className="text-[1rem] font-semibold leading-snug text-ink/85">{s}</p>
              </li>
            ))}
          </ol>

          <div className="mt-3 rounded-xl bg-white p-3">
            <p className="text-[0.86rem] font-black text-ink/60">챙길 것</p>
            <p className="mt-0.5 text-[0.98rem] font-semibold">{program.documents.join(" · ")}</p>
            <p className="mt-2 text-[0.86rem] font-black text-ink/60">문의</p>
            <p className="text-[0.98rem] font-semibold">
              {program.org}
              {program.phone ? ` · ${program.phone}` : ""}
            </p>
            {program.deadline ? (
              <p className="mt-1 text-[0.9rem] font-bold text-warm">⏰ {program.deadline}</p>
            ) : null}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {program.phone ? (
              <a
                href={`tel:${program.phone}`}
                className="touch-btn min-h-[52px] border-2 border-ink/15 bg-white text-[0.98rem] font-extrabold"
              >
                <IconPhone size={20} /> 전화하기
              </a>
            ) : (
              <button
                onClick={() => onCopy("대표번호 129로 전화해 물어보세요.")}
                className="touch-btn min-h-[52px] border-2 border-ink/15 bg-white text-[0.98rem] font-extrabold"
              >
                <IconPhone size={20} /> 129 안내
              </button>
            )}
            <a
              href={program.url}
              target="_blank"
              rel="noreferrer"
              className="touch-btn min-h-[52px] border-2 border-brand-dark/20 bg-brand text-[0.98rem] font-extrabold text-white"
            >
              자세히 보기
            </a>
          </div>
        </div>
      ) : null}
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
      <BigButton variant="brand" full onClick={() => onSave({ birthYear, sido, sigungu })}>
        저장하기
      </BigButton>
    </div>
  );
}
