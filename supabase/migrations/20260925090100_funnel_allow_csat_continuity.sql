-- supabase/migrations/20260925090100_funnel_allow_csat_continuity.sql
--
-- **기출 지속 학습 관측(docs/csat/ia-design.md §5)을 DB 가 받게 한다.** (AGENTS D2)
--
-- 새 6종: csat_home_viewed · csat_resume_clicked · csat_review_started · csat_review_done · csat_path_chosen · csat_item_back
-- 그리고 **빠져 있던 2종**: csat_space_scoped · csat_space_opened — 2026-09-23 앱 레지스트리에만 추가되고 이 제약에는
-- 없어서, 기출 메인의 좁히기 · 줄 펼침 이벤트가 **한 건도 저장되지 않았다**(2026-09-24 실측: 앱 32개 중 DB 에 없는 것 = 이 둘).
--
-- ⚠️ 목록은 적용 직전 DB 제약(pg_get_constraintdef, 2026-09-24)에서 옮겼다 — 기존 42개 + 8개.
-- ⚠️ 되돌리기: 아래 ARRAY 에서 여덟 줄을 빼고 다시 실행한다. 데이터는 지우지 않는다.

ALTER TABLE public.funnel_events DROP CONSTRAINT IF EXISTS funnel_events_event_check;

ALTER TABLE public.funnel_events
  ADD CONSTRAINT funnel_events_event_check CHECK (
    event = ANY (
      ARRAY[
        'teacher_hub_view',
        'invite_shared',
        'fit_viewed',
        'fit_analyzed',
        'fit_shared',
        'fit_share_opened',
        'fit_signup_clicked',
        'fit_worksheet_printed',
        'fit_level_moved',
        'fit_sheet_opened',
        'landing_viewed',
        'landing_cta_clicked',
        'landing_demo_moved',
        'landing_section_reached',
        'hub_promo_clicked',
        'hub_hero_moved',
        'catalog_viewed',
        'volume_previewed',
        'wayfinder_opened',
        'wayfinder_cta_clicked',
        'screen_viewed',
        'video_started',
        'video_completed',
        'csat_evidence_opened',
        'csat_atlas_scoped',
        'csat_plan_speed_set',
        'csat_plan_ordered',
        'csat_drill_answered',
        'csat_drill_finished',
        'csat_trap_opened',
        'csat_overlay_loaded',
        'csat_overlay_located',
        'csat_overlay_answered',
        'csat_overlay_revealed',
        'csat_lecture_played',
        'csat_lecture_ended',
        'csat_session_started',
        'csat_session_answered',
        'csat_session_explained',
        'csat_session_marked',
        'csat_session_finished',
        'csat_paper_read',
        'csat_space_scoped',
        'csat_space_opened',
        'csat_home_viewed',
        'csat_resume_clicked',
        'csat_review_started',
        'csat_review_done',
        'csat_path_chosen',
        'csat_item_back'
      ]::text[]
    )
  );
