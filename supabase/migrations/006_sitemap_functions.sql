-- 사이트맵용 기관 URL 조회
--
-- yoyang_facilities 한 행은 기관이 아니라 평가 한 건이라, 그대로 읽으면
-- 27,947행에서 같은 URL 이 여러 번 나온다. 실제 URL 은 21,216개다.
--
-- 사이트맵을 여러 파일로 쪼개려면 "중복을 걷어낸 목록"을 페이지 단위로 잘라
-- 읽어야 한다. 행 오프셋으로 자르면 같은 기관이 두 파일에 걸쳐 들어간다.
-- 그래서 group by 로 먼저 줄인 뒤 offset/limit 을 건다.

create or replace function public.yoyang_facility_urls(
  p_offset integer,
  p_limit  integer
)
returns table (region_slug text, slug text, last_modified date)
language sql
stable
security definer
set search_path = public
as $$
  select f.region_slug, f.slug, max(f.eval_date) as last_modified
  from public.yoyang_facilities f
  where f.slug is not null
  group by f.region_slug, f.slug
  order by f.region_slug, f.slug
  offset p_offset
  limit p_limit;
$$;

comment on function public.yoyang_facility_urls(integer, integer) is
  '사이트맵용 기관 URL. 중복을 걷어낸 목록을 페이지 단위로 돌려준다';

create or replace function public.yoyang_facility_url_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from (
    select 1
    from public.yoyang_facilities
    where slug is not null
    group by region_slug, slug
  ) t;
$$;

comment on function public.yoyang_facility_url_count() is
  '사이트맵 파일 수를 정하기 위한 기관 URL 총 개수';
