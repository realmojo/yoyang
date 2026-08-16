-- yoyang.keywordegg.com 기본 테이블
--
--   yoyang_facilities : 장기요양기관 평가 결과 원본 (공공데이터포털 15104801)
--   yoyang_regions    : 시군구 집계. 허브 목록과 전국 평균 비교에 쓴다
--   yoyang_national   : 전국 집계 한 줄
--   yoyang_contents   : 전국 공통 가이드 글 (사람이 쓴 글)
--
-- 집계 두 개는 매 요청 계산할 수 없어(원본 3만 건 수준) 적재 후
-- refresh_yoyang_aggregates() 로 한 번에 다시 만든다.

/* ---------------------------- 기관 평가 결과 ---------------------------- */

create table if not exists public.yoyang_facilities (
  id              bigserial primary key,
  -- 장기요양기관기호. 같은 기관이 급여종류·평가회차별로 여러 행일 수 있다
  code            text        not null,
  name            text        not null,
  service_type    text,                    -- 급여종류
  founder         text,                    -- 설립주체
  sido            text        not null,    -- 시도 짧은 이름. 예: 서울
  sigungu         text        not null,    -- 시군구. 예: 강남구, 성남시분당구
  region_slug     text        not null,    -- lib/regions.ts 의 regionSlug() 결과
  eval_type       text,                    -- 평가구분
  eval_date       date,                    -- 평가일자 (화면에 반드시 노출한다)
  eval_year       integer,
  grade           text,                    -- A~E. 미평가는 null
  total_score     numeric(5, 2),
  score_operation numeric(5, 2),           -- 기관운영
  score_safety    numeric(5, 2),           -- 환경및안전
  score_rights    numeric(5, 2),           -- 수급자권리보장
  score_process   numeric(5, 2),           -- 급여제공과정
  score_result    numeric(5, 2),           -- 급여제공결과
  created_at      timestamptz not null default now(),
  constraint yoyang_facilities_grade_check
    check (grade is null or grade in ('A', 'B', 'C', 'D', 'E'))
);

comment on table public.yoyang_facilities is
  '장기요양기관 평가 결과 (공공데이터포털 15104801, 국민건강보험공단)';
comment on column public.yoyang_facilities.eval_date is
  '평가일자. 정기평가가 급여종류별 3년 주기라 몇 년 전인 경우가 많다';
comment on column public.yoyang_facilities.region_slug is
  'URL 슬러그. lib/regions.ts 의 regionSlug(sido, sigungu) 와 같은 규칙';

-- 같은 기관·급여종류·평가일자가 중복 적재되지 않게 한다.
-- 적재 스크립트는 이 키로 upsert 한다.
--
-- nulls not distinct 가 핵심이다. 기본값(nulls distinct)이면 급여종류나
-- 평가일자가 비어 있는 행끼리는 서로 충돌하지 않아, 다시 적재할 때마다
-- 같은 행이 계속 쌓인다.
create unique index if not exists yoyang_facilities_key
  on public.yoyang_facilities (code, service_type, eval_date)
  nulls not distinct;

create index if not exists yoyang_facilities_region_idx
  on public.yoyang_facilities (region_slug, grade, total_score desc);

create index if not exists yoyang_facilities_sido_idx
  on public.yoyang_facilities (sido);

/* ------------------------------ 시군구 집계 ------------------------------ */

create table if not exists public.yoyang_regions (
  region_slug      text primary key,
  sido             text        not null,
  sigungu          text        not null,
  facility_count   integer     not null default 0,
  grade_a          integer     not null default 0,
  grade_b          integer     not null default 0,
  grade_c          integer     not null default 0,
  grade_d          integer     not null default 0,
  grade_e          integer     not null default 0,
  avg_total_score  numeric(5, 2),
  avg_operation    numeric(5, 2),
  avg_safety       numeric(5, 2),
  avg_rights       numeric(5, 2),
  avg_process      numeric(5, 2),
  avg_result       numeric(5, 2),
  latest_eval_date date,
  oldest_eval_date date,
  updated_at       timestamptz not null default now()
);

comment on table public.yoyang_regions is
  '시군구별 평가 집계. refresh_yoyang_aggregates() 로 다시 만든다';

/* ------------------------------- 전국 집계 ------------------------------- */

create table if not exists public.yoyang_national (
  id               integer primary key default 1,
  region_count     integer     not null default 0,
  facility_count   integer     not null default 0,
  grade_a          integer     not null default 0,
  grade_b          integer     not null default 0,
  grade_c          integer     not null default 0,
  grade_d          integer     not null default 0,
  grade_e          integer     not null default 0,
  avg_total_score  numeric(5, 2),
  avg_operation    numeric(5, 2),
  avg_safety       numeric(5, 2),
  avg_rights       numeric(5, 2),
  avg_process      numeric(5, 2),
  avg_result       numeric(5, 2),
  latest_eval_date date,
  updated_at       timestamptz not null default now(),
  constraint yoyang_national_single_row check (id = 1)
);

comment on table public.yoyang_national is '전국 평가 집계 (항상 한 행)';

/* ----------------------------- 집계 다시 만들기 ----------------------------- */

create or replace function public.refresh_yoyang_aggregates()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 시군구 집계
  -- `where true` 를 반드시 붙인다. Supabase 는 pg_safeupdate 가 켜져 있어
  -- WHERE 절 없는 DELETE 를 "DELETE requires a WHERE clause" 로 거절한다.
  delete from public.yoyang_regions where true;

  insert into public.yoyang_regions (
    region_slug, sido, sigungu, facility_count,
    grade_a, grade_b, grade_c, grade_d, grade_e,
    avg_total_score, avg_operation, avg_safety,
    avg_rights, avg_process, avg_result,
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
    max(eval_date),
    min(eval_date),
    now()
  from public.yoyang_facilities
  group by region_slug;

  -- 전국 집계
  insert into public.yoyang_national (
    id, region_count, facility_count,
    grade_a, grade_b, grade_c, grade_d, grade_e,
    avg_total_score, avg_operation, avg_safety,
    avg_rights, avg_process, avg_result,
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
    max(eval_date),
    now()
  from public.yoyang_facilities
  on conflict (id) do update set
    region_count     = excluded.region_count,
    facility_count   = excluded.facility_count,
    grade_a          = excluded.grade_a,
    grade_b          = excluded.grade_b,
    grade_c          = excluded.grade_c,
    grade_d          = excluded.grade_d,
    grade_e          = excluded.grade_e,
    avg_total_score  = excluded.avg_total_score,
    avg_operation    = excluded.avg_operation,
    avg_safety       = excluded.avg_safety,
    avg_rights       = excluded.avg_rights,
    avg_process      = excluded.avg_process,
    avg_result       = excluded.avg_result,
    latest_eval_date = excluded.latest_eval_date,
    updated_at       = excluded.updated_at;
end;
$$;

comment on function public.refresh_yoyang_aggregates() is
  'yoyang_facilities 를 읽어 yoyang_regions / yoyang_national 을 다시 만든다';

/* ------------------------------ 가이드 글 ------------------------------ */

create table if not exists public.yoyang_contents (
  id         bigserial primary key,
  slug       text        not null,
  category   text        not null,
  title      text        not null,
  excerpt    text,
  content    text        not null,
  thumbnail  text,
  tags       text[]      not null default '{}',
  views      integer     not null default 0,
  cta_text   text,
  cta_url    text,
  faq        jsonb       not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint yoyang_contents_category_check
    check (category in ('등급', '비용', '시설', '재가'))
);

comment on table public.yoyang_contents is '전국 공통 가이드 글';
comment on column public.yoyang_contents.slug is
  'URL 경로. /{slug} 로 열린다. 지역·카테고리 슬러그와 겹치면 안 된다';
comment on column public.yoyang_contents.faq is
  '자주 묻는 질문 [{"q":"질문","a":"답변"}] 형식';

create unique index if not exists yoyang_contents_slug_key
  on public.yoyang_contents (slug);

create index if not exists yoyang_contents_category_idx
  on public.yoyang_contents (category, created_at desc);

create index if not exists yoyang_contents_created_idx
  on public.yoyang_contents (created_at desc);

create or replace function public.increment_yoyang_content_view(content_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update public.yoyang_contents
     set views = views + 1
   where id = content_id;
$$;

/* -------------------------------- 접근 제어 -------------------------------- */

-- 서비스 롤 키를 쓰는 서버 컴포넌트만 접근한다 (RLS 를 켜고 정책은 두지 않는다)
alter table public.yoyang_facilities enable row level security;
alter table public.yoyang_regions    enable row level security;
alter table public.yoyang_national   enable row level security;
alter table public.yoyang_contents   enable row level security;
