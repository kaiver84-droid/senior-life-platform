"use client";

import { canvasToFile, downloadCanvas } from "./canvas";

export type KakaoConfig = { jsKey: string; configured: boolean };

export function kakaoConfig(): KakaoConfig {
  const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY || "";
  return { jsKey, configured: Boolean(jsKey) };
}

type KakaoWindow = Window & {
  Kakao?: {
    isInitialized: () => boolean;
    init: (key: string) => void;
    Share: { sendDefault: (payload: unknown) => void };
  };
};

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
  try {
    downloadCanvas(canvas, filename);
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
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
