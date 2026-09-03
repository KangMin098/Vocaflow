-- supabase/migrations/20260903121358_revoke_anon_execute_unguarded_writer_definers.sql
--
-- **이 마이그레이션은 의도한 일을 하지 못했다.** 뒤따르는 `20260903121759` 가 실제로 고친다.
-- 기록을 남기는 이유는 원격에 이미 적용됐고, 실패 방식이 다음 사람에게 유용하기 때문이다.
--
-- 의도: 미로그인 상태로 쓰기가 되던 SECURITY DEFINER 함수 27개에서 anon 을 걷어낸다.
--
-- 실측(2026-09-03): public 스키마 SECURITY DEFINER 147개 중 anon 이 119개,
-- authenticated 가 137개를 실행할 수 있었다. 그중 **쓰기를 하면서 권한 가드가 없고
-- anon 에 열린 것이 27개**였다. 대표적으로:
--
--   purge_ghost_vocab(uuid)                 — 가드 없이 DELETE
--   update_user_v_level(p_user_id, ...)     — 미로그인자가 임의 사용자 레벨 변경
--   auto_promote_track_level_for_user(...)  — 같음
--   refresh_textbook_shelf_stats()          — 14초 풀스캔을 anon 이 무제한 트리거
--
-- 마지막 것은 보안이자 **가용성** 문제다. 오늘 03:52 인스턴스를 굶겨 죽인 바로 그
-- 풀스캔이고(20260903114408 참조), 그것을 누구나 인증 없이 반복 호출할 수 있었다.
--
-- ⚠️ 왜 실패했나: 함수 EXECUTE 는 기본으로 **PUBLIC** 에 부여된다(ACL 의 `=X/postgres`).
--    anon 은 PUBLIC 의 일원이라 거기서 권한을 얻는다. `REVOKE ... FROM anon` 은
--    존재하지 않는 anon 직접 부여를 지울 뿐이라 **조용히 아무 일도 안 한다.**
--    적용 후 anon 실행 가능 수는 119 → 116(3개만) 이었고, 회수했다고 믿은
--    purge_ghost_vocab 을 anon 키로 부르니 200 을 돌려주며 실제로 실행됐다.
--    이 함정은 `docs/DB_SCHEMA.md` v06.164 항목에 이미 적혀 있었다.

REVOKE EXECUTE ON FUNCTION public.analyze_and_apply_comprehensive_diagnostic_result(p_result_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.analyze_and_apply_diagnostic_result(p_result_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.analyze_and_apply_track_diagnostic_result(p_result_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_diagnostic_result(p_diagnostic_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_topic_categories(p_source_id text, p_min_doc_freq integer, p_min_salience numeric, p_max_words integer, p_dry_run boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.audit_book_extraction(p_book_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_curate_book(p_book_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_promote_track_level_for_user(p_user_id uuid, p_track_id text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_topic_corpus_batch(p_source_id text, p_limit integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.collect_archaic_candidates(p_book_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.collect_content_gate_metrics() FROM anon;
REVOKE EXECUTE ON FUNCTION public.compute_book_coverage(p_book_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decode_entities_in_stored_sentences(p_book_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_topic_corpus_docs(p_source_id text, p_docs jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fill_lbv_resolution(p_book_id uuid, p_only_new boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fix_chapter_html_entities(p_book_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ingest_topic_corpus_doc(p_source_id text, p_external_id text, p_url text, p_content_hash text, p_counts jsonb, p_running_words integer, p_truncated integer, p_title text, p_speaker text, p_published_at timestamp with time zone, p_proper_nouns text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.insert_book_analysis(p_book_id uuid, p_chapters jsonb, p_words jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.purge_ghost_vocab(p_book_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_pending_words(p_user_id uuid, p_lemmas text[], p_text_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.refresh_textbook_shelf_stats() FROM anon;
REVOKE EXECUTE ON FUNCTION public.refresh_user_known_word_count(p_user_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_topic_corpus_claim(p_id uuid, p_status text, p_error text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.republish_article_word_set(p_article_id uuid, p_cap integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.republish_book_word_sets(p_book_id uuid, p_cap integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.store_content_chunk(p_content text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_user_v_level(p_user_id uuid, p_new_level smallint, p_source text, p_confidence numeric, p_reason text, p_diagnostic_id uuid, p_triggered_by text, p_trigger_details jsonb) FROM anon;
