-- 20260709135526_shared_words_chapter_column.sql
-- 공용단어장 내부 챕터 구성: shared_words 에 chapter 컬럼 추가.
--   하나의 공용단어장(shared_word_sets 1행)을 여러 챕터로 "내부 구성" — 챕터별로 세트를 나눠 발행하지 않는다.
--   chapter=1..N (세트 내 챕터 번호), NULL=미분할(단일). 정렬은 기존 sort_order(전역) 유지.

ALTER TABLE public.shared_words ADD COLUMN IF NOT EXISTS chapter smallint;

COMMENT ON COLUMN public.shared_words.chapter IS
  '세트 내 챕터 번호(1..N). NULL=미분할. 하나의 공용단어장을 여러 챕터로 내부 구성(챕터별 발행 아님).';

CREATE INDEX IF NOT EXISTS idx_shared_words_set_chapter
  ON public.shared_words(set_id, chapter, sort_order);
