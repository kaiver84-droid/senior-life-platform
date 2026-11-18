"use client";

/**
 * 소리로 읽어 주기 — 브라우저가 가진 한국어 음성(Web Speech API)을 쓴다.
 *
 * - 휴대폰·브라우저가 지원하지 않으면(카카오톡 안 브라우저 일부, 구형 기기)
 *   조용히 false 를 돌려주고 아무 일도 하지 않는다. 화면은 그대로 쓸 수 있다.
 * - iOS Safari 는 버튼을 누른 그 순간(사용자 손짓 안)에만 소리를 낼 수 있어서
 *   버튼 클릭 핸들러에서 곧바로 speak 한다.
 * - 긴 글은 문장 단위로 잘라 차례로 읽는다(브라우저가 긴 문장을 중간에 끊는 경우가 있다).
 * - 목소리는 **한국어 여성 아나운서 톤**을 먼저 고른다(기기 기본 음성은 남성·기계음이 섞여 있다).
 */

type SpeakOptions = {
  /** 1 이 보통. 어르신께는 조금 천천히(0.95 안팎) 읽는다 */
  rate?: number;
  /** 1 이 보통. 1보다 조금 높이면 맑고 부드러운 여성 톤이 된다 */
  pitch?: number;
  onStart?: () => void;
  onEnd?: () => void;
};

/** 아나운서처럼 또렷하고 안정적인 속도 · 맑고 부드러운 여성 톤 */
const DEFAULT_RATE = 0.95;
const DEFAULT_PITCH = 1.04;

let cachedVoice: SpeechSynthesisVoice | null | undefined;
let voicesHooked = false;
/** 멈추기·새로 읽기 때 이전 읽기가 끝나며 상태를 건드리지 않게 하는 번호 */
let session = 0;

function synth(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  const s = (window as unknown as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
  return s && typeof s.speak === "function" ? s : null;
}

/** 이 기기에서 소리로 읽어 줄 수 있는지 */
export function ttsSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (!synth()) return false;
  return typeof window.SpeechSynthesisUtterance === "function";
}

/** 음성 목록은 기기에서 늦게(비동기로) 도착한다 — 도착하면 다시 고르게 한다 */
function hookVoicesChanged(s: SpeechSynthesis) {
  if (voicesHooked) return;
  voicesHooked = true;
  const reset = () => {
    cachedVoice = undefined;
  };
  try {
    s.addEventListener("voiceschanged", reset);
  } catch {
    /* 아주 오래된 브라우저 — 아래 onvoiceschanged 로 대신한다 */
  }
  try {
    s.onvoiceschanged = reset;
  } catch {
    /* 무시 */
  }
}

/**
 * 한국어 여성 아나운서 음성의 우선순위(점수). 높을수록 먼저 쓴다.
 * 1) 고음질·자연음성 여성  2) 크롬·안드로이드 여성 아나운서 톤  3) 삼성 여성 음성
 */
const FEMALE_TOP: Array<[RegExp, number]> = [
  [/sunhi|sun-hee|선히/i, 78],
  [/yuna|유나/i, 76],
  [/sora|소라/i, 74],
  [/seoyeon|서연/i, 72],
  [/jihye|지혜/i, 70],
  [/heami|해미/i, 68],
  [/\bsiri\b/i, 60],
  [/google/i, 52],
  [/female|여성/i, 44],
  [/samsung|삼성/i, 42],
  [/\bism\b|ism_|-ism/i, 40],
  [/\bkod\b|kod_|-kod/i, 40],
];

const MALE: Array<[RegExp, number]> = [
  [/minsu|민수/i, -80],
  [/injoon|인준/i, -80],
  [/hyunsu|hyun-su|현수/i, -80],
  // \bmale\b 는 'female' 안의 male 과 겹치지 않는다(낱말 경계)
  [/\bmale\b|남성|남자/i, -80],
];

function scoreVoice(v: SpeechSynthesisVoice): number {
  const name = v.name || "";
  const lang = v.lang || "";
  let score = 0;

  if (/^ko[-_]kr$/i.test(lang)) score += 8;
  else if (/^ko[-_]/i.test(lang) || /korean|한국/i.test(name)) score += 4;

  // 자연음성·고음질 표시가 있으면 더 좋다 (예: "Yuna (Enhanced)", "Yuna Premium")
  if (/enhanced|premium|neural|natural|고품질|확장/i.test(name)) score += 14;

  let female = false;
  for (const [re, pts] of FEMALE_TOP) {
    if (re.test(name)) {
      score += pts;
      female = true;
      break;
    }
  }
  let male = false;
  for (const [re, pts] of MALE) {
    if (re.test(name)) {
      score += pts;
      male = true;
      break;
    }
  }
  // 이름에 성별 표시가 없는 흔한 기기 음성은 남성으로 몰지 않는다
  if (!female && !male) score += 10;
  // 기기에 들어 있는 음성은 네트워크 없이도 바로 나온다 — 같은 점수면 이쪽을 쓴다
  if (v.localService) score += 2;
  return score;
}

function pickKoreanVoice(): SpeechSynthesisVoice | null {
  const s = synth();
  if (!s || typeof s.getVoices !== "function") return null;
  if (cachedVoice !== undefined) return cachedVoice;
  hookVoicesChanged(s);

  const voices = s.getVoices() || [];
  const korean = voices.filter((v) => /^ko([-_]|$)/i.test(v.lang || "") || /korean|한국/i.test(v.name || ""));
  if (!korean.length) return null; // 음성 목록이 아직 안 왔을 수 있다 — 다음에 다시 본다

  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -Infinity;
  for (const v of korean) {
    const sc = scoreVoice(v);
    if (sc > bestScore) {
      bestScore = sc;
      best = v;
    }
  }
  cachedVoice = best;
  return cachedVoice;
}

const ORDINALS = ["첫째", "둘째", "셋째", "넷째", "다섯째", "여섯째", "일곱째", "여덟째", "아홉째", "열째"];
const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩";

function ordinalOf(n: number): string {
  return ORDINALS[n - 1] ?? `${n}번째`;
}

/** "1. 신청" "2) 접수" "① 준비" 같은 번호를 읽기 좋은 말로 바꾼다 */
function readOrdinals(text: string): string {
  return text
    .replace(new RegExp(`[${CIRCLED}]`, "g"), (m) => ` ${ordinalOf(CIRCLED.indexOf(m) + 1)}, `)
    .replace(/(^|[\s,，])(\d{1,2})[.)](?=\s|[가-힣])/g, (_m, pre: string, num: string) => {
      const head = pre === "," || pre === "，" ? ", " : pre;
      return `${head}${ordinalOf(Number(num))}, `;
    });
}

/** 이모지·특수문자는 읽지 않도록 걷어 내고, 낭독하기 좋게 다듬는다 */
function clean(text: string): string {
  const plain = String(text || "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, " ")
    .replace(/[·•]/g, ", ")
    .replace(/[~〜]/g, "부터 ")
    .replace(/[→➜]/g, " 다음 ")
    .replace(/[“”"']/g, "")
    .replace(/(^|\n)\s*[-–—*]\s+/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
  return readOrdinals(plain)
    .replace(/([.!?])\s*(?:\1\s*)+/g, "$1 ")
    .replace(/([.!?])\s+\./g, "$1")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}

/** 한 번에 읽기 좋은 길이(약 120자)로 문장 단위로 자른다 */
function chunk(text: string): string[] {
  const plain = clean(text);
  if (!plain) return [];
  // 오래된 아이폰 사파리에서도 문제없도록 정규식 lookbehind 없이 글자 하나씩 본다
  // (소수점 "3.5" 는 문장 끝이 아니므로 그대로 둔다)
  const chars = Array.from(plain);
  const sentences: string[] = [];
  let cur = "";
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    cur += ch;
    const isDigit = (c: string | undefined) => !!c && /[0-9]/.test(c);
    const endOfSentence =
      ch === "." || ch === "!" || ch === "?" || ch === "。" || ch === "\n";
    if (endOfSentence) {
      const decimal = ch === "." && isDigit(chars[i - 1]) && isDigit(chars[i + 1]);
      const onlyPunct = /^[.!?。\s]*$/.test(cur);
      if (!decimal) {
        // 마침표만 남은 조각("…하세요. . 둘째")은 문장으로 치지 않는다
        if (cur.trim() && !onlyPunct) sentences.push(cur.trim());
        cur = "";
      }
    }
  }
  if (cur.trim()) sentences.push(cur.trim());

  const out: string[] = [];
  let line = "";
  for (const s of sentences) {
    if ((line + " " + s).trim().length > 120 && line) {
      out.push(line.trim());
      line = s;
    } else {
      line = `${line} ${s}`;
    }
  }
  if (line.trim()) out.push(line.trim());
  // 한 문장이 너무 길면 마지막으로 잘라 둔다
  return out.flatMap((s) => (s.length > 220 ? s.match(/.{1,200}/g) ?? [s] : [s]));
}

/**
 * 한국어로 읽어 준다. 읽기 시작했으면 true, 이 기기에서 못 읽으면 false.
 * (false 일 때도 화면은 그대로 쓸 수 있다 — 소리만 나지 않는다)
 */
export function speakKorean(text: string, options: SpeakOptions = {}): boolean {
  const s = synth();
  if (!s || typeof window.SpeechSynthesisUtterance !== "function") return false;
  const parts = chunk(text);
  if (!parts.length) return false;

  session += 1;
  const mySession = session;
  try {
    s.cancel();
  } catch {
    /* 이미 멈춰 있으면 그냥 진행 */
  }

  const voice = pickKoreanVoice();
  options.onStart?.();

  parts.forEach((part, i) => {
    const utter = new SpeechSynthesisUtterance(part);
    utter.lang = "ko-KR";
    if (voice) utter.voice = voice;
    utter.rate = options.rate ?? DEFAULT_RATE;
    utter.pitch = options.pitch ?? DEFAULT_PITCH;
    utter.volume = 1;
    if (i === parts.length - 1) {
      utter.onend = () => {
        if (mySession === session) options.onEnd?.();
      };
      utter.onerror = () => {
        if (mySession === session) options.onEnd?.();
      };
    }
    try {
      s.speak(utter);
    } catch {
      if (mySession === session) options.onEnd?.();
    }
  });

  // 크롬은 일시정지 상태로 남아 있으면 소리가 나지 않는다 — 한 번 깨워 준다
  try {
    if (s.paused) s.resume();
  } catch {
    /* 무시 */
  }
  return true;
}

/** 읽기를 멈춘다(화면을 닫거나 다른 글을 읽을 때) */
export function stopSpeaking(): void {
  session += 1;
  const s = synth();
  if (!s) return;
  try {
    s.cancel();
  } catch {
    /* 무시 */
  }
}
