-- supabase/migrations/_pending_space_place_source.sql
--
-- **`library_articles.source` 에 `space_place` 를 연다.**
--
-- ── 왜 ───────────────────────────────────────────────────────────────
-- 비PD 후보까지 12곳을 훑었는데 **두 관문(robots · 저작권 고지)을 다 통과한 것은
-- NASA Space Place 뿐**이었다. 그리고 난이도가 초·중 한가운데에 정확히 앉는다(표본 29편):
--
--     FK 중앙 6.63 (시중 초6~중1 5.34 · 중1 7.60) · 문장 13어 (시중 중1 교재 13.9어)
--     학년 칸  초6~중1 11 · 중1~2 10 · 초5~6 5 · 초3~4 2 · 중3 1
--
-- 라이선스는 nasa.gov 이용 규정이 **교재를 이름으로 지목한다**:
--   "text-book authors may use NASA content without needing explicit permission …
--    used in a factual manner that does not imply endorsement."
--
-- ⚠️ NASA 휘장·로고타입은 PD 가 아니다 — 글만 쓰고 로고는 쓰지 않는다.
-- ⚠️ 보증(endorsement)을 암시하면 안 된다 — "NASA 공인" 같은 표현 금지.
--
-- 어댑터·정책·회귀(13종)는 이미 들어가 있고 **막고 있는 것은 이 CHECK 제약 하나**다.
--
-- 되돌리기: 아래 rollback. 단 `space_place` 행이 들어간 뒤에는 그 행을 먼저 지워야 한다.
-- 잠금: `NOT VALID` → `VALIDATE` 2단으로 나눠 ACCESS EXCLUSIVE 창을 짧게 만든다.

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
        'storyweaver',
        'space_place',   -- ← 이번에 더하는 것 (초·중 한가운데 난이도 · PD)
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
--     'wikivoyage','usgs','noaa','futurity','storyweaver','original']::text[]));
-- COMMIT;
