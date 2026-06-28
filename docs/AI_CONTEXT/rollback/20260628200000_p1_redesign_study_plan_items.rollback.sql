-- ROLLBACK: 20260628200000_p1_redesign_study_plan_items
-- 주의: learning_goals 는 0 rows 였으므로 복원 시 빈 테이블만 재생성 (데이터 복구 불가/불필요).
-- study_plan_items 에 학습자 계획이 쌓였다면 DROP 전 백업 필요.

DROP TRIGGER IF EXISTS trg_study_plan_items_touch ON public.study_plan_items;
DROP FUNCTION IF EXISTS public.tg_study_plan_items_touch();
DROP TABLE IF EXISTS public.study_plan_items CASCADE;

-- learning_goals 재생성 (수능 P1 원형 — 복원이 필요할 경우만)
CREATE TABLE IF NOT EXISTS public.learning_goals (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_type             text NOT NULL DEFAULT 'csat',
  target_date           date,
  target_v_level        smallint DEFAULT 7,
  target_word_count     integer DEFAULT 4000,
  weekly_target_days    smallint DEFAULT 5,
  weekly_target_minutes smallint DEFAULT 100,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, goal_type)
);
ALTER TABLE public.learning_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY learning_goals_own ON public.learning_goals USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
