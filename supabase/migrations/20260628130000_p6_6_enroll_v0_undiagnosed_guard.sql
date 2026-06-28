-- P6.6 — _enroll_book_subscribe_word_sets: V0(미진단) effective V-level 가드
--
-- 배경: current_v_level = 0 은 "진단 미완료" 기본값(메모리: V-Level 0 사실상 empty,
--       진단 시드는 V1 부터 시작). 기존 COALESCE 는 NULL 만 fallback 해 0 을 유효 앵커로
--       사용 → i+1 밴드가 GREATEST(0-1,1)..LEAST(0+1,11) = [1,1] 로 붕괴 →
--       책 구독 시 V1 단어만 import (라이브러리 도서 어휘 V6~V11 전량 배제).
-- 수정: NULLIF(current_v_level, 0) 로 V0 을 미진단 취급 → book_v_level → 5 fallback.
-- F(소급): F3 정리는 V0/NULL 미진단 사용자 제외(사용자 결정 2026-06-28) → 현재 삭제 0 건.
--           본 가드는 향후 enroll 정합만 확보(기존 vocab 무손실).
-- 롤백: docs/AI_CONTEXT/rollback/P6_6_enroll_v0_guard_원본.sql

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
  -- V0 = 미진단 → NULLIF 로 fallback 으로 흘려보냄 (P6.6)
  SELECT COALESCE(
    NULLIF((SELECT current_v_level FROM user_profiles WHERE user_id = p_user_id), 0),
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
