-- =====================================================================
-- Vocaflow v2.1 Lexicon Schema (DRAFT — corrected per Issue 1·2·3)
--
-- 정정 이력 (이전 버전 대비):
--   Issue 1: primary_sentence_id 컬럼 제거 → 15_lexicon_primary_sentence.sql 로 분리
--            (sentences 테이블이 아직 마이그레이션에 없으므로 FK 가 깨짐)
--   Issue 2: 상단에 prereq 체크 블록 추가 (set_updated_at, shared_words 존재 검증)
--   Issue 3: 두 plpgsql 함수에 SET search_path = public, pg_temp 추가
--            (Supabase BLOCKER 3 패턴 — §18.9)
--
-- 적용 순서:
--   1. 01~11 (기존 마이그레이션, set_updated_at + shared_words 포함)
--   2. (선택) sentences 테이블 마이그레이션 — userMemories v2 설계 SQL 구현
--   3. 본 파일 (14_lexicon_v2_1.sql 로 rename)
--   4. 15_lexicon_primary_sentence.sql — sentences 적용 후 primary_sentence_id ADD COLUMN
--   5. (별도 PR) migration-shared-words-to-lexicon.sql — 데이터 백필
-- =====================================================================

BEGIN;

-- ════════════════════════════════════════════════
-- 0) Prerequisites 체크
-- ════════════════════════════════════════════════
DO $$
DECLARE
  missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- 필수: set_updated_at 함수 (11_triggers_and_rls.sql)
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    missing := missing || 'function:set_updated_at — apply 11_triggers_and_rls.sql first'::TEXT;
  END IF;

  -- 필수: shared_words 테이블 (ALTER 대상)
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shared_words') THEN
    missing := missing || 'table:shared_words — apply 05_shared_library_tables.sql first'::TEXT;
  END IF;

  IF array_length(missing, 1) > 0 THEN
    RAISE EXCEPTION 'Missing prerequisites: %', array_to_string(missing, E'\n  - ');
  END IF;

  -- 선택: sentences 테이블 (없으면 primary_sentence_id 컬럼 추가 SKIP — 15번에서 별도)
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sentences') THEN
    RAISE NOTICE 'sentences table not found — primary_sentence_id will be added later via 15_lexicon_primary_sentence.sql';
  END IF;

  RAISE NOTICE 'Prerequisites OK';
END $$;


-- ════════════════════════════════════════════════
-- 1) 의존 extension
-- ════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;


-- ════════════════════════════════════════════════
-- 2) frequency_data_sources — 빈도 출처 마스터
-- ════════════════════════════════════════════════
CREATE TABLE frequency_data_sources (
  id           SMALLSERIAL PRIMARY KEY,
  source_key   TEXT NOT NULL UNIQUE,
  citation     TEXT NOT NULL,
  license      TEXT NOT NULL,
  url          TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

INSERT INTO frequency_data_sources (source_key, citation, license, url) VALUES
  ('kice_csat',        'KICE 수능 영어영역 전체 기출 (1994~)',  '공공누리 제1유형', 'https://www.kice.re.kr'),
  ('kice_csat_recent', 'KICE 2014-2024 수능 영어영역 자체 분석', '공공누리 제1유형', 'https://www.kice.re.kr'),
  ('kice_mock',        'KICE 평가원 모의평가 6월·9월',           '공공누리 제1유형', 'https://www.kice.re.kr'),
  ('ebs_textbook',     'EBS 수능특강·완성 어휘 분석',            '제한적 — 자체 분석분만', NULL),
  ('academic_paper',   '학술 논문 부록 빈도 데이터',              '인용 의무', NULL),
  ('coca',             'COCA top 5,000 (BYU)',                  'Free for research', 'https://www.english-corpora.org/coca/');


-- ════════════════════════════════════════════════
-- 3) word_lexicon — 단어 마스터
-- ════════════════════════════════════════════════
-- ※ Issue 1: primary_sentence_id 컬럼 의도적 부재.
--   sentences 테이블 적용 후 15_lexicon_primary_sentence.sql 에서 별도 ADD.
CREATE TABLE word_lexicon (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lemma                 TEXT NOT NULL CHECK (lemma = LOWER(lemma) AND lemma = TRIM(lemma)),
  part_of_speech        TEXT NOT NULL CHECK (part_of_speech IN (
    'n','v','adj','adv','prep','conj','pron','det','interj','phrase'
  )),
  meaning_ko            TEXT NOT NULL,
  meaning_ko_alt        TEXT[],
  ipa                   TEXT,
  pronunciation_us      TEXT,
  cefr_level            TEXT CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (lemma, part_of_speech)
);

CREATE INDEX idx_lexicon_lemma      ON word_lexicon(lemma);
CREATE INDEX idx_lexicon_cefr       ON word_lexicon(cefr_level);
CREATE INDEX idx_lexicon_lemma_trgm ON word_lexicon USING gin (lemma gin_trgm_ops);
CREATE INDEX idx_lexicon_alt_gin    ON word_lexicon USING gin (meaning_ko_alt);


-- ════════════════════════════════════════════════
-- 4) lexicon_source_tags — 단어 ↔ 출처 N:M
-- ════════════════════════════════════════════════
CREATE TABLE lexicon_source_tags (
  lexicon_id   UUID NOT NULL REFERENCES word_lexicon(id) ON DELETE CASCADE,
  source       TEXT NOT NULL CHECK (source IN (
    'ncic_basic','ncic_extended','kice_csat','kice_mock',
    'ebs_textbook','middle_school','high_school'
  )),
  metadata     JSONB,
  added_at     TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (lexicon_id, source)
);

CREATE INDEX idx_source_tags_source       ON lexicon_source_tags(source);
CREATE INDEX idx_source_tags_metadata_gin ON lexicon_source_tags USING gin (metadata);


-- ════════════════════════════════════════════════
-- 5) word_frequency_stats — 출제 빈도 통계
-- ════════════════════════════════════════════════
CREATE TABLE word_frequency_stats (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lexicon_id            UUID NOT NULL REFERENCES word_lexicon(id) ON DELETE CASCADE,
  data_source_id        SMALLINT NOT NULL REFERENCES frequency_data_sources(id),
  source                TEXT NOT NULL,
  year_from             INT,
  year_to               INT,
  raw_count             INT NOT NULL CHECK (raw_count > 0),
  normalized_freq       NUMERIC(10,4),
  rank_in_source        INT,
  frequency_tier        SMALLINT CHECK (frequency_tier BETWEEN 1 AND 5),
  appears_every_year    BOOLEAN DEFAULT false,
  metadata              JSONB DEFAULT '{}'::jsonb,
  computed_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE (lexicon_id, source, year_from, year_to)
);

CREATE INDEX idx_freq_lexicon       ON word_frequency_stats(lexicon_id);
CREATE INDEX idx_freq_source_rank   ON word_frequency_stats(source, rank_in_source);
CREATE INDEX idx_freq_source_tier   ON word_frequency_stats(source, frequency_tier);
CREATE INDEX idx_freq_every_year    ON word_frequency_stats(appears_every_year) WHERE appears_every_year = true;
CREATE INDEX idx_freq_metadata_gin  ON word_frequency_stats USING gin (metadata);


-- ════════════════════════════════════════════════
-- 6) shared_words ALTER — lexicon 참조 추가
-- ════════════════════════════════════════════════
ALTER TABLE shared_words
  ADD COLUMN IF NOT EXISTS lexicon_id UUID REFERENCES word_lexicon(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_shared_words_lexicon ON shared_words(lexicon_id);


-- ════════════════════════════════════════════════
-- 7) Tier 자동 계산 함수 (절대 경계 a)
-- ════════════════════════════════════════════════
-- ※ Issue 3: SET search_path 명시 (Supabase BLOCKER 3 패턴 — §18.9)
CREATE OR REPLACE FUNCTION compute_frequency_tier(p_raw_count INT)
RETURNS SMALLINT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  -- raw_count = 0 행은 CHECK 로 차단되므로 도달 X (방어적 NULL 반환)
  RETURN CASE
    WHEN p_raw_count >= 10 THEN 5
    WHEN p_raw_count >= 4  THEN 4
    WHEN p_raw_count >= 2  THEN 3
    WHEN p_raw_count >= 1  THEN 2
    ELSE NULL
  END;
END;
$$;


-- ════════════════════════════════════════════════
-- 8) freq_stats 자동 채움 트리거 — tier + appears_every_year
-- ════════════════════════════════════════════════
-- ※ Issue 3: SET search_path 명시
CREATE OR REPLACE FUNCTION auto_compute_freq_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  years_array INT[];
  year_span INT;
BEGIN
  NEW.frequency_tier := compute_frequency_tier(NEW.raw_count);

  IF NEW.metadata ? 'years_appeared'
     AND NEW.year_from IS NOT NULL
     AND NEW.year_to IS NOT NULL
  THEN
    years_array := ARRAY(SELECT jsonb_array_elements_text(NEW.metadata->'years_appeared'))::INT[];
    year_span := NEW.year_to - NEW.year_from + 1;
    NEW.appears_every_year := (COALESCE(array_length(years_array, 1), 0) = year_span);
  ELSE
    NEW.appears_every_year := false;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_freq_auto_compute
  BEFORE INSERT OR UPDATE OF raw_count, metadata, year_from, year_to
  ON word_frequency_stats
  FOR EACH ROW EXECUTE FUNCTION auto_compute_freq_fields();


-- ════════════════════════════════════════════════
-- 9) updated_at 트리거 (Issue 2: set_updated_at 존재 검증은 0번에서 완료)
-- ════════════════════════════════════════════════
CREATE TRIGGER trg_lexicon_updated
  BEFORE UPDATE ON word_lexicon
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ════════════════════════════════════════════════
-- 10) RLS — 공용 자원, 모든 인증 사용자 SELECT
-- ════════════════════════════════════════════════
ALTER TABLE word_lexicon              ENABLE ROW LEVEL SECURITY;
ALTER TABLE lexicon_source_tags       ENABLE ROW LEVEL SECURITY;
ALTER TABLE word_frequency_stats      ENABLE ROW LEVEL SECURITY;
ALTER TABLE frequency_data_sources    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read all" ON word_lexicon              FOR SELECT USING (true);
CREATE POLICY "read all" ON lexicon_source_tags       FOR SELECT USING (true);
CREATE POLICY "read all" ON word_frequency_stats      FOR SELECT USING (true);
CREATE POLICY "read all" ON frequency_data_sources    FOR SELECT USING (true);

COMMIT;
