/**
 * 태어난 시간 — 시니어에게 익숙한 십이시진(十二時辰) 표기.
 * 프로필에는 짧은 이름("자시" … "해시") 또는 "모름"만 저장하고,
 * 화면에는 "자시 (밤 11시~새벽 1시)" 처럼 몇 시인지 함께 보여 준다.
 * 모르는 분이 가장 많으므로 "모르겠음"을 맨 위 첫 번째에 둔다.
 */

export type BirthTimeKey =
  | "자시"
  | "축시"
  | "인시"
  | "묘시"
  | "진시"
  | "사시"
  | "오시"
  | "미시"
  | "신시"
  | "유시"
  | "술시"
  | "해시"
  | "모름";

export const UNKNOWN_BIRTH_TIME = "모름";

export type BirthTimeOption = {
  key: BirthTimeKey;
  /** 화면에 크게 쓰는 이름 — "자시" / "모르겠음" */
  name: string;
  /** 몇 시인지 — "밤 11시~새벽 1시" (모를 때는 없음) */
  range?: string;
  /** 한 줄 전체 표기 — "자시 (밤 11시~새벽 1시)" */
  label: string;
};

/** 모르겠음이 첫 번째, 그 아래 자시부터 해시까지 차례대로 */
export const BIRTH_TIME_OPTIONS: BirthTimeOption[] = [
  { key: UNKNOWN_BIRTH_TIME, name: "모르겠음", label: "모르겠음" },
  { key: "자시", name: "자시", range: "밤 11시~새벽 1시", label: "자시 (밤 11시~새벽 1시)" },
  { key: "축시", name: "축시", range: "새벽 1시~3시", label: "축시 (새벽 1시~3시)" },
  { key: "인시", name: "인시", range: "새벽 3시~5시", label: "인시 (새벽 3시~5시)" },
  { key: "묘시", name: "묘시", range: "새벽 5시~7시", label: "묘시 (새벽 5시~7시)" },
  { key: "진시", name: "진시", range: "아침 7시~9시", label: "진시 (아침 7시~9시)" },
  { key: "사시", name: "사시", range: "오전 9시~11시", label: "사시 (오전 9시~11시)" },
  { key: "오시", name: "오시", range: "낮 11시~오후 1시", label: "오시 (낮 11시~오후 1시)" },
  { key: "미시", name: "미시", range: "오후 1시~3시", label: "미시 (오후 1시~3시)" },
  { key: "신시", name: "신시", range: "오후 3시~5시", label: "신시 (오후 3시~5시)" },
  { key: "유시", name: "유시", range: "오후 5시~7시", label: "유시 (오후 5시~7시)" },
  { key: "술시", name: "술시", range: "저녁 7시~9시", label: "술시 (저녁 7시~9시)" },
  { key: "해시", name: "해시", range: "밤 9시~11시", label: "해시 (밤 9시~11시)" },
];

/** 예전 화면에서 저장된 값을 모두 "모름" 하나로 모은다 */
const ALIASES: Record<string, string> = {
  "잘 모름": UNKNOWN_BIRTH_TIME,
  "모르겠음": UNKNOWN_BIRTH_TIME,
  "모름 (잘 모르겠어요)": UNKNOWN_BIRTH_TIME,
};

const LABELS: Record<string, string> = BIRTH_TIME_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.key]: o.label }),
  {} as Record<string, string>
);

export function isBirthTimeKey(value: unknown): value is BirthTimeKey {
  if (typeof value !== "string") return false;
  return Boolean(LABELS[value] || ALIASES[value]);
}

/** 화면에 보여 줄 이름 — 저장값이 없거나 낯선 값이면 "모르겠음" */
export function birthTimeLabel(value?: string): string {
  if (!value) return LABELS[UNKNOWN_BIRTH_TIME];
  const key = ALIASES[value] || value;
  return LABELS[key] || key;
}

/** 저장값을 지금 쓰는 값으로 맞춘다("잘 모름" → "모름") */
export function normalizeBirthTime(value?: string): string {
  if (!value) return UNKNOWN_BIRTH_TIME;
  const key = ALIASES[value] || value;
  return LABELS[key] ? key : UNKNOWN_BIRTH_TIME;
}

/** 소리로 읽어 줄 때 쓰는 말 — "자시, 밤 열한 시부터 새벽 한 시까지" */
export function birthTimeSpeech(value?: string): string {
  const key = normalizeBirthTime(value);
  if (key === UNKNOWN_BIRTH_TIME) return "태어난 시간은 모르는 것으로 골랐어요.";
  const opt = BIRTH_TIME_OPTIONS.find((o) => o.key === key);
  return opt?.range ? `${opt.name}, ${opt.range}` : key;
}

/** 저장값 그대로의 짧은 이름 ("묘시생" 처럼 붙여 쓰기) */
export function birthTimeShort(value?: string): string {
  if (!value || value === UNKNOWN_BIRTH_TIME) return "";
  return value;
}

/**
 * 시진별 성향 한 줄 + 오늘의 팁.
 * 태어난 시간을 아는 분에게만 운세 화면에서 보여 준다(모르면 표시하지 않음).
 */
export const JISIN_LINES: Record<string, { emoji: string; trait: string; tips: string[] }> = {
  자시: {
    emoji: "🌙",
    trait: "깊은 밤에 태어나 생각이 많고 마음이 섬세한 편이에요.",
    tips: [
      "밤에 혼자 고민을 키우지 말고, 낮에 가족과 이야기해 보세요.",
      "잠들기 전 따뜻한 물 한 잔이 오늘의 기운을 다독여 줘요.",
      "아침에 창문을 열고 바깥 공기를 한 번 크게 마셔 보세요.",
    ],
  },
  축시: {
    emoji: "🌌",
    trait: "고요한 새벽에 태어나 참을성과 끈기가 좋은 분이에요.",
    tips: [
      "오래 미뤄 둔 일 하나를 오전에 끝내면 마음이 가벼워져요.",
      "허리와 무릎을 따뜻하게 하고 천천히 움직이세요.",
      "꼭 해야 할 일은 적어 두면 잊지 않고 잘 챙길 수 있어요.",
    ],
  },
  인시: {
    emoji: "🌄",
    trait: "여명에 태어나 앞을 내다보는 눈과 추진력이 있어요.",
    tips: [
      "새로운 시작에 좋은 날이에요. 미뤄 둔 전화 한 통을 해 보세요.",
      "아침 산책을 하면 오늘 운이 한결 부드러워져요.",
      "서두르기보다 한 번 더 확인하면 실수가 줄어요.",
    ],
  },
  묘시: {
    emoji: "🌅",
    trait: "해 뜰 무렵 태어나 밝고 부드러운 기운을 가졌어요.",
    tips: [
      "아침 햇살을 10분만 쬐면 기분이 좋아져요.",
      "먼저 건네는 인사가 오늘의 좋은 인연을 불러요.",
      "따뜻한 차 한 잔으로 천천히 하루를 열어 보세요.",
    ],
  },
  진시: {
    emoji: "☀️",
    trait: "아침에 태어나 부지런하고 책임감이 강한 편이에요.",
    tips: [
      "오전에 몸을 움직이면 하루가 가볍게 풀려요.",
      "가족이나 이웃에게 도움을 청해도 좋은 날이에요.",
      "물을 자주 마시고 잠깐이라도 쉬어 가세요.",
    ],
  },
  사시: {
    emoji: "🌤️",
    trait: "오전에 태어나 말솜씨와 붙임성이 좋은 분이에요.",
    tips: [
      "오늘은 먼저 말을 걸면 좋은 소식이 따라와요.",
      "오래된 약속 하나를 챙기면 마음이 따뜻해져요.",
      "점심은 천천히, 천천히 드세요.",
    ],
  },
  오시: {
    emoji: "🔆",
    trait: "한낮에 태어나 기운이 넘치고 솔직한 성격이에요.",
    tips: [
      "오늘은 기운이 좋은 날이에요. 하고 싶던 일을 하나 시작해 보세요.",
      "너무 더우면 오후 두 시 전후로는 실내에서 쉬세요.",
      "지출은 한 번 더 살펴보면 좋아요.",
    ],
  },
  미시: {
    emoji: "🍵",
    trait: "오후에 태어나 온화하고 살림을 잘 챙기는 편이에요.",
    tips: [
      "오후에 마시는 따뜻한 차가 오늘의 복을 불러요.",
      "자녀나 손주에게 안부를 전해 보세요.",
      "집 안 곳곳을 조금 정리하면 기분이 맑아져요.",
    ],
  },
  신시: {
    emoji: "🌇",
    trait: "해 질 무렵 태어나 예의와 배려가 깊은 분이에요.",
    tips: [
      "오늘 만나는 사람에게 먼저 웃어 보세요.",
      "해가 지기 전 가벼운 걷기를 하면 잠이 잘 와요.",
      "받을 돈이나 환급금을 한 번 확인해 보세요.",
    ],
  },
  유시: {
    emoji: "🌆",
    trait: "저녁에 태어나 꼼꼼하고 정리 정돈을 잘하는 편이에요.",
    tips: [
      "서류나 지출을 정리하기에 좋은 저녁이에요.",
      "가족과 저녁을 함께하면 좋은 이야기가 오가요.",
      "잠들기 전 화면은 조금 일찍 끄는 게 좋아요.",
    ],
  },
  술시: {
    emoji: "🌃",
    trait: "초저녁에 태어나 의리와 정이 많은 분이에요.",
    tips: [
      "오랜 친구에게 연락하면 반가운 소식이 와요.",
      "늦은 저녁 식사는 가볍게 드세요.",
      "따뜻하게 입고 나가면 감기를 피할 수 있어요.",
    ],
  },
  해시: {
    emoji: "✨",
    trait: "밤에 태어나 감수성이 풍부하고 챙김이 세심한 편이에요.",
    tips: [
      "오늘 하루 감사했던 일 세 가지를 떠올려 보세요.",
      "잠자리 전 발을 따뜻하게 하면 숙면에 좋아요.",
      "혼자 고민하지 말고 가까운 사람에게 말해 보세요.",
    ],
  },
};
