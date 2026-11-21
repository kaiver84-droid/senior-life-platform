-- 시니어 종합 플랫폼 (senior-life-platform) Supabase 스키마
-- Supabase SQL Editor 에 통째로 붙여 넣고 실행하세요.
-- 앱은 NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY(또는 anon key)로 PostgREST 를 사용합니다.

create extension if not exists "pgcrypto";

/* ------------------------------------------------------------------ */
/* 1. 사용자                                                          */
/* ------------------------------------------------------------------ */
create table if not exists public.users (
  id             uuid primary key default gen_random_uuid(),
  code           text unique not null,              -- 기기 코드(가족 코드로도 사용, 6자리)
  external_id    text,                              -- 앱 내부 id (u_xxx / kakao_xxx)
  nickname       text not null,
  birth_year     int  not null check (birth_year between 1900 and 2020),
  birth_time     text not null default '모름',          -- 태어난 시간(십이시진): 자시 … 해시 / 모름
  sido           text not null default '',
  sigungu        text not null default '',
  source         text not null default 'demo' check (source in ('demo','kakao')),
  -- 카카오톡 로그인 프로필 사진 주소(https). 랭킹·모임 출석 현황에 원형 사진으로 보인다
  avatar_url     text,
  -- 초대 링크(?ref=)로 가입할 때 남는 초대한 사람의 내부 id — 랭킹 ‘초대왕’ 순위
  invited_by     text,
  -- 최초 1회 초기 설정(이름·태어난해·태어난시간·지역)을 마쳤는지 — true 면 재로그인 시 설정 화면을 건너뛴다
  profile_completed boolean not null default false,
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now()
);

-- 이미 만들어진 DB에도 열을 더한다(있으면 그대로 둔다).
alter table public.users add column if not exists birth_time text not null default '모름';
alter table public.users add column if not exists profile_completed boolean not null default false;
alter table public.users add column if not exists avatar_url text;
alter table public.users add column if not exists invited_by text;

create index if not exists users_invited_idx on public.users (invited_by);

-- 로그인한 사람을 카카오 회원번호(external_id)로 찾을 수 있게
create index if not exists users_external_idx on public.users (external_id);

create index if not exists users_region_idx on public.users (sido, sigungu);
create index if not exists users_birth_idx  on public.users (birth_year);

/* ------------------------------------------------------------------ */
/* 2. 퀴즈 기록                                                        */
/* ------------------------------------------------------------------ */
create table if not exists public.quiz_logs (
  id          bigserial primary key,
  user_code   text not null references public.users(code) on delete cascade,
  quiz_date   date not null default (now() at time zone 'Asia/Seoul')::date,
  week_id     text not null,                        -- 2026-W47
  correct     int  not null check (correct between 0 and 3),
  total       int  not null check (total between 1 and 3),
  points      int  not null default 0,
  seconds     int  not null default 0,
  types       text[] not null default '{}',
  created_at  timestamptz not null default now(),
  unique (user_code, quiz_date)
);

create index if not exists quiz_week_idx on public.quiz_logs (week_id);
create index if not exists quiz_user_idx on public.quiz_logs (user_code, quiz_date desc);

/* ------------------------------------------------------------------ */
/* 3. 주간 랭킹 집계 (매주 월요일 0시 KST 리셋 = week_id 변경)          */
/* ------------------------------------------------------------------ */
create table if not exists public.rankings_weekly (
  id          bigserial primary key,
  week_id     text not null,
  scope       text not null check (scope in ('region','zodiac','streak')),
  region      text not null default '',             -- '충청북도/옥천군' 또는 띠 이름
  user_code   text not null references public.users(code) on delete cascade,
  nickname    text not null,
  points      int  not null default 0,
  streak      int  not null default 0,
  rank        int,
  updated_at  timestamptz not null default now(),
  unique (week_id, scope, region, user_code)
);

create index if not exists ranking_lookup_idx on public.rankings_weekly (week_id, scope, region, points desc);

/* ------------------------------------------------------------------ */
/* 4. 복약 체크 (아침/저녁)                                            */
/* ------------------------------------------------------------------ */
create table if not exists public.med_checks (
  id          bigserial primary key,
  user_code   text not null references public.users(code) on delete cascade,
  check_date  date not null default (now() at time zone 'Asia/Seoul')::date,
  morning     boolean not null default false,
  evening     boolean not null default false,
  updated_at  timestamptz not null default now(),
  unique (user_code, check_date)
);

/* ------------------------------------------------------------------ */
/* 5. 접속(출석) 기록 — 개근상 계산                                    */
/* ------------------------------------------------------------------ */
create table if not exists public.daily_visits (
  id          bigserial primary key,
  user_code   text not null references public.users(code) on delete cascade,
  visit_date  date not null default (now() at time zone 'Asia/Seoul')::date,
  created_at  timestamptz not null default now(),
  unique (user_code, visit_date)
);

/* ------------------------------------------------------------------ */
/* 6. 가족 연결 (자녀가 부모님 코드로 안부 확인)                        */
/* ------------------------------------------------------------------ */
create table if not exists public.family_links (
  id            bigserial primary key,
  parent_code   text not null references public.users(code) on delete cascade,
  child_label   text,                               -- '딸', '아들' 등 자유 입력
  child_contact text,
  created_at    timestamptz not null default now(),
  unique (parent_code, child_label)
);

/* ------------------------------------------------------------------ */
/* 7. 안부 메시지 (원터치 안부 전송 기록)                               */
/* ------------------------------------------------------------------ */
create table if not exists public.anbu_messages (
  id          bigserial primary key,
  user_code   text not null references public.users(code) on delete cascade,
  sent_date   date not null default (now() at time zone 'Asia/Seoul')::date,
  channel     text not null default 'kakao' check (channel in ('kakao','share','copy','sms')),
  note        text,
  created_at  timestamptz not null default now()
);

/* ------------------------------------------------------------------ */
/* 8. 주간 자동 집계 함수 — 매주 월요일 0시(KST) 이전 주 실적을 집계      */
/* ------------------------------------------------------------------ */
create or replace function public.refresh_weekly_rankings(p_week text default null)
returns void
language sql
security definer
as $$
  insert into public.rankings_weekly as r (week_id, scope, region, user_code, nickname, points, streak)
  select
    q.week_id,
    'region' as scope,
    u.sido || '/' || u.sigungu as region,
    q.user_code,
    u.nickname,
    sum(q.points)::int as points,
    greatest(0, count(distinct q.quiz_date))::int as streak
  from public.quiz_logs q
  join public.users u on u.code = q.user_code
  where (p_week is null or q.week_id = p_week)
  group by q.week_id, u.sido, u.sigungu, q.user_code, u.nickname
  on conflict (week_id, scope, region, user_code)
  do update set points = excluded.points, streak = excluded.streak, nickname = excluded.nickname, updated_at = now();

  with ranked as (
    select id, rank() over (partition by week_id, scope, region order by points desc, streak desc) as rk
    from public.rankings_weekly
    where (p_week is null or week_id = p_week)
  )
  update public.rankings_weekly r set rank = ranked.rk from ranked where r.id = ranked.id;
$$;

/* Supabase 스케줄러(pg_cron)를 쓸 수 있으면 매주 월요일 00:05 KST 에 집계 */
-- select cron.schedule('weekly-rankings', '5 15 * * 0', $$select public.refresh_weekly_rankings()$$);

/* ------------------------------------------------------------------ */
/* 9. 조회용 뷰 — 상위 10명 + 내 순위                                    */
/* ------------------------------------------------------------------ */
create or replace view public.v_weekly_top as
select week_id, scope, region, rank, nickname, points, streak
from public.rankings_weekly
where rank <= 10
order by week_id desc, scope, region, rank;

/* ------------------------------------------------------------------ */
/* 10. RLS — 데모에서 anon 키로 읽기만 허용, 쓰기는 service_role        */
/* ------------------------------------------------------------------ */
alter table public.users            enable row level security;
alter table public.quiz_logs        enable row level security;
alter table public.rankings_weekly  enable row level security;
alter table public.med_checks       enable row level security;
alter table public.daily_visits     enable row level security;
alter table public.family_links     enable row level security;
alter table public.anbu_messages    enable row level security;

-- 랭킹은 누구나 읽을 수 있게
drop policy if exists "rankings_read_all" on public.rankings_weekly;
create policy "rankings_read_all" on public.rankings_weekly for select using (true);

-- service_role 은 RLS 를 우회하므로 별도 정책 불필요.
-- anon 키로 직접 쓰기가 필요하면 아래 정책을 쓰되, 운영에서는 service_role 경유를 권장합니다.
-- drop policy if exists "users_insert_anon" on public.users;
-- create policy "users_insert_anon" on public.users for insert with check (true);

/* ------------------------------------------------------------------ */
/* 11. 가족안부달력 — 가족 일정 (사용자당 한 줄에 JSON 배열로 저장)     */
/* ------------------------------------------------------------------ */
create table if not exists public.family_events (
  user_code   text primary key references public.users(code) on delete cascade,
  events      jsonb not null default '[]'::jsonb,   -- [{ id, title, date, repeatYearly, kind, memo, createdAt }]
  updated_at  timestamptz not null default now()
);

alter table public.family_events enable row level security;
-- 앱은 /api/state(service_role)로만 읽고 쓰므로 별도 정책이 필요 없습니다.
-- 자녀 확인 화면도 같은 /api/state?code= 로 읽습니다.

/* ------------------------------------------------------------------ */
/* 12. 모임 (groups · group_members · group_posts · group_cheers)        */
/*    전체 SQL 은 supabase/groups.sql 참고. 앱은 /api/groups(service_role) 로만 접근. */
/* ------------------------------------------------------------------ */
create table if not exists public.groups (
  id           text primary key,                 -- 6자리 초대 코드 (예: FAM101)
  name         text not null,
  description  text not null default '',
  -- 모임 지역 — ‘옥천군’ 처럼 짧게. 모임 수정에서 바꿀 수 있다
  region       text not null default '',
  goal_score   int  not null default 500,        -- 우리 모임 주간 목표 점수
  weekly_goal  int  not null default 5,          -- 한 사람이 일주일에 참여할 목표 일수
  creator_code text,
  is_demo      boolean not null default false,   -- 체험 모임 여부
  created_at   timestamptz not null default now()
);

create table if not exists public.group_members (
  id        bigserial primary key,
  group_id  text not null references public.groups(id) on delete cascade,
  user_code text not null,                       -- public.users(code) — 가입이 프로필 저장보다 먼저 일어날 수 있어 FK 없음
  name      text not null,
  role      text not null default 'member' check (role in ('leader','member','demo')),
  joined_at timestamptz not null default now(),
  unique (group_id, user_code)
);
create index if not exists group_members_user_idx  on public.group_members (user_code);
create index if not exists group_members_group_idx on public.group_members (group_id);

create table if not exists public.group_posts (
  id          bigserial primary key,
  group_id    text not null references public.groups(id) on delete cascade,
  user_code   text not null,
  author_name text not null,
  content     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists group_posts_group_idx on public.group_posts (group_id, created_at desc);

create table if not exists public.group_cheers (
  post_id   bigint not null references public.group_posts(id) on delete cascade,
  user_code text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_code)
);

-- 모임 지역(region) — 이미 만들어진 DB에도 더한다.
alter table public.groups add column if not exists region text not null default '';

-- 기본 선택 모임 (다시 로그인해도 보던 모임으로)
alter table public.users add column if not exists active_group_id text;

alter table public.groups        enable row level security;
alter table public.group_members enable row level security;
alter table public.group_posts   enable row level security;
alter table public.group_cheers  enable row level security;

-- 체험 모임 '우리 가족 사랑방'(FAM101) — 첫 화면이 비어 보이지 않도록 10명이 활동 중
insert into public.groups (id, name, description, goal_score, weekly_goal, creator_code, is_demo)
values ('FAM101', '우리 가족 사랑방', '온 가족이 함께 치매예방 퀴즈로 건강을 챙기는 체험 모임이에요', 500, 5, 'FAM1A1', true)
on conflict (id) do update set name = excluded.name, description = excluded.description, is_demo = true;

insert into public.group_members (group_id, user_code, name, role) values
  ('FAM101', 'FAM1A1', '김영희', 'demo'), ('FAM101', 'FAM2B3', '박철수', 'demo'),
  ('FAM101', 'FAM3C5', '이정숙', 'demo'), ('FAM101', 'FAM4D7', '최민수', 'demo'),
  ('FAM101', 'FAM5E9', '정순자', 'demo'), ('FAM101', 'FAM6F2', '강옥분', 'demo'),
  ('FAM101', 'FAM7G4', '조말순', 'demo'), ('FAM101', 'FAM8H6', '윤정희', 'demo'),
  ('FAM101', 'FAM9J8', '장미숙', 'demo'), ('FAM101', 'FAMA0K', '임금자', 'demo')
on conflict (group_id, user_code) do nothing;

/* ------------------------------------------------------------------ */
/* 8. 건강생활 챌린지 체크인 (2단계)                                   */
/*    사람 × 하루 한 줄에 체크한 챌린지 id 배열                       */
/*    water · walk · stretch · medicine · family                      */
/* ------------------------------------------------------------------ */
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

alter table public.health_checks enable row level security;
/* 정책을 만들지 않는다 = anon 키 전면 차단. 앱은 Functions 의 service_role 로만 읽고 쓴다.
   2026-11-21 라이브에서 이 설정이 꺼져 있어 anon 전체 조회·삽입이 가능했으므로 다시 켰다. */

/* ------------------------------------------------------------------ */
/* 13. 랭킹 고도화 1차 — 7개 영역 · 주간 종합 리그(늘봄왕)               */
/*    늘봄왕 점수: 출석 ＋10 · 퀴즈 ＋30 · 건강 ＋20 · 복지 확인 ＋10      */
/*                · 모임 미션 ＋20 · 친구 초대 ＋50(명당), 하루 최대 140점 */
/* ------------------------------------------------------------------ */
-- 랭킹 참여 ON/OFF — false 면 내 점수는 개인 기록으로만 남고 공개 순위표에서 빠진다.
alter table public.users add column if not exists ranking_visible boolean not null default true;

-- 복지·생활정보 확인(welfare) · 모임 공동 미션 참여(group) — 사람 × 날짜 × 종류 한 줄
create table if not exists public.activity_logs (
  id            bigserial primary key,
  user_code     text not null references public.users(code) on delete cascade,
  activity_date date not null default ((now() at time zone 'Asia/Seoul')::date),
  kind          text not null check (kind in ('welfare','group')),
  created_at    timestamptz not null default now(),
  unique (user_code, activity_date, kind)
);

create index if not exists activity_date_idx on public.activity_logs (activity_date);
create index if not exists activity_user_idx on public.activity_logs (user_code, activity_date desc);

alter table public.activity_logs enable row level security;
-- 앱은 /api/state · /api/rankings(service_role)로만 읽고 쓰므로 별도 정책이 필요 없습니다.
