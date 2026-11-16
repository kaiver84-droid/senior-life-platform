"use client";

import React, { useEffect, useMemo, useState } from "react";
import { REGIONS, sigunguList } from "@/lib/regions";
import { useApp } from "@/lib/storage";
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
  const [kakao, setKakao] = useState<{ configured: boolean; db: string }>({ configured: false, db: "demo" });

  const sigunguOptions = useMemo(() => sigunguList(sido), [sido]);

  useEffect(() => {
    if (!sigunguOptions.includes(sigungu)) setSigungu(sigunguOptions[0] ?? "");
  }, [sigunguOptions, sigungu]);

  useEffect(() => {
    fetch("/api/auth/kakao")
      .then((r) => r.json())
      .then((j) => setKakao({ configured: Boolean(j?.kakaoLoginConfigured), db: String(j?.supabase || "demo") }))
      .catch(() => {});
  }, []);

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
            <p className="text-[0.95rem] font-bold text-[#3C1E1E]">
              🟡 카카오 간편 로그인 (체험)
            </p>
            <p className="mt-1 text-[0.85rem] font-medium text-[#3C1E1E]/80">
              {kakao.configured
                ? "카카오 앱 키가 연결되어 있어요. 위 정보로 바로 시작할 수 있어요."
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
