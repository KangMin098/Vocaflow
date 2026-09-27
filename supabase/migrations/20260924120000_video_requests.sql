-- supabase/migrations/20260924120000_video_requests.sql
--
-- **영상 요청 — 요청 → 기획 → 설계 → 검토 → 적용 → 평가 순환.**
--
-- ── 무엇이 없었나 (2026-09-24) ──────────────────────────────────────
-- `/admin/video` 는 보기만 하는 화면이었다. 영상 목록은 코드 규칙 8개(catalog/build.ts)가
-- 만들고 나레이션도 그 안에 박혀 있어서, 분야를 하나 늘리려면 코드를 새로 써야 했고
-- (교재 권별 영상은 규칙이 없어 후보로만 떠 있었다), 목적(학습/구매)·수요자를 적을 자리도,
-- 사람이 보고 승인하는 단계도 없었다.
--
-- ── 이 마이그레이션이 만드는 것 ───────────────────────────────────
--   video_domains             분야 = 설정. 새 분야는 행 하나(코드 없음).
--   video_requests            요청 한 건 = 행 하나. `phase` 가 순환의 현재 자리.
--   video_request_revisions   기획·설계 초안(rev). 수정 요청마다 rev 가 는다.
--   video_request_reviews     사람의 결정(승인·수정 요청·반려)과 코멘트.
--   video_request_evaluations 규격 평가 + 목적 평가. 다음 기획의 입력.
--
-- ── 가드 ───────────────────────────────────────────────────────────
-- **검토 승인 없이는 적용(`applying`)으로 못 간다.** 화면·드레인 어느 쪽도 phase 를
-- 직접 UPDATE 하지 않고 아래 두 RPC 로만 옮긴다 — 전이 규칙이 DB 한 곳에 있다.

-- ─── 0. video_jobs 가 요청 편을 받게 ──────────────────────────────
ALTER TABLE video_jobs DROP CONSTRAINT IF EXISTS video_jobs_kind_check;
ALTER TABLE video_jobs ADD CONSTRAINT video_jobs_kind_check
  CHECK (kind IN (
    'intro', 'benefit', 'curriculum', 'series', 'type', 'module', 'method', 'advice', 'request'
  ));

-- ─── 공용: 관리자 확인 ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION video_is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin'
  )
$$;
REVOKE ALL ON FUNCTION video_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION video_is_admin() TO authenticated, service_role;

-- ─── 1. 분야 ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_domains (
  id text PRIMARY KEY,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  -- 기획 후보(`catalog/plan.ts` 의 PlanItem.kind) 중 이 분야가 대상으로 삼는 종류.
  -- 목록을 CHECK 로 묶지 않는다 — 정본은 코드이고, 둘로 적으면 갈린다.
  target_kinds text[] NOT NULL DEFAULT '{}',
  allow_custom_target boolean NOT NULL DEFAULT false,
  default_formats text[] NOT NULL DEFAULT '{landscape,portrait,square}',
  enabled boolean NOT NULL DEFAULT true,
  sort int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO video_domains (id, label, description, target_kinds, allow_custom_target, sort) VALUES
  ('platform',   '플랫폼 PR',  '플랫폼 소개와 장점. 기존 catalog 규칙의 편을 출발점으로 쓴다.', '{intro,benefit}', true, 10),
  ('textbook',   '교재',       '시리즈 · 권별 · 문항 유형.',                                    '{series,volume,type}', false, 20),
  ('curriculum', '커리큘럼',   '단계 사다리와 단계 간 권장안.',                                  '{curriculum,advice}', false, 30),
  ('component',  '구성요소',   '학습 활동(모듈) 하나.',                                          '{module}', false, 40),
  ('method',     '학습방법',   '낱말이 거치는 단계와 훈련 면.',                                  '{method}', false, 50)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. 요청 ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id text NOT NULL REFERENCES video_domains(id),
  -- 기획 후보 id(`volume-reading-4`) 또는 자유 입력(분야가 허용할 때)
  target_key text NOT NULL,
  target_label text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('learn', 'buy')),
  audience text NOT NULL CHECK (audience IN ('student', 'parent', 'teacher', 'adult')),
  formats text[] NOT NULL DEFAULT '{landscape,portrait,square}'
    CHECK (formats <@ ARRAY['landscape', 'portrait', 'square'] AND cardinality(formats) > 0),
  memo text NOT NULL DEFAULT '',
  -- 적용 단계에서 부여 → video_jobs.video_id 와 같은 값
  video_id text UNIQUE,
  --   requested         요청만 있다 (드레인 대기)
  --   designed          기획·설계 rev 가 올라와 **검토 대기**
  --   changes_requested 수정 요청 — 코멘트를 들고 다시 드레인으로
  --   approved          승인 — 적용 대기
  --   rejected          반려 (끝)
  --   applying          원료·음성·렌더 중 (video_jobs 가 세부 단계)
  --   applied           발행됨
  --   evaluated         평가 기록됨 — 다음 기획의 입력
  --   failed            적용 중 실패. `error` 를 본다
  --   cancelled         요청자가 거둠 (끝)
  phase text NOT NULL DEFAULT 'requested'
    CHECK (phase IN ('requested', 'designed', 'changes_requested', 'approved', 'rejected',
                     'applying', 'applied', 'evaluated', 'failed', 'cancelled')),
  current_rev int NOT NULL DEFAULT 0,
  error text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS video_requests_phase_idx ON video_requests (phase, created_at);

-- ─── 3. 초안(rev) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_request_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES video_requests(id) ON DELETE CASCADE,
  rev int NOT NULL CHECK (rev >= 1),
  -- 기획: 수요자 니즈 · 문제 · 핵심 메시지 · 다음 행동
  plan jsonb NOT NULL,
  -- 설계: 장면(자막·나레이션·근거 키) · 규격. 수치는 값이 아니라 번들 키로 적힌다.
  design jsonb NOT NULL,
  -- 자동 검사 결과(자막 길이·길이·첫 장면·CTA·금칙어) — import 가 계산해 넣는다
  checks jsonb NOT NULL DEFAULT '{}',
  author text NOT NULL DEFAULT 'claude',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_request_revisions_uniq UNIQUE (request_id, rev)
);

-- ─── 4. 검토 ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_request_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES video_requests(id) ON DELETE CASCADE,
  rev int NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approve', 'revise', 'reject')),
  comment text NOT NULL DEFAULT '',
  reviewer uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS video_request_reviews_req_idx ON video_request_reviews (request_id, created_at);

-- ─── 5. 평가 ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_request_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES video_requests(id) ON DELETE CASCADE,
  rev int NOT NULL,
  -- 기존 evaluateVideo 스코어카드
  spec jsonb NOT NULL DEFAULT '{}',
  -- 목적 지표(재생·완주·CTA). 표본이 없으면 verdict 'unknown' — 합격이 아니다
  outcome jsonb NOT NULL DEFAULT '{}',
  measured_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_request_evaluations_uniq UNIQUE (request_id, rev)
);

-- ─── 6. RLS — 관리자만 읽는다. 쓰기는 RPC 로만 ─────────────────────
ALTER TABLE video_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_request_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_request_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_request_evaluations ENABLE ROW LEVEL SECURITY;

-- 분야는 관리자가 화면에서 늘리고 끌 수 있다 → 관리자 전체 권한
CREATE POLICY admin_video_domains ON video_domains FOR ALL
  USING (video_is_admin()) WITH CHECK (video_is_admin());
CREATE POLICY admin_read_video_requests ON video_requests FOR SELECT USING (video_is_admin());
CREATE POLICY admin_read_video_request_revisions ON video_request_revisions FOR SELECT USING (video_is_admin());
CREATE POLICY admin_read_video_request_reviews ON video_request_reviews FOR SELECT USING (video_is_admin());
CREATE POLICY admin_read_video_request_evaluations ON video_request_evaluations FOR SELECT USING (video_is_admin());

-- updated_at
DROP TRIGGER IF EXISTS trg_video_domains_updated ON video_domains;
CREATE TRIGGER trg_video_domains_updated BEFORE UPDATE ON video_domains
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_video_requests_updated ON video_requests;
CREATE TRIGGER trg_video_requests_updated BEFORE UPDATE ON video_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 7. RPC: 요청 만들기 (화면) ────────────────────────────────────
CREATE OR REPLACE FUNCTION video_request_create(
  p_domain text, p_target_key text, p_target_label text,
  p_purpose text, p_audience text, p_formats text[], p_memo text
) RETURNS video_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  d video_domains;
  r video_requests;
BEGIN
  IF NOT video_is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO d FROM video_domains WHERE id = p_domain AND enabled;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown or disabled domain: %', p_domain;
  END IF;
  IF coalesce(btrim(p_target_key), '') = '' OR coalesce(btrim(p_target_label), '') = '' THEN
    RAISE EXCEPTION 'target is required';
  END IF;
  INSERT INTO video_requests (domain_id, target_key, target_label, purpose, audience, formats, memo, created_by)
  VALUES (p_domain, btrim(p_target_key), btrim(p_target_label), p_purpose, p_audience,
          coalesce(p_formats, d.default_formats), coalesce(p_memo, ''), auth.uid())
  RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION video_request_create(text, text, text, text, text, text[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION video_request_create(text, text, text, text, text, text[], text) TO authenticated;

-- ─── 8. RPC: 검토 결정 (화면) ─────────────────────────────────────
-- 검토 대기(`designed`)의 **최신 rev** 에만 결정을 받는다 — 낡은 rev 를 보고 누른 승인이
-- 새 rev 를 통과시키는 일을 막는다.
CREATE OR REPLACE FUNCTION video_request_review(
  p_id uuid, p_rev int, p_decision text, p_comment text
) RETURNS video_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r video_requests;
BEGIN
  IF NOT video_is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM video_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such request'; END IF;
  IF r.phase <> 'designed' THEN
    RAISE EXCEPTION 'not awaiting review (phase=%)', r.phase;
  END IF;
  IF p_rev <> r.current_rev THEN
    RAISE EXCEPTION 'stale revision: reviewing % but current is %', p_rev, r.current_rev;
  END IF;
  IF p_decision NOT IN ('approve', 'revise', 'reject') THEN
    RAISE EXCEPTION 'bad decision: %', p_decision;
  END IF;
  -- 수정 요청·반려는 이유가 없으면 다음 설계가 무엇을 고칠지 모른다
  IF p_decision IN ('revise', 'reject') AND coalesce(btrim(p_comment), '') = '' THEN
    RAISE EXCEPTION 'comment is required for %', p_decision;
  END IF;

  INSERT INTO video_request_reviews (request_id, rev, decision, comment, reviewer)
  VALUES (p_id, p_rev, p_decision, coalesce(p_comment, ''), auth.uid());

  UPDATE video_requests
     SET phase = CASE p_decision
                   WHEN 'approve' THEN 'approved'
                   WHEN 'revise'  THEN 'changes_requested'
                   ELSE 'rejected' END
   WHERE id = p_id
  RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION video_request_review(uuid, int, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION video_request_review(uuid, int, text, text) TO authenticated;

-- ─── 9. RPC: 요청 거두기 (화면) ───────────────────────────────────
CREATE OR REPLACE FUNCTION video_request_cancel(p_id uuid) RETURNS video_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r video_requests;
BEGIN
  IF NOT video_is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  UPDATE video_requests SET phase = 'cancelled'
   WHERE id = p_id AND phase IN ('requested', 'designed', 'changes_requested', 'approved')
  RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'cannot cancel in this phase'; END IF;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION video_request_cancel(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION video_request_cancel(uuid) TO authenticated;

-- ─── 10. RPC: 설계 rev 올리기 (드레인 import · service_role) ──────
CREATE OR REPLACE FUNCTION video_request_add_revision(
  p_id uuid, p_plan jsonb, p_design jsonb, p_checks jsonb, p_author text
) RETURNS video_request_revisions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r video_requests;
  v video_request_revisions;
BEGIN
  SELECT * INTO r FROM video_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such request'; END IF;
  IF r.phase NOT IN ('requested', 'changes_requested') THEN
    RAISE EXCEPTION 'not awaiting design (phase=%)', r.phase;
  END IF;
  INSERT INTO video_request_revisions (request_id, rev, plan, design, checks, author)
  VALUES (p_id, r.current_rev + 1, p_plan, p_design, coalesce(p_checks, '{}'), coalesce(p_author, 'claude'))
  RETURNING * INTO v;
  UPDATE video_requests SET current_rev = v.rev, phase = 'designed', error = NULL WHERE id = p_id;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION video_request_add_revision(uuid, jsonb, jsonb, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION video_request_add_revision(uuid, jsonb, jsonb, jsonb, text) TO service_role;

-- ─── 11. RPC: 적용·평가 단계 옮기기 (CLI · service_role) ──────────
-- 허용 전이만 받는다. **approved 를 거치지 않고 applying 으로 가는 길이 없다.**
CREATE OR REPLACE FUNCTION video_request_advance(
  p_id uuid, p_phase text, p_video_id text, p_error text
) RETURNS video_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r video_requests;
  ok boolean;
BEGIN
  SELECT * INTO r FROM video_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such request'; END IF;
  ok := CASE p_phase
          WHEN 'applying'  THEN r.phase IN ('approved', 'failed') AND r.current_rev >= 1
          WHEN 'applied'   THEN r.phase = 'applying'
          WHEN 'evaluated' THEN r.phase IN ('applied', 'evaluated')
          WHEN 'failed'    THEN r.phase IN ('applying')
          ELSE false END;
  IF NOT ok THEN
    RAISE EXCEPTION 'transition % -> % not allowed', r.phase, p_phase;
  END IF;
  -- failed → applying 재시도는 승인된 rev 로만: 마지막 결정이 approve 인지 확인
  IF p_phase = 'applying' AND NOT EXISTS (
    SELECT 1 FROM video_request_reviews
     WHERE request_id = p_id AND rev = r.current_rev AND decision = 'approve'
  ) THEN
    RAISE EXCEPTION 'current revision % is not approved', r.current_rev;
  END IF;
  UPDATE video_requests
     SET phase = p_phase,
         video_id = coalesce(p_video_id, video_id),
         error = CASE WHEN p_phase = 'failed' THEN p_error ELSE NULL END
   WHERE id = p_id
  RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION video_request_advance(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION video_request_advance(uuid, text, text, text) TO service_role;

-- ─── 12. RPC: 평가 기록 (CLI · service_role) ──────────────────────
CREATE OR REPLACE FUNCTION video_request_record_evaluation(
  p_id uuid, p_spec jsonb, p_outcome jsonb
) RETURNS video_request_evaluations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r video_requests;
  e video_request_evaluations;
BEGIN
  SELECT * INTO r FROM video_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such request'; END IF;
  IF r.phase NOT IN ('applied', 'evaluated') THEN
    RAISE EXCEPTION 'not published yet (phase=%)', r.phase;
  END IF;
  INSERT INTO video_request_evaluations (request_id, rev, spec, outcome, measured_at)
  VALUES (p_id, r.current_rev, coalesce(p_spec, '{}'), coalesce(p_outcome, '{}'), now())
  ON CONFLICT (request_id, rev) DO UPDATE
    SET spec = EXCLUDED.spec, outcome = EXCLUDED.outcome, measured_at = now()
  RETURNING * INTO e;
  UPDATE video_requests SET phase = 'evaluated' WHERE id = p_id;
  RETURN e;
END $$;
REVOKE ALL ON FUNCTION video_request_record_evaluation(uuid, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION video_request_record_evaluation(uuid, jsonb, jsonb) TO service_role;
