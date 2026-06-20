-- 20260608123000_acp_nd_display_only_gate.sql
-- ═══════════════════════════════════════════════════════════
-- ACP §18 Step 3 — The Conversation(CC-BY-ND) ND 강제: display_only 단어세트 차단
--
-- ND(No Derivatives): 본문 verbatim 읽기 + attribution 은 허용,
--   단어세트(shared_word_sets) 재패키징·배포는 파생물 → 금지.
--   워크스페이스 단어 학습은 클릭 툴팁(lookup_word_meaning · 원문 불변)으로만.
--
-- 변경:
--   1. trg_publish_article_word_set() — display_only 면 단어세트 발행 SKIP
--   2. subscribe_article_word_set()   — display_only 면 구독/vocab import no-op
--   (article→texts verbatim 복사 = ND 허용 · 워크스페이스 단어주석은 library_book 전용이라
--    article 은 이미 본문+툴팁만 표시 → 별도 워크스페이스 분기 불필요.)
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- 1) 발행 트리거 함수 — ND 제외
CREATE OR REPLACE FUNCTION trg_publish_article_word_set()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.status = 'published'
     AND (OLD.status IS NULL OR OLD.status != 'published')
     AND NOT COALESCE(NEW.display_only, false)  -- ND(display_only): 파생 단어세트 발행 안 함
  THEN
    PERFORM publish_article_word_set(NEW.id);
  END IF;
  RETURN NEW;
END $function$;

-- 2) 구독 함수 — ND no-op
CREATE OR REPLACE FUNCTION subscribe_article_word_set(p_article_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- ND(display_only) 글은 단어세트 파생/배포 안 함 — 본문 verbatim + 클릭 툴팁만
  IF EXISTS (SELECT 1 FROM library_articles WHERE id = p_article_id AND display_only) THEN
    RETURN;
  END IF;

  INSERT INTO user_word_set_subscriptions (user_id, set_id)
  SELECT v_uid, sws.id
    FROM shared_word_sets sws
   WHERE sws.is_published = true
     AND sws.category = 'library_article'
     AND sws.curation_query->>'article_id' = p_article_id::text
  ON CONFLICT (user_id, set_id) DO NOTHING;

  INSERT INTO vocabularies (
    user_id, word, meaning, example_sentence,
    pronunciation, pos, cefr_level, origin, shared_set_id
  )
  SELECT
    v_uid, sw.word, sw.meaning_ko, sw.example_en,
    sw.pronunciation, sw.part_of_speech, sw.cefr_level, 'shared_set', sw.set_id
  FROM shared_words sw
   JOIN shared_word_sets sws ON sws.id = sw.set_id
  WHERE sws.is_published = true
    AND sws.category = 'library_article'
    AND sws.curation_query->>'article_id' = p_article_id::text
  ON CONFLICT (user_id, word) DO NOTHING;
END $function$;

COMMIT;
