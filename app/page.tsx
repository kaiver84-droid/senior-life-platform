"use client";

import React, { useEffect, useState } from "react";
import { AppProvider, useApp } from "@/lib/storage";
import { ToastProvider, Sheet, BigButton, Divider } from "@/components/ui";
import { Onboarding } from "@/components/onboarding";
import { HomeTab } from "@/components/home";
import { QuizTab } from "@/components/quiz";
import { WelfareTab } from "@/components/welfare";
import { ToolsTab } from "@/components/tools";
import { FamilyTab } from "@/components/family";
import { RankingTab } from "@/components/ranking";
import { IconFamily, IconGift, IconHome, IconQuiz, IconStar, IconTools } from "@/components/icons";

type TabKey = "home" | "quiz" | "ranking" | "welfare" | "tools" | "family";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "home", label: "홈", icon: <IconHome size={24} /> },
  { key: "quiz", label: "퀴즈", icon: <IconQuiz size={23} /> },
  { key: "ranking", label: "랭킹", icon: <IconStar size={23} /> },
  { key: "welfare", label: "혜택", icon: <IconGift size={23} /> },
  { key: "tools", label: "도구", icon: <IconTools size={24} /> },
  { key: "family", label: "가족", icon: <IconFamily size={24} /> },
];

function Shell() {
  const { ready, profile, fontSize, setFontSize, logout, code } = useApp();
  const [tab, setTab] = useState<TabKey>("home");
  const [profileOpen, setProfileOpen] = useState(false);

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
          <div className="floaty text-[2.6rem]">🌻</div>
          <p className="mt-2 text-[1.05rem] font-extrabold text-ink/60">잠시만 기다려 주세요…</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-dvh bg-[#F3ECDD]">
        <Onboarding />
      </div>
    );
  }

  const cycleFont = () => {
    setFontSize(fontSize === 18 ? 21 : fontSize === 21 ? 24 : 18);
  };

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[460px] bg-paper shadow-[0_0_60px_-20px_rgba(20,33,58,0.35)]">
      <header className="sticky top-0 z-40 border-b-2 border-ink/8 bg-paper/95 pt-safe backdrop-blur">
        <div className="flex h-[58px] items-center justify-between px-4">
          <button onClick={() => navigate("home")} className="flex items-center gap-1.5">
            <span className="text-[1.3rem]">🌻</span>
            <span className="text-[1.02rem] font-black tracking-tight">시니어생활 도우미</span>
          </button>
          <div className="flex items-center gap-1.5">
            <button
              onClick={cycleFont}
              aria-label="글씨 크기 바꾸기"
              className="grid h-10 w-10 place-items-center rounded-xl border-2 border-ink/12 bg-white text-[0.95rem] font-black"
            >
              {fontSize === 18 ? "가" : fontSize === 21 ? "가+" : "가++"}
            </button>
            <button
              onClick={() => setProfileOpen(true)}
              aria-label="내 정보"
              className="grid h-10 w-10 place-items-center rounded-xl border-2 border-ink/12 bg-white text-[1.05rem] font-black text-brand"
            >
              {profile.nickname.slice(0, 1)}
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 pb-safe pt-4">
        {tab === "home" ? <HomeTab onNavigate={navigate} /> : null}
        {tab === "quiz" ? <QuizTab onNavigate={navigate} /> : null}
        {tab === "ranking" ? <RankingTab onNavigate={navigate} /> : null}
        {tab === "welfare" ? <WelfareTab /> : null}
        {tab === "tools" ? <ToolsTab /> : null}
        {tab === "family" ? <FamilyTab /> : null}
      </main>

      <nav
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-[460px] -translate-x-1/2 border-t-2 border-ink/10 bg-white/97 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur"
        aria-label="주요 메뉴"
      >
        <div className="grid grid-cols-6">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => navigate(t.key)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[62px] flex-col items-center justify-center gap-0.5 transition ${
                  active ? "text-brand" : "text-ink/45"
                }`}
              >
                <span className={active ? "scale-110" : ""}>{t.icon}</span>
                <span className={`text-[0.72rem] tracking-tight ${active ? "font-black" : "font-bold"}`}>{t.label}</span>
                <span className={`h-1 w-6 rounded-full ${active ? "bg-brand" : "bg-transparent"}`} />
              </button>
            );
          })}
        </div>
      </nav>

      <Sheet open={profileOpen} onClose={() => setProfileOpen(false)} title="내 정보">
        <div className="rounded-2xl bg-white p-4">
          <p className="text-[1.2rem] font-black">{profile.nickname} 님</p>
          <p className="mt-1 text-[0.95rem] font-semibold text-ink/60">
            {profile.birthYear}년생 ({2026 - profile.birthYear}세) · {profile.sido} {profile.sigungu}
          </p>
          <Divider />
          <p className="text-[0.88rem] font-semibold text-ink/55">
            가족 코드 <span className="tabular font-black text-brand-dark">{code}</span>
          </p>
          <p className="mt-1 text-[0.8rem] font-medium leading-relaxed text-ink/45">
            이 기기의 브라우저에만 저장돼요. 앱을 지우면 기록도 함께 지워집니다.
          </p>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2">
          <BigButton
            variant="white"
            onClick={() => {
              setProfileOpen(false);
              navigate("family");
            }}
          >
            가족 확인 화면 열기
          </BigButton>
          <BigButton
            variant="ghost"
            onClick={() => {
              setProfileOpen(false);
              logout();
            }}
          >
            처음부터 다시 시작
          </BigButton>
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
