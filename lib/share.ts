"use client";

/**
 * 카카오톡 공유 · 휴대폰 공유창 · 링크/이미지 복사 폴백.
 *
 * 2단계 고도화 내용
 * - 만든 카드 이미지를 Kakao.Share.uploadImage 로 먼저 올려 **내 카드 그대로** 카톡 피드에 보낸다.
 *   (업로드가 막힌 앱이면 사이트 대표 이미지로 자동 대체)
 * - SDK 미설정·도메인 미등록(4019)·카톡 인앱브라우저·공유 취소를 구분해
 *   `ShareOutcome` 으로 돌려주고 화면이 알맞은 안내를 보여 줄 수 있게 한다.
 * - 어느 단계에서 막혀도 마지막에는 이미지 저장 + 링크 복사로 반드시 끝난다.
 */
import { canvasToFile, downloadCanvas } from "./canvas";

export type KakaoConfig = { jsKey: string; configured: boolean };

export function kakaoConfig(): KakaoConfig {
  const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY || "";
  return { jsKey, configured: Boolean(jsKey) };
}

type KakaoSdk = {
  isInitialized: () => boolean;
  init: (key: string) => void;
  Share: {
    sendDefault: (payload: unknown) => unknown;
    uploadImage?: (settings: { file: File }) => Promise<{ infos?: { original?: { url?: string } } }>;
  };
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
 * SDK 미로드/미설정/예외일 때만 false 를 돌려주어 호출한 쪽이 서버 경유로 폴백한다.
 */
export async function startKakaoLogin(redirectUri: string): Promise<boolean> {
  if (kakaoAuthorizeNow(redirectUri)) return true;
  const loaded = await loadKakaoSdk();
  if (!loaded) return false;
  return kakaoAuthorizeNow(redirectUri);
}

/* ------------------------------------------------------------------ */
/* 공유 결과                                                            */
/* ------------------------------------------------------------------ */

export type ShareChannel = "kakao" | "share" | "saved" | "copied" | "failed";

/** 왜 다른 길로 내려갔는지 — 화면 안내 문구를 고르는 데 쓴다 */
export type ShareReason =
  | "ok"
  | "sdk_absent"
  | "domain_not_registered"
  | "kakao_refused"
  | "inapp_browser"
  | "share_absent"
  | "cancelled"
  | "copy_failed";

export type ShareOutcome = {
  kind: ShareChannel;
  reason: ShareReason;
  /** 사용자에게 그대로 보여 줄 한 줄 안내 */
  message: string;
  /** 카카오 업로드로 만든 이미지 주소(있으면) */
  imageUrl?: string;
};

export function isKakaoInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /KAKAOTALK/i.test(navigator.userAgent);
}

/** 카카오 SDK 오류에서 '도메인 미등록(4019)'을 알아본다 */
function kakaoReason(err: unknown): ShareReason {
  const anyErr = err as { code?: number | string; message?: string; status?: number } | null;
  const code = anyErr?.code ?? anyErr?.status;
  const text = `${anyErr?.message ?? ""} ${String(err ?? "")}`;
  if (String(code) === "4019" || text.includes("4019") || /domain/i.test(text)) {
    return "domain_not_registered";
  }
  return "kakao_refused";
}

export function shareOutcomeMessage(outcome: ShareOutcome): string {
  switch (outcome.kind) {
    case "kakao":
      return "카카오톡으로 보냈어요. 보낼 사람을 골라 주세요.";
    case "share":
      return outcome.reason === "cancelled"
        ? "공유를 멈췄어요. 다시 보내실 수 있어요."
        : "공유 창을 열었어요. 카카오톡을 골라 주세요.";
    case "saved":
      return "이미지를 저장하고 글을 복사했어요. 카카오톡 대화창에 붙여넣어 보내세요.";
    case "copied":
      return "링크를 복사했어요. 카카오톡 대화창에 붙여넣어 보내세요.";
    default:
      return "공유가 되지 않았어요. 이미지 저장을 먼저 눌러 보세요.";
  }
}

/* ------------------------------------------------------------------ */
/* 작은 도구들                                                          */
/* ------------------------------------------------------------------ */

export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 아래 예비 방법으로 */
  }
  try {
    if (typeof document === "undefined") return false;
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function saveImage(canvas: HTMLCanvasElement, filename: string): boolean {
  try {
    downloadCanvas(canvas, filename);
    return true;
  } catch {
    return false;
  }
}

/** 카카오에 카드 이미지를 올려 공개 주소를 받는다(실패하면 null → 대표 이미지 사용) */
async function uploadKakaoImage(canvas: HTMLCanvasElement, filename: string): Promise<string | null> {
  const w = window as KakaoWindow;
  if (!w.Kakao?.Share?.uploadImage) return null;
  const file = await canvasToFile(canvas, filename);
  if (!file) return null;
  try {
    const res = await w.Kakao.Share.uploadImage({ file });
    const url = res?.infos?.original?.url;
    return url && /^https?:\/\//.test(url) ? url : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* 카카오 피드 보내기                                                   */
/* ------------------------------------------------------------------ */

export type ShareLinkOptions = {
  title: string;
  description: string;
  link: string;
  buttonTitle?: string;
  imageUrl?: string;
};

async function kakaoSendFeed(opts: ShareLinkOptions, imageUrl: string): Promise<ShareOutcome> {
  const w = window as KakaoWindow;
  try {
    const ret = w.Kakao?.Share.sendDefault({
      objectType: "feed",
      content: {
        title: opts.title,
        description: opts.description,
        imageUrl,
        imageWidth: 1200,
        imageHeight: 630,
        link: { mobileWebUrl: opts.link, webUrl: opts.link },
      },
      buttons: [
        {
          title: opts.buttonTitle || "늘봄 열기",
          link: { mobileWebUrl: opts.link, webUrl: opts.link },
        },
      ],
      installTalk: true,
    });
    if (ret && typeof (ret as Promise<unknown>).then === "function") await ret;
    return { kind: "kakao", reason: "ok", message: shareOutcomeMessage({ kind: "kakao", reason: "ok", message: "" }), imageUrl };
  } catch (err) {
    const reason = kakaoReason(err);
    return { kind: "failed", reason, message: "" };
  }
}

/**
 * 카드 이미지를 카카오톡으로 보낸다.
 * 1) Kakao.Share.uploadImage 로 내 카드 이미지를 올려 피드 카드로 전송
 * 2) 업로드가 막히면 사이트 대표 이미지로 피드 카드 전송
 * 3) SDK 가 없거나 도메인 미등록(4019)이면 실패를 그대로 알려 준다(화면이 다음 길로 안내)
 */
export async function sendKakaoCard(opts: ShareLinkOptions & { canvas?: HTMLCanvasElement; filename?: string }): Promise<ShareOutcome> {
  const loaded = await loadKakaoSdk();
  if (!loaded) return { kind: "failed", reason: "sdk_absent", message: "" };

  let imageUrl = opts.imageUrl || "";
  if (opts.canvas) {
    const uploaded = await uploadKakaoImage(opts.canvas, opts.filename || "neulbom-card.png");
    if (uploaded) imageUrl = uploaded;
  }
  if (!imageUrl) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    imageUrl = `${origin}/share-card.png`;
  }
  return kakaoSendFeed(opts, imageUrl);
}

/* ------------------------------------------------------------------ */
/* 휴대폰 공유창                                                        */
/* ------------------------------------------------------------------ */

export async function shareViaDevice(opts: {
  title: string;
  text: string;
  link?: string;
  canvas?: HTMLCanvasElement;
  filename?: string;
}): Promise<ShareOutcome> {
  const { title, text, link, canvas, filename } = opts;
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return { kind: "failed", reason: "share_absent", message: "" };
  }
  try {
    if (canvas) {
      const file = await canvasToFile(canvas, filename || "neulbom-card.png");
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title, text });
        return { kind: "share", reason: "ok", message: "" };
      }
    }
    await navigator.share({ title, text, url: link });
    return { kind: "share", reason: "ok", message: "" };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { kind: "share", reason: "cancelled", message: "" };
    }
    return { kind: "failed", reason: "share_absent", message: "" };
  }
}

/* ------------------------------------------------------------------ */
/* 한 번에: 카카오 → 공유창 → 저장+복사                                  */
/* ------------------------------------------------------------------ */

export type SmartShareInput = {
  title: string;
  description: string;
  /** 공유할 링크(모임 초대·퀴즈 결과 등). 없으면 현재 주소 */
  link?: string;
  buttonTitle?: string;
  text: string;
  canvas?: HTMLCanvasElement;
  filename?: string;
  imageUrl?: string;
};

/**
 * 카드/링크를 가능한 가장 좋은 길로 보낸다.
 * 결과의 kind 와 reason 으로 화면이 안내를 고른다.
 */
export async function smartShare(input: SmartShareInput): Promise<ShareOutcome> {
  const link = input.link || (typeof window !== "undefined" ? window.location.origin : "");
  const feed: ShareLinkOptions = {
    title: input.title,
    description: input.description,
    link,
    buttonTitle: input.buttonTitle,
    imageUrl: input.imageUrl,
  };

  const kakao = await sendKakaoCard({ ...feed, canvas: input.canvas, filename: input.filename });
  if (kakao.kind === "kakao") return kakao;

  const device = await shareViaDevice({
    title: input.title,
    text: input.text,
    link,
    canvas: input.canvas,
    filename: input.filename,
  });
  if (device.kind === "share") return device;

  // 마지막 안전장치 — 이미지 저장 + 글 복사. 둘 중 하나만 되어도 쓸 수 있다.
  const saved = input.canvas ? saveImage(input.canvas, input.filename || "neulbom-card.png") : false;
  const copied = await copyText(`${input.text}\n${link}`);
  if (saved) {
    return { kind: "saved", reason: kakao.reason === "ok" ? "share_absent" : kakao.reason, message: "" };
  }
  if (copied) return { kind: "copied", reason: "copy_failed", message: "" };
  return { kind: "failed", reason: "copy_failed", message: "" };
}

/* ------------------------------------------------------------------ */
/* 예전 화면과의 호환                                                   */
/* ------------------------------------------------------------------ */

export type ShareResult = "kakao" | "share" | "downloaded" | "failed";

/** 이미지 + 글을 카카오톡/공유시트/다운로드 순서로 보낸다 */
export async function shareCard(opts: {
  canvas: HTMLCanvasElement;
  filename: string;
  title: string;
  description: string;
  text: string;
}): Promise<ShareResult> {
  const outcome = await smartShare(opts);
  return outcome.kind === "kakao" ? "kakao" : outcome.kind === "share" ? "share" : outcome.kind === "failed" ? "failed" : "downloaded";
}

export async function shareLink(opts: {
  title: string;
  description: string;
  url: string;
  buttonTitle?: string;
  imageUrl?: string;
}): Promise<ShareResult> {
  const outcome = await smartShare({
    title: opts.title,
    description: opts.description,
    link: opts.url,
    buttonTitle: opts.buttonTitle,
    text: `${opts.title}\n${opts.description}`,
    imageUrl: opts.imageUrl,
  });
  return outcome.kind === "kakao" ? "kakao" : outcome.kind === "share" ? "share" : outcome.kind === "failed" ? "failed" : "downloaded";
}

export async function shareText(opts: { title: string; text: string }): Promise<ShareResult> {
  const url = typeof window !== "undefined" ? window.location.href : "";
  const outcome = await shareViaDevice({ title: opts.title, text: opts.text, link: url });
  if (outcome.kind === "share") return "share";
  const copied = await copyText(`${opts.text}\n${url}`);
  return copied ? "downloaded" : "failed";
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
