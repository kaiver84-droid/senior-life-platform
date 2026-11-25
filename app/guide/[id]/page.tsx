import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WELFARE } from "@/lib/welfare";
import {
  CATEGORY_EMOJI,
  SITE_URL,
  guideDescription,
  guideTitle,
  relatedPrograms,
  targetText,
} from "@/lib/guide";
import {
  Breadcrumb,
  ChipList,
  FactRow,
  GuideCta,
  GuideFooter,
  GuideFrame,
  GuideHeader,
  Pill,
  Section,
  StepList,
} from "@/components/guide";

/**
 * 혜택 한 건마다 자동으로 만들어지는 상세 안내 페이지.
 * - lib/welfare.ts 의 17건을 그대로 순회해 정적 HTML 로 굽는다(검색엔진이 읽는 본문).
 * - 로그인·DB 없이 열린다.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return WELFARE.map((p) => ({ id: p.id }));
}

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const p = WELFARE.find((x) => x.id === id);
  if (!p) return { title: "혜택을 찾을 수 없어요 | 늘봄", robots: { index: false, follow: false } };
  const description = guideDescription(p);
  return {
    title: guideTitle(p),
    description,
    keywords: [p.title, `${p.title} 신청 방법`, `${p.title} 금액`, p.category, "2026 어르신 지원금"],
    alternates: { canonical: `/guide/${p.id}/` },
    robots: { index: true, follow: true },
    openGraph: {
      title: `${p.title} — ${p.amount}`,
      description,
      url: `${SITE_URL}/guide/${p.id}/`,
      type: "article",
      images: ["/share-card.png"],
    },
  };
}

export default async function GuideDetailPage({ params }: PageProps) {
  const { id } = await params;
  const p = WELFARE.find((x) => x.id === id);
  if (!p) notFound();

  const related = relatedPrograms(p);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "GovernmentService",
    name: p.title,
    description: p.summary,
    serviceType: p.category,
    provider: { "@type": "GovernmentOrganization", name: p.org },
    areaServed: { "@type": "Country", name: "대한민국" },
    audience: { "@type": "PeopleAudience", suggestedMinAge: p.minAge > 0 ? p.minAge : undefined },
    url: `${SITE_URL}/guide/${p.id}/`,
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "늘봄", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "혜택 17가지", item: `${SITE_URL}/guide/` },
      { "@type": "ListItem", position: 3, name: p.title, item: `${SITE_URL}/guide/${p.id}/` },
    ],
  };

  return (
    <GuideFrame>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([jsonLd, breadcrumbLd]) }}
      />
      <GuideHeader />
      <Breadcrumb
        items={[{ href: "/guide/", label: "혜택 17가지" }, { label: p.title }]}
      />

      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Pill tone="brand">
          {CATEGORY_EMOJI[p.category]} {p.category}
        </Pill>
        <Pill tone="leaf">{p.org}</Pill>
      </div>

      <h1 className="mt-2 text-[1.66rem] font-black leading-[1.3] tracking-[-0.03em] text-ink">{p.title}</h1>
      <p className="mt-2 text-[1.05rem] font-semibold leading-relaxed text-[#22384f]">{p.summary}</p>
      {p.tags.length > 0 && (
        <div className="mt-3">
          <ChipList items={p.tags} />
        </div>
      )}

      {/* 맨 위 CTA — 검색으로 들어온 사람이 바로 앱으로 갈 수 있게 */}
      <Link href="/" className="touch-btn mt-4 w-full bg-ink text-white shadow-cta">
        늘봄에서 무료로 이용하기 →
      </Link>

      {/* 금액·대상·마감 */}
      <div className="mt-4 rounded-xl3 bg-sun-light px-4 py-3">
        <p className="text-[0.92rem] font-bold text-[#8a5b00]">받을 수 있는 금액</p>
        <p className="mt-0.5 text-[1.42rem] font-black leading-snug text-ink">{p.amount}</p>
      </div>
      <div className="mt-2 rounded-xl3 bg-white px-4 py-1 shadow-soft">
        <FactRow label="지원 대상" value={targetText(p)} emoji="🙋" />
        {p.deadline && <FactRow label="신청 기간" value={p.deadline} emoji="🗓️" />}
        <FactRow label="신청·문의" value={p.phone ? `${p.contact} ${p.phone}` : p.contact} emoji="☎️" />
      </div>

      <Section title="어떻게 신청하나요?" emoji="📝">
        <StepList steps={p.steps} />
      </Section>

      <Section title="준비할 서류" emoji="📄">
        <ChipList items={p.documents} />
        <p className="mt-2 text-[0.92rem] font-semibold text-ink/60">
          서류는 주민센터에서 대부분 바로 뽑을 수 있어요. 잘 모르겠으면 빈손으로 가서 물어보셔도 됩니다.
        </p>
      </Section>

      <Section title="전화·방문 문의" emoji="☎️">
        <div className="rounded-2xl bg-white p-4 shadow-soft">
          <p className="text-[1rem] font-extrabold text-ink">{p.contact}</p>
          {p.phone && (
            <a
              href={`tel:${p.phone.replace(/[^0-9+]/g, "")}`}
              className="touch-btn mt-2 w-full border-2 border-brand/25 bg-brand-light text-brand-dark"
            >
              📞 {p.phone} 전화하기
            </a>
          )}
          {p.url && (
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="touch-btn mt-2 w-full border-2 border-ink/15 bg-white text-ink"
            >
              공식 안내 보기 ↗
            </a>
          )}
        </div>
      </Section>

      <GuideCta note="나이·지역만 넣으면 받을 수 있는 혜택만 골라 드려요" />

      <Section title="다른 혜택도 확인해 보세요" emoji="🔎">
        <ul className="space-y-2">
          {related.map((r) => (
            <li key={r.id}>
              <Link href={`/guide/${r.id}/`} className="flex items-start gap-3 rounded-2xl bg-white p-3 shadow-soft">
                <span aria-hidden className="text-[1.25rem] leading-none">
                  {CATEGORY_EMOJI[r.category]}
                </span>
                <span className="min-w-0">
                  <span className="block text-[1rem] font-extrabold leading-snug text-ink">{r.title}</span>
                  <span className="mt-0.5 block text-[0.95rem] font-bold text-brand-dark">{r.amount}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/guide/"
          className="touch-btn mt-3 w-full border-2 border-ink/15 bg-white text-ink"
        >
          혜택 17가지 전체 보기
        </Link>
      </Section>

      <GuideFooter />
    </GuideFrame>
  );
}
