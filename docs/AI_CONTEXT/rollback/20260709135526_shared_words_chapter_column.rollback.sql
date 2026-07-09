-- 롤백: 20260709135526_shared_words_chapter_column
-- shared_words.chapter 컬럼 + 인덱스 제거. (chapter 값이 채워진 세트가 있으면 데이터 손실 — 사전 확인)

DROP INDEX IF EXISTS public.idx_shared_words_set_chapter;
ALTER TABLE public.shared_words DROP COLUMN IF EXISTS chapter;
