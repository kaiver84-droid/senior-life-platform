-- 늘봄 랭킹 고도화 2차 — ① 누적 점수(등급) ② 1:1 대결
-- Supabase SQL Editor 에 그대로 붙여 넣어도 되고, schema.sql 뒤에 이어 붙여도 됩니다.

/* ------------------------------------------------------------------ */
/* 14. 누적 점수 — 등급(새싹·햇살·행복·금빛·늘봄 명예회원) 계산용         */
/*     1차 늘봄왕 규칙과 같은 ‘하루 최대 140점’ 상한을 그대로 쓴다.       */
/*     출석 10 · 퀴즈 30 · 건강 20 · 복지 10 · 모임 20 · 초대 50(명당)   */
/* ------------------------------------------------------------------ */
create or replace view public.v_user_lifetime as
with inviter as (
  -- 초대 링크(?ref=)로 새로 가입한 사람을 초대한 사람의 날짜별 초대 성공 수
  select i.code as inviter_code,
         (u.created_at at time zone 'Asia/Seoul')::date as d,
         count(*)::int as n
  from public.users u
  join public.users i on i.external_id = u.invited_by and i.code <> u.code
  group by 1, 2
),
raw as (
  select user_code, visit_date as d, 10 as pts, 0 as health, 0 as inv
  from public.daily_visits
  union all
  select user_code, quiz_date, 30, 0, 0 from public.quiz_logs
  union all
  select user_code, check_date, 0, coalesce(array_length(challenges, 1), 0), 0
  from public.health_checks
  union all
  select user_code, activity_date,
         case when kind = 'welfare' then 10 else 20 end, 0, 0
  from public.activity_logs
  union all
  select inviter_code, d, 0, 0, n * 50 from inviter
),
by_day as (
  select user_code, d, sum(pts) as pts, max(health) as health, sum(inv) as inv
  from raw
  group by 1, 2
),
scored as (
  select user_code, least(140, pts + case when health > 0 then 20 else 0 end + inv) as pts
  from by_day
)
select
  u.code,
  coalesce(sum(s.pts), 0)::int as lifetime_points,
  (select count(*) from public.daily_visits v where v.user_code = u.code)::int as attend_days,
  (select count(*) from public.quiz_logs q where q.user_code = u.code)::int as quiz_days,
  (select coalesce(sum(q.correct), 0) from public.quiz_logs q where q.user_code = u.code)::int as quiz_correct,
  (select count(*) from public.health_checks h
    where h.user_code = u.code and coalesce(array_length(h.challenges, 1), 0) > 0)::int as health_days,
  (select count(*) from public.activity_logs a
    where a.user_code = u.code and a.kind = 'welfare')::int as welfare_days,
  (select count(*) from public.activity_logs a
    where a.user_code = u.code and a.kind = 'group')::int as group_days,
  (select count(*) from public.users c where c.invited_by = u.external_id and u.external_id is not null)::int as invite_count,
  (select count(*) from public.group_members m where m.user_code = u.code)::int as group_count,
  greatest(
    0,
    (select count(*) from public.group_members m
      join public.group_members o on o.group_id = m.group_id
      where m.user_code = u.code and o.user_code <> u.code and o.role <> 'demo')
  )::int as group_mates
from public.users u
left join scored s on s.user_code = u.code
group by u.code, u.external_id;

/* ------------------------------------------------------------------ */
/* 15. 친구와 1:1 대결 — 오늘 하루 점수를 겨루는 표                       */
/* ------------------------------------------------------------------ */
create table if not exists public.duels (
  id              uuid primary key default gen_random_uuid(),
  -- 대결하는 날(한국 시간). 날짜가 바뀌면 새 대결을 신청한다.
  duel_date       date not null default ((now() at time zone 'Asia/Seoul')::date),
  week_id         text not null default '',
  -- quiz: 오늘 퀴즈 점수 · total: 오늘 늘봄왕 종합 점수
  kind            text not null default 'total' check (kind in ('quiz', 'total')),
  challenger_code text not null references public.users(code) on delete cascade,
  challenger_name text not null,
  opponent_code   text not null references public.users(code) on delete cascade,
  opponent_name   text not null,
  status          text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  -- 마지막으로 확인한 점수(화면에서 바로 보여 주는 값) — 실제 비교는 조회할 때 다시 계산한다.
  challenger_score int not null default 0,
  opponent_score   int not null default 0,
  -- 대결 링크로 신청한 경우 표시
  from_link       boolean not null default false,
  created_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  updated_at      timestamptz not null default now(),
  unique (duel_date, challenger_code, opponent_code, kind)
);

create index if not exists duels_opponent_idx   on public.duels (opponent_code, status, duel_date desc);
create index if not exists duels_challenger_idx on public.duels (challenger_code, duel_date desc);

alter table public.duels enable row level security;
-- 앱은 /api/duels(service_role)로만 읽고 씁니다.
