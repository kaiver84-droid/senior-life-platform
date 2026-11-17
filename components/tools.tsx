"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { GUIDES, type Guide } from "@/lib/guides";
import { useApp } from "@/lib/storage";
import { Badge, BigButton, Card, PillTabs, Portal, ProgressDots, SectionTitle, Sheet } from "./ui";
import { IconBulb, IconCamera, IconChevron, IconClose, IconMinus, IconPlus, IconSun, IconTools } from "./icons";

type Segment = "magnifier" | "flash" | "guide";

const SEGMENTS: { key: Segment; label: string; emoji: string }[] = [
  { key: "magnifier", label: "돋보기", emoji: "🔍" },
  { key: "flash", label: "손전등", emoji: "💡" },
  { key: "guide", label: "가이드", emoji: "📖" },
];

export function ToolsTab() {
  const { setFontSize, state } = useApp();
  const [segment, setSegment] = useState<Segment>("magnifier");
  const [zoom, setZoom] = useState(2);
  const [magnifier, setMagnifier] = useState(false);
  const [flash, setFlash] = useState(false);
  const [guide, setGuide] = useState<Guide | null>(null);

  return (
    <div className="space-y-4">
      <section className="fade-up pt-1">
        <p className="text-[0.86rem] font-extrabold tracking-tight text-brand-dark/80">생활 속 스마트 도구</p>
        <h1 className="mt-0.5 text-[1.5rem] font-black leading-tight text-ink">크게 보고, 환하게 비춰요</h1>
        <p className="mt-1 text-[0.88rem] font-semibold text-ink/55">돋보기 · 손전등 · 1분 카드뉴스</p>
      </section>

      <PillTabs tabs={SEGMENTS} value={segment} onChange={setSegment} />

      {segment === "magnifier" ? (
        <>
          <div className="fade-up overflow-hidden rounded-[1.7rem] bg-white shadow-card">
            <div className="relative h-[210px] overflow-hidden bg-gradient-to-br from-[#FFF3D6] via-[#FFF9EC] to-[#E7F4F2]">
              <div className="absolute inset-0 opacity-70">
                <div className="absolute -left-6 top-6 h-24 w-24 rounded-full bg-[#F7C346]/40 blur-2xl" />
                <div className="absolute right-2 top-2 h-20 w-20 rounded-full bg-brand/25 blur-2xl" />
                <div className="absolute bottom-4 left-10 h-16 w-16 rounded-full bg-[#F2708A]/25 blur-2xl" />
              </div>
              <div
                className="relative flex h-full flex-col items-center justify-center gap-1 transition-transform duration-200"
                style={{ transform: `scale(${1 + (zoom - 1) * 0.08})` }}
              >
                <p className="hand text-[2.1rem] leading-tight text-ink">행복한 오늘 되세요!</p>
                <p className="text-[0.86rem] font-bold text-ink/50">약봉투 · 글씨 · 유통기한을 크게</p>
                <span className="mt-1 rounded-full bg-white/80 px-3 py-1 text-[0.8rem] font-black text-brand-dark shadow-soft">
                  지금 {zoom.toFixed(1)}배
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 px-4 py-4">
              <button
                onClick={() => setZoom((z) => Math.max(1, Number((z - 0.5).toFixed(1))))}
                aria-label="확대 줄이기"
                className="grid h-16 w-16 place-items-center rounded-2xl bg-paper text-ink shadow-soft active:scale-95"
              >
                <IconMinus size={30} />
              </button>
              <div className="min-w-[86px] text-center">
                <p className="tabular text-[1.5rem] font-black leading-none text-ink">{zoom.toFixed(1)}배</p>
                <p className="mt-1 text-[0.74rem] font-bold text-ink/40">확대 배율</p>
              </div>
              <button
                onClick={() => setZoom((z) => Math.min(4, Number((z + 0.5).toFixed(1))))}
                aria-label="확대 키우기"
                className="grid h-16 w-16 place-items-center rounded-2xl bg-ink text-white shadow-cta active:scale-95"
              >
                <IconPlus size={30} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
              <BigButton variant="teal" onClick={() => setMagnifier(true)} className="whitespace-nowrap text-[0.98rem]">
                <IconCamera size={20} /> 돋보기 켜기
              </BigButton>
              <BigButton variant="sun" onClick={() => setFlash(true)} className="whitespace-nowrap text-[0.98rem]">
                <IconBulb size={20} /> 불 켜기
              </BigButton>
            </div>
          </div>

          <Card className="fade-up p-4">
            <SectionTitle right={<Badge tone="brand">가 · 가 · 가</Badge>}>글씨 크기</SectionTitle>
            <p className="text-[0.9rem] font-semibold text-ink/55">앱 전체 글씨를 크게 키울 수 있어요.</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {([18, 21, 24] as const).map((size, i) => (
                <button
                  key={size}
                  onClick={() => setFontSize(size)}
                  aria-pressed={state.fontSize === size}
                  className={`min-h-[54px] rounded-2xl border-2 text-[0.9rem] font-extrabold ${
                    state.fontSize === size
                      ? "border-brand bg-brand text-white"
                      : "border-ink/10 bg-paper text-ink/70"
                  }`}
                >
                  {["보통", "크게", "아주 크게"][i]}
                </button>
              ))}
            </div>
          </Card>
        </>
      ) : null}

      {segment === "flash" ? (
        <div className="fade-up overflow-hidden rounded-[1.7rem] bg-gradient-to-br from-[#FFF6DA] to-[#FFFDF4] p-5 shadow-card">
          <div className="flex flex-col items-center py-4">
            <span className="floaty grid h-28 w-28 place-items-center rounded-full bg-white text-[#F5B82E] shadow-sun">
              <IconSun size={62} />
            </span>
            <p className="mt-4 text-[1.2rem] font-black text-ink">화면을 가장 밝게</p>
            <p className="mt-1 text-center text-[0.92rem] font-semibold leading-relaxed text-ink/60">
              어두운 곳에서 글씨나 물건을 비춰 볼 수 있어요.
              <br />
              화면을 한 번 누르면 꺼져요.
            </p>
          </div>
          <BigButton variant="sun" size="lg" full onClick={() => setFlash(true)}>
            <IconBulb size={22} /> 손전등 켜기
          </BigButton>
        </div>
      ) : null}

      {segment === "guide" ? (
        <section className="fade-up">
          <SectionTitle emoji="📖" right={<Badge tone="gray">1분이면 충분해요</Badge>}>
            1분 카드뉴스
          </SectionTitle>
          <div className="space-y-2">
            {GUIDES.map((g) => (
              <button
                key={g.id}
                onClick={() => setGuide(g)}
                className="card flex w-full items-center gap-3 p-3.5 text-left active:scale-[0.99]"
              >
                <span
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-[1rem] text-[1.45rem]"
                  style={{ background: `${g.color}1F` }}
                >
                  {g.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[1rem] font-black leading-snug text-ink">{g.title}</span>
                  <span className="block truncate text-[0.84rem] font-semibold text-ink/50">{g.subtitle}</span>
                </span>
                <IconChevron size={20} className="shrink-0 text-ink/25" />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {magnifier ? (
        <MagnifierOverlay
          initialZoom={zoom}
          onClose={() => setMagnifier(false)}
          onFontSize={() => setFontSize(24)}
        />
      ) : null}
      {flash ? <FlashOverlay onClose={() => setFlash(false)} /> : null}
      <GuideSheet guide={guide} onClose={() => setGuide(null)} />
    </div>
  );
}

/* ---------------------------------------------------------------- */

function MagnifierOverlay({
  initialZoom,
  onClose,
  onFontSize,
}: {
  initialZoom: number;
  onClose: () => void;
  onFontSize: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [zoom, setZoom] = useState(initialZoom);
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
    <Portal>
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
              <p className="text-[0.96rem] font-semibold leading-relaxed text-white/75">
                대신 앱 글씨를 &lsquo;아주 크게&rsquo;로 바꾸고,
                <br />
                휴대폰 설정에서 화면 확대(손쉬운 사용 → 확대/돋보기)를 켜면
                <br />
                카메라 없이도 크게 볼 수 있어요.
              </p>
              <div className="mt-2 grid w-full max-w-[320px] grid-cols-1 gap-2">
                <button
                  onClick={onFontSize}
                  className="min-h-[56px] rounded-2xl bg-white text-[1.02rem] font-black text-ink"
                >
                  앱 글씨 아주 크게
                </button>
                <button
                  onClick={onClose}
                  className="min-h-[56px] rounded-2xl border-2 border-white/40 text-[1.02rem] font-black text-white"
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
            <span className="text-[0.82rem] font-semibold text-white/60">가까이 대고 글씨에 맞춰 주세요</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setZoom((z) => Math.max(1, Number((z - 0.5).toFixed(1))))}
              aria-label="확대 줄이기"
              className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/12 text-white active:bg-white/20"
            >
              <IconMinus size={26} />
            </button>
            <input
              type="range"
              min={1}
              max={4}
              step={0.5}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              aria-label="확대 배율"
              className="h-3 flex-1 accent-[#7CC4FF]"
            />
            <button
              onClick={() => setZoom((z) => Math.min(4, Number((z + 0.5).toFixed(1))))}
              aria-label="확대 키우기"
              className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/12 text-white active:bg-white/20"
            >
              <IconPlus size={26} />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2">
            <button
              onClick={toggleTorch}
              disabled={!torchSupported}
              className={`min-h-[54px] rounded-2xl text-[1rem] font-black ${
                torch ? "bg-[#FFE9A8] text-[#5B4200]" : "bg-white/12 text-white"
              } ${!torchSupported ? "opacity-40" : ""}`}
            >
              💡 {torchSupported ? (torch ? "불 켜짐" : "손전등 켜기") : "손전등을 쓸 수 없어요"}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

function FlashOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => {
      void lock?.release().catch(() => {});
    };
  }, []);

  return (
    <Portal>
      <div className="fixed inset-0 z-[95] bg-white">
        <button
          onClick={onClose}
          className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white px-6 text-center"
          aria-label="화면 밝게 보기 끄기"
        >
          <span className="floaty grid h-24 w-24 place-items-center rounded-full bg-sun-light text-[#F5B82E]">
            <IconSun size={56} />
          </span>
          <p className="text-[1.15rem] font-black text-ink">화면을 가장 밝게 켰어요</p>
          <p className="text-[0.96rem] font-semibold leading-relaxed text-ink/60">
            글씨나 물건을 비춰 보세요.
            <br />
            화면을 한 번 누르면 꺼져요.
          </p>
          <div className="mt-4 h-20 w-20 rounded-full border-4 border-ink/12" />
        </button>
        {/* 화면 어디를 눌러도 꺼지지만, 눈에 보이는 ‘✕ 닫기’도 함께 둔다 */}
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-3 top-[calc(env(safe-area-inset-top,0px)+12px)] flex min-h-[48px] items-center gap-1.5 rounded-full border-2 border-ink/12 bg-white px-4 text-[0.95rem] font-extrabold text-ink/70 shadow-soft active:bg-paper"
        >
          <IconClose size={20} /> 닫기
        </button>
      </div>
    </Portal>
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
      <div className="fade-up rounded-[1.5rem] bg-white p-5 shadow-soft">
        <div className="text-center text-[2.6rem]">{slide.emoji}</div>
        <h4 className="mt-2 text-center text-[1.2rem] font-black leading-snug">{slide.title}</h4>
        <p className="mt-3 whitespace-pre-line text-center text-[1rem] font-semibold leading-relaxed text-ink/75">
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
        <BigButton variant={last ? "teal" : "ink"} onClick={() => (last ? onClose() : setI((v) => v + 1))}>
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
