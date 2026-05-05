-- ============================================================
-- Migration: 20260504110406_update_handle_new_user_oauth_fallback.sql
-- Source: handle_new_user() OAuth (Google/Apple/Kakao/Naver) fallback 추가
-- Created: 2026-05-04
-- ============================================================
--
-- 회원가입 경로별 raw_user_meta_data 차이:
--   - Email signup        : { display_name, locale, consented_*_at }
--   - Google OAuth        : { full_name, name, avatar_url, picture, email, sub, ... }
--   - Apple OAuth         : { full_name (선택), email, sub, ... }
--   - Kakao OAuth         : { name, picture, profile_image_url, email, ... }
--   - Naver OAuth         : { name, profile_image, email, ... }
--
-- 본 마이그레이션:
--   1) display_name fallback 체인 확장
--      meta.display_name → meta.full_name → meta.name → email@앞부분 → '학습자'
--   2) avatar_url 자동 채움 (OAuth 제공자가 보낸 사진)
--      meta.avatar_url → meta.picture → meta.profile_image_url → meta.profile_image → NULL
--
-- 의존성:
--   - 20260504104405_auth_user_profile_trigger.sql (handle_new_user 최초 정의)
--
-- 멱등성:
--   - CREATE OR REPLACE FUNCTION : 함수 본문만 갱신, 트리거 그대로 유지
-- ============================================================

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
    avatar_url,
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
    -- display_name fallback chain
    --   1. email signup 의 명시 display_name
    --   2. Google/Apple OAuth 의 full_name
    --   3. Google/Kakao/Naver OAuth 의 name
    --   4. email 의 @ 앞부분
    --   5. '학습자' (최후 fallback)
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      NULLIF(SPLIT_PART(NEW.email, '@', 1), ''),
      '학습자'
    ),
    -- avatar_url fallback chain (OAuth 제공자별 키 차이 흡수)
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
      NULLIF(NEW.raw_user_meta_data->>'picture', ''),
      NULLIF(NEW.raw_user_meta_data->>'profile_image_url', ''),
      NULLIF(NEW.raw_user_meta_data->>'profile_image', '')
    ),
    -- locale: 명시값 → 'ko'
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'locale', ''), 'ko'),
    'light',
    10,
    'en-US-Standard-A',
    1.0,
    true,
    true,
    true
  )
  -- 이미 존재 시 중복 INSERT 방지 (재실행 + 동일 OAuth provider 재로그인 안전)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
