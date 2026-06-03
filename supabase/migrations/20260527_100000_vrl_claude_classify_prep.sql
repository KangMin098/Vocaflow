-- ════════════════════════════════════════════════════════════════════
-- VRL Claude Code 재분류 — Phase 0: Backup + 새 컬럼
-- ════════════════════════════════════════════════════════════════════
-- 작성: 2026-05-23
-- 배경: SQL rule 기계 분류의 부정확성 확인 (vegetable=L5, hoodie=L5, bard=L9 등).
--       Claude Code 자체 (LLM) 가 의미적 재분류 진행.
-- 범위: 기존 4 컬럼 rename (백업) + 새 4 컬럼 추가 + 메타 컬럼 + 인덱스.
--       데이터 변경 0 — UPDATE 는 Phase 2 부터 (batched).
-- 안전: 단일 트랜잭션. ALTER RENAME 은 데이터 손실 X (포인터만 변경).
--       검증 가드 — 백업 컬럼 38,000+ row 보존 확인.
-- ════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────
-- 1. 기존 컬럼 rename (백업 보존)
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE shared_dictionary RENAME COLUMN v_level         TO v_level_rule_v1;
ALTER TABLE shared_dictionary RENAME COLUMN track_levels    TO track_levels_rule_v1;
ALTER TABLE shared_dictionary RENAME COLUMN domain_levels   TO domain_levels_rule_v1;
ALTER TABLE shared_dictionary RENAME COLUMN skill_level     TO skill_level_rule_v1;
-- skill_type / vrl_calculated_at 는 유지 (Phase 2 에서 Claude 결과로 덮어쓰기)
-- vrl_calculated_at 은 rule_v1 시점 기록 — Phase 2 시 새로 갱신

-- 인덱스 rename (CASCADE 자동 — postgres 가 인덱스 컬럼 이름 자동 갱신)
-- 단, 명시적 rename 으로 명확화
ALTER INDEX IF EXISTS idx_sd_v_level        RENAME TO idx_sd_v_level_rule_v1;
ALTER INDEX IF EXISTS idx_sd_skill_level    RENAME TO idx_sd_skill_level_rule_v1;
ALTER INDEX IF EXISTS idx_sd_track_levels   RENAME TO idx_sd_track_levels_rule_v1;
ALTER INDEX IF EXISTS idx_sd_domain_levels  RENAME TO idx_sd_domain_levels_rule_v1;


-- ─────────────────────────────────────────────────────────────────
-- 2. 새 컬럼 추가 (Claude Code 분류 결과용)
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE shared_dictionary
  ADD COLUMN v_level                SMALLINT CHECK (v_level BETWEEN 0 AND 11),
  ADD COLUMN track_levels           JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN domain_levels          JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN skill_level            SMALLINT CHECK (skill_level BETWEEN 1 AND 5),
  ADD COLUMN claude_reasoning       TEXT,
  ADD COLUMN classified_by          TEXT
    CHECK (classified_by IN ('rule_v1', 'claude_code_opus_4_7', 'claude_code_sonnet_4_6')),
  ADD COLUMN claude_classified_at   TIMESTAMPTZ;

COMMENT ON COLUMN shared_dictionary.v_level IS
  'VRL 종합 레벨 0-11. Claude Code 의미적 분류 결과. Phase 2 부터 채움. rule_v1 백업은 v_level_rule_v1.';
COMMENT ON COLUMN shared_dictionary.claude_reasoning IS
  'Claude Code 가 v_level/track/domain 결정한 1-2 문장 한국 학습자 관점 근거.';
COMMENT ON COLUMN shared_dictionary.classified_by IS
  '분류 출처. rule_v1 = SQL rule 기계 분류 (Day 1-3 deprecated). claude_code_* = LLM 의미 분류.';


-- ─────────────────────────────────────────────────────────────────
-- 3. 새 인덱스
-- ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_sd_v_level             ON shared_dictionary (v_level);
CREATE INDEX idx_sd_skill_level         ON shared_dictionary (skill_level);
CREATE INDEX idx_sd_track_levels        ON shared_dictionary USING GIN (track_levels);
CREATE INDEX idx_sd_domain_levels       ON shared_dictionary USING GIN (domain_levels);
CREATE INDEX idx_sd_classified_by       ON shared_dictionary (classified_by)
  WHERE classified_by IS NOT NULL;
CREATE INDEX idx_sd_claude_classified_at ON shared_dictionary (claude_classified_at)
  WHERE claude_classified_at IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────
-- 4. Sample 검증용 임시 테이블 (Phase 1)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS claude_classification_samples (
  sample_id            SERIAL PRIMARY KEY,
  word                 TEXT NOT NULL REFERENCES shared_dictionary(word) ON DELETE CASCADE,
  round_label          TEXT NOT NULL,
  v_level_rule_v1      SMALLINT,
  v_level_predicted    SMALLINT CHECK (v_level_predicted BETWEEN 0 AND 11),
  diff                 INT GENERATED ALWAYS AS (v_level_predicted - v_level_rule_v1) STORED,
  track_levels         JSONB,
  domain_levels        JSONB,
  skill_type           TEXT,
  skill_level          SMALLINT,
  claude_reasoning     TEXT,
  classified_model     TEXT DEFAULT 'claude_code_opus_4_7',
  created_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ccs_round         ON claude_classification_samples (round_label, created_at DESC);
CREATE INDEX idx_ccs_diff_abs      ON claude_classification_samples (round_label, abs(diff) DESC);


-- ─────────────────────────────────────────────────────────────────
-- 5. 검증 ASSERT
-- ─────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_backup_count INT;
  v_new_v_null INT;
BEGIN
  -- 백업 컬럼 데이터 보존 확인
  SELECT COUNT(*) INTO v_backup_count
  FROM shared_dictionary WHERE v_level_rule_v1 IS NOT NULL;

  IF v_backup_count < 38000 THEN
    RAISE EXCEPTION '백업 컬럼 데이터 손실 의심: v_level_rule_v1 % rows (38,000+ 기대)', v_backup_count;
  END IF;

  -- 새 컬럼은 모두 NULL 이어야 함 (아직 Phase 2 미진행)
  SELECT COUNT(*) INTO v_new_v_null
  FROM shared_dictionary WHERE v_level IS NULL;

  IF v_new_v_null < 38000 THEN
    RAISE EXCEPTION '새 v_level 이 사전 채워짐: NULL row %개 (38,000+ 기대)', v_new_v_null;
  END IF;

  -- 인덱스 확인
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sd_v_level_rule_v1') THEN
    RAISE EXCEPTION '백업 인덱스 idx_sd_v_level_rule_v1 누락';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sd_v_level') THEN
    RAISE EXCEPTION '새 인덱스 idx_sd_v_level 누락';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sd_classified_by') THEN
    RAISE EXCEPTION '새 인덱스 idx_sd_classified_by 누락';
  END IF;

  -- 임시 테이블 확인
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'claude_classification_samples') THEN
    RAISE EXCEPTION 'claude_classification_samples 테이블 누락';
  END IF;

  RAISE NOTICE '✓ Phase 0 완료';
  RAISE NOTICE '  백업 보존 v_level_rule_v1: % rows', v_backup_count;
  RAISE NOTICE '  새 v_level NULL: % rows (Phase 2 대기)', v_new_v_null;
END $$;


-- ════════════════════════════════════════════════════════════════════
-- 다음 단계:
--   Phase 1: Sample 50 (Level 7 rule_v1 무작위) — Claude Code 직접 분류
--   Phase 2: Level 7 전체 3,202 row — batch 100/turn
--   Round 2+: Level 6, 5, 8 등 (별도 결정)
-- ════════════════════════════════════════════════════════════════════
