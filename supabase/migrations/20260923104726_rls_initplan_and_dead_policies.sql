-- supabase/migrations/20260923104726_rls_initplan_and_dead_policies.sql
--
-- **RLS 정책이 행마다 auth.uid() 를 다시 부른다 — 3,400만 행짜리 표를 포함해서.** — **적용 2026-09-23** (사용자 승인 · 원장 20260923104726).
--
-- ── 무엇이 문제인가 (2026-09-23 실측) ───────────────────────────────
-- 정책 식 안의 `auth.uid()` / `auth.jwt()` / `auth.role()` 은 그대로 두면 **행마다** 평가된다.
-- `(SELECT auth.uid())` 로 감싸면 플래너가 InitPlan 으로 승격해 **쿼리당 한 번**만 부른다.
-- 값은 같다 — 인자 없는 STABLE 함수라 감싸도 상관 서브쿼리가 되지 않는다.
--
-- advisor `auth_rls_initplan` **69건**과 직접 센 수가 일치한다(`current_setting` 은 0건).
-- 그중 7건은 고치는 게 아니라 **지우는 것이 맞다**(아래 ①).
--
-- ── ① 아무에게도 행을 주지 않으면서 행마다 auth.jwt() 를 부르는 정책 ──
--
-- `service_role` 은 `rolbypassrls = true` 라 **정책과 무관하게 전부 본다.**
-- 그러므로 `TO public USING (auth.jwt()->>'role' = 'service_role')` 형태의 정책은
-- service_role 에게는 불필요하고, 다른 역할에게는 항상 false 이며,
-- 그러면서 **모든 행에 대해 auth.jwt() 를 호출한다.** 순수한 손해다.
--
-- 가장 큰 것이 `library_article_vocabularies` — **34,061,777행**이다.
-- 되돌리기: 각 정책을 원래 식으로 다시 만든다(아래 주석에 원문을 남긴다).

--   원문(복원용): USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text))
DROP POLICY IF EXISTS service_role_all_article_vocab ON public.library_article_vocabularies;  -- 34,061,777행
DROP POLICY IF EXISTS service_role_all_vocab        ON public.library_book_vocabularies;      --  1,678,399행
DROP POLICY IF EXISTS service_role_all_articles     ON public.library_articles;               --    109,047행
DROP POLICY IF EXISTS service_role_all_chunks       ON public.content_chunks;                 --     11,217행
DROP POLICY IF EXISTS service_role_all_chapters     ON public.library_chapters_master;        --     11,161행
DROP POLICY IF EXISTS service_role_all_books        ON public.library_books;                  --        401행
DROP POLICY IF EXISTS service_role_all_catalogs     ON public.library_source_catalogs;        --         12행

-- `TO service_role USING (true)` — 대상이 이미 RLS 를 우회하므로 이 정책도 아무 일을 하지 않는다.
--   원문(복원용): TO service_role USING (true) WITH CHECK (true)
DROP POLICY IF EXISTS "service write dictionary"      ON public.shared_dictionary;
DROP POLICY IF EXISTS "service write categories"      ON public.dictionary_categories;
DROP POLICY IF EXISTS "service write word categories" ON public.dictionary_word_categories;
DROP POLICY IF EXISTS lexicon_frequencies_admin_write ON public.lexicon_frequencies;

-- ── ② 나머지 62건을 감싼다 ──────────────────────────────────────────
--
-- 62개를 손으로 옮겨 적지 않는다 — 한 글자만 틀려도 정책의 뜻이 바뀐다.
-- 대신 `pg_get_expr` 로 **지금 DB 에 있는 원문을 읽어** 기계적으로 감싸고 ALTER 한다.
-- 이미 감싸진 정책은 치환 결과가 원문과 같으므로 건너뛴다 → **재실행 안전**.
-- `is_class_member(a.class_id, auth.uid())` 처럼 인자가 있는 호출은 **첫 인자를 건드리지 않는다**
-- (행마다 다른 컬럼이라 감싸면 뜻이 달라진다). 치환 대상은 `auth.*()` 토큰뿐이다.

DO $rls$
DECLARE
  r       record;
  new_q   text;
  new_w   text;
  stmt    text;
  n_done  int := 0;
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
    -- 이미 감싸진 형태를 자리표시자로 빼두고 → 맨몸을 감싼 뒤 → 자리표시자를 되돌린다.
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

  RAISE NOTICE 'rls_initplan: % 개 정책을 감쌌다', n_done;
  -- 2026-09-23 기준 기대값: ① 을 먼저 적용했으면 62, 안 했으면 69.
END
$rls$;

-- ── 적용 뒤 확인 ────────────────────────────────────────────────────
-- ㉠ 남은 맨몸 호출이 0인가:
--   SELECT c.relname, pol.polname FROM pg_policy pol
--   JOIN pg_class c ON c.oid = pol.polrelid
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname='public'
--     AND (coalesce(pg_get_expr(pol.polqual,pol.polrelid),'') || ' ' ||
--          coalesce(pg_get_expr(pol.polwithcheck,pol.polrelid),''))
--         LIKE ANY (ARRAY['%(auth.uid())%','% auth.uid()%','%(auth.jwt())%','% auth.jwt()%']);
--
-- ㉡ **의미 보존 — 이게 본 검증이다.** 적용 전후로 세 역할이 보는 행 수가 한 칸도 달라지면 안 된다:
--   SET LOCAL ROLE anon;           SELECT count(*) FROM <표>;  RESET ROLE;
--   SET LOCAL ROLE authenticated;  -- + request.jwt.claims 로 학습자/관리자 각각
-- 적용 전에 `pg_policy` 원문 스냅샷을 떠 두고(롤백 계획 겸용) 적용 후 diff 한다.
-- 저장소가 CRLF/LF 혼재이므로 diff 전에 줄바꿈을 정규화한다.
--
-- ㉢ EXPLAIN ANALYZE 로 `InitPlan 1` 이 생기고 `SubPlan ... loops=681033` 이 사라지는지 본다.
--
-- ── 여기서 일부러 하지 않은 것 ──────────────────────────────────────
-- advisor 가 놓친 같은 결함이 **35건 더** 있다 — 정책 식 안의 맨몸 `is_admin()` ·
-- `is_admin_or_curator()`. 인자 없는 STABLE 함수도 감싸지 않으면 InitPlan 으로 승격되지 않아
-- 행마다 호출된다. 최악은 `csat_dcp_items`(880,342행)의 `dcp_admin` 과
-- `library_book_vocabularies`(1,678,399행)의 `admin_curator_read_vocab` 다.
-- 다만 이 함수들은 `library_books`·`library_articles`·`shared_word_sets` 의 **공개 카탈로그 정책**에도
-- 들어 있어, 잘못 건드리면 `/library`·`/comics` 가 통째로 빈다. 별도 마이그레이션으로 분리한다.
