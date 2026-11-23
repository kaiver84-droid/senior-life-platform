"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ShareCardInput, ShareCardKind } from "@/lib/canvas";
import { renderFramedShareCard, renderShareCard } from "@/lib/canvas";
import { cardImageFor, preparedCardLink, scheduleCardUpload } from "@/lib/card-share";
import { situationForCardKind, type CardImageKind } from "@/lib/og";
import {
  isKakaoInAppBrowser,
  kakaoConfig,
  kakaoSendNow,
  loadKakaoSdk,
  shareOutcomeMessage,
  smartShare,
  type ShareReason,
} from "@/lib/share";
import { Badge, BigButton, Sheet, useToast } from "./ui";
import { IconClose } from "./icons";
import { useApp } from "@/lib/storage";
import { withInviteRef } from "@/lib/groups";

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
  /** 이미지 종류 — 비우면 카드 종류(kind)로 정한다 */
  cardKind?: CardImageKind;
  filename: string;
  sheetTitle?: string;
  sheetSubtitle?: string;
};

/** 실패 이유별로 “그래서 지금 어떻게 하면 되는지”를 큰 글씨로 알려 준다 */
function hintFor(reason: ShareReason, outcomeKind: string): string {
  if (outcomeKind === "kakao") return "카카오톡이 열렸어요. 보낼 사람(단톡방)을 골라 주세요.";
  if (outcomeKind === "share") return "휴대폰 공유창이 열렸어요. 목록에서 카카오톡을 골라 주세요.";
  if (outcomeKind === "saved") return "카드 사진과 글을 준비했어요. 카카오톡 대화창에서 붙여넣어 보내 주세요.";
  if (outcomeKind === "copied") return "링크와 글을 복사했어요. 카카오톡 대화창에 붙여넣어 보내세요.";
  switch (reason) {
    case "domain_not_registered":
      return "카카오톡 공유 카드가 이 주소에서는 아직 열리지 않아요. 아래 버튼을 누르면 사진·글을 준비해 드려요.";
    case "sdk_absent":
      return "카카오톡 공유 카드가 준비 중이에요. 아래 버튼을 누르면 보낼 사진과 글을 대신 준비해 드려요.";
    case "inapp_browser":
      return "카카오톡 안에서 열린 화면이라 공유창이 막힐 수 있어요. 아래 버튼을 누르면 사진·글을 준비해 드려요.";
    case "share_absent":
      return "이 브라우저에서는 공유창이 열리지 않아요. 아래 버튼을 누르면 사진과 글을 대신 준비해 드려요.";
    default:
      return "공유가 막혔어요. 아래 버튼을 다시 누르면 사진과 글을 준비해 드려요.";
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
  const { profile } = useApp();
  const viewerId = profile?.id || "";
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [busy, setBusy] = useState<"kakao" | null>(null);
  const [hint, setHint] = useState<string>("");
  const sent = useRef(false);
  const inApp = typeof navigator !== "undefined" ? isKakaoInAppBrowser() : false;

  /** 이 시트가 보내는 카드의 종류 — 올려 둔 ‘진짜 카드’와 상황별 기본 카드를 고르는 데 쓴다 */
  const cardKind: CardImageKind = data.cardKind || (kindToCardKind(data.kind) as CardImageKind);
  const situation = situationForCardKind(data.kind);

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
    let base = data.link || window.location.origin;
    // 올려 둔 내 카드가 있으면 주소에도 표시를 남긴다 — 링크를 그대로 붙여 넣어도 그 카드가 뜬다.
    const card = preparedCardLink(cardKind);
    if (card) {
      const sep = base.includes("?") ? "&" : "?";
      base = `${base}${sep}card=${card.kind}&h=${card.hash}`;
    }
    // 공유 링크에도 `ref=<내 id>` 를 붙인다 — 이 링크로 가입한 사람이 ‘초대왕’ 순위에 잡힌다.
    return withInviteRef(base, viewerId);
  }, [data.link, viewerId, cardKind]);

  /**
   * 보내기 — **클릭과 같은 콜스택에서** Kakao.Share.sendDefault 를 동기로 부른다.
   * iOS Safari·SFSafariViewController 는 클릭 직후 동기 실행이 끊기면 kakaolink:// 전환을 막고,
   * 그 전에는 installTalk: true 라 talk-apps.kakao.com '다운로드' 화면으로 튕겼다.
   */
  const runKakao = useCallback(() => {
    if (sent.current) return;
    const canvas = canvasRef.current ?? undefined;
    const feed = {
      title: data.title || data.headline,
      description: data.description || data.sub || data.message || "",
      link: link(),
      buttonTitle: data.buttonTitle || "늘봄 열기",
      // 클릭과 같은 순간에 **이미 올려 둔 카드 주소**를 넘긴다(없으면 그 상황의 기본 카드).
      // 여기서 await 하지 않는다 — iOS 사파리는 클릭 직후 동기 호출만 카톡으로 넘겨 준다.
      imageUrl: cardImageFor(cardKind, situation),
    };

    // 1) SDK 가 준비돼 있으면 즉시(동기) 전송 — 여기서 await 하지 않는 것이 핵심
    const immediate = kakaoSendNow(feed, (failed) => {
      // 카카오가 나중에 거부한 경우(도메인 미등록 등) — 실패를 조용히 삼키지 않는다
      setHint(hintFor(failed.reason, failed.kind));
      show(shareOutcomeMessage(failed));
    });
    if (immediate?.kind === "kakao") {
      sent.current = true;
      setHint(hintFor(immediate.reason, immediate.kind));
      show(shareOutcomeMessage(immediate));
      onClose();
      return;
    }

    // 2) SDK 미준비이거나 카카오가 바로 거부 → 공유창 · 이미지 저장 + 글 복사로 이어진다
    sent.current = true;
    setBusy("kakao");
    void (async () => {
      const outcome = await smartShare({
        ...feed,
        text: data.text,
        canvas,
        filename: data.filename,
      });
      setBusy(null);
      setHint(hintFor(outcome.reason, outcome.kind));
      show(shareOutcomeMessage(outcome));
      onClose();
    })();
  }, [data, link, onClose, show]);

  // 시트를 여는 순간 SDK 를 미리 불러 둔다 — 버튼을 누를 때는 이미 준비돼 있어야
  // 클릭과 같은 작업 안에서 동기로 보낼 수 있다.
  useEffect(() => {
    if (!open) return;
    sent.current = false;
    if (!kakaoConfig().configured) return;
    void loadKakaoSdk();
  }, [open]);

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
      hideBottomClose
      footer={
        <div data-share-close>
          <BigButton variant="white" full onClick={onClose} height={56} className="rounded-[1.1rem]">
            <IconClose size={20} /> 닫기
          </BigButton>
        </div>
      }
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
                  <ShareCardPreview canvasRef={canvasRef} card={card} sourceCanvas={sourceCanvas} cardKind={cardKind} />
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

        {/* 보내기 — 이 버튼 하나만 눈에 들어오게 하고, 바로 아래에 큰 닫기 버튼 */}
        <div className="space-y-2">
          <div data-share-kakao>
            <BigButton
              variant="sun"
              size="lg"
              full
              onClick={runKakao}
              disabled={busy === "kakao"}
              height={76}
              className="rounded-[1.3rem] !text-[1.16rem]"
            >
              <span aria-hidden className="text-[1.35rem] leading-none">
                💬
              </span>
              카카오톡으로 바로 보내기
            </BigButton>
          </div>
        </div>

        <div className="rounded-2xl bg-white px-3.5 py-3 shadow-soft">
          <p className="flex items-center gap-1.5 text-[0.78rem] font-extrabold text-ink/60">
            <Badge tone="brand">TIP</Badge> 보내는 순서
          </p>
          <p className="mt-1 text-[0.8rem] font-semibold leading-relaxed text-ink/55">
            ‘카카오톡으로 바로 보내기’를 누르면 카카오톡이 열려요. 보낼 사람(단톡방)을 고르면 돼요.
            <br />
            카카오톡이 열리지 않으면 사진과 글을 대신 준비해 드려요. 피클·카톡 안에서 연 화면에서는 앱 이동이
            막힐 수 있으니, 그럴 때는 사파리로 열거나 저장한 사진을 대화창에 붙여넣어 주세요.
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
  cardKind,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  card: ShareCardInput;
  sourceCanvas?: React.RefObject<HTMLCanvasElement | null>;
  cardKind: CardImageKind;
}) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let alive = true;
    const src = sourceCanvas?.current;
    const drawn =
      src && src.width > 0
        ? renderFramedShareCard(canvas, card, src).catch(() => {})
        : renderShareCard(canvas, card).catch(() => {});
    // 카드가 그려지면 조용히 올려 둔다 — [카톡으로 보내기] 때는 이미 주소가 준비돼 있다.
    void drawn.then(() => {
      if (alive) scheduleCardUpload(canvas, cardKind);
    });
    return () => {
      alive = false;
    };
  }, [canvasRef, card, sourceCanvas, cardKind]);
  return <canvas ref={canvasRef} className="block w-full" style={{ aspectRatio: "1200 / 630" }} />;
}

/** 앱의 카드 종류 → 올려 둘 카드 종류 */
function kindToCardKind(kind: ShareCardKind) {
  switch (kind) {
    case "quiz":
      return "quiz";
    case "invite":
      return "group";
    case "health":
      return "welfare";
    default:
      return "greeting";
  }
}
