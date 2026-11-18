/**
 * lib/tts.ts 검증 — 한국어 여성 아나운서 음성 선택 · 낭독 전처리 · rate/pitch 기본값.
 *
 *   cd /workspace/work/senior-platform
 *   PATH=/workspace/work/.tools/node-v20.18.0-linux-x64/bin:$PATH node e2e/check_tts_voice.mjs
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, "..");
const OUT = "/tmp/ttscheck";
fs.rmSync(OUT, { recursive: true, force: true });
execFileSync(
  path.join(ROOT, "node_modules/.bin/tsc"),
  [path.join(ROOT, "lib/tts.ts"), "--outDir", OUT, "--module", "commonjs", "--target", "es2020", "--moduleResolution", "node", "--skipLibCheck"],
  { stdio: "inherit" }
);

const require = createRequire(import.meta.url);
const MOD = path.join(OUT, "tts.js");

const results = [];
function check(cond, label, extra = "") {
  results.push([!!cond, label]);
  console.log(`${cond ? "  OK  " : " FAIL "} ${label}${extra ? ` — ${extra}` : ""}`);
}

const v = (name, lang = "ko-KR", localService = true) => ({ name, lang, localService, default: false, voiceURI: name });

function setup(voices) {
  const spoken = [];
  const listeners = [];
  class U {
    constructor(text) {
      this.text = text;
    }
  }
  const s = {
    speaking: false,
    paused: false,
    getVoices: () => voices,
    speak: (u) => spoken.push({ text: u.text, voice: u.voice ? u.voice.name : null, rate: u.rate, pitch: u.pitch, lang: u.lang }),
    cancel: () => {},
    resume: () => {},
    pause: () => {},
    addEventListener: (t, fn) => listeners.push(fn),
    removeEventListener: () => {},
    onvoiceschanged: null,
  };
  global.window = { speechSynthesis: s, SpeechSynthesisUtterance: U };
  global.SpeechSynthesisUtterance = U;
  return { spoken, s, fire: () => listeners.forEach((fn) => fn()) };
}

function load() {
  delete require.cache[require.resolve(MOD)];
  return require(MOD);
}

/* 1) 섞인 목록 — 고음질 여성(SunHi Enhanced)이 남성·기본보다 먼저 */
{
  const { spoken } = setup([v("Minsu"), v("Google 한국의", "ko-KR", false), v("Yuna"), v("SunHi (Enhanced)"), v("Korean", "ko-KR")]);
  const tts = load();
  tts.speakKorean("안녕하세요. 신청 방법을 알려 드릴게요.");
  check(spoken[0]?.voice === "SunHi (Enhanced)", "SunHi(Enhanced) 우선", `고른 음성: ${spoken[0]?.voice}`);
}

/* 2) SunHi 없으면 Yuna 가 Google·남성보다 먼저 */
{
  const { spoken } = setup([v("Minsu"), v("Google 한국의", "ko-KR", false), v("Yuna (Enhanced)")]);
  const tts = load();
  tts.speakKorean("오늘 날씨가 맑아요.");
  check(spoken[0]?.voice === "Yuna (Enhanced)", "Yuna 우선", `고른 음성: ${spoken[0]?.voice}`);
}

/* 3) Yuna·SunHi 없으면 ‘Google 한국의’ 가 기본·남성보다 먼저 (Sora/Seoyeon/Jihye/Heami 도 같은 등급) */
{
  const { spoken } = setup([v("Minsu"), v("Korean (기본)"), v("Google 한국의", "ko-KR", false)]);
  const tts = load();
  tts.speakKorean("신청은 읍사무소에서 하세요.");
  check(spoken[0]?.voice === "Google 한국의", "Google 한국의 우선", `고른 음성: ${spoken[0]?.voice}`);
}
for (const [label, want, voices] of [
  ["소라(Sora)", "Sora", [v("Minsu"), v("Korean"), v("Sora")]],
  ["서연(Seoyeon)", "Seoyeon", [v("Minsu"), v("Korean"), v("Seoyeon")]],
  ["지혜(Jihye)", "Jihye", [v("Minsu"), v("Korean"), v("Jihye")]],
  ["해미(Heami)", "Heami", [v("Minsu"), v("Korean"), v("Heami")]],
  ["Samsung 여성", "Samsung 한국어 TTS", [v("Minsu"), v("Samsung 한국어 TTS"), v("Korean")]],
]) {
  const { spoken } = setup(voices);
  const tts = load();
  tts.speakKorean("확인해 보세요.");
  check(spoken[0]?.voice === want, `${label} 선택`, `고른 음성: ${spoken[0]?.voice}`);
}

/* 4) 남성 음성은 여성·기본 음성이 전혀 없을 때만 */
{
  const { spoken } = setup([v("Minsu"), v("Korean")]);
  const tts = load();
  tts.speakKorean("안내입니다.");
  check(spoken[0]?.voice === "Korean", "남성 대신 기본 음성", `고른 음성: ${spoken[0]?.voice}`);
}
{
  const { spoken } = setup([v("Minsu")]);
  const tts = load();
  tts.speakKorean("안내입니다.");
  check(spoken[0]?.voice === "Minsu", "남성 음성만 있을 때 최후 폴백", `고른 음성: ${spoken[0]?.voice}`);
}

/* 5) voiceschanged 뒤 새로 도착한 음성을 다시 고른다 */
{
  const voices = [v("Minsu"), v("Korean")];
  const { spoken, fire } = setup(voices);
  const tts = load();
  tts.speakKorean("처음 안내.");
  const first = spoken[0]?.voice;
  voices.push(v("Yuna (Enhanced)"));
  fire();
  spoken.length = 0;
  tts.speakKorean("다시 안내.");
  check(first === "Korean" && spoken[0]?.voice === "Yuna (Enhanced)", "voiceschanged 후 재선택", `${first} → ${spoken[0]?.voice}`);
}

/* 6) rate 0.95 · pitch 1.04 기본값, options 로 덮어쓰기 */
{
  const { spoken } = setup([v("Yuna")]);
  const tts = load();
  tts.speakKorean("기본값 확인.");
  check(spoken[0]?.rate === 0.95 && spoken[0]?.pitch === 1.04, "기본 rate/pitch", `${spoken[0]?.rate}/${spoken[0]?.pitch}`);
  spoken.length = 0;
  tts.speakKorean("덮어쓰기 확인.", { rate: 0.8, pitch: 1.0 });
  check(spoken[0]?.rate === 0.8 && spoken[0]?.pitch === 1.0, "options 우선", `${spoken[0]?.rate}/${spoken[0]?.pitch}`);
}

/* 7) 낭독 전처리 — 번호·기호·이모지 */
{
  const { spoken } = setup([v("Yuna")]);
  const tts = load();
  tts.speakKorean("1. 신청서 작성 2) 접수 ③ 준비 · 확인 9시~18시 🚪 신청 → 완료.");
  const said = spoken.map((s) => s.text).join(" ");
  check(/첫째/.test(said) && /둘째/.test(said) && /셋째/.test(said), "번호를 첫째·둘째·셋째로", said);
  check(!/\d[.)]/.test(said) && !/[·•~🚪→]/.test(said), "기호·이모지 제거", said);
  check(/준비,\s*확인/.test(said), "가운뎃점 → 쉼표", said);
  check(/부터/.test(said), "물결표 → 부터", said);
}
{
  const { spoken } = setup([v("Yuna")]);
  const tts = load();
  tts.speakKorean("올해는 3.5% 인상되고 2.0점이 올랐어요.");
  const said = spoken.map((s) => s.text).join(" ");
  check(/3\.5%/.test(said) && /2\.0점/.test(said), "소수점은 그대로", said);
}

/* 8) 읽을 수 없는 기기에서는 false */
{
  global.window = {};
  const tts = load();
  check(tts.speakKorean("안녕") === false && tts.ttsSupported() === false, "음성 없는 기기 → false");
}

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} 통과`);
process.exit(failed.length ? 1 : 0);
