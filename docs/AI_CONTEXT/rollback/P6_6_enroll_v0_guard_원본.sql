-- 롤백: P6.6 V0 가드 적용 전 원본 (P6.1, 20260628120000)
-- current_v_level 을 NULLIF 없이 그대로 COALESCE 하던 버전.
-- 복원하려면 아래 함수 정의를 그대로 apply.

CREATE OR REPLACE FUNCTION public._enroll_book_subscribe_word_sets(p_user_id uuid, p_book_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_n integer;
BEGIN
  INSERT INTO user_word_set_subscriptions (user_id, set_id)
  SELECT p_user_id, sws.id
    FROM shared_word_sets sws
   WHERE sws.is_published = true
     AND sws.category = 'library_book'
     AND sws.curation_query->>'book_id' = p_book_id::text
  ON CONFLICT (user_id, set_id) DO NOTHING;

  SELECT COALESCE(
    (SELECT current_v_level FROM user_profiles WHERE user_id = p_user_id),
    (SELECT book_v_level    FROM library_books WHERE id = p_book_id),
    5
  ) INTO v_n;

  WITH ranked AS (
    SELECT DISTINCT ON (sw.word)
      sw.word, sw.meaning_ko, sw.example_en, sw.pronunciation,
      sw.part_of_speech, sw.cefr_level, sw.set_id,
      sd.v_level, sd.frequency_rank
    FROM shared_words sw
     JOIN shared_word_sets sws ON sws.id = sw.set_id
     LEFT JOIN shared_dictionary sd ON sd.word = sw.word
    WHERE sws.is_published = true
      AND sws.category = 'library_book'
      AND sws.curation_query->>'book_id' = p_book_id::text
      AND (sd.v_level IS NULL
           OR sd.v_level BETWEEN GREATEST(v_n - 1, 1) AND LEAST(v_n + 1, 11))
      AND NOT EXISTS (
            SELECT 1 FROM vocabularies v
             WHERE v.user_id = p_user_id AND v.word = sw.word)
    ORDER BY sw.word, sd.frequency_rank ASC NULLS LAST
  )
  INSERT INTO vocabularies (
    user_id, word, meaning, example_sentence,
    pronunciation, pos, cefr_level, origin, shared_set_id
  )
  SELECT p_user_id, word, meaning_ko, example_en, pronunciation,
         part_of_speech, cefr_level, 'shared_set', set_id
  FROM ranked
  ORDER BY abs(COALESCE(v_level, v_n) - v_n) ASC,
           frequency_rank ASC NULLS LAST
  LIMIT 50
  ON CONFLICT (user_id, word) DO NOTHING;
END $function$;
