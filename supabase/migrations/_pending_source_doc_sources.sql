-- supabase/migrations/<ts>_source_doc_sources.sql
--
-- **`library_articles.source` 에 내용 점검을 통과한 원천 4개를 연다.** — 승인 대기.
--
-- ── 왜 ───────────────────────────────────────────────────────────────
-- 원문 117편을 받아 **전부 읽고** 판정해 94편을 확보했다(80.3%).
-- 기계 점검(정제 가능성·언어·창별 산출) + 읽기 판정(화제·장르·내용 적합성)을 함께 걸었다.
--
--   SciELO sza  30 → 30 (100%)   EconStor 30 → 27 (90%)
--   OLH         30 → 21 ( 70%)   OpenAlex 27 → 16 (59%)
--
-- 확보 94편 중 **92~93편이 학교 문단·수능 짧은 지문을 동시에 내고, 74편(79%)이 장문도**
-- 낸다. 원문 하나가 여러 유형의 원천이 된다는 전제가 실측으로 확인됐다.
-- 근거: `docs/reports/source-doc-register.md` · `data/source-doc-register.json`(117행 전부).
--
-- **막고 있는 것은 이 CHECK 제약 하나다** — 첫 행 적재에서 23514 로 확인했다.
--
-- ── ⚠️ 목록을 손으로 다시 적지 않았다 ────────────────────────────────
-- 2026-09-05 에 그렇게 했다가 다른 세션이 적재한 gutenberg 31,543편이 제약을 어겨
-- VALIDATE 가 실패했다. 그래서 **DB 의 실제 값을 먼저 셌다**
-- (`scripts/csat/db-source-values.mjs` · 2026-09-23 · 109,047행 전수):
--
--   plos 47,939 · gutenberg 40,519 · voa 10,663 · futurity 2,885 · frontiers 1,961 ·
--   original 1,519 · europe_pmc 1,300 · usgs 738 · nasa 422 · elife 301 · frym 153 ·
--   storyweaver 136 · noaa 135 · simple_wikipedia 99 · wikipedia 92 ·
--   the_conversation 71 · space_place 59 · nist 23 · owid 13 · wikivoyage 8 ·
--   factbook 7 · african_storybook 4
--
-- ★ **그중 넷은 저장소의 어느 마이그레이션에도 없다** — `frontiers`(1,961) ·
--   `europe_pmc`(1,300) · `nist`(23) · `african_storybook`(4). 제약이 저장소 밖에서
--   수정됐다는 뜻이다. 이 목록은 그 실측값을 그대로 담으므로 **그 행들이 다시 막히지 않는다.**
--
-- ── 이번에 더하는 것 ─────────────────────────────────────────────────
--   olh · econstor · scielo · openalex   ← 내용 점검을 통과한 94편의 원천
--   worldbank · openstax                 ← **어댑터가 이미 있는데 값이 안 열려 있다**
--                                           (`world-bank-okr.ts` · `openstax.ts`).
--                                           frym 마이그레이션이 기록한 것과 같은 상태이고,
--                                           지금 함께 열지 않으면 같은 마이그레이션을 또 쓴다.
--                                           **빼고 싶으면 그 두 줄만 지우면 된다.**
--
-- 잠금: `NOT VALID` → `VALIDATE` 2단으로 ACCESS EXCLUSIVE 창을 짧게 만든다.
-- 되돌리기: 아래 rollback. 새 원천 행이 들어간 뒤에는 그 행을 먼저 지워야 한다.

BEGIN;

ALTER TABLE public.library_articles
  DROP CONSTRAINT IF EXISTS library_articles_source_check;

ALTER TABLE public.library_articles
  ADD CONSTRAINT library_articles_source_check
  CHECK (
    source = ANY (
      ARRAY[
        -- 실측으로 지금 쓰이는 값 22종 (2026-09-23 · 109,047행 전수)
        'plos', 'gutenberg', 'voa', 'futurity', 'frontiers', 'original',
        'europe_pmc', 'usgs', 'nasa', 'elife', 'frym', 'storyweaver',
        'noaa', 'simple_wikipedia', 'wikipedia', 'the_conversation',
        'space_place', 'nist', 'owid', 'wikivoyage', 'factbook',
        'african_storybook',
        -- 어댑터·정책은 있고 아직 행이 0인 값 (기존 제약에 있던 것)
        'manual', 'cdc', 'medlineplus', 'wikinews', 'ocean_facts',
        -- ★ 이번에 더하는 것 — 내용 점검을 통과한 94편의 원천
        'olh',        -- Open Library of Humanities · 21편 · CC BY 4.0
        'econstor',   -- EconStor · 27편 · 표준 약관(+CC 병기분)
        'scielo',     -- SciELO 남아공 인문사회 · 30편 · 저널 단위 라이선스
        'openalex',   -- OpenAlex 예술·인문 OA · 16편 · CC BY 4.0
        -- 어댑터가 있는데 값이 안 열려 적재가 불가능한 것 (빼려면 이 두 줄만 지운다)
        'worldbank',  -- world-bank-okr.ts · 가용 40,415편 · 행 0
        'openstax'    -- openstax.ts · 행 0
      ]::text[]
    )
  )
  NOT VALID;

ALTER TABLE public.library_articles
  VALIDATE CONSTRAINT library_articles_source_check;

COMMIT;

-- ── rollback ─────────────────────────────────────────────────────────
-- 새 원천 행을 먼저 지운 뒤 실행할 것:
--   DELETE FROM public.library_articles
--    WHERE source IN ('olh','econstor','scielo','openalex','worldbank','openstax');
--
-- BEGIN;
-- ALTER TABLE public.library_articles DROP CONSTRAINT IF EXISTS library_articles_source_check;
-- ALTER TABLE public.library_articles
--   ADD CONSTRAINT library_articles_source_check
--   CHECK (source = ANY (ARRAY[
--     'plos','gutenberg','voa','futurity','frontiers','original','europe_pmc','usgs',
--     'nasa','elife','frym','storyweaver','noaa','simple_wikipedia','wikipedia',
--     'the_conversation','space_place','nist','owid','wikivoyage','factbook',
--     'african_storybook','manual','cdc','medlineplus','wikinews','ocean_facts'
--   ]::text[]));
-- COMMIT;
