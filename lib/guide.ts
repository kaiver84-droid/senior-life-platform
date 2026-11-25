import type { WelfareProgram } from "./types";
import { WELFARE } from "./welfare";

/**
 * 검색 유입용 공개 안내 페이지(/guide/)의 문구·목록을 한곳에서 만든다.
 * - 혜택 상세는 lib/welfare.ts 하나만 고치면 페이지·사이트맵이 함께 바뀐다.
 * - 매주 월요일 혜택 자동 업데이트가 welfare.ts 를 갱신하면 다음 빌드에서 그대로 반영된다.
 */

export const SITE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL || "https://senior-life-platform.pages.dev").replace(/\/+$/, "");

export const CATEGORY_EMOJI: Record<WelfareProgram["category"], string> = {
  연금: "💰",
  생활비: "🍚",
  의료: "🏥",
  교통: "🚌",
  돌봄: "🤝",
  주거: "🏠",
  일자리: "🧰",
};

export const GUIDE_CATEGORY_ORDER: WelfareProgram["category"][] = [
  "연금",
  "생활비",
  "의료",
  "교통",
  "돌봄",
  "주거",
  "일자리",
];

/** 카테고리별로 묶은 혜택 목록 — 허브 페이지에서 그대로 그린다 */
export function welfareByCategory(): { category: WelfareProgram["category"]; programs: WelfareProgram[] }[] {
  return GUIDE_CATEGORY_ORDER.map((category) => ({
    category,
    programs: WELFARE.filter((p) => p.category === category),
  })).filter((group) => group.programs.length > 0);
}

/** "만 65세 이상" 처럼 대상 연령을 사람 말로 */
export function targetText(p: WelfareProgram): string {
  if (p.minAge <= 0) return "소득·가구 조건에 따라";
  const age = p.maxAge ? `만 ${p.minAge}세 ~ ${p.maxAge}세` : `만 ${p.minAge}세 이상`;
  return p.sido && p.sido.length > 0 ? `${age} · ${p.sido.join("·")}` : age;
}

/** 검색 결과에 뜨는 제목 (60자 안쪽) */
export function guideTitle(p: WelfareProgram): string {
  return `${p.title} 신청 방법·지원 금액 (2026년 기준) | 늘봄`;
}

/** 검색 결과에 뜨는 설명 (155자 안쪽, 잘릴 때는 말줄임) */
export function guideDescription(p: WelfareProgram): string {
  const text = `${p.amount} · ${p.summary}`.replace(/\s+/g, " ").trim();
  return text.length > 150 ? `${text.slice(0, 149).trimEnd()}…` : text;
}

/** 같은 카테고리의 다른 혜택 → 없으면 다른 카테고리에서 채운다 */
export function relatedPrograms(p: WelfareProgram, count = 3): WelfareProgram[] {
  const same = WELFARE.filter((x) => x.id !== p.id && x.category === p.category);
  const rest = WELFARE.filter((x) => x.id !== p.id && x.category !== p.category);
  return [...same, ...rest].slice(0, count);
}

export function programUrl(id: string): string {
  return `${SITE_URL}/guide/${id}/`;
}

export const GUIDE_HUB_TITLE = "2026년 어르신 지원금·복지 혜택 17가지 총정리 | 늘봄";
export const GUIDE_HUB_DESCRIPTION =
  "기초연금·에너지바우처·무료 독감 예방접종·틀니 임플란트·노인일자리까지, 2026년에 받을 수 있는 어르신 지원금 17가지를 지원 대상·금액·신청 방법·마감일로 정리했습니다. 부모님 혜택을 자녀가 대신 확인해 보세요.";

export const GUIDE_QUIZ_TITLE = "치매예방 퀴즈 무료로 하기 — 하루 5문제, 433문항 | 늘봄";
export const GUIDE_QUIZ_DESCRIPTION =
  "초성·노래·틀린 그림·OX·넌센스 등 8가지 주제 433문항으로 매일 5문제씩 푸는 무료 치매예방 퀴즈. 로그인은 카카오톡 한 번이면 되고, 점수는 이번 주 랭킹에 쌓입니다.";
