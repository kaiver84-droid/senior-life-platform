"use client";

/**
 * 추억 상자 — 오늘 처음 접속하면 화면 가운데에 한 번 떠오르는 선물 상자.
 *
 * - 상자를 누르면 그 사람이 20~30대였던 시절의 한국 추억 사진이 열린다.
 * - 하루에 한 번만 뜬다(오늘 날짜를 localStorage 에 적어 둔다).
 * - 상자를 누른 그 순간(사용자 손짓 안에서) Web Audio 로 오르골 소리를 낸다.
 *   iOS 사파리는 클릭 핸들러 밖에서 만든 AudioContext 로는 소리를 내지 못하므로
 *   반드시 이 함수를 onClick 안에서 곧바로 부른다.
 */

/** 오늘 상자를 열었는지 적어 두는 키 — 값은 'YYYY-MM-DD' */
export const MEMORY_BOX_SEEN_KEY = "neulbom.memoryBoxSeenDate";

/** 상자 그림(초고화질) — webp 를 먼저 쓰고, 못 읽는 브라우저는 png 로 받는다 */
export const MEMORY_BOX_IMAGE = "/images/memory-box-gift.webp";
export const MEMORY_BOX_IMAGE_PNG = "/images/memory-box-gift.png";

export type MemoryPhoto = {
  /** public 안의 이미지 경로(webp) */
  src: string;
  /** png 원본 — webp 를 못 읽는 브라우저용 */
  srcPng: string;
  /** 화면 읽어주기·검색을 위한 설명 */
  alt: string;
  /** 사진 아래 따뜻한 한 줄 */
  line: string;
};

export type MemoryEra = {
  key: string;
  /** 이 시대의 이름 — 예: '1970~1980년대' */
  label: string;
  /** 태어난 해(양력) 구간 */
  from: number;
  to: number;
  photos: MemoryPhoto[];
};

const photo = (name: string, alt: string, line: string): MemoryPhoto => ({
  src: `/images/memory-box/${name}.webp`,
  srcPng: `/images/memory-box/${name}.png`,
  alt,
  line,
});

/**
 * 시대별 추억 사진 — 태어난 해로 그 사람이 20~30대였던 때를 고른다.
 * 사진은 시대마다 두 장씩 두고, 날짜로 골라 같은 시대라도 날마다 다른 사진이 뜬다.
 */
export const MEMORY_ERAS: MemoryEra[] = [
  {
    key: "1960s",
    label: "1960~1970년대",
    from: 0,
    to: 1949,
    photos: [
      photo(
        "era1-a",
        "1960년대 한옥 마당과 장독대, 햇볕에 널린 빨래",
        "장독대 너머로 어머니의 밥 짓는 냄새가 번지던 오후"
      ),
      photo(
        "era1-b",
        "1960년대 시골길, 돌담에 기대 세워 둔 자전거와 감나무",
        "자전거 하나로 온 동네를 누비던 그 시절"
      ),
    ],
  },
  {
    key: "1970s",
    label: "1970~1980년대",
    from: 1950,
    to: 1959,
    photos: [
      photo(
        "era2-a",
        "1970년대 캠퍼스 잔디밭에서 통기타를 치며 둘러앉은 청춘들",
        "통기타 소리에 둘러앉아 밤늦도록 노래하던 캠퍼스"
      ),
      photo(
        "era2-b",
        "1980년대 봄 들판 소풍, 도시락을 펴 놓고 연을 날리는 가족",
        "돗자리 펴고 김밥 나눠 먹던 봄날 소풍"
      ),
    ],
  },
  {
    key: "1980s",
    label: "1980~1990년대 초반",
    from: 1960,
    to: 1969,
    photos: [
      photo(
        "era3-a",
        "1980년대 창가 책상 위 카세트와 노란 워크맨, 주황색 헤드폰",
        "워크맨에 이어폰 꽂고 걷던 퇴근길"
      ),
      photo(
        "era3-b",
        "1980년대 말 노을 진 거리를 나란히 걷는 젊은 두 사람",
        "노을 진 거리를 나란히 걷던 우리"
      ),
    ],
  },
  {
    key: "1990s",
    label: "1990~2000년대 초반",
    from: 1970,
    to: 1979,
    photos: [
      photo(
        "era4-a",
        "1990년대 저녁 거리의 파란 공중전화 부스에 기대 선 사람",
        "동전 몇 개로 걸려 온 그 목소리가 아직도 생각나는"
      ),
      photo(
        "era4-b",
        "1990년대 한강 둔치, 자전거를 세워 두고 노을을 보는 친구들",
        "한강 바람 맞으며 내일을 이야기하던 저녁"
      ),
    ],
  },
  {
    key: "2000s",
    label: "2000~2010년대",
    from: 1980,
    to: 1989,
    photos: [
      photo(
        "era5-a",
        "2000년대 카페 테이블 위 은색 디지털 카메라와 아이스커피",
        "찍고 또 찍어 지우던 디카 속 우리 모습"
      ),
      photo(
        "era5-b",
        "2000년대 저녁 거리, 불 켜진 가게들 사이를 걷는 사람들",
        "불 켜진 골목을 걷다 보면 마음이 풀리던 밤"
      ),
    ],
  },
  {
    key: "2010s",
    label: "2010~2020년대",
    from: 1990,
    to: 9999,
    photos: [
      photo(
        "era6-a",
        "벚꽃 아래 돗자리를 펴고 둘러앉은 젊은 사람들",
        "벚꽃 아래 돗자리 펴고 웃음꽃 피던 봄"
      ),
      photo(
        "era6-b",
        "햇살 드는 카페 창가, 필름 카메라와 커피 한 잔",
        "햇살 좋은 창가에서 커피 한 잔 나누던 오후"
      ),
    ],
  },
];

/** 태어난 해로 그 사람이 20~30대였던 시대를 고른다 */
export function memoryEraFor(birthYear?: number): MemoryEra {
  const year = Number(birthYear) || 1955;
  const found = MEMORY_ERAS.find((e) => year >= e.from && year <= e.to);
  return found || MEMORY_ERAS[1];
}

/** 시대 이름 + '20~30대 시절의 추억' */
export function memoryEraTitle(era: MemoryEra): string {
  return `${era.label} · 20~30대 시절의 추억`;
}

/** 같은 시대 안에서도 날마다 다른 사진이 뜨게 날짜로 고른다 */
export function memoryPhotoFor(era: MemoryEra, dateKey: string): MemoryPhoto {
  const seed = [...`${era.key}|${dateKey}`].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return era.photos[seed % era.photos.length];
}

/** 오늘 이미 상자를 열었는지 — 저장소를 못 쓰는 브라우저는 '아직 안 열었다'로 본다 */
export function memoryBoxSeenToday(dateKey: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MEMORY_BOX_SEEN_KEY) === dateKey;
  } catch {
    return false;
  }
}

/** 오늘 상자를 열었다고 적어 둔다 — 같은 날 새로고침해도 다시 뜨지 않는다 */
export function markMemoryBoxSeen(dateKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MEMORY_BOX_SEEN_KEY, dateKey);
  } catch {
    /* 저장 공간이 없으면 화면은 그대로 동작 */
  }
}

/* ---------------------------------------------------------------- */
/* 상자를 누를 때 나는 소리 — 맑은 오르골 화음                          */
/* ---------------------------------------------------------------- */

let chimeCtx: AudioContext | null = null;

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

/**
 * 상자를 누르는 그 순간 불러야 소리가 난다.
 * (iOS 사파리·안드로이드 크롬 모두 '사용자가 누른 손짓 안'에서만 소리를 허락한다)
 * 소리를 낼 수 없는 기기에서는 조용히 false 를 돌려주고 화면은 그대로 동작한다.
 */
export function playMemoryChime(): boolean {
  if (typeof window === "undefined") return false;
  const Ctor = window.AudioContext || (window as AudioWindow).webkitAudioContext;
  if (!Ctor) return false;
  try {
    if (!chimeCtx || chimeCtx.state === "closed") chimeCtx = new Ctor();
    const ctx = chimeCtx;
    if (ctx.state === "suspended") void ctx.resume();

    const now = ctx.currentTime + 0.02;

    // 전체 볼륨 — 크지 않게, 끝으로 갈수록 잦아들게
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.9, now + 0.06);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 3.6);
    master.connect(ctx.destination);

    // 뚜껑이 열리는 듯한 낮고 따뜻한 소리
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(220, now);
    thump.frequency.exponentialRampToValueAtTime(96, now + 0.22);
    thumpGain.gain.setValueAtTime(0.0001, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.35, now + 0.02);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    thump.connect(thumpGain).connect(master);
    thump.start(now);
    thump.stop(now + 0.5);

    // 도·미·솔·도·미 — 맑은 오르골 화음이 차례로 울린다
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    notes.forEach((freq, i) => {
      const t = now + 0.06 + i * 0.115;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.5 - i * 0.05, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.1);
      gain.connect(master);

      const bell = ctx.createOscillator();
      bell.type = "sine";
      bell.frequency.setValueAtTime(freq, t);

      // 두 배 높은 배음을 살짝 얹어 쇠종처럼 맑게
      const shine = ctx.createOscillator();
      const shineGain = ctx.createGain();
      shine.type = "triangle";
      shine.frequency.setValueAtTime(freq * 2.002, t);
      shineGain.gain.setValueAtTime(0.0001, t);
      shineGain.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
      shineGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);

      bell.connect(gain);
      shine.connect(shineGain).connect(gain);
      bell.start(t);
      shine.start(t);
      bell.stop(t + 2.2);
      shine.stop(t + 1.0);
    });

    return true;
  } catch {
    return false;
  }
}
