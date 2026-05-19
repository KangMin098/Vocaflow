-- =====================================================================
-- KICE 13y sprint #17 — kice_csat_load_history (적재 이력 테이블)
--
-- 본 sprint 종료 시 row 1건 INSERT.
-- 추후 연도 추가 시 (2027~) 새 row 누적.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS kice_csat_load_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loaded_at   TIMESTAMPTZ DEFAULT now(),
  year_from   INT NOT NULL,
  year_to     INT NOT NULL,
  total_files INT NOT NULL,
  total_rows  INT NOT NULL,
  agg_rows    INT NOT NULL,
  notes       TEXT
);

CREATE INDEX IF NOT EXISTS idx_kice_load_history_date
  ON kice_csat_load_history(loaded_at DESC);

-- RLS — admin 만 접근 (기본은 RLS 활성 + INSERT 정책 미발행 → service_role 만)
ALTER TABLE kice_csat_load_history ENABLE ROW LEVEL SECURITY;

COMMIT;
