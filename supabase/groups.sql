-- 늘봄 모임 기능 (groups / group_members / group_posts / group_cheers)
-- Supabase Management API 로 실행한 SQL 과 같은 내용입니다. (schema.sql 끝에도 함께 문서화)
-- 앱은 /api/groups (service_role) 로만 읽고 씁니다.

create extension if not exists "pgcrypto";

/* ------------------------------------------------------------------ */
/* 1. 모임                                                             */
/* ------------------------------------------------------------------ */
create table if not exists public.groups (
  id           text primary key,                 -- 6자리 초대 코드 (예: FAM101)
  name         text not null,                    -- '우리 가족 사랑방'
  description  text not null default '',
  goal_score   int  not null default 500,        -- 모임 목표 점수(주간)
  weekly_goal  int  not null default 5,          -- 한 사람이 일주일에 참여할 목표 일수
  creator_code text,                             -- 만든 사람의 사용자 코드
  is_demo      boolean not null default false,   -- 체험 모임 여부
  created_at   timestamptz not null default now()
);

/* ------------------------------------------------------------------ */
/* 2. 모임 회원 (한 사람이 여러 모임에 가입할 수 있다)                  */
/* ------------------------------------------------------------------ */
create table if not exists public.group_members (
  id        bigserial primary key,
  group_id  text not null references public.groups(id) on delete cascade,
  user_code text not null,                       -- public.users(code) — 가입이 프로필 저장보다 먼저 일어날 수 있어 FK 는 두지 않는다
  name      text not null,
  role      text not null default 'member' check (role in ('leader','member','demo')),
  joined_at timestamptz not null default now(),
  unique (group_id, user_code)
);

create index if not exists group_members_user_idx  on public.group_members (user_code);
create index if not exists group_members_group_idx on public.group_members (group_id);

/* ------------------------------------------------------------------ */
/* 3. 모임 전용 한 줄 게시판 (안부 · 응원)                              */
/* ------------------------------------------------------------------ */
create table if not exists public.group_posts (
  id          bigserial primary key,
  group_id    text not null references public.groups(id) on delete cascade,
  user_code   text not null,
  author_name text not null,
  content     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists group_posts_group_idx on public.group_posts (group_id, created_at desc);

/* ------------------------------------------------------------------ */
/* 4. 게시글 응원 (한 사람이 한 글에 한 번)                             */
/* ------------------------------------------------------------------ */
create table if not exists public.group_cheers (
  post_id   bigint not null references public.group_posts(id) on delete cascade,
  user_code text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_code)
);

/* ------------------------------------------------------------------ */
/* 5. 기본 선택 모임 (다시 로그인해도 보던 모임으로)                    */
/* ------------------------------------------------------------------ */
alter table public.users add column if not exists active_group_id text;

/* ------------------------------------------------------------------ */
/* 6. RLS — 앱은 service_role(/api/groups)로만 접근한다                 */
/* ------------------------------------------------------------------ */
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;
alter table public.group_posts   enable row level security;
alter table public.group_cheers  enable row level security;

/* ------------------------------------------------------------------ */
/* 7. 체험 모임 '우리 가족 사랑방' (FAM101) — 비어 있지 않은 첫 화면     */
/* ------------------------------------------------------------------ */
insert into public.groups (id, name, description, goal_score, weekly_goal, creator_code, is_demo)
values ('FAM101', '우리 가족 사랑방', '온 가족이 함께 치매예방 퀴즈로 건강을 챙기는 체험 모임이에요', 500, 5, 'FAM1A1', true)
on conflict (id) do update
  set name = excluded.name, description = excluded.description, is_demo = true;

insert into public.group_members (group_id, user_code, name, role) values
  ('FAM101', 'FAM1A1', '김영희', 'demo'),
  ('FAM101', 'FAM2B3', '박철수', 'demo'),
  ('FAM101', 'FAM3C5', '이정숙', 'demo'),
  ('FAM101', 'FAM4D7', '최민수', 'demo'),
  ('FAM101', 'FAM5E9', '정순자', 'demo'),
  ('FAM101', 'FAM6F2', '강옥분', 'demo'),
  ('FAM101', 'FAM7G4', '조말순', 'demo'),
  ('FAM101', 'FAM8H6', '윤정희', 'demo'),
  ('FAM101', 'FAM9J8', '장미숙', 'demo'),
  ('FAM101', 'FAMA0K', '임금자', 'demo')
on conflict (group_id, user_code) do nothing;

insert into public.group_posts (group_id, user_code, author_name, content, created_at)
select 'FAM101', v.code, v.name, v.content, now() - v.ago
from (values
  ('FAM1A1', '김영희', '오늘 아침 날씨가 참 좋네요. 다들 퀴즈 풀고 좋은 하루 보내세요! 💐', interval '3 hours'),
  ('FAM2B3', '박철수', '어제 노래 문제가 어렵더라고요. 오늘은 꼭 맞혀 볼게요!', interval '6 hours'),
  ('FAM3C5', '이정숙', '손녀가 저녁에 놀러 온대요. 같이 퀴즈 풀어 보려고요 😊', interval '1 day')
) as v(code, name, content, ago)
where not exists (select 1 from public.group_posts p where p.group_id = 'FAM101');
