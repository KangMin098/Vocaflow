-- supabase/migrations/20260817064000_acp_compose_jobs.sql
--
-- ACP §20 — 재저작 drain 큐.
--
-- 원문 작성은 앱의 LLM 호출이 아니라 **Claude Code 배치 drain** 이 한다
-- (ScriptQuiz 챕터 문항 1,292건을 만든 것과 같은 경로).
-- 그래서 이 표는 "무엇을 쓸지" 를 전부 담은 발주서이자 작업 큐다.
--
-- 학습 유형(track)이 1급 축이다 — 이것이 소스·처리·결과물을 전부 가른다:
--   track → 어느 소스에서 사실을 모을지 · 어떻게 쓸지(길이·문형·지시) · 무엇을 붙일지(활동)
-- 축 값은 VRL 실측 어휘(shared_dictionary.track_levels / skill_type)를 그대로 쓴다.
-- TS 정본: compose/learning-types.ts (LEARNING_TYPES · buildJobSpec).
--
-- ⚠ literary 는 CHECK 에 없다 — 서사는 사실이 아니라서 재저작으로 만들 수 없다(LCP 소관).

BEGIN;

CREATE TABLE IF NOT EXISTS public.article_compose_jobs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id           uuid NOT NULL REFERENCES public.article_compose_batches(id) ON DELETE CASCADE,

  track              text NOT NULL CHECK (track IN
    ('csat_korean','general_proficiency','academic_english','conversational','business_english')),
  register           text NOT NULL CHECK (register IN
    ('expository','argumentative','narrative','news','reference')),
  target_v_level     smallint NOT NULL CHECK (target_v_level BETWEEN 0 AND 11),
  skill_focus        text NOT NULL CHECK (skill_focus IN
    ('single_word','collocation','polysemy','idiom','phrasal_verb')),

  -- 작성 사양 (buildJobSpec 산출물). directives 가 그대로 drain 프롬프트가 된다.
  words_min          integer NOT NULL CHECK (words_min > 0),
  words_max          integer NOT NULL CHECK (words_max >= words_min),
  avg_sentence_words integer NOT NULL CHECK (avg_sentence_words > 0),
  directives         text[] NOT NULL DEFAULT '{}',
  activities         text[] NOT NULL DEFAULT '{}',

  status             text NOT NULL DEFAULT 'pending' CHECK (status IN
    ('pending','claimed','drafted','failed','done')),
  -- 병렬 Claude Code 세션이 같은 발주를 두 번 쓰지 않게 하는 자리
  claimed_by         text,
  claimed_at         timestamptz,
  attempts           integer NOT NULL DEFAULT 0,
  last_error         text,
  article_id         uuid REFERENCES public.library_articles(id) ON DELETE SET NULL,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  -- 같은 취재 묶음에 같은 (유형 × 레벨) 발주는 하나뿐 = drain 재실행이 안전하다
  CONSTRAINT uq_compose_job UNIQUE (batch_id, track, target_v_level),
  CONSTRAINT chk_job_claimed CHECK (status <> 'claimed' OR (claimed_by IS NOT NULL AND claimed_at IS NOT NULL)),
  CONSTRAINT chk_job_done CHECK (status <> 'done' OR article_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_compose_jobs_pending
  ON public.article_compose_jobs(status, created_at) WHERE status IN ('pending','claimed');
CREATE INDEX IF NOT EXISTS idx_compose_jobs_batch ON public.article_compose_jobs(batch_id);

COMMENT ON TABLE public.article_compose_jobs IS
  'ACP §20 — 재저작 drain 큐. Claude Code 배치가 claim → 작성 → 게이트 → done. track 이 소스·처리·결과물을 가른다.';

DROP TRIGGER IF EXISTS trg_acj_set_updated_at ON public.article_compose_jobs;
CREATE TRIGGER trg_acj_set_updated_at
  BEFORE UPDATE ON public.article_compose_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 원자적 claim — 병렬 세션이 같은 job 을 집지 않는다.
--   FOR UPDATE SKIP LOCKED: 동시에 들어와도 서로 다른 행을 가져간다.
--   stale 회수: 30분 넘게 잡혀 있으면 죽은 세션으로 보고 다시 배정한다(재실행 안전).
CREATE OR REPLACE FUNCTION public.acp_claim_compose_jobs(
  p_worker text,
  p_limit  integer DEFAULT 5,
  p_stale_minutes integer DEFAULT 30
)
RETURNS SETOF public.article_compose_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT id FROM public.article_compose_jobs
    WHERE status = 'pending'
       OR (status = 'claimed' AND claimed_at < now() - make_interval(mins => p_stale_minutes))
    ORDER BY created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.article_compose_jobs j
     SET status = 'claimed',
         claimed_by = p_worker,
         claimed_at = now(),
         attempts = j.attempts + 1
    FROM claimable c
   WHERE j.id = c.id
  RETURNING j.*;
END $function$;

COMMENT ON FUNCTION public.acp_claim_compose_jobs(text, integer, integer) IS
  'ACP §20 — drain claim. FOR UPDATE SKIP LOCKED 로 병렬 세션 충돌 방지 + 30분 stale claim 회수(재실행 안전).';

REVOKE EXECUTE ON FUNCTION public.acp_claim_compose_jobs(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acp_claim_compose_jobs(text, integer, integer) TO authenticated, service_role;

ALTER TABLE public.article_compose_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS compose_jobs_admin_all ON public.article_compose_jobs;
CREATE POLICY compose_jobs_admin_all ON public.article_compose_jobs
  FOR ALL TO authenticated USING (is_admin_or_curator()) WITH CHECK (is_admin_or_curator());

COMMIT;

-- ── 적용 후 확인 (실측 2026-08-17) ──────────────────────────────────
-- 병렬 claim 격리: 세션 A 가 1건 claim → 세션 B 의 claim(limit 5)이 A 의 것을 집지 않고
-- 남은 1건만 가져감. 검증 후 테스트 행 삭제(batches·jobs 0행).
