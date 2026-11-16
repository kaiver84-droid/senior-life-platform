# 시니어생활 도우미 (senior-life-platform)

**라이브: https://senior-life-platform.pages.dev** (Cloudflare Pages, 2026-11-16 배포)

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

### 카카오 로그인 흐름

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
