-- supabase/migrations/20260922090000_funnel_allow_hub_portal.sql
--
-- **플랫폼 메인(`/hub`) 재설계(2026-09-22)의 관측 2종을 DB 가 받게 한다.** (AGENTS D2)
--
-- `hub_promo_clicked` — 홍보 면을 눌렀다(slot: 닫힌 열거형 8종 · index: 면 안 순번).
-- `hub_hero_moved`    — 메인 배너를 사람이 넘겼다(index · via: dot|arrow). 자동 넘김은 세지 않는다.
--
-- 속성은 수·닫힌 열거형뿐이다 (`lib/analytics/events.ts` 계약).
--
-- ⚠️ 목록은 **적용 직전 DB 제약**(`pg_get_constraintdef`, 2026-09-22)에서 옮겨 왔다 — 기존 40개 + 새 2개.
-- ⚠️ 적용 전에는 `lib/analytics/__tests__/db-allowlist.integration.test.ts` 가 이 2종에서 실패한다 — 그것이 맞다.
-- ⚠️ 되돌리기: 아래 ARRAY 에서 두 줄을 빼고 다시 실행한다. 데이터는 지우지 않는다.

ALTER TABLE public.funnel_events DROP CONSTRAINT IF EXISTS funnel_events_event_check;

ALTER TABLE public.funnel_events
  ADD CONSTRAINT funnel_events_event_check CHECK (
    event = ANY (
      ARRAY[
        'teacher_hub_view',
        'invite_shared',
        -- 공개 퍼널 `/fit`
        'fit_viewed',
        'fit_analyzed',
        'fit_shared',
        'fit_share_opened',
        'fit_signup_clicked',
        'fit_worksheet_printed',
        'fit_level_moved',
        'fit_sheet_opened',
        -- 랜딩
        'landing_viewed',
        'landing_cta_clicked',
        'landing_demo_moved',
        'landing_section_reached',
        -- 플랫폼 메인 `/hub` (2026-09-22)
        'hub_promo_clicked',
        'hub_hero_moved',
        -- 공용 서가
        'catalog_viewed',
        'volume_previewed',
        -- 셸
        'wayfinder_opened',
        'wayfinder_cta_clicked',
        'screen_viewed',
        -- 구성요소 영상
        'video_started',
        'video_completed',
        -- 기출
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
        'csat_paper_read'
      ]::text[]
    )
  );
