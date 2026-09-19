-- supabase/migrations/20260915143000_funnel_allow_csat_overlay.sql
--
-- **오버레이 관측 2종을 DB 가 받게 한다.**
--
-- ── 왜 이 둘인가 ──────────────────────────────────────────────────────
-- `csat_overlay_loaded` — 이 화면의 값어치 전체가 «학습자가 자기 문제지를 연다» 는 전제 위에
--   있는데, 그 전제는 지금까지 **한 번도 확인된 적이 없다.** 파일이 서버로 오지 않는 것이
--   설계의 요점이라(해시 64자만 간다) **어떤 표에도 흔적이 남지 않기 때문**이다.
--   이 수가 진입(`screen_viewed` · `csat-overlay`) 대비 0 에 가까우면 오버레이는 죽은 길이고,
--   업로드 없이 보는 지문 지도가 유일한 경로다 — 설계를 바꿀 근거가 된다.
--
-- `csat_overlay_located` — 2026-09-15 에 넣은 PDF 텍스트 매칭(근거 문장을 학습자의 문제지
--   «그 자리» 에 칠하기)이 실제 문제지에서 작동하는지의 **유일한 관측**이다. 좌표는 우리에게
--   없고 학습자의 브라우저가 스스로 찾으므로, 우리는 이 이벤트로만 성패를 안다. 스캔본처럼
--   텍스트 레이어가 없는 문제지에서는 **조용히** 실패하도록 만들어 두었으므로 더욱 그렇다.
--
-- 둘 다 속성은 불리언 하나뿐이다 — 자유 문자열이 없으므로 평가원 지문이 섞일 자리가 없다.
--
-- ⚠️ **허용 목록이 세 곳에 있다**: TS 유니온 · 런타임 `EVENT_REGISTRY` · 여기(DB CHECK).
--    마지막을 빠뜨리면 수신구(`app/api/analytics/event/route.ts`)가 **어떤 실패에도 204 를
--    돌려주므로** 한 건도 안 쌓이는데 화면도 스펙도 사람도 눈치채지 못한다. 이 저장소가
--    이미 세 번 겪은 사고다(`fit_worksheet_printed` · 2026-09-06 의 5종 · `csat_evidence_opened`).
--    회귀 `lib/analytics/__tests__/db-allowlist.integration.test.ts` 가 실제로 넣어 보며 지킨다.
--
-- ⚠️ 되돌리기: 아래 ADD 문에서 두 줄만 빼고 다시 실행한다. 데이터는 지우지 않는다.

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
        -- 기출 오버레이 (2026-09-15)
        'csat_overlay_loaded',
        'csat_overlay_located'
      ]::text[]
    )
  );

COMMENT ON CONSTRAINT funnel_events_event_check ON public.funnel_events IS
  '보낼 수 있는 이벤트 이름. 코드의 EVENT_REGISTRY 와 맞물려야 한다 — 여기 없는 이름은 수신구가 204 를 돌려주며 조용히 버린다. 회귀: lib/analytics/__tests__/db-allowlist.integration.test.ts';
