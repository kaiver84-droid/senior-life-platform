export type Profile = {
  /** 기기별 식별자 (가족 확인용 코드로도 사용) */
  id: string;
  nickname: string;
  birthYear: number;
  sido: string;
  sigungu: string;
  createdAt: string;
  source: "demo" | "kakao";
  avatar?: string;
};

export type QuizType = "choseong" | "lyrics" | "spot";

export type QuizLog = {
  date: string; // YYYY-MM-DD (KST)
  weekId: string; // 2026-W47
  correct: number;
  total: number;
  points: number;
  seconds: number;
  types: QuizType[];
  at: string; // ISO
};

export type DailyQuiz = {
  date: string;
  answered: number;
  correct: number;
  points: number;
  done: boolean;
  answeredIds: string[];
};

export type MedRecord = {
  morning: boolean;
  evening: boolean;
};

export type AppState = {
  version: 1;
  profile: Profile | null;
  quizLogs: QuizLog[];
  daily: DailyQuiz | null;
  med: Record<string, MedRecord>;
  visits: string[];
  fontSize: 18 | 21 | 24;
  lastVisit: string;
};

export type RankingScope = "region" | "zodiac" | "streak";

export type RankingRow = {
  rank: number;
  name: string;
  points: number;
  streak: number;
  isMe: boolean;
};

export type RankingResult = {
  weekId: string;
  scope: RankingScope;
  periodLabel: string;
  rows: RankingRow[];
  total: number;
  myRank: number | null;
  myPercentile: number | null;
  sample: boolean;
};

export type WelfareProgram = {
  id: string;
  title: string;
  category: "연금" | "교통" | "의료" | "생활비" | "돌봄" | "주거";
  org: string;
  amount: string;
  summary: string;
  minAge: number;
  maxAge?: number;
  /** 이 시·도에서만 운영하는 사업이면 지정. 비어 있으면 전국 */
  sido?: string[];
  steps: string[];
  documents: string[];
  contact: string;
  phone?: string;
  url?: string;
  deadline?: string;
  tags: string[];
};
