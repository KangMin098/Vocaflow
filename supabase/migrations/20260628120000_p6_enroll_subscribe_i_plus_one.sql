-- P6.1 — _enroll_book_subscribe_word_sets: 구독 시점 i+1 필터 + dedup + 세션 cap
--
-- 배경: 책 구독 시 vocabularies 가 사용자 V-level 무관하게 일괄 import 되어
--       i+1(Krashen)·Desirable Difficulty 위배 + 너무 어려운/이미 아는 단어 압도.
-- 결정(handoff p6_subscribe_user_filter): E1 3-band i+1 · E2 book_v_level fallback ·
--   E4 cap 50 · E5 기본 V5 · E7 UNIQUE(user_id,word) 존재(ON CONFLICT) ·
--   E8 완전분리(vocab INSERT 단 필터) · F0 소급 보류(신규 enroll 만 적용).
-- 구독(set-level)은 불변 — 책 전체 챕터 단어장은 그대로 구독. vocabularies import 만 필터.
-- 롤백: docs/AI_CONTEXT/rollback/P6_enroll_subscribe_원본.sql

CREATE OR REPLACE FUNCTION public._enroll_book_subscribe_word_sets(p_user_id uuid, p_book_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_n integer;
BEGIN
  -- 구독: 책의 모든 챕터 단어장 (V-level 무관, 기존 동일)
  INSERT INTO user_word_set_subscriptions (user_id, set_id)
  SELECT p_user_id, sws.id
    FROM shared_word_sets sws
   WHERE sws.is_published = true
     AND sws.category = 'library_book'
     AND sws.curation_query->>'book_id' = p_book_id::text
  ON CONFLICT (user_id, set_id) DO NOTHING;

  -- 사용자 effective V-level (E1 current → E2 book_v_level → E5 기본 5)
  SELECT COALESCE(
    (SELECT current_v_level FROM user_profiles WHERE user_id = p_user_id),
    (SELECT book_v_level    FROM library_books WHERE id = p_book_id),
    5
  ) INTO v_n;

  -- vocabularies: i+1(E1) + 미보유만(E7/E8) + 단어당 1행 + 근접·고빈도 우선 + cap 50(E4)
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
           OR sd.v_level BETWEEN GREATEST(v_n - 1, 1) AND LEAST(v_n + 1, 11))   -- E1 i+1
      AND NOT EXISTS (                                                          -- E7/E8 미보유만
            SELECT 1 FROM vocabularies v
             WHERE v.user_id = p_user_id AND v.word = sw.word)
    ORDER BY sw.word, sd.frequency_rank ASC NULLS LAST       -- 단어당 고빈도 인스턴스 선택
  )
  INSERT INTO vocabularies (
    user_id, word, meaning, example_sentence,
    pronunciation, pos, cefr_level, origin, shared_set_id
  )
  SELECT p_user_id, word, meaning_ko, example_en, pronunciation,
         part_of_speech, cefr_level, 'shared_set', set_id
  FROM ranked
  ORDER BY abs(COALESCE(v_level, v_n) - v_n) ASC,            -- 사용자 레벨 근접 우선
           frequency_rank ASC NULLS LAST
  LIMIT 50                                                   -- E4 세션 cap
  ON CONFLICT (user_id, word) DO NOTHING;                    -- race 안전
END $function$;
