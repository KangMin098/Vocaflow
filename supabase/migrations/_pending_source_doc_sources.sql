-- supabase/migrations/<ts>_source_doc_sources.sql
--
-- **`library_articles.source` 에 내용 점검을 통과한 원천 4개를 연다.** — 승인 대기.
--
-- ── 왜 ───────────────────────────────────────────────────────────────
-- 원문 117편을 받아 **전부 읽고** 판정해 94편을 확보했고(80.3%), 파생 허용 라이선스만
-- 남겨 76편이 적재 대기다. 기계 점검(정제 가능성·언어·창별 산출)과 읽기 판정(화제·장르·
-- 내용 적합성)을 함께 걸었다. 근거: `docs/reports/source-doc-register.md`.
--
-- **막고 있는 것은 이 CHECK 제약 하나다** — 첫 행 적재에서 23514 로 확인했다.
--
-- ── ⚠️ 목록을 손으로 다시 적지 않았다 ────────────────────────────────
-- 2026-09-05 에 그렇게 했다가 다른 세션이 적재한 gutenberg 31,543편이 제약을 어겨
-- VALIDATE 가 실패했다. 이번 목록은 **DB 에서 읽은 현재 제약 정의**(pg_get_constraintdef,
-- 2026-09-23)를 그대로 옮기고 거기에 새 값만 더한 것이다:
--
--   현재 제약 29종 = ANY(ARRAY[…28종]) OR source = 'african_storybook'
--   (OR 꼬리는 제약이 저장소 밖에서 수정된 흔적이다 — 이번에 ARRAY 하나로 편다)
--
-- 그 29종은 실측 사용값 22종(109,047행 전수 · `scripts/csat/db-source-values.mjs`)을
-- 전부 덮는다. 즉 **기존 행은 한 줄도 새로 걸리지 않는다** — convalidated=true 로 확인.
--
-- ⚠️ 첫 초안은 「실측 22종 + 기억나는 것」으로 적어 `nih` 를 빠뜨렸다. `nih` 는 행이 0이라
--    실측에 안 잡히지만 `SOURCE_RANKINGS_BY_LEVEL` 세 레벨 전부가 추천하는 살아 있는
--    출처다. 적용됐으면 수집이 조용히 막혔다. **제약 목록은 기억이 아니라 DB 에서 읽는다.**
--
-- ── 이번에 더하는 것 (4종) ───────────────────────────────────────────
--   olh · econstor · scielo · openalex   ← 내용 점검을 통과한 원문의 원천
--   openstax                              ← 어댑터(`openstax.ts`)는 있는데 값이 안 열려 있다.
--                                            `worldbank` 는 이미 열려 있다(제약에 있음).
--                                            **빼고 싶으면 그 한 줄만 지우면 된다.**
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
        -- 현재 제약에 있던 29종 그대로 (DB 에서 읽음 · 2026-09-23)
        'voa', 'nasa', 'nih', 'manual', 'cdc', 'medlineplus', 'wikinews',
        'the_conversation', 'simple_wikipedia', 'owid', 'factbook', 'elife',
        'wikipedia', 'plos', 'wikivoyage', 'usgs', 'noaa', 'futurity',
        'storyweaver', 'space_place', 'gutenberg', 'original', 'ocean_facts',
        'frym', 'frontiers', 'worldbank', 'nist', 'europe_pmc',
        'african_storybook',
        -- ★ 이번에 더하는 것 — 내용 점검을 통과한 원문의 원천
        'olh',        -- Open Library of Humanities · CC BY 4.0
        'econstor',   -- EconStor · CC 병기분만 적재
        'scielo',     -- SciELO 남아공 인문사회 · 저널 단위 라이선스
        'openalex',   -- OpenAlex 예술·인문 OA · CC BY 4.0
        -- 어댑터가 있는데 값이 안 열려 적재가 불가능한 것 (빼려면 이 한 줄만 지운다)
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
--    WHERE source IN ('olh','econstor','scielo','openalex','openstax');
--
-- BEGIN;
-- ALTER TABLE public.library_articles DROP CONSTRAINT IF EXISTS library_articles_source_check;
-- ALTER TABLE public.library_articles
--   ADD CONSTRAINT library_articles_source_check
--   CHECK (source = ANY (ARRAY[
--     'voa','nasa','nih','manual','cdc','medlineplus','wikinews','the_conversation',
--     'simple_wikipedia','owid','factbook','elife','wikipedia','plos','wikivoyage',
--     'usgs','noaa','futurity','storyweaver','space_place','gutenberg','original',
--     'ocean_facts','frym','frontiers','worldbank','nist','europe_pmc'
--   ]::text[]) OR source = 'african_storybook');
-- COMMIT;

-- ── 적용 확인 (적용 뒤 이 두 줄을 돌려 본다) ─────────────────────────
-- ① 제약이 새 값을 담고 있고 VALIDATE 됐는가
--   SELECT convalidated, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'public.library_articles'::regclass
--      AND conname  = 'library_articles_source_check';
--   기대: convalidated = true · 정의에 olh·econstor·scielo·openalex·openstax·nih 이 전부 있다
--
-- ② 기존 행이 한 줄도 안 걸렸는가 (걸렸다면 VALIDATE 가 실패했을 것이다)
--   SELECT source, count(*) FROM public.library_articles GROUP BY 1 ORDER BY 2 DESC;
--   기대: 22종 · 합계 109,047 (2026-09-23 실측값에서 다른 세션의 적재만큼 늘 수 있다)
--
-- 적용 뒤 이어서:
--   node --tls-max-v1.2 scripts/csat/source-doc-import.mjs            # dry-run 76편
--   node --tls-max-v1.2 scripts/csat/source-doc-import.mjs --commit
