-- CTP P1/P2 (④⑤⑦) — 런타임 신규 테이블 3종 + RLS
-- ④ reading_fluency_log (유창성/WPM — 이름충돌 회피: reading_sessions 는 기존 읽기플랜)
-- ⑤ csat_stage_gates (게이트 임계 — 하드코딩 금지·잠금 금지)
-- ⑦ csat_item_attempts (per-item 응답 + error_cause — scores 는 세션단위라 부착 불가)
-- 근거: ctp_p0_20260709.md. ⚠ 승인 후 apply.

-- ④ 유창성 로그 — comprehension_ok 세션만 유효 WPM 산정. memory_state 계열 아님(세션 사실 기록).
CREATE TABLE public.reading_fluency_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('article','chapter','byo')),
  ref_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  word_count int,
  comprehension_ok boolean,                      -- 유효 WPM = ok 세션만
  is_rereading boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rfl_user_time ON public.reading_fluency_log (user_id, started_at DESC);
ALTER TABLE public.reading_fluency_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY rfl_owner ON public.reading_fluency_log
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ⑤ 게이트 임계 — stage × metric. is_locked=false(권장값 · 베타 보정 대상 — 잠금 금지).
CREATE TABLE public.csat_stage_gates (
  stage text NOT NULL,
  metric text NOT NULL CHECK (metric IN ('coverage','wpm','item_accuracy','listening')),
  threshold numeric NOT NULL,
  is_locked boolean NOT NULL DEFAULT false,      -- 문헌 가설 → 베타 데이터로만 잠금
  note text,
  PRIMARY KEY (stage, metric)
);
-- 초기 권장값(문헌 가설 · is_locked=false). 실 임계는 베타 사용 데이터로 보정.
INSERT INTO public.csat_stage_gates (stage, metric, threshold, note) VALUES
  ('S1','coverage',0.98,'입문 다독 — 거의 전부 기지어'),
  ('S1','wpm',100,'입문 유효 WPM(comprehension_ok)'),
  ('S2','coverage',0.95,'자동화 다독 i+1 하한'),
  ('S2','wpm',130,'자동화 유효 WPM'),
  ('S3','coverage',0.90,'논증 정독 — 약간의 미지어 허용'),
  ('S3','item_accuracy',0.70,'order/insert 정답률'),
  ('S4','coverage',0.85,'킬러 정독 — 미지어 밀도 상승'),
  ('S4','item_accuracy',0.65,'킬러 문항 정답률'),
  ('S5','listening',0.80,'BYO 병행 듣기 정합');

-- ⑦ per-item 응답 + error_cause — 오답 라우팅(결손 복귀)의 부착점.
CREATE TABLE public.csat_item_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.quiz_questions(id) ON DELETE SET NULL,
  text_id uuid,                                  -- 문항 원천 텍스트(참조 — FK 강제 안 함)
  is_correct boolean NOT NULL,
  -- 오답 원인 → 결손 복귀: vocab→FSRS / parsing→문장 정독 / structure→재구성 / inference→근거 / timing→S5
  error_cause text CHECK (error_cause IS NULL OR error_cause IN
    ('vocab','parsing','structure','inference','timing')),
  item_role text,                                -- 문항 시점 role snapshot(practice/verify)
  responded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cia_user_time ON public.csat_item_attempts (user_id, responded_at DESC);
ALTER TABLE public.csat_item_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY cia_owner ON public.csat_item_attempts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.reading_fluency_log IS 'CTP ④ 유창성(유효 WPM). reading_sessions(읽기플랜)와 별개.';
COMMENT ON TABLE public.csat_stage_gates IS 'CTP ⑤ 게이트 임계(권장값 · is_locked=false). 학습자 stage = 전 게이트 통과 최대 단계 실시간 파생.';
COMMENT ON TABLE public.csat_item_attempts IS 'CTP ⑦ per-item 응답 + error_cause 라우팅. scores(세션단위)로 불가하여 신설.';