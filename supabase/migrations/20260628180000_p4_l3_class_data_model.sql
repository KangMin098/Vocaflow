-- P4.1 (LEARNER_MANAGEMENT.md §2-5) — L3 B2B 데이터 모델 선반영 (클래스카드 모델).
--   화면(/teacher/*)은 Phase 2. 본 마이그레이션은 테이블/헬퍼/RLS 만(선반영 결정 실행).
--   user_profiles.role(기존)에 'teacher' 값으로 진입. 추가·비파괴.
-- 순환 RLS 회피: classes↔class_members 상호 참조를 SECURITY DEFINER 헬퍼로 분리.
-- 롤백: docs/AI_CONTEXT/rollback/P4_l3_class_data_model_원본.sql

CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  invite_code text NOT NULL UNIQUE,                  -- 초대코드 기반 등록(클래스카드 정석)
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.class_members (
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'student',              -- student | assistant
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, user_id)
);
CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('text','word_set')),  -- texts.id | shared_word_sets.id
  ref_id uuid NOT NULL,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 순환 차단 헬퍼 (RLS 내부에서 상대 테이블 직접 참조 시 재귀 → SECURITY DEFINER 로 우회)
CREATE OR REPLACE FUNCTION public.is_class_teacher(p_class_id uuid, p_uid uuid) RETURNS boolean
  LANGUAGE sql SECURITY DEFINER SET search_path = 'public' STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM classes WHERE id = p_class_id AND teacher_id = p_uid) $$;
CREATE OR REPLACE FUNCTION public.is_class_member(p_class_id uuid, p_uid uuid) RETURNS boolean
  LANGUAGE sql SECURITY DEFINER SET search_path = 'public' STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM class_members WHERE class_id = p_class_id AND user_id = p_uid) $$;

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS classes_teacher_all ON public.classes;
CREATE POLICY classes_teacher_all ON public.classes FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
DROP POLICY IF EXISTS classes_member_read ON public.classes;
CREATE POLICY classes_member_read ON public.classes FOR SELECT USING (public.is_class_member(id, auth.uid()));

ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cm_self_read ON public.class_members;
CREATE POLICY cm_self_read ON public.class_members FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS cm_teacher_read ON public.class_members;
CREATE POLICY cm_teacher_read ON public.class_members FOR SELECT USING (public.is_class_teacher(class_id, auth.uid()));
DROP POLICY IF EXISTS cm_self_join ON public.class_members;
CREATE POLICY cm_self_join ON public.class_members FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS cm_delete ON public.class_members;
CREATE POLICY cm_delete ON public.class_members FOR DELETE USING (user_id = auth.uid() OR public.is_class_teacher(class_id, auth.uid()));

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS asg_teacher_all ON public.assignments;
CREATE POLICY asg_teacher_all ON public.assignments FOR ALL USING (public.is_class_teacher(class_id, auth.uid())) WITH CHECK (public.is_class_teacher(class_id, auth.uid()));
DROP POLICY IF EXISTS asg_member_read ON public.assignments;
CREATE POLICY asg_member_read ON public.assignments FOR SELECT USING (public.is_class_member(class_id, auth.uid()));
