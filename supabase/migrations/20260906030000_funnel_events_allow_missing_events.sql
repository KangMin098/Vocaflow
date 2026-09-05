-- supabase/migrations/20260906030000_funnel_events_allow_missing_events.sql
--
-- funnel_events 의 허용 이벤트 목록을 코드(`lib/analytics/events.ts` 의 ALLOWED_EVENTS)와 맞춘다.
--
-- ── 왜 (실측 2026-09-06) ────────────────────────────────────────────────
-- 허용 목록이 **세 곳**에 있다:
--   ① TS 유니온 `PublicEvent`            — 컴파일이 지킨다
--   ② 런타임 `EVENT_REGISTRY`            — `events.test.ts` 가 ①과 맞물리게 지킨다
--   ③ 이 CHECK 제약                       — **아무도 안 봤다**
--
-- 그 사이 코드에만 5종이 늘었고 DB 는 12종에 머물렀다. 수신구
-- (`app/api/analytics/event/route.ts`)는 계측이 화면을 깨뜨리지 않도록 **어떤 실패에도
-- 204 를 돌려주고 이유는 console.warn 에만 남긴다.** 그래서 화면도 테스트도 조용한 채
-- 아래 5종이 **한 건도 적재되지 않고 있었다**:
--
--   landing_demo_moved        — 랜딩 히어로 슬라이더 조작(랜딩 내부 이탈 관측)
--   landing_section_reached   — 랜딩 스크롤 깊이
--   wayfinder_opened          — 셸 나침반 띠 펼침
--   wayfinder_cta_clicked     — 셸의 단 하나뿐인 CTA
--   screen_viewed             — 학습자 화면 진입 (CLAUDE.md D2 · 모든 로그인 화면의 분모)
--
-- 같은 종류를 이미 한 번 겪었다 — `fit_worksheet_printed` 가 유니온에만 있고 런타임 허용
-- 목록에 없어 전송이 0이었다(2026-08-30). 그때 막은 것은 코드 두 곳 사이의 드리프트였고,
-- 이번엔 코드와 DB 사이다. 재발 방지는 `lib/analytics/__tests__/db-allowlist.integration.test.ts`
-- 가 맡는다 — 정의문을 파싱하지 않고 **실제로 넣어 본다**(우리가 묻는 질문과 같은 검사).
--
-- ── 안전성 ──────────────────────────────────────────────────────────────
-- 기존 행은 건드리지 않는다. 제약만 교체하며, 현재 데이터는 전부 옛 12종이라 재검증을 통과한다.
-- 되돌리려면 같은 방식으로 아래 목록에서 마지막 5줄을 빼고 다시 만들면 된다.

ALTER TABLE public.funnel_events
  DROP CONSTRAINT funnel_events_event_check;

ALTER TABLE public.funnel_events
  ADD CONSTRAINT funnel_events_event_check CHECK (
    event = ANY (ARRAY[
      -- 기존 12종
      'teacher_hub_view'::text,
      'invite_shared'::text,
      'fit_viewed'::text,
      'fit_analyzed'::text,
      'fit_shared'::text,
      'fit_share_opened'::text,
      'fit_signup_clicked'::text,
      'fit_worksheet_printed'::text,
      'landing_viewed'::text,
      'landing_cta_clicked'::text,
      'catalog_viewed'::text,
      'volume_previewed'::text,
      -- 코드에는 있으나 DB 가 버리고 있던 5종
      'landing_demo_moved'::text,
      'landing_section_reached'::text,
      'wayfinder_opened'::text,
      'wayfinder_cta_clicked'::text,
      'screen_viewed'::text
    ])
  );
