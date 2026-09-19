-- supabase/migrations/20260808180000_comic_gen_observability.sql
--
-- CCP 드레인 관측(observability) + 테스트 — 생성 블랙박스를 투명화.
--   ① comic_gen_runs   — 도서별 드레인 실행 1건(백엔드/사이트/모델·상태·진행·비용·자기발전 횟수)
--   ② comic_panel_events — 컷 단위 작업/평가 이력(위치·시도횟수·phase·상태·점수·판정·소요)
--   ③ comic_gen_tests  — 테스트 모드(더 나은 파이프라인 실험 · A/B · 결과 비교)
--   드레인(service role)이 직접 write, admin 콘솔이 read. RLS admin/curator.
--   적용: 사용자 승인 후.

-- ① 실행(run)
CREATE TABLE IF NOT EXISTS comic_gen_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  library_book_id uuid NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
  backend         text,           -- 'gpt-image-2' | 'flux2-dev' | 'qwen-2512' | 'z-image' ...
  model           text,           -- 세부 체크포인트/버전
  site            text,           -- 'openai-api' | 'runpod-comfyui' | 'dashscope' | 'local'
  style           text,           -- 'gonick'
  status          text NOT NULL DEFAULT 'running' CHECK (status IN ('queued','running','done','failed','cancelled')),
  panels_total    int NOT NULL DEFAULT 0,
  panels_done     int NOT NULL DEFAULT 0,
  panels_pass     int NOT NULL DEFAULT 0,
  panels_fail     int NOT NULL DEFAULT 0,
  iterations      int NOT NULL DEFAULT 0,   -- 총 자기발전(재생성) 반복 횟수
  verbatim_mismatch int NOT NULL DEFAULT 0,
  rule_violations   int NOT NULL DEFAULT 0,
  cost_usd        numeric,
  note            text,
  error           text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cgr_book ON comic_gen_runs (library_book_id, started_at DESC);
CREATE TRIGGER trg_cgr_updated BEFORE UPDATE ON comic_gen_runs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE comic_gen_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_curator_cgr ON comic_gen_runs;
CREATE POLICY admin_curator_cgr ON comic_gen_runs FOR ALL USING (is_admin_or_curator()) WITH CHECK (is_admin_or_curator());

-- ② 컷 이벤트(작업/평가 이력)
CREATE TABLE IF NOT EXISTS comic_panel_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          uuid REFERENCES comic_gen_runs(id) ON DELETE CASCADE,
  library_book_id uuid NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
  chapter_idx     int,
  page_order      int,
  attempt         int NOT NULL DEFAULT 1,   -- 몇 번째 시도(자기발전 반복)
  phase           text,   -- 'gen'|'panel_qc'|'repair'|'cross'|'verbatim'|'book'|'story'|'insert'
  status          text,   -- 'pass'|'fail'|'repairing'|'pending'|'skipped'
  score           numeric,-- 품질 점수 0-100
  verdict         jsonb,  -- {rule_violations:[R..], verbatim_mismatch:[..], reason:...}
  backend         text,
  duration_ms     int,
  message         text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cpe_run ON comic_panel_events (run_id, chapter_idx, page_order, attempt);
CREATE INDEX IF NOT EXISTS idx_cpe_book ON comic_panel_events (library_book_id, created_at);
ALTER TABLE comic_panel_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_curator_cpe ON comic_panel_events;
CREATE POLICY admin_curator_cpe ON comic_panel_events FOR ALL USING (is_admin_or_curator()) WITH CHECK (is_admin_or_curator());

-- ③ 테스트(실험) 모드
CREATE TABLE IF NOT EXISTS comic_gen_tests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  library_book_id uuid REFERENCES library_books(id) ON DELETE SET NULL,
  label           text NOT NULL,
  backend         text,
  model           text,
  site            text,
  style           text,
  params          jsonb,   -- steps/cfg/guidance/refs/size 등 실험 파라미터
  sample          jsonb,   -- 대상 컷/시나리오
  status          text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','running','done','failed')),
  result          jsonb,   -- {scores, cost, notes, sample_urls[]}
  cost_usd        numeric,
  note            text,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cgt_created ON comic_gen_tests (created_at DESC);
CREATE TRIGGER trg_cgt_updated BEFORE UPDATE ON comic_gen_tests FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE comic_gen_tests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_curator_cgt ON comic_gen_tests;
CREATE POLICY admin_curator_cgt ON comic_gen_tests FOR ALL USING (is_admin_or_curator()) WITH CHECK (is_admin_or_curator());

COMMENT ON TABLE comic_gen_runs IS 'CCP 드레인 실행 관측 — 백엔드/사이트/상태/진행/자기발전 횟수';
COMMENT ON TABLE comic_panel_events IS 'CCP 컷 단위 작업·평가 이력 — 위치/시도/phase/상태/점수/판정';
COMMENT ON TABLE comic_gen_tests IS 'CCP 생성 파이프라인 테스트(실험) — A/B·파라미터·결과 비교';
