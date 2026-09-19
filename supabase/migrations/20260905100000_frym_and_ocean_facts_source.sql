-- supabase/migrations/20260905100000_frym_and_ocean_facts_source.sql
--
-- **`library_articles.source` 에 `frym` 과 `ocean_facts` 를 연다.**
--
-- ⚠️ **처음엔 `frym` 만 넣었다가 VALIDATE 가 실패했다.** 그 실패가 두 가지를 드러냈다:
--
--   ① 다른 세션이 `gutenberg` 를 열어 **31,543편**을 적재해 두었다 — 내 목록에 없어서
--      기존 행이 제약을 어겼다. 목록을 손으로 다시 적을 때 **지금 쓰이는 값을 먼저
--      세어 보지 않으면** 남의 재고를 통째로 막는다.
--   ② **내가 `ocean_facts` 어댑터를 배선하고 마이그레이션을 안 만들었다**(2026-09-03).
--      어댑터·정책·화면 표기까지 다 있는데 DB 값이 안 열려 있어 적재가 불가능한 상태였다.
--      이 실패가 아니었으면 적재를 시도할 때까지 몰랐을 것이다.
--
-- 롤백은 깨끗했다 — 트랜잭션이 통째로 되돌아가 제약이 그대로 남았다(`convalidated: true`).
-- 그래서 목록을 **실제 값 실측**으로 다시 짓고 한 번에 열었다.
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
-- 되돌리기: 아래 rollback. `frym`·`ocean_facts` 행이 들어간 뒤에는 그 행을 먼저 지워야 한다.

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
        'storyweaver', 'space_place', 'gutenberg', 'original',
        'ocean_facts',  -- ← 2026-09-03 에 어댑터만 넣고 빼먹은 것
        'frym'          -- ← 이번에 더하는 것 (중3 칸 · CC BY 4.0 · 초록이 곧 지문)
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
--     'wikivoyage','usgs','noaa','futurity','storyweaver','space_place','gutenberg',
--     'original']::text[]));
-- COMMIT;
