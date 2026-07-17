-- CTP DCP — csat_dcp_items.kind 를 csat_stage_catalog(article/book)와 정합 (S4 도서 DCP 허용).
-- 적용 완료(2026-07-12). 로컬 기록 파일(원격 apply_migration 서버 타임스탬프와 별개).
--
-- 발견: catalog 뷰·prescribe_today 조인(c.kind=i.kind)은 도서를 kind='book' 으로 쓰나
--   csat_dcp_items.kind CHECK 는 ('article','chapter')였음 → book DCP 문항 삽입/조인 불가(S4 practice 구조적 공백).
-- 수정: 'book' 추가(catalog 정합). 'chapter'(미사용·0행) 보존. additive · 기존 데이터 무영향.

ALTER TABLE public.csat_dcp_items DROP CONSTRAINT csat_dcp_items_kind_check;
ALTER TABLE public.csat_dcp_items
  ADD CONSTRAINT csat_dcp_items_kind_check
  CHECK (kind = ANY (ARRAY['article'::text, 'chapter'::text, 'book'::text]));
