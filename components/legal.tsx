"use client";

import React from "react";
import { Sheet } from "./ui";
import { NeulbomMark } from "./art";

/**
 * 개인정보처리방침 · 이용안내.
 *
 * 같은 글을 두 곳에서 쓴다.
 * - 앱 안: ‘더보기 → 개인정보처리방침 · 이용안내’ 시트
 * - 공개 주소: `/privacy/` (카카오 애드핏 매체 심사 때 심사자가 로그인 없이 볼 수 있는 페이지)
 *
 * 운영자 연락처는 `NEXT_PUBLIC_OPERATOR_CONTACT` 로 넣는다(이메일 또는 안내 링크).
 * 값이 비어 있으면 아래 기본값(운영자 이메일)을 쓴다 — Cloudflare Pages 배포에서 환경변수가
 * 빠져도 문의처가 사라지지 않게 코드에 고정해 둔다.
 */
const OPERATOR_CONTACT_FALLBACK = "kaiver84@gmail.com";
const OPERATOR_CONTACT = (process.env.NEXT_PUBLIC_OPERATOR_CONTACT || "").trim() || OPERATOR_CONTACT_FALLBACK;
/** 이메일 모양일 때만 mailto 링크로 건다(링크 주소를 넣은 경우는 글자로만 보여 준다). */
const OPERATOR_EMAIL = /^[^@\s<>"']+@[^@\s<>"']+\.[^@\s<>"']+$/.test(OPERATOR_CONTACT) ? OPERATOR_CONTACT : "";

export type LegalSection = {
  title: string;
  paragraphs?: string[];
  items?: string[];
  /** true 면 운영자 연락처 줄을 제목 아래에 그린다 */
  contact?: boolean;
};

export const PRIVACY_EFFECTIVE_DATE = "2026년 11월 22일";

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: "1. 늘봄이 하는 일",
    paragraphs: [
      "늘봄은 어르신의 하루를 돕는 무료 생활 앱이에요. 기억 건강 퀴즈, 내게 맞는 혜택 안내, 가족 안부 달력, 우리 모임 기능을 한 화면에 모았어요.",
      "시작할 때 카카오톡 계정으로 한 번만 확인하고, 이름·나이·사는 지역은 처음 한 번만 적으면 돼요.",
    ],
  },
  {
    title: "2. 어떤 정보를 받나요",
    items: [
      "카카오톡으로 시작할 때 — 카카오 회원 번호, 이름(닉네임), 프로필 사진(보여 주기에 동의한 경우)",
      "처음 설정에서 직접 적는 것 — 이름(닉네임), 태어난 해, 태어난 시간(모르면 넘어가요), 사는 시·도와 시·군·구",
      "앱을 쓰면서 쌓이는 기록 — 퀴즈 정답과 점수, 복약 확인, 가족 일정, 모임 출석",
    ],
    paragraphs: ["주민등록번호, 계좌번호, 휴대폰 위치 정보는 받지 않아요."],
  },
  {
    title: "3. 어디에 저장하나요",
    paragraphs: [
      "대부분의 기록은 지금 쓰고 있는 휴대폰(브라우저) 안에만 저장돼요.",
      "다만 순위표, 모임 출석, 자녀의 안부 확인 화면은 여러 기기에서 함께 봐야 해서, 닉네임·태어난 해·지역·퀴즈 기록·모임 정보만 서버(Supabase, 호주 시드니 지역)에 저장해요.",
    ],
  },
  {
    title: "4. 왜 쓰나요",
    items: [
      "내 나이와 지역에 맞는 혜택을 골라 보여 주기 위해",
      "이번 주 순위와 모임 출석을 세기 위해",
      "자녀가 부모님 안부를 확인할 수 있게 하기 위해",
    ],
    paragraphs: ["이름·전화번호를 광고주에게 팔거나 넘기지 않아요."],
  },
  {
    title: "5. 얼마나 보관하나요",
    paragraphs: [
      "늘봄을 쓰는 동안 보관하고, 지워 달라고 하시면 지체 없이 지워요.",
      "‘더보기 → 내 정보 · 설정 → 처음부터 다시 시작’을 누르면 휴대폰에 저장된 기록이 바로 지워져요. 서버에 남은 기록을 지우려면 운영자에게 알려 주세요.",
    ],
  },
  {
    title: "6. 다른 곳에 넘기나요",
    paragraphs: [
      "법에서 요구하는 경우가 아니면 다른 회사나 사람에게 넘기지 않아요.",
      "서비스 운영에 꼭 필요한 일부만 아래에 맡기고 있어요.",
    ],
    items: [
      "Supabase — 기록 보관(서버)",
      "Cloudflare — 사이트 운영과 화면 전송",
      "카카오 — 카카오톡 로그인, 가족·친구에게 결과 보내기",
    ],
  },
  {
    title: "7. 광고 안내",
    paragraphs: [
      "늘봄은 화면 아래쪽 두 곳(퀴즈 결과 아래, 오늘의 혜택 아래)에 카카오 애드핏 광고를 보여 줄 수 있어요. 버튼과 떨어뜨려 잘못 누르지 않게 배치해요.",
      "광고를 보여 주는 과정에서 카카오가 쿠키나 기기 정보를 쓸 수 있어요. 늘봄은 광고를 위해 회원 정보를 광고주에게 넘기지 않아요.",
      "휴대폰 브라우저 설정에서 쿠키를 막으면 광고가 줄거나 보이지 않을 수 있어요. 앱의 다른 기능은 그대로 쓸 수 있어요.",
    ],
  },
  {
    title: "8. 내 정보를 보고 고칠 수 있어요",
    paragraphs: [
      "‘더보기 → 내 정보 · 설정’에서 언제든 이름·나이·지역을 고칠 수 있어요.",
      "열람·정정·삭제·처리정지를 원하시면 운영자에게 요청할 수 있고, 요청은 확인하는 대로 처리해요.",
    ],
  },
  {
    title: "9. 만 14세 미만",
    paragraphs: ["만 14세 미만은 보호자와 함께 이용해 주세요. 보호자가 요청하면 기록을 지워 드려요."],
  },
  {
    title: "10. 문의",
    paragraphs: ["개인정보와 관련해 궁금한 점이나 열람·정정·삭제 요청은 늘봄 운영자에게 보내 주세요."],
    contact: true,
  },
  {
    title: "11. 방침이 바뀌면",
    paragraphs: [`이 방침이 바뀌면 이 화면에 바뀐 내용과 날짜를 함께 올려요. 시행일 — ${PRIVACY_EFFECTIVE_DATE}`],
  },
];

export const GUIDE_SECTIONS: LegalSection[] = [
  {
    title: "늘봄은 무료예요",
    paragraphs: ["가입비도 이용료도 없어요. 화면 아래쪽 광고로 운영해요."],
  },
  {
    title: "의료·법률 조언이 아니에요",
    paragraphs: [
      "치매예방 퀴즈는 기억을 즐겁게 쓰는 놀이예요. 진단이나 치료를 대신하지 않아요.",
      "혜택 금액과 신청 방법은 2026년 기준 안내라 실제와 다를 수 있어요. 신청 전에 주민센터(129)에 한 번 더 확인하시면 확실해요.",
    ],
  },
  {
    title: "가족·모임 화면",
    paragraphs: [
      "자녀에게 알려 준 연결 번호로 가족이 내 안부를 볼 수 있어요. 번호는 ‘내 정보 · 설정’에서 확인해요.",
      "모임 이름과 닉네임, 출석은 같은 모임 사람에게 보여요.",
    ],
  },
  {
    title: "소리로 듣기",
    paragraphs: ["휴대폰의 음성 읽기 기능을 써요. 목소리와 속도는 휴대폰 설정을 따라요."],
  },
];

function SectionList({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <section key={s.title}>
          <h2 className="text-[1.02rem] font-black leading-snug text-ink">{s.title}</h2>
          {s.paragraphs?.map((p) => (
            <p key={p} className="mt-1 break-keep text-[0.94rem] font-semibold leading-relaxed text-ink/70">
              {p}
            </p>
          ))}
          {s.contact && OPERATOR_CONTACT ? (
            <p className="mt-1 break-keep text-[0.94rem] font-semibold leading-relaxed text-ink/70">
              연락처 —{" "}
              {OPERATOR_EMAIL ? (
                <a
                  href={`mailto:${OPERATOR_EMAIL}`}
                  className="font-extrabold text-brand-dark underline decoration-brand/40 underline-offset-2"
                >
                  {OPERATOR_CONTACT}
                </a>
              ) : (
                <span className="font-extrabold text-brand-dark">{OPERATOR_CONTACT}</span>
              )}
            </p>
          ) : null}
          {s.items?.length ? (
            <ul className="mt-1.5 space-y-1">
              {s.items.map((it) => (
                <li
                  key={it}
                  className="flex gap-2 break-keep text-[0.92rem] font-semibold leading-relaxed text-ink/70"
                >
                  <span aria-hidden className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full bg-brand/60" />
                  <span className="min-w-0">{it}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  );
}

/** 시트·공개 페이지에서 함께 쓰는 본문 */
export function PrivacyPolicyBody() {
  return (
    <div className="space-y-5" data-privacy-body>
      <div className="rounded-[1.4rem] bg-white p-4 shadow-soft">
        <p className="text-[0.86rem] font-extrabold text-brand-dark/80">개인정보처리방침</p>
        <p className="mt-0.5 text-[0.9rem] font-semibold leading-relaxed text-ink/60">
          늘봄은 어르신의 정보를 꼭 필요한 만큼만 받고, 안전하게 지키려고 해요. 시행일 {PRIVACY_EFFECTIVE_DATE}
        </p>
      </div>

      <SectionList sections={PRIVACY_SECTIONS} />

      <div className="rounded-[1.4rem] bg-white p-4 shadow-soft">
        <p className="text-[0.86rem] font-extrabold text-brand-dark/80">이용안내</p>
        <p className="mt-0.5 text-[0.9rem] font-semibold leading-relaxed text-ink/60">
          늘봄을 쓰실 때 알아 두시면 좋은 것들이에요.
        </p>
      </div>

      <SectionList sections={GUIDE_SECTIONS} />

      <p className="flex items-center justify-center gap-1.5 pb-1 text-[0.78rem] font-semibold text-ink/35">
        <NeulbomMark size={16} /> 늘봄과 함께, 더 편안한 하루
      </p>
    </div>
  );
}

/** 앱 안에서 여는 시트 */
export function PrivacySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="개인정보 안내"
      subtitle="처리방침 · 이용안내 · 광고 안내"
    >
      <PrivacyPolicyBody />
    </Sheet>
  );
}
