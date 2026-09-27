-- supabase/migrations/20260924130000_video_requests_format_ids.sql
--
-- **규격 이름을 코드와 맞춘다.** 20260924120000 이 규격을 `landscape/portrait/square` 로 적었는데
-- 공장의 정본(`packages/video-factory/src/spec/format.ts` FORMAT_IDS)은 `wide/vertical/square` 다.
-- 이름이 두 벌이면 요청의 규격이 렌더 규격과 조용히 어긋난다 — DB 쪽을 코드에 맞춘다.
-- 적용 시점에 두 표는 비어 있었고(요청 0건) 분야 시드 5행의 기본값만 바뀐다.

ALTER TABLE video_requests DROP CONSTRAINT IF EXISTS video_requests_formats_check;
UPDATE video_requests
   SET formats = array_replace(array_replace(formats, 'landscape', 'wide'), 'portrait', 'vertical');
ALTER TABLE video_requests ALTER COLUMN formats SET DEFAULT '{wide,vertical,square}';
ALTER TABLE video_requests ADD CONSTRAINT video_requests_formats_check
  CHECK (formats <@ ARRAY['wide', 'vertical', 'square'] AND cardinality(formats) > 0);

ALTER TABLE video_domains ALTER COLUMN default_formats SET DEFAULT '{wide,vertical,square}';
UPDATE video_domains
   SET default_formats = array_replace(array_replace(default_formats, 'landscape', 'wide'), 'portrait', 'vertical');
