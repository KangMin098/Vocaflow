-- supabase/migrations/20260903121759_revoke_public_execute_unguarded_writer_definers.sql
--
-- **앞 마이그레이션(`20260903121358`)은 거의 듣지 않았다. 이것이 실제로 고친다.**
--
-- `REVOKE ... FROM anon` 을 27개에 걸었는데 anon 실행 가능 수가 119 → 116, 즉 3개만
-- 줄었다. 실측으로 확인했다 — 회수했다고 믿은 `purge_ghost_vocab` 을 anon 키로 부르니
-- **200 을 돌려주며 실제로 실행됐다.**
--
-- 이유는 ACL 에 있다:
--
--   purge_ghost_vocab → {=X/postgres, postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres}
--                        ^^^^^^^^^^^^
--
-- 맨 앞의 `=X/postgres` 가 **PUBLIC 부여**다. anon 은 PUBLIC 의 일원이므로 여기서 실행
-- 권한을 얻는다. `FROM anon` 은 존재하지도 않는 anon 직접 부여를 지울 뿐 PUBLIC 을
-- 건드리지 않는다 — 조용히 아무 일도 안 한다.
--
-- ⚠️ **이게 이 작업의 가장 위험한 함정이다: 회수했다고 착각하게 만든다.**
--    `docs/DB_SCHEMA.md` v06.164 항목에 이미 같은 경고가 적혀 있었는데
--    (`REVOKE FROM anon` 무효 → `REVOKE FROM PUBLIC` 필수), 읽지 않고 반복했다.
--    권한 변경은 마이그레이션 성공 여부가 아니라 **`has_function_privilege()` 재측정과
--    실제 anon 호출**로 검증해야 한다.
--
-- ── 왜 PUBLIC 회수가 authenticated 를 죽이지 않는가 ────────────────────
-- 대상 27개 전부 `authenticated=X` 와 `service_role=X` **명시 부여**를 이미 갖고 있다
-- (실측: public_but_no_auth_grant 0 · no_service_role_grant 0 · null_acl 0).
-- PUBLIC 을 걷어내도 그 둘은 자기 부여로 남는다. 이미 정리된 `admin_vrl_cron_jobs` 의
-- ACL 이 정확히 그 목표 형태다 — `{postgres=X, authenticated=X, service_role=X}` (PUBLIC 없음).
--
-- 호출 경로를 셋 다 확인했다:
--   브라우저(진단·추출·SRS) → authenticated. /diagnostic · /text · /hub 는 전부
--                             `PROTECTED_PREFIXES`(lib/auth/protected-routes.ts) 라
--                             로그아웃 상태로는 도달할 수 없다.
--   API 라우트(topic-corpus·lcp) → createAdminClient() = service_role, requireAdminApi() 뒤.
--   scripts/ → service_role.
--
-- ⚠️ 2026-08-15 에 같은 감사를 시도했다가 `rpc(변수)` 동적 호출을 놓쳐 진단 흐름을
--    죽일 뻔한 기록이 `lib/auth/__tests__/rpc-call-sites.test.ts` 에 남아 있다. 그때
--    문제였던 세 곳은 리터럴로 펴졌고 회귀 락이 걸려 있어 이번 정적 수집은 믿을 수 있다.
--
-- ⚠️ **admin_* 18개는 여기 없다.** anon 에 열려 있지만 본문이
--    `IF NOT is_admin_or_curator() THEN RAISE EXCEPTION 'Forbidden'` 으로 막는다
--    (anon 호출이 실제로 'Forbidden' 을 받는 것을 확인했다). 다음 차수.
--
-- ⚠️ **csat_items_public 뷰는 건드리지 않는다.** advisor 의 유일한 ERROR 지만 이 저장소에선
--    오탐이다 — SECURITY DEFINER 인 것이 **의도된 저작권 경계**다. 기반표 csat_dcp_items 는
--    RLS(dcp_admin)로 비관리자에게 0행이고, 학습자는 이 뷰로만 안전 컬럼을 읽는다.
--    INVOKER 로 바꾸면 학습자 화면이 죽는다.
--
-- 적용 후 실측: anon 실행 가능 119 → **92**(-27) · authenticated **137 그대로** ·
--               service_role 147 · 가드 없는 anon 쓰기 구멍 **27 → 0**.
--               anon 호출 401 permission denied · 공개 표면(csat_items_public ·
--               textbook_shelf_inventory · list_pd_comic_shelf) 전부 200.
--               회귀 36 tests 통과(RLS 표면 14 · 저작권 경계 8 · 권한상승 8 · RPC 호출부 6).
--
-- 되돌리기: 같은 목록에 GRANT EXECUTE ... TO PUBLIC.
--
-- ⚠️ 재실행 안전하다 — REVOKE 는 멱등이고, PUBLIC 부여가 없는 함수에 걸어도 무해하다.

REVOKE EXECUTE ON FUNCTION public.analyze_and_apply_comprehensive_diagnostic_result(p_result_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.analyze_and_apply_diagnostic_result(p_result_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.analyze_and_apply_track_diagnostic_result(p_result_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_diagnostic_result(p_diagnostic_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_topic_categories(p_source_id text, p_min_doc_freq integer, p_min_salience numeric, p_max_words integer, p_dry_run boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.audit_book_extraction(p_book_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_curate_book(p_book_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_promote_track_level_for_user(p_user_id uuid, p_track_id text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_topic_corpus_batch(p_source_id text, p_limit integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.collect_archaic_candidates(p_book_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.collect_content_gate_metrics() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.compute_book_coverage(p_book_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decode_entities_in_stored_sentences(p_book_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_topic_corpus_docs(p_source_id text, p_docs jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fill_lbv_resolution(p_book_id uuid, p_only_new boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fix_chapter_html_entities(p_book_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ingest_topic_corpus_doc(p_source_id text, p_external_id text, p_url text, p_content_hash text, p_counts jsonb, p_running_words integer, p_truncated integer, p_title text, p_speaker text, p_published_at timestamp with time zone, p_proper_nouns text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.insert_book_analysis(p_book_id uuid, p_chapters jsonb, p_words jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_ghost_vocab(p_book_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_pending_words(p_user_id uuid, p_lemmas text[], p_text_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_textbook_shelf_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_user_known_word_count(p_user_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_topic_corpus_claim(p_id uuid, p_status text, p_error text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.republish_article_word_set(p_article_id uuid, p_cap integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.republish_book_word_sets(p_book_id uuid, p_cap integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.store_content_chunk(p_content text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_user_v_level(p_user_id uuid, p_new_level smallint, p_source text, p_confidence numeric, p_reason text, p_diagnostic_id uuid, p_triggered_by text, p_trigger_details jsonb) FROM PUBLIC;
