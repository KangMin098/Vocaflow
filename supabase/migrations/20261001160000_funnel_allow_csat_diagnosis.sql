-- supabase/migrations/20261001160000_funnel_allow_csat_diagnosis.sql
--
-- **영어 진단(/csat/diagnosis) 관측 이벤트 6종을 DB 가 받게 한다.** (AGENTS D2)
-- 새 6종: csat_dx_viewed · csat_dx_profile_saved · csat_dx_attempt_saved · csat_dx_test_submitted ·
--         csat_dx_habit_answered · csat_dx_history_compared
--
-- ⚠️ 목록은 적용 직전 DB 제약(pg_get_constraintdef, 2026-10-01)에서 옮겼다 — 기존 50개 + workspace 5개(다른 브랜치 마이그레이션 보존) + 진단 6개.
--    앱 레지스트리(lib/analytics/events.ts)에만 넣으면 이벤트가 조용히 0건이 된다.
-- ⚠️ 되돌리기: 아래 ARRAY 에서 여섯 줄을 빼고 다시 실행한다. 데이터는 지우지 않는다.

ALTER TABLE public.funnel_events DROP CONSTRAINT IF EXISTS funnel_events_event_check;

ALTER TABLE public.funnel_events
  ADD CONSTRAINT funnel_events_event_check CHECK (
    event = ANY (
      ARRAY[
        'teacher_hub_view', 'invite_shared',
        'fit_viewed', 'fit_analyzed', 'fit_shared', 'fit_share_opened', 'fit_signup_clicked',
        'fit_worksheet_printed', 'fit_level_moved', 'fit_sheet_opened',
        'landing_viewed', 'landing_cta_clicked', 'landing_demo_moved', 'landing_section_reached',
        'hub_promo_clicked', 'hub_hero_moved', 'catalog_viewed', 'volume_previewed',
        'wayfinder_opened', 'wayfinder_cta_clicked', 'screen_viewed', 'video_started', 'video_completed',
        'csat_evidence_opened', 'csat_atlas_scoped', 'csat_plan_speed_set', 'csat_plan_ordered',
        'csat_drill_answered', 'csat_drill_finished', 'csat_trap_opened',
        'csat_overlay_loaded', 'csat_overlay_located', 'csat_overlay_answered', 'csat_overlay_revealed',
        'csat_lecture_played', 'csat_lecture_ended',
        'csat_session_started', 'csat_session_answered', 'csat_session_explained', 'csat_session_marked',
        'csat_session_finished', 'csat_paper_read', 'csat_space_scoped', 'csat_space_opened',
        'csat_home_viewed', 'csat_resume_clicked', 'csat_review_started', 'csat_review_done',
        'csat_path_chosen', 'csat_item_back',
        -- 20260929090000_funnel_allow_csat_workspace(다른 브랜치, 미적용)의 5종 — 덮어써 잃지 않게 함께 둔다
        'csat_workspace_created', 'csat_workspace_opened', 'csat_workspace_session_started',
        'csat_workspace_edited', 'csat_workspace_suggestion_applied',
        'csat_dx_viewed',
        'csat_dx_profile_saved',
        'csat_dx_attempt_saved',
        'csat_dx_test_submitted',
        'csat_dx_habit_answered',
        'csat_dx_history_compared'
      ]::text[]
    )
  );
