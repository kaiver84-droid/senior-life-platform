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
