-- supabase/migrations/20260521_200000_pos_normalize_cleanup.sql
-- fix(lexicon): pos hygiene normalize + lemma backfill + word_count repair
--
-- Pre-Phase 2 ETL cleanup migration. Single transaction.
--
-- Step 1: shared_dictionary.pos — 53 non-standard variants → 17 standard
--         (3,503 rows). Mapping derived from observed distribution.
-- Step 2: lemma backfill for library_book_vocabularies / vocabularies /
--         shared_words. EXISTS guard: only fill where shared_dictionary
--         already contains the LOWER(TRIM(word)) — unmatched rows stay NULL
--         and are handled later by Phase 3 surface_index MV.
-- Step 3: shared_word_sets.word_count — repair mismatched sets (1 row).
-- Step 4: Validation. pos non-standard remaining = 0 (EXCEPTION on fail).
--         sws.word_count mismatch = 0 (EXCEPTION on fail). lemma counts
--         reported via NOTICE (95% threshold not enforced — lbv has 4,680
--         OOV rows that need Phase 3 inflections MV).

BEGIN;

-- ────────────────────────────────────────────────────────────
-- Step 1: shared_dictionary.pos normalization
-- ────────────────────────────────────────────────────────────
UPDATE shared_dictionary
SET pos = CASE pos
  -- Single abbreviation (with dot)
  WHEN 'n.' THEN 'noun'
  WHEN 'v.' THEN 'verb'
  WHEN 'adj.' THEN 'adjective'
  WHEN 'adv.' THEN 'adverb'
  WHEN 'prep.' THEN 'preposition'
  WHEN 'conj.' THEN 'conjunction'
  WHEN 'pron.' THEN 'pronoun'
  WHEN 'interj.' THEN 'interjection'
  WHEN 'num.' THEN 'numeral'
  WHEN 'abbr.' THEN 'abbreviation'
  -- Single abbreviation (no dot)
  WHEN 'n' THEN 'noun'
  WHEN 'v' THEN 'verb'
  WHEN 'adj' THEN 'adjective'
  WHEN 'prep' THEN 'preposition'
  WHEN 'interj' THEN 'interjection'
  -- Full word non-standard
  WHEN 'phrasal verb' THEN 'phrasal_verb'
  WHEN 'exclamation' THEN 'interjection'
  WHEN 'auxiliary verb' THEN 'auxiliary'
  -- Latin / parenthetical / plural-only annotations
  WHEN 'adj. (라틴어)' THEN 'adjective'
  WHEN 'n.(pl.)' THEN 'noun'
  WHEN 'n. pl.' THEN 'noun'
  -- Multi-pos: comma + space + dot
  WHEN 'v., n.' THEN 'verb'
  WHEN 'n., v.' THEN 'noun'
  WHEN 'n., adj.' THEN 'noun'
  WHEN 'adj., n.' THEN 'adjective'
  WHEN 'adj., adv.' THEN 'adjective'
  WHEN 'adj., v.' THEN 'adjective'
  WHEN 'adv., adj.' THEN 'adverb'
  WHEN 'adv., n.' THEN 'adverb'
  WHEN 'interj., n.' THEN 'interjection'
  WHEN 'n., adv.' THEN 'noun'
  WHEN 'adj., n., v.' THEN 'adjective'
  WHEN 'n., v., adj.' THEN 'noun'
  WHEN 'n., v., interj.' THEN 'noun'
  WHEN 'v., adj.' THEN 'verb'
  WHEN 'v., adj., n.' THEN 'verb'
  -- Multi-pos: comma no space + dot
  WHEN 'adj.,n.' THEN 'adjective'
  WHEN 'n.,v.' THEN 'noun'
  WHEN 'n.,adj.' THEN 'noun'
  WHEN 'v.,n.' THEN 'verb'
  -- Multi-pos: slash separator
  WHEN 'adj./n.' THEN 'adjective'
  WHEN 'adj./v.' THEN 'adjective'
  WHEN 'adj./v./n.' THEN 'adjective'
  WHEN 'adv./adj.' THEN 'adverb'
  WHEN 'n./adj.' THEN 'noun'
  WHEN 'n./v.' THEN 'noun'
  WHEN 'pron./n.' THEN 'pronoun'
  WHEN 'v./n.' THEN 'verb'
  -- Multi-pos: full-word comma
  WHEN 'noun, verb' THEN 'noun'
  WHEN 'noun, adjective' THEN 'noun'
  WHEN 'verb, noun' THEN 'verb'
  WHEN 'adjective, verb' THEN 'adjective'
  WHEN 'adjective, noun' THEN 'adjective'
  -- prefix-combo (primary = prefix)
  WHEN 'prefix, n.' THEN 'prefix'
  ELSE pos
END,
updated_at = now()
WHERE pos NOT IN (
  'noun','verb','adjective','adverb','preposition','conjunction',
  'pronoun','determiner','interjection','idiom','phrasal_verb',
  'abbreviation','prefix','article','numeral','auxiliary','other'
);

-- ────────────────────────────────────────────────────────────
-- Step 2: lemma backfill (EXISTS guard — Phase 3 handles OOV via MV)
-- ────────────────────────────────────────────────────────────
UPDATE library_book_vocabularies lbv
SET lemma = LOWER(TRIM(lbv.word))
WHERE lbv.lemma IS NULL
  AND EXISTS (SELECT 1 FROM shared_dictionary sd WHERE sd.word = LOWER(TRIM(lbv.word)));

UPDATE vocabularies v
SET lemma = LOWER(TRIM(v.word))
WHERE v.lemma IS NULL
  AND EXISTS (SELECT 1 FROM shared_dictionary sd WHERE sd.word = LOWER(TRIM(v.word)));

UPDATE shared_words sw
SET lemma = LOWER(TRIM(sw.word))
WHERE sw.lemma IS NULL
  AND EXISTS (SELECT 1 FROM shared_dictionary sd WHERE sd.word = LOWER(TRIM(sw.word)));

-- library_article_vocabularies: currently 0 rows (no-op now, policy-consistent for future)
UPDATE library_article_vocabularies lav
SET lemma = LOWER(TRIM(lav.word))
WHERE lav.lemma IS NULL
  AND EXISTS (SELECT 1 FROM shared_dictionary sd WHERE sd.word = LOWER(TRIM(lav.word)));

-- ────────────────────────────────────────────────────────────
-- Step 3: shared_word_sets.word_count repair
-- ────────────────────────────────────────────────────────────
-- shared_word_sets has no updated_at column (schema drift from CLAUDE.md v06.22 spec)
UPDATE shared_word_sets sws
SET word_count = (SELECT COUNT(*) FROM shared_words WHERE set_id = sws.id)
WHERE word_count <> (SELECT COUNT(*) FROM shared_words WHERE set_id = sws.id);

-- ────────────────────────────────────────────────────────────
-- Step 4: Validation
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_pos_remaining INT;
  v_sws_mismatch INT;
  v_lbv_filled INT;
  v_lbv_null INT;
  v_vocab_filled INT;
  v_vocab_null INT;
  v_sw_filled INT;
  v_sw_null INT;
  v_lav_filled INT;
  v_lav_null INT;
BEGIN
  SELECT COUNT(*) INTO v_pos_remaining FROM shared_dictionary
  WHERE pos NOT IN (
    'noun','verb','adjective','adverb','preposition','conjunction',
    'pronoun','determiner','interjection','idiom','phrasal_verb',
    'abbreviation','prefix','article','numeral','auxiliary','other'
  );
  IF v_pos_remaining > 0 THEN
    RAISE EXCEPTION 'pos normalization incomplete: % rows remain non-standard', v_pos_remaining;
  END IF;

  SELECT COUNT(*) INTO v_sws_mismatch
  FROM shared_word_sets sws
  WHERE word_count <> (SELECT COUNT(*) FROM shared_words WHERE set_id = sws.id);
  IF v_sws_mismatch > 0 THEN
    RAISE EXCEPTION 'shared_word_sets.word_count mismatch: % sets', v_sws_mismatch;
  END IF;

  SELECT COUNT(*) INTO v_lbv_filled FROM library_book_vocabularies WHERE lemma IS NOT NULL;
  SELECT COUNT(*) INTO v_lbv_null FROM library_book_vocabularies WHERE lemma IS NULL;
  SELECT COUNT(*) INTO v_vocab_filled FROM vocabularies WHERE lemma IS NOT NULL;
  SELECT COUNT(*) INTO v_vocab_null FROM vocabularies WHERE lemma IS NULL;
  SELECT COUNT(*) INTO v_sw_filled FROM shared_words WHERE lemma IS NOT NULL;
  SELECT COUNT(*) INTO v_sw_null FROM shared_words WHERE lemma IS NULL;
  SELECT COUNT(*) INTO v_lav_filled FROM library_article_vocabularies WHERE lemma IS NOT NULL;
  SELECT COUNT(*) INTO v_lav_null FROM library_article_vocabularies WHERE lemma IS NULL;

  RAISE NOTICE 'Cleanup passed:';
  RAISE NOTICE '  shared_dictionary.pos non-standard remaining: 0';
  RAISE NOTICE '  shared_word_sets.word_count mismatch: 0';
  RAISE NOTICE '  library_book_vocabularies.lemma filled/null:    % / %', v_lbv_filled, v_lbv_null;
  RAISE NOTICE '  library_article_vocabularies.lemma filled/null: % / %', v_lav_filled, v_lav_null;
  RAISE NOTICE '  vocabularies.lemma filled/null:                  % / %', v_vocab_filled, v_vocab_null;
  RAISE NOTICE '  shared_words.lemma filled/null:                  % / %', v_sw_filled, v_sw_null;
  RAISE NOTICE '  (NULL rows are OOV — Phase 3 surface_index MV resolves)';
END $$;

COMMIT;
