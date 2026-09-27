-- ===== [0] 10. DROP_SAFE 만 모은 SQL 초안 — **실행하지 않았다**
-- public 스키마 죽은 함수 30개 (2026-09-23 감사)
-- 코드 참조 0 · DB 내부 참조 0 · pg_stat_statements 0
drop function if exists public.acp_batch_independent_lines(p_batch_id uuid);
drop function if exists public.acp_compose_shelf_candidates(p_batch_id uuid);
drop function if exists public.acp_prune_compose_candidates(p_days integer);
drop function if exists public.admin_collect_content_gate_metrics();
drop function if exists public.admin_collect_db_health_queues();
drop function if exists public.admin_record_db_health_checkpoint(p_label text, p_phase text, p_note text);
drop function if exists public.book_quiz_coverage(p_book_id uuid);
drop function if exists public.bulk_compute_cefrj_for_all_sources();
drop function if exists public.calc_domain_level(p_word text, p_domain text);
drop function if exists public.calc_track_level(p_word text, p_track text);
drop function if exists public.calculate_next_review_due(p_source text, p_activity_score numeric, p_confidence numeric);
drop function if exists public.calculate_user_v_level_from_mastery(p_user_id uuid);
drop function if exists public.decode_entities_in_stored_sentences(p_book_id uuid);
drop function if exists public.decode_html_entities(p_text text);
drop function if exists public.decr_chunk_refs(p_hashes text[]);
drop function if exists public.en_spelling_variants(p text);
drop function if exists public.fill_lbv_resolution(p_book_id uuid, p_only_new boolean);
drop function if exists public.find_derivational_candidates();
drop function if exists public.find_unmatched_lemmas(p_words text[]);
drop function if exists public.fix_chapter_html_entities(p_book_id uuid);
drop function if exists public.funnel_summary(p_days integer);
drop function if exists public.get_category_path(cat_id text);
drop function if exists public.incr_chunk_refs(p_hashes text[]);
drop function if exists public.lookup_lexicon_clean(p_surface text);
drop function if exists public.purge_ghost_vocab(p_book_id uuid);
drop function if exists public.regenerate_auto_curated_set(p_set_id uuid);
drop function if exists public.select_book_chapter_coverage(p_book_id uuid, p_chapter_idx integer);
drop function if exists public.select_coverage_for_words(p_words text[]);
drop function if exists public.validate_axis_level_entry(p_axis_type text, p_axis_id text, p_level smallint);
drop function if exists public.video_eval_overview();

-- 2차 고아 (위 6번을 지운 뒤에만 죽는다 — 같은 트랜잭션에 넣을지는 결정 사항)
-- drop function if exists public.record_db_health_checkpoint(p_label text, p_phase text, p_note text);