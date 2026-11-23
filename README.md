# 늘봄 (senior-life-platform)

**라이브: https://senior-life-platform.pages.dev** (Cloudflare Pages)

**늘봄 — 언제나, 늘 곁에 있는 시니어를 위한 스마트한 생활 플랫폼**

> 2단계(2026-11-16): **건강생활 챌린지 · OX/넌센스 퀴즈(208문항) · 카카오톡 공유 미리보기 시트** 를 더했습니다.

카카오톡 웹뷰(모바일 390×844)에 맞춘 **어르신 종합 생활 플랫폼**입니다.
청록(`#18939B`) + 따뜻한 노랑(`#F5B82E`)의 하트·새싹 로고, 크림 배경(`#F9F7F1`),
딥네이비(`#173B5E`) 버튼과 골드 CTA 로 구성한 시니어 친화 디자인입니다.
Next.js(App Router) + TypeScript + Tailwind CSS 로 만들고, **Cloudflare Pages**(정적 빌드 + Pages Functions)에 배포합니다.

- 글씨 기본 18px(최대 24px까지 키우기), 고대비 색, 48~64px 터치 버튼
- 카카오 앱 키나 Supabase 키가 **없어도 모든 기능이 그대로 동작**합니다(체험 로그인 · 로컬 저장 · 예시 순위)

## 6대 화면

| # | 기능 | 화면 |
|---|---|---|
| ① | 오늘의 운세(띠·생년월일) + 날씨 생활 팁 + 이름이 들어간 안부 인사카드(Canvas 1080×1350) 생성·저장·카카오 공유 | 홈 |
| ② | 1분 치매예방 퀴즈 — **초성 · 옛날 노래 · 틀린 그림 · OX 건강 상식 · 넌센스·아재개그 5종 208문항**, 하루 3문제(3번째는 날마다 유형이 바뀜), 주제 골라 바로 풀기, 금빛 상장 PNG | 퀴즈 |
| ②′ | 명예의 전당 — 알약형 4탭(**우리 모임** · 전국 · 지역별 · 개근왕), 1·2·3위 시상대, 4~10위, 내 순위·상위 %, 우리 모임 달성률 배너 | 랭킹 |
| ③ | 출생연도·거주지 기반 맞춤 지원금 14종 + 3단계 행동 지침 + 문의처 전화 연결 | 혜택 |
| ④ | 카메라 돋보기 1~4배(손전등·화면 밝게), 카드뉴스(보이스피싱·KTX·카톡 글씨·병원) | 더보기 → 도구 |
| ⑤ | 아침/저녁 복약 체크 + 원터치 안부 카드 + 자녀 확인 대시보드(`/family`) | 더보기 → 가족 |
| ⑥ | **우리 모임** — 모임 만들기/초대 코드 가입, `?group=XXXXXX` 초대로 자동 가입, 회원별 오늘 출석 도장 · 이번 주 달성률 게이지 · 모임 전용 한 줄 게시판(응원) | 홈 · 모임 |
| ②″ | **오늘의 건강생활 챌린지** — 물 5잔·15분 걷기·스트레칭·복약·가족 안부 5가지를 원터치 완료 도장으로 체크, 내 진행률과 **모임원 함께 달성률**을 홈·모임 탭에서 표시, 기록은 이 기기 + Supabase(`health_checks`)에 저장 | 홈 · 모임 |
| ⑤′ | **가족안부달력** — 자녀 생일·기념일·가족 일정·병원약속(매년 반복·D-Day) 과 **우리동네 소식**(지역 행사·축제·무료 강좌·복지) 을 한 달 달력에 점으로 구분해 보여 주고, 날짜별 상세·일정 추가/수정/삭제·카톡 알리기까지 한 화면에서 | 홈 배너 · 가족 · `/family` |

## 화질(레티나 3배 · 2K) · 이미지 자산

- `public/images/` 의 배너·사진은 **원본을 다시 그린 고해상도 아트(2026-11-21 전면 재생성)** 를 긴 변 **1600px**로
  맞춰(원본보다 큰 해상도로 억지 업스케일하지 않음) 아주 약한 샤픈 후 **WebP q95 method6 / JPEG q93 4:4:4** 로 저장합니다.
  아이폰 14(390px·DPR 3 = 1170px)에서 1.4~2배 여유가 있고, 같은 화면에서 예전보다 가볍습니다(전체 4.1MB → 2.7MB).
- `public/images/onboarding-hero.*` — 접속 첫 화면 상단 배너(맑은 봄 하늘·노란 국화·웃는 가족, 글자 없음) 1600×879.
- `public/images/home-hero.*` — 로그인 후 홈 첫 화면 인사 히어로(봄 마을 정원에서 손 흔드는 어르신,
  1600×900, 글자 없음). 글자 자리에만 딥네이비 그라디언트를 얹어 그림 본체는 원본 그대로 보입니다.
- `public/images/greeting-<id>-large.jpg` — **오늘의 안부 인사카드 배경(초고화질 사진 6종)**. 1080×1350(카드와 같은 4:5),
  위쪽 2/3 에 그림의 주인공(트리·해·꽃·숲길·찻잔)을 두고 아래쪽은 흰 인사말 카드가 덮는 구도. 약한 샤픈 후 JPEG q90~94.
  `christmas`(크리스마스 나무·눈 풍경) · `golden-sunrise`(바다 위 해돋이) · `peony`(모란 꽃다발) ·
  `autumn-path`(단풍 숲길) · `hanok-tea`(한옥 마루의 찻잔) · `chrysanthemum`(기존 국화).
  고르는 칸에 쓰는 작은 사진은 `greeting-<id>-thumb.jpg`(320×400, 30~50KB).
- `public/share-card.png` — 카카오톡 공유 썸네일 2400×1260(2배 렌더). `work/neulbom_assets/share-card.html`을
  브라우저에서 1200×630·DPR2 로 찍어 만듭니다(글자가 벡터처럼 선명).
- `public/images/icon-3d-*.png|webp` — 클레이·글래스 질감의 **3D 입체 아이콘 15종**(WebP 1024px · PNG 768px 폴백,
  모서리는 투명). 접속 첫 화면 3개 카드·홈 바로가기 6개 타일·오늘의 운세/날씨·건강 챌린지·퀴즈 첫 화면(치매예방)에 씁니다.
- 재가공 스크립트: `work/neulbom_assets/process_uhd.py` (재생성 원본 → 1600px 배너 · 1024px 아이콘),
  공유 카드: `work/neulbom_assets/share-card.html`
- 검증: `python3 e2e/capture_4k_neulbom.py` (390×844 · DPR 3, 히어로 naturalWidth 1536~1600px · 아이콘 768px+ ·
  깨진 이미지·콘솔 오류 확인 + `downloads/neulbom_uhd_*.png` 스크린샷),
  `python3 e2e/preview_uhd.py` (로컬 화면 빠른 확인),
  `python3 e2e/verify_greeting_new_cards.py` (인사카드 새 사진 6종 — 완성 카드 1080×1350 저장 · 고르기 줄 가로 넘침 ·
  크리스마스 문구 · 카톡 공유 카드 확인. 라이브는 `BASE=https://senior-life-platform.pages.dev` 로 올리면 업로드까지 검사)

## 실행
```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # out/ 에 정적 파일 생성 (output: 'export')
npm run typecheck    # tsc --noEmit
```

## Cloudflare Pages 배포

정적 파일은 `out/`, API 는 `functions/api/**`(Pages Functions)로 배포합니다.
API 핸들러는 `functions-entry.ts` 에서 `/api/*` 라우팅으로 묶여 `out/_worker.js`(Pages Functions Advanced mode)가 됩니다.

```bash
npm run build                                   # out/ 생성
bun build functions-entry.ts --target browser --format esm --outfile out/_worker.js

# 방법 A) 대시보드 업로드 (검증된 경로)
python3 -c "import shutil; shutil.make_archive('senior-platform-site','zip','out')"
# Cloudflare 대시보드 → Workers & Pages → senior-life-platform → Create deployment
# → zip 업로드 → Save and deploy

# 방법 B) wrangler (검증된 경로 — 이 계정에서 정상 동작)
npx wrangler pages deploy out --project-name=senior-life-platform --branch=main
```

> `deploy_cloudflare.py` 는 Pages REST API 직접 업로드용 스크립트다. 프로젝트 생성·배포 기록은 성공했지만
> 이 계정에서는 업로드된 배포가 500 을 반환해(대시보드 업로드본은 정상) 현재는 방법 A 를 사용한다.

### ⚠️ 환경변수와 wrangler 의 관계 (2026-11-16 실측)

- `wrangler pages deploy` 는 `wrangler.toml` 의 `[vars]` 기준으로 **프로젝트의 `plain_text` 환경변수를 덮어쓴다**
  (`[vars]` 가 비면 대시보드에서 넣은 plain_text 변수가 지워진다).
- 반면 타입이 `secret_text` 인 변수는 wrangler 배포에도 살아남고 새 배포에 그대로 바인딩된다.
- 그래서 런타임 변수는 전부 `secret_text` 로 넣는다(값은 Cloudflare에 암호화 저장, 공개 저장소에 노출 없음).
- 배포 없이 대시보드에서 변수만 바꾸면 이미 만들어진 배포에는 반영되지 않는다(= 바인딩은 배포 생성 시점).
  변수를 바꾼 뒤에는 반드시 다시 배포한다.

```bash
# 런타임 변수 넣기/바꾸기 (production) — 없애려면 값을 null 로 보낸다
python3 - <<'PY'
import json, os, urllib.request
account, project = "bbddf7735b353b9656460deab2744f9b", "senior-life-platform"
token = open(".cloudflare_token").read().strip()
body = {"deployment_configs": {"production": {"env_vars": {
    "SUPABASE_SERVICE_ROLE_KEY": {"type": "secret_text", "value": "..."},
    "KAKAO_CLIENT_SECRET": {"type": "secret_text", "value": "..."},
}}}}
req = urllib.request.Request(f"https://api.cloudflare.com/client/v4/accounts/{account}/pages/projects/{project}",
    data=json.dumps(body).encode(), method="PATCH",
    headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
print(json.loads(urllib.request.urlopen(req).read())["success"])
PY
```

### 연동 키 한 번에 넣기

키를 받으면 `work/senior-platform/.env.integrations`(git 제외)에 적고 아래를 실행한다.
런타임 변수는 전부 `secret_text` 로 들어가고, `--deploy` 를 주면 빌드·배포·라이브 검증까지 한다.

```bash
python3 scripts/apply_integrations.py --deploy
```

### 카카오 로그인 흐름(로그인 전용 → 최초 1회 설정)

첫 화면은 **카카오톡 로그인 전용**입니다. 로그인 전에는 이름·태어난 해·지역 입력 폼을 보여 주지 않고
브랜드 소개와 **[카카오톡으로 시작하기]** 버튼만 둡니다(카카오 키가 없는 개발 빌드에서만 '카카오 없이 둘러보기'가 보입니다).

1. 온보딩 화면의 **카카오톡으로 시작하기**
   - `NEXT_PUBLIC_KAKAO_JS_KEY` 가 있으면 Kakao JS SDK(`t1.kakaocdn.net` 2.7.4)를 미리 불러 두고,
     버튼을 누르는 순간 `Kakao.Auth.authorize({ redirectUri, throughTalk: true })` 를 사용자 제스처 안에서 호출한다.
   - **iPhone Safari / Android Chrome** 에서는 카카오톡 앱이 바로 열려 **아이디·비밀번호 입력 없이** 동의만 하면 끝난다
     (SDK 2.7.4 는 iOS 에서 `https://talk-apps.kakao.com/scheme/kakaotalk://inappbrowser?url=<authorize>&web=<web>`
     유니버설 링크, Android 에서 intent URI 로 카카오톡을 연다. `through_talk` 쿼리 파라미터는 SDK 2.x 에서 쓰지 않는다).
   - 데스크톱처럼 카카오톡 앱이 없는 환경은 SDK 가 `kauth.kakao.com/oauth/authorize` → 카카오계정 로그인 화면으로 보낸다.
   - SDK 미로드/키 없음/스크립트 차단 시에만 `GET /api/auth/kakao?start=1`(REST 키 302)로 폴백한다.
2. 카카오가 `KAKAO_REDIRECT_URI`(기본 `https://senior-life-platform.pages.dev/`)로 `?code=`(취소 시 `?error=`)를 돌려준다.
3. 앱이 주소창에서 코드를 지우고 `POST /api/auth/kakao` 로 `{ code, redirectUri }` 를 보내면 서버가 토큰 교환 → 프로필 저장.
   서버는 받은 `redirectUri` 가 자기가 쓸 값(`KAKAO_REDIRECT_URI`)과 다르면 교환하지 않고 400 `redirect_uri_mismatch` 를 돌려준다.
   (`Kakao.Auth.authorize` 는 JavaScript 키, 토큰 교환은 REST API 키 — 같은 앱의 키라 인가 코드는 그대로 교환된다.)

카카오 콘솔에는 Redirect URI 를 `https://senior-life-platform.pages.dev/` 로 등록하고,
`https://senior-life-platform.pages.dev/api/auth/kakao` 도 함께 등록해 두면 code 를 직접 확인할 때 편하다.
JS SDK 간편로그인을 쓰려면 **플랫폼 > Web > 사이트 도메인**에 `https://senior-life-platform.pages.dev`,
**카카오 로그인 > 일반**에서 카카오 로그인 사용 설정이 켜져 있어야 한다.

#### 로그인 직후 — 최초 1회 초기 설정

4. 토큰 교환이 끝나면 앱은 `makeCode(profile.id)`(카카오 회원번호 기반 `kakao_xxx`)로 `GET /api/state?code=` 를 불러
   이미 `profile_completed = true` 인 사람인지 확인한다.
   - **처음**이면 → 초기 설정 화면: `이름(카카오 닉네임 기본값) · 태어난 해(1926~2020 전 연령, 기본 1952) ·
     태어난 시간(자시~해시 12시진 + 모름) · 사는 지역(시·도) · 시·군·구` → **[저장하고 늘봄 시작하기]**
   - **이미 설정을 마친 사람**(다른 기기에서 다시 로그인 포함)이면 → DB 프로필을 그대로 불러와 설정 화면 없이 **바로 홈**
5. 저장하면 `localStorage`(`seniorLife.v1`)와 Supabase `users` 행에 함께 남는다
   (`birth_time`, `profile_completed` 열 — `supabase/schema.sql` 참고, 기존 DB에는 `alter table` 로 추가).
   이후 ⚙ **설정 > 내 정보 고치기** 에서 이름·태어난 해·태어난 시간·지역을 언제든 고칠 수 있다.
6. 태어난 시간은 `lib/fortune.ts` 의 오늘의 운세 시드와 **시진 성향·시간대 팁**에 반영된다(모르면 표시하지 않음).

### 환경변수 (전부 선택 — 없으면 데모 모드)

| 변수 | 위치 | 설명 |
|---|---|---|
| `NEXT_PUBLIC_KAKAO_JS_KEY` | 빌드 시 | 카카오 JavaScript 키. 있으면 카카오톡 공유 카드(SDK)와 **카카오톡 원터치 간편로그인**(`Kakao.Auth.authorize`, `throughTalk: true`)에 사용 |
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
`users`, `quiz_logs`, `rankings_weekly`, `med_checks`, `daily_visits`, `family_links`, `anbu_messages`,
`family_events`, **`groups`·`group_members`·`group_posts`·`group_cheers`**, **`health_checks`**
테이블과 주간 집계 함수(`refresh_weekly_rankings`), 상위 10명 뷰(`v_weekly_top`)가 만들어집니다.
모임 테이블만 따로 적용하려면 `supabase/groups.sql`(체험 모임 `FAM101` 시드 포함),
건강 챌린지 테이블만 따로 적용하려면 `supabase/health.sql` 을 실행합니다.

키가 없을 때는 `lib/db.ts` 의 **메모리 폴백**이 동작해 저장·가족 대시보드가 라이브에서도 그대로 보입니다.
(브라우저 `localStorage` 가 원본이고, 서버는 보조 저장소입니다.)

## 구조

```
app/
  page.tsx          탭 셸(홈/퀴즈/랭킹/혜택/도구/가족) · 늘봄 로고 헤더 · 설정 시트
  family/page.tsx   자녀 확인 대시보드
  layout.tsx        메타데이터 · OG 이미지
components/         화면별 컴포넌트 (home, quiz, ranking, welfare, tools, family, calendar, onboarding, groups, health, share-sheet, ui, icons, art)
lib/
  fortune.ts        띠·운세 결정론(날짜+생년월일 시드)
  weather.ts        Open-Meteo 실시간 날씨 + 생활 팁(실패 시 폴백)
  quiz.ts           문제 은행과 하루 3문제 선택
  welfare.ts        2026년 지원 제도 데이터 · 자격 매칭
  rankings.ts       주간 순위 생성(지역·띠·개근) · 상위 10명/상위 %
  calendar.ts       가족안부달력 일정 모델 · 매년 반복·D-Day·월간 달력 계산
  local-news.ts     우리동네 소식(지역 행사·축제·무료 강좌·복지) 데이터 · 지역별 생성
  canvas.ts         인사카드·상장·안부카드·공유 카드(1200×630) Canvas 렌더러
  share.ts          카카오톡 공유(피드) → 공유창 → 저장/복사 폴백 — 클릭과 같은 콜스택에서 동기 호출
  card-share.ts     내가 만든 카드(인사카드·상장)를 미리 /api/share-image 에 올려 두고, 클릭 때 그 주소를 넘긴다(디바운스 350ms)
  og.ts             공유 상황별 제목·설명·링크·**카드 이미지**의 단일 출처 — worker 의 OG 주입과 앱 공유 버튼이 함께 쓴다
  storage.tsx       localStorage 상태 + 가족 코드 (+ 가족 일정 추가/수정/삭제)
  groups.ts         모임 API 호출 · 초대 링크(?group=) 기억 · 시간 표기
  group-store.tsx   모임 상태(목록·상세·오늘 출석·달성률)와 만들기/가입/글쓰기/응원
  group-demo.ts     체험 모임 회원의 날짜·주차 기반 결정론 데이터(서버·오프라인 공용)
  group-local.ts    서버에 못 붙을 때의 localStorage 모임 폴백
  health.ts         건강생활 챌린지 5가지 정의 · 날짜별 체크 계산 · 모임 요약
  db.ts             Supabase(PostgREST) 연결 + 메모리 폴백
functions/api/      Pages Functions (auth/kakao, state, rankings, groups, health, share-image)
functions/og.ts     요청 주소 → OG 정보(모임 초대는 Supabase 에서 모임 이름 조회)
functions-entry.ts  _worker.js 진입점 — /api/* + 화면 HTML 의 제목·og:* 를 상황별로 바꿔 내려보냄
supabase/schema.sql DB 스키마
supabase/groups.sql 모임 테이블 + 체험 모임 시드
```

## 카카오톡 공유 카드 이미지 (2026-11-23)

- 카톡 맨 위 카드는 **상황마다 다른 그림**입니다 — `public/images/share-{greeting,quiz,welfare,group,family,fortune}.png`
  (1200×630, `work/neulbom_assets/make_share_cards.py` 로 HTML+chromium 렌더. 홈·랭킹·더보기는 `public/share-card.png`).
- 안부 인사카드·퀴즈 상장처럼 **내가 만든 카드**는 그 카드가 그대로 뜹니다:
  카드가 그려지면(문구를 고치면 350ms 뒤) `lib/card-share.ts` 가 1200×630 피드 카드로 감싸 `POST /api/share-image` 로 올리고,
  [카톡으로 보내기] 클릭 순간에는 **await 없이** 그 주소(`/api/share-image?k=…&h=…`)를 `sendDefault.content.imageUrl` 로 넘깁니다.
  아직 올리는 중이거나 실패하면 그 상황의 기본 카드로 자동 폴백합니다(카톡이 안 열리는 일이 없게).
- 저장: Supabase Storage 공개 버킷 `share-cards`(서비스 키로만 쓰기). 파일명이 내용 해시라 같은 카드는 덮어쓰기(중복 없음),
  7일 지난 임시 카드는 올릴 때 가끔 정리합니다. 카카오는 `GET /api/share-image?k=…&h=…` 로 200 image/png 를 받습니다.
- 링크에도 `?card=<종류>&h=<해시>` 가 붙어, 링크를 그대로 붙여 넣어도 같은 카드가 미리보기로 뜹니다(worker `functions/og.ts`).
- 혜택 상세 모달의 **[카톡 공유]** — 그 혜택의 이름·금액·문의와 `/?tab=welfare&program=<id>` 링크를 `share-welfare.png` 카드로 보냅니다.
  받은 링크는 그 혜택 상세를 바로 열고, 미리보기(og:title·og:description)도 그 혜택 문구로 뜨게 worker 가 `?program=` 을 읽습니다.
  (혜택 상세 시트의 닫기는 **아래 고정 [✕ 닫기] 하나**만 둡니다 — 상단 닫기·본문 닫기를 겹치지 않게.)

## 검증

- `npm run typecheck`, `npm run build` 통과
- 공유 미리보기(OG) 검증: `node e2e/worker-meta-test.mjs` — out/_worker.js 를 그대로 불러
  `/?group=`·`/?join=`·`/family/`·`/?tab=quiz`·`/?share=greeting` 등 주소별 og:title·og:description 확인
  (모임 이름 조회는 `SUPABASE_SERVICE_ROLE_KEY` 가 있을 때 실제 Supabase 로 돈다)
- 공유 카드 이미지 검증: `BASE=https://senior-life-platform.pages.dev python3 e2e/verify_share_cards.py`
  (상황별 og:image 가 서로 다른 카드인지 + 그 주소 200 image/png + 카드 업로드/조회 + 카톡 payload 의 imageUrl 이 그 카드인지
   + 혜택 상세 모달의 중복 닫기 정리·[카톡 공유] 의 제목·금액·문의·링크·이미지)
- 문제 감사: `python3 scripts/audit_quiz.py` — 초성·노래·그림·**OX 2지선다·넌센스 4지선다** 검증(208문항, 0 errors)
- 모임 API 검증(실제 Supabase): `node e2e/test_groups_api.mjs` — 만들기·가입·글쓰기·응원·선택·나가기·오류 처리 24항목
- 건강 챌린지 저장·모임 반영 검증(실제 Supabase): `node e2e/test_health_api.mjs` — 저장·복원·줄이기·모임 health 요약 12항목
- 2단계 로컬 UI 검증: `python3 e2e/test_phase2_local.py` — 건강 챌린지 도장·새로고침 유지·OX/넌센스 주제 풀이·공유 미리보기(건강·인사카드·모임 초대) 27항목
- 모임 라이브 E2E: `python3 e2e/test_live_groups.py`
  (홈 모임 배너·모임 현황·미션 → 체험 모임 가입·출석·달성률·게시판 → 초대 링크 → 모임 만들기 →
   `?group=CODE` 자동 가입 → 랭킹 4탭/시상대/달성률 → 퀴즈 공동 배지·결과 알리기 → 더보기 도구·가족·달력)
- Playwright 모바일 390×844 E2E: `BASE=https://senior-life-platform.pages.dev python3 e2e/test_live.py`
  (체험 로그인 → 인사카드 캔버스 → 퀴즈 3문제·금빛 상장 → 시상대 → 지원금 3단계 → 돋보기·가이드 → 복약·가족 대시보드
  → 가족안부달력 일정 추가·삭제·4갈래 소식 필터·자녀 화면 공유 일정)
- 카카오 로그인 검증: `BASE=https://senior-life-platform.pages.dev python3 e2e/test_kakao_talk.py`
- 로그인 전용 첫 화면 + 최초 1회 설정(이름·태어난해·태어난시간·지역) + 재로그인 스킵 검증:
  `python3 e2e/test_kakao_onboarding.py` (카카오 인가만 스텁, 저장·조회는 같은 핸들러 + 실제 Supabase)
- 2단계 라이브 E2E(스크린샷 포함): `python3 e2e/test_live_phase2.py` → 35항목
  (건강 챌린지 저장·새로고침·다른 기기 복원, OX/넌센스 출제, 공유 미리보기, 모임 함께 달성률, 기존 기능 회귀)
  → `downloads/neulbom_health_challenge.png`, `downloads/neulbom_ox_nonsense_quiz.png`, `downloads/neulbom_kakao_share_modal.png`
- 스크린샷: `python3 e2e/capture_neulbom.py` →
  `downloads/neulbom_home.png`, `neulbom_quiz.png`, `neulbom_ranking_welfare.png`, `neulbom_tools_family.png`

## 안내

지원금 금액·기준은 2026년 정부24/보건복지부 자료를 기준으로 정리했고, 지자체 사업은 달라질 수 있어 화면에
"주민센터(129) 확인" 안내를 함께 표시합니다. 명예의 전당은 실제 참여자가 쌓이기 전까지 예시 순위로 보이며
화면에 그 사실을 표시합니다.

우리동네 소식은 지역 축제 이름·장소와, 어느 시·군·구에서나 운영하는 행사·무료 강좌·복지 사업을 사용자의
설정 지역에 맞춰 정리한 안내입니다. 축제·행사 날짜와 접수 기간은 해마다 달라지므로 화면 하단에
"방문·신청 전에 전화로 확인" 안내를 함께 보여 줍니다.
