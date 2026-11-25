import type { Metadata } from "next";
import Link from "next/link";
import { WELFARE } from "@/lib/welfare";
import {
  CATEGORY_EMOJI,
  GUIDE_HUB_DESCRIPTION,
  GUIDE_HUB_TITLE,
  SITE_URL,
  targetText,
  welfareByCategory,
} from "@/lib/guide";
import { GuideCta, GuideFooter, GuideFrame, GuideHeader, Pill, Section } from "@/components/guide";

/**
 * 검색 유입 허브 — 로그인 없이 열리는 공개 페이지.
 * lib/welfare.ts 를 읽어 빌드할 때마다 자동으로 만들어진다(매주 월요일 혜택 업데이트 뒤 재배포 시 최신화).
 */
export const metadata: Metadata = {
  title: GUIDE_HUB_TITLE,
  description: GUIDE_HUB_DESCRIPTION,
  keywords: [
    "2026 어르신 지원금",
    "기초연금",
    "에너지바우처",
    "노인일자리",
    "무료 독감 예방접종",
    "틀니 임플란트",
    "부모님 복지 혜택",
    "시니어 지원금 총정리",
  ],
  alternates: { canonical: "/guide/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "2026년 어르신 지원금·복지 혜택 17가지 총정리",
    description: "지원 대상·금액·신청 방법·마감일까지 한 번에. 늘봄에서 무료로 확인하세요.",
    url: `${SITE_URL}/guide/`,
    type: "website",
    images: ["/share-card.png"],
  },
};

/** 마감일이 실제로 정해진 혜택 (예: 12월 31일까지) — 눈에 띄게 따로 모은다 */
const DATED = WELFARE.filter((p) => !!p.deadline && /까지/.test(p.deadline) && /\d+월/.test(p.deadline));

export default function GuideHubPage() {
  const groups = welfareByCategory();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "2026년 어르신 지원금·복지 혜택 17가지",
    itemListElement: WELFARE.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.title,
      url: `${SITE_URL}/guide/${p.id}/`,
    })),
  };

  return (
    <GuideFrame>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <GuideHeader />

      {/* 머리말 */}
      <div className="rounded-xl3 bg-brand-light px-4 pb-5 pt-5">
        <Pill tone="brand">2026년 기준 · 무료로 보기</Pill>
        <h1 className="mt-3 text-[1.72rem] font-black leading-[1.3] tracking-[-0.03em] text-ink">
          어르신 지원금·복지 혜택
          <br />
          <span className="text-brand-dark">17가지</span> 한 번에 보기
        </h1>
        <p className="mt-3 text-[1.05rem] font-semibold leading-relaxed text-[#22384f]">
          부모님·어르신이 받을 수 있는 돈과 혜택을 <b className="text-ink">지원 대상·금액·신청 방법·마감일</b>
          까지 정리했어요. 받을 수 있는 게 있는지 하나씩 확인해 보세요.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            { n: "17가지", l: "지원 제도" },
            { n: "무료", l: "신청 비용" },
            { n: "129", l: "복지 상담" },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl bg-white/85 px-1 py-2 shadow-soft">
              <p className="text-[1.18rem] font-black leading-tight text-brand-dark">{s.n}</p>
              <p className="text-[0.85rem] font-bold text-ink/60">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      <GuideCta note="어르신 나이와 사는 지역만 넣으면 받을 수 있는 혜택만 골라 드려요" />

      {/* 마감이 정해진 혜택 */}
      {DATED.length > 0 && (
        <Section title="신청 기간이 정해져 있어요" emoji="⏰">
          <ul className="space-y-2">
            {DATED.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/guide/${p.id}/`}
                  className="flex items-start gap-3 rounded-2xl border-2 border-sun-dark/25 bg-sun-light p-3"
                >
                  <span aria-hidden className="text-[1.3rem] leading-none">
                    {CATEGORY_EMOJI[p.category]}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[1.02rem] font-extrabold leading-snug text-ink">{p.title}</span>
                    <span className="mt-0.5 block text-[0.95rem] font-bold text-[#8a5b00]">{p.deadline}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* 카테고리별 전체 목록 */}
      {groups.map((group) => (
        <Section key={group.category} title={`${group.category}`} emoji={CATEGORY_EMOJI[group.category]}>
          <ul className="space-y-2">
            {group.programs.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/guide/${p.id}/`}
                  className="block rounded-2xl bg-white p-4 shadow-soft transition active:scale-[0.995]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 text-[1.08rem] font-extrabold leading-snug text-ink">{p.title}</h3>
                    <span aria-hidden className="shrink-0 pt-0.5 text-ink/35">
                      ›
                    </span>
                  </div>
                  <p className="mt-1 text-[1.05rem] font-extrabold text-brand-dark">{p.amount}</p>
                  <p className="mt-1 line-clamp-2 text-[0.95rem] font-medium leading-relaxed text-ink/70">
                    {p.summary}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-paper px-2 py-0.5 text-[0.85rem] font-bold text-ink/70">
                      {targetText(p)}
                    </span>
                    {p.deadline && (
                      <span className="rounded-full bg-coral-light px-2 py-0.5 text-[0.85rem] font-bold text-coral-dark">
                        {p.deadline}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ))}

      {/* 치매예방 퀴즈 안내 */}
      <Section title="머리 쓰는 습관도 함께" emoji="🧠">
        <Link href="/guide/quiz/" className="block rounded-2xl bg-plum-light p-4 shadow-soft">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 text-[1.08rem] font-extrabold leading-snug text-ink">
              치매예방 퀴즈 433문항 무료로 풀기
            </h3>
            <span aria-hidden className="shrink-0 pt-0.5 text-plum-dark">
              ›
            </span>
          </div>
          <p className="mt-1 text-[0.95rem] font-medium leading-relaxed text-ink/70">
            초성·노래·틀린 그림·OX·넌센스 등 8가지 주제에서 매일 5문제. 하루 10분이면 충분해요.
          </p>
        </Link>
      </Section>

      <GuideCta note="혜택 확인부터 퀴즈까지, 늘봄 하나면 돼요" />
      <GuideFooter />
    </GuideFrame>
  );
}
