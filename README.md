# 시니어생활 도우미 (senior-life-platform)

카카오톡 웹뷰(모바일 390×844)에 맞춘 **어르신 종합 생활 플랫폼**입니다.
Next.js(App Router) + TypeScript + Tailwind CSS 로 만들고, **Cloudflare Pages**(정적 빌드 + Pages Functions)에 배포합니다.

- 글씨 기본 18px(최대 24px까지 키우기), 고대비 색, 48~64px 터치 버튼
- 카카오 앱 키나 Supabase 키가 **없어도 모든 기능이 그대로 동작**합니다(체험 로그인 · 로컬 저장 · 예시 순위)

## 5대 기능

| # | 기능 | 화면 |
|---|---|---|
| ① | 오늘의 운세(띠·생년월일) + 날씨 생활 팁 + 이름이 들어간 안부 인사카드(Canvas 1080×1350) 생성·저장·카카오 공유 | 홈 |
| ② | 1분 두뇌 퀴즈(초성 / 옛날 노래 가사 / 틀린 그림 찾기, 하루 3문제) + 금빛 상장 PNG + 명예의 전당(우리 동네 · 띠·나이 · 개근상, 주간 리셋) | 퀴즈 |
| ③ | 출생연도·거주지 기반 맞춤 지원금 14종 + 3단계 행동 지침 + 문의처 전화 연결 | 혜택 |
| ④ | 카메라 돋보기 1~4배(손전등·화면 밝게), 카드뉴스(보이스피싱·KTX·카톡 글씨·병원) | 도구 |
| ⑤ | 아침/저녁 복약 체크 + 원터치 안부 카드 + 자녀 확인 대시보드(`/family`) | 가족 |

## 실행

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # out/ 에 정적 파일 생성 (output: 'export')
npm run typecheck    # tsc --noEmit
```

## Cloudflare Pages 배포

정적 파일은 `out/`, API 는 `functions/api/**`(Pages Functions)로 배포합니다.

```bash
npm run build
npx wrangler pages deploy out --project-name senior-life-platform
# 또는 Git 연동: Build command `npm run build`, Output directory `out`
```

### 환경변수 (전부 선택 — 없으면 데모 모드)

| 변수 | 위치 | 설명 |
|---|---|---|
| `NEXT_PUBLIC_KAKAO_JS_KEY` | 빌드 시 | 카카오 JavaScript 키. 있으면 카카오톡 공유 카드(SDK) 사용, 없으면 Web Share/이미지 저장으로 폴백 |
| `KAKAO_CLIENT_ID` | Functions | 카카오 REST API 키 (`/api/auth/kakao` 토큰 교환) |
| `KAKAO_CLIENT_SECRET` | Functions | 카카오 클라이언트 시크릿 |
| `KAKAO_REDIRECT_URI` | Functions | 카카오 로그인 리다이렉트 URI (예: `https://<도메인>/`) |
| `NEXT_PUBLIC_SUPABASE_URL` | 빌드 | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 빌드 | Supabase anon 키 (읽기) |
| `SUPABASE_SERVICE_ROLE_KEY` | Functions | Supabase service role 키 (쓰기, RLS 우회) |
| `NEXT_PUBLIC_SITE_URL` | 빌드 | 배포 도메인 (OG 태그용) |

> 빌드 시점 변수(`NEXT_PUBLIC_*`)는 Cloudflare Pages 의 **Settings → Environment variables → Build** 에,
> Functions 변수는 **Runtime** 에 넣어 주세요.

### Supabase

`supabase/schema.sql` 을 Supabase SQL Editor 에서 실행하면
`users`, `quiz_logs`, `rankings_weekly`, `med_checks`, `daily_visits`, `family_links`, `anbu_messages`
테이블과 주간 집계 함수(`refresh_weekly_rankings`), 상위 10명 뷰(`v_weekly_top`)가 만들어집니다.

키가 없을 때는 `lib/db.ts` 의 **메모리 폴백**이 동작해 저장·가족 대시보드가 라이브에서도 그대로 보입니다.
(브라우저 `localStorage` 가 원본이고, 서버는 보조 저장소입니다.)

## 구조

```
app/
  page.tsx          탭 셸(홈/퀴즈/혜택/도구/가족)
  family/page.tsx   자녀 확인 대시보드
  layout.tsx        메타데이터 · OG 이미지
components/         화면별 컴포넌트 (home, quiz, ranking, welfare, tools, family, ui, icons)
lib/
  fortune.ts        띠·운세 결정론(날짜+생년월일 시드)
  weather.ts        Open-Meteo 실시간 날씨 + 생활 팁(실패 시 폴백)
  quiz.ts           문제 은행과 하루 3문제 선택
  welfare.ts        2026년 지원 제도 데이터 · 자격 매칭
  rankings.ts       주간 순위 생성(지역·띠·개근) · 상위 10명/상위 %
  canvas.ts         인사카드·상장·안부카드 Canvas 렌더러
  storage.tsx       localStorage 상태 + 가족 코드
  db.ts             Supabase(PostgREST) 연결 + 메모리 폴백
functions/api/      Pages Functions (auth/kakao, state, rankings, health)
supabase/schema.sql DB 스키마
```

## 검증

- `npm run typecheck`, `npm run build` 통과
- Playwright 모바일 390×844 E2E: 체험 로그인 → 인사카드 생성 → 퀴즈 3문제·상장 → 랭킹 탭 → 지원금 필터 → 돋보기/카드뉴스 → 복약·가족 대시보드
- 스크린샷: `downloads/senior_home_fortune.png`, `senior_quiz_ranking.png`, `senior_welfare_tools.png`, `senior_family_dashboard.png`

## 안내

지원금 금액·기준은 2026년 정부24/보건복지부 자료를 기준으로 정리했고, 지자체 사업은 달라질 수 있어 화면에
"주민센터(129) 확인" 안내를 함께 표시합니다. 명예의 전당은 실제 참여자가 쌓이기 전까지 예시 순위로 보이며
화면에 그 사실을 표시합니다.
