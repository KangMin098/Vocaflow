-- supabase/migrations/20260913000100_video_bucket.sql
--
-- **구성요소 영상을 담을 공개 버킷.**
--
-- 왜 공개(public=true)인가: 이 영상들의 첫 독자는 로그인하지 않은 **교사와 방문자**다
-- (`docs/PLATFORM_AUDIT.md` — 허용 CAC ₩400 이라 교사→학급 경로만 성립한다).
-- 로그인 뒤에 두면 "말하지 말고 증명하라" 의 증명이 다시 문 뒤로 들어간다.
-- 같은 이유로 만화 버킷(`comic`)도 공개다 — 이 저장소의 기존 판단과 같은 줄이다.
--
-- 담기는 것: mp4(h264+AAC) · 포스터 jpg · WebVTT 자막.
-- 셋 다 공개돼도 새는 것이 없다 — 전부 우리가 광고로 내보내려고 만든 것이다.
--
-- 쓰기는 **service_role 만** 한다(`pnpm video publish` 가 그 키로 올린다).
-- 학습자·교사가 올릴 것이 없으므로 authenticated 쓰기 정책을 만들지 않는다.
--
-- 크기: 한 편 0.6~2.6MB 실측. 141개 × 3규격이면 대략 250MB 예상이라 넉넉히 200MB/파일로 둔다.
--
-- 되돌리기: 정책 3개와 버킷을 지운다. 버킷에 객체가 남아 있으면 DELETE 가 막히므로
--          먼저 비운다 — **영상 파일은 다시 찍으면 되는 파생물이다**(원료는 DB 에 있다).

-- ─── 1. 버킷 ──────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'video',
  'video',
  true,
  209715200,                                              -- 200 MB
  ARRAY['video/mp4', 'image/jpeg', 'text/vtt', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. 읽기 — 누구나 ─────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
      AND polname = 'video_public_read'
  ) THEN
    CREATE POLICY "video_public_read" ON storage.objects
      FOR SELECT
      USING (bucket_id = 'video');
  END IF;
END $$;

-- ─── 3. 쓰기 — admin 만 (발행 스크립트는 service_role 이라 RLS 를 우회한다) ──
--
-- service_role 은 RLS 를 건너뛰므로 이 정책은 **콘솔에서 admin 이 손으로 올릴 때**를 위한 것이다.
-- 정책이 하나도 없으면 콘솔 업로드가 막혀 "왜 안 되지" 로 시간을 쓴다.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
      AND polname = 'video_admin_write'
  ) THEN
    CREATE POLICY "video_admin_write" ON storage.objects
      FOR INSERT
      WITH CHECK (
        bucket_id = 'video'
        AND EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE user_id = auth.uid()
            AND role = 'admin'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
      AND polname = 'video_admin_update'
  ) THEN
    CREATE POLICY "video_admin_update" ON storage.objects
      FOR UPDATE
      USING (
        bucket_id = 'video'
        AND EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE user_id = auth.uid()
            AND role = 'admin'
        )
      );
  END IF;
END $$;
