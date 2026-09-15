-- supabase/migrations/20260812124500_restore_class_data_model.sql
--
-- 20260719161409_drop_unused_empty_tables 가 classes · class_members 를 "빈 테이블" 로 지웠다.
--
-- 원본(20260628180000_p4_l3_class_data_model.sql)은 **선반영**이었다 — 헤더가 명시한다:
--   "화면(/teacher/*)은 Phase 2. 본 마이그레이션은 테이블/헬퍼/RLS 만(선반영 결정 실행)."
-- 즉 비어 있는 것이 당연했고, 그 뒤 P4.2 에서 화면이 실제로 구현됐다
-- (/teacher/page.tsx 는 StubPage 가 아니며 TeacherClient 가 개설·초대코드 참여를 실행한다).
-- **화면이 만들어진 뒤에 테이블이 지워졌다** — "선반영이라 비어 있다" 를 "미사용" 으로 읽은 결과다.
--
-- 실패 방식이 경로마다 달랐다:
--   · createClass / joinClassByCode : { ok:false, error: error.message } → 교사에게 원시 Postgres 에러
--   · fetchTeacherClasses / fetchMyMemberships : `const { data } = ...` 로 **error 를 버리고 빈 배열**
--     → 교사 화면이 "개설한 클래스가 없어요" 를 보여줬다(조회 실패가 정상 상태를 흉내 냈다)
--
-- 순환 RLS 회피 헬퍼(is_class_teacher · is_class_member)와 join_class_by_code 는 살아 있어
-- 재생성하지 않는다(실측 확인).
--
-- assignments 는 의도적으로 제외 — 같은 마이그레이션 산물이지만 코드 참조 0곳이고
-- P4.3(과제 배포) 선반영이다. 지금 되살리면 또 "빈 테이블" 로 지워질 항목을 하나 더 만든다.
-- P4.3 착수 시 원본 마이그레이션 21~29행에서 꺼내 쓴다.
--
-- 검증(적용 시점 실측): 정책 6 · FK 2 · UNIQUE(invite_code) 1 ·
--   개설 → 멤버 가입 → is_class_teacher/is_class_member 판정 → 멤버 수 집계 → UNIQUE 충돌까지
--   DO 블록으로 왕복 후 탐침 정리(잔여 0).

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

COMMENT ON TABLE public.classes IS 'L3 B2B 클래스(클래스카드 모델) — 교사 개설 + 초대코드. P4.1 선반영 · P4.2 화면.';
COMMENT ON TABLE public.class_members IS 'L3 클래스 멤버십 — student | assistant. 순환 RLS 는 SECURITY DEFINER 헬퍼로 회피.';

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS classes_teacher_all ON public.classes;
CREATE POLICY classes_teacher_all ON public.classes FOR ALL
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
DROP POLICY IF EXISTS classes_member_read ON public.classes;
CREATE POLICY classes_member_read ON public.classes FOR SELECT
  USING (public.is_class_member(id, auth.uid()));

DROP POLICY IF EXISTS cm_self_read ON public.class_members;
CREATE POLICY cm_self_read ON public.class_members FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS cm_teacher_read ON public.class_members;
CREATE POLICY cm_teacher_read ON public.class_members FOR SELECT
  USING (public.is_class_teacher(class_id, auth.uid()));
DROP POLICY IF EXISTS cm_self_join ON public.class_members;
CREATE POLICY cm_self_join ON public.class_members FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS cm_delete ON public.class_members;
CREATE POLICY cm_delete ON public.class_members FOR DELETE
  USING (user_id = auth.uid() OR public.is_class_teacher(class_id, auth.uid()));
