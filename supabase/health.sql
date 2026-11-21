-- 건강생활 챌린지 체크인 (시니어 플랫폼 2단계)
-- 사람 한 명 × 하루 한 줄에 체크한 챌린지 id 배열을 저장한다.
-- id: water(물 5잔) · walk(15분 걷기) · stretch(스트레칭) · medicine(복약) · family(가족 안부)

create table if not exists public.health_checks (
  id          bigserial primary key,
  user_code   text not null references public.users(code) on delete cascade,
  check_date  date not null default (now() at time zone 'Asia/Seoul')::date,
  challenges  text[] not null default '{}',
  updated_at  timestamptz not null default now(),
  unique (user_code, check_date)
);

create index if not exists health_date_idx on public.health_checks (check_date);
create index if not exists health_user_idx on public.health_checks (user_code, check_date desc);

-- 모임 API 가 오늘 체크한 사람을 한 번에 읽는다.
create index if not exists health_user_date_idx on public.health_checks (user_code, check_date);

-- 개인정보 보호: anon 키로는 한 줄도 읽거나 쓸 수 없게 잠근다.
-- (앱은 서버 Functions 가 service_role 로만 읽고 쓴다 — 정책을 만들지 않는 것이 정상)
-- 2026-11-21: 라이브에서 RLS 가 꺼져 있어 anon 키로 전체 조회·삽입이 가능했던 것을 바로잡았다.
alter table public.health_checks enable row level security;
