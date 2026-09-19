-- supabase/migrations/<ts>_frontiers_source.sql
--
-- **`library_articles.source` 에 `frontiers` 를 연다.** — 승인 대기(적용하지 않았다).
--
-- ── 왜 ───────────────────────────────────────────────────────────────
-- `lib-topic.mjs` 분류기를 고친 뒤(오분류 23.6% → 8.3%) 소재 칸을 다시 재니 「8칸 전부
-- 부족 0」이 **부족 3,010편**으로 바뀌었고 병목이 드러났다 — **교육·언어**
-- (배율 **0.57** · 3단계 5만 기준 **부족 1,464편** · `docs/reports/topic-gap.json` 2026-09-07).
--
-- 그 칸을 지금 가진 재고로는 못 채운다:
--   · PLOS — `harvest-plos.mjs` 의 `SUBJECT_QUERY` 에 교육·언어 대응 주제가 **없다**(스스로 적어 둠)
--   · PMC 500만 편 — NLM 수집 범위가 생명·의학이라 교육은 **의학교육뿐**
--
-- Frontiers 의 **PMC 밖 저널**에 교육·언어·사회 계열이 **12,618편** 있다(PMC 수록률 0.4%):
--   Education 8,079 · Communication 2,288 · Political Science 1,478 ·
--   Human Dynamics 561 · Language Sciences 212     (Crossref member 1965 실측 2026-09-07)
--
-- 라이선스는 CC BY 4.0 이고 **항목별 필드**가 온다(Crossref `license[].URL`, 없으면 JATS
-- `<ali:license_ref>`). 어댑터가 `cc by`/`cc0` 만 통과시킨다 — Front Psychol 실측 0.5% 가
-- `cc by-nc` 라 "이 출판사는 CC BY" 로 뭉뚱그리면 그것이 섞인다.
--
-- 근거 정찰: `docs/reports/source-probe/frontiers.md`
-- 어댑터: `packages/library-pipeline/src/ingest-article/frontiers.ts`
-- 수확기: `scripts/csat/harvest-frontiers.mjs`
--
-- ⚠️ **`frym` 과 다른 소스다.** 그쪽은 `kids.frontiersin.org`(어린이용 · `/xml/nlm` 404),
--   여기는 `www.frontiersin.org` 성인 학술지(JATS 전문). 열쇠 접두어도 갈라 뒀다
--   (`frontiers:10.3389/feduc.…` vs `frym:10.3389/frym.…`).
--
-- ── ⚠️ 적용 직전에 목록을 다시 세라 ─────────────────────────────────
-- 2026-09-05 `frym` 마이그레이션이 **VALIDATE 에서 실패**했다 — 다른 세션이 `gutenberg` 로
-- 31,543편을 적재해 뒀는데 목록에 없었기 때문이다. 지금도 다른 세션이 World Bank OKR ·
-- Gutenberg · VOA 수확기를 동시에 짜고 있다. **아래 목록은 2026-09-07 실측값**이므로,
-- 적용 전에 이것부터 돌려 실제 값과 대조할 것:
--
--     SELECT source, count(*) FROM public.library_articles GROUP BY 1 ORDER BY 2 DESC;
--
-- 실측 2026-09-07: plos 47,939 · gutenberg 36,635 · futurity 2,885 · original 1,419 ·
--   usgs 738 · nasa 422 · elife 301 · voa 266 · frym 153 · storyweaver 136 · noaa 135 ·
--   simple_wikipedia 99 · wikipedia 92 · the_conversation 71 · space_place 59 · owid 13 ·
--   wikivoyage 8 · factbook 7   (= 제약의 24개 값 중 18개가 실제로 쓰이고 있다)
--
-- 잠금: `NOT VALID` → `VALIDATE` 2단으로 ACCESS EXCLUSIVE 창을 짧게 만든다.

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
        'ocean_facts', 'frym',
        'frontiers'   -- ← 이번에 더하는 것 (교육·언어 병목 · CC BY 4.0 · JATS 전문)
      ]::text[]
    )
  )
  NOT VALID;

ALTER TABLE public.library_articles
  VALIDATE CONSTRAINT library_articles_source_check;

COMMIT;

-- ── rollback (적재 전에만 안전 — `frontiers` 행이 들어간 뒤에는 그 행을 먼저 지워야 한다) ──
-- BEGIN;
-- ALTER TABLE public.library_articles DROP CONSTRAINT IF EXISTS library_articles_source_check;
-- ALTER TABLE public.library_articles
--   ADD CONSTRAINT library_articles_source_check
--   CHECK (source = ANY (ARRAY['voa','nasa','nih','manual','cdc','medlineplus','wikinews',
--     'the_conversation','simple_wikipedia','owid','factbook','elife','wikipedia','plos',
--     'wikivoyage','usgs','noaa','futurity','storyweaver','space_place','gutenberg',
--     'original','ocean_facts','frym']::text[]));
-- COMMIT;
