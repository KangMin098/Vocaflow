-- supabase/migrations/20260917200000_csat_session_records.sql
--
-- **학습자 세션의 풀이 기록 · 복습 큐를 서버에 둔다.** (docs/csat-learner/DECISIONS.md D7 → D18)
-- 2026-09-17 사용자 승인. 그전까지 기록은 기기(IndexedDB)에만 있었다 — 기기를 바꾸면 복습 큐가 사라진다.
--
-- 왜 새 표인가: 있는 표가 맞지 않는다.
--   · `csat_item_attempts` — dcp 문항(`question_id uuid`)용. 평가원 문항 id(`2026#31` text)를 못 받는다
--   · `csat_trap_attempts` — 선지 하나 단위의 감별 훈련. 「헷갈려요」·복습 단계가 없다
--
-- 규칙(복습 간격 3일 → 10일 → 졸업)은 **코드에 하나** 있다(`lib/csat/session/model.ts#applyResult`).
-- 표는 그 결과를 담기만 한다 — due 를 DB 함수로 다시 계산하지 않는다(두 벌이 되면 갈라진다).
-- `memory_state` 류 파생 상태 컬럼은 두지 않는다(CLAUDE.md 데이터 금지 목록과 같은 이유).
--
-- 재전송 안전: 기기는 같은 풀이를 여러 번 올릴 수 있다(오프라인 뒤 재시도 · 여러 탭).
-- `(user_id, item_id, answered_at)` 고유 제약으로 겹치지 않는다 — 올리는 쪽은 `ignoreDuplicates` upsert.
--
-- 되돌리기: DROP TABLE public.csat_review_queue, public.csat_session_attempts; (기기 기록은 그대로 남는다)

CREATE TABLE IF NOT EXISTS public.csat_session_attempts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id     text NOT NULL CHECK (item_id ~ '^[A-Za-z0-9_]{1,16}#[0-9]{1,2}$'),
  type_id     text NOT NULL,
  correct     boolean,            -- null = 고르지 않고 넘김
  confused    boolean NOT NULL DEFAULT false,
  sec         integer NOT NULL DEFAULT 0 CHECK (sec >= 0 AND sec < 86400),
  answered_at timestamptz NOT NULL,
  CONSTRAINT csat_session_attempts_once UNIQUE (user_id, item_id, answered_at)
);
CREATE INDEX IF NOT EXISTS csat_session_attempts_user_at
  ON public.csat_session_attempts (user_id, answered_at DESC);

CREATE TABLE IF NOT EXISTS public.csat_review_queue (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id    text NOT NULL CHECK (item_id ~ '^[A-Za-z0-9_]{1,16}#[0-9]{1,2}$'),
  type_id    text NOT NULL,
  due_at     timestamptz NOT NULL,
  stage      smallint NOT NULL CHECK (stage IN (1, 2)),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

ALTER TABLE public.csat_session_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_review_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY csat_session_attempts_own ON public.csat_session_attempts
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY csat_review_queue_own ON public.csat_review_queue
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.csat_session_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.csat_review_queue TO authenticated;

COMMENT ON TABLE public.csat_session_attempts IS
  '기출 학습자 세션의 풀이 한 건. 규칙은 lib/csat/session/model.ts — 여기는 결과만.';
COMMENT ON TABLE public.csat_review_queue IS
  '기출 복습 큐(3일 → 10일 → 졸업). 졸업하면 행이 지워진다. due_at 은 코드가 계산한 값.';

-- 후속(같은 날 · 보안 권고): 비로그인(anon)에게는 표 자체를 보이지 않는다.
-- 행은 RLS 가 이미 막지만, 기본 권한 때문에 GraphQL 스키마에 표가 드러났다.
-- 원격에는 `csat_session_records_revoke_anon` 으로 따로 적용했다.
REVOKE ALL ON public.csat_session_attempts FROM anon;
REVOKE ALL ON public.csat_review_queue FROM anon;
