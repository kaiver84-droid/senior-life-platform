"use client";

/**
 * 소리로 읽어 주기 — 브라우저가 가진 한국어 음성(Web Speech API)을 쓴다.
 *
 * - 휴대폰·브라우저가 지원하지 않으면(카카오톡 안 브라우저 일부, 구형 기기)
 *   조용히 false 를 돌려주고 아무 일도 하지 않는다. 화면은 그대로 쓸 수 있다.
 * - iOS Safari 는 버튼을 누른 그 순간(사용자 손짓 안)에만 소리를 낼 수 있어서
 *   버튼 클릭 핸들러에서 곧바로 speak 한다.
 * - 긴 글은 문장 단위로 잘라 차례로 읽는다(브라우저가 긴 문장을 중간에 끊는 경우가 있다).
 */

type SpeakOptions = {
  /** 1 이 보통. 어르신께는 조금 천천히(0.9 안팎) 읽는다 */
  rate?: number;
  onStart?: () => void;
  onEnd?: () => void;
};

let cachedVoice: SpeechSynthesisVoice | null | undefined;
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

function pickKoreanVoice(): SpeechSynthesisVoice | null {
  const s = synth();
  if (!s || typeof s.getVoices !== "function") return null;
  if (cachedVoice !== undefined) return cachedVoice;
  const voices = s.getVoices() || [];
  const korean = voices.filter((v) => /^ko([-_]|$)/i.test(v.lang || "") || /korean|한국/i.test(v.name || ""));
  if (!korean.length) return null; // 음성 목록이 아직 안 왔을 수 있다 — 다음에 다시 본다
  // 기기에서 고른 음성(localService)을 먼저, 그다음 이름에 '한국'이 든 음성
  cachedVoice = korean.find((v) => v.localService) ?? korean[0];
  return cachedVoice;
}

/** 이모지·특수문자는 읽지 않도록 걷어 낸다 */
function clean(text: string): string {
  return String(text || "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, " ")
    .replace(/[·•]/g, ", ")
    .replace(/[~〜]/g, "부터 ")
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 한 번에 읽기 좋은 길이(약 120자)로 문장 단위로 자른다 */
function chunk(text: string): string[] {
  const plain = clean(text);
  if (!plain) return [];
  // 오래된 아이폰 사파리에서도 문제없도록 정규식 lookbehind 없이 글자 하나씩 본다
  const sentences: string[] = [];
  let cur = "";
  for (const ch of plain) {
    cur += ch;
    if (ch === "." || ch === "!" || ch === "?" || ch === "。" || ch === "\n") {
      if (cur.trim()) sentences.push(cur.trim());
      cur = "";
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
    utter.rate = options.rate ?? 0.92;
    utter.pitch = 1;
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
