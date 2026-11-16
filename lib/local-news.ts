/**
 * 우리동네 소식 — 지역별 행사 · 축제 · 무료 강좌 · 복지 소식.
 *
 * 사용자의 설정 지역(시·도 / 시·군·구)에 맞춰 4가지 갈래의 소식을 만들어 준다.
 * · 해마다 같은 때 열리는 지역 축제/행사는 이름과 장소를 그대로 쓰고, 날짜는 "○월 중"처럼 기간으로 보여 준다.
 * · 복지·강좌는 전국 어느 시·군·구에서나 운영하는 사업을 지역 이름에 맞춰 안내한다.
 * · 날짜는 해마다 조금씩 달라질 수 있어 화면에서 "확인" 안내를 함께 보여 준다.
 *
 * 전국 확장(2026-11) — 17개 시·도와 시·군·구 어디를 골라도 빈 화면이 나오지 않게 한다.
 * 1) 시·군·구 고유 축제를 이름·시기·장소로 넣어 둔다(SIGUNGU_FESTIVALS + SIGUNGU_SEEDS).
 * 2) 시·도 대표 축제(SIDO_FESTIVALS)는 그 시·도 어느 시·군·구에서나 함께 보여 준다(이름이 겹치면 한 번만).
 * 3) 그래도 소식이 모자라면 언제나 볼 수 있는 복지·강좌 안내로 채운다(evergreen).
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
  { key: "event", label: "한마당·행사", emoji: "🎪", dot: "bg-sun", chip: "bg-sun-light text-[#9A6A05]" },
  { key: "festival", label: "축제", emoji: "🏮", dot: "bg-coral", chip: "bg-coral-light text-coral-dark" },
  { key: "class", label: "무료 강좌", emoji: "🎓", dot: "bg-plum", chip: "bg-plum-light text-plum-dark" },
  { key: "welfare", label: "복지 소식", emoji: "🎁", dot: "bg-brand", chip: "bg-brand-light text-brand-dark" },
];

export function newsCategoryInfo(cat: NewsCategory) {
  return NEWS_CATEGORIES.find((c) => c.key === cat) ?? NEWS_CATEGORIES[0];
}

/** "충북 옥천군" 처럼 화면에 쓰는 지역 이름 (시·도만 있으면 시·도) */
export function newsAreaName(sido: string, sigungu: string): string {
  const s = shortSido(sido || "");
  if (!sigungu) return s || "우리 동네";
  if (sigungu.startsWith(s) || s.startsWith(sigungu)) return sigungu;
  return `${s} ${sigungu}`.trim();
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

/**
 * 시·군·구 고유 축제 — [이름, 열리는 달, 장소(없으면 "○○ 일원")].
 * 설명과 문의 방법은 지역 이름에 맞춰 만들어 쓴다(seedFestival).
 */
type FestivalSeed = [name: string, months: number[], place?: string];

const SIGUNGU_SEEDS: Record<string, FestivalSeed[]> = {
  /* ---------------- 서울특별시 ---------------- */
  "서울특별시/종로구": [["서울연등회", [5], "조계사 · 청계천 일원"]],
  "서울특별시/용산구": [["이태원 지구촌축제", [10], "이태원 관광특구 일원"]],
  "서울특별시/마포구": [
    ["마포나루 새우젓축제", [10], "마포농수산물시장 일원"],
    ["서울억새축제", [10], "월드컵공원 하늘공원 일원"],
  ],
  "서울특별시/영등포구": [["서울세계불꽃축제", [10], "여의도 한강공원 일원"]],
  "서울특별시/서초구": [["서리풀페스티벌", [9], "반포한강공원 · 서초구 일원"]],
  "서울특별시/강남구": [["강남페스티벌", [10], "강남대로 · 코엑스 일원"]],
  "서울특별시/송파구": [["석촌호수 벚꽃축제", [4], "석촌호수 일원"]],
  "서울특별시/강동구": [["강동선사문화축제", [10], "암사동 선사유적지 일원"]],
  "서울특별시/노원구": [["노원탈축제", [5], "당현천 · 노원문화예술회관 일원"]],
  "서울특별시/은평구": [["은평누리축제", [10], "은평구 일원"]],
  "서울특별시/성북구": [["성북문화축제", [10], "성북구 일원"]],
  "서울특별시/광진구": [["어린이대공원 봄꽃축제", [4], "어린이대공원 일원"]],

  /* ---------------- 부산광역시 ---------------- */
  "부산광역시/중구": [["부산자갈치축제", [10], "자갈치시장 일원"]],
  "부산광역시/수영구": [
    ["부산불꽃축제", [11], "광안리해수욕장 일원"],
    ["광안리어방축제", [5], "광안리 해변 일원"],
  ],
  "부산광역시/해운대구": [
    ["부산국제영화제", [10], "해운대 영화의전당 일원"],
    ["해운대모래축제", [5], "해운대해수욕장 일원"],
  ],
  "부산광역시/동래구": [["동래읍성역사축제", [10], "동래읍성 일원"]],
  "부산광역시/금정구": [["금정산성축제", [10], "금정산성 일원"]],
  "부산광역시/영도구": [["영도다리축제", [9], "영도대교 일원"]],
  "부산광역시/강서구": [["부산낙동강유채꽃축제", [4], "대저생태공원 일원"]],
  "부산광역시/기장군": [["기장멸치축제", [4], "대변항 일원"]],

  /* ---------------- 대구광역시 ---------------- */
  "대구광역시/중구": [["대구약령시한방문화축제", [5], "약전골목 일원"]],
  "대구광역시/달서구": [["대구치맥페스티벌", [7], "두류공원 일원"]],
  "대구광역시/달성군": [["비슬산참꽃축제", [4], "비슬산 일원"]],

  /* ---------------- 인천광역시 ---------------- */
  "인천광역시/남동구": [["소래포구축제", [10], "소래포구 일원"]],
  "인천광역시/중구": [["인천상륙작전 기념행사", [9], "월미도 일원"]],
  "인천광역시/강화군": [["강화고인돌축제", [4], "부근리 고인돌 일원"]],

  /* ---------------- 광주광역시 ---------------- */
  "광주광역시/동구": [["광주충장축제", [10], "충장로 일원"]],
  "광주광역시/서구": [["광주김치축제", [11], "광주월드컵경기장 일원"]],

  /* ---------------- 대전광역시 ---------------- */
  "대전광역시/유성구": [["유성온천문화축제", [5], "유성온천 일원"]],
  "대전광역시/서구": [["대전국화축제", [10], "한밭수목원 일원"]],

  /* ---------------- 울산광역시 ---------------- */
  "울산광역시/중구": [["울산처용문화제", [10], "태화강 일원"]],
  "울산광역시/남구": [["울산고래축제", [5], "장생포 일원"]],
  "울산광역시/울주군": [["간절곶해맞이축제", [1], "간절곶 일원"]],

  /* ---------------- 경기도 ---------------- */
  "경기도/수원시": [["수원화성문화제", [10], "화성행궁 · 수원화성 일원"]],
  "경기도/이천시": [
    ["이천쌀문화축제", [10], "이천 설봉공원 일원"],
    ["이천도자기축제", [4, 5], "이천 세라피아 일원"],
  ],
  "경기도/고양시": [["고양국제꽃박람회", [4, 5], "일산호수공원 일원"]],
  "경기도/부천시": [
    ["부천국제판타스틱영화제", [7], "부천시 일원"],
    ["부천국제애니메이션페스티벌", [10], "부천시 일원"],
  ],
  "경기도/안산시": [["안산거리극축제", [5], "안산문화광장 일원"]],
  "경기도/시흥시": [["시흥갯골축제", [9], "시흥갯골생태공원 일원"]],
  "경기도/군포시": [["군포철쭉축제", [4], "수리산 철쭉동산 일원"]],
  "경기도/파주시": [["파주북소리축제", [9], "파주출판도시 일원"]],
  "경기도/안성시": [["안성맞춤 남사당바우덕이축제", [10], "안성천 · 안성맞춤랜드 일원"]],
  "경기도/화성시": [["화성뱃놀이축제", [5], "화성시 일원"]],
  "경기도/여주시": [["여주오곡나루축제", [10], "신륵사 · 남한강 일원"]],
  "경기도/가평군": [["자라섬재즈페스티벌", [10], "자라섬 일원"]],
  "경기도/연천군": [["연천구석기축제", [5], "전곡리 유적 일원"]],
  "경기도/김포시": [["김포문수산성축제", [10], "문수산성 일원"]],

  /* ---------------- 강원특별자치도 ---------------- */
  "강원특별자치도/춘천시": [["춘천마임축제", [5], "춘천시 일원"]],
  "강원특별자치도/원주시": [["원주다이내믹댄싱카니발", [9], "원주시 일원"]],
  "강원특별자치도/강릉시": [["강릉단오제", [6], "남대천 · 강릉시 일원"]],
  "강원특별자치도/동해시": [["동해무릉제", [4], "무릉계곡 일원"]],
  "강원특별자치도/태백시": [["태백산눈축제", [1, 2], "태백산 일원"]],
  "강원특별자치도/속초시": [["속초설악문화제", [10], "속초시 일원"]],
  "강원특별자치도/삼척시": [["삼척정월대보름제", [2], "삼척시 일원"]],
  "강원특별자치도/홍천군": [["홍천찰옥수수축제", [8], "홍천군 일원"]],
  "강원특별자치도/횡성군": [["횡성한우축제", [10], "횡성군 일원"]],
  "강원특별자치도/영월군": [["영월동강뗏목축제", [8], "동강 일원"]],
  "강원특별자치도/평창군": [["평창효석문화제", [9], "봉평 효석문화마을 일원"]],
  "강원특별자치도/정선군": [["정선아리랑제", [10], "정선군 일원"]],
  "강원특별자치도/철원군": [["철원한탄강얼음트레킹", [1], "한탄강 일원"]],
  "강원특별자치도/화천군": [["화천산천어축제", [1], "화천천 일원"]],
  "강원특별자치도/양구군": [["양구배꼽축제", [8], "양구군 일원"]],
  "강원특별자치도/인제군": [["인제빙어축제", [1], "소양호 일원"]],
  "강원특별자치도/양양군": [["양양송이축제", [10], "양양군 일원"]],

  /* ---------------- 충청남도 ---------------- */
  "충청남도/천안시": [["천안흥타령춘향제", [9, 10], "천안삼거리공원 일원"]],
  "충청남도/공주시": [["공주백제문화제", [9, 10], "공주시 일원"]],
  "충청남도/보령시": [["보령머드축제", [7], "대천해수욕장 일원"]],
  "충청남도/아산시": [["성웅이순신축제", [4], "현충사 · 아산시 일원"]],
  "충청남도/논산시": [["논산딸기축제", [3, 4], "논산시 일원"]],
  "충청남도/당진시": [["기지시줄다리기축제", [4], "기지시줄다리기박물관 일원"]],
  "충청남도/금산군": [["금산인삼축제", [9, 10], "금산군 일원"]],
  "충청남도/청양군": [["청양고추구기자축제", [9], "청양군 일원"]],
  "충청남도/예산군": [["예산사과축제", [10, 11], "예산군 일원"]],
  "충청남도/태안군": [["태안세계튤립꽃축제", [4], "태안 일원"]],

  /* ---------------- 전북특별자치도 ---------------- */
  "전북특별자치도/전주시": [
    ["전주비빔밥축제", [10], "전주시 일원"],
    ["전주국제영화제", [5], "전주시 일원"],
  ],
  "전북특별자치도/군산시": [["군산시간여행축제", [10], "군산 원도심 일원"]],
  "전북특별자치도/익산시": [["익산서동축제", [5], "미륵사지 일원"]],
  "전북특별자치도/남원시": [["남원춘향제", [5], "광한루원 일원"]],
  "전북특별자치도/김제시": [["김제지평선축제", [10], "벽골제 일원"]],
  "전북특별자치도/완주군": [["완주와일드푸드축제", [10], "완주군 일원"]],
  "전북특별자치도/진안군": [["진안홍삼축제", [9], "진안군 일원"]],
  "전북특별자치도/무주군": [["무주반딧불축제", [9], "무주군 일원"]],
  "전북특별자치도/임실군": [["임실치즈축제", [10], "임실치즈테마파크 일원"]],
  "전북특별자치도/순창군": [["순창장류축제", [10], "순창군 일원"]],
  "전북특별자치도/고창군": [["고창청보리밭축제", [5], "고창 학원농장 일원"]],
  "전북특별자치도/부안군": [["부안마실축제", [5], "부안군 일원"]],

  /* ---------------- 전라남도 ---------------- */
  "전라남도/여수시": [["여수밤바다불꽃축제", [10], "돌산대교 일원"]],
  "전라남도/순천시": [["순천만갈대축제", [11], "순천만습지 일원"]],
  "전라남도/광양시": [["광양매화축제", [3], "광양 매화마을 일원"]],
  "전라남도/담양군": [["담양대나무축제", [5], "죽녹원 일원"]],
  "전라남도/구례군": [["구례산수유꽃축제", [3], "산동면 일원"]],
  "전라남도/고흥군": [["고흥유자축제", [11], "고흥군 일원"]],
  "전라남도/보성군": [["보성다향대축제", [5], "보성차밭 일원"]],
  "전라남도/장흥군": [["정남진물축제", [8], "탐진강 일원"]],
  "전라남도/강진군": [["강진청자축제", [8], "청자박물관 일원"]],
  "전라남도/해남군": [["해남 땅끝해넘이축제", [12], "땅끝마을 일원"]],
  "전라남도/영암군": [["영암왕인문화축제", [4], "왕인박사유적지 일원"]],
  "전라남도/무안군": [["무안연꽃축제", [7], "회산백련지 일원"]],
  "전라남도/함평군": [["함평나비축제", [5], "함평엑스포공원 일원"]],
  "전라남도/장성군": [["장성홍길동축제", [5], "장성군 일원"]],
  "전라남도/완도군": [["완도장보고축제", [5], "완도군 일원"]],
  "전라남도/진도군": [["진도영등축제", [2, 3], "진도군 일원"]],
  "전라남도/신안군": [["신안튤립축제", [4], "임자도 일원"]],

  /* ---------------- 경상북도 ---------------- */
  "경상북도/포항시": [
    ["호미곶해맞이축제", [1], "호미곶 일원"],
    ["포항국제불빛축제", [5], "영일대해수욕장 일원"],
  ],
  "경상북도/경주시": [
    ["경주벚꽃축제", [4], "보문관광단지 일원"],
    ["경주신라문화제", [10], "경주시 일원"],
  ],
  "경상북도/김천시": [["김천직지문화축제", [10], "김천시 일원"]],
  "경상북도/안동시": [["안동국제탈춤페스티벌", [9, 10], "탈춤공원 일원"]],
  "경상북도/영주시": [["영주풍기인삼축제", [10], "풍기읍 일원"]],
  "경상북도/상주시": [["상주곶감축제", [12], "상주시 일원"]],
  "경상북도/문경시": [["문경찻사발축제", [5], "문경새재 일원"]],
  "경상북도/경산시": [["경산대추축제", [10], "경산시 일원"]],
  "경상북도/의성군": [["의성마늘축제", [6], "의성군 일원"]],
  "경상북도/청송군": [["청송사과축제", [11], "청송군 일원"]],
  "경상북도/영덕군": [["영덕대게축제", [3], "강구항 일원"]],
  "경상북도/청도군": [["청도소싸움축제", [5], "청도소싸움경기장 일원"]],
  "경상북도/고령군": [["고령대가야축제", [4], "대가야 역사테마관광지 일원"]],
  "경상북도/성주군": [["성주참외축제", [5], "성주군 일원"]],
  "경상북도/예천군": [["예천곤충축제", [8], "예천군 일원"]],
  "경상북도/봉화군": [["봉화은어축제", [7, 8], "내성천 일원"]],
  "경상북도/울진군": [["울진대게축제", [3], "후포항 일원"]],
  "경상북도/울릉군": [["울릉오징어축제", [8], "울릉도 일원"]],

  /* ---------------- 경상남도 ---------------- */
  "경상남도/창원시": [["진해군항제", [3, 4], "진해 여좌천 일원"]],
  "경상남도/진주시": [
    ["진주남강유등축제", [10], "진주성 · 남강 일원"],
    ["진주개천예술제", [10], "진주시 일원"],
  ],
  "경상남도/통영시": [["한산대첩축제", [8], "통영시 일원"]],
  "경상남도/김해시": [["김해가야문화축제", [4, 5], "김해시 일원"]],
  "경상남도/밀양시": [["밀양아리랑대축제", [5], "밀양시 일원"]],
  "경상남도/양산시": [["양산삽량문화축제", [10], "양산시 일원"]],
  "경상남도/의령군": [["의령홍의장군축제", [9], "의령군 일원"]],
  "경상남도/함안군": [["함안수박축제", [6], "함안군 일원"]],
  "경상남도/창녕군": [["창녕낙동강유채꽃축제", [4], "창녕 남지 일원"]],
  "경상남도/남해군": [["남해보물섬마늘축제", [5], "남해군 일원"]],
  "경상남도/하동군": [["하동야생차문화축제", [5], "하동군 일원"]],
  "경상남도/산청군": [["산청한방약초축제", [9, 10], "동의보감촌 일원"]],
  "경상남도/함양군": [["함양산삼축제", [9], "함양군 일원"]],

  /* ---------------- 제주특별자치도 ---------------- */
  "제주특별자치도/제주시": [
    ["제주들불축제", [3], "새별오름 일원"],
    ["제주유채꽃축제", [1, 2], "제주시 일원"],
  ],
  "제주특별자치도/서귀포시": [["제주감귤박람회", [11, 12], "서귀포시 일원"]],
};

/** 시·도 대표 축제 — 그 시·도 어느 시·군·구에서나 함께 보여 준다 */
const SIDO_FESTIVALS: Record<string, Festival[]> = {
  서울특별시: [
    { name: "서울빛초롱축제", months: [11, 12], place: "광화문광장 · 청계천 일원", summary: "도심이 등불로 물드는 겨울 축제예요. 무료로 걸으며 볼 수 있어요.", how: "서울시 축제 홈페이지에서 기간을 확인하세요." },
    { name: "서울재즈페스티벌", months: [5], place: "올림픽공원 일원", summary: "봄에 열리는 재즈 음악 축제예요.", how: "축제 홈페이지에서 일정과 입장 안내를 확인하세요." },
    { name: "서울거리예술축제", months: [9], place: "서울광장 · 도심 일원", summary: "거리에서 펼쳐지는 공연을 무료로 볼 수 있어요.", how: "서울문화재단 홈페이지에서 일정을 확인하세요." },
  ],
  부산광역시: [
    { name: "부산바다축제", months: [8], place: "해운대 · 광안리 일원", summary: "여름밤 바다에서 공연과 불꽃을 즐기는 축제예요.", how: "부산시 축제 홈페이지에서 관람 위치와 시간을 확인하세요." },
    { name: "부산국제영화제", months: [10], place: "영화의전당 · 해운대 일원", summary: "영화 상영과 야외 무대 행사가 함께 열려요.", how: "영화제 홈페이지에서 상영 일정을 확인하세요." },
  ],
  대구광역시: [
    { name: "대구컬러풀페스티벌", months: [5], place: "대구 도심 일원", summary: "거리 퍼레이드와 공연이 함께 열리는 봄 축제예요.", how: "대구시 축제 홈페이지에서 일정을 확인하세요." },
  ],
  인천광역시: [
    { name: "인천펜타포트음악축제", months: [8], place: "송도 일원", summary: "여름밤 음악 공연을 즐기는 축제예요.", how: "축제 홈페이지에서 일정을 확인하세요." },
  ],
  광주광역시: [
    { name: "광주비엔날레", months: [9, 10, 11], place: "광주비엔날레전시관 일원", summary: "미술 전시를 무료로 볼 수 있는 날이 있어요.", how: "비엔날레 홈페이지에서 무료 관람일을 확인하세요." },
    { name: "광주프린지페스티벌", months: [5], place: "충장로 일원", summary: "거리에서 펼쳐지는 공연 축제예요. 무료 공연이 많아요.", how: "광주시 문화관광 홈페이지를 확인하세요." },
  ],
  대전광역시: [
    { name: "대전사이언스페스티벌", months: [10], place: "엑스포시민광장 일원", summary: "과학 체험 부스와 공연이 함께 열리는 가족 축제예요.", how: "대전시 홈페이지에서 일정을 확인하세요." },
  ],
  울산광역시: [
    { name: "태화강 봄꽃축제", months: [4], place: "태화강 국가정원 일원", summary: "봄꽃 단지와 산책로를 무료로 즐길 수 있어요.", how: "울산시 홈페이지를 확인하세요." },
  ],
  세종특별자치시: [
    { name: "세종축제", months: [10], place: "세종호수공원 일원", summary: "공연과 체험 부스가 함께 열리는 가을 축제예요.", how: "세종시 홈페이지에서 일정을 확인하세요." },
  ],
  경기도: [
    { name: "경기도민체육대회", months: [4, 5], place: "경기도 일원", summary: "도내 시·군 대항 체육대회예요. 해마다 개최 지역이 달라요.", how: "경기도 홈페이지에서 올해 개최 지역을 확인하세요." },
  ],
  강원특별자치도: [
    { name: "강원도민체육대회", months: [9], place: "강원특별자치도 일원", summary: "도내 시·군 대항 체육대회예요. 해마다 개최 지역이 달라요.", how: "강원특별자치도 홈페이지에서 올해 개최 지역을 확인하세요." },
  ],
  충청남도: [
    { name: "충남도민체육대회", months: [9], place: "충청남도 일원", summary: "도내 시·군 대항 체육대회와 어르신 장기자랑이 열려요.", how: "충청남도 홈페이지에서 개최 지역을 확인하세요." },
  ],
  전북특별자치도: [
    { name: "전북도민체육대회", months: [5], place: "전북특별자치도 일원", summary: "도내 시·군이 모여 열리는 체육대회예요.", how: "전북특별자치도 홈페이지에서 개최 지역을 확인하세요." },
  ],
  전라남도: [
    { name: "남도음식문화큰잔치", months: [10], place: "전라남도 일원", summary: "남도 음식을 맛보는 먹거리 행사예요.", how: "전라남도 문화관광 홈페이지를 확인하세요." },
  ],
  경상북도: [
    { name: "경북도민체육대회", months: [4], place: "경상북도 일원", summary: "도내 시·군 대항 체육대회예요.", how: "경상북도 홈페이지에서 개최 지역을 확인하세요." },
  ],
  경상남도: [
    { name: "경남도민체육대회", months: [5], place: "경상남도 일원", summary: "도내 시·군 대항 체육대회예요.", how: "경상남도 홈페이지에서 개최 지역을 확인하세요." },
  ],
  제주특별자치도: [
    { name: "탐라문화제", months: [10], place: "제주시 일원", summary: "제주 전통 문화를 보고 즐기는 축제예요.", how: "제주시 홈페이지를 확인하세요." },
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

/** 시·군·구 축제 한 줄 데이터를 화면에 쓸 수 있는 소식으로 만든다 */
function seedFestival(seed: FestivalSeed, area: string): Festival {
  const [name, months, place] = seed;
  const first = Math.min(...months);
  const last = Math.max(...months);
  const when = first === last ? `${first}월` : `${first}월부터 ${last}월 사이`;
  return {
    name,
    months,
    place: place ?? `${area} 일원`,
    summary: `해마다 ${when}에 ${area}에서 열리는 대표 축제예요. 공연과 먹거리 장터, 체험 부스가 함께 열려요.`,
    how: `${area}청 누리집의 축제 안내를 보시거나 문화관광 부서·지역 문화원에 전화해 날짜를 확인하세요.`,
  };
}

/** 이 지역에서 볼 수 있는 축제 — 시·군·구 고유 축제가 먼저, 이름이 겹치면 한 번만 */
function festivalsFor(sido: string, sigungu: string, area: string): Festival[] {
  const key = `${sido}/${sigungu}`;
  const rows = [
    ...(SIGUNGU_FESTIVALS[key] ?? []),
    ...(SIGUNGU_SEEDS[key] ?? []).map((s) => seedFestival(s, area)),
    ...(SIDO_FESTIVALS[sido] ?? []),
  ];
  const seen = new Set<string>();
  const out: Festival[] = [];
  for (const f of rows) {
    if (seen.has(f.name)) continue;
    seen.add(f.name);
    out.push(f);
  }
  return out;
}

/**
 * 오늘부터 monthsAhead 개월 안에 열리는 우리 동네 소식.
 * 날짜가 지난 소식은 넣지 않는다.
 */
export function localNewsFor(sido: string, sigungu: string, today: string, monthsAhead = 3): LocalNews[] {
  const c: Ctx = {
    sido,
    sidoShort: shortSido(sido),
    sigungu,
    area: newsAreaName(sido, sigungu),
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
  for (const f of festivalsFor(sido, sigungu, c.area)) {
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

  // 3) 빈 화면 방지 — 어느 달, 어느 지역이어도 늘 볼 수 있는 안내를 채운다
  if (out.length < 3) {
    const always: { key: string; category: NewsCategory; title: string; summary: string; how: string; contact?: string }[] = [
      {
        key: "evergreen-welfare",
        category: "welfare",
        title: `${c.area} 복지 상담 창구 안내`,
        summary: "어떤 지원을 받을 수 있는지 궁금하면 가까운 행정복지센터 복지 창구에서 물어보세요. 신청까지 함께 도와줘요.",
        how: "읍·면·동 행정복지센터에 전화하거나 보건복지상담센터 129로 상담하세요.",
        contact: "보건복지상담센터 129",
      },
      {
        key: "evergreen-class",
        category: "class",
        title: `${c.area} 노인복지관 프로그램 안내`,
        summary: "서예·노래·건강체조 같은 무료 프로그램을 연중 운영해요. 처음 가셔도 안내해 드려요.",
        how: "가까운 노인복지관에 전화해 지금 듣을 수 있는 수업을 물어보세요.",
      },
      {
        key: "evergreen-event",
        category: "event",
        title: `${c.area} 주민자치센터 문화강좌`,
        summary: "주민자치센터에서 소규모로 열리는 무료·저렴한 강좌예요. 이웃과 함께 듣기 좋아요.",
        how: "가까운 주민자치센터(행정복지센터)에 전화해 접수 날짜를 확인하세요.",
      },
    ];
    for (const a of always) {
      out.push({
        id: `${a.key}-${today}`,
        category: a.category,
        title: a.title,
        sido,
        sigungu,
        place: c.area,
        startDate: today,
        summary: a.summary,
        how: a.how,
        contact: a.contact,
        free: true,
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

/** 이 지역 축제를 이름만으로 몇 개나 넣어 두었는지 (검증용) */
export function regionFestivalCount(sido: string, sigungu: string): number {
  return festivalsFor(sido, sigungu, newsAreaName(sido, sigungu)).length;
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
  const where = newsAreaName(n.sido, n.sigungu);
  return `[늘봄 우리동네 소식] ${n.title}\n· 언제: ${newsPeriod(n)}\n· 어디: ${n.place}${where ? ` (${where})` : ""}\n· ${n.summary}\n· 신청·문의: ${n.how}${n.contact ? ` (${n.contact})` : ""}`;
}
