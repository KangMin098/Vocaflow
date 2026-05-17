-- ============================================================
-- validate-sample.sql — C-0 산출물 스키마 fit 검증
-- ============================================================
-- 목적: data/seed/sample_kice_frequency.csv (22행) 을 staging 으로
--       적재하여 v2.1 스키마 (word_lexicon / lexicon_source_tags /
--       word_frequency_stats) 가 모든 컬럼을 손실 없이 받을 수 있는지 검증.
--
-- 안전: BEGIN ... ROLLBACK 으로 감싸 실제 DB 에 흔적을 남기지 않음.
--       검증 후 COMMIT 으로 전환하지 마세요 — A 단계에서 정식 마이그레이션 적용 후
--       별도 seed 스크립트로 적재합니다.
--
-- 사전 조건: v2.1 스키마 DDL 이 적용된 환경. 미적용 상태에서는
--           CREATE TABLE 부터 임시로 실행 (또는 dry-run 으로 staging 만 검증).
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────
-- 1) Staging 테이블 (CSV row 1:1 매핑)
-- ────────────────────────────────────────────────
CREATE TEMP TABLE _stage_lexicon (
  lemma                TEXT NOT NULL,
  pos                  TEXT NOT NULL,
  meaning_ko           TEXT NOT NULL,
  meaning_ko_alt       TEXT,
  ipa                  TEXT,
  cefr                 TEXT,
  ncic_grade           TEXT,
  kice_raw_count       INT,
  kice_years_appeared  TEXT,
  csat_first_year      INT
);

-- CSV 적재 (psql client 에서 실행):
--   \copy _stage_lexicon FROM 'data/seed/sample_kice_frequency.csv' WITH CSV HEADER NULL ''

-- ────────────────────────────────────────────────
-- 2) Staging 자체 검증 (적재 전)
-- ────────────────────────────────────────────────
-- 2-1) 행 수 확인 (헤더 제외 22)
DO $$
DECLARE n INT;
BEGIN
  SELECT count(*) INTO n FROM _stage_lexicon;
  IF n <> 22 THEN
    RAISE EXCEPTION 'expected 22 rows, got %', n;
  END IF;
END $$;

-- 2-2) (lemma, pos) 중복 없음 — UNIQUE 제약 시뮬레이션
DO $$
DECLARE dup INT;
BEGIN
  SELECT count(*) INTO dup
  FROM (SELECT lemma, pos FROM _stage_lexicon GROUP BY lemma, pos HAVING count(*) > 1) t;
  IF dup > 0 THEN
    RAISE EXCEPTION 'duplicate (lemma, pos) found: % groups', dup;
  END IF;
END $$;

-- 2-3) Tier 5 분포 점검 (raw_count ≥ 10 행이 6개)
DO $$
DECLARE n INT;
BEGIN
  SELECT count(*) INTO n FROM _stage_lexicon WHERE kice_raw_count >= 10;
  IF n <> 6 THEN
    RAISE EXCEPTION 'expected 6 tier-5 rows, got %', n;
  END IF;
END $$;

-- ────────────────────────────────────────────────
-- 3) word_lexicon 적재
-- ────────────────────────────────────────────────
INSERT INTO word_lexicon (lemma, part_of_speech, meaning_ko, meaning_ko_alt, ipa, cefr_level)
SELECT
  lemma,
  pos,
  meaning_ko,
  CASE
    WHEN meaning_ko_alt IS NULL OR meaning_ko_alt = ''
      THEN NULL
    ELSE string_to_array(meaning_ko_alt, ';')
  END,
  ipa,
  cefr
FROM _stage_lexicon
ON CONFLICT (lemma, part_of_speech) DO NOTHING;

-- ────────────────────────────────────────────────
-- 4) lexicon_source_tags 적재 — NCIC + KICE 출제이력
-- ────────────────────────────────────────────────
-- 4-1) NCIC 기본 (22 행 전부)
INSERT INTO lexicon_source_tags (lexicon_id, source, metadata)
SELECT
  wl.id,
  'ncic_basic',
  jsonb_build_object('grade', s.ncic_grade)
FROM _stage_lexicon s
JOIN word_lexicon wl
  ON wl.lemma = s.lemma AND wl.part_of_speech = s.pos
ON CONFLICT (lexicon_id, source) DO NOTHING;

-- 4-2) KICE 출제이력 (kice_raw_count > 0 인 20 행)
INSERT INTO lexicon_source_tags (lexicon_id, source, metadata)
SELECT
  wl.id,
  'kice_csat',
  jsonb_build_object('first_year', s.csat_first_year)
FROM _stage_lexicon s
JOIN word_lexicon wl
  ON wl.lemma = s.lemma AND wl.part_of_speech = s.pos
WHERE s.kice_raw_count > 0
ON CONFLICT (lexicon_id, source) DO NOTHING;

-- ────────────────────────────────────────────────
-- 5) word_frequency_stats 적재 (kice_csat_recent 2014~2024)
-- ────────────────────────────────────────────────
INSERT INTO word_frequency_stats
  (lexicon_id, source, year_from, year_to, raw_count, metadata, citation)
SELECT
  wl.id,
  'kice_csat_recent',
  2014, 2024,
  s.kice_raw_count,
  jsonb_build_object(
    'years_appeared',
      string_to_array(s.kice_years_appeared, ';')::int[],
    'appears_every_year',
      (array_length(string_to_array(s.kice_years_appeared, ';'), 1) = 11)
  ),
  'KICE 2014-2024 수능 영어영역 자체 분석 (sample)'
FROM _stage_lexicon s
JOIN word_lexicon wl
  ON wl.lemma = s.lemma AND wl.part_of_speech = s.pos
WHERE s.kice_raw_count > 0;

-- ────────────────────────────────────────────────
-- 6) 검증 쿼리 5종
-- ────────────────────────────────────────────────

-- 6-1) Tier 자동 계산 검증 (트리거가 frequency_tier 채우는지)
\echo '── 6-1) Tier 분포 ──'
SELECT frequency_tier, count(*) AS rows
FROM word_frequency_stats
WHERE source = 'kice_csat_recent'
GROUP BY frequency_tier
ORDER BY frequency_tier DESC;
-- 기대: tier 5 = 6, 4 = 7, 3 = 5, 2 = 2  (총 20)

-- 6-2) 다품사 분리 검증 — bear/run/present 각 2 row
\echo '── 6-2) 다품사 분리 ──'
SELECT lemma, part_of_speech, meaning_ko
FROM word_lexicon
WHERE lemma IN ('bear', 'run', 'present')
ORDER BY lemma, part_of_speech;
-- 기대: 6 행 (3 lemma × 2 pos)

-- 6-3) JSONB metadata 구조 검증
\echo '── 6-3) metadata JSONB 구조 ──'
SELECT
  wl.lemma,
  wfs.raw_count,
  wfs.metadata->>'appears_every_year' AS every_year,
  jsonb_array_length(wfs.metadata->'years_appeared') AS years_count
FROM word_frequency_stats wfs
JOIN word_lexicon wl ON wl.id = wfs.lexicon_id
WHERE wfs.source = 'kice_csat_recent'
ORDER BY wfs.raw_count DESC
LIMIT 5;
-- 기대: ability/acquire/adapt 등 raw_count ≥ 29 & every_year = true

-- 6-4) NCIC 등록되었지만 KICE 미출제 — kice_csat 태그 부재로 derive
\echo '── 6-4) NCIC 만 등록 (미출제) ──'
SELECT wl.lemma, wl.part_of_speech, wl.cefr_level
FROM word_lexicon wl
WHERE EXISTS (
  SELECT 1 FROM lexicon_source_tags t
  WHERE t.lexicon_id = wl.id AND t.source = 'ncic_basic'
)
AND NOT EXISTS (
  SELECT 1 FROM lexicon_source_tags t
  WHERE t.lexicon_id = wl.id AND t.source = 'kice_csat'
);
-- 기대: diligent (B2), hometown (A2) — 2 행

-- 6-5) CEFR 분포 (적재 후)
\echo '── 6-5) CEFR 분포 ──'
SELECT cefr_level, count(*)
FROM word_lexicon
GROUP BY cefr_level
ORDER BY cefr_level;
-- 기대: A1=1, A2=4, B1=5, B2=6, C1=6

-- ────────────────────────────────────────────────
-- 7) ROLLBACK — 검증만 수행, DB 흔적 X
-- ────────────────────────────────────────────────
ROLLBACK;
