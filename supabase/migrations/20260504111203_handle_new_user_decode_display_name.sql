-- ============================================================
-- Migration: 20260504111203_handle_new_user_decode_display_name.sql
-- Source: handle_new_user() display_name base64 디코드 fallback
-- Created: 2026-05-04
-- ============================================================
--
-- 배경 — 비-ASCII display_name fetch 헤더 오류:
--   브라우저 fetch 가 RequestInit.headers 검증 시 ISO-8859-1 (Latin-1) 만 허용.
--   특정 supabase-js / 미들웨어 / 쿠키 조합에서 raw_user_meta_data 의 한글이
--   헤더 경로로 흘러들어가 "String contains non ISO-8859-1 code point" 에러 발생.
--
-- 해결 — base64 인코드/디코드 우회:
--   1) 클라이언트: display_name 한글 → btoa(UTF-8) → ASCII 문자열
--      raw_user_meta_data.display_name_b64 키로 전송 (헤더 안전)
--   2) 본 트리거: display_name_b64 존재 시 base64 디코드하여 사용
--
-- fallback chain (우선순위):
--   1. display_name_b64 (base64) → UTF-8 디코드  ★신규
--   2. display_name (직접 한글)                  — 작동하면 사용
--   3. full_name / name (OAuth)
--   4. email 의 @ 앞부분
--   5. '학습자'
--
-- 의존성:
--   - 20260504110406_update_handle_new_user_oauth_fallback.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_b64 TEXT;
  v_decoded TEXT;
BEGIN
  -- ── display_name_b64 디코드 시도 (실패 시 v_decoded NULL 유지) ──
  v_b64 := NULLIF(NEW.raw_user_meta_data->>'display_name_b64', '');
  IF v_b64 IS NOT NULL THEN
    BEGIN
      v_decoded := convert_from(decode(v_b64, 'base64'), 'UTF8');
      v_decoded := NULLIF(TRIM(v_decoded), '');
    EXCEPTION WHEN OTHERS THEN
      v_decoded := NULL;
    END;
  END IF;

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
    -- display_name 5단계 fallback
    --   1. base64 디코드 결과 (한글 가능)
    --   2. 직접 display_name (ASCII 또는 정상 작동 환경)
    --   3. OAuth full_name
    --   4. OAuth name
    --   5. email 의 @ 앞부분
    --   6. '학습자'
    COALESCE(
      v_decoded,
      NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      NULLIF(SPLIT_PART(NEW.email, '@', 1), ''),
      '학습자'
    ),
    -- avatar_url fallback chain
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
      NULLIF(NEW.raw_user_meta_data->>'picture', ''),
      NULLIF(NEW.raw_user_meta_data->>'profile_image_url', ''),
      NULLIF(NEW.raw_user_meta_data->>'profile_image', '')
    ),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'locale', ''), 'ko'),
    'light',
    10,
    'en-US-Standard-A',
    1.0,
    true,
    true,
    true
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
