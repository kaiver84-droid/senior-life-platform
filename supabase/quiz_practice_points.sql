-- 늘봄 — 연습 모드 +1점(하루 미션과 별개) 저장을 위한 quiz_logs 정리 (2026-11-23)
--
-- 배경
--  1) 2026-11-19 오늘의 퀴즈가 3 → 5문제로 바뀌었는데 quiz_logs 의 CHECK(total between 1 and 3) 이
--     그대로라, 하루 미션 5문제 기록이 서버에 저장되지 않았다(Supabase 400 quiz_logs_total_check).
--     연습 모드 점수를 한 줄에 쌓으려면 total 0(아직 하루 미션 전)도 저장할 수 있어야 한다.
--  2) v_user_lifetime(누적 점수·등급)은 quiz_logs ‘행이 있으면’ 퀴즈 30점·퀴즈한 날 1일로 셌다.
--     연습 모드만 푼 날도 하루 미션을 마친 것으로 오인하지 않도록 total > 0 인 날만 센다.
--
-- 적용: Supabase SQL Editor 또는 scripts 의 SQL API 로 그대로 실행.
-- 되돌리기(원래 값):
--   alter table public.quiz_logs drop constraint quiz_logs_total_check;
--   alter table public.quiz_logs add constraint quiz_logs_total_check check (total between 1 and 3);
--   alter table public.quiz_logs drop constraint quiz_logs_correct_check;
--   alter table public.quiz_logs add constraint quiz_logs_correct_check check (correct between 0 and 3);
--   그리고 supabase/ranking_phase2.sql 의 이전 정의(2026-11-18 판)로 view 를 다시 만든다.

alter table public.quiz_logs drop constraint if exists quiz_logs_total_check;
alter table public.quiz_logs add constraint quiz_logs_total_check check (total >= 0 and total <= 20);

alter table public.quiz_logs drop constraint if exists quiz_logs_correct_check;
alter table public.quiz_logs add constraint quiz_logs_correct_check check (correct >= 0 and correct <= 20);

create or replace view public.v_user_lifetime as
with inviter as (
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
  -- 하루 미션(5문제)을 마친 날만 퀴즈 30점 — 연습 모드만 푼 날(total = 0)은 세지 않는다.
  select user_code, quiz_date, 30, 0, 0 from public.quiz_logs where total > 0
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
  (select count(*) from public.quiz_logs q where q.user_code = u.code and q.total > 0)::int as quiz_days,
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
