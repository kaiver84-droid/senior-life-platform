import type { QuizType } from "./types";

export type Question = {
  id: string;
  type: QuizType;
  prompt: string;
  hint: string;
  /** 초성·가사: 보기 4개 / 그림: 9칸 */
  options: string[];
  answer: number;
  explain: string;
};

export const QUIZ_TYPE_LABEL: Record<QuizType, string> = {
  choseong: "초성 퀴즈",
  lyrics: "옛날 노래 가사",
  spot: "틀린 그림 찾기",
};

export const QUIZ_TYPE_EMOJI: Record<QuizType, string> = {
  choseong: "🔤",
  lyrics: "🎵",
  spot: "🔍",
};

const CHOSEONG: Question[] = [
  {
    id: "ch-sr",
    type: "choseong",
    prompt: "ㅅ ㄹ",
    hint: "가족을 아끼는 마음이에요",
    options: ["사랑", "소라", "서류", "사료"],
    answer: 0,
    explain: "ㅅ+ㄹ은 '사랑'이에요. 가족에게 오늘 한 번 말해 보세요.",
  },
  {
    id: "ch-kc",
    type: "choseong",
    prompt: "ㄱ ㅊ",
    hint: "배추로 담그는 매운 반찬",
    options: ["김치", "갈치", "고추", "기차"],
    answer: 0,
    explain: "ㄱ+ㅊ은 '김치'예요. 겨울 김장철이 떠오르네요.",
  },
  {
    id: "ch-bd",
    type: "choseong",
    prompt: "ㅂ ㄷ",
    hint: "배가 다니는 넓은 물",
    options: ["바다", "부두", "비단", "보리"],
    answer: 0,
    explain: "ㅂ+ㄷ은 '바다'예요. 멀리 보이는 수평선이 떠오릅니다.",
  },
  {
    id: "ch-nr",
    type: "choseong",
    prompt: "ㄴ ㄹ",
    hint: "흥얼흥얼 부르는 것",
    options: ["노래", "나루", "누리", "노루"],
    answer: 0,
    explain: "ㄴ+ㄹ은 '노래'예요. 오늘 한 소절 불러 보세요.",
  },
  {
    id: "ch-ma",
    type: "choseong",
    prompt: "ㅁ ㅇ",
    hint: "사람들이 모여 사는 동네",
    options: ["마을", "모임", "무우", "미역"],
    answer: 0,
    explain: "ㅁ+ㅇ은 '마을'이에요. 우리 동네 이름도 떠올려 보세요.",
  },
  {
    id: "ch-dr",
    type: "choseong",
    prompt: "ㄷ ㄹ",
    hint: "강을 건너는 것",
    options: ["다리", "도로", "두부", "더위"],
    answer: 0,
    explain: "ㄷ+ㄹ은 '다리'예요. 무릎도 '다리'라고 하지요.",
  },
  {
    id: "ch-jb",
    type: "choseong",
    prompt: "ㅈ ㅂ",
    hint: "돈을 넣고 다니는 것",
    options: ["지갑", "주방", "장비", "집배"],
    answer: 0,
    explain: "ㅈ+ㅂ은 '지갑'이에요. 외출 전에 한 번 확인하세요.",
  },
  {
    id: "ch-hg",
    type: "choseong",
    prompt: "ㅎ ㄱ",
    hint: "아이들이 공부하는 곳",
    options: ["학교", "회관", "항구", "휴가"],
    answer: 0,
    explain: "ㅎ+ㄱ은 '학교'예요. 손주들 얼굴이 떠오르지요?",
  },
  {
    id: "ch-sj",
    type: "choseong",
    prompt: "ㅅ ㅈ",
    hint: "밥 먹을 때 쓰는 도구",
    options: ["수저", "사진", "시장", "소주"],
    answer: 0,
    explain: "ㅅ+ㅈ은 '수저'예요.",
  },
  {
    id: "ch-ib",
    type: "choseong",
    prompt: "ㅇ ㅂ",
    hint: "잘 때 덮는 것",
    options: ["이불", "우유", "아이", "오이"],
    answer: 0,
    explain: "ㅇ+ㅂ은 '이불'이에요. 밤에 따뜻하게 덮으세요.",
  },
  {
    id: "ch-gw",
    type: "choseong",
    prompt: "ㄱ ㅇ",
    hint: "눈이 오는 계절",
    options: ["겨울", "가을", "고양", "기와"],
    answer: 0,
    explain: "ㄱ+ㅇ은 '겨울'이에요.",
  },
  {
    id: "ch-cs",
    type: "choseong",
    prompt: "ㅊ ㅅ",
    hint: "이를 닦는 도구",
    options: ["칫솔", "치약", "수건", "비누"],
    answer: 0,
    explain: "ㅊ+ㅅ은 '칫솔'이에요. 하루 세 번, 3분씩 닦아 보세요.",
  },
];

const LYRICS: Question[] = [
  {
    id: "ly-home",
    type: "lyrics",
    prompt: "나의 살던 고향은 꽃피는 산골\n복숭아꽃 살구꽃 ___",
    hint: "'고향의 봄' (이원수 작사)",
    options: ["아기 진달래", "하얀 목련", "노란 개나리", "빨간 동백"],
    answer: 0,
    explain: "'아기 진달래'예요. 1920년대 노래로 지금도 많이 부릅니다.",
  },
  {
    id: "ly-bandar",
    type: "lyrics",
    prompt: "푸른 하늘 은하수 하얀 쪽배에\n___",
    hint: "'반달' (윤극영)",
    options: ["계수나무 한 나무 토끼 한 마리", "은하수 건너서 별을 따다 줘", "달님은 웃으시며 고개 끄덕여", "하얀 배 타고서 별나라 가자"],
    answer: 0,
    explain: "'계수나무 한 나무 토끼 한 마리'예요.",
  },
  {
    id: "ly-arirang",
    type: "lyrics",
    prompt: "아리랑 아리랑 아라리요\n___",
    hint: "우리 민요",
    options: ["아리랑 고개로 넘어간다", "아리랑 고개에 꽃이 핀다", "아리랑 아리랑 노래하네", "아리랑 고개를 돌아본다"],
    answer: 0,
    explain: "'아리랑 고개로 넘어간다'예요.",
  },
  {
    id: "ly-oppa",
    type: "lyrics",
    prompt: "뜸북뜸북 뜸북새 논에서 울고\n___",
    hint: "'오빠 생각' (한정동 작사)",
    options: ["뻐꾹뻐꾹 뻐꾹새 숲에서 운다", "까마귀 떼 지어서 산으로 간다", "제비가 날아와 처마에 앉네", "참새가 짹짹짹 마당에 모인다"],
    answer: 0,
    explain: "'뻐꾹뻐꾹 뻐꾹새 숲에서 운다'예요.",
  },
  {
    id: "ly-pongdang",
    type: "lyrics",
    prompt: "퐁당퐁당 돌을 던지자\n___",
    hint: "'퐁당퐁당' (윤극영)",
    options: ["누나 몰래 돌을 던지자", "동생 몰래 돌을 던지자", "냇가에서 돌을 던지자", "친구들과 돌을 던지자"],
    answer: 0,
    explain: "'누나 몰래 돌을 던지자'예요.",
  },
];

const SPOT_PAIRS: [string, string][] = [
  ["🌻", "🌼"],
  ["🍎", "🍅"],
  ["🌷", "🌹"],
  ["🚌", "🚐"],
  ["⭐", "🌟"],
  ["🐟", "🐠"],
  ["🎈", "🎀"],
  ["☂️", "☔"],
];

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function spotQuestion(date: string, nth: number): Question {
  const seed = hashStr(`${date}|spot|${nth}`);
  const rnd = mulberry32(seed);
  const pair = SPOT_PAIRS[Math.floor(rnd() * SPOT_PAIRS.length)];
  const answer = Math.floor(rnd() * 9);
  const grid: string[] = [];
  for (let i = 0; i < 9; i++) grid.push(i === answer ? pair[1] : pair[0]);
  return {
    id: `spot-${date}-${nth}`,
    type: "spot",
    prompt: "아래 9개 중에서 다른 그림 하나를 찾아 눌러 보세요",
    hint: "색이나 모양이 하나만 달라요",
    options: grid,
    answer,
    explain: `${pair[1]} 하나만 다른 그림이었어요. 잘 찾으셨어요!`,
  };
}

/** 그날의 3문제 (초성 1 · 노래 1 · 틀린 그림 1) — 날짜가 같으면 항상 같음 */
export function dailyQuestions(date: string): Question[] {
  const c = CHOSEONG[hashStr(date + "|ch") % CHOSEONG.length];
  const l = LYRICS[hashStr(date + "|ly") % LYRICS.length];
  const s = spotQuestion(date, hashStr(date) % 7);
  return [c, l, s];
}

export function calcPoints(correct: number, total: number, seconds: number): number {
  const base = correct * 10;
  const perfect = correct === total && total > 0 ? 20 : 0;
  const speed = seconds < 90 ? 10 : seconds < 180 ? 5 : 0;
  return base + perfect + speed;
}
