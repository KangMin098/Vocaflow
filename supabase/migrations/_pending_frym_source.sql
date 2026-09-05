-- supabase/migrations/_pending_frym_source.sql
--
-- **`library_articles.source` 에 `frym` 을 연다.**
--
-- ── 왜 ───────────────────────────────────────────────────────────────
-- 학년 칸 재고를 재면 **중3 칸만 비어 있다**(실측 2026-09-05 · 4축 통과 기준):
--
--     초3~4 40 · 초5~6 86 · 초6~중1 185 · 중1~2 130 · **중3 13**
--
-- 그리고 채워진 칸들의 **시중 자리가 14.9~34.3** 이다 — 시중 지문 분포에서 아래쪽,
-- 즉 지금 재고는 **시중보다 쉬운 글로 치우쳐 있다.**
--
-- Frontiers for Young Minds(8~15세 심사 과학지 · 1,977편)는 둘을 함께 겨냥한다.
-- 어댑터로 8편을 실측하니 **8/8 전부 통과**했고 7편이 중3 칸이었다:
--
--     100~153어 · FK 8.88~11.88 · 교육과정 밖 21.4~34% · 시중 자리 7.9~46.5
--
-- 라이선스는 Crossref 가 **글마다** 준다(`license[].URL`). 표본 10편 전부
-- `creativecommons.org/licenses/by/4.0` 이었고, **못 읽은 글은 어댑터가 넣지 않는다.**
--
-- 어댑터·정책·회귀(15종)는 이미 들어가 있고 **막고 있는 것은 이 CHECK 제약 하나**다.
--
-- 잠금: `NOT VALID` → `VALIDATE` 2단으로 ACCESS EXCLUSIVE 창을 짧게 만든다.
-- 되돌리기: 아래 rollback. `frym` 행이 들어간 뒤에는 그 행을 먼저 지워야 한다.

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
        'storyweaver', 'space_place', 'ocean_facts',
        'frym',   -- ← 이번에 더하는 것 (중3 칸 · CC BY 4.0 · 초록이 곧 지문)
        'original'
      ]::text[]
    )
  )
  NOT VALID;

ALTER TABLE public.library_articles
  VALIDATE CONSTRAINT library_articles_source_check;

COMMIT;

-- ── rollback (적재 전에만 안전) ──────────────────────────────────────
-- BEGIN;
-- ALTER TABLE public.library_articles DROP CONSTRAINT IF EXISTS library_articles_source_check;
-- ALTER TABLE public.library_articles
--   ADD CONSTRAINT library_articles_source_check
--   CHECK (source = ANY (ARRAY['voa','nasa','nih','manual','cdc','medlineplus','wikinews',
--     'the_conversation','simple_wikipedia','owid','factbook','elife','wikipedia','plos',
--     'wikivoyage','usgs','noaa','futurity','storyweaver','space_place','ocean_facts',
--     'original']::text[]));
-- COMMIT;
