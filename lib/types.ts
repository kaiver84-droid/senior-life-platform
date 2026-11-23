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
  /** 카카오톡 프로필 사진 주소(https). 없으면 이름 첫 글자로 표시한다. */
  avatarUrl?: string;
  /** 예전 이름 — avatarUrl 과 같은 값(이 기기에 이미 저장된 설정과 호환) */
  avatar?: string;
  /** 로그인 후 최초 1회 초기 설정(이름·태어난해·태어난시간·지역)을 마쳤는지 */
  profileCompleted?: boolean;
};

import type { FamilyEvent } from "./calendar";

export type QuizType =
  | "choseong"
  | "lyrics"
  | "spot"
  | "ox"
  | "nonsense"
  | "nostalgia"
  | "safety_slang"
  | "seasonal";

/** 날짜별 건강생활 챌린지 체크인 — { "2026-11-16": ["water", "walk"] } */
export type HealthChecks = Record<string, string[]>;

export type QuizLog = {
  date: string; // YYYY-MM-DD (KST)
  weekId: string; // 2026-W47
  correct: number;
  total: number;
  points: number;
  seconds: number;
  types: QuizType[];
  at: string; // ISO
  /** 그날 연습 모드(무한 연습 포함)에서 맞힌 문제 수 — 맞힌 만큼 points 에 1점씩 더해진다.
   *  이 값이 있어도 하루 미션을 마친 것(total > 0)은 아니다. */
  practice?: number;
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
  /** 날짜별 건강생활 챌린지 체크인(완료 도장) */
  health: HealthChecks;
  /** 날짜별 확인 미션 기록 — { "2026-11-17": ["welfare","group"] } */
  missions: Record<string, string[]>;
  /** 랭킹 참여 — 끄면 내 점수는 개인 기록으로만 남고 공개 순위표에서 빠진다 */
  rankingVisible: boolean;
  fontSize: 18 | 21 | 24;
  lastVisit: string;
};

export type RankingScope = "region" | "zodiac" | "streak" | "national" | "group" | "groups" | "invite";

/** 순위표에서 고르는 범위 — 우리 모임 · 지역별 · 전국 · 연령대 */
export type RankingRange = "group" | "region" | "national" | "age";

/** 어제 대비 순위 변동 — +2(▲2) · -1(▼1) · 0(그대로) · null(신규) */
export type RankingChange = number | null;

export type RankingRow = {
  rank: number;
  name: string;
  points: number;
  streak: number;
  isMe: boolean;
  /** 카카오톡 프로필 사진(있으면 원형 사진, 없으면 이름 첫 글자) */
  avatarUrl?: string;
  /** 초대왕 순위에서 초대에 성공한 사람 수 */
  invites?: number;
  /** 영역별 표시값 — ‘120점’ · ‘5일 출석’ · ‘3명 초대’ */
  display?: string;
  /** 어제 대비 순위 변동 배지 */
  change?: RankingChange;
  /** 정답률 같은 덧붙임 */
  note?: string;
  /** 누적 점수로 정한 등급 배지 — 이름 옆에 작게 보여 준다 */
  grade?: GradeBadge;
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
  /** 초대왕 순위에서 내가 초대한 사람 수 */
  myInvites?: number;
  /** 이 순위표가 보여 주는 영역(늘봄왕·기억왕 …) */
  area?: string;
  /** ‘지역별’ 순위표의 기준 이름 — 정식 시·도 명칭(충청북도·대전광역시 등) */
  regionLabel?: string;
  /** 내 순위 격차 안내에 쓰는 값 */
  myGap?: {
    rank: number | null;
    aheadName?: string;
    aheadDiff?: number;
    top10Diff?: number;
    total?: number;
  };
  /** 내 영역 값과 변동(카드에 그대로 보여 준다) */
  myDisplay?: string;
  myChange?: RankingChange;
  myNote?: string;
  /** 날짜별 내 초대 성공 수 — 늘봄왕 점수의 초대 점수에 쓴다 */
  invitesByDay?: Record<string, number>;
};

/** 단체(모임)끼리 겨루는 순위 한 칸 — 모임 하나가 한 줄 */
export type GroupRankingRow = {
  id: string;
  rank: number;
  name: string;
  memberCount: number;
  /** 오늘 출석한 모임원 비율(%) */
  attendance: number;
  /** 이번 주 모임 합산 점수 */
  points: number;
  /** 모임원 1인당 평균 점수 */
  average: number;
  isMine: boolean;
};

export type GroupRankingResult = {
  weekId: string;
  scope: "groups";
  periodLabel: string;
  rows: GroupRankingRow[];
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
  /** 모임 지역 — ‘옥천군’ 처럼 짧게(없으면 빈 값) */
  region?: string;
  isDemo: boolean;
  memberCount: number;
  /** 정원 — 한 모임에 들어갈 수 있는 최대 인원(기본 100명) */
  maxMembers?: number;
  /** 지금(최근 5분 안에) 접속해 있는 모임원 수 — 나 포함 */
  onlineCount?: number;
  goalScore: number;
  weeklyGoal: number;
  myRole: GroupRole;
};

export type GroupMemberInfo = {
  code: string;
  name: string;
  /** 카카오톡 프로필 사진 주소 — 모임원 출석 현황에 원형 사진으로 보여 준다 */
  avatarUrl?: string;
  isMe: boolean;
  isLeader: boolean;
  isDemo: boolean;
  /** 지금 접속 중(최근 5분 안에 앱을 열었거나 내가 본인) */
  online?: boolean;
  /** 오늘 출석(접속·퀴즈) 했는지 */
  todayAttended: boolean;
  /** 이번 주 참여 일수 */
  weekDays: number;
  /** 이번 주 퀴즈 점수 */
  points: number;
  rank: number;
  /** 오늘 ‘약 챙기기’를 체크했는지 — 가족이 링크 없이 모임 화면에서 바로 확인 */
  medicineDone?: boolean;
  /** 오늘 건강 챌린지 5종 중 완료한 수 */
  healthDoneCount?: number;
  /** 마지막 접속을 사람이 읽는 말로 — ‘접속 중’ · ‘3분 전’ · ‘오프라인’ */
  lastSeenLabel?: string;
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

/** 모임원들과 함께 보는 오늘의 건강 챌린지 달성률 */
export type GroupHealthSummary = {
  /** 챌린지 종류 수 (5) */
  total: number;
  memberCount: number;
  /** 오늘 한 가지라도 체크한 모임원 수 */
  joined: number;
  /** joined / memberCount % */
  rate: number;
  /** 내가 오늘 체크한 개수 */
  myDone: number;
  /** 챌린지별로 오늘 체크한 사람 수 */
  cells: { id: string; label: string; emoji: string; done: number }[];
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
  /** 오늘의 건강 챌린지 현황 (서버·오프라인 공용) */
  health?: GroupHealthSummary | null;
  myRank: number | null;
  top: { name: string; points: number } | null;
};

export type GroupsPayload = {
  groups: GroupSummary[];
  activeGroupId: string | null;
  detail: GroupDetail | null;
  /** 정원 — 한 모임에 들어갈 수 있는 최대 인원(기본 100명) */
  maxMembers?: number;
};

export type WelfareProgram = {
  id: string;
  title: string;
  category: "연금" | "교통" | "의료" | "생활비" | "돌봄" | "주거" | "일자리";
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

/* ------------------------------------------------------------------ */
/* 랭킹 고도화 2차 — 등급·배지 · 1:1 대결 · 모임 대항전                  */
/* ------------------------------------------------------------------ */

/** 순위표 한 줄에 붙는 작은 등급 표시 */
export type GradeBadge = {
  key: string;
  label: string;
  emoji: string;
};

/** 내 등급·배지 요약 (/api/rankings?scope=profile) */
export type GradeProfile = {
  totalPoints: number;
  grade: { key: string; level: number; label: string; emoji: string; min: number; remaining: number; percent: number };
  next: { label: string; emoji: string; min: number } | null;
  badges: {
    id: string;
    label: string;
    emoji: string;
    how: string;
    goal: number;
    unit: string;
    value: number;
    earned: boolean;
    left: number;
    percent: number;
  }[];
  stats: {
    attendDays: number;
    streak: number;
    quizCorrect: number;
    quizDays: number;
    healthDays: number;
    welfareDays: number;
    groupDays: number;
    inviteCount: number;
    groupMates: number;
    groupCount: number;
  };
  sample?: boolean;
};

/** 친구와 1:1 대결 한 건 */
export type DuelInfo = {
  id: string;
  kind: "quiz" | "total";
  kindLabel: string;
  status: "pending" | "accepted" | "declined";
  iAmChallenger: boolean;
  otherName: string;
  myName: string;
  myScore: number;
  otherScore: number;
  /** 내가 이기고 있는지 — 'win' | 'lose' | 'tie' */
  lead: "win" | "lose" | "tie";
  /** 화면에 그대로 보여 주는 따뜻한 한 줄 */
  message: string;
  fromLink: boolean;
  createdAt: string;
  duelDate: string;
};

export type DuelPayload = {
  ok: boolean;
  today: string;
  myCode: string;
  myName: string;
  duels: DuelInfo[];
  incoming: DuelInfo[];
  outgoing: DuelInfo[];
  /** 함께 겨룰 수 있는 모임원(나 제외, 체험 회원 제외) */
  partners: { code: string; name: string; groupName: string }[];
};

/** 모임 대항전 순위 한 줄 */
export type GroupBattleRow = {
  id: string;
  rank: number;
  name: string;
  memberCount: number;
  score: number;
  goal: number;
  /** 공동 목표 진행률(%) */
  rate: number;
  isMine: boolean;
  sample: boolean;
};

export type GroupBattleResult = {
  weekId: string;
  periodLabel: string;
  rows: GroupBattleRow[];
  myGroup: GroupBattleRow | null;
  total: number;
  /** 1등까지 남은 점수 */
  gapToFirst: number;
  message: string;
  sample: boolean;
};
