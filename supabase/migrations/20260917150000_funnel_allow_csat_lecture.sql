-- supabase/migrations/20260917150000_funnel_allow_csat_lecture.sql
--
-- **해설 강의 관측 2종을 DB 가 받게 한다.**
--
-- `csat_lecture_played` — 해설 화면에서 강의를 틀었다(방문당 한 번). 이 기능의 전제는
--   «읽기보다 들으며 짚기가 낫다» 이고, 그 전제는 **틀었는가**부터 확인해야 한다.
-- `csat_lecture_ended`  — 끝까지 들었다. 완주율의 분자.
--
-- 속성은 닫힌 열거형(mode · from · rate×100)과 수(cues · jumps)뿐이다 — 대본·지문이 섞일
-- 자리가 없다(`lib/analytics/events.ts` 계약).
--
-- ⚠️ 허용 목록이 세 곳에 있다(TS 유니온 · `EVENT_REGISTRY` · 여기). 바로 앞 마이그레이션
--    (`20260916120000`)이 빠져 있던 여섯을 채웠다 — 이번에는 코드와 **같은 커밋**에 둔다.
--    회귀 `lib/analytics/__tests__/db-allowlist.integration.test.ts` 가 실제로 넣어 보며 지킨다.
--
-- ⚠️ 되돌리기: 아래 ARRAY 에서 두 줄을 빼고 다시 실행한다. 데이터는 지우지 않는다.

ALTER TABLE public.funnel_events DROP CONSTRAINT IF EXISTS funnel_events_event_check;

ALTER TABLE public.funnel_events
  ADD CONSTRAINT funnel_events_event_check CHECK (
    event = ANY (
      ARRAY[
        -- 교사 채널 (이 유니온 밖의 다른 경로가 쓴다 — 지우지 말 것)
        'teacher_hub_view',
        'invite_shared',
        -- 공개 퍼널 `/fit`
        'fit_viewed',
        'fit_analyzed',
        'fit_shared',
        'fit_share_opened',
        'fit_signup_clicked',
        'fit_worksheet_printed',
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
        -- 기출 해설 「지문 지도」
        'csat_evidence_opened',
        -- 기출 오답 지도 · 계획 · 훈련
        'csat_atlas_scoped',
        'csat_plan_speed_set',
        'csat_plan_ordered',
        'csat_drill_answered',
        'csat_drill_finished',
        'csat_trap_opened',
        -- 기출 오버레이
        'csat_overlay_loaded',
        'csat_overlay_located',
        'csat_overlay_answered',
        'csat_overlay_revealed',
        -- 기출 해설 강의 (2026-09-17)
        'csat_lecture_played',
        'csat_lecture_ended'
      ]::text[]
    )
  );

COMMENT ON CONSTRAINT funnel_events_event_check ON public.funnel_events IS
  '보낼 수 있는 이벤트 이름. 코드의 EVENT_REGISTRY 와 맞물려야 한다 — 여기 없는 이름은 수신구가 204 를 돌려주며 조용히 버린다. 회귀: lib/analytics/__tests__/db-allowlist.integration.test.ts';
