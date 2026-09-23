-- supabase/migrations/<ts>_csat_items_public_readonly.sql
--
-- **anon 키 하나로 평가원 기출 802문항의 정답을 고치고 지울 수 있다.** — 승인 대기(적용하지 않았다).
--
-- ── 무엇을 봤나 (2026-09-23 실측) ───────────────────────────────────
-- 네 가지가 동시에 성립하면 RLS 는 아무것도 막지 못한다. 넷 다 실측으로 확인했다:
--
--   ① 뷰 `public.csat_items_public` 의 옵션이 `security_invoker = false`
--      → 뷰 질의가 **소유자(postgres) 권한**으로 실행된다
--   ② 소유자 `postgres` 의 `rolbypassrls = true`, 그리고 `csat_items.relforcerowsecurity = false`
--      → 소유자는 기반 표의 RLS 를 **우회**한다
--   ③ 기반 표 `csat_items` 의 정책은 `csat_items_read :: USING (false)` 하나뿐이다
--      → 정책은 완전히 닫혀 있는데, 위 ①②가 그 정책을 건너뛴다
--   ④ 뷰가 **자동 갱신 가능**하다(`is_updatable = YES` · `is_insertable_into = YES` ·
--      INSTEAD OF 트리거 0개 · 규칙 0개) 그리고 **`anon` 에 INSERT/UPDATE/DELETE 권한이 있다**
--
-- 그래서 브라우저에 실리는 anon 키로 뷰에 쓰기를 보내면 소유자 권한으로 기반 표가 바뀐다.
-- 노출 컬럼: id · exam_id · no · section · in_scope · type_id · stem · **answer** · points · high_score.
-- in_scope 문항 수 **802**.
--
-- 대조군이 판단을 확인해 준다: `library_seed_catalog_view` 도 자동 갱신 가능 + anon 쓰기 권한이지만
-- `security_invoker = true` 라 기반 RLS 가 막는다. **차이는 그 옵션 하나다.**
--
-- ── 왜 security_invoker 를 뒤집지 않는가 ────────────────────────────
-- 뒤집으면 `csat_items_read :: USING (false)` 가 적용되어 **CSAT 학습자 화면이 전부 0행**이 된다
-- (`lib/csat/browse.ts:71` · `learner.ts:129,196,327,465,553` · `heatmap.ts:147`).
-- 이 뷰가 SECURITY DEFINER 인 것은 의도된 저작권 경계 장치이고 `db_health_exceptions` 에 면제도 있다.
-- **그 면제는 SELECT 에만 유효하다 — 쓰기는 면제 사유에 없다.** 그래서 고칠 것은 옵션이 아니라 권한이다.
--
-- ── 조치 ────────────────────────────────────────────────────────────
-- 되돌리기: 아래 GRANT 한 줄씩. 데이터는 바뀌지 않는다.

-- ① 쓰기 표면을 없앤다. 이 뷰는 읽기 전용이다.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.csat_items_public FROM anon, authenticated;

-- ② 로그인 전 독자를 없앤다.
--    `/csat*` 는 `lib/auth/protected-routes.ts` 의 PROTECTED_PREFIXES 에 있어 anon 소비자가 0이다.
--    ⚠️ `authenticated` 의 SELECT 는 **절대 회수하지 않는다** — 학습자의 유일한 경로다.
REVOKE SELECT ON TABLE public.csat_items_public FROM anon;

COMMENT ON VIEW public.csat_items_public IS
  '읽기 전용 표면. security_invoker=false 라 기반 csat_items 의 RLS(USING false)를 우회하므로 '
  'anon/authenticated 에 쓰기 권한을 주면 안 된다(2026-09-23 · anon 쓰기 구멍을 막은 마이그레이션). '
  'authenticated SELECT 는 학습자의 유일한 경로이므로 회수 금지.';

-- ── 회귀 가드 ───────────────────────────────────────────────────────
-- 아래 질의가 0행이 아니면 같은 사고가 재발한 것이다(통합 테스트에 넣을 것).
--
--   SELECT c.relname
--   FROM pg_class c
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--   JOIN information_schema.views v ON v.table_schema = n.nspname AND v.table_name = c.relname
--   WHERE n.nspname = 'public' AND c.relkind = 'v'
--     AND NOT coalesce((SELECT option_value::boolean FROM pg_options_to_table(c.reloptions)
--                       WHERE option_name = 'security_invoker'), false)
--     AND (v.is_updatable = 'YES' OR v.is_insertable_into = 'YES')
--     AND (has_table_privilege('anon', c.oid, 'UPDATE')
--          OR has_table_privilege('anon', c.oid, 'INSERT')
--          OR has_table_privilege('anon', c.oid, 'DELETE'));
--
-- 적용 뒤 확인:
--   SELECT has_table_privilege('anon','public.csat_items_public','SELECT')        -- false 여야 한다
--        , has_table_privilege('anon','public.csat_items_public','UPDATE')        -- false
--        , has_table_privilege('authenticated','public.csat_items_public','SELECT') -- true 여야 한다
--        , has_table_privilege('authenticated','public.csat_items_public','UPDATE'); -- false
