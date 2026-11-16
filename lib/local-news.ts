/**
 * 우리동네 소식 — 지역별 행사 · 축제 · 무료 강좌 · 복지 소식.
 *
 * 사용자의 설정 지역(시·도 / 시·군·구)에 맞춰 4가지 갈래의 소식을 만들어 준다.
 * · 해마다 같은 때 열리는 지역 축제/행사는 이름과 장소를 그대로 쓰고, 날짜는 "○월 중"처럼 기간으로 보여 준다.
 * · 복지·강좌는 전국 어느 시·군·구에서나 운영하는 사업을 지역 이름에 맞춰 안내한다.
 * · 날짜는 해마다 조금씩 달라질 수 있어 화면에서 "확인" 안내를 함께 보여 준다.
 */

import { shortSido } from "./regions";
import { addDays } from "./week";
import { dateKey, monthOf } from "./calendar";

export type NewsCategory = "event" | "festival" | "class" | "welfare";

export type LocalNews = {
  id: string;
  category: NewsCategory;
  title: string;
  sido: string;
  sigungu: string;
  place: string;
  /** YYYY-MM-DD */
  startDate: string;
  endDate?: string;
  summary: string;
  /** 신청·문의 방법 */
  how: string;
  contact?: string;
  free: boolean;
};

export const NEWS_CATEGORIES: {
  key: NewsCategory;
  label: string;
  emoji: string;
  dot: string;
  chip: string;
}[] = [
  { key: "event", label: "지역 행사", emoji: "🎪", dot: "bg-sun", chip: "bg-sun-light text-[#9A6A05]" },
  { key: "festival", label: "축제", emoji: "🏮", dot: "bg-coral", chip: "bg-coral-light text-coral-dark" },
  { key: "class", label: "무료 강좌", emoji: "🎓", dot: "bg-plum", chip: "bg-plum-light text-plum-dark" },
  { key: "welfare", label: "복지 소식", emoji: "🎁", dot: "bg-brand", chip: "bg-brand-light text-brand-dark" },
];

export function newsCategoryInfo(cat: NewsCategory) {
  return NEWS_CATEGORIES.find((c) => c.key === cat) ?? NEWS_CATEGORIES[0];
}

type Ctx = {
  sido: string;
  sidoShort: string;
  sigungu: string;
  /** 지역 이름 (시·군·구가 없으면 시·도 약칭) */
  area: string;
};

/* ------------------------------------------------------------------ */
/* 지역 축제 (이름·장소는 해마다 같은 때 열리는 실제 축제)              */
/* ------------------------------------------------------------------ */

type Festival = {
  name: string;
  /** 열리는 달 (연속된 달이면 두 개) */
  months: number[];
  /** 장소 (지역 이름은 {area} 로) */
  place: string;
  summary: string;
  how: string;
};

const SIGUNGU_FESTIVALS: Record<string, Festival[]> = {
  "충청북도/옥천군": [
    {
      name: "옥천묘목축제",
      months: [3],
      place: "옥천읍 일원 · 묘목 유통단지",
      summary: "전국 묘목의 고장 옥천에서 봄을 여는 축제예요. 묘목 나눔과 체험 부스가 열려요.",
      how: "옥천군청 문화관광과에 문의하거나 군 홈페이지 축제 안내를 확인하세요.",
    },
    {
      name: "향수옥천 포도·복숭아 축제",
      months: [8],
      place: "옥천읍 일원",
      summary: "옥천 포도와 복숭아를 맛보고 사는 여름 축제예요. 가족 체험 프로그램도 함께 열려요.",
      how: "옥천군청 문화관광과 · 옥천군농협에 문의하세요.",
    },
    {
      name: "옥천군민의 날 기념행사",
      months: [9],
      place: "옥천읍 종합운동장 일원",
      summary: "군민의 날을 맞아 기념식과 어르신 장기자랑, 노래자랑이 열려요.",
      how: "읍·면 행정복지센터에 참가·관람 문의를 하세요.",
    },
  ],
  "충청북도/청주시": [
    { name: "청주공예비엔날레", months: [9, 10], place: "청주시 문화제조창 일원", summary: "공예 작품 전시와 체험 프로그램이 열리는 국제 행사예요.", how: "청주시 문화관광 홈페이지에서 일정을 확인하세요." },
  ],
  "충청북도/충주시": [
    { name: "충주세계무술축제", months: [9], place: "충주시 탄금대 일원", summary: "세계 여러 나라 무술을 한자리에서 보는 축제예요. 무료 공연도 많아요.", how: "충주시 문화관광 홈페이지를 확인하세요." },
  ],
  "충청북도/제천시": [
    { name: "제천국제음악영화제", months: [8], place: "제천시 문화예술회관 일원", summary: "음악 영화를 무료로 볼 수 있는 상영관이 열려요.", how: "제천시 홈페이지 · 영화제 사무국에 문의하세요." },
  ],
  "충청북도/영동군": [
    { name: "영동포도축제", months: [8], place: "영동군 일원", summary: "포도 따기 체험과 포도 시식이 열리는 여름 축제예요.", how: "영동군청 문화관광과에 문의하세요." },
    { name: "영동난계국악축제", months: [9, 10], place: "영동군 난계국악당 일원", summary: "국악 공연과 악기 체험을 무료로 즐길 수 있어요.", how: "영동군청 문화관광과에 문의하세요." },
  ],
  "충청북도/보은군": [
    { name: "보은대추축제", months: [10], place: "보은군 일원", summary: "보은 대추를 맛보고 사는 가을 축제예요.", how: "보은군청 문화관광과에 문의하세요." },
  ],
  "충청북도/괴산군": [
    { name: "괴산고추축제", months: [9], place: "괴산군 일원", summary: "고추 수확철에 맞춰 열리는 지역 축제예요. 먹거리 장터가 유명해요.", how: "괴산군청 문화관광과에 문의하세요." },
  ],
  "충청북도/음성군": [
    { name: "음성품바축제", months: [5], place: "음성군 설성공원 일원", summary: "품바 공연과 함께 봄 나들이를 즐기는 무료 축제예요.", how: "음성군청 문화관광과에 문의하세요." },
  ],
  "충청북도/증평군": [
    { name: "증평인삼골축제", months: [10], place: "증평군 일원", summary: "인삼과 홍삼 제품을 만나 보는 가을 축제예요.", how: "증평군청 문화관광과에 문의하세요." },
  ],
  "충청북도/진천군": [
    { name: "생거진천문화축제", months: [10], place: "진천군 일원", summary: "지역 문화와 먹거리를 함께 즐기는 가을 축제예요.", how: "진천군청 문화관광과에 문의하세요." },
  ],
  "충청북도/단양군": [
    { name: "단양온달문화축제", months: [10], place: "단양군 영춘면 온달관광지", summary: "온달 장군 이야기를 담은 역사 문화 축제예요.", how: "단양군청 문화관광과에 문의하세요." },
  ],
};

const SIDO_FESTIVALS: Record<string, Festival[]> = {
  서울특별시: [
    { name: "서울빛초롱축제", months: [11, 12], place: "광화문광장 · 청계천 일원", summary: "도심이 등불로 물드는 겨울 축제예요. 무료로 걸으며 볼 수 있어요.", how: "서울시 축제 홈페이지에서 기간을 확인하세요." },
    { name: "서울재즈페스티벌", months: [5], place: "올림픽공원 일원", summary: "봄에 열리는 재즈 음악 축제예요.", how: "축제 홈페이지에서 일정과 입장 안내를 확인하세요." },
  ],
  부산광역시: [
    { name: "부산불꽃축제", months: [11], place: "광안리해수욕장 일원", summary: "바다 위 불꽃을 무료로 볼 수 있는 대표 축제예요.", how: "부산시 축제 홈페이지에서 관람 위치와 시간을 확인하세요." },
    { name: "부산국제영화제", months: [10], place: "해운대 일원", summary: "영화 상영과 야외 무대 행사가 함께 열려요.", how: "영화제 홈페이지에서 상영 일정을 확인하세요." },
  ],
  대구광역시: [
    { name: "대구치맥페스티벌", months: [7], place: "두류공원 일원", summary: "여름에 열리는 대표 먹거리 축제예요.", how: "축제 홈페이지에서 일정을 확인하세요." },
  ],
  인천광역시: [
    { name: "인천펜타포트음악축제", months: [8], place: "송도 일원", summary: "여름밤 음악 공연을 즐기는 축제예요.", how: "축제 홈페이지에서 일정을 확인하세요." },
  ],
  광주광역시: [
    { name: "광주비엔날레", months: [9, 10, 11], place: "광주비엔날레전시관 일원", summary: "미술 전시를 무료로 볼 수 있는 날이 있어요.", how: "비엔날레 홈페이지에서 무료 관람일을 확인하세요." },
    { name: "광주프린지페스티벌", months: [5], place: "충장로 일원", summary: "거리에서 펼쳐지는 공연 축제예요. 무료 공연이 많아요.", how: "광주시 문화관광 홈페이지를 확인하세요." },
  ],
  대전광역시: [
    { name: "대전사이언스페스티벌", months: [10], place: "대전시 일원", summary: "과학 체험 부스와 공연이 함께 열리는 가족 축제예요.", how: "대전시 홈페이지에서 일정을 확인하세요." },
    { name: "대전국화축제", months: [10, 11], place: "한밭수목원 일원", summary: "가을 국화꽃 단지를 무료로 둘러볼 수 있어요.", how: "한밭수목원 홈페이지를 확인하세요." },
  ],
  울산광역시: [
    { name: "울산고래축제", months: [5], place: "장생포 일원", summary: "고래 이야기와 체험 프로그램이 있는 봄 축제예요.", how: "울산시 축제 홈페이지를 확인하세요." },
    { name: "태화강 봄꽃축제", months: [4], place: "태화강 국가정원 일원", summary: "봄꽃 단지와 산책로를 무료로 즐길 수 있어요.", how: "울산시 홈페이지를 확인하세요." },
  ],
  세종특별자치시: [
    { name: "세종축제", months: [10], place: "세종호수공원 일원", summary: "공연과 체험 부스가 함께 열리는 가을 축제예요.", how: "세종시 홈페이지에서 일정을 확인하세요." },
  ],
  경기도: [
    { name: "수원화성문화제", months: [10], place: "수원화성 일원", summary: "성곽 길을 걸으며 공연과 행사를 즐기는 축제예요.", how: "수원시 축제 홈페이지를 확인하세요." },
    { name: "이천쌀문화축제", months: [10], place: "이천시 일원", summary: "쌀과 농산물을 주제로 한 가을 축제예요.", how: "이천시 홈페이지를 확인하세요." },
  ],
  강원특별자치도: [
    { name: "강릉단오제", months: [6], place: "강릉시 남대천 일원", summary: "전통 민속 행사와 공연이 이어지는 축제예요.", how: "강릉단오제 홈페이지에서 일정을 확인하세요." },
    { name: "춘천마임축제", months: [5], place: "춘천시 일원", summary: "거리 공연을 무료로 볼 수 있는 축제예요.", how: "축제 홈페이지를 확인하세요." },
  ],
  충청남도: [
    { name: "보령머드축제", months: [7], place: "보령시 대천해수욕장 일원", summary: "여름 바다에서 즐기는 체험 축제예요.", how: "축제 홈페이지에서 일정을 확인하세요." },
    { name: "금산인삼축제", months: [9, 10], place: "금산군 일원", summary: "인삼 체험과 먹거리 장터가 열리는 가을 축제예요.", how: "금산군청 홈페이지를 확인하세요." },
    { name: "공주백제문화제", months: [9, 10], place: "공주시 일원", summary: "백제 역사를 주제로 한 공연과 퍼레이드가 열려요.", how: "공주시·축제 홈페이지를 확인하세요." },
  ],
  전북특별자치도: [
    { name: "전주국제영화제", months: [5], place: "전주시 일원", summary: "영화 상영과 야외 행사가 함께 열려요.", how: "영화제 홈페이지에서 일정을 확인하세요." },
    { name: "전주비빔밥축제", months: [10], place: "전주시 일원", summary: "비빔밥을 함께 비벼 먹는 체험 행사가 열려요.", how: "전주시 홈페이지를 확인하세요." },
    { name: "무주반딧불축제", months: [9], place: "무주군 일원", summary: "반딧불이와 자연을 주제로 한 생태 축제예요.", how: "무주군청 홈페이지를 확인하세요." },
  ],
  전라남도: [
    { name: "순천만갈대축제", months: [11], place: "순천만습지 일원", summary: "가을 갈대밭을 걸으며 즐기는 축제예요.", how: "순천시 홈페이지에서 일정을 확인하세요." },
    { name: "담양대나무축제", months: [5], place: "담양군 죽녹원 일원", summary: "대나무 숲에서 열리는 봄 축제예요.", how: "담양군청 홈페이지를 확인하세요." },
    { name: "진도영등축제", months: [2, 3], place: "진도군 일원", summary: "전통 민속을 담은 봄 축제예요.", how: "진도군청 홈페이지를 확인하세요." },
  ],
  경상북도: [
    { name: "안동국제탈춤페스티벌", months: [9, 10], place: "안동시 탈춤공원 일원", summary: "탈춤 공연과 체험을 즐기는 축제예요.", how: "안동시 축제 홈페이지를 확인하세요." },
    { name: "경주벚꽃축제", months: [4], place: "경주시 보문관광단지 일원", summary: "봄 벚꽃길을 걸으며 즐기는 축제예요.", how: "경주시 홈페이지를 확인하세요." },
  ],
  경상남도: [
    { name: "진주남강유등축제", months: [10], place: "진주성 · 남강 일원", summary: "남강에 등불을 띄우는 가을 축제예요.", how: "진주시 축제 홈페이지를 확인하세요." },
    { name: "진해군항제", months: [3, 4], place: "창원시 진해구 일원", summary: "벚꽃과 군악 행사가 함께 열리는 봄 축제예요.", how: "창원시 홈페이지를 확인하세요." },
  ],
  제주특별자치도: [
    { name: "제주유채꽃축제", months: [1, 2], place: "제주시 일원", summary: "겨울에서 봄으로 넘어가는 유채꽃 축제예요.", how: "제주관광공사 홈페이지를 확인하세요." },
    { name: "탐라문화제", months: [10], place: "제주시 일원", summary: "제주 전통 문화를 보고 즐기는 축제예요.", how: "제주시 홈페이지를 확인하세요." },
    { name: "제주감귤박람회", months: [11, 12], place: "서귀포시 일원", summary: "감귤 수확철에 맞춰 열리는 겨울 행사예요.", how: "제주특별자치도 홈페이지를 확인하세요." },
  ],
};

/* ------------------------------------------------------------------ */
/* 어느 지역에서나 열리는 행사 · 무료 강좌 · 복지 소식                  */
/* ------------------------------------------------------------------ */

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

type Template = {
  key: string;
  category: NewsCategory;
  title: string | ((c: Ctx) => string);
  months: number[];
  day: number;
  /** 기간 (일). 없으면 하루 */
  days?: number;
  place: string | ((c: Ctx) => string);
  summary: string | ((c: Ctx) => string);
  how: string;
  contact?: string;
  free?: boolean;
};

const TEMPLATES: Template[] = [
  /* ---------------- 지역 행사 ---------------- */
  {
    key: "haemaji",
    category: "event",
    title: "새해 해맞이 행사",
    months: [1],
    day: 1,
    place: (c) => `${c.area} 해맞이 명소`,
    summary: "새해 첫날 이웃과 함께 해를 맞이하는 행사예요. 따뜻한 차와 떡국도 나눠요.",
    how: "읍·면 행정복지센터에 문의하시면 장소와 시간을 알려 드려요.",
    free: true,
  },
  {
    key: "daeboreum",
    category: "event",
    title: "정월대보름 민속행사",
    months: [2],
    day: 12,
    place: (c) => `${c.area} 전통시장 · 체육공원`,
    summary: "음력 정월대보름 무렵 쥐불놀이·부럼 깨기 같은 민속 행사가 열려요. 날짜는 해마다 달라요.",
    how: "문화원이나 읍·면 행정복지센터에 문의하세요.",
    free: true,
  },
  {
    key: "bomkkot",
    category: "event",
    title: "봄꽃 걷기 행사",
    months: [4],
    day: 12,
    place: (c) => `${c.area} 산책로 · 공원`,
    summary: "가벼운 마음으로 봄꽃길을 함께 걷는 행사예요. 어르신 구간이 따로 있어요.",
    how: "읍·면 행정복지센터나 노인복지관에 참가 신청하세요.",
    free: true,
  },
  {
    key: "gyeongno",
    category: "event",
    title: "어르신 경로잔치",
    months: [5],
    day: 8,
    place: (c) => `${c.area} 마을회관 · 체육공원`,
    summary: "어버이날을 앞두고 지역 어르신을 모시고 점심과 공연을 준비해요.",
    how: "마을 이장님께 알리거나 읍·면 행정복지센터에 문의하세요.",
    free: true,
  },
  {
    key: "hanmaeum",
    category: "event",
    title: "군민·시민 한마음 체육대회",
    months: [9],
    day: 20,
    place: (c) => `${c.area} 종합운동장`,
    summary: "읍·면 대항 체육대회와 어르신 장기자랑이 함께 열려요. 참가는 마을 단위로 받아요.",
    how: "마을 이장님·부녀회에 참가 의사를 알려 주세요.",
    free: true,
  },
  {
    key: "eoreusin-munhwa",
    category: "event",
    title: "어르신 문화예술제",
    months: [10],
    day: 24,
    place: (c) => `${c.area} 문화예술회관`,
    summary: "노래·춤·서예 등 어르신 동아리 발표회예요. 관람은 무료예요.",
    how: "노인복지관·주민자치센터에서 관람 신청을 받아요.",
    free: true,
  },
  {
    key: "gimjang",
    category: "event",
    title: "김장 나눔 한마당",
    months: [11],
    day: 20,
    place: (c) => `${c.area} 행정복지센터 · 복지관`,
    summary: "겨울 김장을 함께 담그고 어려운 이웃에 나눠요. 참여 봉사자도 모집해요.",
    how: "읍·면 행정복지센터·자원봉사센터에 문의하세요.",
    free: true,
  },
  {
    key: "songnyeon",
    category: "event",
    title: "송년 음악회 · 연말 문화행사",
    months: [12],
    day: 15,
    place: (c) => `${c.area} 문화예술회관`,
    summary: "한 해를 마무리하는 무료 음악회예요. 초대권은 보통 일주일 전부터 나눠 줘요.",
    how: "문화예술회관에 전화하거나 홈페이지에서 초대권 배부 일정을 확인하세요.",
    free: true,
  },

  /* ---------------- 무료 강좌 ---------------- */
  {
    key: "hangeul",
    category: "class",
    title: "어르신 한글 교실 (문해교육)",
    months: [3, 9],
    day: 10,
    days: 100,
    place: (c) => `${c.area} 평생학습관 · 주민자치센터`,
    summary: "글을 처음 배우시는 어르신을 위한 무료 교실이에요. 읽기·쓰기를 천천히 알려 드려요.",
    how: "평생학습관·주민자치센터에 전화로 수강 신청하세요.",
    free: true,
  },
  {
    key: "silver-class",
    category: "class",
    title: "노인복지관 무료 강좌 (서예·노래·실버댄스)",
    months: [3, 9],
    day: 3,
    days: 90,
    place: (c) => `${c.area} 노인복지관`,
    summary: "서예·노래교실·실버댄스·요가 가운데 골라 들으실 수 있어요. 수강료는 무료예요.",
    how: "가까운 노인복지관에 방문하거나 전화로 접수하세요.",
    free: true,
  },
  {
    key: "smartphone",
    category: "class",
    title: "스마트폰·키오스크 무료 교실",
    months: ALL_MONTHS,
    day: 5,
    place: (c) => `${c.area} 노인복지관 · 주민자치센터`,
    summary: "사진 찍기, 카카오톡, 무인 주문기(키오스크) 쓰는 법을 한 사람씩 알려 드려요.",
    how: "노인복지관·주민자치센터에 전화해 다음 수업 날짜를 물어보세요.",
    contact: "디지털배움터 1800-0096",
    free: true,
  },
  {
    key: "health-ex",
    category: "class",
    title: "건강체조 · 실버요가 교실",
    months: [4, 6, 9, 11],
    day: 8,
    days: 30,
    place: (c) => `${c.area} 보건소 · 국민체육센터`,
    summary: "앉아서 하는 체조부터 가벼운 요가까지, 무리 없이 몸을 푸는 수업이에요.",
    how: "보건소 건강관리과에 전화해 인원과 시간을 확인하세요.",
    free: true,
  },
  {
    key: "lifelong-1",
    category: "class",
    title: "평생학습관 상반기 강좌 접수",
    months: [2],
    day: 17,
    days: 20,
    place: (c) => `${c.area} 평생학습관`,
    summary: "봄 학기 무료·저렴한 강좌를 한꺼번에 접수해요. 인기 강좌는 일찍 마감돼요.",
    how: "평생학습관 홈페이지나 전화로 접수하세요.",
    free: true,
  },
  {
    key: "lifelong-2",
    category: "class",
    title: "평생학습관 하반기 강좌 접수",
    months: [8],
    day: 18,
    days: 20,
    place: (c) => `${c.area} 평생학습관`,
    summary: "가을 학기 강좌 접수 기간이에요. 컴퓨터·요리·미술 강좌가 많아요.",
    how: "평생학습관 홈페이지나 전화로 접수하세요.",
    free: true,
  },

  /* ---------------- 복지 소식 ---------------- */
  {
    key: "job",
    category: "welfare",
    title: "노인일자리 참여자 모집",
    months: [1, 6],
    day: 12,
    days: 25,
    place: (c) => `${c.area} 시니어클럽 · 행정복지센터`,
    summary: "환경 정리, 급식 도우미 같은 일자리를 모집해요. 만 65세 이상이면 신청할 수 있어요.",
    how: "읍·면 행정복지센터나 시니어클럽에 신분증을 가지고 가서 신청하세요.",
    contact: "노인일자리 상담 1544-9004",
    free: true,
  },
  {
    key: "basic-pension",
    category: "welfare",
    title: "기초연금 신청 안내 (매월 25일 지급)",
    months: ALL_MONTHS,
    day: 25,
    place: (c) => `${c.area} 행정복지센터 · 국민연금공단`,
    summary: "만 65세 이상 어르신께 매월 25일 기초연금이 들어와요. 아직 안 받으시면 꼭 신청하세요.",
    how: "신분증을 가지고 가까운 행정복지센터나 국민연금공단을 찾으세요.",
    contact: "보건복지상담센터 129",
    free: true,
  },
  {
    key: "dementia",
    category: "welfare",
    title: "치매 조기검진 무료",
    months: [3, 6, 9, 12],
    day: 7,
    place: (c) => `${c.area} 치매안심센터 · 보건소`,
    summary: "기억력 검사를 무료로 받아 보세요. 검진 뒤 상담과 프로그램도 이어져요.",
    how: "가까운 치매안심센터·보건소에 전화로 예약하세요.",
    contact: "치매상담콜센터 1899-9988",
    free: true,
  },
  {
    key: "longterm",
    category: "welfare",
    title: "장기요양 인정 신청 안내",
    months: [1, 4, 7, 10],
    day: 22,
    place: (c) => `${c.area} 행정복지센터 · 국민건강보험공단`,
    summary: "거동이 불편해지셨다면 방문요양·주야간보호를 받을 수 있어요. 등급 신청은 무료예요.",
    how: "국민건강보험공단(1577-1000)이나 행정복지센터에 신청하세요.",
    contact: "국민건강보험공단 1577-1000",
    free: true,
  },
  {
    key: "emergency",
    category: "welfare",
    title: "응급안전안심서비스 신청 (혼자 사시는 어르신)",
    months: [2, 5, 8, 11],
    day: 18,
    place: (c) => `${c.area} 행정복지센터`,
    summary: "집에 응급호출기와 활동감지기를 무료로 설치해 드려요. 갑자기 쓰러지셔도 바로 도움을 청해요.",
    how: "읍·면 행정복지센터에 신청하세요.",
    contact: "보건복지상담센터 129",
    free: true,
  },
  {
    key: "heating",
    category: "welfare",
    title: "동절기 난방비 · 연탄 지원 신청",
    months: [11],
    day: 10,
    days: 40,
    place: (c) => `${c.area} 행정복지센터`,
    summary: "겨울철 난방비와 연탄을 지원해 드려요. 기초생활수급자·차상위 가구가 대상이에요.",
    how: "읍·면 행정복지센터에 문의하거나 129로 상담하세요.",
    contact: "보건복지상담센터 129",
    free: true,
  },
  {
    key: "flu",
    category: "welfare",
    title: "어르신 무료 독감 예방접종",
    months: [10],
    day: 15,
    days: 60,
    place: (c) => `${c.area} 보건소 · 위탁 병·의원`,
    summary: "만 65세 이상은 독감 예방접종을 무료로 맞으실 수 있어요.",
    how: "신분증만 가지고 가까운 보건소나 위탁 병·의원을 찾으세요.",
    contact: "보건소 · 질병관리청 1339",
    free: true,
  },
  {
    key: "medical",
    category: "welfare",
    title: "재난적 의료비 지원 신청",
    months: [3, 9],
    day: 14,
    days: 30,
    place: (c) => `${c.area} 행정복지센터 · 국민건강보험공단`,
    summary: "큰 병원비로 어려우실 때 의료비 일부를 지원받을 수 있어요.",
    how: "읍·면 행정복지센터나 국민건강보험공단(1577-1000)에 상담하세요.",
    contact: "국민건강보험공단 1577-1000",
    free: true,
  },
];

/* ------------------------------------------------------------------ */
/* 소식 만들기                                                         */
/* ------------------------------------------------------------------ */

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const pick = (v: string | ((c: Ctx) => string), c: Ctx) => (typeof v === "function" ? v(c) : v);

/**
 * 오늘부터 monthsAhead 개월 안에 열리는 우리 동네 소식.
 * 날짜가 지난 소식은 넣지 않는다.
 */
export function localNewsFor(sido: string, sigungu: string, today: string, monthsAhead = 3): LocalNews[] {
  const c: Ctx = {
    sido,
    sidoShort: shortSido(sido),
    sigungu,
    area: `${shortSido(sido)} ${sigungu}`.trim() || "우리 동네",
  };
  const horizon = addDays(today, Math.max(1, monthsAhead) * 31);
  const fromYm = monthOf(today);
  const toYm = monthOf(horizon);
  const months: { year: number; month: number }[] = [];
  for (let y = fromYm.year; y <= toYm.year; y++) {
    const startM = y === fromYm.year ? fromYm.month : 1;
    const endM = y === toYm.year ? toYm.month : 12;
    for (let m = startM; m <= endM; m++) months.push({ year: y, month: m });
  }

  const out: LocalNews[] = [];
  const push = (n: LocalNews) => {
    if ((n.endDate ?? n.startDate) < today) return; // 이미 끝난 소식
    if (n.startDate > horizon) return;
    out.push(n);
  };

  // 1) 지역 축제
  const regionFestivals = [
    ...(SIGUNGU_FESTIVALS[`${sido}/${sigungu}`] ?? []),
    ...(SIDO_FESTIVALS[sido] ?? []),
  ];
  for (const f of regionFestivals) {
    const first = Math.min(...f.months);
    const last = Math.max(...f.months);
    for (const { year, month } of months) {
      if (month < first || month > last) continue;
      const startDate = dateKey(year, first, 1);
      const endDate = dateKey(year, last, lastDayOfMonth(year, last));
      push({
        id: `festival-${f.name}-${year}`,
        category: "festival",
        title: f.name,
        sido,
        sigungu,
        place: f.place,
        startDate,
        endDate,
        summary: f.summary,
        how: f.how,
        free: true,
      });
      break; // 한 해에 한 번만
    }
  }

  // 2) 어느 지역에서나 열리는 행사 · 강좌 · 복지 소식
  for (const t of TEMPLATES) {
    for (const { year, month } of months) {
      if (!t.months.includes(month)) continue;
      const startDate = dateKey(year, month, t.day);
      const endDate = t.days ? addDays(startDate, t.days - 1) : undefined;
      push({
        id: `${t.key}-${startDate}`,
        category: t.category,
        title: pick(t.title, c),
        sido,
        sigungu,
        place: pick(t.place, c),
        startDate,
        endDate,
        summary: pick(t.summary, c),
        how: t.how,
        contact: t.contact,
        free: t.free ?? true,
      });
    }
  }

  const order: Record<NewsCategory, number> = { festival: 0, event: 1, class: 2, welfare: 3 };
  out.sort((a, b) =>
    a.startDate === b.startDate
      ? order[a.category] - order[b.category] || a.title.localeCompare(b.title)
      : a.startDate < b.startDate
        ? -1
        : 1
  );
  return out;
}

/** 그 날짜에 열리는(기간에 들어 있는) 소식 */
export function newsOnDate(news: LocalNews[], date: string): LocalNews[] {
  return news.filter((n) => n.startDate <= date && date <= (n.endDate ?? n.startDate));
}

/** 그 날 시작하는 소식 — 달력 점 표시용 */
export function newsStartingOn(news: LocalNews[], date: string): LocalNews[] {
  return news.filter((n) => n.startDate === date);
}

export function newsInMonth(news: LocalNews[], year: number, month: number): LocalNews[] {
  const first = dateKey(year, month, 1);
  const last = dateKey(year, month, lastDayOfMonth(year, month));
  return news.filter((n) => n.startDate <= last && (n.endDate ?? n.startDate) >= first);
}

const isFullMonth = (start: string, end?: string) =>
  Boolean(end) &&
  start.endsWith("-01") &&
  Number(end!.slice(8, 10)) === lastDayOfMonth(Number(end!.slice(0, 4)), Number(end!.slice(5, 7)));

/** "11월 중" · "9월 ~ 10월" · "11월 21일 (토)" · "11월 20일 ~ 12월 5일" */
export function newsPeriod(n: LocalNews): string {
  const end = n.endDate;
  if (!end || end === n.startDate) {
    const d = new Date(n.startDate + "T00:00:00Z");
    return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
  }
  const s = new Date(n.startDate + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  if (isFullMonth(n.startDate, end)) {
    const sm = s.getUTCMonth() + 1;
    const em = e.getUTCMonth() + 1;
    return sm === em ? `${sm}월 중` : `${sm}월 ~ ${em}월`;
  }
  if (s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear()) {
    return `${s.getUTCMonth() + 1}월 ${s.getUTCDate()}일 ~ ${e.getUTCDate()}일`;
  }
  return `${s.getUTCMonth() + 1}월 ${s.getUTCDate()}일 ~ ${e.getUTCMonth() + 1}월 ${e.getUTCDate()}일`;
}

/** 카톡으로 알릴 때 쓰는 한 줄 */
export function newsShareText(n: LocalNews): string {
  const where = `${shortSido(n.sido)} ${n.sigungu}`.trim();
  return `[늘봄 우리동네 소식] ${n.title}\n· 언제: ${newsPeriod(n)}\n· 어디: ${n.place}\n· ${n.summary}\n· 신청·문의: ${n.how}${n.contact ? ` (${n.contact})` : ""}`;
}
