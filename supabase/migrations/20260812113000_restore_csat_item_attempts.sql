-- supabase/migrations/20260812113000_restore_csat_item_attempts.sql
--
-- Phase 1 정직성 복구에서 **가장 심각한 항목**.
--
-- 20260719161409_drop_unused_empty_tables 가 csat_item_attempts 를 "빈 테이블" 로 지웠고,
-- 그 결과 다음이 연쇄로 죽었다:
--
--   csat_item_attempts (없음)
--     └─ derive_learner_stage   : SELECT avg(is_correct::int) FROM csat_item_attempts → 42P01
--          └─ prescribe_today   : line 9 에서 전파 → **hub "오늘" 처방이 모든 학습자에게 실패**
--   grade_dcp_item             : INSERT INTO csat_item_attempts ... RETURNING → 42P01 (DCP 채점 불가)
--
-- 화면이 멀쩡해 보인 이유: prescription-actions.ts 가 실패 시 하드코딩 폴백
-- (stage 'S1' · 0분 · due 0 · 후보 [] · DCP 비활성)을 반환했다. 그 값이 **신규 학습자의
-- 정상 상태와 똑같아서** 구별이 불가능했고 3주 넘게 발견되지 않았다. mock 보다 나쁘다 —
-- mock 은 가짜임을 코드가 인정하지만 이건 계산 실패를 계산 결과처럼 반환했다.
--
-- 원본 DDL: 20260710120200_ctp_runtime_tables.sql ⑦ 그대로. 순수 추가 · 복원 후 0행.
--
-- 검증(적용 시점 실측):
--   · derive_learner_stage(첫 사용자) = 'S1'  ← 폴백값과 같아 이것만으로는 증명이 안 된다
--   · derive_learner_stage(runtime-test-0705, wpm 160 · fluency 3행) = **'S3'**
--     → 폴백과 다른 값이 나왔으므로 계산이 실제로 돌았음이 증명된다
--   · prescribe_today = 1 블록 반환(이전 42P01)
--
-- 같은 커밋에서 침묵도 제거: TodayPrescription.unavailable 플래그 + 화면 고지 +
-- 회귀 테스트(정상/실패 화면이 실제로 달라야 한다).

CREATE TABLE IF NOT EXISTS public.csat_item_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.quiz_questions(id) ON DELETE SET NULL,
  text_id uuid,                                  -- 문항 원천 텍스트(참조 — FK 강제 안 함)
  is_correct boolean NOT NULL,
  -- 오답 원인 → 결손 복귀: vocab→FSRS / parsing→문장 정독 / structure→재구성 / inference→근거 / timing→S5
  error_cause text CHECK (error_cause IS NULL OR error_cause IN
    ('vocab','parsing','structure','inference','timing')),
  item_role text,                                -- 문항 시점 role snapshot(practice/verify)
  responded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cia_user_time ON public.csat_item_attempts (user_id, responded_at DESC);

ALTER TABLE public.csat_item_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cia_owner ON public.csat_item_attempts;
CREATE POLICY cia_owner ON public.csat_item_attempts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.csat_item_attempts IS 'CTP ⑦ per-item 응답 + error_cause 라우팅. scores(세션단위)로 불가하여 신설.';
