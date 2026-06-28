-- 롤백 baseline — _enroll_book_subscribe_word_sets P6.1 적용 전 원본
-- 복구: 이 파일 전체를 실행하면 i+1 필터/cap 도입 이전 동작으로 되돌림.
-- (P6.1 = 20260628120000_p6_enroll_subscribe_i_plus_one)

CREATE OR REPLACE FUNCTION public._enroll_book_subscribe_word_sets(p_user_id uuid, p_book_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  INSERT INTO user_word_set_subscriptions (user_id, set_id)
  SELECT p_user_id, sws.id
    FROM shared_word_sets sws
   WHERE sws.is_published = true
     AND sws.category = 'library_book'
     AND sws.curation_query->>'book_id' = p_book_id::text
  ON CONFLICT (user_id, set_id) DO NOTHING;

  INSERT INTO vocabularies (
    user_id, word, meaning, example_sentence,
    pronunciation, pos, cefr_level,
    origin, shared_set_id
  )
  SELECT
    p_user_id,
    sw.word,
    sw.meaning_ko,
    sw.example_en,
    sw.pronunciation,
    sw.part_of_speech,
    sw.cefr_level,
    'shared_set',
    sw.set_id
  FROM shared_words sw
   JOIN shared_word_sets sws ON sws.id = sw.set_id
  WHERE sws.is_published = true
    AND sws.category = 'library_book'
    AND sws.curation_query->>'book_id' = p_book_id::text
  ON CONFLICT (user_id, word) DO NOTHING;
END $function$;
