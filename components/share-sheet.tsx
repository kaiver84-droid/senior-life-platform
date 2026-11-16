"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ShareCardInput, ShareCardKind } from "@/lib/canvas";
import { renderShareCard } from "@/lib/canvas";
import {
  copyText,
  isKakaoInAppBrowser,
  kakaoConfig,
  saveImage,
  shareOutcomeMessage,
  shareViaDevice,
  smartShare,
  type ShareReason,
} from "@/lib/share";
import { Badge, BigButton, Sheet, useToast } from "./ui";
import { IconChevron, IconDownload, IconShare } from "./icons";

export type ShareSheetData = {
  /** 공유 카드 종류 — 색과 장식이 달라진다 */
  kind: ShareCardKind;
  badge: string;
  emoji: string;
  headline: string;
  sub?: string;
  message?: string;
  stats?: { label: string; value: string }[];
  name?: string;
  dateLabel?: string;
  /** 카카오 피드의 제목·설명 (비우면 headline·sub) */
  title?: string;
  description?: string;
  buttonTitle?: string;
  /** 카톡 대화창에 함께 붙는 글 */
  text: string;
  /** 공유할 링크 (모임 초대·퀴즈 결과). 비우면 현재 주소 */
  link?: string;
  filename: string;
  sheetTitle?: string;
  sheetSubtitle?: string;
};

/** 실패 이유별로 “그래서 지금 어떻게 하면 되는지”를 큰 글씨로 알려 준다 */
function hintFor(reason: ShareReason, outcomeKind: string): string {
  if (outcomeKind === "kakao") return "카카오톡이 열렸어요. 보낼 사람(단톡방)을 골라 주세요.";
  if (outcomeKind === "share") return "휴대폰 공유창이 열렸어요. 목록에서 카카오톡을 골라 주세요.";
  if (outcomeKind === "saved") return "이미지를 저장하고 글을 복사했어요. 카카오톡 대화창에 붙여넣어 보내세요.";
  if (outcomeKind === "copied") return "링크와 글을 복사했어요. 카카오톡 대화창에 붙여넣어 보내세요.";
  switch (reason) {
    case "domain_not_registered":
      return "카카오톡 공유 카드가 이 주소에서 아직 열리지 않아요(도메인 미등록). 아래 ‘휴대폰 공유창’이나 ‘링크 복사’를 쓰면 카카오톡에 그대로 보낼 수 있어요.";
    case "sdk_absent":
      return "카카오 앱 키가 없어서 공유 카드 대신 공유창으로 보내요. ‘휴대폰 공유창’을 누르면 카카오톡이 목록에 나와요.";
    case "inapp_browser":
      return "카카오톡 안에서 열린 화면이라 공유창이 막힐 수 있어요. ‘이미지 저장’ 뒤 카카오톡 대화창에서 사진을 골라 보내 주세요.";
    case "share_absent":
      return "이 브라우저에서는 공유창이 열리지 않아요. ‘이미지 저장’과 ‘링크 복사’로 보내 주세요.";
    default:
      return "공유가 막혔어요. ‘이미지 저장’을 누른 뒤 카카오톡에서 사진을 골라 보내 주세요.";
  }
}

/**
 * 카카오톡 공유 미리보기 시트.
 * - 단톡방에서 어떻게 보일지 그대로 보여 주고(카드 미리보기 + 말풍선)
 * - 카카오톡 → 휴대폰 공유창 → 이미지 저장/링크 복사 순서로 어디서든 끝나게 한다.
 */
export function SharePreviewSheet({
  open,
  onClose,
  data,
  sourceCanvas,
}: {
  open: boolean;
  onClose: () => void;
  data: ShareSheetData;
  /** 이미 만들어 둔 카드(상장·인사카드)를 그대로 넣고 싶을 때 */
  sourceCanvas?: React.RefObject<HTMLCanvasElement | null>;
}) {
  const { show } = useToast();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [busy, setBusy] = useState<"kakao" | "device" | "save" | "copy" | null>(null);
  const [hint, setHint] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const inApp = typeof navigator !== "undefined" ? isKakaoInAppBrowser() : false;

  const card = useMemo<ShareCardInput>(
    () => ({
      kind: data.kind,
      badge: data.badge,
      emoji: data.emoji,
      headline: data.headline,
      sub: data.sub,
      message: data.message,
      stats: data.stats,
      name: data.name,
      dateLabel: data.dateLabel,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.kind, data.badge, data.emoji, data.headline, data.sub, data.message, data.name, data.dateLabel, JSON.stringify(data.stats)]
  );

  const link = useCallback(() => {
    if (typeof window === "undefined") return "";
    return data.link || window.location.origin;
  }, [data.link]);

  const runKakao = useCallback(async () => {
    if (busy) return;
    setBusy("kakao");
    const canvas = canvasRef.current ?? undefined;
    const outcome = await smartShare({
      title: data.title || data.headline,
      description: data.description || data.sub || data.message || "",
      link: link(),
      buttonTitle: data.buttonTitle || "늘봄 열기",
      text: data.text,
      canvas,
      filename: data.filename,
    });
    setBusy(null);
    setHint(hintFor(outcome.reason, outcome.kind));
    show(shareOutcomeMessage(outcome));
  }, [busy, data, link, show]);

  const runDevice = useCallback(async () => {
    if (busy) return;
    setBusy("device");
    const outcome = await shareViaDevice({
      title: data.title || data.headline,
      text: data.text,
      link: link(),
      canvas: canvasRef.current ?? undefined,
      filename: data.filename,
    });
    setBusy(null);
    setHint(hintFor(outcome.reason, outcome.kind));
    show(shareOutcomeMessage(outcome));
  }, [busy, data, link, show]);

  const runSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      show("카드를 아직 그리고 있어요. 잠시 뒤 다시 눌러 주세요.");
      return;
    }
    const ok = saveImage(canvas, data.filename);
    setHint(
      ok
        ? "이미지를 저장했어요. 사진첩에서 카카오톡으로 보낼 수 있어요."
        : "이미지를 저장하지 못했어요. 화면을 길게 눌러 저장해 보세요."
    );
    show(ok ? "카드 이미지를 저장했어요." : "저장하지 못했어요. 다시 눌러 주세요.");
  }, [data.filename, show]);

  const runCopy = useCallback(async () => {
    const ok = await copyText(`${data.text}\n${link()}`);
    setCopied(ok);
    setHint(
      ok
        ? "링크와 글을 복사했어요. 카카오톡 대화창에 붙여넣어 보내세요."
        : "복사하지 못했어요. 아래 링크를 길게 눌러 복사해 주세요."
    );
    show(ok ? "복사했어요!" : "복사하지 못했어요.");
  }, [data.text, link, show]);

  useEffect(() => {
    if (!open) return;
    setHint(
      inApp
        ? hintFor("inapp_browser", "")
        : kakaoConfig().configured
          ? "카카오톡으로 보내면 단톡방에 카드가 그대로 뜹니다."
          : hintFor("sdk_absent", "")
    );
  }, [open, inApp]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={data.sheetTitle || "카카오톡으로 보내기"}
      subtitle={data.sheetSubtitle || "단톡방에 이렇게 보여요"}
    >
      <div data-share-sheet className="space-y-3">
        {/* 카카오톡 대화방 미리보기 */}
        <div className="overflow-hidden rounded-[1.4rem] bg-[#B2C7DA] shadow-soft">
          <div className="flex items-center justify-between bg-[#A3B8CB] px-4 py-2">
            <p className="text-[0.82rem] font-extrabold text-white/90">가족 단톡방</p>
            <p className="text-[0.72rem] font-bold text-white/70">미리보기</p>
          </div>

          <div className="space-y-2.5 px-3 py-3">
            {/* 내가 보낸 말풍선 */}
            <div className="flex justify-end">
              <div className="max-w-[78%] rounded-2xl rounded-tr-md bg-[#FEE500] px-3.5 py-2.5">
                <p className="whitespace-pre-line text-[0.92rem] font-bold leading-snug text-[#3C1E1E]">
                  {data.text}
                </p>
              </div>
            </div>

            {/* 카카오 피드 카드 */}
            <div className="flex justify-start">
              <span className="mr-1.5 mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/80 text-[0.7rem] font-black text-[#3C1E1E]">
                나
              </span>
              <div data-share-preview className="w-[78%] overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="relative bg-[#F4F1EA]">
                  <ShareCardPreview canvasRef={canvasRef} card={card} sourceCanvas={sourceCanvas} />
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-black/45 px-2 py-0.5 text-[0.58rem] font-bold text-white">
                    늘봄
                  </span>
                </div>
                <div className="px-3 py-2.5">
                  <p className="line-clamp-2 text-[0.92rem] font-black leading-snug text-ink">
                    {data.title || data.headline}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[0.78rem] font-semibold leading-snug text-ink/55">
                    {data.description || data.sub || data.message}
                  </p>
                  <p className="mt-1 truncate text-[0.68rem] font-semibold text-ink/35">{link()}</p>
                  <div className="mt-2 border-t border-ink/8 pt-2 text-center text-[0.82rem] font-extrabold text-ink/75">
                    {data.buttonTitle || "늘봄 열기"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 안내 */}
        <p
          data-share-hint
          className={`rounded-2xl px-3.5 py-2.5 text-[0.82rem] font-semibold leading-relaxed ${
            hint.includes("막혔") || hint.includes("미등록") || hint.includes("막")
              ? "bg-coral-light text-coral-dark"
              : "bg-sky text-ink/65"
          }`}
        >
          {hint}
        </p>

        {/* 보내기 버튼 */}
        <div className="space-y-2">
          <div data-share-kakao>
            <BigButton variant="sun" size="lg" full onClick={() => void runKakao()} disabled={busy === "kakao"}>
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[#FEE500] text-[0.58rem] font-black text-[#3C1E1E]">
                TALK
              </span>
              카카오톡으로 보내기
            </BigButton>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div data-share-device>
              <BigButton variant="white" full onClick={() => void runDevice()} disabled={busy === "device"}>
                <IconShare size={20} /> 휴대폰 공유창
              </BigButton>
            </div>
            <div data-share-save>
              <BigButton variant="white" full onClick={runSave}>
                <IconDownload size={20} /> 이미지 저장
              </BigButton>
            </div>
          </div>
          <button
            type="button"
            data-share-copy
            onClick={() => void runCopy()}
            className="flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-full border-2 border-ink/10 bg-paper text-[0.9rem] font-extrabold text-ink/70"
          >
            {copied ? "복사했어요!" : "링크 · 글 복사"} <IconChevron size={16} />
          </button>
        </div>

        <div className="rounded-2xl bg-white px-3.5 py-3 shadow-soft">
          <p className="flex items-center gap-1.5 text-[0.78rem] font-extrabold text-ink/60">
            <Badge tone="brand">TIP</Badge> 보내는 순서
          </p>
          <p className="mt-1 text-[0.8rem] font-semibold leading-relaxed text-ink/55">
            카카오톡으로 보내기 → 안 되면 휴대폰 공유창 → 그래도 안 되면 이미지 저장·링크 복사 순서로
            자동으로 내려가요. 어느 길로도 가족에게는 그대로 전해져요.
          </p>
        </div>
      </div>
    </Sheet>
  );
}

/**
 * 시트가 열린 뒤(=포털 마운트 뒤) 고화질 카드를 그린다.
 * 이미 만든 카드(sourceCanvas)가 있으면 그 카드를 오른쪽에 그대로 넣어
 * ‘내가 만든 그 카드’가 단톡방에 뜨는 것처럼 보여 준다.
 */
function ShareCardPreview({
  canvasRef,
  card,
  sourceCanvas,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  card: ShareCardInput;
  sourceCanvas?: React.RefObject<HTMLCanvasElement | null>;
}) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const src = sourceCanvas?.current;
    if (src && src.width > 0) {
      void frameWithSource(canvas, card, src).catch(() => {});
      return;
    }
    void renderShareCard(canvas, card).catch(() => {});
  }, [canvasRef, card, sourceCanvas]);
  return <canvas ref={canvasRef} className="block w-full" style={{ aspectRatio: "1200 / 630" }} />;
}

/** 1200×630 공유 카드 안에 이미 만든 카드(상장·인사카드)를 액자처럼 넣는다 */
async function frameWithSource(canvas: HTMLCanvasElement, card: ShareCardInput, src: HTMLCanvasElement) {
  const W = 1200;
  const H = 630;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  if (document.fonts?.ready) await document.fonts.ready;

  const PAL: Record<string, { top: string; bottom: string; accent: string }> = {
    quiz: { top: "#FFF8E3", bottom: "#FFE9AE", accent: "#8A5A0B" },
    health: { top: "#EDF9F1", bottom: "#CDEBD9", accent: "#1B6B45" },
    greeting: { top: "#FFF2F6", bottom: "#FFDCE8", accent: "#A84066" },
    invite: { top: "#EAF7F8", bottom: "#CDEDEF", accent: "#0F6F76" },
  };
  const pal = PAL[card.kind] ?? PAL.quiz;
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, pal.top);
  bg.addColorStop(1, pal.bottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.shadowColor = "rgba(20,33,58,0.20)";
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.roundRect(56, 56, W - 112, H - 112, 44);
  ctx.fill();
  ctx.restore();

  // 오른쪽 액자
  const boxW = 430;
  const boxH = 470;
  const boxX = W - 96 - boxW;
  const boxY = (H - boxH) / 2;
  const scale = Math.min(boxW / src.width, boxH / src.height);
  const dw = src.width * scale;
  const dh = src.height * scale;
  const dx = boxX + (boxW - dw) / 2;
  const dy = boxY + (boxH - dh) / 2;

  ctx.save();
  ctx.shadowColor = "rgba(20,33,58,0.22)";
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = "#FFFDF6";
  ctx.beginPath();
  ctx.roundRect(boxX - 10, boxY - 10, boxW + 20, boxH + 20, 26);
  ctx.fill();
  ctx.restore();
  ctx.drawImage(src, dx, dy, dw, dh);

  // 왼쪽 글
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const badgeText = card.badge || "늘봄";
  ctx.font = "800 26px " + FONT;
  const bw = ctx.measureText(badgeText).width + 58;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.roundRect(100, 104, bw, 54, 27);
  ctx.fill();
  ctx.fillStyle = pal.accent;
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, 129, 132);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#14213A";
  ctx.font = "900 56px " + FONT;
  let y = 262;
  wrapText(ctx, card.headline, 560).slice(0, 3).forEach((line) => {
    ctx.fillText(line, 100, y);
    y += 68;
  });

  if (card.sub) {
    ctx.fillStyle = "#4A5670";
    ctx.font = "600 30px " + FONT;
    wrapText(ctx, card.sub, 560).slice(0, 2).forEach((line) => {
      ctx.fillText(line, 100, y + 6);
      y += 42;
    });
  }
  if (card.message) {
    ctx.fillStyle = pal.accent;
    ctx.font = "800 30px " + FONT;
    wrapText(ctx, card.message, 560).slice(0, 2).forEach((line) => {
      ctx.fillText(line, 100, y + 8);
      y += 42;
    });
  }

  ctx.fillStyle = "#8A93A6";
  ctx.font = "600 26px " + FONT;
  const meta = [card.name, card.dateLabel].filter(Boolean).join(" · ");
  if (meta) ctx.fillText(meta, 100, 528);
}

const FONT = '"Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const ch of text) {
    if (ch === "\n") {
      lines.push(cur);
      cur = "";
      continue;
    }
    const test = cur + ch;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = ch;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
