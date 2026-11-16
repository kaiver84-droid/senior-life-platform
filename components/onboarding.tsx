"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { REGIONS, sigunguList } from "@/lib/regions";
import { useApp } from "@/lib/storage";
import { kakaoAuthorizeNow, kakaoConfig, loadKakaoSdk, startKakaoLogin } from "@/lib/share";
import { BigButton, Card, useToast } from "./ui";

const YEARS = Array.from({ length: 44 }, (_, i) => 1930 + i); // 1930 ~ 1973

export function Onboarding() {
  const { saveProfile } = useApp();
  const { show } = useToast();
  const [nickname, setNickname] = useState("");
  const [birthYear, setBirthYear] = useState(1952);
  const [sido, setSido] = useState("충청북도");
  const [sigungu, setSigungu] = useState("옥천군");
  const [busy, setBusy] = useState(false);
  const [kakao, setKakao] = useState<{
    configured: boolean;
    jsConfigured: boolean;
    redirectUri: string;
    ready: boolean;
    db: string;
  }>({
    configured: false,
    jsConfigured: false,
    redirectUri: "",
    ready: false,
    db: "demo",
  });
  const [kakaoStarting, setKakaoStarting] = useState(false);
  // 카카오가 돌려준 인가 코드 — 서버 설정(redirectUri)을 받은 뒤 교환한다.
  const codeRef = useRef<string | null>(null);

  const sigunguOptions = useMemo(() => sigunguList(sido), [sido]);

  useEffect(() => {
    if (!sigunguOptions.includes(sigungu)) setSigungu(sigunguOptions[0] ?? "");
  }, [sigunguOptions, sigungu]);

  useEffect(() => {
    // 카카오 SDK 미리 로드 — 버튼을 누르는 순간 authorize 가 사용자 제스처 안에서 바로 실행되게 한다.
    // (iOS Safari 는 제스처 밖 이동을 막아 카카오톡 앱이 안 열릴 수 있다)
    if (kakaoConfig().configured) void loadKakaoSdk();
  }, []);

  useEffect(() => {
    // 서버가 실제 토큰 교환에 쓰는 redirectUri 를 그대로 받아 둔다(클라이언트와 100% 동일하게 유지).
    fetch("/api/auth/kakao")
      .then((r) => r.json())
      .then((j) => {
        setKakao({
          configured: Boolean(j?.kakaoLoginConfigured),
          jsConfigured: Boolean(j?.kakaoJsConfigured),
          redirectUri: String(j?.redirectUri || `${window.location.origin}/`),
          ready: true,
          db: String(j?.supabase || "demo"),
        });
      })
      .catch(() =>
        setKakao((k) => ({ ...k, redirectUri: `${window.location.origin}/`, ready: true })),
      );

    // 카카오 로그인 콜백(?code=... / ?error=...) — 주소창에서 코드를 지우고 보관만 한다
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");
    if (!code && !error) return;
    window.history.replaceState({}, "", window.location.pathname);
    if (error) {
      show("카카오톡 로그인을 취소했어요. 이름과 지역을 직접 골라 주세요.");
      return;
    }
    codeRef.current = code;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 인가 코드 교환 — redirectUri 는 authorize 에 쓸 값과 같은 서버 값을 쓴다
  useEffect(() => {
    if (!kakao.ready || !codeRef.current) return;
    const code = codeRef.current;
    codeRef.current = null;
    setBusy(true);
    fetch("/api/auth/kakao", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, redirectUri: kakao.redirectUri }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (!j?.ok || !j.profile) {
          show("카카오 로그인에 실패했어요. 이름과 지역을 직접 골라 주세요.");
          return;
        }
        const p = j.profile as { nickname?: string; birthYear?: number; avatar?: string };
        const year = Number(p.birthYear || 0) >= 1930 && Number(p.birthYear || 0) <= 1973 ? Number(p.birthYear) : birthYear;
        const name = (p.nickname || "").trim() || "카카오 이용자";
        saveProfile({ nickname: name, birthYear: year, sido, sigungu, source: "kakao", avatar: p.avatar });
        show(`${name} 님, 카카오로 시작합니다!`);
      })
      .catch(() => show("카카오 로그인에 실패했어요. 이름과 지역을 직접 골라 주세요."))
      .finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kakao.ready, kakao.redirectUri]);

  const startKakao = async () => {
    if (busy || kakaoStarting) return;
    const redirectUri = kakao.redirectUri || `${window.location.origin}/`;
    const fallback = () => {
      setKakaoStarting(false);
      window.location.href = "/api/auth/kakao?start=1";
    };
    // 1) 카카오 JS SDK 간편로그인: 모바일에서 카카오톡 앱이 바로 열려 아이디/비밀번호 없이 인증한다.
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

  const submit = async () => {
    const name = nickname.trim();
    if (name.length < 1) {
      show("이름을 먼저 적어 주세요.");
      return;
    }
    if (!sido || !sigungu) {
      show("사는 지역을 골라 주세요.");
      return;
    }
    setBusy(true);
    try {
      await fetch("/api/auth/kakao", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "demo", nickname: name, birthYear, sido, sigungu }),
      }).catch(() => null);
      saveProfile({ nickname: name, birthYear, sido, sigungu, source: "demo" });
      show(`${name} 님, 반갑습니다! 오늘부터 함께해요.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#FFF4DC] via-[#FFFBF1] to-[#F7F1E3] px-4 pt-[calc(env(safe-area-inset-top,0px)+22px)]">
      <div className="mx-auto max-w-[460px] pb-10">
        <div className="mb-5 text-center">
          <div className="floaty mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-[1.6rem] bg-white text-[2.6rem] shadow-card">
            🌻
          </div>
          <h1 className="text-[1.7rem] font-black leading-tight text-ink">
            시니어생활
            <br />
            도우미
          </h1>
          <p className="mt-2 text-[1.02rem] font-semibold text-ink/70">
            운세 · 두뇌 퀴즈 · 지원금 · 가족 안부를
            <br />
            한 곳에서 쉽게
          </p>
        </div>

        <Card className="space-y-4">
          <div>
            <label htmlFor="nick" className="mb-1.5 block text-[1rem] font-extrabold">
              이름 (또는 애칭)
            </label>
            <input
              id="nick"
              className="field"
              placeholder="예: 순자"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={12}
              autoComplete="off"
            />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label htmlFor="birth" className="mb-1.5 block text-[1rem] font-extrabold">
                태어난 해
              </label>
              <select
                id="birth"
                className="field"
                value={birthYear}
                onChange={(e) => setBirthYear(Number(e.target.value))}
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}년 ({2026 - y}세)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label htmlFor="sido" className="mb-1.5 block text-[1rem] font-extrabold">
                사는 지역 (시·도)
              </label>
              <select id="sido" className="field" value={sido} onChange={(e) => setSido(e.target.value)}>
                {REGIONS.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sigungu" className="mb-1.5 block text-[1rem] font-extrabold">
                시·군·구
              </label>
              <select id="sigungu" className="field" value={sigungu} onChange={(e) => setSigungu(e.target.value)}>
                {sigunguOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <BigButton variant="warm" size="lg" full onClick={submit} disabled={busy}>
            {busy ? "시작하는 중..." : "시작하기"}
          </BigButton>

          <div className="rounded-2xl bg-[#FEE500]/35 p-3 text-center">
            <p className="text-[0.95rem] font-bold text-[#3C1E1E]">🟡 카카오 간편 로그인</p>
            {kakao.configured ? (
              <button
                type="button"
                onClick={startKakao}
                disabled={busy || kakaoStarting}
                className="mt-2 w-full rounded-xl bg-[#FEE500] px-4 py-3 text-[1rem] font-extrabold text-[#3C1E1E] shadow-sm transition active:scale-[0.99] disabled:opacity-60"
              >
                {kakaoStarting ? "카카오톡 여는 중..." : "카카오톡으로 시작하기"}
              </button>
            ) : null}
            <p className="mt-1.5 text-[0.85rem] font-medium text-[#3C1E1E]/80">
              {kakao.configured
                ? "위 정보를 직접 골라도 되고, 카카오톡으로 한 번에 시작해도 돼요."
                : "앱 키를 넣기 전에도 위 정보만으로 모든 기능을 써 볼 수 있어요."}
            </p>
          </div>

          <p className="text-center text-[0.82rem] font-medium leading-relaxed text-ink/55">
            입력한 정보는 이 기기에만 저장돼요.
            <br />
            이름·나이·지역은 운세와 지원금을 맞추는 데만 써요.
          </p>
        </Card>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ["🔮", "오늘의 운세"],
            ["🧠", "1분 퀴즈"],
            ["💰", "맞춤 지원금"],
          ].map(([e, t]) => (
            <div key={t} className="rounded-2xl bg-white/70 p-2.5">
              <div className="text-[1.4rem]">{e}</div>
              <div className="text-[0.80rem] font-bold text-ink/70">{t}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
