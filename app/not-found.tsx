import type { Metadata } from "next";
import Link from "next/link";
import { NeulbomMark } from "@/components/art";

/**
 * 없는 주소로 들어왔을 때 — Next 기본 영어 404(“This page could not be found.”) 대신
 * 어르신도 바로 이해할 수 있는 한글 안내 한 장.
 * 오래된 초대 링크·오타 링크로 들어와도 ‘늘봄 첫 화면으로 돌아가기’ 하나만 누르면 된다.
 */
export const metadata: Metadata = {
  title: "페이지를 찾을 수 없어요 | 늘봄",
  description: "주소가 바뀌었거나 잘못 입력되었어요. 늘봄 첫 화면으로 돌아가 주세요.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-paper px-5 pb-safe pt-safe text-center">
      <div className="w-full max-w-[420px] rounded-[1.9rem] bg-white px-5 py-9 shadow-card">
        <div className="flex justify-center">
          <NeulbomMark size={68} className="floaty" />
        </div>
        <p className="mt-4 text-[1.15rem] font-black tracking-[-0.03em] text-brand-dark">늘봄</p>

        <h1 className="mt-1 text-[1.62rem] font-black leading-snug text-ink">페이지를 찾을 수 없어요</h1>
        <p className="mt-3 text-[1rem] font-semibold leading-relaxed text-ink/60">
          주소가 바뀌었거나 잘못 입력되었어요.
          <br />
          아래 버튼을 누르면 처음 화면으로 돌아가요.
        </p>

        <Link
          href="/"
          className="mt-6 flex min-h-[62px] w-full items-center justify-center rounded-[1.25rem] bg-ink px-5 text-[1.12rem] font-black text-white shadow-cta active:scale-[0.99]"
        >
          늘봄 첫 화면으로 돌아가기
        </Link>

        <p className="mt-3 text-[0.86rem] font-semibold leading-relaxed text-ink/45">
          가족에게 받은 링크라면, 보내 준 링크를 다시 눌러 주세요.
        </p>
      </div>
    </main>
  );
}
