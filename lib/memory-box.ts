"use client";

/**
 * 오늘의 추억상자 — 오늘 처음 접속하면 화면 가운데에 한 번 떠오르는 선물 상자.
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
 * 사진은 시대마다 열다섯 장씩 두고, 날짜로 골라 같은 시대라도 날마다 다른 사진이 뜬다.
 * 열다섯 장이라 보름을 돌면 처음 사진으로 돌아오고, 그 전에는 같은 사진이 겹치지 않는다.
 *
 * 늘봄은 50대 이상 시니어를 위한 서비스라, 구간은 1960~1990년대 네 개만 둔다.
 * (1960년대생도 20~30대는 1990~2000년대 초반이라 마지막 구간이 1970년생 이후를 모두 받는다)
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
      photo(
        "era1-c",
        "1960년대 마을 공동 우물과 나무 두레박, 옆에 놓인 놋대야와 빨래판",
        "우물가에 모여 물 길어 오던 아침, 동네 소식도 함께 건네졌지요"
      ),
      photo(
        "era1-d",
        "한옥 마루 끝에 가지런히 놓인 흰 고무신과 돗자리, 바구니",
        "마루 끝에 고무신 벗어 두고 뛰어놀던 여름날"
      ),
      photo(
        "era1-e",
        "1960년대 부엌의 연탄 화덕과 김이 오르는 주전자, 무쇠 솥",
        "연탄불에 주전자 보글보글, 부엌 가득 퍼지던 밥 짓는 냄새"
      ),
      photo(
        "era1-f",
        "1960년대 겨울밤, 이불을 둘러쓴 가족이 라디오 앞에 둘러앉은 뒷모습",
        "라디오에서 노래가 나오면 온 식구가 한자리에 모였지요"
      ),
      photo(
        "era1-g",
        "가을 논에 볏단을 묶어 세워 둔 모습과 감나무, 먼 산",
        "볏단 세워 놓은 가을 논길에서 허리 펴고 보던 하늘"
      ),
      photo(
        "era1-h",
        "1960년대 시골 정미소 앞, 곡식 가마니를 쌓아 둔 흙 마당과 손수레",
        "정미소 앞 가마니 사이로 쌀가루 냄새가 훅 끼치던 오후"
      ),
      photo(
        "era1-i",
        "1960년대 냇가 징검다리를 신발 들고 건너는 아이들 뒷모습",
        "신발 들고 징검다리 건너던 여름날, 발끝이 시원해서 좋았지요"
      ),
      photo(
        "era1-j",
        "1960년대 동네 이발소 안, 낡은 이발 의자와 선풍기, 세면대와 거울",
        "이발소 문을 열면 비누와 면도칼 냄새가 먼저 반겼지요"
      ),
      photo(
        "era1-k",
        "1960년대 교실 난로 위에 가지런히 올려 둔 양은 도시락들",
        "난로 위 도시락이 데워지길 기다리던 겨울 아침"
      ),
      photo(
        "era1-l",
        "1960년대 초가집 처마 밑, 메주와 시래기 말리는 풍경과 장독",
        "처마 밑 메주 익어 가는 냄새가 마을에 가득하던 가을"
      ),
      photo(
        "era1-m",
        "1960년대 오일장 장터, 멸치와 옹기, 채소를 펼쳐 놓은 노점",
        "장날 아침, 엄마 손 꼭 잡고 따라가던 오일장"
      ),
      photo(
        "era1-n",
        "1960년대 여름밤 마당 멍석 위, 부채와 수박, 별이 총총한 하늘",
        "멍석 깔고 누우면 하늘이 온통 별이었지요"
      ),
      photo(
        "era1-o",
        "1960년대 저녁 들길, 볏단 싣고 가는 소달구지와 농부 뒷모습",
        "볏단 싣고 느릿느릿 돌아오던 저녁 들길"
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
      photo(
        "era2-c",
        "1970년대 음악다방, 나무 칸막이 자리와 카운터의 턴테이블",
        "음악다방 칸에 앉아 LP 한 장을 처음부터 끝까지"
      ),
      photo(
        "era2-d",
        "1970년대 간이역 승강장, 증기기관차 불빛과 저녁놀",
        "증기기관차 기적 소리에 저녁놀이 번지던 플랫폼"
      ),
      photo(
        "era2-e",
        "1970년대 학교 운동장에 세워 둔 수학여행 버스와 보자기 가방",
        "은행잎 떨어지는 운동장에 가방부터 내려 놓고 기다리던 아침"
      ),
      photo(
        "era2-f",
        "1970년대 골목 분식집 창가, 김이 오르는 떡볶이 가마솥과 어묵 꼬치",
        "창문 너머 떡볶이 김이 오르면 지갑을 한 번 더 열게 되던"
      ),
      photo(
        "era2-g",
        "1970년대 여름밤 바닷가, 모닥불 앞에 뒷모습으로 앉은 친구들",
        "모닥불 타는 소리만 들리던 여름밤 바닷가"
      ),
      photo(
        "era2-h",
        "1970년대 꽃밭에 돗자리 펴고 앉은 가족 뒷모습과 고궁 담장",
        "꽃 핀 담장 아래 돗자리 펴고 김밥 나누던 봄날"
      ),
      photo(
        "era2-i",
        "1970년대 동네 문방구 앞, 사탕 진열장과 달고나 만드는 솥",
        "문방구 유리창에 코 대고 사탕을 골라 보던 오후"
      ),
      photo(
        "era2-j",
        "1970년대 시내버스 안, 가죽 손잡이와 좌석, 창으로 드는 햇빛",
        "손잡이 붙잡고 덜컹덜컹, 창밖으로 동네가 흘러가던"
      ),
      photo(
        "era2-k",
        "1970년대 목욕탕 입구, 바나나우유와 사이다 병을 담은 나무 상자",
        "목욕탕 앞에서 하나씩 사 들고 마시던 바나나우유"
      ),
      photo(
        "era2-l",
        "1970년대 만화방, 나무 책장에 꽂힌 만화책과 앉아 읽는 아이",
        "만화방 구석에 앉아 한 권 다 읽을 때까지 시간 가는 줄 몰랐지요"
      ),
      photo(
        "era2-m",
        "1970년대 비 오는 골목, 검정 우산과 비닐우산 쓴 사람들 뒷모습",
        "비 오는 날이면 검정우산 아래 어깨를 붙이고 걸었지요"
      ),
      photo(
        "era2-n",
        "1970년대 들판에 세운 천막 텐트와 돗자리, 자전거와 보자기",
        "들판에 텐트 치고 하루 종일 바람에 누워 있던 날"
      ),
      photo(
        "era2-o",
        "1970년대 밤 기차역 매점, 김이 오르는 어묵 꼬치와 주전자",
        "밤 기차 기다리며 어묵 국물 한 모금에 손을 녹이던"
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
      photo(
        "era3-c",
        "1980년대 LP 레코드 가게, 판이 꽂힌 나무 진열장과 턴테이블",
        "레코드 가게에서 한 장 골라 들고 나오던 설렘"
      ),
      photo(
        "era3-d",
        "1980년대 창가 책상 위 종이학과 봉투, 만년필과 화분",
        "종이학 접어 넣은 편지 한 장이 하루를 다 바꾸던"
      ),
      photo(
        "era3-e",
        "1980년대 밤 포장마차, 김이 오르는 우동 솥과 빨간 의자",
        "칼바람 부는 밤, 포장마차 우동 한 그릇이면 충분했지요"
      ),
      photo(
        "era3-f",
        "1980년대 나무 탁자 위 필름 카메라와 흰 테두리 인화 사진, 사진첩",
        "필름 한 통 다 쓰면 일주일을 기다려 찾아온 사진"
      ),
      photo(
        "era3-g",
        "1980년대 말 강변도로에서 본 노을과 강 건너 도시 불빛",
        "창문 열고 달리던 강변도로, 노을이 차 안까지 들어오던"
      ),
      photo(
        "era3-h",
        "1980년대 동네 공터에서 야구하는 아이들, 철망 백스톱과 빨랫줄",
        "공 하나로 동네 공터가 온 세상이 되던 방과 후"
      ),
      photo(
        "era3-i",
        "1980년대 동네 오락실, 게임기 앞에서 조이스틱 잡은 아이 뒷모습",
        "동전 하나 넣고 끝까지 살아남으려던 그 손맛"
      ),
      photo(
        "era3-j",
        "1990년대 초 비디오 가게, 빽빽한 테이프 진열대와 TV·비디오",
        "주말 저녁에 한 편 골라 들고 오던 비디오 가게"
      ),
      photo(
        "era3-k",
        "1980년대 말 롤러장, 나무 바닥에 비친 조명과 스케이트 타는 사람들",
        "손잡이 놓고 한 바퀴 돌면 세상이 다 내 것 같던 롤러장"
      ),
      photo(
        "era3-l",
        "1980년대 겨울 휴게소 매점, 호두과자 굽는 철판과 우동 솥",
        "휴게소에 들르면 꼭 사 와야 했던 호두과자 한 봉지"
      ),
      photo(
        "era3-m",
        "1980년대 말 야자 끝난 밤, 학교 앞 골목을 걷는 교복 입은 학생들",
        "야자 끝나고 걸어 나오던 골목, 가로등 불빛이 따뜻했지요"
      ),
      photo(
        "era3-n",
        "1980년대 신문 가판대, 신문 더미와 잡지 진열대, 라디오",
        "아침마다 신문 한 장 사 들고 가던 골목 입구"
      ),
      photo(
        "era3-o",
        "1980년대 마당 결혼식 피로연, 긴 상과 종이 꽃 장식, 하객들",
        "마당에 상 모아 앉아 국수 한 그릇 나눠 먹던 결혼식"
      ),
    ],
  },
  {
    key: "1990s",
    label: "1990~2000년대 초반",
    from: 1970,
    // 1970년생 이후는 모두 여기 — 1977년 이후 출생자·출생연도 미입력자도 시니어 시대로 모인다
    to: 9999,
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
      photo(
        "era4-c",
        "1990년대 시외버스 터미널, 어두워진 승강장에 선 버스들과 바닥의 가방",
        "비 젖은 터미널에서 버스 시간표만 몇 번이고 들여다보던"
      ),
      photo(
        "era4-d",
        "1990년대 침대 위 CD 플레이어와 헤드폰, 겹쳐 놓은 CD 케이스",
        "이어폰 한쪽 나눠 끼고 함께 듣던 그 노래"
      ),
      photo(
        "era4-e",
        "1990년대 눈 내리는 밤, 김이 오르는 붕어빵 수레와 빨간 대야",
        "눈 내리는 골목, 붕어빵 세 개면 손이 따뜻해졌지요"
      ),
      photo(
        "era4-f",
        "1990년대 단골 식당의 나무 탁자에 놓인 소주병과 잔, 김이 오르는 냄비",
        "하루 일 끝나고 단골집에서 나누던 소주 한 잔"
      ),
      photo(
        "era4-g",
        "1990년대 밤 놀이공원, 불꽃놀이가 터지는 하늘 아래 관람차와 사람들",
        "불꽃 터지는 밤, 고개 들어 하늘만 보던 우리"
      ),
      photo(
        "era4-h",
        "1990년대 말 대학 동아리방, CRT 모니터와 책상, 기타와 소파",
        "새벽까지 켜 두던 모니터 불빛, 그 옆에서 나눈 이야기"
      ),
      photo(
        "era4-i",
        "1990년대 노래방 방 안, 마이크와 탬버린, 붉은 소파",
        "한 곡 끝나면 탬버린 들고 다 같이 소리치던"
      ),
      photo(
        "era4-j",
        "1990년대 서울 지하철 승강장, 타일 기둥과 들어오는 전동차",
        "저녁 지하철, 창에 비친 내 얼굴을 한참 보던"
      ),
      photo(
        "era4-k",
        "1990년대 상가 스티커사진 부스와 인형뽑기 기계, 분홍 조명",
        "커튼 치고 네 컷 찍어 서로 한 장씩 나눠 가진"
      ),
      photo(
        "era4-l",
        "1990년대 저녁 낚시터, 받침대에 걸린 낚싯대와 접이 의자, 물안개",
        "입질을 기다리며 아무 말 없이 앉아 있던 저녁"
      ),
      photo(
        "era4-m",
        "1990년대 야구장 관중석, 노을 진 하늘 아래 경기장과 관중",
        "노을 지는 관중석에서 다 같이 일어나 소리치던"
      ),
      photo(
        "era4-n",
        "1990년대 밤 포장마차, 떡볶이 가마솥과 순대, 빨간 의자",
        "김 나는 떡볶이 한 접시에 하루 피로가 풀리던"
      ),
      photo(
        "era4-o",
        "1990년대 경양식집, 빨간 소파 자리와 돈가스 한 접시",
        "생일날이면 가족끼리 앉았던 경양식집 돈가스"
      ),
    ],
  },
];

/** 태어난 해로 그 사람이 20~30대였던 시대를 고른다 */
export function memoryEraFor(birthYear?: number): MemoryEra {
  // 출생연도를 모르면 1950년대생(1970~1980년대)으로 — 늘봄의 기본 시니어 나이대
  const year = Number(birthYear) || 1955;
  const found = MEMORY_ERAS.find((e) => year >= e.from && year <= e.to);
  // 어느 구간에도 안 걸리는 값이 오더라도 2000년대 이후가 아니라 가장 가까운 시니어 시대로
  return found || MEMORY_ERAS[MEMORY_ERAS.length - 1];
}

/** 시대 이름 + '20~30대 시절의 추억' */
export function memoryEraTitle(era: MemoryEra): string {
  return `${era.label} · 20~30대 시절의 추억`;
}

/**
 * 날짜를 하루 단위 정수(KST 기준 epoch day)로 — 달이 바뀌어도 값이 이어져 사진이 겹치지 않는다.
 * 'YYYY-MM-DD' 는 이미 KST 날짜라, 그 날짜의 UTC 자정을 일수로 세면 그대로 KST 하루가 된다.
 */
export function memoryPhotoDay(dateKey: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey || "");
  if (!m) return Math.floor(Date.now() / 86400000);
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Math.floor(ms / 86400000);
}

/**
 * 같은 시대 안에서도 날마다 다른 사진이 뜨게 날짜로 고른다.
 * 사진이 열다섯 장이라 하루에 한 장씩, 15일 동안 같은 사진이 두 번 나오지 않고
 * 16일째에 첫 사진으로 돌아온다(월말→월초로 넘어가도 끊기지 않는다).
 */
export function memoryPhotoFor(era: MemoryEra, dateKey: string): MemoryPhoto {
  const list = era.photos.length ? era.photos : MEMORY_ERAS[0].photos;
  const day = memoryPhotoDay(dateKey);
  // 시대마다 시작 사진을 달리해, 같은 날이라도 시대가 다르면 다른 사진이 뜨게
  const offset = [...era.key].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const idx = ((day + offset) % list.length + list.length) % list.length;
  return list[idx] || list[0];
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
