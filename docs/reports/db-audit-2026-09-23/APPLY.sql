-- docs/reports/db-audit-2026-09-23/APPLY.sql
--
-- **2026-09-23 조사 조치 ①~⑤ — 사용자 승인 완료, 적용 대기.**
--
-- 에이전트 세션의 권한 모드가 `apply_migration` 을 차단해(공유 리소스 변경) 적용하지 못했다.
-- 이 파일을 **Supabase SQL Editor** 또는 psql 에 그대로 붙여 넣으면 ①~⑤ 가 순서대로 적용된다.
-- 되돌리기: `docs/AI_CONTEXT/rollback/db-audit-2026-09-23-rollback.sql` (적용 직전 실측 스냅샷 기반)
-- 근거·수치: `docs/reports/db-audit-2026-09-23.md`
--
-- ⚠️ Supabase SQL Editor 는 스니펫을 자동 저장하지 않는다 — 붙여 넣은 뒤 Ctrl+S 를 누르지 않으면
--    탭을 닫을 때 사라진다.
-- ⚠️ 섹션 ⑥은 `CONCURRENTLY` 라 **SQL Editor·MCP 로는 25001 로 거부된다** — psql 세션에서만 된다.
--
-- 적용 직전 기준값(대조용): public 정책 **150개** · `mv_lemma_dominant_pos` **11,085행**

-- ═══════════════════════════════════════════════════════════════════════
-- ① 보안 — anon 이 기출 802문항의 정답을 고치고 지울 수 있는 구멍
-- ═══════════════════════════════════════════════════════════════════════
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.csat_items_public FROM anon, authenticated;

REVOKE SELECT ON TABLE public.csat_items_public FROM anon;

COMMENT ON VIEW public.csat_items_public IS
  '읽기 전용 표면. security_invoker=false 라 기반 csat_items 의 RLS(USING false)를 우회하므로 '
  'anon/authenticated 에 쓰기 권한을 주면 안 된다(2026-09-23 anon 쓰기 구멍 차단). '
  'authenticated SELECT 는 학습자의 유일한 경로이므로 회수 금지.';

-- 확인 — 앞의 둘은 false, 셋째는 true, 넷째는 false 여야 한다
SELECT has_table_privilege('anon','public.csat_items_public','SELECT')          AS anon_select_must_be_false,
       has_table_privilege('anon','public.csat_items_public','UPDATE')          AS anon_update_must_be_false,
       has_table_privilege('authenticated','public.csat_items_public','SELECT') AS auth_select_must_be_true,
       has_table_privilege('authenticated','public.csat_items_public','UPDATE') AS auth_update_must_be_false;

-- ═══════════════════════════════════════════════════════════════════════
-- ② 정책이 없어 화면이 조용히 0행을 받던 표
-- ═══════════════════════════════════════════════════════════════════════
CREATE POLICY english_irregular_forms_read ON public.english_irregular_forms
  FOR SELECT TO anon, authenticated
  USING (true);

-- 확인 — anon 으로 337 이 나와야 한다(전에는 0)
BEGIN;
  SET LOCAL ROLE anon;
  SELECT count(*) AS eif_rows_as_anon FROM public.english_irregular_forms;
ROLLBACK;

-- ⚠️ 같은 커밋에서 `apps/web/src/lib/textfit/inflect.ts` 의 「이 표는 0행이라 쓰지 않는다」 우회 로직을
--    걷어내야 실제로 달라진다. 정책만 생기면 아무것도 바뀌지 않는다.

-- ═══════════════════════════════════════════════════════════════════════
-- ③ 효율 — 캐시를 태우는 크론 · 갱신 배선 없는 MV · autovacuum
-- ═══════════════════════════════════════════════════════════════════════
-- 30분 → 6시간. 하루 48회(약 60 GB 디스크 읽기) → 4회.
-- 드레인 import 가 끝나면 이 함수를 직접 부르므로 크론은 보조망이다.
SELECT cron.schedule(
  'refresh-textbook-shelf-stats',
  '0 */6 * * *',
  $cron$SELECT public.refresh_textbook_shelf_stats()$cron$
);

-- 아무도 갱신하지 않던 MV 를 지금 한 번 채우고 하루 1회로 배선한다.
-- (unique 인덱스 mv_lemma_dominant_pos_pk 가 있어 CONCURRENTLY 가 된다)
SELECT public.refresh_lemma_dominant_pos();

SELECT cron.schedule(
  'refresh-lemma-dominant-pos',
  '30 17 * * *',
  $cron$SELECT public.refresh_lemma_dominant_pos()$cron$
);

-- 삭제-재삽입으로 도는 표. 기본 임계 678만 dead tuple → 68만.
ALTER TABLE public.library_article_vocabularies
  SET (autovacuum_vacuum_scale_factor = 0.02);

-- UPDATE 53만을 받는 1,289 MB 표. 17.6만 → 4.4만.
ALTER TABLE public.csat_dcp_items
  SET (autovacuum_vacuum_scale_factor = 0.05);

-- 확인
SELECT jobid, jobname, schedule, active FROM cron.job
 WHERE jobname IN ('refresh-textbook-shelf-stats','refresh-lemma-dominant-pos') ORDER BY jobid;
SELECT count(*) AS mv_rows_should_be_about_27828 FROM public.mv_lemma_dominant_pos;
SELECT relname, reloptions FROM pg_class
 WHERE relname IN ('library_article_vocabularies','csat_dcp_items');

-- ═══════════════════════════════════════════════════════════════════════
-- ④ RLS — 죽은 정책 11개 삭제 + 나머지를 InitPlan 으로 승격
-- ═══════════════════════════════════════════════════════════════════════
-- service_role 은 rolbypassrls=true 라 정책과 무관하게 전부 본다.
-- 그러므로 아래 정책들은 아무에게도 행을 주지 않으면서 **모든 행에서 auth.jwt() 를 호출**한다.
-- 가장 큰 것이 library_article_vocabularies — 34,061,777행이다.
DROP POLICY IF EXISTS service_role_all_article_vocab ON public.library_article_vocabularies;
DROP POLICY IF EXISTS service_role_all_vocab        ON public.library_book_vocabularies;
DROP POLICY IF EXISTS service_role_all_articles     ON public.library_articles;
DROP POLICY IF EXISTS service_role_all_chunks       ON public.content_chunks;
DROP POLICY IF EXISTS service_role_all_chapters     ON public.library_chapters_master;
DROP POLICY IF EXISTS service_role_all_books        ON public.library_books;
DROP POLICY IF EXISTS service_role_all_catalogs     ON public.library_source_catalogs;

DROP POLICY IF EXISTS "service write dictionary"      ON public.shared_dictionary;
DROP POLICY IF EXISTS "service write categories"      ON public.dictionary_categories;
DROP POLICY IF EXISTS "service write word categories" ON public.dictionary_word_categories;
DROP POLICY IF EXISTS lexicon_frequencies_admin_write ON public.lexicon_frequencies;

-- 나머지 62개는 손으로 옮겨 적지 않는다 — DB 원문을 읽어 기계적으로 감싼다.
-- 이미 감싸진 정책은 치환 결과가 원문과 같아 건너뛴다 → 재실행 안전.
-- `is_class_member(a.class_id, auth.uid())` 의 첫 인자는 건드리지 않는다(행마다 다른 컬럼).
DO $rls$
DECLARE
  r      record;
  new_q  text;
  new_w  text;
  stmt   text;
  n_done int := 0;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl, pol.polname AS name,
           pg_get_expr(pol.polqual, pol.polrelid)      AS qual,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS wcheck
    FROM pg_policy pol
    JOIN pg_class c     ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    ORDER BY c.relname, pol.polname
  LOOP
    new_q := replace(replace(replace(replace(replace(replace(replace(replace(
      coalesce(r.qual, ''),
      '( SELECT auth.uid() AS uid)', '@@U@@'),
      '( SELECT auth.jwt() AS jwt)', '@@J@@'),
      '( SELECT auth.role() AS role)', '@@R@@'),
      'auth.uid()',  '( SELECT auth.uid() AS uid)'),
      'auth.jwt()',  '( SELECT auth.jwt() AS jwt)'),
      'auth.role()', '( SELECT auth.role() AS role)'),
      '@@U@@', '( SELECT auth.uid() AS uid)'),
      '@@J@@', '( SELECT auth.jwt() AS jwt)');
    new_q := replace(new_q, '@@R@@', '( SELECT auth.role() AS role)');

    new_w := replace(replace(replace(replace(replace(replace(replace(replace(
      coalesce(r.wcheck, ''),
      '( SELECT auth.uid() AS uid)', '@@U@@'),
      '( SELECT auth.jwt() AS jwt)', '@@J@@'),
      '( SELECT auth.role() AS role)', '@@R@@'),
      'auth.uid()',  '( SELECT auth.uid() AS uid)'),
      'auth.jwt()',  '( SELECT auth.jwt() AS jwt)'),
      'auth.role()', '( SELECT auth.role() AS role)'),
      '@@U@@', '( SELECT auth.uid() AS uid)'),
      '@@J@@', '( SELECT auth.jwt() AS jwt)');
    new_w := replace(new_w, '@@R@@', '( SELECT auth.role() AS role)');

    CONTINUE WHEN new_q = coalesce(r.qual, '') AND new_w = coalesce(r.wcheck, '');

    stmt := format('ALTER POLICY %I ON public.%I', r.name, r.tbl)
          || CASE WHEN new_q <> '' THEN format(' USING (%s)', new_q) ELSE '' END
          || CASE WHEN new_w <> '' THEN format(' WITH CHECK (%s)', new_w) ELSE '' END;

    EXECUTE stmt;
    n_done := n_done + 1;
  END LOOP;

  RAISE NOTICE 'rls_initplan: % 개 정책을 감쌌다 (기대값 62)', n_done;
END
$rls$;

-- 확인 — 0행이어야 한다(남은 맨몸 호출)
SELECT c.relname, pol.polname
FROM pg_policy pol
JOIN pg_class c     ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND (coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') || ' ' ||
       coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), ''))
      LIKE ANY (ARRAY['%(auth.uid())%', '% auth.uid()%', '%(auth.jwt())%', '% auth.jwt()%',
                      '%(auth.role())%', '% auth.role()%']);

-- 확인 — 정책 수는 150 → 139 여야 한다(11개 삭제)
SELECT count(*) AS policy_count_should_be_139
FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public';

-- ═══════════════════════════════════════════════════════════════════════
-- ⑤ 아무도 읽지 않는 뷰 6개
-- ═══════════════════════════════════════════════════════════════════════
DROP VIEW IF EXISTS public.user_vocab_enriched;
DROP VIEW IF EXISTS public.word_mislevel_signal;
DROP VIEW IF EXISTS public.v_dict_pos_sense_gap;
DROP VIEW IF EXISTS public.v_book_extraction_reasons;
DROP VIEW IF EXISTS public.v_user_book_progress;
DROP VIEW IF EXISTS public.v_extraction_quality_audit;

-- 적용 뒤 `packages/types/src/database.ts` 재생성 + `pnpm turbo run typecheck`.

-- ═══════════════════════════════════════════════════════════════════════
-- ⑥ psql 세션에서만 되는 것 — SQL Editor·MCP 는 25001 로 거부한다
-- ═══════════════════════════════════════════════════════════════════════
-- ㉠ 0.9 GB 회수 — `supabase/migrations/_pending_reindex_lav_word_key.sql` 를 수정 없이 그대로 실행.
--    실측 재확인(2026-09-23): 2,391 MB · leaf 밀도 56.2% · 단편화 44.1% — 계획서 값과 동일.
--    락 없음. VACUUM FULL 을 쓰지 않는 이유는 그 파일에 적혀 있다.
--
-- ㉡ 3.9시간짜리 쿼리(16,413회 × 847 ms)를 없애는 인덱스:
--
--      CREATE INDEX CONCURRENTLY idx_dcp_items_type_id
--        ON public.csat_dcp_items USING btree (type, id);
--
--    EXPLAIN 근거: 드문 유형이 UNIQUE 인덱스(kind, ref_id, type, paragraph_idx)에서 type 이 3번째라
--    72 MB 를 전량 스캔하고 Sort 까지 한다(1,483 ms · 9,162 buffers).
--    비용 35~45 MB · 이 표의 인덱스가 6 → 7 이 된다.
--    만든 뒤 아래로 실제 효과를 확인한다(드문 유형의 type 값을 넣는다):
--      EXPLAIN (ANALYZE, BUFFERS)
--      SELECT id, type, payload, answer_key FROM public.csat_dcp_items
--       WHERE type = '<드문 유형>' AND id > '<uuid>' ORDER BY id LIMIT 200;
