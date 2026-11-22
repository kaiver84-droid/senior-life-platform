"use client";

import React, { useEffect, useRef } from "react";

/**
 * 카카오 애드핏(Kakao AdFit) 모바일 웹 배너.
 *
 * - 광고 단위 ID(`DAN-...`)가 환경변수에 없으면 **아무것도 그리지 않는다**(빈 여백·깨진 박스 금지).
 * - ID 가 있으면 320×50 고정 영역 + 작은 `광고` 라벨 + 넉넉한 위아래 여백을 둔다.
 *   (어르신이 옆 버튼을 잘못 누르지 않도록 광고와 버튼 사이를 충분히 띄운다.)
 * - 앱은 Next.js App Router 의 클라이언트 탭 전환으로 화면이 갈리므로, 광고 영역이 새로 붙을 때마다
 *   애드핏 스크립트를 다시 실행해 그 영역만 렌더링한다. 스크립트는 한 번만 내려받고,
 *   같은 영역을 두 번 렌더링하지 않도록 애드핏 쪽 중복 검사(has)에 맡긴다.
 *
 * 광고 단위 ID 는 빌드 시점에 박히는 공개 값이다(`NEXT_PUBLIC_`). 발급받은 뒤
 * `.env.production.local` 에 아래 두 줄을 넣고 배포하면 바로 켜진다.
 *   NEXT_PUBLIC_ADFIT_QUIZ_UNIT=DAN-xxxxxxxxxxxx
 *   NEXT_PUBLIC_ADFIT_WELFARE_UNIT=DAN-yyyyyyyyyyyy
 */
const SCRIPT_SRC = "https://t1.daumcdn.net/kas/static/ba.min.js";

/** 광고를 놓는 자리 — 퀴즈 결과 하단 / 오늘의 혜택 하단 두 곳뿐이다 */
export type AdfitPlacement = "quiz" | "welfare";

/**
 * 광고 단위 ID. `_UNIT` 과 `_UNIT_ID` 두 이름을 모두 받는다.
 * (값이 비어 있으면 그 자리에는 광고를 그리지 않는다.)
 */
const AD_UNIT: Record<AdfitPlacement, string> = {
  quiz: (process.env.NEXT_PUBLIC_ADFIT_QUIZ_UNIT || process.env.NEXT_PUBLIC_ADFIT_QUIZ_UNIT_ID || "").trim(),
  welfare: (process.env.NEXT_PUBLIC_ADFIT_WELFARE_UNIT || process.env.NEXT_PUBLIC_ADFIT_WELFARE_UNIT_ID || "").trim(),
};

/** 광고 단위 ID 가 하나라도 채워져 있는지 — 화면 점검·안내용 */
export const ADFIT_ENABLED = Boolean(AD_UNIT.quiz || AD_UNIT.welfare);

type AdfitModule = {
  init?: () => void;
  render?: (element: HTMLElement) => void;
};

function adfitModule(): AdfitModule | null {
  if (typeof window === "undefined") return null;
  const mod = (window as unknown as { adfit?: AdfitModule }).adfit;
  return mod && typeof mod === "object" ? mod : null;
}

/**
 * 애드핏 스크립트를 한 번만 받아 온다.
 * 이미 받아 둔 스크립트가 있으면 새로 넣지 않고(중복 정의 방지) 로드 완료만 기다린다.
 */
let scriptPromise: Promise<void> | null = null;

function loadAdfitScript(): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") return Promise.resolve();
  if (adfitModule()) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-neulbom-adfit]");
    if (existing) {
      // 다른 탭이 먼저 넣어 둔 스크립트 — 이미 실행됐으면 바로 끝난다.
      if (adfitModule()) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => resolve(), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.dataset.neulbomAdfit = "1";
    script.addEventListener("load", () => resolve(), { once: true });
    // 광고 차단기·네트워크 오류로 못 받아 와도 화면은 그대로 둔다.
    script.addEventListener("error", () => resolve(), { once: true });
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * 광고 영역 하나를 애드핏에 넘긴다.
 * `adfit.render(영역)` 이 있으면 그 영역만, 없으면 `adfit.init()` 으로 페이지 안의 영역을 다시 훑게 한다.
 */
async function requestAd(element: HTMLElement): Promise<void> {
  await loadAdfitScript();
  const mod = adfitModule();
  if (!mod) return;
  try {
    if (typeof mod.render === "function") mod.render(element);
    else mod.init?.();
  } catch {
    // 광고가 안 뜨는 것은 앱 기능과 무관하다 — 조용히 넘긴다.
  }
}

export function AdFitBanner({
  placement,
  width = 320,
  height = 50,
}: {
  placement: AdfitPlacement;
  /** 애드핏 광고 크기(고정). 기본 320×50 */
  width?: number;
  height?: number;
}) {
  const unitId = AD_UNIT[placement];
  const insRef = useRef<HTMLModElement | null>(null);

  useEffect(() => {
    if (!unitId) return;
    let alive = true;
    const element = insRef.current;
    if (!element) return;
    void (async () => {
      if (!alive) return;
      await requestAd(element);
    })();
    return () => {
      alive = false;
    };
  }, [unitId, width, height]);

  // 광고 단위 ID 가 없으면 빈 자리조차 남기지 않는다.
  if (!unitId) return null;

  return (
    <div
      data-adfit-slot={placement}
      className="fade-up mt-6 mb-4 flex flex-col items-center"
      aria-label="광고"
    >
      <p aria-hidden className="mb-1.5 text-[0.7rem] font-bold tracking-[0.18em] text-ink/30">
        광고
      </p>
      <div className="flex w-full justify-center overflow-hidden" style={{ minHeight: height }}>
        <ins
          ref={insRef}
          className="kakao_ad_area"
          style={{ display: "none" }}
          data-ad-unit={unitId}
          data-ad-width={width}
          data-ad-height={height}
        />
      </div>
    </div>
  );
}
