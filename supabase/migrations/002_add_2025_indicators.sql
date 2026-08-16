-- 2025년 평가분 대응 + 일반구 통합
--
-- 실제 오픈API 응답(15104801, uddi:894abcb2…, 27,947건)을 확인한 결과
-- 영역별 지표가 두 체계로 나뉘어 **별도 컬럼**으로 내려온다.
--
--   2021·2023·2024년 정기평가 (22,541건) — 5개 영역
--     기관운영 / 환경및안전 / 수급자권리보장 / 급여제공과정 / 급여제공결과
--   2025년 정기평가 (5,406건) — 4개 영역
--     기관운영(2025) / 수급자존중(2025) / 서비스제공(2025) / 서비스결과(2025)
--
-- 두 체계는 서로 배타적이다(한쪽이 채워지면 다른 쪽은 전부 null).
-- **섞어서 평균 내면 안 된다.** 그래서 컬럼을 나누고 eval_system 으로 구분한다.
--
-- 평가총점은 양쪽 다 100점 척도라(2021~2024 평균 80.94, 2025 평균 83.49)
-- 지역 대표값으로는 함께 평균한다.

/* ---------------------------- 기관 테이블 ---------------------------- */

alter table public.yoyang_facilities
  -- 2025년 체계 영역 점수
  add column if not exists score_2025_operation numeric(5, 2),
  add column if not exists score_2025_respect   numeric(5, 2),
  add column if not exists score_2025_service   numeric(5, 2),
  add column if not exists score_2025_result    numeric(5, 2),
  -- 영역 지표 체계. '2021' = 5개 영역, '2025' = 4개 영역
  add column if not exists eval_system text,
  -- 평가구분에서 뽑은 회차 연도. 평가일자(실제 방문일)와 다를 수 있다
  -- (예: 2021년 정기평가인데 평가일자가 2022-06-14)
  add column if not exists eval_round smallint,
  -- 일반구를 시로 합쳤을 때 원래 구 이름. 예: '분당구', '마산합포구'
  add column if not exists sigungu_detail text;

comment on column public.yoyang_facilities.eval_system is
  '영역 지표 체계. 2021=5개 영역(기관운영/환경및안전/수급자권리보장/급여제공과정/급여제공결과), 2025=4개 영역(기관운영/수급자존중/서비스제공/서비스결과)';
comment on column public.yoyang_facilities.eval_round is
  '평가구분에서 뽑은 회차 연도(2021/2023/2024/2025). 평가일자와 다를 수 있다';
comment on column public.yoyang_facilities.sigungu_detail is
  '일반구를 시로 합치기 전의 구 이름. 없으면 null (data/regions.json 참고)';

create index if not exists yoyang_facilities_system_idx
  on public.yoyang_facilities (region_slug, eval_system);

/* ---------------------------- 집계 테이블 ---------------------------- */

alter table public.yoyang_regions
  add column if not exists count_2021 integer not null default 0,
  add column if not exists count_2025 integer not null default 0,
  add column if not exists avg_2025_operation numeric(5, 2),
  add column if not exists avg_2025_respect   numeric(5, 2),
  add column if not exists avg_2025_service   numeric(5, 2),
  add column if not exists avg_2025_result    numeric(5, 2);

alter table public.yoyang_national
  add column if not exists count_2021 integer not null default 0,
  add column if not exists count_2025 integer not null default 0,
  add column if not exists avg_2025_operation numeric(5, 2),
  add column if not exists avg_2025_respect   numeric(5, 2),
  add column if not exists avg_2025_service   numeric(5, 2),
  add column if not exists avg_2025_result    numeric(5, 2);

/* ------------------------- 집계 다시 만들기 ------------------------- */

create or replace function public.refresh_yoyang_aggregates()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- `where true` 를 반드시 붙인다. Supabase 는 pg_safeupdate 가 켜져 있어
  -- WHERE 절 없는 DELETE 를 "DELETE requires a WHERE clause" 로 거절한다.
  delete from public.yoyang_regions where true;

  insert into public.yoyang_regions (
    region_slug, sido, sigungu, facility_count,
    grade_a, grade_b, grade_c, grade_d, grade_e,
    avg_total_score,
    avg_operation, avg_safety, avg_rights, avg_process, avg_result,
    count_2021, count_2025,
    avg_2025_operation, avg_2025_respect, avg_2025_service, avg_2025_result,
    latest_eval_date, oldest_eval_date, updated_at
  )
  select
    region_slug,
    min(sido),
    min(sigungu),
    count(*),
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
    min(eval_date),
    now()
  from public.yoyang_facilities
  group by region_slug;

  insert into public.yoyang_national (
    id, region_count, facility_count,
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
  from public.yoyang_facilities
  on conflict (id) do update set
    region_count       = excluded.region_count,
    facility_count     = excluded.facility_count,
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
