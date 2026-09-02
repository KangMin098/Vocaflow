-- supabase/migrations/_pending_storyweaver_source.sql
--
-- **`library_articles.source` 에 `storyweaver` 를 연다.**
--
-- ── 왜 ───────────────────────────────────────────────────────────────
-- 초·중 창(42~173어)에 드는 지문 154편의 register 를 세면
--   expository 126 · news 62 · reference 2 · **narrative 0**
-- 이다. 이야기 지문이 한 편도 없다. 시중 초·중 독해 교재에서 이야기가 차지하는 몫을
-- 생각하면 이건 재고 부족이 아니라 **종류 부재**라, 편수를 늘려도 해결되지 않는다.
--
-- StoryWeaver(Pratham Books) 는 영어책 16,779권 중 Level 1 이 5,281권이고 실측
-- (표본 49편) 초창 적중 49% · 중창 69% · **표본 전량 라이선스가 책 안에서 확인**된다.
-- 어댑터·정책·회귀 테스트는 이미 들어가 있고(`ingest-article/storyweaver.ts`,
-- 13종 통과), **막고 있는 것은 이 CHECK 제약 하나**다.
--
-- ── 무엇을 하나 ──────────────────────────────────────────────────────
-- 기존 19개 값에 `storyweaver` 하나를 더한다. **기존 값은 그대로 둔다** —
-- 지우면 그 소스로 들어온 기존 행이 다음 쓰기에서 막힌다.
--
-- 되돌리기: 아래 rollback 블록. 단, `storyweaver` 행이 이미 들어간 뒤에 되돌리면
-- 제약 재생성이 실패한다(그 행들을 먼저 지워야 한다). 적재 전에 되돌리는 것이 안전하다.
--
-- 잠금: `ALTER TABLE ... DROP/ADD CONSTRAINT` 는 ACCESS EXCLUSIVE 를 잡는다.
-- `library_articles` 는 24,738행이고 CHECK 검증이 전수 스캔이라 잠깐 멈춘다.
-- `NOT VALID` → `VALIDATE` 2단으로 나눠 그 창을 짧게 만든다.

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
        'storyweaver',   -- ← 이번에 더하는 것 (초·중 narrative 공급선)
        'original'
      ]::text[]
    )
  )
  NOT VALID;

-- 기존 24,738행은 새 값을 쓰지 않으므로 반드시 통과한다. 검증은 잠금이 약한 쪽으로 따로 건다.
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
--     'wikivoyage','usgs','noaa','futurity','original']::text[]));
-- COMMIT;
