-- supabase/migrations/20260814150000_user_profiles_privilege_escalation_guard.sql
--
-- 🔴 권한 상승(privilege escalation) 차단.
--
-- 실측한 결함 (2026-08-14, anon key 만으로 재현):
--   RLS 정책 "own data" 가 FOR ALL / USING (auth.uid() = user_id) 였다.
--   컬럼 구분이 없으므로 로그인한 일반 사용자가 브라우저에서 단 한 줄로
--
--       supabase.from('user_profiles').update({ role: 'admin' }).eq('user_id', <본인>)
--
--   를 실행해 스스로 admin 이 됐다. 재현 로그:
--       role BEFORE : {"role":"user","status":"active"}
--       update      : error NONE, returned [{"role":"admin"}]
--       role AFTER  : {"role":"admin","status":"active"}
--       그 뒤 user_profiles 전 행(3건) 열람 가능 — profiles_admin_read → is_admin() 통과
--
--   영향 범위: is_admin() / role 검사에 걸린 RLS 정책 24개(library_books·comic_*·
--   book_curation_jobs·library_seed_catalog 등)의 쓰기 권한 + /admin/* 전 화면
--   (미들웨어·requireAdmin·requireAdminApi 가 모두 이 컬럼을 신뢰한다).
--
--   같은 경로로 status='suspended' → 'active' 자가 해제도 가능했다.
--
-- 방어 2겹:
--   (1) 컬럼 단위 GRANT — Postgres 엔진이 직접 막는다. RLS 보다 앞단이라 정책이
--       바뀌어도 뚫리지 않는다.
--   (2) BEFORE UPDATE 트리거 — 훗날 누가 GRANT ALL 을 되돌려 놔도 남는 안전망.
--
-- 안전성 확인 (적용 전 실측):
--   - 앱/스크립트 코드에 user_profiles 직접 INSERT/UPDATE/UPSERT 가 **0건**
--     (grep: apps/web/src · scripts · packages).
--   - user_profiles 를 쓰는 함수 6개는 전부 SECURITY DEFINER + owner=postgres
--     (handle_new_user · apply_diagnostic_result · update_user_v_level ·
--      auto_promote_track_level_for_user · analyze_and_apply_track_diagnostic_result ·
--      analyze_and_apply_comprehensive_diagnostic_result)
--     → 컬럼 ACL 을 우회하므로 진단·레벨 승급 파이프라인은 영향 없음.
--   - service_role 은 별도 역할이라 영향 없음 (Admin 서버 작업 정상).
--
-- 되돌리기: 파일 끝 주석의 ROLLBACK 블록 참조.

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- (1) 컬럼 단위 권한 — 본인이 고쳐도 되는 "설정" 컬럼만 허용
-- ─────────────────────────────────────────────────────────────

-- 통짜 권한 회수 (이후 필요한 컬럼만 되돌려 준다)
REVOKE INSERT, UPDATE, DELETE ON public.user_profiles FROM anon, authenticated;

-- 사용자가 스스로 바꾸는 값: 표시 정보 · 환경설정 · 학습 목표
GRANT UPDATE (
  display_name,
  avatar_url,
  locale,
  theme,
  tts_voice,
  tts_speed,
  daily_word_goal,
  notify_email,
  notify_push,
  notify_streak_risk,
  cefr_level,
  learning_goal,
  segment,
  target_v_level,
  target_track_levels,
  target_v_level_meta,
  updated_at
) ON public.user_profiles TO authenticated;

-- 프로필이 없는 예외 상황에 자기 행을 만들 수 있게 하되, 권한 컬럼은 제외한다.
-- (role·status 는 컬럼 기본값 'user'/'active' 로 들어간다.)
GRANT INSERT (
  user_id,
  display_name,
  avatar_url,
  locale,
  theme,
  tts_voice,
  tts_speed,
  daily_word_goal,
  notify_email,
  notify_push,
  notify_streak_risk,
  cefr_level,
  learning_goal,
  segment,
  target_v_level,
  target_track_levels,
  target_v_level_meta
) ON public.user_profiles TO authenticated;

-- DELETE 는 주지 않는다. 프로필만 지우면 auth.users 는 남아 계정이 반쪽이 된다
-- (미들웨어의 프로필 조회가 null 이 되어 정지 판정도 무력화). 계정 해지는 전용 흐름으로.

COMMENT ON COLUMN public.user_profiles.role IS
  '권한 역할 (user|admin|curator). 클라이언트 쓰기 금지 — 컬럼 GRANT + guard_user_profiles_privileged_columns 트리거로 차단. service_role 또는 마이그레이션으로만 변경.';
COMMENT ON COLUMN public.user_profiles.status IS
  '계정 상태 (active|suspended|deleted). 클라이언트 쓰기 금지 — 위 role 과 동일하게 보호.';

-- ─────────────────────────────────────────────────────────────
-- (2) 안전망 트리거 — 클라이언트 역할(anon/authenticated)의 권한 컬럼 변경 거부
-- ─────────────────────────────────────────────────────────────
--
-- ⚠️ SECURITY INVOKER (기본) 여야 한다. DEFINER 로 만들면 current_user 가 함수 소유자
--    (postgres)로 바뀌어 판정이 항상 통과해 버린다.
CREATE OR REPLACE FUNCTION public.guard_user_profiles_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- PostgREST 가 붙여 주는 클라이언트 역할일 때만 검사한다.
  -- service_role · postgres · SECURITY DEFINER 함수(소유자로 실행)는 그대로 통과.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'user_profiles.user_id 는 변경할 수 없습니다'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'user_profiles.role 은 클라이언트에서 변경할 수 없습니다'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'user_profiles.status 는 클라이언트에서 변경할 수 없습니다'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_user_profiles_privileged_columns() IS
  '권한 상승 안전망. 컬럼 GRANT 가 1차 방어이고 이 트리거는 GRANT 가 되돌려졌을 때를 대비한 2차 방어.';

DROP TRIGGER IF EXISTS guard_user_profiles_privileged_columns ON public.user_profiles;
CREATE TRIGGER guard_user_profiles_privileged_columns
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_user_profiles_privileged_columns();

COMMIT;

-- ─────────────────────────────────────────────────────────────
-- ROLLBACK (필요 시 수동 실행)
-- ─────────────────────────────────────────────────────────────
--   BEGIN;
--   DROP TRIGGER IF EXISTS guard_user_profiles_privileged_columns ON public.user_profiles;
--   DROP FUNCTION IF EXISTS public.guard_user_profiles_privileged_columns();
--   GRANT INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;
--   COMMIT;
--   ⚠️ 되돌리면 위에 적은 권한 상승이 그대로 되살아난다.
