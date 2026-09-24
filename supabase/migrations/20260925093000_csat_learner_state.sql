-- supabase/migrations/20260925093000_csat_learner_state.sql
--
-- **기출 해부 기록(DissectionRecord)을 서버에 한 행으로 둔다.** (docs/csat/ia-design.md §3-1)
-- 2026-09-24 설계 승인 · SQL 은 적용 전 별도 승인.
--
-- 왜: 복습 큐 · 진행 중 세트 · 내 공식이 지금 **기기(IndexedDB)에만** 있다. 기기를 바꾸거나 저장소를
--     지우면 「이어서」가 사라진다 — 지속 학습 설계의 첫 장치가 기기 하나에 묶여 있다.
-- 왜 새 표인가: 기존 `csat_session_attempts` · `csat_review_queue` 는 옛 LearnerRecord(풀이 · 3→10일 단계)
--     모양이고, 그 경로를 부르는 화면은 이제 0이다. 해부 기록은 버전 붙은 JSON 한 덩어리라 행을 쪼개면
--     predictions · formulas · queue 마다 표가 는다.
-- 병합은 **코드에 하나**(`lib/csat/continuity.ts#mergeDissection`). 여기는 결과만 담는다 — DB 함수로
--     다시 합치지 않는다(두 벌이 되면 갈라진다).
-- 원문 · PDF 는 싣지 않는다. record 에 들어가는 것은 문항 id · 계열 이름 · 학습자가 쓴 공식 · 시각뿐이다.
--
-- 되돌리기: DROP TABLE public.csat_learner_state; (기기 기록은 그대로 남는다)

CREATE TABLE IF NOT EXISTS public.csat_learner_state (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  record     jsonb NOT NULL CHECK (jsonb_typeof(record) = 'object' AND (record->>'version') = '1'),
  -- 기록 크기 상한 — 공개 쓰기 경로라 한 행이 무한히 커지지 않게(해부 1,000회 ≈ 200KB)
  CONSTRAINT csat_learner_state_size CHECK (pg_column_size(record) < 1048576),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.csat_learner_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY csat_learner_state_own ON public.csat_learner_state
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.csat_learner_state TO authenticated;

COMMENT ON TABLE public.csat_learner_state IS
  '기출 해부 기록(DissectionRecord v1) 한 행. 병합 규칙은 lib/csat/continuity.ts — 여기는 결과만.';
