-- 가이드 카테고리에서 '재가' 를 뺀다.
--
-- 카테고리를 셋(등급·비용·시설)으로 줄인다. 이미 '재가' 로 들어가 있던 글은
-- 지우지 않고 '시설' 로 옮긴다. 집에서 받을지 시설로 갈지는 결국 같은
-- "어떤 서비스를 고를까" 주제라서다.
--
-- 순서가 중요하다. 제약을 먼저 바꾸면 남아 있는 '재가' 행 때문에 실패한다.

update public.yoyang_contents
   set category = '시설'
 where category = '재가';

alter table public.yoyang_contents
  drop constraint if exists yoyang_contents_category_check;

alter table public.yoyang_contents
  add constraint yoyang_contents_category_check
  check (category in ('등급', '비용', '시설'));
