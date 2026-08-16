-- 집계 기준을 "평가 건수"에서 "기관 수"로 바로잡는다.
--
-- yoyang_facilities 한 행은 기관이 아니라 **평가 한 건**이다.
-- 같은 기관(code)이 급여종류별로(2,930곳) 또는 평가 회차별로(3,588곳)
-- 여러 행을 갖는다. 전체 27,947행 = 기관 21,216곳.
--
-- 그런데 집계 함수가 count(*) 를 쓰고 있어서 화면에 "평가 대상 기관 27,947곳"
-- 처럼 나갔다. 같은 페이지 안에서 순위는 기관 단위(53곳 중 13위),
-- 등급 분포는 건수 단위(71곳 중 24곳)로 엇갈리기도 했다.
--
-- 여기서부터는 기관 단위로 통일한다. code 별로 가장 최근 평가 한 건만 골라
-- 세고 평균 낸다. 평가 건수 자체는 eval_count 로 따로 남긴다.

alter table public.yoyang_regions
  add column if not exists eval_count integer not null default 0;

alter table public.yoyang_national
  add column if not exists eval_count integer not null default 0;

comment on column public.yoyang_regions.facility_count is
  '기관 수 (code 기준 중복 제거)';
comment on column public.yoyang_regions.eval_count is
  '평가 건수 (급여종류·회차별 행 수)';

create or replace function public.refresh_yoyang_aggregates()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.yoyang_regions where true;

  with latest as (
    -- 기관마다 가장 최근 평가 한 건. 등급·점수는 이 행을 기준으로 삼는다.
    select distinct on (code) *
    from public.yoyang_facilities
    order by code, eval_date desc nulls last, id desc
  ), counts as (
    select region_slug, count(*) as eval_count
    from public.yoyang_facilities
    group by region_slug
  )
  insert into public.yoyang_regions (
    region_slug, sido, sigungu, facility_count, eval_count,
    grade_a, grade_b, grade_c, grade_d, grade_e,
    avg_total_score,
    avg_operation, avg_safety, avg_rights, avg_process, avg_result,
    count_2021, count_2025,
    avg_2025_operation, avg_2025_respect, avg_2025_service, avg_2025_result,
    latest_eval_date, oldest_eval_date, updated_at
  )
  select
    l.region_slug,
    min(l.sido),
    min(l.sigungu),
    count(*),
    max(c.eval_count),
    count(*) filter (where l.grade = 'A'),
    count(*) filter (where l.grade = 'B'),
    count(*) filter (where l.grade = 'C'),
    count(*) filter (where l.grade = 'D'),
    count(*) filter (where l.grade = 'E'),
    round(avg(l.total_score), 2),
    round(avg(l.score_operation), 2),
    round(avg(l.score_safety), 2),
    round(avg(l.score_rights), 2),
    round(avg(l.score_process), 2),
    round(avg(l.score_result), 2),
    count(*) filter (where l.eval_system = '2021'),
    count(*) filter (where l.eval_system = '2025'),
    round(avg(l.score_2025_operation), 2),
    round(avg(l.score_2025_respect), 2),
    round(avg(l.score_2025_service), 2),
    round(avg(l.score_2025_result), 2),
    max(l.eval_date),
    min(l.eval_date),
    now()
  from latest l
  join counts c on c.region_slug = l.region_slug
  group by l.region_slug;

  with latest as (
    select distinct on (code) *
    from public.yoyang_facilities
    order by code, eval_date desc nulls last, id desc
  )
  insert into public.yoyang_national (
    id, region_count, facility_count, eval_count,
    grade_a, grade_b, grade_c, grade_d, grade_e,
    avg_total_score,
    avg_operation, avg_safety, avg_rights, avg_process, avg_result,
    count_2021, count_2025,
    avg_2025_operation, avg_2025_respect, avg_2025_service, avg_2025_result,
    latest_eval_date, updated_at
  )
  select
    1,
    count(distinct region_slug),
    count(*),
    (select count(*) from public.yoyang_facilities),
    count(*) filter (where grade = 'A'),
    count(*) filter (where grade = 'B'),
    count(*) filter (where grade = 'C'),
    count(*) filter (where grade = 'D'),
    count(*) filter (where grade = 'E'),
    round(avg(total_score), 2),
    round(avg(score_operation), 2),
    round(avg(score_safety), 2),
    round(avg(score_rights), 2),
    round(avg(score_process), 2),
    round(avg(score_result), 2),
    count(*) filter (where eval_system = '2021'),
    count(*) filter (where eval_system = '2025'),
    round(avg(score_2025_operation), 2),
    round(avg(score_2025_respect), 2),
    round(avg(score_2025_service), 2),
    round(avg(score_2025_result), 2),
    max(eval_date),
    now()
  from latest
  on conflict (id) do update set
    region_count       = excluded.region_count,
    facility_count     = excluded.facility_count,
    eval_count         = excluded.eval_count,
    grade_a            = excluded.grade_a,
    grade_b            = excluded.grade_b,
    grade_c            = excluded.grade_c,
    grade_d            = excluded.grade_d,
    grade_e            = excluded.grade_e,
    avg_total_score    = excluded.avg_total_score,
    avg_operation      = excluded.avg_operation,
    avg_safety         = excluded.avg_safety,
    avg_rights         = excluded.avg_rights,
    avg_process        = excluded.avg_process,
    avg_result         = excluded.avg_result,
    count_2021         = excluded.count_2021,
    count_2025         = excluded.count_2025,
    avg_2025_operation = excluded.avg_2025_operation,
    avg_2025_respect   = excluded.avg_2025_respect,
    avg_2025_service   = excluded.avg_2025_service,
    avg_2025_result    = excluded.avg_2025_result,
    latest_eval_date   = excluded.latest_eval_date,
    updated_at         = excluded.updated_at;
end;
$$;
