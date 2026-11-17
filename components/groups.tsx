"use client";

import React, { useMemo, useState } from "react";
import { useGroup } from "@/lib/group-store";
import { timeAgo } from "@/lib/groups";
import { kstDate, koreanDate } from "@/lib/week";
import { useApp } from "@/lib/storage";
import { HealthChallengeCard } from "./health";
import { SharePreviewSheet } from "./share-sheet";
import { Badge, BigButton, Card, SectionTitle, Sheet, useToast } from "./ui";
import {
  IconChevron,
  IconCrown,
  IconHeart,
  IconPlus,
  IconShare,
  IconSparkle,
  IconStamp,
  IconTrophy,
  IconUsers,
} from "./icons";
import type { GroupMemberInfo } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* 작은 조각들                                                        */
/* ------------------------------------------------------------------ */

/** 원형 출석률 도넛 */
export function Donut({
  percent,
  size = 88,
  caption,
  sub,
}: {
  percent: number;
  size?: number;
  caption?: string;
  sub?: string;
}) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="44" cy="44" r={r} fill="none" stroke="#E7EFEA" strokeWidth="9" />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke="#3E9C6B"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * c} ${c}`}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="tabular text-[1.12rem] font-black text-leaf-dark">{caption ?? `${value}%`}</span>
        {sub ? <span className="mt-1 text-[0.66rem] font-bold text-ink/45">{sub}</span> : null}
      </div>
    </div>
  );
}

/** 이번 주 달성률 막대 */
function Gauge({ percent, label }: { percent: number; label: string }) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div>
      <div className="mb-1 flex items-end justify-between">
        <p className="text-[0.84rem] font-extrabold text-ink/60">{label}</p>
        <p className="tabular text-[0.95rem] font-black text-brand-dark">{value}%</p>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-ink/8">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand to-leaf transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

/** 이번 주 미션 남은 날 (일요일 마감) */
function missionBadge(done: boolean): string {
  if (done) return "완료";
  const day = new Date(kstDate() + "T00:00:00Z").getUTCDay() || 7; // 월=1 … 일=7
  const left = 7 - day;
  return left <= 0 ? "오늘" : `D-${left}`;
}

/* ------------------------------------------------------------------ */
/* 모임 선택 배너 (홈 상단)                                            */
/* ------------------------------------------------------------------ */

export function GroupSelectorBanner() {
  const { active, groups, detail } = useGroup();
  const [sheet, setSheet] = useState<SheetKind>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setSheet("switch")}
        className="fade-up flex w-full items-center gap-3 rounded-[1.4rem] border border-brand/15 bg-white px-3.5 py-3 text-left shadow-soft active:scale-[0.995]"
        aria-label="모임 바꾸기"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-light text-brand-dark">
          <IconUsers size={23} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[1.06rem] font-black leading-tight text-ink">
              {active ? active.name : "모임을 골라 주세요"}
            </span>
            {active?.isDemo ? <Badge tone="gold">체험</Badge> : null}
          </span>
          <span className="mt-0.5 block truncate text-[0.84rem] font-bold text-brand-dark/80">
            {active
              ? `멤버 ${active.memberCount}명${detail ? ` · 오늘 ${detail.todayAttended}명 출석` : ""}`
              : groups.length
                ? "모임을 골라 주세요"
                : "우리 가족 사랑방에서 함께 시작해요"}
          </span>
          {active ? (
            <span className="mt-1 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-leaf-light px-2 py-0.5 text-[0.76rem] font-black text-leaf-dark">
                <span className="h-1.5 w-1.5 rounded-full bg-leaf" />
                지금 {active.onlineCount ?? detail?.onlineCount ?? 1}명 접속 중
              </span>
            </span>
          ) : null}
        </span>
        <IconChevron size={20} className="shrink-0 rotate-90 text-ink/30" />
      </button>

      <GroupSheet mode={sheet} onClose={() => setSheet(null)} onChange={setSheet} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 오늘의 모임 현황 (홈)                                               */
/* ------------------------------------------------------------------ */

export function TodayGroupCard() {
  const { detail, active } = useGroup();
  const [sheet, setSheet] = useState<SheetKind>(null);

  if (!detail || !active) {
    return (
      <>
        <button
          type="button"
          onClick={() => setSheet("switch")}
          className="fade-up card flex w-full items-center gap-3 p-4 text-left"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gold-light text-gold-dark">
            <IconTrophy size={24} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[1rem] font-black text-ink">오늘의 모임 현황</span>
            <span className="mt-0.5 block text-[0.86rem] font-semibold text-ink/55">
              모임에 들어가면 가족 출석률과 1위가 보여요
            </span>
          </span>
          <IconChevron size={20} className="shrink-0 text-ink/30" />
        </button>
        <GroupSheet mode={sheet} onClose={() => setSheet(null)} onChange={setSheet} />
      </>
    );
  }

  return (
    <section className="fade-up card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[1.02rem] font-black text-ink">
          <IconTrophy size={19} className="text-gold-dark" /> 오늘의 모임 현황
        </p>
        {active.isDemo ? <Badge tone="gold">체험 모임</Badge> : null}
      </div>

      <div className="mt-2.5 flex items-center gap-3">
        <div className="flex flex-col items-center">
          <Donut percent={detail.attendanceRate} sub={`(${detail.todayAttended}/${detail.memberCount}명)`} />
          <p className="mt-1 text-[0.74rem] font-bold text-ink/45">오늘 출석률</p>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="rounded-2xl bg-gradient-to-br from-gold-light to-[#FFF1C4] px-3.5 py-2.5">
            <p className="flex items-center gap-1 text-[0.76rem] font-black text-[#8A6100]">
              <IconCrown size={14} /> 모임 1위
            </p>
            <p className="mt-0.5 truncate text-[1.04rem] font-black leading-tight text-ink">
              {detail.top ? detail.top.name : "-"}
            </p>
            <p className="tabular text-[0.86rem] font-extrabold text-gold-dark">
              {detail.top ? `${detail.top.points}점` : "점수를 모으는 중"}
            </p>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-paper px-3 py-2">
            <p className="text-[0.78rem] font-bold text-ink/55">이번 주 달성률</p>
            <p className="tabular text-[0.92rem] font-black text-brand-dark">{detail.weeklyRate}%</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 오늘의 모임 미션 (홈)                                               */
/* ------------------------------------------------------------------ */

export function GroupMissionBanner({ onJoin }: { onJoin: () => void }) {
  const { detail, todayDone } = useGroup();
  const badge = missionBadge(todayDone);

  return (
    <button
      type="button"
      onClick={onJoin}
      className="fade-up w-full rounded-[1.4rem] bg-gradient-to-br from-sun-light via-[#FFF0C9] to-[#FFE2A0] p-4 text-left shadow-soft active:scale-[0.995]"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[1rem] font-black text-[#8A6100]">
          <IconSparkle size={17} /> 오늘의 모임 미션
        </p>
        <span
          className={`rounded-full px-2.5 py-1 text-[0.74rem] font-black ${
            badge === "완료" ? "bg-leaf text-white" : "bg-white text-coral-dark"
          }`}
        >
          {badge}
        </span>
      </div>
      <p className="mt-1.5 text-[0.98rem] font-black leading-snug text-ink">
        🎁 오늘의 두뇌 퀴즈 맞히고,
        <br />
        모임 랭킹에 도전하세요!
      </p>
      {detail ? (
        <p className="mt-1 text-[0.8rem] font-bold text-[#8A6100]/85">
          우리 모임 오늘 참여 {detail.todayAttended}/{detail.memberCount}명
        </p>
      ) : null}
      <span className="mt-2.5 flex min-h-[46px] w-full items-center justify-center gap-1 rounded-full bg-ink text-[0.98rem] font-black text-white shadow-cta">
        {todayDone ? "오늘 결과 보기" : "지금 바로 참여하기"} <IconChevron size={18} />
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 우리 모임 탭                                                        */
/* ------------------------------------------------------------------ */

export function GroupTab({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { active, activeId, detail, groups, addPost, cheer, leave, join, select, todayDone, online } =
    useGroup();
  const { show } = useToast();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  /** 모임 전환 — 이미 보던 모임이면 그대로, 아니면 서버에서 그 모임 자료를 불러온다 */
  const switchTo = async (id: string) => {
    if (id === activeId) return;
    await select(id);
    show("모임을 바꿨어요.");
  };

  const members = detail?.members ?? [];
  const posts = detail?.posts ?? [];

  const submit = async () => {
    if (busy || !text.trim()) return;
    setBusy(true);
    const r = await addPost(text);
    setBusy(false);
    show(r.message);
    if (r.ok) setText("");
  };

  return (
    <div className="space-y-4">
      <section className="fade-up pt-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Badge tone="brand">
                <IconUsers size={13} /> 우리 모임
              </Badge>
              {active?.isDemo ? <Badge tone="gold">체험 모임</Badge> : null}
            </div>
            <h1 className="mt-1.5 truncate text-[1.5rem] font-black leading-tight text-ink">
              {active ? active.name : "모임을 시작해 보세요"}
            </h1>
            <p className="mt-1 text-[0.88rem] font-semibold text-ink/55">
              {active
                ? `멤버 ${active.memberCount}명 · 이번 주 달성률 ${detail?.weeklyRate ?? 0}%`
                : "가족·친구와 함께 퀴즈 순위를 겨루는 공간이에요"}
            </p>
            {active ? (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-leaf-light px-2.5 py-1 text-[0.8rem] font-black text-leaf-dark">
                <span className="h-2 w-2 rounded-full bg-leaf" />
                지금 {active.onlineCount ?? detail?.onlineCount ?? 1}명 접속 중
              </span>
            ) : null}
          </div>
          {active ? (
            <button
              type="button"
              onClick={() => setSheet("switch")}
              className="flex shrink-0 items-center gap-1 rounded-full border border-ink/10 bg-white px-3 py-2 text-[0.82rem] font-black text-ink/70 shadow-soft"
            >
              모임 바꾸기 <IconChevron size={15} className="rotate-90" />
            </button>
          ) : null}
        </div>
      </section>

      {/* 내 모임 — 여러 모임을 한눈에 보고 원터치로 전환 + 새 모임 추가 */}
      {groups.length > 0 ? (
        <div data-group-switcher>
        <Card className="fade-up p-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[0.94rem] font-black text-ink">내 모임 {groups.length}개</p>
            <p className="text-[0.76rem] font-bold text-ink/40">눌러서 바로 전환</p>
          </div>
          <div className="mt-2 space-y-1.5">
            {groups.map((g) => {
              const on = g.id === activeId;
              return (
                <button
                  key={g.id}
                  type="button"
                  data-group-row={g.id}
                  aria-pressed={on}
                  onClick={() => void switchTo(g.id)}
                  className={`flex min-h-[56px] w-full items-center gap-2.5 rounded-2xl border-2 px-3 py-2 text-left ${
                    on ? "border-brand bg-brand-light" : "border-ink/8 bg-paper active:bg-white"
                  }`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-brand-dark shadow-soft">
                    <IconUsers size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[0.98rem] font-black text-ink">{g.name}</span>
                      {g.isDemo ? <Badge tone="gold">체험</Badge> : null}
                    </span>
                    <span className="block truncate text-[0.78rem] font-bold text-ink/45">
                      멤버 {g.memberCount}명 · 번호 {g.id}
                    </span>
                  </span>
                  {on ? (
                    <Badge tone="brand">보는 중</Badge>
                  ) : (
                    <span className="shrink-0 text-[0.8rem] font-extrabold text-brand-dark">전환 ›</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-2.5 grid grid-cols-1 gap-2" data-group-add-buttons>
            <BigButton variant="ink" full height={54} onClick={() => setSheet("create")}>
              <span className="text-[1.2rem] font-black leading-none">+</span> 새 모임 만들기
            </BigButton>
            <BigButton variant="white" full height={54} onClick={() => setSheet("join")}>
              초대 번호로 모임 추가
            </BigButton>
          </div>
        </Card>
        </div>
      ) : null}

      {/* 모임이 없을 때 — 체험 모임 · 만들기 · 초대 코드 */}
      {!detail ? (
        <Card className="fade-up p-4">
          <p className="text-[1.05rem] font-black leading-snug text-ink">
            우리 가족 사랑방에서
            <br />
            먼저 둘러볼까요?
          </p>
          <p className="mt-1 text-[0.9rem] font-semibold leading-relaxed text-ink/55">
            체험 모임에는 가족 10명의 출석과 퀴즈 점수가 미리 담겨 있어요. 1초면 들어갈 수 있어요.
          </p>
          <div className="mt-3 space-y-2">
            <BigButton
              variant="ink"
              size="lg"
              full
              onClick={async () => {
                const r = await join("FAM101");
                show(r.ok ? "우리 가족 사랑방에 들어왔어요! 🎉" : "지금은 들어갈 수 없어요. 잠시 뒤 다시 눌러 주세요.");
              }}
            >
              <IconUsers size={21} /> 체험 모임 들어가기 (FAM101)
            </BigButton>
            <BigButton variant="white" full onClick={() => setSheet("create")}>
              <IconPlus size={20} /> 새 모임 만들기
            </BigButton>
            <BigButton variant="ghost" full onClick={() => setSheet("join")}>
              초대 번호로 들어가기
            </BigButton>
          </div>
          {groups.length ? (
            <p className="mt-3 text-center text-[0.8rem] font-semibold text-ink/45">
              가입한 모임 {groups.length}개 — 위의 ‘모임 바꾸기’에서 골라 주세요.
            </p>
          ) : null}
        </Card>
      ) : (
        <>
          {/* 모임 동작 — 새 모임 추가는 위 ‘내 모임’ 카드에 있고, 여기서는 카톡 초대 */}
          <BigButton variant="sun" full onClick={() => setSheet("invite")}>
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#FEE500] text-[0.58rem] font-black text-[#3C1E1E]">
              TALK
            </span>
            카카오톡으로 우리 모임 초대하기
          </BigButton>

          {/* 오늘의 건강 챌린지 — 모임원과 함께 원터치 체크인 */}
          <HealthChallengeCard where="group" />

          {/* 오늘 출석 */}
          <Card className="fade-up p-4">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[1.02rem] font-black text-ink">
                <IconStamp size={19} className="text-leaf-dark" /> 오늘 출석 현황
              </p>
              <p className="tabular text-[0.9rem] font-black text-leaf-dark">
                {detail.todayAttended} / {detail.memberCount}명
              </p>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {members.map((m) => (
                <MemberChip key={m.code} member={m} />
              ))}
            </div>

            {/* 가족이 링크를 받지 않아도 오늘 약 상태·접속 여부를 바로 알 수 있게 */}
            <div data-group-status className="mt-3 grid grid-cols-2 gap-2">
              <p className="flex items-center justify-center gap-1 rounded-2xl bg-brand-light/70 px-2 py-2 text-[0.84rem] font-extrabold text-brand-deep">
                🟢 지금 접속 {detail.onlineCount}명
              </p>
              <p
                data-group-medicine
                className="flex items-center justify-center gap-1 rounded-2xl bg-leaf-light/60 px-2 py-2 text-[0.84rem] font-extrabold text-leaf-dark"
              >
                💊 약 {members.filter((m) => m.medicineDone).length}/{detail.memberCount}명
              </p>
            </div>

            <div className="mt-4">
              <Gauge percent={detail.weeklyRate} label="이번 주 모임 달성률" />
              <p className="mt-1.5 text-[0.78rem] font-semibold text-ink/45">
                한 사람이 주 {detail.weeklyGoal}일 참여하면 100%가 돼요. 오늘 {todayDone ? "참여 완료!" : "아직 참여 전이에요"}.
              </p>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-gold-light/70 px-3.5 py-2.5">
              <IconCrown size={18} className="shrink-0 text-gold-dark" />
              <p className="min-w-0 flex-1 truncate text-[0.9rem] font-bold text-[#7A5600]">
                {detail.top ? `이번 주 1위 ${detail.top.name} · ${detail.top.points}점` : "첫 점수를 기다리고 있어요"}
              </p>
              <button
                type="button"
                onClick={() => onNavigate("ranking")}
                className="shrink-0 text-[0.8rem] font-black text-gold-dark underline decoration-gold-dark/40 underline-offset-2"
              >
                랭킹
              </button>
            </div>
          </Card>

          {/* 게시판 */}
          <Card className="fade-up p-4">
            <SectionTitle
              emoji="💬"
              right={<span className="text-[0.76rem] font-bold text-ink/40">{posts.length}개</span>}
            >
              모임 게시판
            </SectionTitle>
            <p className="mb-2 text-[0.84rem] font-semibold text-ink/50">한 줄 안부와 응원을 남겨 보세요.</p>

            <div className="flex items-end gap-2">
              <input
                className="field flex-1"
                placeholder="오늘 한마디 (예: 다들 좋은 하루 보내세요!)"
                value={text}
                maxLength={80}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submit();
                }}
                aria-label="모임 게시판에 남길 말"
              />
              <button
                type="button"
                onClick={submit}
                disabled={busy || !text.trim()}
                className={`touch-btn shrink-0 px-4 ${busy || !text.trim() ? "bg-ink/20 text-white" : "bg-ink text-white shadow-cta"}`}
              >
                남기기
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {posts.length === 0 ? (
                <p className="rounded-2xl bg-paper px-4 py-5 text-center text-[0.9rem] font-semibold text-ink/45">
                  첫 안부를 남겨 보세요. 가족이 함께 볼 수 있어요.
                </p>
              ) : (
                posts.map((p) => (
                  <div key={p.id} className="rounded-2xl bg-paper px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[0.86rem] font-black text-white ${
                          p.authorCode === detail.creatorCode ? "bg-gold-dark" : "bg-brand"
                        }`}
                      >
                        {p.authorName.slice(0, 1)}
                      </span>
                      <p className="min-w-0 flex-1 truncate text-[0.9rem] font-black text-ink">
                        {p.authorName}
                        {p.authorCode === detail.creatorCode ? (
                          <span className="ml-1 text-[0.7rem] font-extrabold text-gold-dark">모임장</span>
                        ) : null}
                      </p>
                      <span className="shrink-0 text-[0.72rem] font-semibold text-ink/35">{timeAgo(p.createdAt)}</span>
                    </div>
                    <p className="mt-1.5 text-[0.98rem] font-semibold leading-snug text-ink/85">{p.content}</p>
                    <div className="mt-1.5 flex justify-end">
                      <button
                        type="button"
                        onClick={() => void cheer(p.id)}
                        aria-pressed={p.cheeredByMe}
                        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.78rem] font-extrabold ${
                          p.cheeredByMe ? "bg-coral-light text-coral-dark" : "bg-white text-ink/55 shadow-soft"
                        }`}
                      >
                        <IconHeart size={14} /> 응원 {p.cheers}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <div className="flex items-center justify-center gap-2 pb-1">
            <button
              type="button"
              onClick={() => setSheet("invite")}
              className="text-[0.82rem] font-bold text-ink/45 underline decoration-ink/20 underline-offset-4"
            >
              초대 번호 {active?.id}
            </button>
            <span className="text-ink/20">|</span>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined" && window.confirm("이 모임에서 나갈까요? 남긴 글은 그대로 남아요.")) {
                  void leave();
                }
              }}
              className="text-[0.82rem] font-bold text-ink/45 underline decoration-ink/20 underline-offset-4"
            >
              모임 나가기
            </button>
          </div>
        </>
      )}

      {!online ? (
        <p className="px-2 text-center text-[0.76rem] font-semibold leading-relaxed text-ink/40">
          지금은 인터넷에 연결하지 못해 이 기기에만 저장하고 있어요. 연결되면 그대로 올라가요.
        </p>
      ) : null}

      <GroupSheet mode={sheet} onClose={() => setSheet(null)} onChange={setSheet} />
    </div>
  );
}

function MemberChip({ member }: { member: GroupMemberInfo }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="relative">
        <span
          className={`grid h-11 w-11 place-items-center rounded-full text-[1rem] font-black ${
            member.todayAttended
              ? "bg-leaf text-white shadow-soft"
              : "border-2 border-dashed border-ink/15 bg-white text-ink/25"
          } ${member.isMe ? "ring-2 ring-brand ring-offset-2" : ""}`}
          aria-label={`${member.name}${member.isMe ? "(나)" : ""}${member.online ? " 접속 중" : ""} ${member.todayAttended ? "출석" : "미출석"}`}
        >
          {member.todayAttended ? <IconStamp size={20} /> : member.name.slice(0, 1)}
        </span>
        {/* 지금 접속 중 — 초록 점 */}
        {member.online ? (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-white">
            <span className="h-2.5 w-2.5 rounded-full bg-leaf shadow-soft" />
          </span>
        ) : null}
      </span>
      <span
        className={`max-w-full truncate text-[0.78rem] leading-tight ${
          member.isMe ? "font-black text-brand-deep" : "font-bold text-ink/75"
        }`}
      >
        {member.name}
      </span>
      {member.online ? (
        <span
          data-member-online="on"
          className="whitespace-nowrap rounded-full bg-leaf-light px-1.5 py-0.5 text-[0.62rem] font-extrabold leading-none text-leaf-dark"
        >
          🟢 접속 중
        </span>
      ) : (
        <span
          data-member-online="off"
          title={member.lastSeenLabel ? `마지막 접속 ${member.lastSeenLabel}` : "접속 기록 없음"}
          className="whitespace-nowrap rounded-full bg-ink/5 px-1.5 py-0.5 text-[0.62rem] font-extrabold leading-none text-ink/35"
        >
          ⚪ {member.lastSeenLabel && member.lastSeenLabel !== "오프라인" ? member.lastSeenLabel : "오프라인"}
        </span>
      )}
      <span
        data-member-medicine={member.medicineDone ? "done" : "before"}
        className={`whitespace-nowrap rounded-full px-1.5 py-0.5 text-[0.62rem] font-extrabold leading-none ${
          member.medicineDone ? "bg-leaf-light text-leaf-dark" : "bg-ink/6 text-ink/40"
        }`}
      >
        💊 {member.medicineDone ? "복약 완료" : "복약 전"}
      </span>
      <span className="tabular text-[0.68rem] font-extrabold text-ink/40">{member.points}점</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 모임 시트 (바꾸기 · 만들기 · 코드로 들어가기 · 초대)                 */
/* ------------------------------------------------------------------ */

type SheetKind = null | "switch" | "create" | "join" | "invite";

function GroupSheet({
  mode,
  onClose,
  onChange,
}: {
  mode: SheetKind;
  onClose: () => void;
  onChange: (m: SheetKind) => void;
}) {
  const { groups, activeId, detail, select, create, join, inviteLink } = useGroup();
  const { profile, today } = useApp();
  const { show } = useToast();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const open = mode !== null;
  const link = useMemo(() => (detail ? inviteLink(detail.id) : ""), [detail, inviteLink]);

  const doCreate = async () => {
    if (busy) return;
    setBusy(true);
    const r = await create(name);
    setBusy(false);
    if (!r.ok) {
      show(r.message);
      return;
    }
    show(r.message);
    setName("");
    onClose();
  };

  const doJoin = async (target: string) => {
    const gid = target.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(gid)) {
      show("초대 번호 6자리를 정확히 적어 주세요.");
      return;
    }
    setBusy(true);
    const r = await join(gid);
    setBusy(false);
    if (!r.ok) {
      show("그 번호의 모임을 찾지 못했어요. 번호를 다시 확인해 주세요.");
      return;
    }
    show("모임에 들어왔어요! 🎉");
    setCode("");
    onClose();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link || inviteLink(detail?.id || ""));
      setCopied(true);
      show("초대 링크를 복사했어요.");
      setTimeout(() => setCopied(false), 2200);
    } catch {
      show("복사하지 못했어요. 링크를 길게 눌러 복사해 주세요.");
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        mode === "invite"
          ? "카카오톡으로 모임 초대"
          : mode === "create"
            ? "새 모임 만들기"
            : mode === "join"
              ? "초대 번호로 들어가기"
              : "우리 모임"
      }
      subtitle={
        mode === "invite"
          ? "가족·친구에게 링크를 보내면 바로 들어올 수 있어요"
          : mode === "create"
            ? "가족방이든 친구 모임이든 1초면 만들어져요"
            : mode === "join"
              ? "받은 초대 번호 6자리를 적어 주세요"
              : "보고 싶은 모임을 골라 주세요"
      }
    >
      {mode === "switch" ? (
        <div className="space-y-3">
          <div className="space-y-2">
            {groups.length === 0 ? (
              <p className="rounded-2xl bg-white px-4 py-5 text-center text-[0.92rem] font-semibold text-ink/50">
                아직 가입한 모임이 없어요.
                <br />
                체험 모임에 들어가 보거나 새로 만들어 보세요.
              </p>
            ) : (
              groups.map((g) => {
                const on = g.id === activeId;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      void select(g.id);
                      onClose();
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left ${
                      on ? "border-brand bg-brand-light" : "border-ink/8 bg-white"
                    }`}
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-brand-dark shadow-soft">
                      <IconUsers size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[1rem] font-black text-ink">{g.name}</span>
                        {g.isDemo ? <Badge tone="gold">체험</Badge> : null}
                        {g.myRole === "leader" ? <Badge tone="brand">모임장</Badge> : null}
                      </span>
                      <span className="text-[0.82rem] font-bold text-ink/50">
                        멤버 {g.memberCount}명 · 번호 {g.id}
                      </span>
                    </span>
                    {on ? (
                      <Badge tone="brand">보는 중</Badge>
                    ) : (
                      <span className="shrink-0 rounded-full bg-paper px-2.5 py-1 text-[0.78rem] font-extrabold text-brand-dark">
                        전환
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="space-y-2" data-group-add-buttons>
            <p className="text-center text-[0.82rem] font-bold text-ink/45">
              모임은 여러 개에 함께 들어갈 수 있어요
            </p>
            <BigButton variant="ink" full height={58} onClick={() => onChange("create")}>
              <span className="text-[1.25rem] font-black leading-none">+</span> 새 모임 만들기
            </BigButton>
            <BigButton variant="white" full height={58} onClick={() => onChange("join")}>
              <IconUsers size={20} /> 초대 번호로 모임 추가
            </BigButton>
          </div>
          <BigButton variant="ghost" full onClick={() => onChange("join")}>
            <IconUsers size={20} /> 체험 모임 둘러보기 (FAM101)
          </BigButton>
        </div>
      ) : null}

      {mode === "create" ? (
        <div className="space-y-3">
          <div>
            <label htmlFor="group-name" className="mb-1.5 block text-[0.95rem] font-extrabold">
              모임 이름
            </label>
            <input
              id="group-name"
              className="field"
              placeholder="예) 우리 가족 사랑방, 옥천 친구들 모임"
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="mt-1 text-[0.8rem] font-semibold text-ink/45">두 글자 이상이면 만들어져요.</p>
          </div>
          <BigButton variant="ink" size="lg" full onClick={doCreate} disabled={busy || name.trim().length < 2}>
            <IconPlus size={21} /> 모임 만들기
          </BigButton>
          <p className="text-center text-[0.8rem] font-semibold leading-relaxed text-ink/45">
            만든 뒤 ‘카카오톡으로 초대하기’를 누르면
            <br />
            가족에게 링크를 바로 보낼 수 있어요.
          </p>
        </div>
      ) : null}

      {mode === "join" ? (
        <div className="space-y-3">
          <div>
            <label htmlFor="group-code" className="mb-1.5 block text-[0.95rem] font-extrabold">
              초대 번호 6자리
            </label>
            <input
              id="group-code"
              className="field tabular text-center text-[1.4rem] font-black tracking-[0.3em]"
              placeholder="FAM101"
              value={code}
              maxLength={6}
              autoCapitalize="characters"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            />
          </div>
          <BigButton variant="ink" size="lg" full onClick={() => doJoin(code)} disabled={busy || code.length !== 6}>
            <IconUsers size={21} /> 모임 들어가기
          </BigButton>
          <div className="rounded-2xl bg-gold-light/70 px-4 py-3">
            <p className="text-[0.86rem] font-bold leading-snug text-[#7A5600]">
              처음이라면 <b>FAM101</b> 을 눌러 보세요. 가족 10명이 활동 중인 체험 모임 ‘우리 가족 사랑방’이에요.
            </p>
            <button
              type="button"
              onClick={() => {
                setCode("FAM101");
                void doJoin("FAM101");
              }}
              className="mt-2 w-full rounded-full bg-white py-2.5 text-[0.9rem] font-black text-gold-dark shadow-soft"
            >
              FAM101 체험 모임 들어가기
            </button>
          </div>
        </div>
      ) : null}

      {mode === "invite" && detail ? (
        <div className="space-y-3">
          <div className="rounded-[1.4rem] bg-white p-4 text-center shadow-soft">
            <p className="text-[0.86rem] font-bold text-ink/50">{detail.name}</p>
            <p className="tabular mt-1 text-[2rem] font-black tracking-[0.28em] text-brand-deep">{detail.id}</p>
            <p className="text-[0.82rem] font-semibold text-ink/45">초대 번호</p>
          </div>

          <div className="rounded-2xl bg-paper px-3.5 py-3">
            <p className="text-[0.78rem] font-bold text-ink/45">초대 링크</p>
            <p className="mt-1 break-all text-[0.84rem] font-semibold text-ink/70">{link}</p>
          </div>

          <BigButton variant="sun" size="lg" full onClick={() => setShareOpen(true)}>
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#FEE500] text-[0.58rem] font-black text-[#3C1E1E]">
              TALK
            </span>
            카카오톡으로 초대장 보내기
          </BigButton>
          <BigButton variant="white" full onClick={() => void copy()}>
            <IconShare size={20} /> {copied ? "복사했어요!" : "초대 링크 복사"}
          </BigButton>
          <p className="text-center text-[0.8rem] font-semibold leading-relaxed text-ink/45">
            링크로 들어온 가족은 로그인·초기 설정을 마치면
            <br />
            자동으로 이 모임에 들어옵니다.
          </p>
        </div>
      ) : null}

      {detail ? (
        <SharePreviewSheet
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          data={{
            kind: "invite",
            badge: "우리 모임 초대",
            emoji: "👥",
            headline: `${detail.name}에 함께해요`,
            sub: `초대 번호 ${detail.id} · 두뇌 퀴즈로 순위를 겨뤄요`,
            message: "누르면 바로 모임에 들어와요.",
            stats: [
              { value: `${detail.memberCount}명`, label: "모임원" },
              { value: `${detail.weeklyRate}%`, label: "이번 주 달성률" },
            ],
            name: profile?.nickname,
            dateLabel: koreanDate(today),
            title: `[늘봄] ${detail.name}에 초대합니다`,
            description: `초대 번호 ${detail.id} · 함께 두뇌 퀴즈 풀고 순위를 겨뤄요!`,
            buttonTitle: "모임 들어가기",
            text: `${profile?.nickname || "가족"} 님이 ${detail.name}에 초대했어요! 초대 번호 ${detail.id}`,
            link,
            filename: `모임초대_${detail.id}.png`,
            sheetTitle: "카카오톡으로 모임 초대",
            sheetSubtitle: "가족 단톡방에 이렇게 보여요",
          }}
        />
      ) : null}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* 랭킹 탭에서 쓰는 ‘우리 모임’ 순위                                    */
/* ------------------------------------------------------------------ */

export function GroupRankingBanner({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { detail, active } = useGroup();
  if (!detail || !active) return null;
  return (
    <div className="rounded-[1.5rem] bg-gradient-to-r from-leaf-light via-[#EAF7EF] to-[#DDF1E6] px-4 py-3.5 text-center shadow-soft">
      <p className="flex items-center justify-center gap-1.5 text-[0.95rem] font-black text-leaf-dark">
        <IconTrophy size={18} /> 이번 주 우리 모임 달성률 {detail.weeklyRate}%
      </p>
      <p className="mt-1 text-[0.84rem] font-bold text-ink/55">
        {detail.todayAttended}/{detail.memberCount}명 참여 · 1위 {detail.top?.name ?? "-"} ·{" "}
        <button
          type="button"
          onClick={() => onNavigate?.("group")}
          className="font-black text-leaf-dark underline decoration-leaf-dark/40 underline-offset-2"
        >
          우리 모임 보기
        </button>
      </p>
    </div>
  );
}
