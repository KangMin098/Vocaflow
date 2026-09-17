-- supabase/migrations/_pending_csat_session_records.sql
--
-- **초안 — 적용하지 않았다.** 학습자 세션의 풀이 기록·복습 큐를 서버에 두는 표.
-- (docs/csat-learner/DECISIONS.md D7 — 지금은 기기 IndexedDB 에만 있다)
--
-- 왜 새 표인가: 있는 표가 맞지 않는다.
--   · `csat_item_attempts` — dcp 문항(`question_id uuid`)용. 평가원 문항 id(`2026#31` text)를 못 받는다
--   · `csat_trap_attempts` — 선지 하나 단위의 감별 훈련. 「헷갈려요」·복습 단계가 없다
--
-- 규칙(복습 간격 3일 → 10일 → 졸업)은 **코드에 하나** 있다(`lib/csat/session/model.ts#applyResult`).
-- 표는 그 결과를 담기만 한다 — due 를 DB 함수로 다시 계산하지 않는다(두 벌이 되면 갈라진다).
-- `memory_state` 류 파생 상태 컬럼은 두지 않는다(CLAUDE.md 데이터 금지 목록과 같은 이유).
--
-- 적용 순서: 승인 → 이름을 `2026MMDDhhmmss_csat_session_records.sql` 로 바꿔 apply →
--            `store.ts` 뒤에 서버 어댑터 추가(기기 기록은 첫 로그인 때 한 번 올린다).

CREATE TABLE IF NOT EXISTS public.csat_session_attempts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id     text NOT NULL,
  type_id     text NOT NULL,
  correct     boolean,            -- null = 고르지 않고 넘김
  confused    boolean NOT NULL DEFAULT false,
  sec         integer NOT NULL DEFAULT 0 CHECK (sec >= 0),
  answered_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS csat_session_attempts_user_at ON public.csat_session_attempts (user_id, answered_at DESC);

CREATE TABLE IF NOT EXISTS public.csat_review_queue (
  user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id  text NOT NULL,
  type_id  text NOT NULL,
  due_at   timestamptz NOT NULL,
  stage    smallint NOT NULL CHECK (stage IN (1, 2)),
  PRIMARY KEY (user_id, item_id)
);

ALTER TABLE public.csat_session_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_review_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY csat_session_attempts_own ON public.csat_session_attempts
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY csat_review_queue_own ON public.csat_review_queue
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
