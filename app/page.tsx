"use client";

import React, { useEffect, useState } from "react";
import { AppProvider, useApp } from "@/lib/storage";
import { ToastProvider, Sheet, BigButton, Divider, Badge, useToast } from "@/components/ui";
import { Onboarding } from "@/components/onboarding";
import {
  DEFAULT_SIDO,
  DEFAULT_SIGUNGU,
  ProfileFields,
  type ProfileDraft,
} from "@/components/profile-fields";
import { UNKNOWN_BIRTH_TIME, birthTimeLabel } from "@/lib/birthtime";
import { HomeTab } from "@/components/home";
import { QuizTab } from "@/components/quiz";
import { WelfareTab } from "@/components/welfare";
import { ToolsTab } from "@/components/tools";
import { FamilyTab } from "@/components/family";
import { RankingTab } from "@/components/ranking";
import { CalendarScreen } from "@/components/calendar";
import { NeulbomMark } from "@/components/art";
import {
  IconFamily,
  IconGear,
  IconGift,
  IconHome,
  IconQuiz,
  IconTools,
  IconTrophy,
} from "@/components/icons";

type TabKey = "home" | "quiz" | "ranking" | "welfare" | "tools" | "family";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "home", label: "홈", icon: <IconHome size={24} /> },
  { key: "quiz", label: "퀴즈", icon: <IconQuiz size={24} /> },
  { key: "ranking", label: "랭킹", icon: <IconTrophy size={24} /> },
  { key: "welfare", label: "혜택", icon: <IconGift size={23} /> },
  { key: "tools", label: "도구", icon: <IconTools size={24} /> },
  { key: "family", label: "가족", icon: <IconFamily size={24} /> },
];

const FONT_LABEL: Record<number, string> = { 18: "보통", 21: "크게", 24: "아주 크게" };

function Shell() {
  const { ready, profile, fontSize, setFontSize, logout, code, updateProfile } = useApp();
  const { show } = useToast();
  const [tab, setTab] = useState<TabKey>("home");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<ProfileDraft>({
    nickname: "",
    birthYear: 1952,
    birthTime: UNKNOWN_BIRTH_TIME,
    sido: DEFAULT_SIDO,
    sigungu: DEFAULT_SIGUNGU,
  });

  useEffect(() => {
    const fromHash = (window.location.hash || "").replace("#", "") as TabKey;
    if (TABS.some((t) => t.key === fromHash)) setTab(fromHash);
  }, []);

  const navigate = (key: string) => {
    const k = (TABS.some((t) => t.key === key) ? key : "home") as TabKey;
    setTab(k);
    window.location.hash = k;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-paper">
        <div className="text-center">
          <NeulbomMark size={64} className="floaty mx-auto" />
          <p className="mt-3 text-[1.02rem] font-extrabold text-ink/55">늘봄을 준비하고 있어요…</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-dvh bg-paper">
        <Onboarding />
      </div>
    );
  }

  const cycleFont = () => {
    setFontSize(fontSize === 18 ? 21 : fontSize === 21 ? 24 : 18);
  };

  const startEdit = () => {
    if (!profile) return;
    setEditDraft({
      nickname: profile.nickname,
      birthYear: profile.birthYear,
      birthTime: profile.birthTime || UNKNOWN_BIRTH_TIME,
      sido: profile.sido || DEFAULT_SIDO,
      sigungu: profile.sigungu || DEFAULT_SIGUNGU,
    });
    setEditOpen(true);
  };

  const saveEdit = () => {
    const name = editDraft.nickname.trim();
    if (!name) {
      show("이름을 먼저 적어 주세요.");
      return;
    }
    if (!editDraft.sido || !editDraft.sigungu) {
      show("사는 지역을 골라 주세요.");
      return;
    }
    updateProfile({
      nickname: name,
      birthYear: editDraft.birthYear,
      birthTime: editDraft.birthTime || UNKNOWN_BIRTH_TIME,
      sido: editDraft.sido,
      sigungu: editDraft.sigungu,
      profileCompleted: true,
    });
    setEditOpen(false);
    show("내 정보를 저장했어요.");
  };

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[460px] bg-paper shadow-[0_0_70px_-24px_rgba(23,59,94,0.4)]">
      <header className="sticky top-0 z-40 bg-paper/95 pt-safe backdrop-blur-md">
        <div className="flex h-[62px] items-center justify-between px-4">
          <button onClick={() => navigate("home")} className="flex items-center gap-2" aria-label="늘봄 홈">
            <NeulbomMark size={32} />
            <span className="text-[1.32rem] font-black leading-none tracking-[-0.05em] text-ink">늘봄</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={cycleFont}
              aria-label={`글씨 크기 바꾸기 (지금 ${FONT_LABEL[fontSize]})`}
              className="flex h-10 items-center gap-1 rounded-full border border-ink/10 bg-white px-3 text-[0.92rem] font-black text-ink shadow-soft"
            >
              <span className="text-[1.05rem]">가</span>
              <span className="text-[0.66rem] font-bold text-ink/45">{FONT_LABEL[fontSize]}</span>
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label="설정"
              className="grid h-10 w-10 place-items-center rounded-full border border-ink/10 bg-white text-ink/65 shadow-soft"
            >
              <IconGear size={21} />
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 pb-safe pt-2">
        {tab === "home" ? <HomeTab onNavigate={navigate} onOpenCalendar={() => setCalendarOpen(true)} /> : null}
        {tab === "quiz" ? <QuizTab onNavigate={navigate} /> : null}
        {tab === "ranking" ? <RankingTab onNavigate={navigate} /> : null}
        {tab === "welfare" ? <WelfareTab onNavigate={navigate} /> : null}
        {tab === "tools" ? <ToolsTab /> : null}
        {tab === "family" ? (
          <FamilyTab onNavigate={navigate} onOpenCalendar={() => setCalendarOpen(true)} />
        ) : null}
      </main>

      <nav
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-[460px] -translate-x-1/2 rounded-t-[1.6rem] border-t border-ink/5 bg-white shadow-[0_-8px_28px_-18px_rgba(23,59,94,0.45)] backdrop-blur"
        aria-label="주요 메뉴"
      >
        <div className="grid grid-cols-6 pb-[env(safe-area-inset-bottom,0px)]">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => navigate(t.key)}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-[64px] flex-col items-center justify-center gap-1 transition ${
                  active ? "text-brand-dark" : "text-ink/50"
                }`}
              >
                <span className={`transition ${active ? "-translate-y-0.5 scale-105" : ""}`}>{t.icon}</span>
                <span className={`text-[0.72rem] leading-none tracking-tight ${active ? "font-black" : "font-bold"}`}>
                  {t.label}
                </span>
                {active ? <span className="absolute bottom-1.5 h-1 w-1.5 rounded-full bg-brand" /> : null}
              </button>
            );
          })}
        </div>
      </nav>

      <CalendarScreen open={calendarOpen} onClose={() => setCalendarOpen(false)} />

      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="내 정보 · 설정">
        <div className="rounded-3xl bg-white p-4 shadow-soft">
          {editOpen ? (
            <div>
              <p className="mb-3 text-[1rem] font-black">내 정보 고치기</p>
              <ProfileFields
                value={editDraft}
                onChange={(patch) => setEditDraft((d) => ({ ...d, ...patch }))}
                idPrefix="edit"
              />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <BigButton variant="white" onClick={() => setEditOpen(false)}>
                  그만두기
                </BigButton>
                <BigButton variant="ink" onClick={saveEdit}>
                  저장
                </BigButton>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-light text-[1.2rem] font-black text-brand-dark">
                  {profile.nickname.slice(0, 1)}
                </span>
                <div>
                  <p className="text-[1.15rem] font-black">{profile.nickname} 님</p>
                  <p className="text-[0.9rem] font-semibold text-ink/55">
                    {profile.birthYear}년생 ({2026 - profile.birthYear}세) · {profile.sido} {profile.sigungu}
                  </p>
                  <p className="mt-0.5 text-[0.86rem] font-semibold text-ink/45">
                    태어난 시간 · {birthTimeLabel(profile.birthTime)}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <BigButton variant="white" full onClick={startEdit}>
                  내 정보 고치기
                </BigButton>
              </div>
              <Divider />
              <div className="flex items-center justify-between">
                <p className="text-[0.9rem] font-semibold text-ink/55">가족 코드</p>
                <p className="tabular text-[1.1rem] font-black tracking-[0.16em] text-brand-dark">{code}</p>
              </div>
              <p className="mt-1 text-[0.78rem] font-medium leading-relaxed text-ink/45">
                내 정보는 이 기기에 저장되고, 다시 카카오톡으로 로그인하면 그대로 이어져요.
              </p>
            </div>
          )}
        </div>

        <div className="mt-3 rounded-3xl bg-white p-4 shadow-soft">
          <p className="mb-2 text-[0.95rem] font-black">글씨 크기</p>
          <div className="grid grid-cols-3 gap-2">
            {([18, 21, 24] as const).map((size, i) => (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                aria-pressed={fontSize === size}
                className={`min-h-[52px] rounded-2xl border-2 text-[0.9rem] font-extrabold ${
                  fontSize === size
                    ? "border-brand bg-brand text-white"
                    : "border-ink/10 bg-paper text-ink/70"
                }`}
              >
                {["보통", "크게", "아주 크게"][i]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2">
          <BigButton
            variant="white"
            onClick={() => {
              setSettingsOpen(false);
              navigate("family");
            }}
          >
            가족 확인 화면 열기
          </BigButton>
          <BigButton
            variant="ghost"
            onClick={() => {
              setSettingsOpen(false);
              logout();
            }}
          >
            처음부터 다시 시작
          </BigButton>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 pb-1">
          <Badge tone="brand">늘봄</Badge>
          <p className="text-[0.76rem] font-medium text-ink/40">언제나, 늘 곁에 있는 시니어 생활 플랫폼</p>
        </div>
      </Sheet>
    </div>
  );
}

export default function Page() {
  return (
    <AppProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </AppProvider>
  );
}
