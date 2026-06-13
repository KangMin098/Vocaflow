-- supabase/migrations/20260614120000_library_source_check_add_lit2go.sql
-- v06.43 — library_books.source CHECK 제약 확장
--
-- 변경:
--   1. 기존 누락 소스 정상화 (simple_wikipedia, openstax) — 코드에서 사용 중인데 CHECK 부재
--   2. lit2go 추가 — USF K-12 학습 라이브러리 (v06.43 신규)
--
-- 영향: library_books INSERT 시 source='lit2go' (or simple_wikipedia/openstax) 허용.
-- 기존 데이터는 모두 valid (확장만 함, 축소 X).

BEGIN;

ALTER TABLE library_books DROP CONSTRAINT IF EXISTS library_books_source_check;

ALTER TABLE library_books ADD CONSTRAINT library_books_source_check
  CHECK (source IN (
    'gutenberg',
    'standard_ebooks',
    'wikisource',
    'wikibooks',
    'simple_wikipedia',  -- 코드에서 사용 중이나 CHECK 누락 (정상화)
    'openstax',          -- 코드에서 사용 중이나 CHECK 누락 (정상화)
    'open_library',
    'hathitrust',
    'voa_learning',
    'librivox',
    'lit2go',            -- v06.43 신규 (USF K-12 학습 라이브러리)
    'manual'
  ));

COMMIT;

-- 검증 쿼리 (적용 후 실행 권장):
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conname = 'library_books_source_check';
