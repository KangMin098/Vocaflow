-- supabase/migrations/20260815020000_close_client_writable_gaps.sql
--
-- 인증 스윕 2차 — user_profiles 와 **같은 클래스**의 결함 2건.
-- (1차: 20260814150000_user_profiles_privilege_escalation_guard)
--
-- 전수 조사 방법: public 스키마의 모든 RLS 정책 중 `public|anon|authenticated` 역할에
-- 쓰기(ALL/INSERT/UPDATE/DELETE)를 허용하면서 조건이 `true` 이거나 소유자 검사만 하는 것을
-- 뽑아 하나씩 확인했다. RLS 자체는 87 테이블 전부 활성이었고(미적용 0건),
-- `shared_dictionary` 의 `FOR ALL` 은 `{service_role}` 로 한정돼 있어 정상이었다.

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- (1) class_members — 초대코드를 우회한 직접 가입 + 역할 자칭
-- ─────────────────────────────────────────────────────────────
--
-- 결함: `cm_self_join` 이 INSERT 를 `WITH CHECK (user_id = auth.uid())` 로만 막았다.
--   클래스 존재 여부도, 초대코드도 보지 않고, **role 을 직접 정할 수 있었다**.
--   → class_id(UUID)만 알면 남의 클래스에 스스로 들어가고 `role='teacher'` 로 적을 수 있다.
--     (그 뒤 `classes_member_read` → `is_class_member()` 로 클래스가 열린다.)
--
-- 왜 그냥 지워도 되는가: 앱의 유일한 가입 경로가 `join_class_by_code(p_code)` 이고,
--   이 함수는 SECURITY DEFINER 라 **RLS 를 우회**한다. 즉 이 정책은 쓰이지 않는 우회로였다.
--   함수는 invite_code 를 검증하고 role 을 'student' 로 고정해 넣는다.
--   실측: apps/web 에 class_members 직접 INSERT 0건 (읽기 `.select` 만 존재).
--
-- ⚠️ is_class_teacher() 는 classes.teacher_id 를 보므로, role='teacher' 를 적어도
--    교사 권한 자체가 넘어가지는 않았다. 그래도 "남의 클래스에 무단 가입 + 열람" 은 성립했다.
DROP POLICY IF EXISTS cm_self_join ON public.class_members;

COMMENT ON TABLE public.class_members IS
  '클래스 멤버십. 가입은 join_class_by_code(p_code) RPC 로만 (invite_code 검증 + role=student 고정). 클라이언트 직접 INSERT 정책을 두지 말 것 — 초대코드가 무력화된다.';

-- ─────────────────────────────────────────────────────────────
-- (2) 고아 테이블 3종 — anon 에게 전면 개방돼 있었다
-- ─────────────────────────────────────────────────────────────
--
-- `sw_players` · `sw_comments` · `st17_timetables` 는 이 제품 코드가 전혀 참조하지 않는다
-- (실측: 생성물인 packages/types/src/database.ts 외 참조 0건). 같은 Supabase 인스턴스를
-- 쓰던 다른 실험의 잔여물로 보인다.
--
-- 결함: 정책이 `FOR ALL TO anon USING(true) WITH CHECK(true)` 였다.
--   anon key 는 브라우저 번들에 그대로 들어 있으므로 사실상 전 인터넷 공개다.
--   실측(2026-08-15, anon key 만으로):
--     sw_players     → nick, **pass_hash**, save 열람 (해시 16자 확인) · 수정/삭제도 가능
--     sw_comments    → 전 행 열람/수정/삭제
--     st17_timetables→ 전 행(58) 열람/삽입/수정
--
-- 조치: 클라이언트 역할의 접근을 끊는다. **데이터는 지우지 않는다**(테이블 DROP 은
--   소유자 확인이 필요한 별도 결정). service_role 로는 계속 접근 가능하다.
DROP POLICY IF EXISTS sw_anon_all ON public.sw_players;
DROP POLICY IF EXISTS swc_anon ON public.sw_comments;
DROP POLICY IF EXISTS "st17 public insert" ON public.st17_timetables;
DROP POLICY IF EXISTS "st17 public update" ON public.st17_timetables;
DROP POLICY IF EXISTS "st17 public read" ON public.st17_timetables;

REVOKE ALL ON public.sw_players FROM anon, authenticated;
REVOKE ALL ON public.sw_comments FROM anon, authenticated;
REVOKE ALL ON public.st17_timetables FROM anon, authenticated;

COMMENT ON TABLE public.sw_players IS
  '⚠️ 이 제품이 쓰지 않는 고아 테이블 (다른 실험의 잔여물). pass_hash 를 담고 있어 클라이언트 접근을 전면 차단했다(20260815020000). 필요 없으면 소유자 확인 후 DROP 할 것.';
COMMENT ON TABLE public.sw_comments IS
  '⚠️ 이 제품이 쓰지 않는 고아 테이블. 클라이언트 접근 차단(20260815020000).';
COMMENT ON TABLE public.st17_timetables IS
  '⚠️ 이 제품이 쓰지 않는 고아 테이블. 클라이언트 접근 차단(20260815020000).';

COMMIT;

-- ─────────────────────────────────────────────────────────────
-- ROLLBACK (필요 시 수동)
-- ─────────────────────────────────────────────────────────────
--   -- class_members 직접 가입 복원 (⚠️ 초대코드 우회가 되살아난다)
--   CREATE POLICY cm_self_join ON public.class_members
--     FOR INSERT TO public WITH CHECK (user_id = auth.uid());
--
--   -- 고아 테이블 재개방 (⚠️ pass_hash 가 다시 공개된다)
--   GRANT SELECT, INSERT, UPDATE, DELETE ON public.sw_players TO anon, authenticated;
--   CREATE POLICY sw_anon_all ON public.sw_players FOR ALL TO anon USING (true) WITH CHECK (true);
