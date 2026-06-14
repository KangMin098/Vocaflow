-- v06.56 — shared_word_sets_category_check 에 'library_article' 추가.
--
-- v06.52 가 publish_article_word_set 를 추가하면서 category='library_article' 로
-- INSERT 하는데, 기존 CHECK constraint 가 그 값을 허용 안 함 → INSERT 시
-- "new row for relation shared_word_sets violates check constraint
--  shared_word_sets_category_check" 오류. /admin/articles list 에서 게시 시 alert 으로
-- 노출됨. constraint 갱신으로 article 단어장 자동 발행 정상화.

ALTER TABLE public.shared_word_sets
  DROP CONSTRAINT IF EXISTS shared_word_sets_category_check;

ALTER TABLE public.shared_word_sets
  ADD CONSTRAINT shared_word_sets_category_check CHECK (
    category = ANY (ARRAY[
      'elementary', 'middle', 'high', 'csat', 'eng_test',
      'civil', 'business', 'themed', 'library_book',
      'library_article'
    ]::text[])
  );
