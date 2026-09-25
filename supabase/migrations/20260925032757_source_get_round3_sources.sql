-- supabase/migrations/20260925032757_source_get_round3_sources.sql
--
-- **`library_articles.source` 에 소스GET 3차 원천 셋을 연다** — `global_voices` · `global_storybooks` · `gdl`.
-- 2026-09-25 사용자 승인 후 적용(MCP apply_migration · version 20260925032757).
--
-- 목록은 **2026-09-25 DB 의 실제 제약값**(pg_get_constraintdef)을 그대로 옮기고 셋만 더했다.
-- 손으로 다시 적으면 남의 재고를 막는다(2026-09-05 gutenberg 31,543편 · 2026-09-23 frontiers 등 3,288행).
--
-- 근거 — 20편 파일럿 실측(docs/reports/sources-register.md §6):
--   global_voices     20편 · 중앙 1,330어 · 글마다 푸터 `rel=license` CC BY 3.0 (20/20)
--   global_storybooks 20편 · 중앙 123어  · CC-BY 17 · CC-BY-NC 3 (NC 는 담기되 restricted)
--   gdl               20편 · 중앙 460어  · cc-by-4-0 8 · cc-by-nc-4-0 12 (같음)
-- wikinews · openstax 는 이미 열려 있다.
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
        'global_voices', 'global_storybooks', 'gdl'   -- ← 소스GET 3차 (2026-09-25)
      ]::text[]
    )
  )
  NOT VALID;

ALTER TABLE public.library_articles
  VALIDATE CONSTRAINT library_articles_source_check;

COMMIT;

-- ── rollback (세 원천 행을 지운 뒤에만 안전) ─────────────────────────
-- 위 ARRAY 에서 마지막 줄 셋을 뺀 것으로 같은 두 문장을 다시 실행한다.
