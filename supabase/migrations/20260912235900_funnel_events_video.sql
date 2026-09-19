-- supabase/migrations/20260912235900_funnel_events_video.sql
--
-- **구성요소 영상 관측 2종을 수신구가 받게 한다.**
--
-- 왜 필요한가: `funnel_events_event_check` 에 없는 이름은 INSERT 가 거부되는데,
-- 수신구(`app/api/analytics/event/route.ts`)는 계측이 화면을 깨뜨리지 않도록
-- **어떤 실패에도 204 를 돌려준다.** 그래서 코드에만 이름을 늘리면 그 이벤트는
-- 한 건도 안 쌓이면서 아무도 눈치채지 못한다 — 이 저장소가 이미 두 번 겪은 사고다
-- (`fit_worksheet_printed` · 2026-09-06 의 5종).
--
-- 회귀 `analytics/__tests__/db-allowlist.integration.test.ts` 가 실제로 넣어 보며 이것을 지킨다.
-- 이 마이그레이션 전에는 그 테스트가 **실패하는 것이 맞다.**
--
-- 되돌리기: 아래 ARRAY 에서 두 이름을 빼고 제약을 다시 만든다. 데이터 손실 없음.

alter table public.funnel_events
  drop constraint if exists funnel_events_event_check;

alter table public.funnel_events
  add constraint funnel_events_event_check check (
    event = any (array[
      'teacher_hub_view',
      'invite_shared',
      'fit_viewed',
      'fit_analyzed',
      'fit_shared',
      'fit_share_opened',
      'fit_signup_clicked',
      'fit_worksheet_printed',
      'landing_viewed',
      'landing_cta_clicked',
      'catalog_viewed',
      'volume_previewed',
      'landing_demo_moved',
      'landing_section_reached',
      'wayfinder_opened',
      'wayfinder_cta_clicked',
      'screen_viewed',
      -- 2026-09-12 신설 — 구성요소 영상
      'video_started',
      'video_completed'
    ])
  );
