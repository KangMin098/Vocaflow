-- supabase/migrations/20260919100000_funnel_allow_fit_paint.sql
--
-- **`/fit` 재설계(2026-09-19 발산 A+B)의 관측 2종을 DB 가 받게 한다.** (docs/design/compare/fit.md · AGENTS D2)
--
-- `fit_level_moved`  — 칠해진 지문 위에서 학년을 옮겼다(level: 3~10 닫힌 열거형). `/fit` 의 서명이 쓰이는가.
-- `fit_sheet_opened` — 「학급에 나눠 줄 한 장으로」 를 펼쳤다(words: 난외 풀이 낱말 수, 숫자). 인쇄의 앞 단계.
--
-- 속성은 수·닫힌 열거형뿐이다 — 지문이 섞일 자리가 없다(`lib/analytics/events.ts` 계약).
--
-- ⚠️ 목록은 파일이 아니라 **적용 시점의 DB 제약**(`pg_get_constraintdef`, 2026-09-19)에서 옮겨 왔다 —
--    그 사이 다른 마이그레이션이 더한 값을 지우지 않기 위해서다. 기존 38개 + 새 2개.
-- ⚠️ 허용 목록이 세 곳에 있다(TS 유니온 · `EVENT_REGISTRY` · 여기). 적용 전에는
--    `lib/analytics/__tests__/db-allowlist.integration.test.ts` 가 이 2종에서 실패한다 — 그것이 맞다.
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
