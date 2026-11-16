"use client";

import React, { useEffect, useMemo } from "react";
import { REGIONS, sigunguList } from "@/lib/regions";
import { BIRTH_TIME_OPTIONS, UNKNOWN_BIRTH_TIME } from "@/lib/birthtime";

/** 태어난 해 선택 범위 — 지금 늘봄을 쓰시는 어르신 세대(1930~1985) */
export const BIRTH_YEARS = Array.from({ length: 1985 - 1930 + 1 }, (_, i) => 1930 + i);
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

  const birthTimeKnown = value.birthTime && value.birthTime !== UNKNOWN_BIRTH_TIME;

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
          <label htmlFor={`${idPrefix}-time`} className="mb-1.5 block text-[1rem] font-extrabold">
            태어난 시간
          </label>
          <select
            id={`${idPrefix}-time`}
            className="field"
            value={value.birthTime || UNKNOWN_BIRTH_TIME}
            onChange={(e) => onChange({ birthTime: e.target.value })}
          >
            {BIRTH_TIME_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="mt-1.5 text-[0.82rem] font-semibold leading-relaxed text-ink/45">
        {birthTimeKnown
          ? "태어난 시간은 오늘의 운세와 시간대 팁에만 써요."
          : "태어난 시간을 모르면 ‘모름’을 골라 주세요. 나중에 고칠 수 있어요."}
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
