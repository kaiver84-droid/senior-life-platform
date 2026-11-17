"use client";

import React, { useEffect, useMemo } from "react";
import { REGIONS, sigunguList } from "@/lib/regions";
import { BIRTH_TIME_OPTIONS, UNKNOWN_BIRTH_TIME, normalizeBirthTime } from "@/lib/birthtime";

/** 태어난 해 선택 범위 — 전 연령(10대 이하·20대 … 90대)을 고를 수 있게 1926~2020년생 */
export const BIRTH_YEARS = Array.from({ length: 2020 - 1926 + 1 }, (_, i) => 1926 + i);
export const DEFAULT_BIRTH_YEAR = 1952;
export const DEFAULT_SIDO = "충청북도";
export const DEFAULT_SIGUNGU = "옥천군";

export type ProfileDraft = {
  nickname: string;
  birthYear: number;
  birthTime: string;
  sido: string;
  sigungu: string;
};

export function emptyDraft(): ProfileDraft {
  return {
    nickname: "",
    birthYear: DEFAULT_BIRTH_YEAR,
    birthTime: UNKNOWN_BIRTH_TIME,
    sido: DEFAULT_SIDO,
    sigungu: DEFAULT_SIGUNGU,
  };
}

/** 카카오에서 온 생년이 범위 안이면 그대로, 아니면 기본값 */
export function normalizeBirthYear(value: unknown): number {
  const n = Number(value || 0);
  return n >= BIRTH_YEARS[0] && n <= BIRTH_YEARS[BIRTH_YEARS.length - 1] ? n : DEFAULT_BIRTH_YEAR;
}

const THIS_YEAR = 2026;

/**
 * 이름 · 태어난 해 · 태어난 시간 · 사는 지역(시·도/시·군·구) 입력.
 * 최초 1회 초기 설정 화면과 ⚙ 설정의 '내 정보 고치기'가 같은 모양을 쓴다.
 */
export function ProfileFields({
  value,
  onChange,
  idPrefix = "pf",
  autoFocus = false,
}: {
  value: ProfileDraft;
  onChange: (patch: Partial<ProfileDraft>) => void;
  idPrefix?: string;
  autoFocus?: boolean;
}) {
  const sigunguOptions = useMemo(() => sigunguList(value.sido), [value.sido]);

  // 시·도를 바꾸면 그 시·도의 첫 시·군·구로 맞춘다(목록에 없는 값이 남지 않게).
  useEffect(() => {
    if (!sigunguOptions.length) return;
    if (!sigunguOptions.includes(value.sigungu)) onChange({ sigungu: sigunguOptions[0] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sigunguOptions]);

  const birthTimeKnown = Boolean(value.birthTime && normalizeBirthTime(value.birthTime) !== UNKNOWN_BIRTH_TIME);
  const pickedTime = normalizeBirthTime(value.birthTime);

  return (
    <div>
      <div>
        <label htmlFor={`${idPrefix}-nick`} className="mb-1.5 block text-[1rem] font-extrabold">
          이름 (또는 애칭)
        </label>
        <input
          id={`${idPrefix}-nick`}
          className="field"
          placeholder="예: 순자"
          value={value.nickname}
          onChange={(e) => onChange({ nickname: e.target.value })}
          maxLength={12}
          autoComplete="off"
          autoFocus={autoFocus}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3">
        <div>
          <label htmlFor={`${idPrefix}-birth`} className="mb-1.5 block text-[1rem] font-extrabold">
            태어난 해
          </label>
          <select
            id={`${idPrefix}-birth`}
            className="field"
            value={value.birthYear}
            onChange={(e) => onChange({ birthYear: Number(e.target.value) })}
          >
            {BIRTH_YEARS.map((y) => (
              <option key={y} value={y}>
                {y}년 ({THIS_YEAR - y}세)
              </option>
            ))}
          </select>
        </div>
        <div>
          <p id={`${idPrefix}-time-label`} className="mb-1.5 block text-[1rem] font-extrabold">
            태어난 시간
          </p>
          {/* 시니어는 태어난 시간을 모르는 분이 많다 — ‘모르겠음’을 맨 위에 크게,
              그 아래 십이시진을 누르기 쉬운 2열 큰 버튼으로 펼쳐 둔다. */}
          <div
            id={`${idPrefix}-time`}
            role="radiogroup"
            aria-labelledby={`${idPrefix}-time-label`}
            className="grid grid-cols-2 gap-2"
          >
            {BIRTH_TIME_OPTIONS.filter((o) => o.key === UNKNOWN_BIRTH_TIME).map((o) => {
              const active = pickedTime === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-birthtime={o.key}
                  onClick={() => onChange({ birthTime: o.key })}
                  className={`col-span-2 flex min-h-[56px] flex-col items-center justify-center rounded-2xl border-2 px-3 py-2 transition active:scale-[0.99] ${
                    active ? "border-brand bg-brand text-white shadow-soft" : "border-brand/25 bg-brand-light/50 text-brand-dark"
                  }`}
                >
                  <span className="text-[1.08rem] font-black leading-tight">{o.name}</span>
                  <span className={`text-[0.78rem] font-bold leading-tight ${active ? "text-white/80" : "text-ink/50"}`}>
                    태어난 시간이 기억나지 않아도 괜찮아요
                  </span>
                </button>
              );
            })}
            {BIRTH_TIME_OPTIONS.filter((o) => o.key !== UNKNOWN_BIRTH_TIME).map((o) => {
              const active = pickedTime === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-birthtime={o.key}
                  aria-label={o.label}
                  onClick={() => onChange({ birthTime: o.key })}
                  className={`flex min-h-[64px] flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-1.5 py-2 transition active:scale-[0.99] ${
                    active ? "border-brand bg-brand-light shadow-soft" : "border-ink/10 bg-white"
                  }`}
                >
                  <span className={`text-[1.06rem] font-black leading-tight ${active ? "text-brand-dark" : "text-ink"}`}>
                    {o.name}
                  </span>
                  <span className={`text-[0.76rem] font-bold leading-snug ${active ? "text-brand-dark/80" : "text-ink/55"}`}>
                    {o.range}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <p className="mt-1.5 text-[0.82rem] font-semibold leading-relaxed text-ink/45">
        {birthTimeKnown
          ? "태어난 시간은 오늘의 운세와 시간대 팁에만 써요."
          : "태어난 시간을 모르면 ‘모르겠음’을 골라 주세요. 나중에 고칠 수 있어요."}
      </p>

      <div className="mt-3 grid grid-cols-1 gap-3">
        <div>
          <label htmlFor={`${idPrefix}-sido`} className="mb-1.5 block text-[1rem] font-extrabold">
            사는 지역 (시·도)
          </label>
          <select
            id={`${idPrefix}-sido`}
            className="field"
            value={value.sido}
            onChange={(e) => {
              const next = e.target.value;
              const options = sigunguList(next);
              onChange({ sido: next, sigungu: options[0] ?? "" });
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
          <label htmlFor={`${idPrefix}-sigungu`} className="mb-1.5 block text-[1rem] font-extrabold">
            시·군·구
          </label>
          <select
            id={`${idPrefix}-sigungu`}
            className="field"
            value={value.sigungu}
            onChange={(e) => onChange({ sigungu: e.target.value })}
          >
            {sigunguOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
