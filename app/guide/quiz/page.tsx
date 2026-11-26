import type { Metadata } from "next";
import Link from "next/link";
import {
  DAILY_QUIZ_COUNT,
  QUIZ_POOLS,
  QUIZ_TOTAL_COUNT,
  QUIZ_TYPE_EMOJI,
  QUIZ_TYPE_LABEL,
  QUIZ_TYPE_ORDER,
} from "@/lib/quiz";
import { GUIDE_QUIZ_DESCRIPTION, GUIDE_QUIZ_TITLE, SITE_URL } from "@/lib/guide";
import { ENABLE_MEMORY_BOX } from "@/lib/flags";
import {
  Breadcrumb,
  GuideCta,
  GuideFooter,
  GuideFrame,
  GuideHeader,
  Pill,
  Section,
  StepList,
} from "@/components/guide";

/** 치매예방 퀴즈·오늘의 추억상자 소개 — 로그인 없이 열리는 공개 안내 페이지 */
export const metadata: Metadata = {
  title: GUIDE_QUIZ_TITLE,
  description: GUIDE_QUIZ_DESCRIPTION,
  keywords: [
    "치매예방 퀴즈",
    "어르신 퀴즈",
    "초성 퀴즈",
    "옛날 노래 가사 퀴즈",
    "틀린 그림 찾기",
    "부모님 두뇌 활동",
    "무료 치매예방 게임",
  ],
  alternates: { canonical: "/guide/quiz/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "치매예방 퀴즈 433문항 — 하루 5문제 무료로 풀기",
    description: GUIDE_QUIZ_DESCRIPTION,
    url: `${SITE_URL}/guide/quiz/`,
    type: "article",
    images: ["/share-card.png"],
  },
};

export default function GuideQuizPage() {
  const topics = QUIZ_TYPE_ORDER.map((type) => ({
    type,
    label: QUIZ_TYPE_LABEL[type],
    emoji: QUIZ_TYPE_EMOJI[type],
    count: QUIZ_POOLS[type].length,
  }));

  const faq = [
    {
      q: "치매예방 퀴즈는 무료인가요?",
      a: `네, 무료예요. 카카오톡으로 한 번만 로그인하면 오늘의 미션 ${DAILY_QUIZ_COUNT}문제와 주제별 무한 연습을 모두 쓸 수 있고, 광고비로 운영됩니다.`,
    },
    {
      q: "휴대폰을 잘 못 다뤄도 할 수 있나요?",
      a: "글씨는 보통·크게·아주 크게 세 단계로 키울 수 있고, 모든 버튼이 크게 만들어져 있어요. 화면 위쪽 돋보기로 글자를 더 확대할 수도 있습니다.",
    },
    {
      q: "퀴즈 점수는 어디에 쌓이나요?",
      a: "오늘의 미션은 5문제를 모두 맞히면 만점 80점이고, 주제별 연습은 정답 1문제당 1점이 이번 주 점수로 쌓여 시·도 랭킹에 오릅니다.",
    },
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "치매예방 퀴즈 무료로 하기",
      description: GUIDE_QUIZ_DESCRIPTION,
      url: `${SITE_URL}/guide/quiz/`,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <GuideFrame>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <GuideHeader />
      <Breadcrumb items={[{ href: "/guide/", label: "혜택 17가지" }, { label: "치매예방 퀴즈" }]} />

      <div className="mt-1">
        <Pill tone="brand">🧠 매일 10분 · 무료</Pill>
      </div>
      <h1 className="mt-2 text-[1.66rem] font-black leading-[1.3] tracking-[-0.03em] text-ink">
        치매예방 퀴즈
        <br />
        <span className="text-brand-dark">하루 5문제</span> 무료로 풀기
      </h1>
      <p className="mt-2 text-[1.05rem] font-semibold leading-relaxed text-[#22384f]">
        초성, 옛날 노래 가사, 틀린 그림 찾기, OX 건강 상식까지 — 어르신이 반가워하는
        {" "}
        <b className="text-ink">{QUIZ_TOTAL_COUNT}문항</b>을 매일 조금씩 풀어요. 정답을 맞히면 바로 해설로
        이야기를 나눌 수 있어요.
      </p>

      <Link href="/" className="touch-btn mt-4 w-full bg-ink text-white shadow-cta">
        늘봄에서 무료로 이용하기 →
      </Link>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          { n: `${QUIZ_TOTAL_COUNT}문항`, l: "전체 문제" },
          { n: `${topics.length}가지`, l: "주제" },
          { n: `${DAILY_QUIZ_COUNT}문제`, l: "하루 미션" },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl bg-white px-1 py-3 shadow-soft">
            <p className="text-[1.12rem] font-black leading-tight text-brand-dark">{s.n}</p>
            <p className="text-[0.85rem] font-bold text-ink/60">{s.l}</p>
          </div>
        ))}
      </div>

      <Section title="이런 주제를 풀어요" emoji="🧩">
        <ul className="grid grid-cols-2 gap-2">
          {topics.map((t) => (
            <li key={t.type} className="rounded-2xl bg-white p-3 shadow-soft">
              <p aria-hidden className="text-[1.4rem] leading-none">
                {t.emoji}
              </p>
              <p className="mt-1 text-[1rem] font-extrabold leading-snug text-ink">{t.label}</p>
              <p className="text-[0.88rem] font-bold text-ink/55">{t.count}문항</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="이렇게 하면 돼요" emoji="📝">
        <StepList
          steps={[
            "늘봄에 들어가서 [카카오톡으로 시작하기]를 한 번만 누르세요. 다음부터는 바로 열려요.",
            "첫 화면에서 [오늘의 퀴즈]를 누르면 오늘의 미션 5문제가 나와요.",
            "답을 고르면 정답과 설명이 바로 나와요. 틀려도 괜찮아요, 설명을 읽고 다음 문제로 가면 돼요.",
            "5문제를 마치면 점수가 쌓이고, 이번 주 시·도 랭킹에서 우리 동네 순위도 볼 수 있어요.",
            "더 하고 싶으면 [주제 골라 풀기]에서 좋아하는 주제를 끝없이 연습할 수 있어요.",
          ]}
        />
      </Section>

      <Section title="점수는 이렇게 쌓여요" emoji="⭐">
        <ul className="space-y-2 text-[1.02rem] font-semibold leading-relaxed text-[#22384f]">
          <li className="rounded-2xl bg-white p-3 shadow-soft">
            <b className="text-ink">오늘의 미션</b> — 5문제, 다 맞히면 만점 80점 (문제당 10점 + 만점 20점 +
            빨리 풀면 10점)
          </li>
          <li className="rounded-2xl bg-white p-3 shadow-soft">
            <b className="text-ink">주제별 연습</b> — 정답 1문제당 1점이 이번 주 점수로 쌓여요
          </li>
          <li className="rounded-2xl bg-white p-3 shadow-soft">
            <b className="text-ink">주간 랭킹</b> — 이번 주 점수로 시·도 순위와 우리 모임 순위를 매겨요
          </li>
        </ul>
      </Section>

      {/* 🎁 오늘의 추억상자 소개 — 지금은 숨김(lib/flags.ts ENABLE_MEMORY_BOX) */}
      {ENABLE_MEMORY_BOX ? (
        <Section title="오늘의 추억상자" emoji="🎁">
          <p className="rounded-2xl bg-white p-4 text-[1.02rem] font-semibold leading-relaxed text-[#22384f] shadow-soft">
            하루에 처음 늘봄을 열면 화면 가운데에 <b className="text-ink">추억 상자</b>가 하나 떠요. 상자를
            누르면 그 시절 사진이 오르골 소리와 함께 열립니다. 1960~1990년대 사진 60장을 15일씩 돌아가며
            보여 드려요.
          </p>
          <p className="mt-2 text-[0.92rem] font-semibold text-ink/60">
            사진은 매일 달라져요. 오늘 상자를 열어 보세요.
          </p>
        </Section>
      ) : null}

      <Section title="알아 두세요" emoji="💡">
        <p className="rounded-2xl bg-sun-light p-4 text-[1rem] font-semibold leading-relaxed text-[#4a3200]">
          이 퀴즈는 치매를 진단하거나 치료하는 것이 아니라, 매일 머리를 쓰는 습관을 돕는 놀이예요. 기억이
          자꾸 깜빡거린다면 보건소 치매안심센터에서{" "}
          <Link href="/guide/dementia-center/" className="font-extrabold underline underline-offset-2">
            무료 선별검사
          </Link>
          를 받아 보세요.
        </p>
      </Section>

      <GuideCta note="오늘의 퀴즈 5문제, 지금 바로 풀어 보세요" />
      <GuideFooter />
    </GuideFrame>
  );
}
