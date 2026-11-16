/**
 * 우리 동네 바로가기 — 지역 소식·축제·복지 정보를 확인할 수 있는 바깥 주소.
 *
 * 시·군·구마다 공식 누리집 주소가 달라서, 주소를 잘못 적어 두면 눌렀을 때 빈 화면이 나온다.
 * 그래서 여기서는 언제나 열리는 주소만 넣는다.
 * · 지역 소식·축제는 네이버 검색 결과로 보낸다(지자체 공고가 가장 위에 올라온다).
 * · 복지·지원금·문화는 정부·공공 포털 주소를 그대로 쓴다(주소가 바뀌지 않는다).
 */

import { shortSido } from "./regions";

export type RegionLink = {
  key: string;
  emoji: string;
  label: string;
  url: string;
  /** 무엇을 볼 수 있는지 한 줄 */
  note: string;
};

/** 검색 결과 주소 — 지자체 이름으로 찾는다 */
const naver = (query: string, news = false) =>
  `https://search.naver.com/search.naver?${news ? "where=news&" : ""}query=${encodeURIComponent(query)}`;

export function regionAreaName(sido: string, sigungu: string): string {
  const s = shortSido(sido || "");
  if (!sigungu) return s || "우리 동네";
  if (sigungu.startsWith(s) || s.startsWith(sigungu)) return sigungu;
  return `${s} ${sigungu}`.trim();
}

/**
 * 지금 보고 있는 지역의 바로가기 목록.
 * 지역을 아직 고르지 않았으면 시·도 이름으로 찾는다.
 */
export function regionLinks(sido: string, sigungu: string): RegionLink[] {
  const short = shortSido(sido || "");
  const admin = sigungu || short;
  // "해운대구" → 구청, "옥천군" → 군청, "수원시" → 시청
  const office = /구$/.test(admin) ? "구청" : /군$/.test(admin) ? "군청" : "시청";

  return [
    {
      key: "news",
      emoji: "📰",
      label: "지역 소식",
      url: naver(`${admin} 소식`, true),
      note: "새 소식 보기",
    },
    {
      key: "event",
      emoji: "🎪",
      label: "축제·행사",
      url: naver(`${admin} 축제 일정`),
      note: "이달 행사 일정",
    },
    {
      key: "office",
      emoji: "🏛️",
      label: `${office} 누리집`,
      url: naver(`${admin}청`),
      note: "공고·민원 보기",
    },
    {
      key: "welfare",
      emoji: "🎁",
      label: "복지로",
      url: "https://www.bokjiro.go.kr",
      note: "맞춤 복지 찾기",
    },
    {
      key: "subsidy",
      emoji: "💰",
      label: "보조금24",
      url: "https://www.gov.kr/portal/rcvfvrSvc/main",
      note: "받을 지원금 조회",
    },
    {
      key: "culture",
      emoji: "🎨",
      label: "문화포털",
      url: "https://www.culture.go.kr",
      note: "무료 공연·전시",
    },
  ];
}
