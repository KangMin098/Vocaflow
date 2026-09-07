-- supabase/migrations/20260904084631_revoke_anon_admin_rpcs_and_lemma_pos_mv.sql
--
-- **미로그인자가 admin RPC 를 부를 수 있던 것과, 유일하게 남은 anon 노출 MV 를 닫는다.**
--
-- 앞선 `20260903121759` 가 "가드 없는 anon 쓰기" 27종을 0으로 만들었다. 이건 그 나머지다.
--
-- ── A. admin_* 18종 ────────────────────────────────────────────────────
-- anon 이 `/rest/v1/rpc/admin_delete_book` 을 부를 수 있었다. 본문 가드가 실제로 막는 것은
-- 확인했다(anon 호출이 `Forbidden: admin or curator only` 수신). 그래서 악용은 불가능했지만,
-- **방어선이 함수 본문 하나뿐이었다.** 가드를 빠뜨린 함수가 하나만 새로 들어와도 뚫린다.
--
-- ⚠️ 이 18종은 앞의 27종과 권한 구조가 다르다 — `anon=X` **명시 부여**와 PUBLIC 이 **둘 다**
--    있다. 그래서 `FROM anon, PUBLIC` 으로 양쪽을 걷는다. 한쪽만 걷으면 조용히 안 걷힌다
--    (`20260903121358` 이 그렇게 실패했다).
--
-- `authenticated=X` 는 18종 모두 명시 부여라 남는다 — Admin 콘솔은 브라우저에서
-- `createClient()`(= 로그인한 authenticated)로 이 RPC 들을 부르므로 그대로 동작한다.
--
-- ── B. mv_lemma_dominant_pos ───────────────────────────────────────────
-- anon 이 SELECT 할 수 있는 public 객체 120개를 훑은 결과, **RLS 없는 테이블은 0개**였다
-- (105개는 RLS 정책으로 통제 · 4개는 RLS on/정책 0 으로 잠김 · 뷰 11개 중 9개는
--  security_invoker 라 기반표 RLS 를 받는다). pg_graphql 경고 240건은 데이터 유출이 아니라
-- **스키마 발견 가능성**이었다.
--
-- 실질 노출은 이것 하나다 — **머티리얼라이즈드 뷰는 RLS 를 걸 수 없어** 11,085행이 통째로
-- anon 에게 읽혔다.
--
-- ⚠️ **authenticated 는 일부러 남긴다.** `select_book_chapter_vocab` 이 SECURITY **INVOKER**
--    라 이 MV 를 호출자 권한으로 읽는다. authenticated 까지 걷으면 그 함수가 깨진다.
--    프로덕션 anon 경로는 없다(참조는 admin-queries.ts 주석 1건 + 통합테스트 2건이고,
--    그 테스트는 SERVICE_ROLE 로 붙는다).
--
-- ── 손대지 않은 advisor 항목과 그 근거 ─────────────────────────────────
--   function_search_path_mutable 57 — DEFINER 147/147 이 이미 search_path 고정(가변 0).
--                                     가변 195개는 전부 INVOKER 라 권한 상승 경로가 없다.
--   rls_enabled_no_policy 8        — RLS on + 정책 0 = fail-closed. anon 조회가 `[]` 를
--                                     돌려주는 것을 확인했다. 의도된 락이다.
--   extension_in_public 5          — pg_trgm·btree_gin 에 GIN/trigram 인덱스가 의존한다.
--                                     옮기면 인덱스가 깨진다. 이득 없이 위험만 는다.
--   security_definer_view (ERROR)  — csat_items_public 은 의도된 저작권 경계다. 고치지 말 것.
--   auth_leaked_password_protection — 대시보드 토글이라 SQL 로 못 켠다.
--
-- 적용 후 실측: anon 실행 가능 definer **92 → 74** · authenticated **137 그대로** ·
--               anon 실행 가능 admin_* **18 → 0** · MV anon SELECT false / authenticated true.
--               anon 호출 401 permission denied · 공개 표면 200 유지.
--               회귀 **224 tests 통과**(11 파일 — RLS 표면 · 저작권 경계 · 권한상승 ·
--               RPC 호출부 · 추출 RPC · 비속어 미발행 포함).
--
-- 되돌리기: 같은 목록에 GRANT EXECUTE ... TO anon / GRANT SELECT ... TO anon.
--
-- ⚠️ 재실행 안전하다 — REVOKE 는 멱등이다. 적용 후에는 마이그레이션 성공 여부가 아니라
--    `has_function_privilege()` 재측정과 실제 anon 키 호출로 검증할 것.

-- ── A. admin RPC 18종 ──────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.admin_archive_article(p_article_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_archive_book(p_book_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_bulk_requeue_articles(p_article_ids uuid[]) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_bulk_requeue_books(p_book_ids uuid[]) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_bulk_set_books_curating(p_book_ids uuid[]) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_collect_quality_metrics() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_delete_article(p_article_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_delete_book(p_book_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_delete_comic(p_book_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_enqueue_article(p_source text, p_source_id text, p_title text, p_author text, p_url text, p_published_at timestamp with time zone, p_license text, p_content text, p_audio_url text, p_feed_id text, p_feed_label text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_enqueue_book(p_source text, p_source_id text, p_title text, p_author text, p_author_birth_year integer, p_author_death_year integer, p_license text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_force_publish_article(p_article_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_force_publish_book(p_book_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_requeue_article(p_article_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_requeue_book(p_book_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_revert_published_article(p_article_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_revert_published_book(p_book_id uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_comic_published(p_book_id uuid, p_published boolean) FROM anon, PUBLIC;

-- ── B. anon 노출 MV ────────────────────────────────────────────────────
REVOKE SELECT ON public.mv_lemma_dominant_pos FROM anon;
