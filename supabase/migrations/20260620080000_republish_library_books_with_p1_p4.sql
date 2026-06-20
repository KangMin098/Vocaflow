-- 20260620080000_republish_library_books_with_p1_p4.sql
-- ═══════════════════════════════════════════════════════════
-- P1~P4 누적 효과를 기존 published 책에 적용 (v06.82)
--
-- 배경:
--   P1 (게이트 디커플) ~ P4 (단일 코어 통합) 까지 함수만 수정.
--   기존 259 published 단어장은 옛 selection (v06.35 / v06.51) 마커 유지 → 효과 미반영.
--
-- 변경:
--   기존 published library_book 단어장을 DELETE 후 재발행.
--   publish_book_word_sets(book_id, 40) — cap=40 + P1~P4 모두 적용.
--   사용자 재구독 (vocabularies + subscriptions 자동 import).
--
-- IDEMPOTENT 보장:
--   curation_query.selection 에 'P3' 마커 없는 sets 만 대상.
--   이미 P3 적용된 sets 가 있으면 skip — 두 번 실행해도 안전.
--
-- 사용자 진도 정책 (옵션 A 변종):
--   기존 진도 (review_count=0 / fsrs=0) 측정 시점에 없음 → reset 비용 0.
--   진도가 있는 환경에서는 본 migration 적용 전 사용자 진도 백업/이전 RPC 별도 작성 필요.
--
-- 실측 효과 (dev 환경 적용 후):
--   · 259 sets 전부 word_count <= 40 (max 239 → 40, p90 57 → 40)
--   · vocabularies 4,363 → 4,862 (+499 · V6~V8 학습밴드 복원)
--   · avg word_count 28.8 → 30.9 / p50 21 → 36 (단어 풍부도 +71%)
--   · 사용자 1명 자동 재구독 (subscriptions 259 / orphan 0 신규)
--
-- 주의 (production 적용 시):
--   본 DO 블록의 사용자 iteration 은 1명 가정.
--   다수 사용자 환경에서는 _enroll_book_subscribe_word_sets 호출을
--   `FOR v_user IN (SELECT DISTINCT user_id FROM user_word_set_subscriptions ...) LOOP` 으로 확장 필요.
-- ═══════════════════════════════════════════════════════════

DO $$
DECLARE
  v_user_id uuid;
  v_book RECORD;
  v_chapters int;
BEGIN
  -- 옛 selection 마커가 있는 sets 가 하나라도 있을 때만 실행 (idempotent)
  IF NOT EXISTS (
    SELECT 1 FROM shared_word_sets
    WHERE category='library_book'
      AND (curation_query->>'selection') NOT LIKE '%P3%'
  ) THEN
    RAISE NOTICE 'Skipping — all sets already on P1~P4 selection';
    RETURN;
  END IF;

  -- 사용자 id 추출 (DELETE 전 — CASCADE 로 subscriptions 사라지기 전)
  SELECT DISTINCT user_id INTO v_user_id
  FROM user_word_set_subscriptions
  WHERE set_id IN (SELECT id FROM shared_word_sets WHERE category='library_book')
  LIMIT 1;
  RAISE NOTICE 'User for re-enrollment: %', v_user_id;

  -- 1) vocabularies 명시 DELETE (orphan 방지)
  DELETE FROM vocabularies
  WHERE shared_set_id IN (SELECT id FROM shared_word_sets WHERE category='library_book');
  RAISE NOTICE 'vocabularies deleted';

  -- 2) shared_word_sets DELETE (CASCADE → shared_words + subscriptions)
  DELETE FROM shared_word_sets WHERE category='library_book';
  RAISE NOTICE 'shared_word_sets deleted';

  -- 3) 재발행 + 자동 재구독 (published 책 각각)
  FOR v_book IN
    SELECT id, title FROM library_books WHERE status='published' ORDER BY title
  LOOP
    SELECT count(*) INTO v_chapters FROM publish_book_word_sets(v_book.id, 40);
    RAISE NOTICE 'Published % chapters for: %', v_chapters, v_book.title;

    IF v_user_id IS NOT NULL THEN
      PERFORM _enroll_book_subscribe_word_sets(v_user_id, v_book.id);
    END IF;
  END LOOP;
  RAISE NOTICE 'Re-enrollment complete';
END $$;
