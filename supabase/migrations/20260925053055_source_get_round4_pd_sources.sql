-- supabase/migrations/20260925053055_source_get_round4_pd_sources.sql
--
-- **`library_articles.source` 에 소스GET 4차 퍼블릭 도메인 원천 둘을 연다** — `eia_kids` · `nih_news_in_health`.
-- 2026-09-25 사용자 승인 후 적용(MCP apply_migration · version 20260925053055).
--
-- 목록은 적용 직전 DB 의 실제 제약값(pg_get_constraintdef)을 그대로 옮기고 둘만 더했다.
--
-- 근거 — 전량 수집 실측(docs/reports/sources-register.md §6):
--   eia_kids            63편 · 중앙 345어 · PD(연방 · eia.gov/about/copyrights_reuse.php)
--   nih_news_in_health  800편 · 중앙 531어 · 「Our material is not copyrighted」(사진 제외)
--                       원 사이트가 Cloudflare 챌린지라 Internet Archive 사본에서 받았다(우회 없음)
--
-- 잠금: NOT VALID → VALIDATE 2단.

BEGIN;

ALTER TABLE public.library_articles
  DROP CONSTRAINT IF EXISTS library_articles_source_check;

ALTER TABLE public.library_articles
  ADD CONSTRAINT library_articles_source_check
  CHECK (
    source = ANY (
      ARRAY[
        'voa', 'nasa', 'nih', 'manual', 'cdc', 'medlineplus', 'wikinews',
        'the_conversation', 'simple_wikipedia', 'owid', 'factbook', 'elife',
        'wikipedia', 'plos', 'wikivoyage', 'usgs', 'noaa', 'futurity',
        'storyweaver', 'space_place', 'original', 'ocean_facts', 'frym',
        'frontiers', 'worldbank', 'nist', 'europe_pmc', 'african_storybook',
        'olh', 'econstor', 'scielo', 'openalex', 'openstax',
        'global_voices', 'global_storybooks', 'gdl',
        'eia_kids', 'nih_news_in_health'   -- ← 소스GET 4차 (2026-09-25)
      ]::text[]
    )
  )
  NOT VALID;

ALTER TABLE public.library_articles
  VALIDATE CONSTRAINT library_articles_source_check;

COMMIT;

-- ── rollback (두 원천 행을 지운 뒤에만 안전) ─────────────────────────
-- 위 ARRAY 에서 마지막 줄 둘을 뺀 것으로 같은 두 문장을 다시 실행한다.
