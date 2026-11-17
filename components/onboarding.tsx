"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { makeCode, useApp } from "@/lib/storage";
import { kakaoAuthorizeNow, kakaoConfig, loadKakaoSdk, startKakaoLogin } from "@/lib/share";
import { UNKNOWN_BIRTH_TIME } from "@/lib/birthtime";
import { BigButton, Card, useToast } from "./ui";
import { AssetImage, Icon3D, NeulbomMark, type Icon3DName } from "./art";
import {
  DEFAULT_SIDO,
  DEFAULT_SIGUNGU,
  ProfileFields,
  emptyDraft,
  normalizeBirthYear,
  type ProfileDraft,
} from "./profile-fields";

/** 로그인은 마쳤지만 초기 설정을 마치기 전에 새로고침해도 이어서 하도록 잠깐 보관 */
const PENDING_KEY = "seniorLife.pendingLogin";

type PendingLogin = {
  /** 카카오 회원번호 기반 id(kakao_xxx) — 다른 기기에서 다시 로그인해도 같은 사람으로 이어진다 */
  id: string;
  nickname: string;
  birthYear?: number;
  avatar?: string;
  source: "demo" | "kakao";
};

type Phase = "login" | "setup";

function readPending(): PendingLogin | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingLogin;
    return parsed && parsed.id ? parsed : null;
  } catch {
    return null;
  }
}

function writePending(p: PendingLogin | null) {
  if (typeof window === "undefined") return;
  try {
    if (p) window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
    else window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* 저장 공간이 없어도 로그인 흐름은 계속 */
  }
}

export function Onboarding() {
  const { saveProfile } = useApp();
  const { show } = useToast();

  const [phase, setPhase] = useState<Phase>("login");
  const [pending, setPending] = useState<PendingLogin | null>(null);
  const [draft, setDraft] = useState<ProfileDraft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [kakaoStarting, setKakaoStarting] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [checking, setChecking] = useState(false);
  const [kakao, setKakao] = useState<{
    configured: boolean;
    jsConfigured: boolean;
    redirectUri: string;
    ready: boolean;
  }>({ configured: false, jsConfigured: false, redirectUri: "", ready: false });

  // 카카오가 돌려준 인가 코드 — 서버 설정(redirectUri)을 받은 뒤 교환한다.
  const codeRef = useRef<string | null>(null);
  const exchangeStarted = useRef(false);
  const restoreStarted = useRef(false);

  const patchDraft = useCallback((patch: Partial<ProfileDraft>) => setDraft((d) => ({ ...d, ...patch })), []);

  /* ---------------- 로그인한 사람의 프로필을 서버에서 찾는다 ---------------- */
  // 이미 초기 설정을 마친 분이면 그대로 홈으로, 처음이면 설정 화면으로.
  const enterAfterLogin = useCallback(
    async (who: PendingLogin) => {
      setChecking(true);
      let remote: {
        nickname?: string;
        birthYear?: number;
        birthTime?: string;
        sido?: string;
        sigungu?: string;
        profileCompleted?: boolean;
      } | null = null;
      try {
        const res = await fetch(`/api/state?code=${encodeURIComponent(makeCode(who.id))}`);
        const json = await res.json();
        if (json?.ok && json.state?.profile) remote = json.state.profile;
      } catch {
        /* 서버를 못 보면 처음 하는 것으로 보고 설정 화면을 보여 준다 */
      } finally {
        setChecking(false);
      }

      if (remote?.profileCompleted && (remote.nickname || "").trim()) {
        writePending(null);
        setPending(null);
        saveProfile({
          id: who.id,
          nickname: String(remote.nickname),
          birthYear: normalizeBirthYear(remote.birthYear),
          birthTime: remote.birthTime || UNKNOWN_BIRTH_TIME,
          sido: remote.sido || DEFAULT_SIDO,
          sigungu: remote.sigungu || DEFAULT_SIGUNGU,
          source: who.source,
          avatar: who.avatar,
          profileCompleted: true,
        });
        show(`${remote.nickname} 님, 다시 오셨네요!`);
        return;
      }

      const next: PendingLogin = {
        ...who,
        nickname: String(remote?.nickname || who.nickname || "").trim(),
        birthYear: remote?.birthYear ? Number(remote.birthYear) : who.birthYear,
      };
      writePending(next);
      setPending(next);
      setDraft({
        ...emptyDraft(),
        nickname: next.nickname,
        birthYear: normalizeBirthYear(next.birthYear),
        birthTime: remote?.birthTime || UNKNOWN_BIRTH_TIME,
        sido: remote?.sido || DEFAULT_SIDO,
        sigungu: remote?.sigungu || DEFAULT_SIGUNGU,
      });
      setPhase("setup");
    },
    [saveProfile, show]
  );

  /* ---------------- 서버 설정 + 카카오 콜백 ---------------- */
  useEffect(() => {
    // 카카오 SDK 미리 로드 — 버튼을 누르는 순간 authorize 가 사용자 제스처 안에서 바로 실행되게 한다.
    // (iOS Safari 는 제스처 밖 이동을 막아 카카오톡 앱이 안 열릴 수 있다)
    if (kakaoConfig().configured) void loadKakaoSdk();

    // 새로고침으로 돌아왔을 때: 로그인은 했고 설정만 남은 상태
    const saved = readPending();
    if (saved) {
      setPending(saved);
      setDraft((d) => ({ ...d, nickname: saved.nickname, birthYear: normalizeBirthYear(saved.birthYear) }));
      setPhase("setup");
    }

    // 서버가 실제 토큰 교환에 쓰는 redirectUri 를 그대로 받아 둔다(클라이언트와 100% 동일하게 유지).
    fetch("/api/auth/kakao")
      .then((r) => r.json())
      .then((j) => {
        setKakao({
          configured: Boolean(j?.kakaoLoginConfigured),
          jsConfigured: Boolean(j?.kakaoJsConfigured),
          redirectUri: String(j?.redirectUri || window.location.origin).replace(/\/+$/, ""),
          ready: true,
        });
      })
      .catch(() => setKakao((k) => ({ ...k, redirectUri: window.location.origin, ready: true })));

    // 카카오 로그인 콜백(?code=... / ?error=...) — 주소창에서 코드를 지우고 보관만 한다
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");
    if (!code && !error) return;
    window.history.replaceState({}, "", window.location.pathname);
    if (error) {
      setLoginError("카카오톡 로그인을 취소했어요. 다시 한 번 눌러 주세요.");
      return;
    }
    codeRef.current = code;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- 인가 코드 교환 ---------------- */
  useEffect(() => {
    if (!kakao.ready || !codeRef.current || exchangeStarted.current) return;
    const code = codeRef.current;
    codeRef.current = null;
    exchangeStarted.current = true;
    setBusy(true);
    setLoginError("");
    fetch("/api/auth/kakao", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, redirectUri: kakao.redirectUri }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (!j?.ok || !j.profile) {
          setLoginError("카카오 로그인에 실패했어요. 잠시 뒤 다시 눌러 주세요.");
          return;
        }
        const p = j.profile as { id?: string; nickname?: string; birthYear?: number; avatar?: string };
        const who: PendingLogin = {
          id: String(p.id || `kakao_${Date.now().toString(36)}`),
          nickname: String(p.nickname || "").trim(),
          birthYear: normalizeBirthYear(p.birthYear),
          avatar: p.avatar,
          source: "kakao",
        };
        void enterAfterLogin(who);
      })
      .catch(() => setLoginError("카카오 로그인에 실패했어요. 잠시 뒤 다시 눌러 주세요."))
      .finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kakao.ready, kakao.redirectUri]);

  /* ---------------- 카카오톡으로 시작하기 ---------------- */
  const startKakao = async () => {
    if (busy || kakaoStarting || checking) return;
    setLoginError("");
    const redirectUri = (kakao.redirectUri || window.location.origin).replace(/\/+$/, "");
    const fallback = () => {
      setKakaoStarting(false);
      window.location.href = "/api/auth/kakao?start=1";
    };
    // 1) 카카오 JS SDK 간편로그인: 모바일에서 카카오톡 앱이 바로 열려 아이디·비밀번호 없이 인증한다.
    //    동의를 마치면 redirectUri 로 ?code= 가 돌아온다. (정상 호출이면 페이지가 떠난다)
    if (kakao.jsConfigured) {
      setKakaoStarting(true);
      // 이미 로드된 SDK 라면 클릭(사용자 제스처) 안에서 곧바로 호출한다
      if (kakaoAuthorizeNow(redirectUri)) {
        window.setTimeout(() => setKakaoStarting(false), 8000);
        return;
      }
      const started = await startKakaoLogin(redirectUri);
      if (started) {
        window.setTimeout(() => setKakaoStarting(false), 8000);
        return;
      }
      fallback();
      return;
    }
    // 2) SDK 를 쓸 수 없는 환경(구형 브라우저, 스크립트 차단)은 서버를 거치는 인가 화면으로 폴백
    fallback();
  };

  /* ---------------- 카카오 키가 없는 개발 환경에서만 ---------------- */
  const startPreview = () => {
    if (busy) return;
    const who: PendingLogin = {
      id: `u_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      nickname: "",
      birthYear: undefined,
      source: "demo",
    };
    writePending(who);
    setPending(who);
    setDraft(emptyDraft());
    setPhase("setup");
  };

  /* ---------------- 최초 1회 설정 저장 ---------------- */
  const submit = async () => {
    if (!pending || busy) return;
    const name = draft.nickname.trim();
    if (name.length < 1) {
      show("이름을 먼저 적어 주세요.");
      return;
    }
    if (!draft.sido || !draft.sigungu) {
      show("사는 지역을 골라 주세요.");
      return;
    }
    setBusy(true);
    const profile = {
      id: pending.id,
      nickname: name,
      birthYear: normalizeBirthYear(draft.birthYear),
      birthTime: draft.birthTime || UNKNOWN_BIRTH_TIME,
      sido: draft.sido,
      sigungu: draft.sigungu,
      source: pending.source,
      avatar: pending.avatar,
      profileCompleted: true,
    };

    // 서버(Supabase)에 먼저 알려 둔다 — 다른 기기에서 다시 로그인해도 설정 화면을 건너뛰게.
    // 실패해도 이 기기(localStorage)에는 저장되므로 시작을 막지 않는다.
    try {
      await fetch("/api/state", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: makeCode(pending.id),
          profile: { ...profile, createdAt: new Date().toISOString() },
        }),
      });
    } catch {
      /* 오프라인이어도 이 기기 저장으로 계속 */
    }

    writePending(null);
    setPending(null);
    saveProfile(profile);
    show(`${name} 님, 반갑습니다! 오늘부터 함께해요.`);
  };

  const relogin = () => {
    writePending(null);
    setPending(null);
    setPhase("login");
    setLoginError("");
    setDraft(emptyDraft());
  };

  /* ================= 최초 1회 초기 설정 화면 ================= */
  if (phase === "setup" && pending) {
    return (
      <div className="min-h-dvh bg-paper px-4 pt-[calc(env(safe-area-inset-top,0px)+22px)]">
        <div className="mx-auto max-w-[460px] pb-10">
          <div className="mb-4 flex items-center gap-2">
            <NeulbomMark size={38} />
            <div>
              <p className="text-[1.1rem] font-black leading-none tracking-[-0.04em] text-ink">늘봄</p>
              <p className="mt-1 text-[0.8rem] font-bold text-ink/45">처음 한 번만 여쭤볼게요</p>
            </div>
          </div>

          <Card className="rounded-[1.75rem] p-5">
            <p className="text-[1.18rem] font-black leading-snug text-ink">
              {pending.nickname ? `${pending.nickname} 님, 반가워요!` : "반가워요!"}
            </p>
            <p className="mb-4 mt-1 text-[0.94rem] font-semibold leading-relaxed text-ink/60">
              다섯 가지만 알려 주시면
              <br />
              딱 맞는 운세와 혜택을 챙겨 드릴게요.
            </p>

            <ProfileFields value={draft} onChange={patchDraft} idPrefix="setup" autoFocus={!pending.nickname} />

            <div className="mt-4">
              <BigButton variant="ink" size="lg" full onClick={submit} disabled={busy || checking}>
                {busy ? "저장하는 중..." : "저장하고 늘봄 시작하기"}
              </BigButton>
            </div>
            <p className="mt-2.5 text-center text-[0.82rem] font-semibold leading-relaxed text-ink/45">
              한 번만 저장하면 다음부터는 카카오톡으로 바로 시작돼요.
              <br />
              ⚙ 설정에서 언제든 고칠 수 있어요.
            </p>
          </Card>

          <button
            type="button"
            onClick={relogin}
            className="mx-auto mt-4 block text-[0.86rem] font-bold text-ink/40 underline underline-offset-2"
          >
            다른 카카오 계정으로 로그인
          </button>
        </div>
      </div>
    );
  }

  /* ================= 첫 화면 · 카카오톡 로그인 전용 ================= */
  const canStart = kakao.ready && kakao.configured;
  return (
    <div className="min-h-dvh bg-paper px-4 pt-[calc(env(safe-area-inset-top,0px)+30px)]">
      <div className="mx-auto flex min-h-[calc(100dvh-60px)] max-w-[460px] flex-col justify-between pb-8">
        <div>
          {/* 초고화질 감성 배너 — 맑은 봄 하늘 · 노란 국화 · 환하게 웃는 가족 */}
          <section className="mb-4 overflow-hidden rounded-[1.9rem] bg-[#CFE7F7] shadow-card">
            <div className="relative h-[198px] overflow-hidden">
              <AssetImage
                name="onboarding-hero"
                alt="파란 봄 하늘 아래 노란 국화꽃과 함께 환하게 웃는 가족"
                priority
                className="absolute inset-0 h-full w-full object-cover object-[50%_46%]"
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-[66%]"
                style={{
                  background:
                    "linear-gradient(to top, rgba(11,34,51,0.90) 0%, rgba(11,34,51,0.62) 30%, rgba(11,34,51,0.24) 62%, rgba(11,34,51,0))",
                }}
              />
              <div className="absolute inset-x-0 bottom-0 px-4 pb-3.5">
                <div className="flex items-center gap-1.5">
                  <NeulbomMark size={32} />
                  <h1 className="text-[2rem] font-black leading-none tracking-[-0.055em] text-white">늘봄</h1>
                </div>
                <p className="mt-1.5 text-[0.86rem] font-bold leading-snug text-white/90">
                  언제나, 늘 곁에 있는
                  <br />
                  시니어를 위한 스마트한 생활 플랫폼
                </p>
              </div>
            </div>
          </section>

          <Card className="rounded-[1.75rem] p-5">
            <p className="text-center text-[1.06rem] font-black leading-snug text-ink">카카오톡으로 바로 시작해요</p>
            <p className="mt-1 text-center text-[0.9rem] font-semibold leading-relaxed text-ink/55">
              아이디와 비밀번호를 새로 만들거나 입력할 필요 없이
              <br />
              카카오톡 버튼만 누르면 바로 인증돼요.
            </p>

            <button
              type="button"
              onClick={startKakao}
              disabled={!canStart || busy || kakaoStarting}
              className="mt-4 flex min-h-[64px] w-full items-center justify-center gap-2 rounded-2xl bg-[#FEE500] px-4 text-[1.12rem] font-extrabold text-[#3C1E1E] shadow-sm transition active:scale-[0.99] disabled:opacity-50"
            >
              <span aria-hidden className="text-[1.25rem]">
                💬
              </span>
              {kakaoStarting || busy ? "카카오톡 여는 중..." : checking ? "확인하는 중..." : "카카오톡으로 시작하기"}
            </button>

            {loginError ? (
              <p className="mt-3 rounded-2xl bg-coral-light px-3 py-2.5 text-center text-[0.9rem] font-bold leading-relaxed text-coral-dark">
                {loginError}
              </p>
            ) : (
              <p className="mt-2.5 text-center text-[0.82rem] font-semibold leading-relaxed text-ink/45">
                버튼을 누르면 카카오톡이 열려요. 화면에 나오는 대로 [확인]만 눌러 주세요.
                <br />
                처음 한 번만 이름·태어난 시간·사는 곳을 여쭤봐요.
              </p>
            )}

            {!kakao.ready ? (
              <p className="mt-3 text-center text-[0.8rem] font-medium text-ink/35">잠시만 기다려 주세요…</p>
            ) : null}

            {kakao.ready && !kakao.configured ? (
              <div className="mt-4 rounded-2xl border-2 border-dashed border-ink/12 p-3">
                <p className="text-center text-[0.82rem] font-bold leading-relaxed text-ink/45">
                  지금은 카카오 로그인 키가 없는 개발용 화면이라
                  <br />
                  둘러보기로 먼저 확인할 수 있어요.
                </p>
                <button
                  type="button"
                  onClick={startPreview}
                  className="mt-2 w-full rounded-xl border-2 border-ink/10 bg-white px-4 py-3 text-[0.95rem] font-extrabold text-ink/70"
                >
                  카카오 없이 둘러보기 (개발용)
                </button>
              </div>
            ) : null}
          </Card>
        </div>

        <div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {(
              [
                ["icon-3d-sun-fortune", "오늘의 운세"],
                ["icon-3d-quiz-trophy", "1분 퀴즈"],
                ["icon-3d-welfare-gift", "맞춤 혜택"],
              ] as [Icon3DName, string][]
            ).map(([icon, label]) => (
              <div key={label} className="rounded-2xl bg-white/85 px-2 pb-2.5 pt-2 shadow-soft">
                <Icon3D name={icon} size={46} className="mx-auto drop-shadow-[0_6px_10px_rgba(60,80,70,0.16)]" />
                <p className="mt-1 text-[0.78rem] font-bold text-ink/70">{label}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-[0.78rem] font-medium leading-relaxed text-ink/40">
            이름·태어난 시간·사는 곳은 운세와 지원금을 맞추는 데만 써요.
            <br />
            카카오톡 계정으로만 로그인해요.
          </p>
        </div>
      </div>
    </div>
  );
}
