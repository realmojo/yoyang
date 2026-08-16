-- 기관 상세 페이지용 슬러그
--
-- URL 은 지역 아래 한 단계로 붙인다.
--   /경기-성남시/실버릿지판교-21113000123
--
-- 슬러그 뒤에 장기요양기관기호(하이픈 제거)를 항상 붙인다. 이유가 두 가지다.
--
--   1) 이름만으로는 겹친다. 같은 시군구 안에서 이름이 같은 기관이
--      266쌍(535곳) 있다.
--   2) 기호를 빼고 "겹칠 때만 붙이는" 방식은 불안정하다. 나중에 같은 이름의
--      기관이 하나 더 생기면 이미 색인된 URL 이 바뀌어 버린다.
--
-- 기호가 뒤에 붙어 있으므로, 이름이 바뀌어 슬러그가 달라져도 뒤 숫자만 읽어
-- 기관을 찾을 수 있다. (lib/facility.ts 의 codeFromSlug 참고)

alter table public.yoyang_facilities
  add column if not exists slug text;

comment on column public.yoyang_facilities.slug is
  '기관 상세 URL. /{region_slug}/{slug} 로 열린다. 형식: {이름}-{기관기호 숫자}';

-- 같은 기관(code)의 여러 행은 같은 슬러그를 갖는다. 그래서 unique 가 아니라
-- 조회용 인덱스다. 실제 유일성은 슬러그 끝의 기관기호가 보장한다.
create index if not exists yoyang_facilities_slug_idx
  on public.yoyang_facilities (region_slug, slug);
