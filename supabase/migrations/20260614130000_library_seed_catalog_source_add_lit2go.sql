-- supabase/migrations/20260614130000_library_seed_catalog_source_add_lit2go.sql
-- v06.43 — library_seed_catalog.source CHECK 제약에 'lit2go' 추가
--
-- 배경: 20260614120000 이 library_books.source 만 확장하고, 대량 GET seed 가 들어가는
--   library_seed_catalog.source CHECK (별도 제약) 는 누락 → Lit2Go bulk fetch enqueue 시
--   "violates check constraint library_seed_catalog_source_check" 로 삽입 실패.
--
-- seed_catalog 는 fetchable 소스만 담는다 (현재 fetcher 6종 + lit2go).
-- 영향: 확장만 (축소 X) — 기존 행 모두 valid.

BEGIN;

ALTER TABLE library_seed_catalog DROP CONSTRAINT IF EXISTS library_seed_catalog_source_check;

ALTER TABLE library_seed_catalog ADD CONSTRAINT library_seed_catalog_source_check
  CHECK (source IN (
    'gutenberg',
    'standard_ebooks',
    'wikibooks',
    'librivox',
    'openstax',
    'simple_wikipedia',
    'lit2go'             -- v06.43 신규 (USF K-12 학습 라이브러리)
  ));

COMMIT;

-- 검증 쿼리 (적용 후):
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
-- WHERE conname = 'library_seed_catalog_source_check';
