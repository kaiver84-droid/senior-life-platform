export type Profile = {
  /** 사람 식별자 (카카오 로그인이면 kakao_xxx, 가족 확인용 코드로도 사용) */
  id: string;
  nickname: string;
  birthYear: number;
  /** 태어난 시간 — 십이시진 이름("자시" … "해시") 또는 "모름" */
  birthTime?: string;
  sido: string;
  sigungu: string;
  createdAt: string;
  source: "demo" | "kakao";
  avatar?: string;
  /** 로그인 후 최초 1회 초기 설정(이름·태어난해·태어난시간·지역)을 마쳤는지 */
  profileCompleted?: boolean;
};

import type { FamilyEvent } from "./calendar";

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
  /** 가족안부달력에 저장한 가족 일정 */
  familyEvents: FamilyEvent[];
  fontSize: 18 | 21 | 24;
  lastVisit: string;
};

export type RankingScope = "region" | "zodiac" | "streak" | "national" | "group";

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

/* ------------------------------------------------------------------ */
/* 모임 (groups · group_members · group_posts)                         */
/* ------------------------------------------------------------------ */

export type GroupRole = "leader" | "member" | "demo";

export type GroupSummary = {
  id: string;
  name: string;
  description: string;
  isDemo: boolean;
  memberCount: number;
  goalScore: number;
  weeklyGoal: number;
  myRole: GroupRole;
};

export type GroupMemberInfo = {
  code: string;
  name: string;
  isMe: boolean;
  isLeader: boolean;
  isDemo: boolean;
  /** 오늘 출석(접속·퀴즈) 했는지 */
  todayAttended: boolean;
  /** 이번 주 참여 일수 */
  weekDays: number;
  /** 이번 주 퀴즈 점수 */
  points: number;
  rank: number;
};

export type GroupPostInfo = {
  id: string;
  authorCode: string;
  authorName: string;
  content: string;
  createdAt: string;
  cheers: number;
  cheeredByMe: boolean;
};

export type GroupDetail = GroupSummary & {
  creatorCode: string;
  members: GroupMemberInfo[];
  posts: GroupPostInfo[];
  /** 오늘 출석 인원 */
  todayAttended: number;
  /** 오늘 출석률 % */
  attendanceRate: number;
  /** 이번 주 모임 달성률 % (참여 일수 / 목표) */
  weeklyRate: number;
  totalPoints: number;
  myRank: number | null;
  top: { name: string; points: number } | null;
};

export type GroupsPayload = {
  groups: GroupSummary[];
  activeGroupId: string | null;
  detail: GroupDetail | null;
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
