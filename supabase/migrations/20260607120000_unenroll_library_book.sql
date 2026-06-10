-- supabase/migrations/20260607120000_unenroll_library_book.sql
-- ═══════════════════════════════════════════════════════════
-- v06.34 — 도서 학습 제외 (unenroll)
--
-- enroll_library_book 의 역동작:
--   (1) 사용자의 모든 chapter texts DELETE (library_book_id 매칭)
--   (2) chapter shared_word_sets 구독 일괄 해지
--   (3) origin='shared_set' + shared_set_id 매칭 vocabularies DELETE
--
-- vocabularies 보존 정책 — `unsubscribeSet` (vocab/actions.ts) 과 다른 점:
--   single 단어장은 사용자가 자기 학습 단어를 다른 단어장에서도 만날 수 있으므로 보존.
--   도서 단위 unenroll 은 사용자 명시적 "이 도서 빼기" 의지 — chapter sets 도 같이.
--   다만 사용자가 manual edit 한 vocab (origin != 'shared_set') 은 보존.
--
-- 멱등: 이미 unenrolled 면 0건 반환. 안전.
-- ═══════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION unenroll_library_book(p_book_id UUID)
RETURNS TABLE(texts_deleted INT, subs_deleted INT, vocabs_deleted INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID;
  v_texts_n INT := 0;
  v_subs_n INT := 0;
  v_vocabs_n INT := 0;
  v_set_ids UUID[];
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 그 도서의 chapter shared_word_sets id 미리 수집
  SELECT array_agg(sws.id) INTO v_set_ids
    FROM shared_word_sets sws
   WHERE sws.is_published = true
     AND sws.category = 'library_book'
     AND sws.curation_query->>'book_id' = p_book_id::text;

  -- (1) texts DELETE — 그 사용자의 그 도서 모든 chapter rows
  WITH d AS (
    DELETE FROM texts
     WHERE user_id = v_user_id
       AND library_book_id = p_book_id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_texts_n FROM d;

  -- (2) chapter sets 구독 해지
  IF v_set_ids IS NOT NULL AND array_length(v_set_ids, 1) > 0 THEN
    WITH d AS (
      DELETE FROM user_word_set_subscriptions
       WHERE user_id = v_user_id
         AND set_id = ANY(v_set_ids)
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_subs_n FROM d;

    -- (3) 그 sets 에서 import 된 vocabularies DELETE (origin='shared_set' + shared_set_id 매칭)
    --     사용자가 직접 추가/수정한 단어 (origin != 'shared_set') 는 보존.
    WITH d AS (
      DELETE FROM vocabularies
       WHERE user_id = v_user_id
         AND origin = 'shared_set'
         AND shared_set_id = ANY(v_set_ids)
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_vocabs_n FROM d;
  END IF;

  texts_deleted := v_texts_n;
  subs_deleted := v_subs_n;
  vocabs_deleted := v_vocabs_n;
  RETURN NEXT;
END $$;

REVOKE ALL ON FUNCTION unenroll_library_book(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION unenroll_library_book(UUID) TO authenticated;

COMMENT ON FUNCTION unenroll_library_book(UUID) IS
  'v06.34 — 도서 학습 제외 (enroll 역동작). texts + chapter sets 구독 + shared_set vocab 일괄 삭제. 사용자 직접 수정 vocab 보존. 멱등.';

COMMIT;
