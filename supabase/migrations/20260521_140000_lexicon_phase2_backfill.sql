-- ═══════════════════════════════════════════════════════════════════════════
-- Lexicon Unification Phase 2 — Data Backfill (Migrate)
--
-- ⚠ 적용 보류 — 24h 모니터링 통과 + P5 enrichment 100% 완료 후 Dashboard 수동 실행.
--   사전 확인 필요:
--     0. **P5 enrichment 완료 확인** — meaning_ko/meanings_ko/ipa/cefr_level 채움 작업
--        P5 진행 중 Phase 2 실행 시 Step 2-C 가 P5 대상 row 에 빈약한 단일 sense 박아넣어
--        데이터 품질 손실. phase2-plan.md "P5 enrichment 충돌" 섹션 SQL 로 확인 필수.
--     1. shared_dictionary.source 컬럼 CHECK 제약 — Step 0 에서 'kice-orphan' 값 추가
--        (직전 정의: 20260504160708_prepare_dictionary_for_seed_import.sql)
--     2. Step 2-A 청크 루프 — 가독성 낮음. 동작은 맞으나 LIMIT 단독으로 충분
--     3. Step 5 — GET DIAGNOSTICS ROW_COUNT 적용 완료
--     4. 롤백: Step 5 보강(cefr/ipa) NULL→값 갱신은 원본 미보존 → 백업 의존 필수
--
-- 목적:
--   1. shared_dictionary Phase 1 신규 컬럼 채움 (primary_pos · senses · pos_set)
--   2. word_lexicon orphan 66 → shared_dictionary INSERT (옵션 A)
--   3. word_lexicon 비-orphan 3,701 → shared_dictionary 보강
--   4. word_frequency_stats → lexicon_frequencies 이전 (5,421 row)
--   5. 시중 단어장 list_tags + lexicon_frequencies 적재 (3,207 row)
--
-- 영향:
--   UPDATE: ~30,500 row (shared_dictionary)
--   INSERT: ~8,700 row (orphan + lexicon_frequencies)
--
-- 트랜잭션 전략: 청크 단위 (1,000 row) + SAVEPOINT 패턴
-- 사전 조건: Phase 1 적용 + 24시간 무사고
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 안전성 점검 ──
DO $$
DECLARE
  v_sd_count INT;
  v_phase1_columns INT;
  v_freeze_active BOOLEAN;
  v_lf_initial INT;
BEGIN
  SELECT COUNT(*) INTO v_sd_count FROM shared_dictionary;
  IF v_sd_count <> 38476 THEN
    RAISE EXCEPTION '안전 점검 실패: shared_dictionary count = % (38,476 예상)', v_sd_count;
  END IF;

  SELECT COUNT(*) INTO v_phase1_columns
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='shared_dictionary'
    AND column_name IN ('senses','primary_pos','pos_set','frequency_score','frequency_band');
  IF v_phase1_columns <> 5 THEN
    RAISE EXCEPTION 'Phase 1 신규 컬럼 부족: % / 5', v_phase1_columns;
  END IF;

  SELECT EXISTS(SELECT 1 FROM information_schema.triggers
    WHERE event_object_table='word_lexicon' AND trigger_name='trg_word_lexicon_freeze')
    INTO v_freeze_active;
  IF NOT v_freeze_active THEN
    RAISE EXCEPTION 'word_lexicon freeze trigger 미설치';
  END IF;

  SELECT COUNT(*) INTO v_lf_initial FROM lexicon_frequencies;
  IF v_lf_initial <> 0 THEN
    RAISE NOTICE '⚠ lexicon_frequencies 이미 %  row 존재 — Phase 2 재실행 또는 부분 적용 상태', v_lf_initial;
  END IF;

  RAISE NOTICE '안전 점검 통과: sd=%, columns=%, freeze=%, lf_initial=%',
    v_sd_count, v_phase1_columns, v_freeze_active, v_lf_initial;
END $$;

-- ═════════════════════════════════════════════════════════════════════════
-- Step 0: shared_dictionary.source CHECK 제약 확장 — 'kice-orphan' 허용
--   근거: Step 4 에서 word_lexicon orphan 66 row 를 source='kice-orphan' 으로 INSERT.
--   직전 정의: 20260504160708_prepare_dictionary_for_seed_import.sql
--             (oxford5000·cefrj·coca·ngsl·ai-generated·manual·imported)
-- ═════════════════════════════════════════════════════════════════════════
SAVEPOINT step0_source_check;

ALTER TABLE shared_dictionary
  DROP CONSTRAINT IF EXISTS shared_dictionary_source_check;

ALTER TABLE shared_dictionary
  ADD CONSTRAINT shared_dictionary_source_check
  CHECK (source IN (
    'oxford5000',
    'cefrj',
    'coca',
    'ngsl',
    'ai-generated',
    'manual',
    'imported',
    'kice-orphan'  -- ★ Phase 2 신규 (word_lexicon orphan ingest 전용)
  ));

DO $$
DECLARE v_constraint_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shared_dictionary_source_check'
      AND conrelid = 'public.shared_dictionary'::regclass
  ) INTO v_constraint_exists;
  IF NOT v_constraint_exists THEN
    RAISE EXCEPTION 'Step 0 실패: shared_dictionary_source_check 재설치 안 됨';
  END IF;
  RAISE NOTICE 'Step 0 완료: source CHECK 에 ''kice-orphan'' 추가';
END $$;

-- ═════════════════════════════════════════════════════════════════════════
-- Step 1: primary_pos 채움 (NULLIF 'unknown' → NULL 보존)
--   원래 가정: P5 enrichment 전 = pos='unknown' 12,976 row 존재 → primary_pos NULL 로 보존.
--   실제 현재: e4471e4 (pos hygiene normalize, 25,546 row) + P5 ts-track import 후 'unknown' = 0.
--   → assertion 을 현 상태에 맞춰 strict `<> 0` 로 변경 (legacy 12,976 가정 폐기).
-- ═════════════════════════════════════════════════════════════════════════
SAVEPOINT step1_primary_pos;

UPDATE shared_dictionary
SET primary_pos = NULLIF(pos, 'unknown'),
    updated_at = now()
WHERE primary_pos IS NULL;

DO $$
DECLARE v_filled INT; v_unknown_null INT;
BEGIN
  SELECT COUNT(*) INTO v_filled FROM shared_dictionary WHERE primary_pos IS NOT NULL;
  SELECT COUNT(*) INTO v_unknown_null FROM shared_dictionary WHERE pos = 'unknown' AND primary_pos IS NULL;

  IF v_filled < 25000 THEN
    RAISE EXCEPTION 'Step 1 실패: primary_pos 채움 % (25,000 미달)', v_filled;
  END IF;
  -- 현재 정합: 0 (P5 + pos hygiene 완료 후). legacy 가정(12,976)은 폐기.
  IF v_unknown_null <> 0 THEN
    RAISE EXCEPTION 'Step 1 실패: unknown→NULL 보존 부정확 % (0 예상)', v_unknown_null;
  END IF;
  RAISE NOTICE 'Step 1 통과: primary_pos 채움 % / unknown 보존 %', v_filled, v_unknown_null;
END $$;

-- ═════════════════════════════════════════════════════════════════════════
-- Step 2: meanings_ko → senses 변환 (청크 단위)
--   2-A: legacy 패턴 24,382 row
--   2-B: 신규 패턴 1,118 row
--   2-C: NULL meanings_ko 12,976 row
-- ═════════════════════════════════════════════════════════════════════════
SAVEPOINT step2_senses_start;

-- 2-A. legacy 패턴
DO $$
DECLARE
  v_offset INT := 0;
  v_chunk INT := 1000;
  v_processed INT := 0;
  v_total INT;
BEGIN
  SELECT COUNT(*) INTO v_total FROM shared_dictionary
  WHERE meanings_ko IS NOT NULL
    AND jsonb_array_length(meanings_ko) > 0
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(meanings_ko) m
                WHERE (m ? 'meaning') AND NOT (m ? 'sense_ko'))
    AND jsonb_array_length(senses) = 0;

  RAISE NOTICE 'Step 2-A: legacy 패턴 변환 시작 (대상 % rows)', v_total;

  LOOP
    EXIT WHEN v_offset >= v_total + v_chunk;

    WITH targets AS (
      SELECT word FROM shared_dictionary
      WHERE meanings_ko IS NOT NULL
        AND jsonb_array_length(meanings_ko) > 0
        AND EXISTS (SELECT 1 FROM jsonb_array_elements(meanings_ko) m
                    WHERE (m ? 'meaning') AND NOT (m ? 'sense_ko'))
        AND jsonb_array_length(senses) = 0
      ORDER BY word LIMIT v_chunk
    )
    UPDATE shared_dictionary sd
    SET senses = (
      SELECT jsonb_agg(jsonb_build_object(
        'sense_idx', ord - 1,
        'pos', COALESCE(m->>'pos', sd.primary_pos, sd.pos),
        'sense_ko', COALESCE(m->>'sense_ko', m->>'meaning'),
        'sense_en', COALESCE(m->>'sense_en', NULL),
        'register', COALESCE(m->>'register', 'neutral'),
        'examples', COALESCE(m->'examples', '[]'::jsonb)
      ) ORDER BY ord)
      FROM jsonb_array_elements(meanings_ko) WITH ORDINALITY AS arr(m, ord)
    ),
    updated_at = now()
    WHERE sd.word IN (SELECT word FROM targets);

    GET DIAGNOSTICS v_processed = ROW_COUNT;
    v_offset := v_offset + v_chunk;

    IF v_offset % 5000 = 0 OR v_processed = 0 THEN
      RAISE NOTICE 'Step 2-A 진행: % / %', LEAST(v_offset, v_total), v_total;
    END IF;
    EXIT WHEN v_processed = 0;
  END LOOP;
  RAISE NOTICE 'Step 2-A 완료';
END $$;

DO $$
DECLARE v_remaining INT;
BEGIN
  SELECT COUNT(*) INTO v_remaining FROM shared_dictionary
  WHERE meanings_ko IS NOT NULL
    AND jsonb_array_length(meanings_ko) > 0
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(meanings_ko) m
                WHERE (m ? 'meaning') AND NOT (m ? 'sense_ko'))
    AND jsonb_array_length(senses) = 0;
  IF v_remaining > 100 THEN
    RAISE EXCEPTION 'Step 2-A 실패: 미변환 % row (100 초과)', v_remaining;
  END IF;
  RAISE NOTICE 'Step 2-A 검증 통과: 미변환 잔여 % (≤100 허용)', v_remaining;
END $$;

-- 2-B. 신규 패턴 sense_idx 추가
UPDATE shared_dictionary sd
SET senses = (
  SELECT jsonb_agg((m || jsonb_build_object('sense_idx', ord - 1)) ORDER BY ord)
  FROM jsonb_array_elements(meanings_ko) WITH ORDINALITY AS arr(m, ord)
),
updated_at = now()
WHERE meanings_ko IS NOT NULL
  AND jsonb_array_length(meanings_ko) > 0
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(meanings_ko) m
                  WHERE (m ? 'meaning') AND NOT (m ? 'sense_ko'))
  AND jsonb_array_length(senses) = 0;

DO $$
DECLARE v_b_count INT;
BEGIN
  SELECT COUNT(*) INTO v_b_count FROM shared_dictionary
  WHERE jsonb_array_length(senses) > 0 AND meanings_ko IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(meanings_ko) m
                    WHERE (m ? 'meaning') AND NOT (m ? 'sense_ko'));
  RAISE NOTICE 'Step 2-B 완료: 신규 패턴 senses 채움 %', v_b_count;
END $$;

-- 2-C. NULL meanings_ko → meaning_ko 텍스트 기반 단일 sense
UPDATE shared_dictionary
SET senses = jsonb_build_array(jsonb_build_object(
  'sense_idx', 0,
  'pos', COALESCE(primary_pos, pos),
  'sense_ko', meaning_ko,
  'sense_en', NULL,
  'register', 'neutral',
  'examples', CASE
    WHEN example_en IS NOT NULL THEN jsonb_build_array(jsonb_build_object('en', example_en))
    ELSE '[]'::jsonb END
)),
updated_at = now()
WHERE meanings_ko IS NULL
  AND meaning_ko IS NOT NULL
  AND jsonb_array_length(senses) = 0;

DO $$
DECLARE v_c_count INT;
BEGIN
  SELECT COUNT(*) INTO v_c_count FROM shared_dictionary
  WHERE meanings_ko IS NULL AND jsonb_array_length(senses) = 1;
  RAISE NOTICE 'Step 2-C 완료: NULL meanings_ko → 단일 sense 생성 %', v_c_count;
END $$;

-- ═════════════════════════════════════════════════════════════════════════
-- Step 3: pos_set 자동 추출
-- ═════════════════════════════════════════════════════════════════════════
SAVEPOINT step3_pos_set;

UPDATE shared_dictionary
SET pos_set = COALESCE(
  (SELECT array_agg(DISTINCT s->>'pos' ORDER BY s->>'pos')
   FROM jsonb_array_elements(senses) s WHERE s->>'pos' IS NOT NULL),
  ARRAY[primary_pos]::TEXT[],
  '{}'::TEXT[]
),
updated_at = now()
WHERE jsonb_array_length(senses) > 0;

DO $$
DECLARE v_pos_set_filled INT;
BEGIN
  SELECT COUNT(*) INTO v_pos_set_filled FROM shared_dictionary WHERE array_length(pos_set, 1) > 0;
  IF v_pos_set_filled < 20000 THEN
    RAISE EXCEPTION 'Step 3 실패: pos_set 채움 % (20,000 미달)', v_pos_set_filled;
  END IF;
  RAISE NOTICE 'Step 3 통과: pos_set 채움 %', v_pos_set_filled;
END $$;

-- ═════════════════════════════════════════════════════════════════════════
-- Step 4: orphan 66 → shared_dictionary INSERT (옵션 A)
-- ⚠ 적용 전 source CHECK 제약 확인 필요. 차단 시 'imported' + metadata 폴백.
-- ═════════════════════════════════════════════════════════════════════════
SAVEPOINT step4_orphan_insert;

INSERT INTO shared_dictionary
  (word, pos, primary_pos, meaning_ko, ipa, cefr_level, source,
   senses, inflections, pos_set, created_at, updated_at)
SELECT DISTINCT ON (wl.lemma)
  wl.lemma,
  CASE wl.part_of_speech
    WHEN 'n' THEN 'noun' WHEN 'v' THEN 'verb'
    WHEN 'adj' THEN 'adjective' WHEN 'adv' THEN 'adverb'
    WHEN 'phrase' THEN 'phrasal verb'
    ELSE wl.part_of_speech END,
  CASE wl.part_of_speech
    WHEN 'n' THEN 'noun' WHEN 'v' THEN 'verb'
    WHEN 'adj' THEN 'adjective' WHEN 'adv' THEN 'adverb'
    WHEN 'phrase' THEN 'phrasal verb'
    ELSE wl.part_of_speech END,
  wl.meaning_ko, wl.ipa, wl.cefr_level,
  'kice-orphan',
  jsonb_build_array(jsonb_build_object(
    'sense_idx', 0,
    'pos', CASE wl.part_of_speech
      WHEN 'n' THEN 'noun' WHEN 'v' THEN 'verb'
      WHEN 'adj' THEN 'adjective' WHEN 'adv' THEN 'adverb'
      WHEN 'phrase' THEN 'phrasal verb'
      ELSE wl.part_of_speech END,
    'sense_ko', wl.meaning_ko, 'sense_en', NULL,
    'register', 'neutral', 'examples', '[]'::jsonb
  )),
  '{"forms":[],"source":"kice-orphan"}'::jsonb,
  ARRAY[CASE wl.part_of_speech
    WHEN 'n' THEN 'noun' WHEN 'v' THEN 'verb'
    WHEN 'adj' THEN 'adjective' WHEN 'adv' THEN 'adverb'
    WHEN 'phrase' THEN 'phrasal verb'
    ELSE wl.part_of_speech END]::TEXT[],
  wl.created_at, now()
FROM word_lexicon wl
WHERE EXISTS (SELECT 1 FROM shared_words sw WHERE sw.lexicon_id = wl.id)
  AND NOT EXISTS (SELECT 1 FROM shared_dictionary sd WHERE sd.word = wl.lemma)
ORDER BY wl.lemma, wl.created_at;

DO $$
DECLARE v_orphan_inserted INT;
BEGIN
  SELECT COUNT(*) INTO v_orphan_inserted FROM shared_dictionary WHERE source = 'kice-orphan';
  IF v_orphan_inserted < 60 OR v_orphan_inserted > 75 THEN
    RAISE EXCEPTION 'Step 4 실패: orphan INSERT % (60-75 예상)', v_orphan_inserted;
  END IF;
  RAISE NOTICE 'Step 4 통과: orphan INSERT % (예상 66)', v_orphan_inserted;
END $$;

-- ═════════════════════════════════════════════════════════════════════════
-- Step 5: word_lexicon 비-orphan 3,701 → shared_dictionary 보강
-- 충돌 시 기존 sd 우선 (NULL인 필드만 wl 값으로 채움)
-- ═════════════════════════════════════════════════════════════════════════
SAVEPOINT step5_wl_merge;

DO $$
DECLARE v_merged INT;
BEGIN
  UPDATE shared_dictionary sd
  SET cefr_level = COALESCE(sd.cefr_level, wl.cefr_level),
      ipa = COALESCE(sd.ipa, wl.ipa),
      updated_at = now()
  FROM word_lexicon wl
  WHERE sd.word = wl.lemma
    AND sd.source != 'kice-orphan'
    AND (sd.cefr_level IS NULL OR sd.ipa IS NULL);

  GET DIAGNOSTICS v_merged = ROW_COUNT;
  RAISE NOTICE 'Step 5 완료: wl→sd 실제 갱신 row %', v_merged;
END $$;

-- ═════════════════════════════════════════════════════════════════════════
-- Step 6: word_frequency_stats → lexicon_frequencies 이전
-- ═════════════════════════════════════════════════════════════════════════
SAVEPOINT step6_freq_migration;

INSERT INTO lexicon_frequencies
  (lemma, source_id, raw_count, normalized_freq, rank_in_source,
   frequency_tier, appears_every_year, year_from, year_to, metadata, computed_at)
SELECT wl.lemma, wfs.data_source_id, wfs.raw_count, wfs.normalized_freq,
       wfs.rank_in_source, wfs.frequency_tier, wfs.appears_every_year,
       wfs.year_from, wfs.year_to, wfs.metadata, wfs.computed_at
FROM word_frequency_stats wfs
JOIN word_lexicon wl ON wl.id = wfs.lexicon_id
WHERE EXISTS (SELECT 1 FROM shared_dictionary sd WHERE sd.word = wl.lemma)
ON CONFLICT (lemma, source_id) DO NOTHING;

DO $$
DECLARE v_lf_count INT; v_wfs_count INT;
BEGIN
  SELECT COUNT(*) INTO v_lf_count FROM lexicon_frequencies;
  SELECT COUNT(*) INTO v_wfs_count FROM word_frequency_stats;
  IF v_lf_count < v_wfs_count * 0.95 THEN
    RAISE EXCEPTION 'Step 6 실패: lf=% wfs=% (95%% 미달)', v_lf_count, v_wfs_count;
  END IF;
  RAISE NOTICE 'Step 6 통과: lexicon_frequencies % / word_frequency_stats %', v_lf_count, v_wfs_count;
END $$;

-- ═════════════════════════════════════════════════════════════════════════
-- Step 7: 시중 단어장 list_tags + lexicon_frequencies 적재
-- ═════════════════════════════════════════════════════════════════════════
SAVEPOINT step7_lists;

UPDATE shared_dictionary sd
SET list_tags = array_append(COALESCE(sd.list_tags, '{}'), 'csat-prep-core-2k'),
    updated_at = now()
WHERE EXISTS (SELECT 1 FROM _vocab_anki_analysis a WHERE a.word = sd.word AND a.in_wm = 1)
  AND NOT ('csat-prep-core-2k' = ANY(COALESCE(sd.list_tags, '{}')));

UPDATE shared_dictionary sd
SET list_tags = array_append(COALESCE(sd.list_tags, '{}'), 'csat-prep-ext-1.8k'),
    updated_at = now()
WHERE EXISTS (SELECT 1 FROM _vocab_anki_analysis a WHERE a.word = sd.word AND a.in_ebs = 1)
  AND NOT ('csat-prep-ext-1.8k' = ANY(COALESCE(sd.list_tags, '{}')));

INSERT INTO lexicon_frequencies (lemma, source_id, raw_count, frequency_tier)
SELECT a.word, fds.id, 1, 3
FROM _vocab_anki_analysis a
JOIN shared_dictionary sd ON sd.word = a.word
JOIN frequency_data_sources fds ON fds.source_key = 'csat-prep-core-2k'
WHERE a.in_wm = 1
ON CONFLICT (lemma, source_id) DO NOTHING;

INSERT INTO lexicon_frequencies (lemma, source_id, raw_count, frequency_tier)
SELECT a.word, fds.id, 1, 3
FROM _vocab_anki_analysis a
JOIN shared_dictionary sd ON sd.word = a.word
JOIN frequency_data_sources fds ON fds.source_key = 'csat-prep-ext-1.8k'
WHERE a.in_ebs = 1
ON CONFLICT (lemma, source_id) DO NOTHING;

DO $$
DECLARE v_wm INT; v_ebs INT; v_lf INT;
BEGIN
  SELECT COUNT(*) INTO v_wm FROM shared_dictionary WHERE 'csat-prep-core-2k' = ANY(list_tags);
  SELECT COUNT(*) INTO v_ebs FROM shared_dictionary WHERE 'csat-prep-ext-1.8k' = ANY(list_tags);
  SELECT COUNT(*) INTO v_lf FROM lexicon_frequencies;
  RAISE NOTICE 'Step 7 통과: core-2k tagged %, ext-1.8k tagged %, lf_total %', v_wm, v_ebs, v_lf;
END $$;

-- ═════════════════════════════════════════════════════════════════════════
-- Step 8: shared_words/vocabularies/library_* 의 lemma 자동 채움
-- ═════════════════════════════════════════════════════════════════════════
SAVEPOINT step8_lemma_backfill;

UPDATE shared_words sw
SET lemma = LOWER(TRIM(sw.word))
WHERE sw.lemma IS NULL AND sw.word IS NOT NULL
  AND EXISTS (SELECT 1 FROM shared_dictionary sd WHERE sd.word = LOWER(TRIM(sw.word)));

UPDATE vocabularies v
SET lemma = LOWER(TRIM(v.word))
WHERE v.lemma IS NULL AND v.word IS NOT NULL
  AND EXISTS (SELECT 1 FROM shared_dictionary sd WHERE sd.word = LOWER(TRIM(v.word)));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='library_book_vocabularies') THEN
    EXECUTE $sql$
      UPDATE library_book_vocabularies lbv
      SET lemma = LOWER(TRIM(lbv.word))
      WHERE lbv.lemma IS NULL AND lbv.word IS NOT NULL
        AND EXISTS (SELECT 1 FROM shared_dictionary sd WHERE sd.word = LOWER(TRIM(lbv.word)))
    $sql$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='library_article_vocabularies') THEN
    EXECUTE $sql$
      UPDATE library_article_vocabularies lav
      SET lemma = LOWER(TRIM(lav.word))
      WHERE lav.lemma IS NULL AND lav.word IS NOT NULL
        AND EXISTS (SELECT 1 FROM shared_dictionary sd WHERE sd.word = LOWER(TRIM(lav.word)))
    $sql$;
  END IF;
END $$;

DO $$
DECLARE v_sw INT; v_vocab INT;
BEGIN
  SELECT COUNT(*) INTO v_sw FROM shared_words WHERE lemma IS NOT NULL;
  SELECT COUNT(*) INTO v_vocab FROM vocabularies WHERE lemma IS NOT NULL;
  RAISE NOTICE 'Step 8 통과: shared_words.lemma=% / vocabularies.lemma=%', v_sw, v_vocab;
END $$;

-- ═════════════════════════════════════════════════════════════════════════
-- 최종 종합 검증
-- ═════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_sd_total INT; v_senses INT; v_pos_set INT;
  v_lf INT; v_orphan INT; v_sw_lemma INT; v_sw_orphan_lemma INT;
BEGIN
  SELECT COUNT(*) INTO v_sd_total FROM shared_dictionary;
  SELECT COUNT(*) INTO v_senses FROM shared_dictionary WHERE jsonb_array_length(senses) > 0;
  SELECT COUNT(*) INTO v_pos_set FROM shared_dictionary WHERE array_length(pos_set, 1) > 0;
  SELECT COUNT(*) INTO v_lf FROM lexicon_frequencies;
  SELECT COUNT(*) INTO v_orphan FROM shared_dictionary WHERE source = 'kice-orphan';
  SELECT COUNT(*) INTO v_sw_lemma FROM shared_words WHERE lemma IS NOT NULL;
  SELECT COUNT(*) INTO v_sw_orphan_lemma FROM shared_words sw
    WHERE sw.lemma IS NOT NULL
      AND EXISTS (SELECT 1 FROM shared_dictionary sd
                  WHERE sd.word = sw.lemma AND sd.source = 'kice-orphan');

  RAISE NOTICE '═══ Phase 2 최종 검증 ═══';
  RAISE NOTICE 'shared_dictionary total: % (예상 ~38,542)', v_sd_total;
  RAISE NOTICE 'senses 채움: % (예상 ≥30,000)', v_senses;
  RAISE NOTICE 'pos_set 채움: % (예상 ≥25,000)', v_pos_set;
  RAISE NOTICE 'lexicon_frequencies: % (예상 ≥8,500)', v_lf;
  RAISE NOTICE 'orphan INSERT: % (예상 66)', v_orphan;
  RAISE NOTICE 'shared_words.lemma 채움: %', v_sw_lemma;
  RAISE NOTICE 'orphan 통한 shared_words 매칭: %', v_sw_orphan_lemma;

  IF v_sd_total < 38500 OR v_senses < 30000 OR v_lf < 8000 THEN
    RAISE EXCEPTION 'Phase 2 최종 검증 실패';
  END IF;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- 롤백 (COMMIT 후 발견된 문제 시 — 별도 트랜잭션):
--   주의: Step 5 보강(cefr/ipa) NULL→값 갱신은 원본 미보존 → 백업 의존 필수
--
-- BEGIN;
-- UPDATE shared_dictionary SET senses = '[]'::jsonb WHERE jsonb_array_length(senses) > 0;
-- UPDATE shared_dictionary SET primary_pos = NULL, pos_set = '{}'::TEXT[]
--   WHERE primary_pos IS NOT NULL OR array_length(pos_set,1) > 0;
-- DELETE FROM shared_dictionary WHERE source = 'kice-orphan';
-- TRUNCATE lexicon_frequencies;
-- UPDATE shared_dictionary
--   SET list_tags = array_remove(array_remove(list_tags,'csat-prep-core-2k'),'csat-prep-ext-1.8k')
--   WHERE 'csat-prep-core-2k' = ANY(list_tags) OR 'csat-prep-ext-1.8k' = ANY(list_tags);
-- -- vocabularies.lemma 는 seed account(8 manual) 보존 위해 선택적 NULL 처리
-- COMMIT;
-- ═══════════════════════════════════════════════════════════════════════════
