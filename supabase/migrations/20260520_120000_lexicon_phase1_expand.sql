-- ═══════════════════════════════════════════════════════════════════════════
-- Lexicon Unification Phase 1 — Schema Expansion (Expand)
--
-- ⚠️ 적용 보류 사유 — 사용자 확인 필요:
--   1. docs/proposals/lexicon-v2.1/ 의 다른 모델과 충돌 가능
--   2. frequency_data_sources 시드의 source_key/citation 중립화 (메모리 제약)
--      현재 placeholder: csat-prep-core-2k, csat-prep-ext-1.8k
--   3. 적용은 Supabase Dashboard 에서 수동 실행 (메모리 제약: auto-apply 금지)
--
-- 목적: shared_dictionary 통합 모델 컬럼 추가 + lexicon_frequencies 사이드카 신설
-- 영향: ADD COLUMN + CREATE TABLE 만. 기존 컬럼·데이터 변경 0
-- 무중단: ACCESS EXCLUSIVE 락 시간 최소화 (DEFAULT 없는 NULL 허용 컬럼 위주)
-- 롤백: 파일 끝 ROLLBACK 블록 참고 (~5분)
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 안전성 점검 ──
DO $$
DECLARE v_sd_count INT;
BEGIN
  SELECT COUNT(*) INTO v_sd_count FROM shared_dictionary;
  IF v_sd_count < 38000 THEN
    RAISE EXCEPTION '안전 점검 실패: shared_dictionary 행 수 % < 38000 — 백업 확인 필요', v_sd_count;
  END IF;
  RAISE NOTICE '안전 점검 통과: shared_dictionary = % rows', v_sd_count;
END $$;

-- ── 1. shared_dictionary 통합 컬럼 추가 ──
ALTER TABLE shared_dictionary
  ADD COLUMN IF NOT EXISTS senses JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS primary_pos TEXT,
  ADD COLUMN IF NOT EXISTS pos_set TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ipa_uk TEXT,
  ADD COLUMN IF NOT EXISTS ipa_us TEXT,
  ADD COLUMN IF NOT EXISTS cefr_confidence NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS domain_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS frequency_score NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS frequency_band TEXT,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

COMMENT ON COLUMN shared_dictionary.senses IS '[Phase 2 backfill] meanings_ko를 sense_idx + pos 별 정규화한 신규 JSONB';
COMMENT ON COLUMN shared_dictionary.primary_pos IS '[Phase 2 backfill] NULLIF(pos, ''unknown'')';
COMMENT ON COLUMN shared_dictionary.pos_set IS '[Phase 2 backfill] senses 에서 자동 추출';
COMMENT ON COLUMN shared_dictionary.frequency_score IS '[Phase 3 trigger] lexicon_frequencies 가중 합산';
COMMENT ON COLUMN shared_dictionary.frequency_band IS '[Phase 3 trigger] top-1k/2k/5k/10k/rare';

-- ── 2. lexicon_frequencies 사이드카 신설 ──
CREATE TABLE IF NOT EXISTS lexicon_frequencies (
  id                BIGSERIAL PRIMARY KEY,
  lemma             TEXT NOT NULL REFERENCES shared_dictionary(word) ON DELETE CASCADE,
  source_id         SMALLINT NOT NULL REFERENCES frequency_data_sources(id),
  raw_count         INT,
  normalized_freq   NUMERIC,
  rank_in_source    INT,
  frequency_tier    SMALLINT CHECK (frequency_tier IS NULL OR frequency_tier BETWEEN 1 AND 5),
  appears_every_year BOOLEAN,
  year_from         INT,
  year_to           INT,
  metadata          JSONB,
  computed_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (lemma, source_id)
);

CREATE INDEX IF NOT EXISTS idx_freq_lemma ON lexicon_frequencies(lemma);
CREATE INDEX IF NOT EXISTS idx_freq_source_tier ON lexicon_frequencies(source_id, frequency_tier);
CREATE INDEX IF NOT EXISTS idx_freq_source_rank ON lexicon_frequencies(source_id, rank_in_source);
CREATE INDEX IF NOT EXISTS idx_freq_appears_every_year ON lexicon_frequencies(source_id)
  WHERE appears_every_year = true;

COMMENT ON TABLE lexicon_frequencies IS 'Phase 1 신설. word_frequency_stats 를 대체할 정규화 빈도 사이드카. 출처별 분리 저장.';

-- RLS
ALTER TABLE lexicon_frequencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY lexicon_frequencies_select_all ON lexicon_frequencies
  FOR SELECT USING (true);
CREATE POLICY lexicon_frequencies_admin_write ON lexicon_frequencies
  FOR ALL TO service_role USING (true);

-- ── 3. 신규 빈도 출처 시드 (vendor 명칭 placeholder — 사용자 확정 후 변경) ──
-- 메모리 제약: vendor 명 (워드마스터/EBS) 직접 노출 금지. neutral key 사용.
INSERT INTO frequency_data_sources (source_key, citation, license, url) VALUES
  ('csat-prep-core-2k',  '수능 대비 핵심 어휘 2,000 (vendor placeholder — 확정 시 update)', 'fair-use',     NULL),
  ('csat-prep-ext-1.8k', '수능 대비 확장 어휘 ~1,800 (vendor placeholder — 확정 시 update)', 'fair-use',     NULL),
  ('ngsl',               'New General Service List 2.0 (Browne et al.)',                   'CC BY-SA 4.0', 'http://www.newgeneralservicelist.org'),
  ('awl',                'Academic Word List (Coxhead 2000)',                              'fair-use',     NULL),
  ('coca_top5k',         'COCA Top 5,000 (Davies)',                                        'paid',         NULL)
ON CONFLICT (source_key) DO NOTHING;

-- ── 4. lemma 컬럼 추가 (Phase 4 dual-write 준비) ──
ALTER TABLE vocabularies
  ADD COLUMN IF NOT EXISTS lemma TEXT REFERENCES shared_dictionary(word) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS extracted_surface TEXT,
  ADD COLUMN IF NOT EXISTS extracted_pos TEXT;

CREATE INDEX IF NOT EXISTS idx_vocabularies_lemma ON vocabularies(lemma)
  WHERE lemma IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vocabularies_user_lemma ON vocabularies(user_id, lemma)
  WHERE lemma IS NOT NULL;

ALTER TABLE shared_words
  ADD COLUMN IF NOT EXISTS lemma TEXT REFERENCES shared_dictionary(word) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_shared_words_lemma ON shared_words(lemma)
  WHERE lemma IS NOT NULL;

-- library_book_vocabularies / library_article_vocabularies 는 존재 여부 확인 후 처리
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='library_book_vocabularies') THEN
    EXECUTE 'ALTER TABLE library_book_vocabularies ADD COLUMN IF NOT EXISTS lemma TEXT REFERENCES shared_dictionary(word) ON DELETE SET NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_lbv_lemma ON library_book_vocabularies(lemma) WHERE lemma IS NOT NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='library_article_vocabularies') THEN
    EXECUTE 'ALTER TABLE library_article_vocabularies ADD COLUMN IF NOT EXISTS lemma TEXT REFERENCES shared_dictionary(word) ON DELETE SET NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_lav_lemma ON library_article_vocabularies(lemma) WHERE lemma IS NOT NULL';
  END IF;
END $$;

-- ── 5. 큐레이션 파이프라인 lemma_normalized 추가 ──
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='vocab_seed_candidates') THEN
    EXECUTE 'ALTER TABLE vocab_seed_candidates ADD COLUMN IF NOT EXISTS lemma_normalized TEXT';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_seed_lemma_norm ON vocab_seed_candidates(lemma_normalized) WHERE lemma_normalized IS NOT NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='vocab_enrichment_queue') THEN
    EXECUTE 'ALTER TABLE vocab_enrichment_queue ADD COLUMN IF NOT EXISTS lemma_normalized TEXT';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='vocab_dict_hits') THEN
    EXECUTE 'ALTER TABLE vocab_dict_hits ADD COLUMN IF NOT EXISTS lemma_normalized TEXT';
  END IF;
END $$;

-- ── 검증 1: shared_dictionary 신규 컬럼 ──
DO $$
DECLARE v_added INT;
BEGIN
  SELECT COUNT(*) INTO v_added
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'shared_dictionary'
    AND column_name IN ('senses','primary_pos','pos_set','ipa_uk','ipa_us',
                        'cefr_confidence','domain_tags','frequency_score',
                        'frequency_band','verified_by','verified_at');
  IF v_added <> 11 THEN
    RAISE EXCEPTION 'shared_dictionary 신규 컬럼 추가 실패: % / 11', v_added;
  END IF;
  RAISE NOTICE '검증 1 통과: shared_dictionary 신규 컬럼 % / 11', v_added;
END $$;

-- ── 검증 2: lexicon_frequencies 테이블 + 인덱스 ──
DO $$
DECLARE
  v_table_exists BOOLEAN;
  v_index_count INT;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'lexicon_frequencies'
  ) INTO v_table_exists;
  IF NOT v_table_exists THEN
    RAISE EXCEPTION 'lexicon_frequencies 테이블 생성 실패';
  END IF;

  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes WHERE schemaname='public' AND tablename='lexicon_frequencies';
  IF v_index_count < 4 THEN
    RAISE EXCEPTION 'lexicon_frequencies 인덱스 부족: % / 4', v_index_count;
  END IF;
  RAISE NOTICE '검증 2 통과: lexicon_frequencies + % 인덱스', v_index_count;
END $$;

-- ── 검증 3: 신규 출처 시드 ──
DO $$
DECLARE v_sources INT;
BEGIN
  SELECT COUNT(*) INTO v_sources
  FROM frequency_data_sources
  WHERE source_key IN ('csat-prep-core-2k','csat-prep-ext-1.8k','ngsl','awl','coca_top5k');
  IF v_sources < 5 THEN
    RAISE EXCEPTION '빈도 출처 시드 누락: % / 5', v_sources;
  END IF;
  RAISE NOTICE '검증 3 통과: 신규 빈도 출처 % / 5', v_sources;
END $$;

-- ── 검증 4: lemma 컬럼 추가 (필수 2 테이블) ──
DO $$
DECLARE v_lemma_cols INT;
BEGIN
  SELECT COUNT(*) INTO v_lemma_cols
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name IN ('vocabularies','shared_words')
    AND column_name='lemma';
  IF v_lemma_cols <> 2 THEN
    RAISE EXCEPTION 'lemma 컬럼 추가 누락: % / 2 필수 테이블', v_lemma_cols;
  END IF;
  RAISE NOTICE '검증 4 통과: 필수 테이블에 lemma 컬럼 추가됨';
END $$;

-- ── 검증 5: 데이터 보존 ──
DO $$
DECLARE
  v_sd INT; v_vocab INT;
BEGIN
  SELECT COUNT(*) INTO v_sd FROM shared_dictionary;
  SELECT COUNT(*) INTO v_vocab FROM vocabularies;
  RAISE NOTICE '검증 5 — 데이터 보존: shared_dictionary=% / vocabularies=%', v_sd, v_vocab;
  IF v_sd < 38000 THEN
    RAISE EXCEPTION '데이터 손실 의심 — 마이그레이션 중단';
  END IF;
END $$;

-- ── 6. word_lexicon INSERT 동결 (Phase E 에서 DROP 예정) ──
-- 이유: "신규 INSERT 동결" 정책을 코드 레벨에 의존하면 누락 위험.
-- 5/19 KICE 13y sprint 스크립트가 재실행돼도 즉시 차단되도록 트리거로 강제.
CREATE OR REPLACE FUNCTION reject_word_lexicon_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'word_lexicon is FROZEN since lexicon-phase-1 (20260520). New words must go to shared_dictionary instead. See docs/proposals/lexicon-unification/.';
END;
$$;

DROP TRIGGER IF EXISTS trg_word_lexicon_freeze ON word_lexicon;
CREATE TRIGGER trg_word_lexicon_freeze
BEFORE INSERT ON word_lexicon
FOR EACH ROW EXECUTE FUNCTION reject_word_lexicon_insert();

COMMENT ON TABLE word_lexicon IS 'FROZEN since 20260520. Phase 1 lexicon unification. New INSERTs blocked by trigger. Will be DROPped in Phase E. 5,421 existing rows preserved.';

DO $$ BEGIN RAISE NOTICE '검증 6 통과: word_lexicon INSERT 동결 트리거 설치됨'; END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK 스크립트 (필요시 별도 실행):
--
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_word_lexicon_freeze ON word_lexicon;
-- DROP FUNCTION IF EXISTS reject_word_lexicon_insert();
-- ALTER TABLE shared_dictionary
--   DROP COLUMN IF EXISTS senses, DROP COLUMN IF EXISTS primary_pos,
--   DROP COLUMN IF EXISTS pos_set, DROP COLUMN IF EXISTS ipa_uk,
--   DROP COLUMN IF EXISTS ipa_us, DROP COLUMN IF EXISTS cefr_confidence,
--   DROP COLUMN IF EXISTS domain_tags, DROP COLUMN IF EXISTS frequency_score,
--   DROP COLUMN IF EXISTS frequency_band, DROP COLUMN IF EXISTS verified_by,
--   DROP COLUMN IF EXISTS verified_at;
-- DROP TABLE IF EXISTS lexicon_frequencies CASCADE;
-- ALTER TABLE vocabularies
--   DROP COLUMN IF EXISTS lemma, DROP COLUMN IF EXISTS extracted_surface,
--   DROP COLUMN IF EXISTS extracted_pos;
-- ALTER TABLE shared_words DROP COLUMN IF EXISTS lemma;
-- ALTER TABLE library_book_vocabularies DROP COLUMN IF EXISTS lemma;
-- ALTER TABLE library_article_vocabularies DROP COLUMN IF EXISTS lemma;
-- ALTER TABLE vocab_seed_candidates DROP COLUMN IF EXISTS lemma_normalized;
-- ALTER TABLE vocab_enrichment_queue DROP COLUMN IF EXISTS lemma_normalized;
-- ALTER TABLE vocab_dict_hits DROP COLUMN IF EXISTS lemma_normalized;
-- DELETE FROM frequency_data_sources
--   WHERE source_key IN ('csat-prep-core-2k','csat-prep-ext-1.8k','ngsl','awl','coca_top5k');
-- COMMIT;
-- ═══════════════════════════════════════════════════════════════════════════
