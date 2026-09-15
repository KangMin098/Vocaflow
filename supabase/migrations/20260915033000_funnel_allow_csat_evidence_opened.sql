-- supabase/migrations/20260915033000_funnel_allow_csat_evidence_opened.sql
--
-- **기출 해설의 「지문 지도」 상호작용 이벤트를 DB 가 받게 한다.**
--
-- ── 왜 필요한가 ───────────────────────────────────────────────────────
-- 허용 목록이 세 곳에 있다: TS 유니온 · 런타임 `EVENT_REGISTRY` · 여기(DB CHECK).
-- 수신구(`app/api/analytics/event/route.ts`)는 계측이 화면을 깨뜨리지 않도록 **어떤 실패에도
-- 204 를 돌려주고** 이유는 console.warn 에만 남긴다. 그래서 여기를 빠뜨리면 이벤트는
-- **한 건도 안 쌓이는데 화면도 스펙도 사람도 눈치채지 못한다.**
--
-- 이 저장소는 같은 사고를 이미 두 번 겪었다 — `fit_worksheet_printed` 가 유니온에만 있어
-- 전송 0, 그리고 2026-09-06 에 5종(`landing_demo_moved` 등)이 DB 에 없어 적재 0.
-- 회귀 `lib/analytics/__tests__/db-allowlist.integration.test.ts` 가 그 뒤로 지킨다.
--
-- ── 무엇을 재려는가 ───────────────────────────────────────────────────
-- `csat_evidence_opened` 는 「클릭/클릭/클릭」이 실제로 일어나는지를 세는 유일한 관측이다.
-- 속성은 `kind`(닫힌 열거형) · `found`(불리언) · `seq`(숫자)뿐 — 자유 문자열이 없으므로
-- 평가원 지문이 섞일 자리가 없다(이 파일군의 계약).
--
-- 진입은 `screen_viewed`(screen='csat-item')가 이미 세므로 늘리지 않는다 — 같은 일을 하는
-- 이벤트를 둘 만들면 분모가 갈린다.
--
-- ⚠️ 되돌리기: 아래 ADD 문에서 'csat_evidence_opened' 만 빼고 다시 실행하면 된다.
--    데이터는 지우지 않는다(그 사이 쌓인 행은 남는다 — 제약만 좁아진다).

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
        -- 기출 해설 「지문 지도」 (2026-09-15)
        'csat_evidence_opened'
      ]::text[]
    )
  );

COMMENT ON CONSTRAINT funnel_events_event_check ON public.funnel_events IS
  '보낼 수 있는 이벤트 이름. 코드의 EVENT_REGISTRY 와 맞물려야 한다 — 여기 없는 이름은 수신구가 204 를 돌려주며 조용히 버린다. 회귀: lib/analytics/__tests__/db-allowlist.integration.test.ts';
