import type { Metadata } from "next";
import Link from "next/link";
import { PrivacyPolicyBody } from "@/components/legal";
import { NeulbomMark } from "@/components/art";

/**
 * 공개 개인정보처리방침 — 카카오 애드핏 매체 심사에서 로그인 없이 열 수 있는 주소.
 * 앱(/)은 카카오톡 로그인 뒤에 화면이 열리므로, 심사자가 볼 수 있도록 이 페이지만 따로 둔다.
 */
export const metadata: Metadata = {
  title: "개인정보처리방침 · 이용안내 | 늘봄",
  description:
    "늘봄이 어떤 정보를 받고 어디에 저장하는지, 광고(카카오 애드핏)와 쿠키를 어떻게 쓰는지, 내 정보를 어떻게 고치고 지우는지 안내합니다.",
  alternates: { canonical: "/privacy/" },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[460px] bg-paper px-4 pb-safe pt-safe shadow-[0_0_70px_-24px_rgba(23,59,94,0.4)]">
      <header className="flex h-[62px] items-center justify-between">
        <Link href="/" className="flex items-center gap-2" aria-label="늘봄 홈으로">
          <NeulbomMark size={32} />
          <span className="text-[1.32rem] font-black leading-none tracking-[-0.05em] text-ink">늘봄</span>
        </Link>
        <Link
          href="/"
          className="flex min-h-[44px] items-center rounded-full border-2 border-brand/25 bg-brand-light px-3 text-[0.88rem] font-extrabold text-brand-dark"
        >
          늘봄 열기
        </Link>
      </header>

      <h1 className="pt-1 text-[1.5rem] font-black leading-tight text-ink">개인정보처리방침 · 이용안내</h1>
      <div className="mt-3">
        <PrivacyPolicyBody />
      </div>

      <div className="mt-4 pb-6">
        <Link
          href="/"
          className="touch-btn min-h-[56px] w-full bg-ink text-[1.02rem] font-extrabold text-white shadow-cta"
        >
          늘봄으로 돌아가기
        </Link>
      </div>
    </main>
  );
}
