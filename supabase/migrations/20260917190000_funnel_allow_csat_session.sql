-- supabase/migrations/20260917190000_funnel_allow_csat_session.sql
--
-- **학습자 세션 루프 관측 6종을 DB 가 받게 한다.** (docs/csat-learner-brief.md · 지시문 D2)
--
-- `csat_session_started`   — 홈에서 [시작]. needed/cached = 그 세션에 필요한 회차 수 / 기기에 있던 수
-- `csat_session_answered`  — 한 문항에 답했다(seq · correct · skipped · sec · review)
-- `csat_session_explained` — ② 이해에서 무엇을 열었나(닫힌 열거형)
-- `csat_session_marked`    — ③ [알겠어요]/[헷갈려요]
-- `csat_session_finished`  — 세션 완주
-- `csat_paper_read`        — 문제지 읽기 결과(known · items · failed) — **reflow 실패율**(지시문 C6)
--
-- 속성은 수·불리언·닫힌 열거형뿐이다 — 지문·해설이 섞일 자리가 없다(`lib/analytics/events.ts` 계약).
--
-- ⚠️ 허용 목록이 세 곳에 있다(TS 유니온 · `EVENT_REGISTRY` · 여기). 코드와 **같은 커밋**에 둔다.
--    적용 전에는 회귀 `lib/analytics/__tests__/db-allowlist.integration.test.ts` 가 이 6종에서 실패한다
--    — 그것이 맞다(보내는 순간 조용히 사라진다는 뜻이다).
-- ⚠️ 되돌리기: 아래 ARRAY 에서 여섯 줄을 빼고 다시 실행한다. 데이터는 지우지 않는다.

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
        -- 기출 오답 지도 · 계획 · 훈련 (지금은 관리자 뷰 · 옛 기록 보존)
        'csat_atlas_scoped',
        'csat_plan_speed_set',
        'csat_plan_ordered',
        'csat_drill_answered',
        'csat_drill_finished',
        'csat_trap_opened',
        -- 기출 오버레이 (화면은 2026-09-17 에 걷었다 — 옛 기록 보존)
        'csat_overlay_loaded',
        'csat_overlay_located',
        'csat_overlay_answered',
        'csat_overlay_revealed',
        -- 기출 해설 강의 (2026-09-17)
        'csat_lecture_played',
        'csat_lecture_ended',
        -- 기출 학습자 세션 루프 (2026-09-17)
        'csat_session_started',
        'csat_session_answered',
        'csat_session_explained',
        'csat_session_marked',
        'csat_session_finished',
        'csat_paper_read'
      ]::text[]
    )
  );

COMMENT ON CONSTRAINT funnel_events_event_check ON public.funnel_events IS
  '보낼 수 있는 이벤트 이름. 코드의 EVENT_REGISTRY 와 맞물려야 한다 — 여기 없는 이름은 수신구가 204 를 돌려주며 조용히 버린다. 회귀: lib/analytics/__tests__/db-allowlist.integration.test.ts';
