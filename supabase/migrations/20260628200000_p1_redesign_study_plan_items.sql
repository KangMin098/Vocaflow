-- 20260628200000_p1_redesign_study_plan_items.sql
-- P1 재설계: 수능 D-day Study Plan 폐기 → 자료×활동 학습 계획 (사용자 확정 2026-06-28)
--   · 학습 계획 = 플랫폼 자료(도서/스크립트/공용단어장) × 활동 선택 (리틀팍스형)
--   · learning_goals(수능 goal_type='csat', 0 rows) DROP — 무손실 확인됨
--   · 활동(modules): listen/read/echo/vocab/flashcard/wordblitz/pairflip/spellforge/scriptquiz/dictation
--   · 자료유형별 가용: book/script=10종 전부 · word_set=어휘 5종(vocab/flashcard/wordblitz/pairflip/spellforge)

DROP TABLE IF EXISTS public.learning_goals CASCADE;

CREATE TABLE public.study_plan_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_type text NOT NULL CHECK (material_type IN ('book','script','word_set')),
  material_id   uuid NOT NULL,                 -- library_books.id | texts.id | shared_word_sets.id (다형, FK 없음)
  modules       text[] NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, material_type, material_id)
);
COMMENT ON TABLE public.study_plan_items IS '학습 계획 — 자료별 선택 활동. P1 재설계(수능 폐기).';

CREATE INDEX idx_study_plan_items_user ON public.study_plan_items(user_id);

ALTER TABLE public.study_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY study_plan_items_select_own ON public.study_plan_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY study_plan_items_insert_own ON public.study_plan_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY study_plan_items_update_own ON public.study_plan_items FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY study_plan_items_delete_own ON public.study_plan_items FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.tg_study_plan_items_touch()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER trg_study_plan_items_touch
  BEFORE UPDATE ON public.study_plan_items FOR EACH ROW EXECUTE FUNCTION public.tg_study_plan_items_touch();
