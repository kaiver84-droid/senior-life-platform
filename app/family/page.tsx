"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppProvider, useApp, calcStreak } from "@/lib/storage";
import { ToastProvider, Badge, BigButton, Card, Divider, SectionTitle, useToast } from "@/components/ui";
import { NeulbomLogo } from "@/components/art";
import { koreanDate } from "@/lib/week";
import { shortSido } from "@/lib/regions";
import { dayTitle, ddayLabel, kindInfo, upcomingEvents, type FamilyEvent } from "@/lib/calendar";
import { HEALTH_CHALLENGES, HEALTH_TOTAL } from "@/lib/health";
import { shareMetaFor } from "@/lib/og";
import { IconCalendar, IconPhone } from "@/components/icons";
import type { AppState } from "@/lib/types";

/** 자녀가 한 번 연결한 부모님 번호 — 다음부터는 주소 없이 /family/ 만 열어도 이어진다 */
const FAMILY_CODE_KEY = "neulbom.familyCode.v1";

/**
 * 부모님 번호 조회 상태.
 * - notfound: 서버에 그런 번호가 없다 → 이 기기(빈) 기록으로 대신 그리지 않고 안내만 한다.
 *   (예전에는 오타 한 번으로 “부모님이 오늘 앱에 접속했어요”라는 없는 안부가 보였다.)
 * - error: 통신이 잠깐 막혔다 → 역시 기록으로 대신 그리지 않고 다시 시도할 자리를 준다.
 */
type Lookup = "idle" | "loading" | "found" | "notfound" | "error";

type RemoteState = {
  profile: { nickname: string; birthYear: number; sido: string; sigungu: string } | null;
  quizLogs: { date: string; points: number; correct: number; total: number }[];
  med: Record<string, { morning: boolean; evening: boolean }>;
  /** 날짜별 건강 챌린지 체크인 — { "2026-11-17": ["water","medicine"] } */
  health: Record<string, string[]>;
  visits: string[];
  familyEvents?: FamilyEvent[];
};

function hhmm(d: Date | null): string {
  if (!d) return "-";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function Dashboard() {
  const { profile, state, today, streak, code, weekPoints, ready } = useApp();
  const [remote, setRemote] = useState<RemoteState | null>(null);
  const [linkedCode, setLinkedCode] = useState(" ".trim());
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [lookup, setLookup] = useState<Lookup>("idle");

  const queryCode = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("code") || "";
  }, []);

  /** 주소의 번호가 있으면 그것, 없으면 지난번에 연결한 번호 */
  const activeCode = (queryCode || linkedCode || "").trim().toUpperCase();

  // 지난번에 연결한 부모님 번호를 불러온다(한 번 연결하면 계속 기억)
  useEffect(() => {
    try {
      setLinkedCode(localStorage.getItem(FAMILY_CODE_KEY) || "");
    } catch {
      /* 저장소를 막아 둔 브라우저도 있다 */
    }
  }, []);

  // 탭 제목도 ‘가족 안부 확인’으로 — 서버가 넣은 미리보기 문구와 같게 맞춘다.
  useEffect(() => {
    const apply = () => {
      document.title = shareMetaFor("family").title;
    };
    apply();
    const t = setTimeout(apply, 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!activeCode) {
      setLookup("idle");
      return;
    }
    // 내 번호를 넣은 경우에는 부모님 조회가 아니라 이 기기 기록을 그대로 본다
    if (activeCode === code) {
      setLookup("found");
      return;
    }
    let alive = true;
    setLoading(true);
    setLookup("loading");
    fetch(`/api/state?code=${encodeURIComponent(activeCode)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j?.ok && j.state) {
          setRemote({
            profile: j.state.profile,
            quizLogs: j.state.quizLogs || [],
            med: j.state.med || {},
            health: j.state.health && typeof j.state.health === "object" ? j.state.health : {},
            visits: j.state.visits || [],
            familyEvents: Array.isArray(j.state.familyEvents) ? j.state.familyEvents : [],
          });
          setCheckedAt(new Date());
          setLookup("found");
          // 찾았을 때만 이 휴대폰에 기억한다 — 없는 번호를 남겨 두면 다음에도 같은 안내가 뜬다.
          try {
            if (localStorage.getItem(FAMILY_CODE_KEY) !== activeCode) {
              localStorage.setItem(FAMILY_CODE_KEY, activeCode);
              setLinkedCode(activeCode);
            }
          } catch {
            /* 저장소를 막아 둔 브라우저도 있다 */
          }
          // 주소창의 ?code= 는 지워 다음부터 번호 없이 열리게 한다.
          if (queryCode) {
            window.history.replaceState({}, "", "/family/");
          }
        } else if (j?.ok) {
          // 서버에 없는 번호 — 빈 기록으로 대신 그리지 않고 ‘찾을 수 없음’을 알린다.
          setRemote(null);
          setLookup("notfound");
          try {
            if (localStorage.getItem(FAMILY_CODE_KEY) === activeCode) {
              localStorage.removeItem(FAMILY_CODE_KEY);
            }
          } catch {
            /* 무시 */
          }
        } else {
          setLookup("error");
        }
      })
      .catch(() => {
        if (alive) setLookup("error");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [ready, activeCode, code, queryCode, tick]);

  // 1분마다 저절로 새로 고칩니다 — 자녀가 화면을 켜 두면 늘 최신 상태
  useEffect(() => {
    if (!activeCode || lookup !== "found") return;
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, [activeCode, lookup]);

  /**
   * 주소에 ?code= 가 있거나 지난번에 연결한 부모님 번호가 있으면 **부모님 데이터를 보여 준다**.
   * (예전에는 이 기기에 내 프로필이 있으면 부모님 데이터를 버리고 내 기록을 그려서,
   *  자녀가 늘봄을 쓰는 기기에서는 부모님 안부가 자기 기록으로 보였다.)
   * 내 데이터를 쓰는 경우는 부모님 번호가 전혀 없는 `/family/` 뿐이다.
   */
  const useRemote = Boolean(remote) && Boolean(activeCode);
  const data: {
    name: string;
    birthYear: number;
    region: string;
    quizLogs: AppState["quizLogs"];
    med: AppState["med"];
    health: Record<string, string[]>;
    visits: string[];
    familyEvents: FamilyEvent[];
  } =
    useRemote && remote
      ? {
          name: remote.profile?.nickname || "부모님",
          birthYear: remote.profile?.birthYear || 1955,
          region: `${shortSido(remote.profile?.sido || "")} ${remote.profile?.sigungu || ""}`.trim(),
          quizLogs: remote.quizLogs as AppState["quizLogs"],
          med: remote.med,
          health: remote.health,
          visits: remote.visits,
          familyEvents: remote.familyEvents || [],
        }
      : {
          name: profile?.nickname || "부모님",
          birthYear: profile?.birthYear || 1955,
          region: `${shortSido(profile?.sido || "")} ${profile?.sigungu || ""}`.trim(),
          quizLogs: state.quizLogs,
          med: state.med,
          health: state.health,
          visits: state.visits,
          familyEvents: state.familyEvents,
        };

  const todayMed = data.med[today] ?? { morning: false, evening: false };
  /** 오늘 부모님이 직접 찍은 건강 도장 5종 (복약·물·걷기·체조·안부전화) */
  const todayHealth = Array.isArray(data.health?.[today]) ? data.health[today] : [];
  const medicineDone = todayHealth.includes("medicine");
  const todayLogs = data.quizLogs.filter((q) => q.date === today);
  const todayPoints = todayLogs.reduce((a, b) => a + b.points, 0);
  /** 오늘 하루 미션(5문제)을 마친 기록 — 연습 모드만 푼 날(total 0)은 ‘아직’으로 보인다 */
  const todayMission = todayLogs.find((q) => (Number(q.total) || 0) > 0) ?? null;
  const visitedToday = data.visits.includes(today);
  const parentStreak = calcStreak({ ...state, quizLogs: data.quizLogs, med: data.med, visits: data.visits }, today);
  const familyUpcoming = upcomingEvents(data.familyEvents, today, 180, 4);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });

  if (!ready) {
    return <div className="p-8 text-center font-bold text-ink/45">불러오는 중…</div>;
  }

  /** 번호를 넣고 가족 화면을 연다 — 저장은 서버에서 찾은 뒤에 한다(없는 번호를 남기지 않게) */
  const submitCode = (c: string) => {
    try {
      localStorage.setItem(FAMILY_CODE_KEY, c);
    } catch {
      /* 무시 */
    }
    window.location.href = `/family/?code=${c}`;
  };

  /* 없는 번호이거나 잠깐 못 불러왔을 때 — 이 기기 기록으로 대신 그리지 않고 그대로 알려 준다 */
  if (activeCode && !remote && (lookup === "notfound" || lookup === "error")) {
    const notFound = lookup === "notfound";
    return (
      <div className="mx-auto max-w-[460px] px-3 pb-10 pt-[calc(env(safe-area-inset-top,0px)+16px)]">
        <div className="mb-4 flex justify-center">
          <NeulbomLogo size={34} tagline />
        </div>
        <CodeEntryCard
          title={notFound ? "입력하신 가족 코드를 찾을 수 없어요" : "부모님 정보를 불러오지 못했어요"}
          desc={
            notFound ? (
              <>
                코드를 다시 확인해 주세요. 부모님 휴대폰의 <b className="text-ink">가족 연결</b> 화면에 있는 6자리
                번호예요.
              </>
            ) : (
              <>잠시 뒤 다시 시도해 주세요. 인터넷이 느릴 때는 한 번 더 눌러 주면 이어져요.</>
            )
          }
          initial={activeCode}
          actionLabel={notFound ? "다시 확인하기" : "다시 불러오기"}
          onSubmit={(c) => {
            if (!notFound && c === activeCode) {
              setLookup("loading");
              setTick((n) => n + 1);
              return;
            }
            submitCode(c);
          }}
        />
        <Link href="/" className="mt-4 block text-center text-[0.92rem] font-bold text-brand">
          ← 처음 화면으로
        </Link>
      </div>
    );
  }

  /* 번호는 있는데 아직 서버에서 받기 전 — 빈 기록을 부모님 안부처럼 보여 주지 않는다 */
  if (activeCode && !remote && (lookup === "loading" || lookup === "idle")) {
    return (
      <div className="mx-auto max-w-[460px] px-4 py-10 text-center">
        <div className="flex justify-center">
          <NeulbomLogo size={34} tagline />
        </div>
        <p className="mt-5 text-[1.05rem] font-black text-ink/70">부모님 안부를 불러오는 중…</p>
        <p className="mt-1 text-[0.9rem] font-semibold text-ink/45">잠시만 기다려 주세요.</p>
      </div>
    );
  }

  if (!profile && !remote && !activeCode) {
    return (
      <div className="mx-auto max-w-[460px] px-3 pb-10 pt-[calc(env(safe-area-inset-top,0px)+16px)]">
        <div className="mb-4 flex justify-center">
          <NeulbomLogo size={34} tagline />
        </div>
        <CodeEntryCard
          title="아직 연결된 부모님이 없어요"
          desc={
            <>
              부모님 휴대폰의 <b className="text-ink">가족 연결</b> 화면에서 6자리 가족 연결 번호를 받아 아래에 넣어
              주세요.
            </>
          }
          actionLabel="부모님 안부 확인하기"
          onSubmit={submitCode}
          footer={
            <p className="mt-3 text-center text-[0.84rem] font-semibold leading-relaxed text-ink/50">
              한 번만 연결하면 이 휴대폰에 기억해 두어, 다음부터는 번호 없이 <b className="text-ink">/family/</b> 만
              열어도 부모님의 오늘 약·건강 상태가 보여요.
            </p>
          }
        />
        <Link href="/" className="mt-4 block text-center text-[0.92rem] font-bold text-brand">
          ← 처음 화면으로
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[460px] px-4 pb-10 pt-[calc(env(safe-area-inset-top,0px)+16px)]">
      <div className="mb-4 flex items-center justify-between">
        <NeulbomLogo size={30} onClick={undefined} />
        <Link
          href="/"
          className="whitespace-nowrap rounded-full border border-ink/10 bg-white px-3 py-2 text-[0.78rem] font-extrabold text-ink/70 shadow-soft"
        >
          부모님 화면
        </Link>
      </div>

      <div className="mb-4">
        <Badge tone="coral">자녀 확인 화면</Badge>
        <h1 className="mt-1.5 text-[1.45rem] font-black leading-tight text-ink">{data.name} 님의 오늘</h1>
        <p className="flex items-center gap-1 text-[0.86rem] font-semibold text-ink/55">
          <IconCalendar size={15} /> {koreanDate(today)} · {data.region || "지역 미설정"} · {2026 - data.birthYear}세
        </p>
      </div>

      {loading ? <p className="mb-2 text-center text-[0.85rem] font-bold text-ink/45">불러오는 중…</p> : null}

      {/* 💊 오늘 약 복용 상태 — 자녀가 가장 먼저 보는 카드 */}
      <Card
        className={`mb-3 rounded-[1.6rem] border-2 p-4 ${
          medicineDone ? "border-leaf/35 bg-leaf-light/40" : "border-coral/25 bg-coral-light/25"
        }`}
      >
        <div data-family-medicine className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[1.06rem] font-black text-ink">💊 오늘 약 복용 상태</p>
          <button
            type="button"
            data-family-refresh
            onClick={() => setTick((n) => n + 1)}
            className="flex min-h-[40px] shrink-0 items-center gap-1 rounded-full border-2 border-ink/10 bg-white px-3 text-[0.8rem] font-extrabold text-ink/70 active:bg-paper"
          >
            🔄 새로고침
          </button>
        </div>
        <p
          className={`mt-2 text-[1.5rem] font-black leading-tight ${
            medicineDone ? "text-leaf-dark" : "text-coral-dark"
          }`}
        >
          {medicineDone ? "약 챙기기 완료 ✓" : "아직 약을 챙기지 않았어요"}
        </p>
        <p className="mt-1 text-[0.86rem] font-semibold text-ink/55">
          오늘 건강 도장 {todayHealth.length}/{HEALTH_TOTAL}개 · 최근 확인 {hhmm(checkedAt)}
          {loading ? " (불러오는 중…)" : ""}
        </p>

        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {HEALTH_CHALLENGES.map((c) => {
            const done = todayHealth.includes(c.id);
            return (
              <div
                key={c.id}
                data-health-chip={c.id}
                data-done={done ? "1" : "0"}
                className={`rounded-2xl px-1 py-2 text-center ${done ? "bg-white shadow-soft" : "bg-white/45"}`}
              >
                <span className={`block text-[1.12rem] leading-none ${done ? "" : "opacity-30 grayscale"}`}>
                  {c.emoji}
                </span>
                <span
                  className={`mt-1 block text-[0.64rem] font-extrabold leading-tight ${
                    done ? "text-leaf-dark" : "text-ink/35"
                  }`}
                >
                  {c.title.split(" ")[0]}
                </span>
                <span className={`mt-0.5 block text-[0.62rem] font-black ${done ? "text-leaf-dark" : "text-ink/25"}`}>
                  {done ? "✓" : "·"}
                </span>
              </div>
            );
          })}
        </div>

        <p className="mt-2 text-[0.78rem] font-semibold leading-relaxed text-ink/45">
          부모님이 홈에서 ‘복약 챙기기’를 누르면 여기에 바로 나타나요. 1분마다 저절로 새로 고쳐요.
        </p>
      </Card>

      <Card className="mb-3 rounded-[1.6rem] bg-gradient-to-br from-white to-brand-light/50 p-4">
        <div className="flex items-center gap-3">
          <div
            className={`grid h-14 w-14 place-items-center rounded-2xl text-[1.5rem] ${
              visitedToday ? "bg-leaf-light" : "bg-coral-light"
            }`}
          >
            {visitedToday ? "✅" : "⏰"}
          </div>
          <div>
            <p className="text-[1.05rem] font-black">{visitedToday ? "오늘 앱에 접속했어요" : "오늘 아직 접속하지 않았어요"}</p>
            <p className="text-[0.86rem] font-semibold text-ink/55">
              최근 접속 {data.visits.length > 0 ? data.visits[data.visits.length - 1].replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1년 $2월 $3일") : "-"}
            </p>
          </div>
        </div>
      </Card>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-[0.82rem] font-extrabold text-ink/50">아침 약</p>
          <p className={`mt-1 text-[1.15rem] font-black ${todayMed.morning ? "text-leaf-dark" : "text-ink/35"}`}>
            {todayMed.morning ? "✓ 먹었어요" : "○ 아직"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[0.82rem] font-extrabold text-ink/50">저녁 약</p>
          <p className={`mt-1 text-[1.15rem] font-black ${todayMed.evening ? "text-leaf-dark" : "text-ink/35"}`}>
            {todayMed.evening ? "✓ 먹었어요" : "○ 아직"}
          </p>
        </Card>
      </div>

      <Card className="mb-3 p-4">
        <SectionTitle emoji="🧠" right={<Badge tone="leaf">🔥 {parentStreak}일 연속</Badge>}>
          오늘의 기억 활동
        </SectionTitle>
        <p className="text-[1rem] font-black">
          {todayMission ? `퀴즈 ${todayMission.correct}/${todayMission.total} 정답` : "아직 퀴즈를 하지 않았어요"}
        </p>
        <p className="text-[0.86rem] font-semibold text-ink/55">
          {todayPoints > 0 ? `오늘 ${todayPoints}점 획득` : "1분이면 충분해요"}
        </p>
        <Divider />
        <p className="mb-2 text-[0.82rem] font-extrabold text-ink/50">최근 7일</p>
        <div className="flex justify-between gap-1">
          {days.map((d) => {
            const did = data.visits.includes(d) || data.quizLogs.some((q) => q.date === d);
            const m = data.med[d];
            const tookMed = Boolean(m?.morning || m?.evening);
            return (
              <div key={d} className="flex-1 text-center">
                <div
                  className={`mx-auto mb-1 grid h-9 w-9 place-items-center rounded-full text-[0.78rem] font-black ${
                    did ? "bg-brand text-white" : "bg-ink/6 text-ink/30"
                  }`}
                >
                  {d.slice(8, 10)}
                </div>
                <span className={`text-[0.68rem] font-bold ${tookMed ? "text-leaf-dark" : "text-ink/25"}`}>
                  {tookMed ? "약✓" : "·"}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="mb-3 rounded-[1.6rem] bg-gradient-to-br from-gold-light to-white p-4">
        <p className="text-[1.05rem] font-black">이번 주 {weekPoints}점</p>
        <p className="mt-1 text-[0.9rem] font-semibold text-ink/60">
          부모님이 꾸준히 참여하고 계세요. 전화 한 통 어떠세요?
        </p>
        <div className="mt-3">
          <BigButton
            variant="coral"
            full
            onClick={() => {
              window.location.href = `tel:`;
            }}
          >
            <IconPhone size={20} /> 부모님께 전화하기
          </BigButton>
        </div>
      </Card>

      <Card className="mb-3 rounded-[1.6rem] p-4">
        <SectionTitle emoji="📅" right={<Badge tone="gold">함께 보는 달력</Badge>}>
          가족 일정
        </SectionTitle>
        {familyUpcoming.length === 0 ? (
          <p className="text-[0.92rem] font-semibold leading-relaxed text-ink/55">
            아직 달력에 넣어 둔 일정이 없어요. 부모님 화면의 <b className="text-ink">가족</b> 탭에서 생일·기념일을
            넣으면 여기에 함께 보여요.
          </p>
        ) : (
          <div className="space-y-1.5">
            {familyUpcoming.map((u) => (
              <div key={`${u.event.id}-${u.date}`} className="flex items-center gap-2 rounded-xl bg-paper px-3 py-2">
                <span aria-hidden>{kindInfo(u.event.kind).emoji}</span>
                <span className="min-w-0 flex-1 truncate text-[0.95rem] font-black text-ink">{u.event.title}</span>
                <span className="shrink-0 text-[0.78rem] font-bold text-ink/50">{dayTitle(u.date)}</span>
                <span className="shrink-0 rounded-full bg-coral-light px-2 py-0.5 text-[0.72rem] font-black text-coral-dark">
                  {ddayLabel(u.days)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <p className="mt-2 rounded-2xl bg-white/70 px-4 py-3 text-center text-[0.78rem] font-semibold leading-relaxed text-ink/45">
        {activeCode ? (
          <>
            가족 연결 번호 <b className="tabular text-ink/70">{activeCode}</b> 로 연결되었어요. 이 휴대폰에 기억해 두어
            다음부터는 번호 없이 열려요. 부모님 정보는 안부 확인 목적으로만 보여 드려요.
          </>
        ) : (
          <>이 화면은 부모님이 보낸 가족 연결 번호로 열렸어요. 부모님 정보는 안부 확인 목적으로만 보여 드려요.</>
        )}
      </p>
      {activeCode ? (
        <button
          type="button"
          data-family-unlink
          onClick={() => {
            try {
              localStorage.removeItem(FAMILY_CODE_KEY);
            } catch {
              /* 무시 */
            }
            window.location.href = "/family/";
          }}
          className="mt-2 w-full py-2 text-center text-[0.84rem] font-bold text-ink/40 underline"
        >
          다른 부모님 연결하기
        </button>
      ) : null}
    </div>
  );
}

/**
 * 가족 연결 번호를 넣는 카드.
 * ‘아직 연결된 부모님이 없어요’ 화면과 ‘번호를 찾을 수 없어요’ 화면이 같은 모양·같은 동작을 쓴다.
 */
function CodeEntryCard({
  title,
  desc,
  initial = "",
  actionLabel,
  onSubmit,
  footer,
}: {
  title: string;
  desc: React.ReactNode;
  initial?: string;
  actionLabel: string;
  onSubmit: (code: string) => void;
  footer?: React.ReactNode;
}) {
  const [value, setValue] = useState(initial);
  const { show } = useToast();

  const submit = () => {
    const c = value.trim().toUpperCase();
    if (c.length < 6) {
      show("6자리 코드를 넣어 주세요.");
      return;
    }
    onSubmit(c);
  };

  return (
    <Card className="rounded-[1.75rem] p-5">
      <p className="text-center text-[1.1rem] font-black leading-snug">{title}</p>
      <p className="mt-2 text-center text-[0.92rem] font-semibold leading-relaxed text-ink/60">{desc}</p>
      <Divider />
      <input
        className="field text-center text-[1.4rem] font-black tracking-[0.3em]"
        placeholder="가족 연결 번호 6자리"
        aria-label="가족 연결 번호 6자리"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        value={value}
        maxLength={6}
        onChange={(e) => setValue(e.target.value.toUpperCase())}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
      />
      <div className="mt-3">
        <BigButton full variant="ink" onClick={submit}>
          {actionLabel}
        </BigButton>
      </div>
      {footer}
    </Card>
  );
}

export default function FamilyPage() {
  return (
    <AppProvider>
      <ToastProvider>
        <div className="min-h-dvh bg-paper">
          <Dashboard />
        </div>
      </ToastProvider>
    </AppProvider>
  );
}
