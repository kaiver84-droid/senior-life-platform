"use client";

import React, { useCallback, useEffect, useState } from "react";
import { BigButton, Sheet } from "./ui";
import { IconClose } from "./icons";
import { isKakaoInAppBrowser } from "@/lib/share";

/**
 * “주소창 없이 앱처럼 쓰기” 안내.
 * - 처음 홈에 들어왔을 때 한 번만 부담 없이 띄운다(이미 앱으로 열렸거나 ‘다시 안 보기’면 안 띄운다).
 * - 안드로이드: beforeinstallprompt 를 잡아 두었다가 큰 버튼 한 번으로 설치 팝업을 띄운다.
 * - 아이폰: 공유(□↑) → ‘홈 화면에 추가’ 두 단계를 그림처럼 보여 준다.
 * - 카카오톡 안 화면: 설치 메뉴가 없으므로 ‘다른 브라우저로 열기’를 먼저 안내한다.
 */

type Platform = "ios" | "android" | "kakao" | "other";

type BipEvent = Event & {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __neulbomInstallPrompt?: BipEvent | null;
    __neulbomInstallEvent?: string;
  }
}

const DISMISS_KEY = "neulbom.installGuide.dismissed.v1";
/** 첫 진입에서 설치 안내를 한 번 띄웠는지 — 닫은 뒤에는 다시 자동으로 뜨지 않는다 */
const FIRST_RUN_KEY = "neulbom.installGuide.seen.v1";
export const INSTALL_GUIDE_EVENT = "neulbom:install-guide";

/** 더보기/설정 어디서든 안내를 다시 열 수 있게 */
export function openInstallGuide() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(INSTALL_GUIDE_EVENT));
}

/** 크롬 계열 설치 팝업을 붙잡아 둔다(모듈이 처음 불릴 때 한 번) */
if (typeof window !== "undefined" && !window.__neulbomInstallEvent) {
  window.__neulbomInstallEvent = "on";
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    window.__neulbomInstallPrompt = e as BipEvent;
    window.dispatchEvent(new Event("neulbom:install-available"));
  });
  window.addEventListener("appinstalled", () => {
    window.__neulbomInstallPrompt = null;
    try {
      localStorage.setItem(DISMISS_KEY, "installed");
    } catch {
      /* 저장 못 해도 괜찮다 */
    }
  });
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    window.matchMedia?.("(display-mode: fullscreen)")?.matches === true ||
    nav.standalone === true
  );
}

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  if (isKakaoInAppBrowser()) return "kakao";
  const ua = navigator.userAgent;
  const nav = navigator as Navigator & { maxTouchPoints?: number };
  if (/android/i.test(ua)) return "android";
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && (nav.maxTouchPoints || 0) > 1)) {
    return "ios";
  }
  return "other";
}

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

/** 첫 진입 자동 안내를 이미 보여 줬는지 */
export function hasSeenInstallGuide(): boolean {
  try {
    return localStorage.getItem(FIRST_RUN_KEY) === "1";
  } catch {
    return false;
  }
}

function markInstallGuideSeen() {
  try {
    localStorage.setItem(FIRST_RUN_KEY, "1");
  } catch {
    /* 저장하지 못해도 안내는 계속 쓸 수 있다 */
  }
}

/** 기기 OS — 카톡 안에서도 ‘Safari/크롬으로 열기’를 골라 안내하기 위해 따로 본다 */
function detectOS(): "ios" | "android" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  const nav = navigator as Navigator & { maxTouchPoints?: number };
  if (/android/i.test(ua)) return "android";
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && (nav.maxTouchPoints || 0) > 1)) {
    return "ios";
  }
  return "other";
}

/** 안내를 띄울지 판단 — 이미 앱으로 열렸거나 ‘다시 안 보기’면 띄우지 않는다 */
export function shouldOfferInstall(): boolean {
  if (typeof window === "undefined") return false;
  if (isStandalone()) return false;
  const d = readDismissed();
  return d !== "1" && d !== "installed";
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-[0.92rem] font-black text-white">
        {n}
      </span>
      <span className="text-[1rem] font-bold leading-snug text-ink/85">{children}</span>
    </li>
  );
}

const DISMISS_EVENT = "neulbom:install-dismissed";

export function InstallGuide() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");
  const [os, setOs] = useState<"ios" | "android" | "other">("other");
  const [canInstall, setCanInstall] = useState(false);
  const [busy, setBusy] = useState(false);

  const refreshAvailability = useCallback(() => {
    setCanInstall(!!window.__neulbomInstallPrompt);
  }, []);

  useEffect(() => {
    setPlatform(detectPlatform());
    setOs(detectOS());
    refreshAvailability();
    const onAvail = () => refreshAvailability();
    window.addEventListener("neulbom:install-available", onAvail);
    const onOpen = () => {
      setPlatform(detectPlatform());
      setOs(detectOS());
      setOpen(true);
    };
    window.addEventListener(INSTALL_GUIDE_EVENT, onOpen);
    return () => {
      window.removeEventListener("neulbom:install-available", onAvail);
      window.removeEventListener(INSTALL_GUIDE_EVENT, onOpen);
    };
  }, [refreshAvailability]);

  /**
   * 첫 사용자(온보딩을 막 마치고 처음 들어온 사람)에게 설치 안내를 한 번 자동으로 띄운다.
   * - 이미 홈 화면 앱(standalone)으로 열렸거나, 한 번 봤거나 ‘다시 안 보기’면 띄우지 않는다.
   * - 컴퓨터 브라우저(other)에서는 자동으로 띄우지 않는다(휴대폰 설치 안내라서).
   */
  useEffect(() => {
    const p = detectPlatform();
    if (p !== "ios" && p !== "android" && p !== "kakao") return;
    if (!shouldOfferInstall() || hasSeenInstallGuide()) return;
    const t = window.setTimeout(() => {
      markInstallGuideSeen();
      // 이벤트로 열면 홈의 설치 배너도 함께 사라져 같은 안내를 두 번 보여 주지 않는다
      openInstallGuide();
    }, 1400);
    return () => window.clearTimeout(t);
  }, []);

  /** 카톡 인앱에서도 그 기기(아이폰/안드로이드)의 설치 단계를 그대로 보여 준다 */
  const guideOS: Platform = platform === "kakao" ? (os === "other" ? "other" : os) : platform;

  /** 닫기(나중에 보기) — 한 번 봤으면 다시 자동으로 뜨지 않게 기억한다 */
  const closeGuide = useCallback(() => {
    markInstallGuideSeen();
    setOpen(false);
  }, []);

  const dismissForever = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* 무시 */
    }
    setOpen(false);
    window.dispatchEvent(new Event(DISMISS_EVENT));
  }, []);

  const installNow = useCallback(async () => {
    const bip = window.__neulbomInstallPrompt;
    if (!bip) return;
    setBusy(true);
    try {
      await bip.prompt();
      const choice = await bip.userChoice;
      window.__neulbomInstallPrompt = null;
      setCanInstall(false);
      if (choice?.outcome === "accepted") {
        try {
          localStorage.setItem(DISMISS_KEY, "installed");
        } catch {
          /* 무시 */
        }
        setOpen(false);
      }
    } catch {
      /* 팝업이 막히면 아래 단계 안내를 그대로 보여 준다 */
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <>
      <Sheet
        open={open}
        onClose={closeGuide}
        title="📱 늘봄 앱 설치하기"
        subtitle="홈 화면에 추가하면 앱처럼 열려요"
        hideBottomClose
        footer={
          <BigButton variant="white" full onClick={closeGuide} height={54}>
            <IconClose size={20} /> 나중에 보기
          </BigButton>
        }
      >
        <div data-install-guide data-platform={platform} className="space-y-3">
          {platform === "kakao" ? (
            <div className="rounded-[1.4rem] bg-sun-light px-4 py-3.5">
              <p className="text-[1rem] font-black leading-snug text-[#8A6100]">
                카카오톡 안에서는 설치 메뉴가 없어요
              </p>
              <p className="mt-1 text-[0.94rem] font-semibold leading-relaxed text-[#8A6100]/85">
                아래 버튼을 누르면 {os === "android" ? "크롬" : "Safari"}로 열려요. 그다음 아래 순서대로 하시면 돼요.
              </p>
              <div className="mt-3">
                <BigButton
                  variant="ink"
                  size="lg"
                  full
                  onClick={() => {
                    // 카톡 인앱브라우저는 설치 메뉴가 없다 — 기본 브라우저(사파리/크롬)로 넘긴다
                    const url = window.location.href;
                    window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
                  }}
                >
                  🧭 {os === "android" ? "크롬으로 열기" : "Safari로 열기"}
                </BigButton>
              </div>
              <p className="mt-2 text-[0.84rem] font-bold leading-snug text-[#8A6100]/80">
                버튼이 안 되면 오른쪽 위 <b>⋮</b>(혹은 아래 <b>···</b>) → <b>‘다른 브라우저로 열기’</b>를 눌러 주세요.
              </p>
            </div>
          ) : null}

          {platform === "android" && canInstall ? (
            <div data-install-native className="rounded-[1.4rem] bg-white p-4 shadow-soft">
              <p className="text-[1.02rem] font-black text-ink">한 번만 누르면 끝나요</p>
              <p className="mt-1 text-[0.92rem] font-semibold leading-relaxed text-ink/60">
                아래 버튼을 누르고 뜨는 창에서 ‘설치’를 골라 주세요.
              </p>
              <div className="mt-3">
                <BigButton variant="teal" size="lg" full onClick={() => void installNow()} disabled={busy}>
                  📲 늘봄 앱 바로 설치하기
                </BigButton>
              </div>
            </div>
          ) : null}

          <div className="rounded-[1.4rem] bg-white p-4 shadow-soft">
            <p className="mb-2.5 text-[1.02rem] font-black text-ink">
              {guideOS === "ios"
                ? "아이폰은 이렇게 해요"
                : guideOS === "android"
                  ? "안드로이드는 이렇게 해요"
                  : "휴대폰은 이렇게 해요"}
            </p>
            {guideOS === "ios" ? (
              <ol className="space-y-2.5">
                <Step n={1}>
                  사파리 <b>아래 가운데 공유 버튼</b>
                  <span className="mx-1 inline-grid h-7 w-7 place-items-center rounded-md border-2 border-ink/20 bg-paper align-middle text-[0.95rem]">
                    □↑
                  </span>
                  을 누르세요.
                </Step>
                <Step n={2}>
                  목록을 조금 내려 <b>‘홈 화면에 추가’</b>를 누르세요.
                </Step>
                <Step n={3}>
                  오른쪽 위 <b>‘추가’</b>를 누르면 끝! 홈 화면의 늘봄을 눌러 여세요.
                </Step>
              </ol>
            ) : guideOS === "android" ? (
              <ol className="space-y-2.5">
                <Step n={1}>
                  오른쪽 위 <b>⋮</b> 메뉴를 누르세요.
                </Step>
                <Step n={2}>
                  <b>‘앱 설치’</b> 또는 <b>‘홈 화면에 추가’</b>를 누르세요.
                </Step>
                <Step n={3}>
                  <b>‘설치’</b>를 누르면 홈 화면에 늘봄이 생겨요.
                </Step>
              </ol>
            ) : (
              <ol className="space-y-2.5">
                <Step n={1}>브라우저 오른쪽 위 메뉴(⋮ 또는 ···)를 누르세요.</Step>
                <Step n={2}>
                  <b>‘홈 화면에 추가’</b> 또는 <b>‘앱 설치’</b>를 누르세요.
                </Step>
                <Step n={3}>늘봄을 휴대폰으로 열면 가장 편해요.</Step>
              </ol>
            )}
          </div>

          <div className="rounded-[1.4rem] bg-brand-light px-4 py-3">
            <p className="text-[0.9rem] font-bold leading-relaxed text-brand-dark">
              홈 화면에 추가하면 주소창이 사라져 화면이 더 넓고, 글씨도 더 크게 보여요. 인터넷이 느릴 때도 빨리 열려요.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={dismissForever}
              data-install-dismiss
              className="min-h-[48px] w-full rounded-2xl text-[0.92rem] font-bold text-ink/45 active:bg-ink/5"
            >
              이미 홈 화면에 있어요 · 다시 안 보기
            </button>
          </div>
        </div>
      </Sheet>
    </>
  );
}

/** 홈 맨 위에 한 번만 보이는 안내 배너 — 누르면 위 시트가 열린다 */
export function InstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const refresh = () => setShow(shouldOfferInstall() && !hasSeenInstallGuide());
    refresh();
    const hide = () => setShow(false);
    window.addEventListener("appinstalled", hide);
    window.addEventListener(DISMISS_EVENT, hide);
    window.addEventListener(INSTALL_GUIDE_EVENT, hide);
    return () => {
      window.removeEventListener("appinstalled", hide);
      window.removeEventListener(DISMISS_EVENT, hide);
      window.removeEventListener(INSTALL_GUIDE_EVENT, hide);
    };
  }, []);

  if (!show) return null;
  return (
    <button
      type="button"
      data-install-banner
      onClick={() => openInstallGuide()}
      className="card fade-up flex w-full items-center gap-3 border-2 border-brand/20 p-3 text-left"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[0.9rem] bg-brand-light text-[1.35rem]">
        📱
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.98rem] font-black leading-tight text-ink">주소창 없이 앱처럼 쓰기</span>
        <span className="mt-0.5 block text-[0.82rem] font-semibold leading-tight text-ink/55">
          홈 화면에 추가하는 방법 2단계
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-brand px-3 py-2 text-[0.82rem] font-black text-white">보기</span>
    </button>
  );
}

/** 더보기 탭에서 언제든 다시 여는 줄 */
export function InstallGuideRow() {
  return (
    <button
      type="button"
      onClick={() => openInstallGuide()}
      data-install-row
      className="card flex w-full items-center gap-3 p-3.5 text-left active:scale-[0.995]"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[1rem] bg-sun-light text-[1.5rem]">📱</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[1.02rem] font-black leading-tight text-ink">주소창 없이 앱처럼 쓰기</span>
        <span className="mt-0.5 block truncate text-[0.84rem] font-semibold text-ink/50">
          홈 화면에 추가하는 방법 보기
        </span>
      </span>
      <span className="shrink-0 text-ink/25">›</span>
    </button>
  );
}
