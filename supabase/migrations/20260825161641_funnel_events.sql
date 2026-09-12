-- supabase/migrations/_pending_funnel_events.sql
--
-- **유입 퍼널 계측 — 지금은 학습을 시작한 뒤부터만 기록된다.**
--
-- ── 왜 (실측 2026-08-26) ────────────────────────────────────────────
-- 가입자 3 · 최근 30일 신규 0 · 학급 0행. 그런데 학습 중 계측은 멀쩡하다
-- (reading_sessions 256 · scores 78 · daily_activity 38). 즉 **이미 학습을 시작한 사람이
-- 무엇을 했는지는 알지만, 그 앞에서 무슨 일이 있었는지는 한 줄도 없다.**
--   · 누가 왔는가            → 기록 0
--   · 왜 가입하지 않았는가    → 기록 0
--   · 가입하고 첫 학습까지 갔는가 → 유추만
--   · 교사가 학급을 만들다 말았는가 → 기록 0
-- 분기 진단의 산술("교사 3,500명 × 학급 30명 = 10.5만")이 성립하는지 확인할 방법이 없다.
--
-- ── 이 표만 만들면 또 0행이 된다 ────────────────────────────────────
-- 이 저장소에는 **스키마는 있는데 한 번도 안 쓰인 표**가 이미 있다(classes·class_members·
-- class_assignments 4개 전부 0행, 코드는 완성돼 회귀 16종 통과). 그래서 이 마이그레이션은
-- 표와 **기록 함수**를 함께 넣고, 같은 커밋에서 호출부까지 배선한다.
--
-- ── 클라이언트가 user_id 를 적게 하지 않는다 ────────────────────────
-- `20260815020000_close_client_writable_gaps` 가 같은 종류의 구멍을 이미 한 번 막았다
-- (class_id 만 알면 남의 학급에 teacher 로 들어갈 수 있었다). 그래서 기록은 반드시
-- SECURITY DEFINER 함수를 거치고, user_id 는 **함수가 auth.uid() 로 스스로 찍는다.**
--
-- ── 개인정보 최소 수집 ──────────────────────────────────────────────
-- 비로그인 방문은 `anon_id`(브라우저 로컬 식별자) 하나만 받는다. IP·UA·referrer 를 넣지 않는다 —
-- 퍼널 단계 전환율을 재는 데 필요 없고, 없는 편이 안전하다.

CREATE TABLE IF NOT EXISTS public.funnel_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- 비로그인 구간을 잇는 브라우저 식별자. 가입 후에는 user_id 가 채워져 두 구간이 이어진다.
  anon_id     text,
  event       text NOT NULL,
  surface     text,
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- 닫힌 목록으로 둔다. 자유 문자열이면 오타가 조용히 새 단계를 만들고 퍼널이 갈라진다.
  CONSTRAINT funnel_events_event_check CHECK (event = ANY (ARRAY[
    -- 학습자 유입
    'visit', 'signup', 'first_learn', 'day7_return',
    -- 교사 왕복 5단계 (감사 산술의 첫 단추)
    'teacher_hub_view', 'class_created', 'invite_shared', 'class_joined', 'assignment_sent'
  ])),
  -- user_id 도 anon_id 도 없으면 어느 사람의 행동인지 이을 수 없어 퍼널에 쓸모가 없다.
  CONSTRAINT funnel_events_subject_check CHECK (user_id IS NOT NULL OR anon_id IS NOT NULL)
);

COMMENT ON TABLE public.funnel_events IS
  '유입 퍼널 계측. 학습 중 기록(reading_sessions·scores·daily_activity)이 닿지 못하는 앞단 — 방문·가입·활성화·잔존과 교사 왕복 5단계. 기록은 record_funnel_event() 로만 한다(클라이언트가 user_id 를 적지 못하게).';

CREATE INDEX IF NOT EXISTS funnel_events_event_time_idx ON public.funnel_events (event, occurred_at DESC);
CREATE INDEX IF NOT EXISTS funnel_events_user_idx       ON public.funnel_events (user_id, occurred_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS funnel_events_anon_idx       ON public.funnel_events (anon_id, occurred_at DESC) WHERE anon_id IS NOT NULL;

ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;

-- 읽기는 본인 것 + admin/curator 전체. 쓰기는 정책으로 열지 않는다 — 함수만 쓴다.
DROP POLICY IF EXISTS funnel_events_select_own ON public.funnel_events;
CREATE POLICY funnel_events_select_own ON public.funnel_events
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin_or_curator());

CREATE OR REPLACE FUNCTION public.record_funnel_event(
  p_event   text,
  p_surface text DEFAULT NULL,
  p_anon_id text DEFAULT NULL,
  p_meta    jsonb DEFAULT '{}'::jsonb
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_id  bigint;
BEGIN
  -- 로그인도 anon_id 도 없으면 조용히 버린다. 예외를 던지면 계측이 화면을 깨뜨린다 —
  -- 계측은 절대로 학습 경로를 막아서는 안 된다.
  IF v_uid IS NULL AND (p_anon_id IS NULL OR btrim(p_anon_id) = '') THEN
    RETURN NULL;
  END IF;

  INSERT INTO funnel_events (user_id, anon_id, event, surface, meta)
  VALUES (v_uid, nullif(btrim(p_anon_id), ''), p_event, p_surface, COALESCE(p_meta, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

COMMENT ON FUNCTION public.record_funnel_event(text, text, text, jsonb) IS
  '퍼널 이벤트 1건 기록. user_id 는 함수가 auth.uid() 로 스스로 찍는다(클라이언트 위조 차단). 주체를 못 잇는 호출은 예외 없이 NULL 반환 — 계측이 학습 경로를 막지 않게.';

GRANT EXECUTE ON FUNCTION public.record_funnel_event(text, text, text, jsonb) TO anon, authenticated, service_role;

-- ── 퍼널 조회 — 화면·리포트가 같은 정의를 쓰게 한 곳에 둔다 ─────────
CREATE OR REPLACE FUNCTION public.funnel_summary(p_days integer DEFAULT 30)
RETURNS TABLE(event text, subjects bigint, events bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT e.event,
         count(DISTINCT COALESCE(e.user_id::text, e.anon_id)) AS subjects,
         count(*) AS events
  FROM funnel_events e
  WHERE e.occurred_at > now() - make_interval(days => GREATEST(p_days, 1))
  GROUP BY e.event
$function$;

COMMENT ON FUNCTION public.funnel_summary(integer) IS
  '최근 N일 퍼널 단계별 주체 수. 주체는 user_id 우선, 없으면 anon_id — 가입 전후를 한 사람으로 잇는다.';

GRANT EXECUTE ON FUNCTION public.funnel_summary(integer) TO authenticated, service_role;
