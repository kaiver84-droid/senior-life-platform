"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppProvider, useApp } from "@/lib/storage";
import { ToastProvider, Sheet, BigButton, Divider, Badge, Avatar, useToast } from "@/components/ui";
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
import { GradeSummaryRow, RankingTab } from "@/components/ranking";
import { AlarmWatcher, CalendarScreen } from "@/components/calendar";
import { InstallBanner, InstallGuide, InstallGuideRow } from "@/components/install-guide";
import { PrivacySheet } from "@/components/legal";
import { CommunityStatsCard } from "@/components/stats";
import { NeulbomMark } from "@/components/art";
import { GroupProvider, useGroup } from "@/lib/group-store";
import { captureInviteFromUrl } from "@/lib/groups";
import { ENABLE_DUELS, captureDuelFromUrl } from "@/lib/duels";
import { kakaoConfig, loadKakaoSdk } from "@/lib/share";
import { shareMetaFor, shareSituationFor, groupCodeFromParams } from "@/lib/og";
import { GroupTab } from "@/components/groups";
import {
  IconChevron,
  IconGear,
  IconGift,
  IconGiftFill,
  IconHome,
  IconHomeFill,
  IconMore,
  IconMoreFill,
  IconQuiz,
  IconQuizFill,
  IconTrophy,
  IconTrophyFill,
  IconUsers,
  IconUsersFill,
} from "@/components/icons";

// 친구가 보낸 모임 초대 링크(?group=XXXXXX)를 화면이 그려지기 전에 붙잡아 둔다.
captureInviteFromUrl();
// 친구가 보낸 1:1 대결 링크(?duel=XXXXXX)도 함께 붙잡아 둔다.
// — 대결 화면을 숨긴 동안(ENABLE_DUELS=false)에는 링크도 받지 않는다.
if (ENABLE_DUELS) captureDuelFromUrl();

type TabKey = "home" | "group" | "quiz" | "ranking" | "welfare" | "more";

/** 하단 메뉴 — 시안처럼 채움형(duotone) 아이콘을 쓴다 */
const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "home", label: "홈", icon: <IconHomeFill size={25} /> },
  { key: "group", label: "모임", icon: <IconUsersFill size={25} /> },
  { key: "quiz", label: "퀴즈", icon: <IconQuizFill size={25} /> },
  { key: "ranking", label: "랭킹", icon: <IconTrophyFill size={25} /> },
  { key: "welfare", label: "혜택", icon: <IconGiftFill size={24} /> },
  { key: "more", label: "더보기", icon: <IconMoreFill size={24} /> },
];

const FONT_LABEL: Record<number, string> = { 18: "보통", 21: "크게", 24: "아주 크게" };
/** 버튼에는 ‘지금 누르면 어떻게 되는지’를 적는다 — 어르신이 누를 이유를 바로 알 수 있게 */
const FONT_ACTION: Record<number, string> = { 18: "글씨 크게", 21: "글씨 더 크게", 24: "글씨 보통으로" };

function Shell() {
  const { ready, profile, fontSize, setFontSize, logout, code, updateProfile } = useApp();
  const { show } = useToast();
  const [tab, setTab] = useState<TabKey>("home");
  const [moreView, setMoreView] = useState<"menu" | "tools" | "family">("menu");
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
    // 카톡으로 보낸 링크(?tab=quiz·?tab=welfare…)는 그 탭으로 바로 열린다.
    const params = new URLSearchParams(window.location.search);
    const tabParam = (params.get("tab") || "").trim().toLowerCase();
    const shareParam = (params.get("share") || "").trim().toLowerCase();

    // 브라우저 탭 제목 — 주소를 지우기 전에 이 링크의 상황을 먼저 읽어 둔다.
    // (React 가 정적 메타데이터를 다시 적용하며 제목을 되돌릴 때가 있어 한 번 더 맞춘다)
    const title = shareMetaFor(shareSituationFor(window.location.pathname, params), {
      groupCode: groupCodeFromParams(params),
    }).title;
    const applyTitle = () => {
      document.title = title;
    };
    applyTitle();
    const titleTimer = setTimeout(applyTitle, 400);

    // ?share= 는 한 번만 쓰고 주소에서 지운다(그 뒤 탭은 ?tab= 으로 적힌다).
    if (shareParam) {
      params.delete("share");
      const qs = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash || ""}`);
    }

    if (tabParam === "groups") {
      setTab("group");
      return () => clearTimeout(titleTimer);
    }
    if (TABS.some((t) => t.key === tabParam)) {
      if (tabParam === "more") setMoreView("menu");
      setTab(tabParam as TabKey);
      return () => clearTimeout(titleTimer);
    }
    // ?share=greeting·fortune — 홈에서 안부 인사카드/운세를 바로 보여 준다.
    if (shareParam) {
      setTab("home");
      return () => clearTimeout(titleTimer);
    }

    const fromHash = (window.location.hash || "").replace("#", "");
    if (fromHash === "tools" || fromHash === "family") {
      setMoreView(fromHash);
      setTab("more");
      return () => clearTimeout(titleTimer);
    }
    if (TABS.some((t) => t.key === fromHash)) setTab(fromHash as TabKey);
    return () => clearTimeout(titleTimer);
  }, []);

  /**
   * 카카오 공유 SDK 를 앱을 여는 순간 미리 불러 둔다.
   * iOS Safari 는 사용자 클릭과 **같은 작업** 안에서 kakaolink:// 전환을 요청해야 카카오톡을 열어 주므로,
   * 공유 버튼을 누를 때는 SDK 가 이미 준비돼 있어야 한다(그 사이에 await 가 끼면 다운로드 안내 화면으로 튕긴다).
   */
  useEffect(() => {
    if (!kakaoConfig().configured) return;
    void loadKakaoSdk();
  }, []);

  // 안드로이드 크롬 ‘앱 설치’ 팝업이 뜨도록 서비스 워커를 조용히 등록한다(실패해도 화면은 그대로).
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const t = setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  // 예전 바로가기(도구·가족)도 그대로 열린다 — ‘더보기’ 안에서 이어서 보여 준다.
  /** 지금 보고 있는 탭을 주소에도 적어 둔다(?tab=quiz) — 주소를 복사해 보내도 그 상황 문구로 미리보기가 뜬다 */
  const writeTabToUrl = (k: TabKey) => {
    try {
      const u = new URL(window.location.href);
      if (k === "home") u.searchParams.delete("tab");
      else u.searchParams.set("tab", k);
      u.searchParams.delete("share");
      u.hash = k;
      window.history.replaceState({}, "", `${u.pathname}${u.search}${u.hash}`);
    } catch {
      /* 주소를 바꾸지 못해도 화면은 그대로 */
    }
  };

  const navigate = (key: string) => {
    if (key === "tools" || key === "family") {
      setMoreView(key);
      setTab("more");
      window.location.hash = "more";
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const k = (TABS.some((t) => t.key === key) ? key : "home") as TabKey;
    if (k === "more") setMoreView("menu");
    setTab(k);
    writeTabToUrl(k);
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
      {/* 🔔 일정 알람 — 어느 탭을 보고 있어도 알람 시간이 되면 휴대폰 알림을 보낸다 */}
      <AlarmWatcher />
      <header className="sticky top-0 z-40 bg-paper/95 pt-safe backdrop-blur-md">
        <div className="flex h-[62px] items-center justify-between px-4">
          <button onClick={() => navigate("home")} className="flex items-center gap-2" aria-label="늘봄 홈">
            <NeulbomMark size={32} />
            <span className="text-[1.32rem] font-black leading-none tracking-[-0.05em] text-ink">늘봄</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={cycleFont}
              aria-label={`글씨 크기 바꾸기 — 지금 ${FONT_LABEL[fontSize]}, 누르면 ${FONT_ACTION[fontSize]}`}
              className="flex min-h-[48px] shrink-0 items-center gap-1 rounded-full border-2 border-brand/25 bg-brand-light px-2.5 shadow-soft active:scale-[0.98]"
            >
              <span
                aria-hidden
                className="font-black leading-none text-brand-dark"
                style={{ fontSize: fontSize === 18 ? 18 : fontSize === 21 ? 20 : 22 }}
              >
                가
              </span>
              <span className="whitespace-nowrap text-[13.5px] font-black leading-tight text-brand-dark">
                {FONT_ACTION[fontSize]}
              </span>
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
        {tab === "home" ? (
          <div className="space-y-3">
            <InstallBanner />
            <HomeTab onNavigate={navigate} onOpenCalendar={() => setCalendarOpen(true)} />
          </div>
        ) : null}
        {tab === "group" ? <GroupTab onNavigate={navigate} /> : null}
        {tab === "quiz" ? <QuizTab onNavigate={navigate} /> : null}
        {tab === "ranking" ? <RankingTab onNavigate={navigate} /> : null}
        {tab === "welfare" ? <WelfareTab onNavigate={navigate} /> : null}
        {tab === "more" ? (
          <MoreTab
            view={moreView}
            onView={setMoreView}
            onNavigate={navigate}
            onOpenCalendar={() => setCalendarOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
          />
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
                className="flex min-h-[72px] flex-col items-center justify-center px-1 py-1.5"
              >
                <span
                  className={`flex w-full max-w-[4.2rem] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 transition ${
                    active ? "bg-sky text-brand-deep shadow-[inset_0_0_0_1px_rgba(24,147,155,0.18)]" : "text-ink/45"
                  }`}
                >
                  <span className={`transition ${active ? "-translate-y-0.5 scale-105" : ""}`}>{t.icon}</span>
                  <span className={`text-[0.68rem] leading-none tracking-tight ${active ? "font-black" : "font-bold"}`}>
                    {t.label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <CalendarScreen open={calendarOpen} onClose={() => setCalendarOpen(false)} />

      {/* ‘주소창 없이 앱처럼 쓰기’ 안내 시트 — 어느 탭에서든 열 수 있게 셸에 둔다 */}
      <InstallGuide />

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
                <Avatar
                  name={profile.nickname}
                  src={profile.avatarUrl || profile.avatar}
                  size={56}
                  background="bg-brand-light"
                  className="text-brand-dark"
                  alt={`${profile.nickname} 님 프로필 사진`}
                />
                <div>
                  <p className="text-[1.15rem] font-black">{profile.nickname} 님</p>
                  <p className="text-[0.9rem] font-semibold text-ink/55">
                    {profile.birthYear}년생 ({2026 - profile.birthYear}세) · {profile.sido} {profile.sigungu}
                  </p>
                  <p className="mt-0.5 text-[0.86rem] font-semibold text-ink/45">
                    태어난 시간 · {birthTimeLabel(profile.birthTime)}
                  </p>
                  {profile.avatarUrl || profile.avatar ? (
                    <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#FEE500]/25 px-2 py-0.5 text-[0.78rem] font-extrabold text-[#3C1E1E]">
                      💬 카카오톡 사진 연동됨 · 랭킹·모임에 보여요
                    </p>
                  ) : (
                    <p className="mt-1 text-[0.78rem] font-semibold text-ink/40">
                      카카오톡으로 로그인하면 내 사진이 랭킹·모임에 보여요
                    </p>
                  )}
                </div>
              </div>
              <GradeSummaryRow />
              <div className="mt-3">
                <BigButton variant="white" full onClick={startEdit}>
                  내 정보 고치기
                </BigButton>
              </div>
              <Divider />
              <div className="flex items-center justify-between">
                <p className="text-[0.95rem] font-semibold text-ink/55">가족 연결 번호</p>
                <p className="tabular text-[1.1rem] font-black tracking-[0.16em] text-brand-dark">{code}</p>
              </div>
              <p className="mt-1 text-[0.8rem] font-medium leading-relaxed text-ink/45">
                이 번호를 자녀에게 알려 주면 가족 확인 화면에서 내 안부를 볼 수 있어요.
              </p>
            </div>
          )}
        </div>

        <div className="mt-3 rounded-3xl bg-white p-4 shadow-soft">
          <p className="mb-2 text-[1.02rem] font-black">글씨 크기 · 지금 {FONT_LABEL[fontSize]}</p>
          <div className="grid grid-cols-3 gap-2">
            {([18, 21, 24] as const).map((size, i) => (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                aria-pressed={fontSize === size}
                className={`min-h-[60px] rounded-2xl border-2 text-[1.02rem] font-extrabold ${
                  fontSize === size
                    ? "border-brand bg-brand text-white"
                    : "border-ink/10 bg-paper text-ink/70"
                }`}
              >
                {["보통", "크게", "아주 크게"][i]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[0.82rem] font-semibold leading-relaxed text-ink/50">
            화면 위쪽의 ‘가 글씨 크게’ 버튼을 눌러도 한 단계씩 커져요.
          </p>
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

/* ------------------------------------------------------------------ */
/* 더보기 탭 — 도구 · 가족/달력 · 설정을 한 번에                        */
/* ------------------------------------------------------------------ */

function MoreRow({
  emoji,
  title,
  sub,
  onClick,
}: {
  emoji: string;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card flex w-full items-center gap-3 p-3.5 text-left active:scale-[0.995]"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[1rem] bg-brand-light text-[1.5rem]">
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[1.02rem] font-black leading-tight text-ink">{title}</span>
        <span className="mt-0.5 block truncate text-[0.84rem] font-semibold text-ink/50">{sub}</span>
      </span>
      <IconChevron size={20} className="shrink-0 text-ink/25" />
    </button>
  );
}

function MoreTab({
  view,
  onView,
  onNavigate,
  onOpenCalendar,
  onOpenSettings,
}: {
  view: "menu" | "tools" | "family";
  onView: (v: "menu" | "tools" | "family") => void;
  onNavigate: (tab: string) => void;
  onOpenCalendar: () => void;
  onOpenSettings: () => void;
}) {
  const { active, detail } = useGroup();
  const { fontSize, setFontSize } = useApp();
  /** 개인정보처리방침 · 이용안내 시트 */
  const [privacyOpen, setPrivacyOpen] = useState(false);

  if (view === "tools" || view === "family") {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => onView("menu")}
          aria-label="더보기로 돌아가기"
          className="flex items-center gap-1 pt-1 text-[0.9rem] font-black text-ink/55"
        >
          <IconChevron size={18} className="rotate-180" /> 더보기
        </button>
        {view === "tools" ? <ToolsTab /> : <FamilyTab onNavigate={onNavigate} onOpenCalendar={onOpenCalendar} />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="fade-up pt-1">
        <Badge tone="brand">
          <IconMore size={13} /> 더보기
        </Badge>
        <h1 className="mt-1.5 text-[1.5rem] font-black leading-snug text-ink">도구 · 가족 · 설정</h1>
        <p className="mt-1 text-[0.9rem] font-semibold text-ink/55">필요한 기능을 한 번에 열 수 있어요.</p>
      </section>

      <CommunityStatsCard />

      <div className="fade-up grid grid-cols-1 gap-2">
        <MoreRow
          emoji="🔍"
          title="도구 모음"
          sub="돋보기 · 손전등 · 생활 가이드"
          onClick={() => onView("tools")}
        />
        <MoreRow
          emoji="👨‍👩‍👧"
          title="가족 확인 화면"
          sub="자녀가 부모님 안부를 확인해요"
          onClick={() => onView("family")}
        />
        <MoreRow
          emoji="🗓️"
          title="가족안부달력"
          sub="가족 일정 · 기념일 · 동네 소식"
          onClick={onOpenCalendar}
        />
        <MoreRow
          emoji="👥"
          title={active ? `${active.name} · 모임` : "우리 모임"}
          sub={
            active
              ? `멤버 ${detail?.memberCount ?? active.memberCount}명 · 오늘 ${detail?.todayAttended ?? 0}명 출석`
              : "모임을 만들고 가족을 초대해요"
          }
          onClick={() => onNavigate("group")}
        />
        <MoreRow
          emoji="⚙️"
          title="내 정보 · 설정"
          sub="이름 · 지역 · 글씨 크기 · 가족 연결 번호"
          onClick={onOpenSettings}
        />
        <MoreRow
          emoji="🔒"
          title="개인정보처리방침"
          sub="이용안내 · 광고 안내"
          onClick={() => setPrivacyOpen(true)}
        />
        <InstallGuideRow />
      </div>

      {/* 늘봄 안내 페이지 — 로그인 없이 누구나 열리는 공개 안내(검색으로도 들어온다) */}
      <div className="fade-up rounded-[1.5rem] bg-white p-4 shadow-soft">
        <p className="text-[1.02rem] font-black">늘봄 안내 페이지</p>
        <p className="mt-0.5 text-[0.84rem] font-semibold text-ink/50">가족에게도 보내 줄 수 있는 공개 안내예요</p>
        <div className="mt-2.5 space-y-2">
          <Link
            href="/guide/"
            className="flex min-h-[62px] items-center gap-3 rounded-2xl bg-paper px-3.5 py-2.5 active:scale-[0.995]"
          >
            <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-[0.9rem] bg-brand-light text-[1.35rem]">
              🎁
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[1rem] font-black leading-tight text-ink">어르신 복지 혜택 17가지</span>
              <span className="mt-0.5 block truncate text-[0.84rem] font-semibold text-ink/50">지원 대상·금액·신청 방법</span>
            </span>
            <IconChevron size={20} className="shrink-0 text-ink/25" />
          </Link>
          <Link
            href="/guide/quiz/"
            className="flex min-h-[62px] items-center gap-3 rounded-2xl bg-paper px-3.5 py-2.5 active:scale-[0.995]"
          >
            <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-[0.9rem] bg-gold-light text-[1.35rem]">
              🧠
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[1rem] font-black leading-tight text-ink">치매예방 퀴즈 소개</span>
              <span className="mt-0.5 block truncate text-[0.84rem] font-semibold text-ink/50">하루 5문제 · 433문항</span>
            </span>
            <IconChevron size={20} className="shrink-0 text-ink/25" />
          </Link>
        </div>
      </div>

      <div className="rounded-[1.5rem] bg-white p-4 shadow-soft">
        <p className="mb-2 text-[1.02rem] font-black">글씨 크기 · 지금 {FONT_LABEL[fontSize]}</p>
        <div className="grid grid-cols-3 gap-2">
          {([18, 21, 24] as const).map((size, i) => (
            <button
              key={size}
              type="button"
              onClick={() => setFontSize(size)}
              aria-pressed={fontSize === size}
              className={`min-h-[60px] rounded-2xl border-2 text-[1.02rem] font-extrabold ${
                fontSize === size ? "border-brand bg-brand text-white" : "border-ink/10 bg-paper text-ink/70"
              }`}
            >
              {["보통", "크게", "아주 크게"][i]}
            </button>
          ))}
        </div>
      </div>

      <p className="flex items-center justify-center gap-1.5 pb-1 text-[0.76rem] font-semibold text-ink/35">
        <NeulbomMark size={16} /> 늘봄과 함께, 더 편안한 하루
      </p>

      <PrivacySheet open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </div>
  );
}

export default function Page() {
  return (
    <AppProvider>
      <ToastProvider>
        <GroupProvider>
          <Shell />
        </GroupProvider>
      </ToastProvider>
    </AppProvider>
  );
}
