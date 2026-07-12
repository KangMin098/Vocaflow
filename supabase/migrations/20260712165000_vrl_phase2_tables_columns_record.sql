-- VRL Phase 2 테이블·컬럼 기록 (스키마 드리프트 복구 · 2026-07-12).
--
-- 20260712170000_vrl_phase2_runtime_functions_record 가 참조하는 테이블/컬럼이 마이그 이력에 부재였음
--   (DB엔 존재, out-of-band 적용). 본 파일은 현 DB 구조를 기록(함수보다 먼저 실행되도록 이른 타임스탬프).
--   전부 IF NOT EXISTS — 기존 DB 무영향, 신규 재구축 시에만 생성(동작 변경 0).
--   전제(더 이른 마이그): vocaflow_levels·user_diagnostic_results·user_profiles·auth.users (infrastructure 등).

-- ═══ user_level_snapshots — V-Level 변천 audit 체인 ═══
CREATE TABLE IF NOT EXISTS public.user_level_snapshots (
  id                      uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL,
  v_level                 smallint NOT NULL,
  v_level_meta            jsonb NOT NULL,
  previous_v_level        smallint,
  v_level_delta           smallint,
  track_levels            jsonb,
  domain_levels           jsonb,
  skill_levels            jsonb,
  learning_activity_score numeric,
  total_words_seen        integer,
  total_words_mastered    integer,
  taken_reason            text NOT NULL,
  taken_at                timestamptz NOT NULL DEFAULT now(),
  diagnostic_result_id    uuid,
  snapshot_meta           jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_type           text NOT NULL,
  triggered_by            text NOT NULL,
  trigger_details         jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_snapshot_id    uuid,
  target_v_level          smallint,
  target_v_level_meta     jsonb,
  segment                 text,
  learning_goal           text,
  cefr_level              text,
  CONSTRAINT user_level_snapshots_pkey PRIMARY KEY (id),
  CONSTRAINT user_level_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT user_level_snapshots_diagnostic_result_id_fkey FOREIGN KEY (diagnostic_result_id) REFERENCES public.user_diagnostic_results(id) ON DELETE SET NULL,
  CONSTRAINT user_level_snapshots_previous_snapshot_id_fkey FOREIGN KEY (previous_snapshot_id) REFERENCES public.user_level_snapshots(id) ON DELETE SET NULL,
  CONSTRAINT user_level_snapshots_target_v_level_fkey FOREIGN KEY (target_v_level) REFERENCES public.vocaflow_levels(level) ON DELETE SET NULL,
  CONSTRAINT user_level_snapshots_v_level_fkey FOREIGN KEY (v_level) REFERENCES public.vocaflow_levels(level) ON DELETE RESTRICT,
  CONSTRAINT user_level_snapshots_snapshot_type_chk CHECK (snapshot_type = ANY (ARRAY['initial','level_change','scheduled','manual','reset'])),
  CONSTRAINT user_level_snapshots_taken_reason_check CHECK (taken_reason = ANY (ARRAY['initial','diagnostic','self_declared','mastery_calc','scheduled','manual_override'])),
  CONSTRAINT user_level_snapshots_triggered_by_chk CHECK (triggered_by = ANY (ARRAY['api','cron','admin','system','internal'])),
  CONSTRAINT v_level_meta_required_keys CHECK (
    (v_level_meta ? 'level') AND (v_level_meta ? 'source') AND (v_level_meta ? 'confidence')
    AND (v_level_meta ? 'estimated_at') AND (v_level_meta ? 'status'))
);
CREATE INDEX IF NOT EXISTS idx_snapshots_user_date ON public.user_level_snapshots USING btree (user_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_user_type ON public.user_level_snapshots USING btree (user_id, snapshot_type);
CREATE INDEX IF NOT EXISTS idx_snapshots_chain ON public.user_level_snapshots USING btree (previous_snapshot_id) WHERE (previous_snapshot_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_snapshots_diagnostic ON public.user_level_snapshots USING btree (diagnostic_result_id) WHERE (diagnostic_result_id IS NOT NULL);
ALTER TABLE public.user_level_snapshots ENABLE ROW LEVEL SECURITY;
-- RLS: 소유자 own-data read (마이그 부재였음 → 기록). admin read 는 20260706010000_vrl_admin_read_policies.
--   쓰기 정책 없음 = 의도적(스냅샷은 SECURITY DEFINER 함수만 INSERT, RLS 우회).
DROP POLICY IF EXISTS snapshots_select_own ON public.user_level_snapshots;
CREATE POLICY snapshots_select_own ON public.user_level_snapshots
  FOR SELECT USING (auth.uid() = user_id);

-- ═══ vrl_data_integrity_concerns — 분류 정합의심 단어 로그 ═══
CREATE SEQUENCE IF NOT EXISTS public.vrl_data_integrity_concerns_id_seq;
CREATE TABLE IF NOT EXISTS public.vrl_data_integrity_concerns (
  id               integer NOT NULL DEFAULT nextval('public.vrl_data_integrity_concerns_id_seq'::regclass),
  word             text NOT NULL,
  concern_type     text NOT NULL,
  reasoning        text,
  suggested_action text,
  detected_during  text DEFAULT 'vrl_classification_round_1'::text,
  detected_at      timestamptz DEFAULT now(),
  resolved         boolean DEFAULT false,
  resolved_at      timestamptz,
  resolution_note  text,
  CONSTRAINT vrl_data_integrity_concerns_pkey PRIMARY KEY (id)
);
ALTER SEQUENCE public.vrl_data_integrity_concerns_id_seq OWNED BY public.vrl_data_integrity_concerns.id;

-- ═══ user_profiles — Phase 2 메타/집계 컬럼 (base 컬럼은 infrastructure 에 존재) ═══
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS current_v_level_meta     jsonb,
  ADD COLUMN IF NOT EXISTS target_v_level_meta      jsonb,
  ADD COLUMN IF NOT EXISTS learning_activity_score  numeric,
  ADD COLUMN IF NOT EXISTS next_level_review_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS segment                  text,
  ADD COLUMN IF NOT EXISTS total_words_seen         integer,
  ADD COLUMN IF NOT EXISTS total_words_mastered     integer;
