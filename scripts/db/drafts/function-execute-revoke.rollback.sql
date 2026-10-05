-- 위 초안의 정확 복원 — 적용 전 proacl(2026-10-05 실측)로 되돌린다. 함수마다 네 역할을 모두 회수한 뒤 원래 직접 GRANT 만 다시 준다.
begin;
alter default privileges in schema public grant execute on functions to authenticated;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.acp_apply_license_gate() from public, anon, authenticated, service_role;
grant execute on function public.acp_apply_license_gate() to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.acp_batch_independent_lines(uuid) from public, anon, authenticated, service_role;
grant execute on function public.acp_batch_independent_lines(uuid) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.acp_claim_compose_jobs(text, integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.acp_claim_compose_jobs(text, integer, integer) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.acp_compose_shelf_candidates(uuid) from public, anon, authenticated, service_role;
grant execute on function public.acp_compose_shelf_candidates(uuid) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.acp_prune_compose_candidates(integer) from public, anon, authenticated, service_role;
grant execute on function public.acp_prune_compose_candidates(integer) to authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.agg_daily_activity_from_learning_record() from public, anon, authenticated, service_role;
grant execute on function public.agg_daily_activity_from_learning_record() to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.agg_daily_activity_from_score() from public, anon, authenticated, service_role;
grant execute on function public.agg_daily_activity_from_score() to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.analyze_book_vrl(uuid) from public, anon, authenticated, service_role;
grant execute on function public.analyze_book_vrl(uuid) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.analyze_diagnostic_result(uuid) from public, anon, authenticated, service_role;
grant execute on function public.analyze_diagnostic_result(uuid) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.analyze_track_diagnostic_result(uuid) from public, anon, authenticated, service_role;
grant execute on function public.analyze_track_diagnostic_result(uuid) to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.apply_diagnostic_result(uuid) from public, anon, authenticated, service_role;
grant execute on function public.apply_diagnostic_result(uuid) to authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.article_seed_set_updated_at() from public, anon, authenticated, service_role;
grant execute on function public.article_seed_set_updated_at() to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.audit_book_extraction(uuid) from public, anon, authenticated, service_role;
grant execute on function public.audit_book_extraction(uuid) to authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.auto_compute_freq_fields() from public, anon, authenticated, service_role;
grant execute on function public.auto_compute_freq_fields() to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.auto_promote_track_level_for_user(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.auto_promote_track_level_for_user(uuid, text) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.book_comic_available(uuid) from public, anon, authenticated, service_role;
grant execute on function public.book_comic_available(uuid) to anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.book_quiz_coverage(uuid) from public, anon, authenticated, service_role;
grant execute on function public.book_quiz_coverage(uuid) to anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.books_needing_audit(integer) from public, anon, authenticated, service_role;
grant execute on function public.books_needing_audit(integer) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.bulk_compute_cefrj_for_all_sources() from public, anon, authenticated, service_role;
grant execute on function public.bulk_compute_cefrj_for_all_sources() to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.calc_domain_level(text, text) from public, anon, authenticated, service_role;
grant execute on function public.calc_domain_level(text, text) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.calc_skill_level(text) from public, anon, authenticated, service_role;
grant execute on function public.calc_skill_level(text) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.calc_track_level(text, text) from public, anon, authenticated, service_role;
grant execute on function public.calc_track_level(text, text) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.calculate_next_review_due(text, numeric, numeric) from public, anon, authenticated, service_role;
grant execute on function public.calculate_next_review_due(text, numeric, numeric) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.calculate_next_review_due(uuid) from public, anon, authenticated, service_role;
grant execute on function public.calculate_next_review_due(uuid) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.calculate_user_v_level_from_mastery(uuid) from public, anon, authenticated, service_role;
grant execute on function public.calculate_user_v_level_from_mastery(uuid) to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.collect_content_gate_metrics() from public, anon, authenticated, service_role;
grant execute on function public.collect_content_gate_metrics() to authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.compute_book_chapter_v_levels(uuid) from public, anon, authenticated, service_role;
grant execute on function public.compute_book_chapter_v_levels(uuid) to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.compute_book_coverage(uuid) from public, anon, authenticated, service_role;
grant execute on function public.compute_book_coverage(uuid) to authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.compute_book_difficulty(uuid) from public, anon, authenticated, service_role;
grant execute on function public.compute_book_difficulty(uuid) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.compute_book_syntax(uuid) from public, anon, authenticated, service_role;
grant execute on function public.compute_book_syntax(uuid) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.compute_book_vrl(uuid) from public, anon, authenticated, service_role;
grant execute on function public.compute_book_vrl(uuid) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.cron_auto_promote_all_users() from public, anon, authenticated, service_role;
grant execute on function public.cron_auto_promote_all_users() to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.csat_coverage() from public, anon, authenticated, service_role;
grant execute on function public.csat_coverage() to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.csat_demote_on_review_change() from public, anon, authenticated, service_role;
grant execute on function public.csat_demote_on_review_change() to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.csat_drain_runs_stamp_finished() from public, anon, authenticated, service_role;
grant execute on function public.csat_drain_runs_stamp_finished() to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.csat_source_eligibility_tally() from public, anon, authenticated, service_role;
grant execute on function public.csat_source_eligibility_tally() to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.csat_source_is_eligible(uuid) from public, anon, authenticated, service_role;
grant execute on function public.csat_source_is_eligible(uuid) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.csat_source_is_gradeable(uuid) from public, anon, authenticated, service_role;
grant execute on function public.csat_source_is_gradeable(uuid) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.csat_source_rollup() from public, anon, authenticated, service_role;
grant execute on function public.csat_source_rollup() to anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.csat_source_snapshot_take(text) from public, anon, authenticated, service_role;
grant execute on function public.csat_source_snapshot_take(text) to anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.curriculum_bands(text[]) from public, anon, authenticated, service_role;
grant execute on function public.curriculum_bands(text[]) to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.db_health_checkpoint_diff(text) from public, anon, authenticated, service_role;
grant execute on function public.db_health_checkpoint_diff(text) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.decode_entities_in_stored_sentences(uuid) from public, anon, authenticated, service_role;
grant execute on function public.decode_entities_in_stored_sentences(uuid) to authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.decode_html_entities(text) from public, anon, authenticated, service_role;
grant execute on function public.decode_html_entities(text) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.decr_chunk_refs(text[]) from public, anon, authenticated, service_role;
grant execute on function public.decr_chunk_refs(text[]) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.derive_learner_stage(uuid) from public, anon, authenticated, service_role;
grant execute on function public.derive_learner_stage(uuid) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.en_derivational_bases(text) from public, anon, authenticated, service_role;
grant execute on function public.en_derivational_bases(text) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.en_negation_preserved(text, text) from public, anon, authenticated, service_role;
grant execute on function public.en_negation_preserved(text, text) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.en_spelling_variants(text) from public, anon, authenticated, service_role;
grant execute on function public.en_spelling_variants(text) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.enforce_archaic_not_in_shared() from public, anon, authenticated, service_role;
grant execute on function public.enforce_archaic_not_in_shared() to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.enforce_base_word_depth1() from public, anon, authenticated, service_role;
grant execute on function public.enforce_base_word_depth1() to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.enforce_domain_levels_keys() from public, anon, authenticated, service_role;
grant execute on function public.enforce_domain_levels_keys() to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.enforce_track_levels_keys() from public, anon, authenticated, service_role;
grant execute on function public.enforce_track_levels_keys() to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.fill_lbv_resolution(uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function public.fill_lbv_resolution(uuid, boolean) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.find_derivational_candidates() from public, anon, authenticated, service_role;
grant execute on function public.find_derivational_candidates() to anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.find_unmatched_lemmas(text[]) from public, anon, authenticated, service_role;
grant execute on function public.find_unmatched_lemmas(text[]) to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.fix_chapter_html_entities(uuid) from public, anon, authenticated, service_role;
grant execute on function public.fix_chapter_html_entities(uuid) to authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.funnel_summary(integer) from public, anon, authenticated, service_role;
grant execute on function public.funnel_summary(integer) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.game_rank_alias(uuid) from public, anon, authenticated, service_role;
grant execute on function public.game_rank_alias(uuid) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.game_rank_window(text) from public, anon, authenticated, service_role;
grant execute on function public.game_rank_window(text) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.get_category_path(text) from public, anon, authenticated, service_role;
grant execute on function public.get_category_path(text) to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.get_lcp_config() from public, anon, authenticated, service_role;
grant execute on function public.get_lcp_config() to anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.guard_ai_generated_license() from public, anon, authenticated, service_role;
grant execute on function public.guard_ai_generated_license() to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.guard_user_profiles_privileged_columns() from public, anon, authenticated, service_role;
grant execute on function public.guard_user_profiles_privileged_columns() to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.handle_new_user() from public, anon, authenticated, service_role;
grant execute on function public.handle_new_user() to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.incr_chunk_refs(text[]) from public, anon, authenticated, service_role;
grant execute on function public.incr_chunk_refs(text[]) to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.insert_book_analysis(uuid, jsonb, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.insert_book_analysis(uuid, jsonb, jsonb) to authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.is_quoted_foreign_citation(text, text) from public, anon, authenticated, service_role;
grant execute on function public.is_quoted_foreign_citation(text, text) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.is_valid_assignment_words(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.is_valid_assignment_words(jsonb) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.lb_compute_kr_safe() from public, anon, authenticated, service_role;
grant execute on function public.lb_compute_kr_safe() to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.lb_compute_search_vector() from public, anon, authenticated, service_role;
grant execute on function public.lb_compute_search_vector() to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.list_book_chapter_quiz_catalog() from public, anon, authenticated, service_role;
grant execute on function public.list_book_chapter_quiz_catalog() to anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.lookup_lexicon_clean(text) from public, anon, authenticated, service_role;
grant execute on function public.lookup_lexicon_clean(text) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.lsc_compute_composite() from public, anon, authenticated, service_role;
grant execute on function public.lsc_compute_composite() to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.maintain_reference_stats() from public, anon, authenticated, service_role;
grant execute on function public.maintain_reference_stats() to anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.purge_ghost_vocab(uuid) from public, anon, authenticated, service_role;
grant execute on function public.purge_ghost_vocab(uuid) to authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.quiz_target_per_chapter(smallint) from public, anon, authenticated, service_role;
grant execute on function public.quiz_target_per_chapter(smallint) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.refresh_lemma_dominant_pos() from public, anon, authenticated, service_role;
grant execute on function public.refresh_lemma_dominant_pos() to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.refresh_textbook_shelf_stats() from public, anon, authenticated, service_role;
grant execute on function public.refresh_textbook_shelf_stats() to authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.regexp_quote(text) from public, anon, authenticated, service_role;
grant execute on function public.regexp_quote(text) to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.republish_article_word_set(uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.republish_article_word_set(uuid, integer) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.republish_book_word_sets(uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.republish_book_word_sets(uuid, integer) to authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.select_book_chapter_coverage(uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.select_book_chapter_coverage(uuid, integer) to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.select_book_chapter_quiz(uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.select_book_chapter_quiz(uuid, integer) to anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.select_coverage_for_words(text[]) from public, anon, authenticated, service_role;
grant execute on function public.select_coverage_for_words(text[]) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.select_pd_comic_provenance(text) from public, anon, authenticated, service_role;
grant execute on function public.select_pd_comic_provenance(text) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.set_updated_at() from public, anon, authenticated, service_role;
grant execute on function public.set_updated_at() to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.sync_cefr_from_v_level() from public, anon, authenticated, service_role;
grant execute on function public.sync_cefr_from_v_level() to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.textfit_resolve_levels_public(text[]) from public, anon, authenticated, service_role;
grant execute on function public.textfit_resolve_levels_public(text[]) to anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.tg_maintain_set_subscriber_count() from public, anon, authenticated, service_role;
grant execute on function public.tg_maintain_set_subscriber_count() to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.tg_study_plan_items_touch() from public, anon, authenticated, service_role;
grant execute on function public.tg_study_plan_items_touch() to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.trg_lb_enqueue_pipeline() from public, anon, authenticated, service_role;
grant execute on function public.trg_lb_enqueue_pipeline() to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.trg_lbv_fill_lemma() from public, anon, authenticated, service_role;
grant execute on function public.trg_lbv_fill_lemma() to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.trg_lcm_chunk_refs() from public, anon, authenticated, service_role;
grant execute on function public.trg_lcm_chunk_refs() to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.trg_publish_article_word_set() from public, anon, authenticated, service_role;
grant execute on function public.trg_publish_article_word_set() to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.trg_publish_book_word_sets() from public, anon, authenticated, service_role;
grant execute on function public.trg_publish_book_word_sets() to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.trg_require_article_audio() from public, anon, authenticated, service_role;
grant execute on function public.trg_require_article_audio() to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.trg_require_compose_gates() from public, anon, authenticated, service_role;
grant execute on function public.trg_require_compose_gates() to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.trg_shared_words_sync_pronunciation() from public, anon, authenticated, service_role;
grant execute on function public.trg_shared_words_sync_pronunciation() to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.update_user_v_level(uuid, smallint, text, numeric, text, uuid, text, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.update_user_v_level(uuid, smallint, text, numeric, text, uuid, text, jsonb) to authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.validate_axis_level_entry(text, text, smallint) from public, anon, authenticated, service_role;
grant execute on function public.validate_axis_level_entry(text, text, smallint) to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.video_eval_overview() from public, anon, authenticated, service_role;
grant execute on function public.video_eval_overview() to anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.video_job_restart(text, text) from public, anon, authenticated, service_role;
grant execute on function public.video_job_restart(text, text) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.video_jobs_overview() from public, anon, authenticated, service_role;
grant execute on function public.video_jobs_overview() to anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.video_request_add_revision(uuid, jsonb, jsonb, jsonb, text) from public, anon, authenticated, service_role;
grant execute on function public.video_request_add_revision(uuid, jsonb, jsonb, jsonb, text) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.video_request_advance(uuid, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.video_request_advance(uuid, text, text, text) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.video_request_record_evaluation(uuid, jsonb, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.video_request_record_evaluation(uuid, jsonb, jsonb) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.video_retire_mark_purged(text) from public, anon, authenticated, service_role;
grant execute on function public.video_retire_mark_purged(text) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.video_retire_rerendered(text) from public, anon, authenticated, service_role;
grant execute on function public.video_retire_rerendered(text) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_archive_article(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_archive_article(uuid) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_archive_book(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_archive_book(uuid) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_bulk_requeue_articles(uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.admin_bulk_requeue_articles(uuid[]) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_bulk_requeue_books(uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.admin_bulk_requeue_books(uuid[]) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_bulk_set_books_curating(uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.admin_bulk_set_books_curating(uuid[]) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_collect_content_gate_metrics() from public, anon, authenticated, service_role;
grant execute on function public.admin_collect_content_gate_metrics() to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_collect_db_health_integrity() from public, anon, authenticated, service_role;
grant execute on function public.admin_collect_db_health_integrity() to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_collect_db_health_metrics() from public, anon, authenticated, service_role;
grant execute on function public.admin_collect_db_health_metrics() to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_collect_db_health_queues() from public, anon, authenticated, service_role;
grant execute on function public.admin_collect_db_health_queues() to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_collect_quality_metrics() from public, anon, authenticated, service_role;
grant execute on function public.admin_collect_quality_metrics() to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_db_health_live() from public, anon, authenticated, service_role;
grant execute on function public.admin_db_health_live() to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_delete_article(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_delete_article(uuid) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_delete_book(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_delete_book(uuid) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_delete_comic(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_delete_comic(uuid) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_enqueue_article(text, text, text, text, text, timestamp with time zone, text, text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_enqueue_article(text, text, text, text, text, timestamp with time zone, text, text, text, text, text) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_enqueue_book(text, text, text, text, integer, integer, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_enqueue_book(text, text, text, text, integer, integer, text) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_force_publish_article(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_force_publish_article(uuid) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_force_publish_book(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_force_publish_book(uuid) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_record_db_health_checkpoint(text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_record_db_health_checkpoint(text, text, text) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_requeue_article(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_requeue_article(uuid) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_requeue_book(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_requeue_book(uuid) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_revert_published_article(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_revert_published_article(uuid) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_revert_published_book(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_revert_published_book(uuid) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_run_db_health_action(text, text, text, bigint) from public, anon, authenticated, service_role;
grant execute on function public.admin_run_db_health_action(text, text, text, bigint) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_set_comic_published(uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_comic_published(uuid, boolean) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_set_db_health_finding_status(bigint, text, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_db_health_finding_status(bigint, text, text) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_vrl_cron_jobs() from public, anon, authenticated, service_role;
grant execute on function public.admin_vrl_cron_jobs() to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_vrl_cron_runs() from public, anon, authenticated, service_role;
grant execute on function public.admin_vrl_cron_runs() to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_vrl_diagnostic_use() from public, anon, authenticated, service_role;
grant execute on function public.admin_vrl_diagnostic_use() to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_vrl_snapshot_counts() from public, anon, authenticated, service_role;
grant execute on function public.admin_vrl_snapshot_counts() to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_vrl_track_distribution() from public, anon, authenticated, service_role;
grant execute on function public.admin_vrl_track_distribution() to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.admin_vrl_v_level_distribution() from public, anon, authenticated, service_role;
grant execute on function public.admin_vrl_v_level_distribution() to authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.archive_book_pipeline_messages(uuid) from public, anon, authenticated, service_role;
grant execute on function public.archive_book_pipeline_messages(uuid) to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.commit_chapter_vocab(uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.commit_chapter_vocab(uuid, integer) to anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres}
revoke execute on function public.csat_ec_add_probe_response(uuid, smallint, jsonb, integer) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_add_probe_response(uuid, smallint, jsonb, integer) to authenticated;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres}
revoke execute on function public.csat_ec_add_process_evidence(uuid, smallint, text, jsonb, uuid) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_add_process_evidence(uuid, smallint, text, jsonb, uuid) to authenticated;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres}
revoke execute on function public.csat_ec_add_student_claim(uuid, smallint, text, text, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_add_student_claim(uuid, smallint, text, text, text, uuid) to authenticated;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres}
revoke execute on function public.csat_ec_blind_queue(bigint) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_blind_queue(bigint) to authenticated;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres}
revoke execute on function public.csat_ec_capture_close(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_capture_close(uuid, text, text) to authenticated;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres}
revoke execute on function public.csat_ec_capture_finish(uuid) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_capture_finish(uuid) to authenticated;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres}
revoke execute on function public.csat_ec_capture_open(uuid) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_capture_open(uuid) to authenticated;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres}
revoke execute on function public.csat_ec_close_tombstone(bigint, text) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_close_tombstone(bigint, text) to authenticated;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres}
revoke execute on function public.csat_ec_confirm_session(uuid, boolean, boolean) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_confirm_session(uuid, boolean, boolean) to authenticated;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres}
revoke execute on function public.csat_ec_my_capture_state(uuid) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_my_capture_state(uuid) to authenticated;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres}
revoke execute on function public.csat_ec_my_pending_probes(uuid) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_my_pending_probes(uuid) to authenticated;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres}
revoke execute on function public.csat_ec_my_process_evidence(uuid) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_my_process_evidence(uuid) to authenticated;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres}
revoke execute on function public.csat_ec_reveal_view(bigint) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_reveal_view(bigint) to authenticated;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres}
revoke execute on function public.csat_ec_round_advance(bigint, text, text) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_round_advance(bigint, text, text) to authenticated;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres}
revoke execute on function public.csat_ec_round_assign(bigint, uuid, text, text[]) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_round_assign(bigint, uuid, text, text[]) to authenticated;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres}
revoke execute on function public.csat_ec_round_create(text, text, text, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_round_create(text, text, text, jsonb) to authenticated;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres}
revoke execute on function public.csat_ec_round_material(bigint) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_round_material(bigint) to authenticated;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres}
revoke execute on function public.csat_ec_round_reveal(bigint) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_round_reveal(bigint) to authenticated;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres}
revoke execute on function public.csat_ec_round_set_targets(bigint, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_round_set_targets(bigint, jsonb) to authenticated;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres}
revoke execute on function public.csat_ec_round_start_blind(bigint) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_round_start_blind(bigint) to authenticated;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres}
revoke execute on function public.csat_ec_submit_adjudication(bigint, uuid, smallint, text, text, text[], text[], text, text[], text[], boolean) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_submit_adjudication(bigint, uuid, smallint, text, text, text[], text[], text, text[], text[], boolean) to authenticated;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres}
revoke execute on function public.csat_ec_submit_blind(bigint, uuid, smallint, text, text, text[], text[], text, text[], text[], boolean) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_submit_blind(bigint, uuid, smallint, text, text, text[], text[], text, text[], text[], boolean) to authenticated;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres}
revoke execute on function public.csat_ec_submit_verify(bigint, uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_submit_verify(bigint, uuid, text, text) to authenticated;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres}
revoke execute on function public.csat_ec_taxonomy_seal(text) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_taxonomy_seal(text) to authenticated;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.db_health_anomalies(integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.db_health_anomalies(integer, integer) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.deliver_chapter_vocab(uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.deliver_chapter_vocab(uuid, integer) to anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.dict_categorical_distributions() from public, anon, authenticated, service_role;
grant execute on function public.dict_categorical_distributions() to anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.dict_inflections_by_pos() from public, anon, authenticated, service_role;
grant execute on function public.dict_inflections_by_pos() to anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.dict_polysemy_count() from public, anon, authenticated, service_role;
grant execute on function public.dict_polysemy_count() to anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.dictation_overview() from public, anon, authenticated, service_role;
grant execute on function public.dictation_overview() to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.dictation_recent_misses(integer) from public, anon, authenticated, service_role;
grant execute on function public.dictation_recent_misses(integer) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.dictation_weakness(integer) from public, anon, authenticated, service_role;
grant execute on function public.dictation_weakness(integer) to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.enqueue_comic_jobs(uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.enqueue_comic_jobs(uuid[]) to anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.enqueue_curation_jobs(uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.enqueue_curation_jobs(uuid[]) to anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.enqueue_quiz_jobs(uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.enqueue_quiz_jobs(uuid[]) to anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.enqueue_review_jobs(uuid[], text) from public, anon, authenticated, service_role;
grant execute on function public.enqueue_review_jobs(uuid[], text) to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.enroll_library_book(uuid) from public, anon, authenticated, service_role;
grant execute on function public.enroll_library_book(uuid) to anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.extract_book_vocabulary_admin(uuid, smallint) from public, anon, authenticated, service_role;
grant execute on function public.extract_book_vocabulary_admin(uuid, smallint) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.find_unbound_book_lemmas(uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.find_unbound_book_lemmas(uuid, integer) to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.game_leaderboard(text, text, integer) from public, anon, authenticated, service_role;
grant execute on function public.game_leaderboard(text, text, integer) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.game_rank_summary(text) from public, anon, authenticated, service_role;
grant execute on function public.game_rank_summary(text) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.get_chapter_content(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_chapter_content(uuid) to anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.get_judgment_sample(text, uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.get_judgment_sample(text, uuid, integer) to authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.grade_dcp_item(uuid, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.grade_dcp_item(uuid, jsonb) to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.is_admin() from public, anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.is_admin_or_curator() from public, anon, authenticated, service_role;
grant execute on function public.is_admin_or_curator() to anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.is_class_member(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.is_class_member(uuid, uuid) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.is_class_teacher(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.is_class_teacher(uuid, uuid) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.join_class_by_code(text) from public, anon, authenticated, service_role;
grant execute on function public.join_class_by_code(text) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.library_seed_dedup_key(text, text) from public, anon, authenticated, service_role;
grant execute on function public.library_seed_dedup_key(text, text) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.prescribe_today(uuid, integer[]) from public, anon, authenticated, service_role;
grant execute on function public.prescribe_today(uuid, integer[]) to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.queue_seed_catalog_for_curation(integer, text, boolean) from public, anon, authenticated, service_role;
grant execute on function public.queue_seed_catalog_for_curation(integer, text, boolean) to authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.run_content_quality_gate_details(text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.run_content_quality_gate_details(text, uuid) to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.run_content_quality_gates(text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.run_content_quality_gates(text, uuid) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.save_comic_progress(uuid, integer, integer, boolean) from public, anon, authenticated, service_role;
grant execute on function public.save_comic_progress(uuid, integer, integer, boolean) to anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.save_extraction_judgment(text, uuid, integer, text, text, text, text, boolean) from public, anon, authenticated, service_role;
grant execute on function public.save_extraction_judgment(text, uuid, integer, text, text, text, text, boolean) to authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.select_article_vocab(uuid) from public, anon, authenticated, service_role;
grant execute on function public.select_article_vocab(uuid) to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.set_word_familiarity(text, text, smallint) from public, anon, authenticated, service_role;
grant execute on function public.set_word_familiarity(text, text, smallint) to anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.stage_book_dict_candidates(uuid) from public, anon, authenticated, service_role;
grant execute on function public.stage_book_dict_candidates(uuid) to authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.subscribe_article_word_set(uuid) from public, anon, authenticated, service_role;
grant execute on function public.subscribe_article_word_set(uuid) to public, anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.sync_published_set_examples(uuid) from public, anon, authenticated, service_role;
grant execute on function public.sync_published_set_examples(uuid) to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.textbook_practice_items(smallint, integer) from public, anon, authenticated, service_role;
grant execute on function public.textbook_practice_items(smallint, integer) to anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.topic_corpus_overview() from public, anon, authenticated, service_role;
grant execute on function public.topic_corpus_overview() to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.unenroll_library_book(uuid) from public, anon, authenticated, service_role;
grant execute on function public.unenroll_library_book(uuid) to anon, authenticated, service_role;
-- 원래 acl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.update_pending_word_status(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.update_pending_word_status(uuid, text, text) to public, anon, authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.video_is_admin() from public, anon, authenticated, service_role;
grant execute on function public.video_is_admin() to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.video_request_cancel(uuid) from public, anon, authenticated, service_role;
grant execute on function public.video_request_cancel(uuid) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.video_request_create(text, text, text, text, text, text[], text, text) from public, anon, authenticated, service_role;
grant execute on function public.video_request_create(text, text, text, text, text, text[], text, text) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.video_request_review(uuid, integer, text, text) from public, anon, authenticated, service_role;
grant execute on function public.video_request_review(uuid, integer, text, text) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.video_restore(text) from public, anon, authenticated, service_role;
grant execute on function public.video_restore(text) to authenticated, service_role;
-- 원래 acl: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
revoke execute on function public.video_retire(text, text) from public, anon, authenticated, service_role;
grant execute on function public.video_retire(text, text) to authenticated, service_role;
commit;
