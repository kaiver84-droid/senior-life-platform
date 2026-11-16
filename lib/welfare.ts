import type { WelfareProgram } from "./types";

/**
 * 2026년 기준 어르신·중장년 지원 제도 모음.
 * 금액·기준은 정부24 / 보건복지부 고시(2026), 고용노동부·국민건강보험공단 안내 기준으로 확인한 값이며,
 * 지자체 사업은 지역마다 다르므로 '주민센터 확인' 안내를 함께 제공합니다.
 */
export const WELFARE: WelfareProgram[] = [
  {
    id: "basic-pension",
    title: "기초연금",
    category: "연금",
    org: "보건복지부 · 주민센터",
    amount: "월 최대 349,700원",
    summary:
      "만 65세 이상이고 소득인정액이 기준 이하이면 매달 연금을 받아요. 2026년 기준 단독가구 월 247만원, 부부가구 월 395만 2천원 이하이면 신청할 수 있어요.",
    minAge: 65,
    steps: [
      "신분증과 통장 사본을 챙겨 가까운 주민센터(읍·면·동사무소)를 찾아가세요.",
      "복지 창구에서 \"기초연금 신청하고 싶어요\"라고 말하고 신청서를 받으세요.",
      "소득·재산 확인 후 결과를 우편으로 알려 줘요. 보통 1~2달 걸려요.",
    ],
    documents: ["신분증", "본인 통장 사본", "배우자 신분증(부부 신청 시)"],
    contact: "보건복지부 기초연금 상담",
    phone: "129",
    url: "https://www.gov.kr/portal/service/serviceInfo/SSE000000170",
    deadline: "언제든 신청 가능 (65세 생일 한 달 전부터)",
    tags: ["현금", "매달 지급", "가장 먼저 챙기세요"],
  },
  {
    id: "livelihood-benefit",
    title: "기초생활보장 생계급여",
    category: "생활비",
    org: "보건복지부 · 주민센터",
    amount: "1인 가구 최대 820,556원",
    summary:
      "소득이 매우 적은 어르신 가구에 매달 생활비를 드려요. 2026년 기준 1인 가구 소득인정액이 82만원 이하이면 대상이 될 수 있어요.",
    minAge: 0,
    steps: [
      "주민센터 복지 창구에 가서 \"기초생활보장 신청할 수 있을까요?\"라고 물어보세요.",
      "가족관계, 소득, 집·차·통장 잔액을 적는 신청서를 작성하세요.",
      "담당 공무원이 집을 방문해 확인한 뒤 결과를 알려 줘요.",
    ],
    documents: ["신분증", "통장 사본", "임대차계약서(월세 사는 경우)"],
    contact: "보건복지상담센터",
    phone: "129",
    url: "https://www.gov.kr/portal/service/serviceInfo/SSE000000006",
    deadline: "언제든 신청 가능",
    tags: ["현금", "소득 기준 있음"],
  },
  {
    id: "flu-shot",
    title: "어르신 무료 독감 예방접종",
    category: "의료",
    org: "보건소 · 위탁 병·의원",
    amount: "본인 부담 0원",
    summary:
      "만 65세 이상이면 독감 예방접종을 무료로 맞을 수 있어요. 보통 10월부터 12월 31일까지예요.",
    minAge: 65,
    steps: [
      "신분증만 챙겨 동네 병원이나 보건소에 가세요.",
      "접수처에서 \"어르신 독감 예방접종 하러 왔어요\"라고 말하세요.",
      "주사를 맞고 20~30분은 앉아서 몸 상태를 살피세요.",
    ],
    documents: ["신분증"],
    contact: "가까운 보건소",
    phone: "129",
    url: "https://www.kdca.go.kr",
    deadline: "12월 31일까지",
    tags: ["겨울 대비", "무료", "병원 방문"],
  },
  {
    id: "dementia-center",
    title: "치매안심센터 무료 검진",
    category: "의료",
    org: "보건소 치매안심센터",
    amount: "검진·상담 무료",
    summary:
      "만 60세 이상이면 치매 선별검사를 무료로 받을 수 있어요. 기억이 자꾸 깜빡거리면 꼭 한 번 받아 보세요.",
    minAge: 60,
    steps: [
      "가까운 보건소에 전화해 \"치매 선별검사 받고 싶어요\"라고 말하세요.",
      "보호자와 함께 방문하면 더 좋아요. 검사는 10~20분이면 끝나요.",
      "결과가 나오면 필요할 때 치료·돌봄 프로그램을 연결해 줘요.",
    ],
    documents: ["신분증", "보호자 연락처"],
    contact: "치매상담콜센터",
    phone: "1899-9988",
    url: "https://www.nid.or.kr",
    deadline: "연중",
    tags: ["기억력 검사", "무료", "가족과 함께"],
  },
  {
    id: "denture-implant",
    title: "틀니·임플란트 건강보험 적용",
    category: "의료",
    org: "건강보험공단 · 치과",
    amount: "본인 부담 30% (틀니·임플란트)",
    summary:
      "만 65세 이상이면 틀니와 임플란트를 건강보험으로 저렴하게 할 수 있어요. 치과에 가서 물어보세요.",
    minAge: 65,
    steps: [
      "동네 치과에 가서 \"어르신 틀니(또는 임플란트) 건강보험 되나요?\"라고 물어보세요.",
      "신분증과 건강보험증(또는 자격 확인)을 보여 주세요.",
      "치료 전에 본인 부담금이 얼마인지 꼭 확인하고 시작하세요.",
    ],
    documents: ["신분증", "건강보험 자격 확인서류"],
    contact: "국민건강보험공단",
    phone: "1577-1000",
    url: "https://www.nhis.or.kr",
    deadline: "연중 (평생 1회 기준)",
    tags: ["치아", "건강보험", "본인부담 30%"],
  },
  {
    id: "senior-transit",
    title: "지하철 무임 · 기차 경로 할인",
    category: "교통",
    org: "지자체 · 코레일",
    amount: "지하철 무료 / KTX 30% 할인",
    summary:
      "만 65세 이상이면 서울·부산 등 대부분의 도시 지하철을 무료로 타요. KTX와 기차는 30% 할인돼요.",
    minAge: 65,
    steps: [
      "지하철을 탈 때는 교통카드를 찍지 말고 역무원에게 신분증을 보여 주세요.",
      "기차표를 살 때는 코레일 앱이나 역 창구에서 \"경로 할인\"을 선택하세요.",
      "출발 20분 전까지 예매하면 앉아서 갈 수 있어요.",
    ],
    documents: ["신분증(주민등록증·운전면허증)"],
    contact: "코레일 고객센터",
    phone: "1544-7788",
    url: "https://www.letskorail.com",
    deadline: "연중",
    tags: ["이동", "무료", "할인"],
  },
  {
    id: "local-transit-support",
    title: "우리 동네 어르신 교통비·택시 지원",
    category: "교통",
    org: "시·군·구청",
    amount: "지역마다 다름 (월 3만~10만원 등)",
    summary:
      "지자체마다 어르신 버스비, 택시 쿠폰, 농어촌 이동 지원 사업을 따로 운영해요. 사는 곳에 어떤 사업이 있는지 주민센터에서 확인하세요.",
    minAge: 60,
    steps: [
      "주민센터에 가서 \"어르신 교통비 지원 사업 있나요?\"라고 물어보세요.",
      "있으면 신청서를 쓰고 신분증과 통장 사본을 내세요.",
      "카드나 쿠폰을 받으면 사용처(버스·택시)를 확인하세요.",
    ],
    documents: ["신분증", "통장 사본"],
    contact: "거주지 주민센터",
    phone: "129",
    url: "https://www.bokjiro.go.kr",
    deadline: "지자체별 예산 소진 시까지",
    tags: ["지자체 사업", "확인 필요"],
  },
  {
    id: "custom-care",
    title: "노인맞춤돌봄서비스",
    category: "돌봄",
    org: "읍·면·동 · 수행기관",
    amount: "무료 (안부확인·가사·외출 동행)",
    summary:
      "혼자 사시거나 거동이 불편한 어르신께 전화 안부, 집안 정리, 병원 동행을 도와드려요.",
    minAge: 65,
    steps: [
      "주민센터 복지 창구에서 \"노인맞춤돌봄 신청하고 싶어요\"라고 말하세요.",
      "담당자가 집을 방문해 어떤 도움이 필요한지 상담해요.",
      "서비스를 받게 되면 생활지원사가 정기적으로 연락하고 찾아와요.",
    ],
    documents: ["신분증"],
    contact: "노인맞춤돌봄 상담(주민센터)",
    phone: "129",
    url: "https://www.bokjiro.go.kr",
    deadline: "연중",
    tags: ["혼자 사는 어르신", "무료", "안부 전화"],
  },
  {
    id: "emergency-care",
    title: "응급안전안심서비스 (응급호출기)",
    category: "돌봄",
    org: "독거노인종합지원센터",
    amount: "무료 설치",
    summary:
      "집에 응급호출기와 활동감지기를 무료로 달아 드려요. 쓰러지거나 움직임이 없으면 119와 가족에게 자동으로 알려요.",
    minAge: 65,
    steps: [
      "주민센터나 129에 전화해 \"응급안전안심서비스 신청\"이라고 말하세요.",
      "집에 설치 기사가 방문해 기계를 달아 드려요(30분 정도).",
      "기계에 있는 빨간 버튼을 누르면 바로 도움을 요청할 수 있어요.",
    ],
    documents: ["신분증"],
    contact: "독거노인종합지원센터",
    phone: "129",
    url: "https://www.bokjiro.go.kr",
    deadline: "연중",
    tags: ["혼자 사는 어르신", "119 연결", "무료"],
  },
  {
    id: "senior-jobs",
    title: "노인일자리 사업",
    category: "생활비",
    org: "시니어클럽 · 주민센터",
    amount: "월 20만~30만원 활동비",
    summary:
      "만 65세 이상이면 동네 환경 정리, 급식 도우미 같은 일자리에 참여해 활동비를 받을 수 있어요.",
    minAge: 65,
    steps: [
      "주민센터에 \"노인일자리 신청하고 싶어요\"라고 말하세요.",
      "가까운 시니어클럽을 알려 주면 신청서를 작성하세요.",
      "일할 수 있는 날짜와 건강 상태를 확인한 뒤 배정받아요.",
    ],
    documents: ["신분증", "통장 사본"],
    contact: "노인일자리 상담",
    phone: "1544-3388",
    url: "https://www.seniorro.or.kr",
    deadline: "보통 1~2월 접수 (추가 모집 있음)",
    tags: ["활동비", "사회활동", "신청 시기 중요"],
  },
  {
    id: "long-term-care",
    title: "노인장기요양보험",
    category: "돌봄",
    org: "국민건강보험공단",
    amount: "방문요양·시설 입소비 일부 지원",
    summary:
      "거동이 불편해 혼자 생활하기 어려우면 등급을 받아 요양보호사 방문이나 요양원 이용을 지원받아요.",
    minAge: 65,
    steps: [
      "국민건강보험공단(1577-1000)에 전화해 \"장기요양 신청\"이라고 말하세요.",
      "공단 직원이 집을 방문해 일상생활이 얼마나 어려운지 조사해요.",
      "등급이 나오면 방문요양, 주야간보호, 요양원 중에서 고를 수 있어요.",
    ],
    documents: ["신분증", "의사 소견서(필요 시)"],
    contact: "국민건강보험공단",
    phone: "1577-1000",
    url: "https://www.longtermcare.or.kr",
    deadline: "연중",
    tags: ["거동 불편", "요양보호사", "등급 신청"],
  },
  {
    id: "housing-repair",
    title: "어르신 집수리 지원 (주거)",
    category: "주거",
    org: "지자체 · 주거복지센터",
    amount: "무료 또는 일부 지원",
    summary:
      "문턱이 높거나 화장실이 미끄러우면 손잡이·경사로·미끄럼 방지 같은 집수리를 지원받을 수 있어요.",
    minAge: 65,
    steps: [
      "주민센터에 \"어르신 집수리 지원 사업 있나요?\"라고 물어보세요.",
      "담당자가 집을 보고 필요한 공사를 정해요.",
      "지원 범위를 넘는 금액은 본인이 내야 하니 미리 확인하세요.",
    ],
    documents: ["신분증", "집 등기부등본 또는 임대차계약서"],
    contact: "지자체 주거복지 담당",
    phone: "1600-1004",
    url: "https://www.myhome.go.kr",
    deadline: "예산 소진 시까지",
    tags: ["안전", "집수리", "지자체 사업"],
  },
  {
    id: "bokjiro-search",
    title: "내가 받을 수 있는 복지 한 번에 찾기",
    category: "생활비",
    org: "복지로 · 정부24",
    amount: "해당 제도별로 다름",
    summary:
      "나이와 사는 곳만 넣으면 받을 수 있는 지원을 한 번에 찾아 줘요. 자녀가 대신 신청할 수도 있어요.",
    minAge: 0,
    steps: [
      "자녀나 가까운 사람에게 \"복지로에서 검색 좀 해 달라\"고 부탁하세요.",
      "복지로(bokjiro.go.kr)에서 '복지 서비스 찾기'를 누르고 나이·지역을 넣어요.",
      "나온 목록에서 신청할 것을 골라 주민센터에 함께 가면 돼요.",
    ],
    documents: ["신분증", "가족 연락처"],
    contact: "복지로 콜센터",
    phone: "129",
    url: "https://www.bokjiro.go.kr",
    deadline: "연중",
    tags: ["한 번에 찾기", "자녀와 함께", "온라인"],
  },
  {
    id: "training-card",
    title: "국민내일배움카드",
    category: "일자리",
    org: "고용노동부 · 고용센터",
    amount: "5년간 300만원 (최대 500만원)",
    summary:
      "새 일을 준비하거나 하던 일의 기술을 늘릴 때 훈련비를 지원받아요. 훈련비의 45~100%를 지원하고 카드 유효기간은 5년이에요. 공무원, 만 75세 이상 등은 받을 수 없어요.",
    minAge: 18,
    steps: [
      "고용24(work24.go.kr)에 가입하고, 일자리를 찾는 중이면 구직 신청을 먼저 해요.",
      "‘국민내일배움카드 발급 신청’을 누르거나 가까운 고용센터에 가서 신청해요.",
      "고용24에서 배우고 싶은 훈련과정을 골라 카드로 수강료를 내면 돼요.",
    ],
    documents: ["신분증", "본인 명의 휴대폰(본인확인)"],
    contact: "고용노동부 고객상담센터",
    phone: "1350",
    url: "https://www.work24.go.kr/hr/h/a/1100/selectIssuGudn.do",
    deadline: "연중 상시 신청",
    tags: ["직업훈련", "40·50대도 가능", "온라인 신청"],
  },
  {
    id: "midlife-center",
    title: "중장년내일센터",
    category: "일자리",
    org: "고용노동부 · 중장년내일센터",
    amount: "상담 · 교육 무료",
    summary:
      "만 40세 이상이면 전직·재취업 상담과 교육을 무료로 받을 수 있어요. 전국 35개 센터에서 1:1 컨설팅, 이력서·면접 코칭, 구인 알선까지 도와줘요.",
    minAge: 40,
    steps: [
      "고용24에서 회원가입을 하고 구직 신청을 해요.",
      "‘전직지원 서비스’를 신청하면 담당 컨설턴트가 배정돼요.",
      "1:1 상담과 교육 프로그램에 참여해 새 일자리를 찾아요.",
    ],
    documents: ["신분증", "이력서(있으면)"],
    contact: "고용노동부 고객상담센터",
    phone: "1350",
    url: "https://www.work24.go.kr/wk/u/a/1000/seniorCenterInfo.do",
    deadline: "연중",
    tags: ["40세 이상", "재취업 상담", "전국 35개 센터"],
  },
  {
    id: "national-health-check",
    title: "국가 건강검진",
    category: "의료",
    org: "국민건강보험공단",
    amount: "본인 부담 0원",
    summary:
      "만 40세 이상이면 2년마다 일반 건강검진을 무료로 받을 수 있어요. 짝수 해에는 짝수 해에 태어난 사람이, 홀수 해에는 홀수 해에 태어난 사람이 받아요.",
    minAge: 40,
    steps: [
      "국민건강보험공단 홈페이지나 The건강보험 앱에서 올해 검진 대상자인지 확인해요.",
      "가까운 검진 병·의원에 전화해 날짜를 정하고, 신분증을 챙겨 가요.",
      "검진 결과는 보통 2~4주 뒤 우편이나 앱으로 받아요.",
    ],
    documents: ["신분증"],
    contact: "국민건강보험공단",
    phone: "1577-1000",
    url: "https://www.nhis.or.kr",
    deadline: "12월 31일까지 (해마다)",
    tags: ["무료", "2년마다", "40세 이상"],
  },
];

export function matchPrograms(
  birthYear: number,
  sido: string,
  sigungu: string,
  today = new Date()
): WelfareProgram[] {
  const age = today.getFullYear() - birthYear;
  return WELFARE.filter((p) => {
    if (age < p.minAge) return false;
    if (p.maxAge && age > p.maxAge) return false;
    if (p.sido && p.sido.length > 0 && !p.sido.includes(sido)) return false;
    return true;
  }).sort((a, b) => {
    const rank = (p: WelfareProgram) => {
      if (p.tags.includes("가장 먼저 챙기세요")) return 0;
      if (p.sido) return 1;
      return 2;
    };
    return rank(a) - rank(b);
  });
}

export const WELFARE_CATEGORIES = ["전체", "연금", "생활비", "의료", "교통", "돌봄", "주거", "일자리"] as const;
