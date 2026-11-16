"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { GUIDES, type Guide } from "@/lib/guides";
import { useApp } from "@/lib/storage";
import { Badge, BigButton, Card, ProgressDots, SectionTitle, Sheet } from "./ui";
import { IconBulb, IconCamera, IconChevron } from "./icons";

export function ToolsTab() {
  const { setFontSize, state } = useApp();
  const [magnifier, setMagnifier] = useState(false);
  const [flash, setFlash] = useState(false);
  const [guide, setGuide] = useState<Guide | null>(null);

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-[1.55rem] font-black leading-snug">🔍 생활 도구</h1>
        <p className="mt-1 text-[0.98rem] font-semibold text-ink/60">
          돋보기 · 손전등 · 1분 카드뉴스
        </p>
      </section>

      <Card className="fade-up">
        <div className="flex items-start gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-light text-brand">
            <IconCamera size={30} />
          </div>
          <div className="min-w-0">
            <h2 className="section-title">간편 돋보기</h2>
            <p className="mt-0.5 text-[0.95rem] font-semibold leading-snug text-ink/65">
              약봉투, 글씨, 음식 유통기한을 카메라로 크게 보세요.
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <BigButton variant="brand" onClick={() => setMagnifier(true)}>
            돋보기 켜기
          </BigButton>
          <BigButton variant="white" onClick={() => setFlash(true)}>
            <IconBulb size={20} /> 밝게 보기
          </BigButton>
        </div>
      </Card>

      <Card className="fade-up">
        <SectionTitle emoji="🔤">글씨 크기</SectionTitle>
        <p className="text-[0.95rem] font-semibold text-ink/60">앱 전체 글씨를 크게 키울 수 있어요.</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {([18, 21, 24] as const).map((size, i) => (
            <button
              key={size}
              onClick={() => setFontSize(size)}
              aria-pressed={state.fontSize === size}
              className={`min-h-[56px] rounded-2xl border-2 font-extrabold ${
                state.fontSize === size ? "border-brand bg-brand text-white" : "border-ink/12 bg-white"
              }`}
            >
              {["보통", "크게", "아주 크게"][i]}
            </button>
          ))}
        </div>
      </Card>

      <section>
        <SectionTitle emoji="📖">1분 카드뉴스</SectionTitle>
        <div className="space-y-2.5">
          {GUIDES.map((g) => (
            <button
              key={g.id}
              onClick={() => setGuide(g)}
              className="card flex w-full items-center gap-3 px-4 py-3.5 text-left"
            >
              <span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-[1.5rem]"
                style={{ background: `${g.color}1A` }}
              >
                {g.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[1.05rem] font-black leading-snug">{g.title}</span>
                <span className="block text-[0.86rem] font-semibold text-ink/55">{g.subtitle}</span>
              </span>
              <IconChevron size={22} className="shrink-0 text-ink/35" />
            </button>
          ))}
        </div>
      </section>

      {magnifier ? <MagnifierOverlay onClose={() => setMagnifier(false)} onFontSize={() => setFontSize(24)} /> : null}
      {flash ? <FlashOverlay onClose={() => setFlash(false)} /> : null}
      <GuideSheet guide={guide} onClose={() => setGuide(null)} />
    </div>
  );
}

function MagnifierOverlay({ onClose, onFontSize }: { onClose: () => void; onFontSize: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [zoom, setZoom] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const [torchSupported, setTorchSupported] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("이 브라우저에서는 카메라를 쓸 수 없어요.");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean };
        if (!caps.torch) setTorchSupported(false);
      } catch {
        setError("카메라를 켤 수 없어요. 권한을 허용했는지 확인해 주세요.");
      }
    };
    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch }] } as unknown as MediaTrackConstraints);
      setTorch((v) => !v);
    } catch {
      setTorchSupported(false);
    }
  }, [torch]);

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black">
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover transition-transform duration-150"
          style={{ transform: `scale(${zoom})` }}
        />
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#101828] px-6 text-center">
            <span className="text-[2.6rem]">🔎</span>
            <p className="text-[1.15rem] font-black text-white">{error}</p>
            <p className="text-[0.98rem] font-semibold leading-relaxed text-white/75">
              대신 앱 글씨를 &lsquo;아주 크게&rsquo;로 바꾸고,
              <br />
              휴대폰 설정에서 화면 확대(손쉬운 사용 → 확대/돋보기)를 켜면
              <br />
              카메라 없이도 크게 볼 수 있어요.
            </p>
            <div className="mt-2 grid w-full max-w-[320px] grid-cols-1 gap-2">
              <button
                onClick={onFontSize}
                className="min-h-[56px] rounded-2xl bg-white text-[1.05rem] font-black text-ink"
              >
                앱 글씨 아주 크게
              </button>
              <button
                onClick={onClose}
                className="min-h-[56px] rounded-2xl border-2 border-white/40 text-[1.05rem] font-black text-white"
              >
                닫기
              </button>
            </div>
          </div>
        ) : null}

        <button
          onClick={onClose}
          className="absolute right-3 top-[calc(env(safe-area-inset-top,0px)+12px)] grid h-12 w-12 place-items-center rounded-full bg-black/55 text-[1.2rem] font-black text-white"
          aria-label="돋보기 닫기"
        >
          ✕
        </button>
        <div className="pointer-events-none absolute inset-0 border-[3px] border-white/25" />
      </div>

      <div className="bg-[#0B1220] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-4">
        <div className="mb-2 flex items-center justify-between text-white">
          <span className="text-[0.95rem] font-extrabold">확대 {zoom.toFixed(1)}배</span>
          <span className="text-[0.85rem] font-semibold text-white/60">가까이 대고 글씨에 맞춰 주세요</span>
        </div>
        <input
          type="range"
          min={1}
          max={4}
          step={0.5}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label="확대 배율"
          className="h-3 w-full accent-[#7CC4FF]"
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={toggleTorch}
            disabled={!torchSupported}
            className={`min-h-[54px] rounded-2xl text-[1rem] font-black ${
              torch ? "bg-[#FFE9A8] text-[#5B4200]" : "bg-white/12 text-white"
            } ${!torchSupported ? "opacity-40" : ""}`}
          >
            💡 {torchSupported ? (torch ? "불 켜짐" : "불 켜기") : "불 켜기 불가"}
          </button>
          <button
            onClick={() => setZoom((z) => (z >= 4 ? 1 : z + 1))}
            className="min-h-[54px] rounded-2xl bg-white/12 text-[1rem] font-black text-white"
          >
            🔍 더 크게
          </button>
        </div>
      </div>
    </div>
  );
}

function FlashOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => {
      void lock?.release().catch(() => {});
    };
  }, []);

  return (
    <button
      onClick={onClose}
      className="fixed inset-0 z-[95] flex flex-col items-center justify-center gap-4 bg-white px-6 text-center"
      aria-label="화면 밝게 보기 끄기"
    >
      <span className="text-[2rem]">🔆</span>
      <p className="text-[1.15rem] font-black text-ink">화면을 가장 밝게 켰어요</p>
      <p className="text-[0.98rem] font-semibold text-ink/60">
        글씨나 물건을 비춰 보세요.
        <br />
        화면을 한 번 누르면 꺼져요.
      </p>
      <div className="mt-6 h-24 w-24 rounded-full border-4 border-ink/15" />
    </button>
  );
}

function GuideSheet({ guide, onClose }: { guide: Guide | null; onClose: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [guide?.id]);
  if (!guide) return null;
  const slide = guide.slides[Math.min(i, guide.slides.length - 1)];
  const last = i >= guide.slides.length - 1;

  return (
    <Sheet open={!!guide} onClose={onClose} title={`${guide.emoji} ${guide.title}`}>
      <div className="fade-up rounded-2xl bg-white p-5">
        <div className="text-center text-[2.6rem]">{slide.emoji}</div>
        <h4 className="mt-2 text-center text-[1.25rem] font-black leading-snug">{slide.title}</h4>
        <p className="mt-3 whitespace-pre-line text-center text-[1.02rem] font-semibold leading-relaxed text-ink/75">
          {slide.body}
        </p>
      </div>
      <div className="mt-3">
        <ProgressDots total={guide.slides.length} current={i} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <BigButton variant="white" onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0}>
          이전
        </BigButton>
        <BigButton
          variant={last ? "leaf" : "brand"}
          onClick={() => (last ? onClose() : setI((v) => v + 1))}
        >
          {last ? "다 봤어요" : "다음"}
        </BigButton>
      </div>
      <div className="mt-2 flex items-center justify-center gap-2">
        <Badge tone="gray">
          {i + 1} / {guide.slides.length}
        </Badge>
      </div>
    </Sheet>
  );
}
