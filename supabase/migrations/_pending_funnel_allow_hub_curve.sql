-- supabase/migrations/<ts>_funnel_allow_hub_curve.sql
--
-- **승인 대기 — 적용하지 않았다.** 적용할 때 파일 이름의 `_pending_` 을 타임스탬프로 바꾼다.
--
-- **`/hub` 재설계(2026-09-19 발산 A 「들어 올리는 곡선」)의 관측 1종을 DB 가 받게 한다.**
-- (docs/design/compare/hub.md · docs/design/DECISIONS.md DD-22 · AGENTS D2)
--
-- `hub_curve_interacted` — 「오늘 다시 볼 단어」 슬라이더를 옮겼다. 멈춘 뒤 한 번.
--   props: { count: 고른 수, words: 슬라이더 최대 } — 둘 다 숫자. 낱말은 싣지 않는다.
--   허브의 서명(곡선 들어 올리기)이 쓰이는가를 재는 유일한 관측이다. 진입은 screen_viewed(hub)가 이미 센다.
--
-- `retrospect_layer_opened` — (2026-09-19 추가 · `/dashboard` 「기억의 지층」 DD-29) 층 하나를 펼쳤다.
--   props: { rung: 닫힌 열거형 5, words: 그 층의 낱말 수 } — 낱말은 싣지 않는다.
--   같은 세션의 관측이라 파일을 나누지 않고 한 번에 승인받는다.
--
-- ⚠️ 목록은 파일이 아니라 **작성 시점의 DB 제약**(`pg_get_constraintdef`, 2026-09-19)에서 옮겼다 — 기존 40개 + 새 2개.
--    적용 직전에 다시 읽어 그 사이 늘어난 값이 있으면 합친다(덮으면 남의 이벤트가 거부된다).
-- ⚠️ 적용 전에는 `lib/analytics/__tests__/db-allowlist.integration.test.ts` 가 이 1종에서 실패한다 — 그것이 맞다.
--    그동안 클라이언트 track 은 DB 가 거부해도 화면에 영향이 없다(관측만 빠진다).
-- ⚠️ 되돌리기: 아래 ARRAY 에서 한 줄을 빼고 다시 실행한다. 데이터는 지우지 않는다.

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
        -- 허브 (2026-09-19 · 승인 대기)
        'hub_curve_interacted',
        -- 회고 (2026-09-19 · 승인 대기)
        'retrospect_layer_opened',
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
