-- supabase/migrations/20261014150000_funnel_allow_csat_meaning.sql
--
-- **원문 이해 교수 판(v3.1 · scene=meaning) 관측 이벤트 6종을 DB 가 받게 한다.** (AGENTS D2 · 보완안 「열람 · 작성 · 자기 대조 기록」)
-- 새 6종: csat_meaning_unit_selected · csat_meaning_depth_changed · csat_meaning_relation_opened ·
--         csat_meaning_whole_traced · csat_meaning_draft_compared · csat_meaning_bridge_followed
-- 속성은 닫힌 열거형만(D3) — 의미 · 관계 id · 초안 글은 보내지 않는다(lib/analytics/events.ts).
--
-- ⚠️ 목록은 적용 직전 DB 제약(pg_get_constraintdef, 2026-10-14 조회)에서 옮겼다 — 기존 83개 + 새 6개 = 89개.
--    앱 레지스트리(lib/analytics/events.ts)에만 넣으면 이벤트가 조용히 0건이 된다.
-- ⚠️ 적용 직전 같은 조회를 다시 해서 83개가 그대로인지 확인한다(다른 세션이 그 사이 늘렸으면 그 값을 합친다).
-- ⚠️ 되돌리기: 아래 ARRAY 에서 csat_meaning_* 여섯 줄을 빼고 다시 실행한다. 데이터는 지우지 않는다.

ALTER TABLE public.funnel_events DROP CONSTRAINT IF EXISTS funnel_events_event_check;

ALTER TABLE public.funnel_events
  ADD CONSTRAINT funnel_events_event_check CHECK (
    event = ANY (
      ARRAY[
        'catalog_viewed', 'csat_atlas_scoped', 'csat_drill_answered', 'csat_drill_finished',
        'csat_dx_attempt_saved', 'csat_dx_habit_answered', 'csat_dx_history_compared', 'csat_dx_profile_saved',
        'csat_dx_test_submitted', 'csat_dx_viewed', 'csat_ec_capture_closed', 'csat_ec_capture_finished',
        'csat_ec_capture_opened', 'csat_evidence_opened', 'csat_home_viewed', 'csat_item_back',
        'csat_lecture_ended', 'csat_lecture_played', 'csat_map_goal_set', 'csat_map_node_opened',
        'csat_map_task_toggled', 'csat_map_viewed', 'csat_overlay_answered', 'csat_overlay_loaded',
        'csat_overlay_located', 'csat_overlay_revealed', 'csat_paper_read', 'csat_path_chosen',
        'csat_plan_ordered', 'csat_plan_speed_set', 'csat_resume_clicked', 'csat_review_done',
        'csat_review_started', 'csat_session_answered', 'csat_session_explained', 'csat_session_finished',
        'csat_session_marked', 'csat_session_started', 'csat_space_opened', 'csat_space_scoped',
        'csat_trap_opened', 'csat_workspace_created', 'csat_workspace_edited', 'csat_workspace_opened',
        'csat_workspace_session_started', 'csat_workspace_suggestion_applied', 'fit_analyzed', 'fit_level_moved',
        'fit_share_opened', 'fit_shared', 'fit_sheet_opened', 'fit_signup_clicked',
        'fit_viewed', 'fit_worksheet_printed', 'hub_hero_moved', 'hub_promo_clicked',
        'invite_shared', 'landing_cta_clicked', 'landing_demo_moved', 'landing_section_reached',
        'landing_viewed', 'screen_viewed', 'teacher_hub_view', 'video_completed',
        'video_started', 'volume_previewed', 'wayfinder_cta_clicked', 'wayfinder_opened',
        'knowledge_task_viewed', 'knowledge_task_submitted', 'csat_item_opened', 'csat_source_ready',
        'csat_prediction_submitted', 'csat_prediction_skipped', 'csat_step_advanced', 'csat_session_completed',
        'csat_review_scheduled', 'csat_review_completed', 'csat_principle_saved', 'csat_transfer_submitted',
        'csat_browse_filtered', 'csat_paper_failed', 'csat_learning_error',
        -- 원문 이해 교수 판(이 마이그레이션)
        'csat_meaning_unit_selected',
        'csat_meaning_depth_changed',
        'csat_meaning_relation_opened',
        'csat_meaning_whole_traced',
        'csat_meaning_draft_compared',
        'csat_meaning_bridge_followed'
      ]::text[]
    )
  );
