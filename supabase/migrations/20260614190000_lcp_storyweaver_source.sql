-- supabase/migrations/20260614190000_lcp_storyweaver_source.sql
-- LCP — StoryWeaver (Pratham Books) 소스 추가 + 그림책 삽화/낭독 오디오 데이터 모델.
--
-- StoryWeaver: CC BY 4.0 다국어 그림책 (영어 8천+권). 페이지별 삽화 + readalong 오디오.
--   API: https://storyweaver.org.in/api/v1/stories/{id|slug}/read (server-side fetch 가능, 검증됨).
--   학습 모델: 레벨 1-4 = A1-B1 초급 본체. Dual Coding(삽화)·청각(낭독) 학습과학 정합.
--   모든 파이프라인은 기존 LCP 모델 그대로 (ingest→normalize→segment→analyze→curate→publish→단어장→enroll→workspace).
--
-- 신규 데이터:
--   library_books.illustrations jsonb — 페이지(=문단)별 삽화 URL (링크 방식). [{idx,url,alt}]
--   library_books.audio_url text      — StoryWeaver readalong mp3 (단일 스트림, 글 audio_url 과 동일 패턴)

-- 1. 삽화 + 오디오 컬럼 (링크 방식 — 이미지는 StoryWeaver Google Storage CDN 직접 참조)
ALTER TABLE public.library_books ADD COLUMN IF NOT EXISTS illustrations jsonb;
ALTER TABLE public.library_books ADD COLUMN IF NOT EXISTS audio_url text;

COMMENT ON COLUMN public.library_books.illustrations IS
  'LCP 그림책 페이지별 삽화 (링크). [{idx:int(문단 인덱스), url:text, alt:text}]. StoryWeaver 등.';
COMMENT ON COLUMN public.library_books.audio_url IS
  'LCP 단일 스트림 낭독 오디오 (StoryWeaver readalong mp3 등). LibriVox 챕터 매핑(librivox_audio)과 별개.';

-- 2. source CHECK 제약에 storyweaver 추가
ALTER TABLE public.library_books DROP CONSTRAINT IF EXISTS library_books_source_check;
ALTER TABLE public.library_books ADD CONSTRAINT library_books_source_check
  CHECK (source = ANY (ARRAY[
    'gutenberg','standard_ebooks','wikisource','wikibooks','simple_wikipedia',
    'openstax','open_library','hathitrust','voa_learning','librivox','lit2go',
    'storyweaver','manual'
  ]::text[]));

-- 3. 소스 카탈로그 등록 (/admin/curation Sources 탭에 자동 노출)
INSERT INTO public.library_source_catalogs (
  source, display_name, description,
  api_endpoint, catalog_url, documentation_url,
  quality_text, quality_metadata, quality_api, quality_learning, quality_license, quality_volume,
  composite_score, license_summary, copyright_safe_in_kr, catalog_size,
  is_implemented, is_enabled, notes, cefrj_auto_assign_tier
) VALUES (
  'storyweaver', 'StoryWeaver (Pratham Books)',
  'CC BY 4.0 다국어 그림책. 페이지별 삽화 + 낭독 오디오. 레벨 1-4 = A1-B1 초급 학습자/아동 본체. 영어 8천+권.',
  'https://storyweaver.org.in/api/v1', 'https://storyweaver.org.in/', 'https://storyweaver.org.in/faqs',
  4.5, 4.5, 4.5, 5, 5, 4,
  4.6, 'CC BY 4.0', true, 8000,
  true, true,
  '그림책 — 페이지별 삽화(링크) + readalong 오디오(mp3). Dual Coding + 청각 학습과학 정합. source_id = StoryWeaver story id 또는 slug (예: 2 또는 2-smile-please).',
  'S'
)
ON CONFLICT (source) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  api_endpoint = EXCLUDED.api_endpoint,
  catalog_url = EXCLUDED.catalog_url,
  documentation_url = EXCLUDED.documentation_url,
  quality_text = EXCLUDED.quality_text,
  quality_metadata = EXCLUDED.quality_metadata,
  quality_api = EXCLUDED.quality_api,
  quality_learning = EXCLUDED.quality_learning,
  quality_license = EXCLUDED.quality_license,
  quality_volume = EXCLUDED.quality_volume,
  composite_score = EXCLUDED.composite_score,
  license_summary = EXCLUDED.license_summary,
  copyright_safe_in_kr = EXCLUDED.copyright_safe_in_kr,
  catalog_size = EXCLUDED.catalog_size,
  is_implemented = EXCLUDED.is_implemented,
  is_enabled = EXCLUDED.is_enabled,
  notes = EXCLUDED.notes,
  cefrj_auto_assign_tier = EXCLUDED.cefrj_auto_assign_tier,
  updated_at = now();
