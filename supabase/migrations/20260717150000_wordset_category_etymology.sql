-- 20260717150000_wordset_category_etymology.sql
-- shared_word_sets.category 에 'etymology' 허용 — 어원을 first-class 카테고리로 승격.
ALTER TABLE public.shared_word_sets DROP CONSTRAINT shared_word_sets_category_check;
ALTER TABLE public.shared_word_sets ADD CONSTRAINT shared_word_sets_category_check
  CHECK (category = ANY (ARRAY[
    'elementary','middle','high','csat','eng_test','civil','business',
    'themed','library_book','library_article','etymology'
  ]));
-- 발행된 어원 세트를 새 카테고리로 이동 (themed → etymology)
UPDATE public.shared_word_sets SET category='etymology' WHERE slug='etymology-core';
