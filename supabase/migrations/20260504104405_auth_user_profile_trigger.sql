-- ============================================================
-- Migration: 20260504104405_auth_user_profile_trigger.sql
-- Source: 회원가입 후 user_profiles 자동 생성 트리거
-- Created: 2026-05-04
-- ============================================================
--
-- 회원가입 시 auth.users 에 row 가 INSERT 되면 public.user_profiles 에 동일 user_id 로
-- row 를 자동 생성합니다. 회원가입 폼이 raw_user_meta_data 에 전달한 값들을 함께 채움.
--
-- 처리 흐름:
--   1) signup 폼 → supabase.auth.signUp({ email, password, options: { data: {...} }})
--   2) auth.users INSERT (id=uuid, email=..., raw_user_meta_data=jsonb)
--   3) ★본 트리거 발동★ → public.user_profiles INSERT (user_id, display_name, locale, ...)
--   4) 이메일 인증 후 사용자 로그인 가능
--
-- 기본값:
--   display_name        : raw_user_meta_data->>'display_name' 또는 email 의 @ 앞부분
--   locale              : raw_user_meta_data->>'locale' 또는 'ko'
--   theme               : 'light'
--   role · status       : 'user' / 'active' (테이블 DEFAULT 사용)
--   cefr_level          : NULL (Dictation 첫 사용 시 자동 감지)
--   daily_word_goal     : 10
--   tts_voice/tts_speed : 'en-US-Standard-A' / 1.0
--   notify_*            : email/push/streak_risk 모두 true
--
-- SECURITY DEFINER 필수:
--   - 트리거는 auth 스키마 (Supabase 시스템) 에서 실행되며,
--     public.user_profiles 에 INSERT 하려면 본 함수 owner (postgres/supabase_admin) 의
--     권한으로 실행되어야 RLS 우회 가능.
--   - SET search_path = public, pg_temp : SECURITY DEFINER 권장 보안 패턴
--     (search_path 우회 권한 escalation 차단)
--
-- 멱등성:
--   - CREATE OR REPLACE FUNCTION : 함수 재정의 안전
--   - DROP TRIGGER IF EXISTS     : 트리거 중복 생성 방지
--   - ON CONFLICT (user_id) DO NOTHING : profile row 중복 INSERT 안전
--
-- 의존성:
--   - public.user_profiles 테이블 (20251101000005_user_stats_table.sql)
--   - public.user_profiles.role/status/cefr_level (20260504101620_add_user_profile_role_and_cefr.sql)
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 함수 — auth.users INSERT → public.user_profiles INSERT
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    user_id,
    display_name,
    locale,
    theme,
    daily_word_goal,
    tts_voice,
    tts_speed,
    notify_email,
    notify_push,
    notify_streak_risk
  )
  VALUES (
    NEW.id,
    -- display_name: meta data 우선 → 없으면 email 의 @ 앞부분 → 모두 없으면 '학습자'
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
      NULLIF(SPLIT_PART(NEW.email, '@', 1), ''),
      '학습자'
    ),
    -- locale: meta data 우선 → 'ko'
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'locale', ''), 'ko'),
    'light',
    10,
    'en-US-Standard-A',
    1.0,
    true,
    true,
    true
  )
  -- 이미 존재 시 중복 INSERT 방지 (재실행 안전)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 트리거 — AFTER INSERT ON auth.users
-- ────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ────────────────────────────────────────────────────────────
-- 권한 — 트리거가 service_role 컨텍스트에서 호출 가능하도록
-- (Supabase auth 가 INSERT 수행 시 자동 호출됨)
-- ────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
