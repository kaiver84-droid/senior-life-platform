"use client";

import React, { useMemo, useState } from "react";
import { useApp } from "@/lib/storage";
import { useGroup } from "@/lib/group-store";
import { siteOrigin } from "@/lib/groups";
import {
  HEALTH_CHALLENGES,
  HEALTH_TOTAL,
  buildGroupHealth,
  healthOf,
} from "@/lib/health";
import { koreanDate } from "@/lib/week";
import { BigButton, useToast } from "./ui";
import { IconChevron, IconShare, IconStamp } from "./icons";
import { SharePreviewSheet, type ShareSheetData } from "./share-sheet";

/**
 * 오늘의 건강생활 챌린지 — 원터치 완료 도장.
 * 홈과 우리 모임 탭에서 같은 카드를 쓴다(체크인은 한 곳에서 바뀌면 양쪽에 바로 반영).
 */
export function HealthChallengeCard({ where = "home" }: { where?: "home" | "group" }) {
  const { profile, today, state, healthToday, toggleHealth } = useApp();
  const { detail, active } = useGroup();
  const { show } = useToast();
  const [shareOpen, setShareOpen] = useState(false);

  const done = healthToday.length;
  const percent = Math.round((done / HEALTH_TOTAL) * 100);

  /** 모임원과 함께 보는 달성률 — 서버 요약이 없으면 내 기록만으로 계산 */
  const group = useMemo(() => {
    if (detail?.health) return detail.health;
    const myCode = "me";
    return buildGroupHealth([{ code: myCode, ids: healthOf(state.health, today) }], myCode);
  }, [detail?.health, state.health, today]);

  const toggle = (id: string, title: string, doneText: string) => {
    const on = toggleHealth(id);
    show(on ? `✅ ${doneText}` : `${title} 도장을 잠시 풀었어요.`);
  };

  const shareData: ShareSheetData = {
    kind: "health",
    badge: "오늘의 건강 챌린지",
    emoji: done === HEALTH_TOTAL ? "🎉" : "🌿",
    headline:
      done === HEALTH_TOTAL
        ? `${profile?.nickname || "가족"} 님, 오늘 건강 챌린지 완성!`
        : `${profile?.nickname || "가족"} 님, 오늘 ${done}/${HEALTH_TOTAL} 실천 중`,
    sub:
      done === HEALTH_TOTAL
        ? "물·걷기·스트레칭·약·안부까지, 오늘 하루를 잘 챙기셨어요."
        : "작은 실천이 쌓여 건강한 한 달이 돼요.",
    message: active ? `${active.name}에서 ${group.joined}/${group.memberCount}명이 함께하고 있어요.` : undefined,
    stats: active
      ? [
          { value: `${done}/${HEALTH_TOTAL}`, label: "내 실천" },
          { value: `${group.joined}명`, label: "모임 참여" },
          { value: `${group.rate}%`, label: "모임 달성률" },
        ]
      : [{ value: `${done}/${HEALTH_TOTAL}`, label: "오늘의 실천" }],
    name: profile?.nickname,
    dateLabel: koreanDate(today),
    title: `${profile?.nickname || "가족"} 님의 오늘 건강 챌린지 ${done}/${HEALTH_TOTAL}`,
    description: "물 마시기·15분 걷기·스트레칭·복약·가족 안부 — 늘봄에서 함께 챙겨요.",
    buttonTitle: "나도 오늘부터",
    text:
      done === HEALTH_TOTAL
        ? `오늘 건강 챌린지 5개 모두 완료했어요! 💪 (늘봄)`
        : `오늘 건강 챌린지 ${done}/${HEALTH_TOTAL} 실천 중이에요. 함께해요! (늘봄)`,
    link: siteOrigin(),
    filename: `건강챌린지_${profile?.nickname || "늘봄"}_${today}.png`,
    sheetTitle: "건강 챌린지 자랑하기",
    sheetSubtitle: "가족 단톡방에 오늘의 실천을 알려 보세요",
  };

  return (
    <>
      <section
        data-health-card
        className="fade-up overflow-hidden rounded-[1.5rem] bg-white p-4 shadow-soft"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[1.02rem] font-black text-ink">
              <span aria-hidden className="text-[1.1rem]">🌿</span>
              오늘의 건강 챌린지
            </p>
            <p className="mt-0.5 text-[0.82rem] font-semibold text-ink/50">
              눌러서 완료 도장을 찍어 보세요
            </p>
          </div>
          <span
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-[0.86rem] font-black ${
              done === HEALTH_TOTAL ? "bg-leaf text-white" : "bg-leaf-light text-leaf-dark"
            }`}
            aria-label={`오늘 ${done}/${HEALTH_TOTAL} 완료`}
          >
            {done}/{HEALTH_TOTAL}
          </span>
        </div>

        {/* 진행 막대 */}
        <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-ink/8">
          <div
            className="h-full rounded-full bg-gradient-to-r from-leaf to-brand transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="mt-3 space-y-1.5">
          {HEALTH_CHALLENGES.map((c) => {
            const on = healthToday.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                data-health-item={c.id}
                aria-pressed={on}
                onClick={() => toggle(c.id, c.title, c.done)}
                className={`flex min-h-[58px] w-full items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left transition active:scale-[0.995] ${
                  on ? "border-leaf bg-leaf-light" : "border-ink/8 bg-paper"
                }`}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[1.2rem] shadow-soft">
                  {c.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[1rem] font-black leading-tight ${on ? "text-leaf-dark" : "text-ink"}`}>
                    {c.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[0.78rem] font-semibold text-ink/45">{c.desc}</span>
                </span>
                <span
                  data-health-done={on ? "1" : "0"}
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[0.92rem] font-black ${
                    on ? "bg-leaf text-white" : "border-2 border-dashed border-ink/15 text-ink/25"
                  }`}
                >
                  {on ? <IconStamp size={18} /> : "○"}
                </span>
              </button>
            );
          })}
        </div>

        {/* 우리 모임과 함께 */}
        <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl bg-sky px-3.5 py-2.5">
          <p className="min-w-0 text-[0.84rem] font-bold leading-snug text-ink/70">
            {active ? (
              <>
                <span className="font-black text-brand-dark">{active.name}</span>에서{" "}
                <span className="tabular font-black text-brand-deep">
                  {group.joined}/{group.memberCount}명
                </span>{" "}
                함께했어요
              </>
            ) : (
              "모임에 들어가면 가족과 함께 달성률을 볼 수 있어요"
            )}
          </p>
          {active ? (
            <span className="tabular shrink-0 text-[0.86rem] font-black text-brand-dark">{group.rate}%</span>
          ) : null}
        </div>

        {done === HEALTH_TOTAL ? (
          <div className="pop mt-2.5 rounded-2xl bg-gradient-to-br from-leaf-light to-[#DDF1E6] px-3.5 py-3 text-center">
            <p className="text-[0.98rem] font-black text-leaf-dark">🎉 오늘의 건강 챌린지 완성!</p>
            <p className="mt-0.5 text-[0.8rem] font-semibold text-leaf-dark/80">
              5가지를 모두 실천하셨어요. 내일도 이어 가요.
            </p>
          </div>
        ) : null}

        <div className={where === "home" ? "mt-3 grid grid-cols-1" : "mt-3 grid grid-cols-2 gap-2"}>
          <BigButton variant="leaf" full onClick={() => setShareOpen(true)}>
            <IconShare size={20} /> 건강 기록 자랑하기
          </BigButton>
          {where === "group" ? (
            <BigButton variant="white" full onClick={() => setShareOpen(true)}>
              모임에 알리기 <IconChevron size={18} />
            </BigButton>
          ) : null}
        </div>
        {where === "home" ? (
          <p className="mt-1.5 text-center text-[0.76rem] font-medium text-ink/40">
            체크한 도장은 이 기기와 서버에 함께 저장돼요
          </p>
        ) : null}
      </section>

      <SharePreviewSheet open={shareOpen} onClose={() => setShareOpen(false)} data={shareData} />
    </>
  );
}
