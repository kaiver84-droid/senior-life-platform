"use client";

import { canvasToFile, downloadCanvas } from "./canvas";

export type KakaoConfig = { jsKey: string; configured: boolean };

export function kakaoConfig(): KakaoConfig {
  const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY || "";
  return { jsKey, configured: Boolean(jsKey) };
}

type KakaoSdk = {
  isInitialized: () => boolean;
  init: (key: string) => void;
  Share: { sendDefault: (payload: unknown) => void };
  Auth?: {
    authorize?: (settings: { redirectUri: string; throughTalk?: boolean; prompt?: string }) => void;
  };
};

type KakaoWindow = Window & { Kakao?: KakaoSdk };

let sdkLoading: Promise<boolean> | null = null;

export function loadKakaoSdk(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const w = window as KakaoWindow;
  if (w.Kakao) {
    if (!w.Kakao.isInitialized()) {
      const { jsKey } = kakaoConfig();
      if (!jsKey) return Promise.resolve(false);
      w.Kakao.init(jsKey);
    }
    return Promise.resolve(true);
  }
  if (!kakaoConfig().configured) return Promise.resolve(false);
  if (sdkLoading) return sdkLoading;
  sdkLoading = new Promise<boolean>((resolve) => {
    const s = document.createElement("script");
    s.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js";
    s.async = true;
    s.onload = () => {
      const win = window as KakaoWindow;
      if (!win.Kakao) return resolve(false);
      if (!win.Kakao.isInitialized()) win.Kakao.init(kakaoConfig().jsKey);
      resolve(true);
    };
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
  return sdkLoading;
}

/**
 * 이미 로드된 Kakao SDK 로 즉시 authorize 를 호출한다(동기).
 * iOS Safari 는 사용자 제스처 밖에서 앱 스킴/유니버설 링크 이동을 막을 수 있어서,
 * 버튼 클릭과 같은 작업 안에서 호출해야 카카오톡 앱이 바로 열린다. 호출되면 true.
 */
export function kakaoAuthorizeNow(redirectUri: string): boolean {
  if (typeof window === "undefined") return false;
  const auth = (window as KakaoWindow).Kakao?.Auth;
  if (!auth || typeof auth.authorize !== "function") return false;
  try {
    auth.authorize({ redirectUri, throughTalk: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * 카카오톡 앱 간편로그인(원터치) — 아이디/비밀번호 입력 없이 카카오톡으로 인증한다.
 *
 * Kakao.Auth.authorize({ throughTalk: true }) 는 JavaScript 키 + JavaScript SDK 도메인 +
 * 카카오 로그인 사용 설정이 있는 앱에서만 동작하고, 호출하면 카카오톡 앱(또는 카카오계정 화면)으로
 * 이동하므로 정상 호출 시 이 함수는 true 를 돌려주고 페이지는 곧 떠난다.
 * SDK 미로드/미설정/예외일 때만 false 를 돌려주어 호출한 쪽이 서버 경유(/api/auth/kakao?start=1)로 폴백한다.
 */
export async function startKakaoLogin(redirectUri: string): Promise<boolean> {
  if (kakaoAuthorizeNow(redirectUri)) return true;
  const loaded = await loadKakaoSdk();
  if (!loaded) return false;
  return kakaoAuthorizeNow(redirectUri);
}

export type ShareResult = "kakao" | "share" | "downloaded" | "failed";

/** 이미지 + 글을 카카오톡/공유시트/다운로드 순서로 보낸다 */
export async function shareCard(opts: {
  canvas: HTMLCanvasElement;
  filename: string;
  title: string;
  description: string;
  text: string;
}): Promise<ShareResult> {
  const { canvas, filename, title, description, text } = opts;
  const url = typeof window !== "undefined" ? window.location.origin : "";

  // 1) 카카오 JS SDK 가 설정되어 있으면 링크 카드로 전송
  try {
    const ok = await loadKakaoSdk();
    if (ok) {
      const w = window as KakaoWindow;
      w.Kakao?.Share.sendDefault({
        objectType: "feed",
        content: {
          title,
          description,
          imageUrl: `${url}/share-card.png`,
          imageWidth: 1200,
          imageHeight: 630,
          link: { mobileWebUrl: url, webUrl: url },
        },
        buttons: [{ title: "나도 해보기", link: { mobileWebUrl: url, webUrl: url } }],
        installTalk: true,
      });
      return "kakao";
    }
  } catch {
    /* 아래 폴백으로 */
  }

  // 2) Web Share API (카카오톡이 공유 목록에 뜬다)
  try {
    const file = await canvasToFile(canvas, filename);
    if (file && typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title, text });
      return "share";
    }
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title, text, url });
      return "share";
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return "share";
  }

  // 3) 이미지 저장 + 글 복사
  let saved = false;
  try {
    downloadCanvas(canvas, filename);
    saved = true;
  } catch {
    saved = false;
  }
  try {
    await navigator.clipboard?.writeText(text);
  } catch {
    /* 클립보드 권한이 없어도 이미지 저장은 성공 */
  }
  return saved ? "downloaded" : "failed";
}

/**
 * 링크(모임 초대 · 퀴즈 결과)를 카카오톡으로 보낸다.
 * 카카오 JS 키가 없으면 휴대폰 공유창 → 클립보드 순서로 내려간다.
 */
export async function shareLink(opts: {
  title: string;
  description: string;
  url: string;
  buttonTitle?: string;
  imageUrl?: string;
}): Promise<ShareResult> {
  const { title, description, url, buttonTitle } = opts;
  const image = opts.imageUrl || `${url.split("?")[0].replace(/\/$/, "")}/share-card.png`;

  try {
    const ok = await loadKakaoSdk();
    if (ok) {
      const w = window as KakaoWindow;
      w.Kakao?.Share.sendDefault({
        objectType: "feed",
        content: {
          title,
          description,
          imageUrl: image,
          imageWidth: 1200,
          imageHeight: 630,
          link: { mobileWebUrl: url, webUrl: url },
        },
        buttons: [{ title: buttonTitle || "늘봄 열기", link: { mobileWebUrl: url, webUrl: url } }],
        installTalk: true,
      });
      return "kakao";
    }
  } catch {
    /* 아래 폴백으로 */
  }

  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title, text: `${title}\n${description}`, url });
      return "share";
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return "share";
  }

  try {
    await navigator.clipboard.writeText(`${title}\n${description}\n${url}`);
    return "downloaded";
  } catch {
    return "failed";
  }
}

export async function shareText(opts: { title: string; text: string }): Promise<ShareResult> {
  const url = typeof window !== "undefined" ? window.location.href : "";
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title: opts.title, text: opts.text, url });
      return "share";
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return "share";
  }
  try {
    await navigator.clipboard.writeText(`${opts.text}\n${url}`);
    return "downloaded";
  } catch {
    return "failed";
  }
}

export function shareMessageText(result: ShareResult): string {
  switch (result) {
    case "kakao":
      return "카카오톡으로 보냈어요. 친구를 골라 주세요.";
    case "share":
      return "공유 창이 열렸어요. 카카오톡을 골라 주세요.";
    case "downloaded":
      return "이미지를 저장하고 글을 복사했어요. 카카오톡 대화창에서 붙여넣어 보내세요.";
    default:
      return "공유가 되지 않았어요. 이미지 저장 버튼을 먼저 눌러 보세요.";
  }
}
