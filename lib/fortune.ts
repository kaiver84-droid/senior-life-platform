import { kstDate } from "./week";
import { JISIN_LINES, UNKNOWN_BIRTH_TIME, birthTimeShort } from "./birthtime";

export const ZODIAC = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"] as const;
export type Zodiac = (typeof ZODIAC)[number];

export const ZODIAC_EMOJI: Record<string, string> = {
  쥐: "🐭", 소: "🐮", 호랑이: "🐯", 토끼: "🐰", 용: "🐲", 뱀: "🐍",
  말: "🐴", 양: "🐑", 원숭이: "🐵", 닭: "🐔", 개: "🐶", 돼지: "🐷",
};

export function zodiacOf(birthYear: number): Zodiac {
  const idx = (((birthYear - 4) % 12) + 12) % 12;
  return ZODIAC[idx];
}

export function ageOf(birthYear: number, today: string = kstDate()): number {
  return Number(today.slice(0, 4)) - birthYear;
}

/** 같은 사람 · 같은 날이면 항상 같은 결과가 나오는 해시 */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: T[], seed: number): T {
  // 시드가 음수여도(해시를 >> 로 시프트하면 int32 로 넘어가 음수가 된다) 항상 유효한 인덱스를 고른다.
  // Math.abs 만 쓰면 큰 값에서 겹치므로 모듈러 정규화를 쓴다.
  const i = ((Math.trunc(seed) % arr.length) + arr.length) % arr.length;
  return arr[i];
}

export type Fortune = {
  date: string;
  score: number;
  stars: number;
  headline: string;
  general: string;
  money: string;
  health: string;
  social: string;
  advice: string;
  luckyColor: { name: string; hex: string };
  luckyNumber: number;
  luckyDirection: string;
  luckyTime: string;
  zodiac: Zodiac;
  zodiacEmoji: string;
  /** 태어난 시간(시진)이 저장되어 있을 때만 채워지는 시간대 한마디 */
  birthTime?: string;
  timeTrait?: string;
  timeTip?: string;
};

const GENERAL = [
  "오늘은 마음먹은 일이 술술 풀리는 날이에요. 미뤄 두었던 일을 하나 시작해 보세요.",
  "작은 친절이 큰 기쁨으로 돌아오는 날이에요. 이웃에게 먼저 인사를 건네 보세요.",
  "서두르지 않아도 일이 제때 되어요. 오늘은 천천히, 편안하게 움직이면 좋아요.",
  "생각보다 운이 뒤에서 도와주는 날이에요. 용기를 내어 전화 한 통 해 보세요.",
  "가족과의 대화에서 좋은 소식이 들려올 수 있어요. 귀를 기울여 보세요.",
  "몸과 마음이 가벼워지는 날이에요. 산책길에서 좋은 기운을 만나요.",
  "오래 미뤄 둔 서류나 전화를 정리하기에 좋은 날이에요. 하나만 해도 충분해요.",
  "웃는 얼굴에 복이 따르는 날이에요. 오늘 만나는 사람에게 먼저 웃어 보세요.",
];

const MONEY = [
  "들어오는 돈은 무난해요. 다만 충동구매는 하루만 미뤄 보세요.",
  "작은 이득이 생길 수 있어요. 받을 돈이나 환급금을 한 번 확인해 보세요.",
  "지출을 살펴보기 좋은 날이에요. 고정 지출 하나를 정리하면 마음이 가벼워져요.",
  "예상하지 못한 작은 지출이 있을 수 있어요. 지갑을 잘 챙기세요.",
  "누군가와 나누면 두 배가 되는 날이에요. 다만 보증이나 큰 지출은 피하세요.",
];

const HEALTH = [
  "컨디션이 좋은 날이에요. 가볍게 걷기 20분이면 충분해요.",
  "무릎과 허리에 무리가 가지 않게 조심하세요. 계단은 천천히 오르세요.",
  "물을 자주 마시고, 오후에는 잠깐 눈을 붙이면 좋아요.",
  "찬 바람에 목이 쉽게 상할 수 있어요. 따뜻하게 입고 나가세요.",
  "혈압약 드실 시간을 꼭 지켜 주세요. 오늘은 특히 규칙적으로요.",
  "소화가 조금 더딜 수 있어요. 저녁은 가볍게 드세요.",
];

const SOCIAL = [
  "오랜만에 연락한 사람에게서 반가운 소식이 올 수 있어요.",
  "자녀나 손주와의 대화가 마음을 따뜻하게 해 줄 거예요.",
  "모임에서 좋은 인연을 만날 수 있어요. 먼저 말을 걸어 보세요.",
  "말 한마디가 오해를 풀어 줄 수 있어요. 솔직하게 이야기해 보세요.",
  "이웃과 나누는 작은 이야기가 하루를 즐겁게 해요.",
];

const ADVICE = [
  "오늘도 잘하고 있어요. 한 걸음이면 충분합니다.",
  "급할수록 한 번 더 확인하세요. 그것이 가장 빠른 길이에요.",
  "몸이 편해야 마음도 편합니다. 오늘은 나를 먼저 챙기세요.",
  "감사한 일 세 가지를 떠올려 보세요. 하루가 달라집니다.",
  "누군가에게 도움을 청하는 것도 지혜예요.",
  "작은 약속을 지키는 것이 큰 신뢰를 만듭니다.",
  "오늘의 웃음은 내일의 건강이에요.",
];

const COLORS = [
  { name: "연두색", hex: "#7BB661" },
  { name: "하늘색", hex: "#5AA9E6" },
  { name: "주황색", hex: "#F28C28" },
  { name: "보라색", hex: "#8E6BBF" },
  { name: "분홍색", hex: "#E86A92" },
  { name: "금색", hex: "#C9A227" },
  { name: "흰색", hex: "#F4F1E8" },
  { name: "남색", hex: "#2B3A67" },
];

const DIRECTIONS = ["동쪽", "서쪽", "남쪽", "북쪽", "남동쪽", "남서쪽"];
const TIMES = ["아침 7시~9시", "오전 10시~12시", "오후 1시~3시", "오후 3시~5시", "저녁 6시~8시"];

export function getFortune(
  nickname: string,
  birthYear: number,
  date: string = kstDate(),
  birthTime?: string
): Fortune {
  const zodiac = zodiacOf(birthYear);
  const jisin = birthTime && birthTime !== UNKNOWN_BIRTH_TIME ? birthTimeShort(birthTime) : "";
  // 태어난 시간까지 알면 그 사람만의 시드가 되어, 사주 시간대 팁이 따로 나온다.
  const key = `${date}|${birthYear}|${nickname}${jisin ? `|${jisin}` : ""}`;
  const h = hash(key);
  const h2 = hash(key + "|b");
  const h3 = hash(key + "|c");
  const info = jisin ? JISIN_LINES[jisin] : undefined;

  const score = 62 + (h % 37); // 62 ~ 98
  const stars = score >= 90 ? 5 : score >= 82 ? 4 : score >= 72 ? 3 : 2;

  return {
    date,
    score,
    stars,
    headline:
      score >= 90
        ? "기운이 가득한 날!"
        : score >= 80
          ? "좋은 일이 생기는 날"
          : score >= 70
            ? "무난하게 흘러가는 날"
            : "쉬어 가면 더 좋은 날",
    general: pick(GENERAL, h),
    money: pick(MONEY, h2),
    health: pick(HEALTH, h2 >> 3),
    social: pick(SOCIAL, h3),
    advice: pick(ADVICE, h3 >> 5),
    luckyColor: pick(COLORS, h >> 7),
    luckyNumber: (h % 9) + 1,
    luckyDirection: pick(DIRECTIONS, h2 >> 6),
    luckyTime: pick(TIMES, h3 >> 8),
    zodiac,
    zodiacEmoji: ZODIAC_EMOJI[zodiac],
    birthTime: jisin || undefined,
    timeTrait: info?.trait,
    timeTip: info ? pick(info.tips, h3 >> 11) : undefined,
  };
}

/** 운세 → 인사카드에 들어갈 짧은 한 줄 */
export function shortFortuneLine(f: Fortune): string {
  return f.score >= 85
    ? "오늘은 좋은 일이 가득한 날이에요"
    : f.score >= 75
      ? "오늘도 편안하고 좋은 하루 보내세요"
      : "오늘은 천천히 쉬어 가는 하루예요";
}
