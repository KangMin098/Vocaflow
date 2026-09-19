-- supabase/migrations/20260916120000_funnel_allow_csat_rest.sql
--
-- **기출 화면의 계측 8종을 DB 가 받게 한다 — 그중 6종은 이미 보내고 있었는데 버려지고 있었다.**
--
-- ── 실측 (2026-09-16) ────────────────────────────────────────────────
-- `db-allowlist.integration.test.ts` 가 실제로 넣어 보며 잡았다. 코드(`EVENT_REGISTRY`)에는
-- 있고 DB CHECK 에는 없는 이름이 **여덟**이었다:
--
--   csat_atlas_scoped · csat_plan_speed_set · csat_plan_ordered ·
--   csat_drill_answered · csat_drill_finished · csat_trap_opened    ← 이미 보내던 6종
--   csat_overlay_answered · csat_overlay_revealed                    ← 오늘 추가한 2종
--
-- 앞의 여섯은 화면이 **한 건도 남기지 못한 채** 돌고 있었다. 수신구
-- (`app/api/analytics/event/route.ts`)가 어떤 실패에도 204 를 돌려주므로 화면도, 콘솔도,
-- 사람도 눈치채지 못한다. 하필 그 여섯이 「오답 지도를 실제로 만지는가」·「훈련 세트를
-- 끝까지 가는가」 — 이 제품에서 **인출이 일어나는지**를 재려고 만든 바로 그 수들이다.
--
-- ⚠️ 이 사고는 이 저장소에서 **네 번째**다(`fit_worksheet_printed` · 2026-09-06 의 5종 ·
--    `csat_evidence_opened` · 그리고 여기). 되풀이되는 이유는 허용 목록이 **세 곳**에
--    있기 때문이다: TS 유니온 · 런타임 `EVENT_REGISTRY` · 여기(DB CHECK).
--    바로 앞 마이그레이션(`20260915143000`)도 오버레이 2종만 더하고 옆에 있던 여섯을
--    **그냥 지나쳤다** — 사람이 목록 셋을 눈으로 맞추는 한 다시 일어난다.
--    당장의 방벽은 회귀 검사다(실제로 INSERT 해 본다). 그것이 이 여덟을 찾아냈다.
--
-- ── 새로 더한 둘이 무엇을 재는가 ─────────────────────────────────────
-- `csat_overlay_answered` — 오버레이에서 **스스로 답을 골랐다.** 어제까지 이 화면은 문항
--   번호를 누르면 답·근거·오답 넷을 한꺼번에 펼쳤다. 거기서 일어나는 일은 읽기이고, 읽기는
--   재인이지 인출이 아니다(원칙 1). 순차 공개를 넣으면서 **그 전제가 맞는지 재는 자리**를
--   함께 만든다. 이 수가 `csat_overlay_loaded` 대비 0 이면 학습자는 문제지를 열되 풀지 않는
--   것이고, 그건 순서를 바꿀 근거가 된다.
-- `csat_overlay_revealed` — 겹을 몇 장까지 여는가. 1~2 에서 멈추면 겹이 잘못 나뉜 것이다.
--
-- 두 이벤트의 속성은 불리언·숫자·닫힌 열거형뿐이다 — 자유 문자열이 없으므로 평가원 지문이
-- 섞일 자리가 구조적으로 없다(`lib/analytics/events.ts` 의 계약).
--
-- ⚠️ 되돌리기: 아래 ARRAY 에서 해당 줄만 빼고 다시 실행한다. 데이터는 지우지 않는다.
--    단, 이미 쌓인 행이 있으면 CHECK 추가가 실패한다 — 그때는 그 행을 먼저 지울지
--    결정해야 한다(지우면 관측이 사라진다).

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
        -- 기출 오답 지도 · 계획 · 훈련 (코드에는 있었으나 여기 없어 버려지고 있던 6종)
        'csat_atlas_scoped',
        'csat_plan_speed_set',
        'csat_plan_ordered',
        'csat_drill_answered',
        'csat_drill_finished',
        'csat_trap_opened',
        -- 기출 오버레이
        'csat_overlay_loaded',
        'csat_overlay_located',
        -- 기출 오버레이 순차 공개 (2026-09-16)
        'csat_overlay_answered',
        'csat_overlay_revealed'
      ]::text[]
    )
  );

COMMENT ON CONSTRAINT funnel_events_event_check ON public.funnel_events IS
  '보낼 수 있는 이벤트 이름. 코드의 EVENT_REGISTRY 와 맞물려야 한다 — 여기 없는 이름은 수신구가 204 를 돌려주며 조용히 버린다. 회귀: lib/analytics/__tests__/db-allowlist.integration.test.ts';
