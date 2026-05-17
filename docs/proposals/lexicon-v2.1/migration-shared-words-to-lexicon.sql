-- ============================================================
-- shared_words → word_lexicon Migration (DRAFT)
-- ============================================================
-- 기존 shared_words 의 중복 컬럼 (word/meaning_ko/example_en/pronunciation/
-- part_of_speech/cefr_level) 데이터를 word_lexicon 으로 이전하고
-- shared_words.lexicon_id FK 를 채운다.
--
-- 전제: schema-v2.1.sql 이 먼저 적용되어 shared_words.lexicon_id 컬럼 존재.
-- 순서: Phase A → B → C 동일 트랜잭션. Phase D 는 별도 PR.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────
-- Phase A — dedup + word_lexicon 등록
-- ────────────────────────────────────────────────
-- 같은 (lemma, pos) 가 여러 set 에 등장 → DISTINCT
INSERT INTO word_lexicon (lemma, part_of_speech, meaning_ko, ipa, cefr_level)
SELECT DISTINCT ON (LOWER(TRIM(sw.word)), COALESCE(sw.part_of_speech, 'n'))
  LOWER(TRIM(sw.word)),
  COALESCE(sw.part_of_speech, 'n'),
  sw.meaning_ko,
  sw.pronunciation,
  sw.cefr_level
FROM shared_words sw
WHERE sw.word IS NOT NULL
  AND sw.meaning_ko IS NOT NULL
ORDER BY LOWER(TRIM(sw.word)),
         COALESCE(sw.part_of_speech, 'n'),
         -- 같은 lemma+pos 가 여러 row 면 sort_order ASC 의 첫 의미 채택
         sw.sort_order ASC NULLS LAST
ON CONFLICT (lemma, part_of_speech) DO NOTHING;

-- ────────────────────────────────────────────────
-- Phase B — shared_words.lexicon_id linkage
-- ────────────────────────────────────────────────
UPDATE shared_words sw
SET lexicon_id = wl.id
FROM word_lexicon wl
WHERE wl.lemma          = LOWER(TRIM(sw.word))
  AND wl.part_of_speech = COALESCE(sw.part_of_speech, 'n')
  AND sw.lexicon_id IS NULL;

-- ────────────────────────────────────────────────
-- Phase C — 검증 (실패 시 ROLLBACK)
-- ────────────────────────────────────────────────
DO $$
DECLARE
  total       INT;
  linked      INT;
  orphans     INT;
  link_ratio  NUMERIC;
BEGIN
  SELECT count(*) INTO total   FROM shared_words WHERE word IS NOT NULL;
  SELECT count(*) INTO linked  FROM shared_words WHERE lexicon_id IS NOT NULL;
  SELECT count(*) INTO orphans FROM shared_words WHERE word IS NOT NULL AND lexicon_id IS NULL;
  link_ratio := CASE WHEN total = 0 THEN 1 ELSE linked::NUMERIC / total END;

  RAISE NOTICE '── Migration verification ──';
  RAISE NOTICE 'total shared_words: %', total;
  RAISE NOTICE 'linked to lexicon : % (%.2f%%)', linked, link_ratio * 100;
  RAISE NOTICE 'orphans            : %', orphans;

  -- 99% 미만 linkage 면 실패 (보통 부정확 데이터 의심)
  IF link_ratio < 0.99 THEN
    RAISE EXCEPTION 'linkage ratio % below 99%% threshold — aborting', link_ratio;
  END IF;
END $$;

-- Set 별 linkage 비율 (검토용 — 실패 안 시킴)
SELECT
  sws.id          AS set_id,
  sws.title,
  count(*)        AS words,
  count(sw.lexicon_id) AS linked,
  round(100.0 * count(sw.lexicon_id) / NULLIF(count(*), 0), 1) AS pct
FROM shared_word_sets sws
LEFT JOIN shared_words sw ON sw.set_id = sws.id
GROUP BY sws.id, sws.title
ORDER BY pct ASC NULLS LAST, words DESC;

COMMIT;

-- ════════════════════════════════════════════════
-- Phase D (★ 별도 PR — 코드 전환 완료 후)
-- ════════════════════════════════════════════════
-- 모든 read/write 코드가 lexicon_id 경유로 전환되었음을 확인한 후 실행.
-- 되돌릴 수 없으므로 PR 머지 전 dry-run 필수.
--
-- BEGIN;
--   ALTER TABLE shared_words DROP COLUMN word;
--   ALTER TABLE shared_words DROP COLUMN meaning_ko;
--   ALTER TABLE shared_words DROP COLUMN example_en;
--   ALTER TABLE shared_words DROP COLUMN pronunciation;
--   ALTER TABLE shared_words DROP COLUMN part_of_speech;
--   ALTER TABLE shared_words DROP COLUMN cefr_level;
--
--   -- lexicon_id NOT NULL 승격
--   ALTER TABLE shared_words ALTER COLUMN lexicon_id SET NOT NULL;
-- COMMIT;
