-- supabase/migrations/20261001150000_csat_diagnosis_mvp.sql
--
-- **영어 진단 시스템 1단계(MVP)** — 학습자 /csat/diagnosis · 관리자 /admin/csat 진단 화면이 함께 쓴다.
-- 엔진은 코드에 하나 있다(`apps/web/src/lib/csat/diagnosis/engine`). 표는 입력과 결과만 담는다.
--
-- 설계 근거(2026-10-01 DB 실측 · Codex 협의):
--   · 기존 기출 표(csat_exams · csat_items)는 컬럼 추가만 한다 — 기존 기능·데이터는 건드리지 않는다.
--   · csat_items 에는 18~45번만 있다(듣기 1~17 없음). 45문항 채점용 정답·배점은 csat_dx_answer_key 에
--     따로 둔다(평가원 29회 · scripts/csat/data 의 검산된 정답표에서 적재 — scripts/csat/diagnosis/load-answer-keys.mjs).
--   · 선지 함정은 csat_item_analyses.choice_analysis 에 이미 있다 → 문항별 **최신 published** 분석에서 시드.
--     원래 라벨을 그대로 보존하고(정본 32종 밖 롱테일 포함), 계열(C1~C8)이 없는 라벨은 함정 진단에서만 빠진다.
--   · 역량 가중치는 유형별 기본값으로 시드하되 **검수 완료로 세지 않는다**(source=type_default, reviewed_at null).
--   · 학습자 표는 본인 SELECT 만 허용한다. 쓰기(기록 저장 · 채점 · 스냅샷)는 서버(service role)가 한다 —
--     점수와 진단을 학습자 기기가 만들지 않게 하기 위해서다.
--   · 엔진 설정은 버전으로 쌓는다. 스냅샷은 계산에 쓴 설정 버전을 가리킨다(덮어쓰면 과거 결과를 재현할 수 없다).
--
-- 되돌리기: 아래 csat_dx_* 표 DROP + 추가 컬럼 DROP(기존 데이터에는 영향 없음).

-- ── 1. 기존 표 확장 (컬럼 추가만) ─────────────────────────────────────────────
ALTER TABLE public.csat_exams
  ADD COLUMN IF NOT EXISTS official_grade1_ratio numeric(5,4) CHECK (official_grade1_ratio BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS official_stats_source text,
  ADD COLUMN IF NOT EXISTS diagnosis_ready boolean NOT NULL DEFAULT false;

ALTER TABLE public.csat_items
  ADD COLUMN IF NOT EXISTS official_error_rate numeric(5,4) CHECK (official_error_rate BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS ebs_linked boolean;   -- null = 미확인(연계 아님과 다르다)

COMMENT ON COLUMN public.csat_exams.diagnosis_ready IS
  '역량·함정 진단 반영 여부. false 면 점수·등급만 반영. 관리자가 태깅 검수 후 켠다.';
COMMENT ON COLUMN public.csat_items.official_error_rate IS
  '공식 오답률(0~1). null 이면 난이도 보정에서 시험 평균으로 대체, 시험 전체가 null 이면 보정하지 않는다.';

-- ── 2. 45문항 정답·배점 ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.csat_dx_answer_key (
  exam_id text NOT NULL REFERENCES public.csat_exams(id) ON DELETE CASCADE,
  no      smallint NOT NULL CHECK (no BETWEEN 1 AND 45),
  answers smallint[] NOT NULL CHECK (cardinality(answers) BETWEEN 1 AND 5 AND answers <@ ARRAY[1,2,3,4,5]::smallint[]),
  points  smallint NOT NULL CHECK (points IN (2, 3)),
  source  text NOT NULL,
  PRIMARY KEY (exam_id, no)
);

-- ── 3. 태깅 ────────────────────────────────────────────────────────────────
-- 역량: A1 어휘 · A2 구문 · A3 논리흐름 · A4 재진술 · A5 근거판단 · A6 배경지식 · A7 듣기 · A8 어법 · A9 속도
CREATE TABLE IF NOT EXISTS public.csat_dx_type_attribute (
  type_id        text NOT NULL REFERENCES public.csat_types(id) ON DELETE CASCADE,
  attribute_code text NOT NULL CHECK (attribute_code ~ '^A[1-9]$'),
  weight         smallint NOT NULL CHECK (weight BETWEEN 0 AND 2),
  PRIMARY KEY (type_id, attribute_code)
);

CREATE TABLE IF NOT EXISTS public.csat_dx_item_attribute (
  item_id        text NOT NULL REFERENCES public.csat_items(id) ON DELETE CASCADE,
  attribute_code text NOT NULL CHECK (attribute_code ~ '^A[1-9]$'),
  weight         smallint NOT NULL CHECK (weight BETWEEN 0 AND 2),
  source         text NOT NULL CHECK (source IN ('type_default', 'admin')),
  reviewed_at    timestamptz,
  reviewed_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (item_id, attribute_code)
);

CREATE TABLE IF NOT EXISTS public.csat_dx_trap_family (
  trap_key text PRIMARY KEY,
  family   text CHECK (family ~ '^C[1-9]$'),   -- C9 = 글 구조 단서(사용자 승인 2026-10-01) · null = 계열 없음 → 함정 진단 제외
  note     text
);

CREATE TABLE IF NOT EXISTS public.csat_dx_option_trap (
  item_id          text NOT NULL REFERENCES public.csat_items(id) ON DELETE CASCADE,
  option_no        smallint NOT NULL CHECK (option_no BETWEEN 1 AND 5),
  trap_key         text NOT NULL,
  source           text NOT NULL CHECK (source IN ('analysis', 'admin')),
  analysis_version int,
  reviewed_at      timestamptz,
  reviewed_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (item_id, option_no)
);

CREATE TABLE IF NOT EXISTS public.csat_dx_pool (
  item_id  text PRIMARY KEY REFERENCES public.csat_items(id) ON DELETE CASCADE,
  active   boolean NOT NULL DEFAULT true,
  added_at timestamptz NOT NULL DEFAULT now()
);

-- ── 4. 엔진 설정 (버전으로 쌓는다) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.csat_dx_settings (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  settings   jsonb NOT NULL,
  active     boolean NOT NULL DEFAULT false,
  note       text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS csat_dx_settings_one_active ON public.csat_dx_settings (active) WHERE active;

-- ── 5. 학습자 입력 · 결과 ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.csat_dx_profile_hist (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  valid_from   timestamptz NOT NULL DEFAULT now(),
  grade_level  text NOT NULL CHECK (grade_level IN ('h1', 'h2', 'h3', 'n_su', 'adult')),
  goal_type    text NOT NULL CHECK (goal_type IN ('susi_min', 'jeongsi', 'naesin', 'keep')),
  goal_detail  jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {min_rule:"3합6", target_grade:2}
  background   jsonb NOT NULL DEFAULT '{}'::jsonb,   -- 배경 질문 5개 답
  weekly_hours smallint CHECK (weekly_hours BETWEEN 0 AND 80),
  entered_by   text NOT NULL DEFAULT 'learner' CHECK (entered_by IN ('learner', 'admin'))
);
CREATE INDEX IF NOT EXISTS csat_dx_profile_hist_user ON public.csat_dx_profile_hist (user_id, valid_from DESC);

CREATE TABLE IF NOT EXISTS public.csat_dx_session (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_id       text REFERENCES public.csat_exams(id),
  mode          text NOT NULL CHECK (mode IN ('live', 'retake', 'app', 'diagnostic')),
  taken_at      date NOT NULL,
  total_minutes smallint CHECK (total_minutes BETWEEN 0 AND 300),
  entered_by    text NOT NULL DEFAULT 'learner' CHECK (entered_by IN ('learner', 'admin')),
  client_key    uuid NOT NULL,                    -- 재전송 멱등 키
  raw_score     smallint CHECK (raw_score BETWEEN 0 AND 100),
  grade         smallint CHECK (grade BETWEEN 1 AND 9),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT csat_dx_session_once UNIQUE (user_id, client_key),
  CONSTRAINT csat_dx_session_exam_mode CHECK ((mode = 'diagnostic') = (exam_id IS NULL))
);
CREATE INDEX IF NOT EXISTS csat_dx_session_user ON public.csat_dx_session (user_id, taken_at DESC);

CREATE TABLE IF NOT EXISTS public.csat_dx_response (
  session_id    uuid NOT NULL REFERENCES public.csat_dx_session(id) ON DELETE CASCADE,
  item_no       smallint NOT NULL CHECK (item_no BETWEEN 1 AND 45),   -- 시험: 문항 번호 · 진단 테스트: 출제 순서
  item_id       text REFERENCES public.csat_items(id),                 -- 듣기(1~17)는 null
  chosen_option smallint CHECK (chosen_option BETWEEN 1 AND 5),        -- null = 비워 둠
  is_correct    boolean NOT NULL,
  confidence    text NOT NULL DEFAULT 'sure' CHECK (confidence IN ('sure', 'unsure', 'guess', 'timeout')),
  PRIMARY KEY (session_id, item_no)
);

CREATE TABLE IF NOT EXISTS public.csat_dx_snapshot (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  computed_at         timestamptz NOT NULL DEFAULT now(),
  trigger             text NOT NULL CHECK (trigger IN ('session', 'profile', 'admin', 'settings')),
  session_id          uuid REFERENCES public.csat_dx_session(id) ON DELETE SET NULL,
  engine_version      text NOT NULL,
  settings_id         bigint REFERENCES public.csat_dx_settings(id),
  inputs_as_of        timestamptz NOT NULL,
  raw_score           smallint,
  adjusted_score      numeric(5,1),
  grade_est           smallint,
  attribute_mastery   jsonb NOT NULL DEFAULT '{}'::jsonb,
  trap_vulnerability  jsonb NOT NULL DEFAULT '{}'::jsonb,
  habit_flags         jsonb NOT NULL DEFAULT '[]'::jsonb,
  forecast            jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence          text NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  recommended_lines   jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence            jsonb NOT NULL DEFAULT '{}'::jsonb   -- 반영 시험 수 · 응답 수 · 태그 검수 상태
);
CREATE INDEX IF NOT EXISTS csat_dx_snapshot_user ON public.csat_dx_snapshot (user_id, computed_at DESC);

CREATE TABLE IF NOT EXISTS public.csat_dx_habit_feedback (
  snapshot_id uuid NOT NULL REFERENCES public.csat_dx_snapshot(id) ON DELETE CASCADE,
  habit_code  text NOT NULL,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agreed      boolean NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (snapshot_id, habit_code)
);

-- ── 6. RLS — 학습자는 자기 행 읽기만. 쓰기와 관리자 표는 service role ─────────────────
ALTER TABLE public.csat_dx_answer_key     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_dx_type_attribute ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_dx_item_attribute ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_dx_trap_family    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_dx_option_trap    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_dx_pool           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_dx_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_dx_profile_hist   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_dx_session        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_dx_response       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_dx_snapshot       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_dx_habit_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY csat_dx_profile_hist_own_select ON public.csat_dx_profile_hist
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY csat_dx_session_own_select ON public.csat_dx_session
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY csat_dx_response_own_select ON public.csat_dx_response
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.csat_dx_session s WHERE s.id = session_id AND s.user_id = (SELECT auth.uid())));
CREATE POLICY csat_dx_snapshot_own_select ON public.csat_dx_snapshot
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY csat_dx_habit_feedback_own_select ON public.csat_dx_habit_feedback
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

GRANT SELECT ON public.csat_dx_profile_hist, public.csat_dx_session, public.csat_dx_response,
  public.csat_dx_snapshot, public.csat_dx_habit_feedback TO authenticated;

-- ── 7. 기록 저장 — 세션 + 응답을 한 트랜잭션으로, client_key 로 멱등 ──────────────────
-- 채점(is_correct · raw_score · grade)은 서버 코드가 엔진으로 계산해 넘긴다. 여기는 원자적 저장만 한다.
CREATE OR REPLACE FUNCTION public.csat_dx_record_session(p_session jsonb, p_responses jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO csat_dx_session (user_id, exam_id, mode, taken_at, total_minutes, entered_by, client_key, raw_score, grade)
  VALUES ((p_session->>'user_id')::uuid, p_session->>'exam_id', p_session->>'mode', (p_session->>'taken_at')::date,
          (p_session->>'total_minutes')::smallint, coalesce(p_session->>'entered_by', 'learner'),
          (p_session->>'client_key')::uuid, (p_session->>'raw_score')::smallint, (p_session->>'grade')::smallint)
  ON CONFLICT ON CONSTRAINT csat_dx_session_once DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN   -- 같은 제출의 재전송: 기존 세션을 돌려준다
    SELECT id INTO v_id FROM csat_dx_session
     WHERE user_id = (p_session->>'user_id')::uuid AND client_key = (p_session->>'client_key')::uuid;
    RETURN v_id;
  END IF;

  INSERT INTO csat_dx_response (session_id, item_no, item_id, chosen_option, is_correct, confidence)
  SELECT v_id, (r->>'item_no')::smallint, r->>'item_id', (r->>'chosen_option')::smallint,
         (r->>'is_correct')::boolean, coalesce(r->>'confidence', 'sure')
    FROM jsonb_array_elements(p_responses) r;

  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.csat_dx_record_session(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.csat_dx_record_session(jsonb, jsonb) TO service_role;

-- ── 8. 시드 ────────────────────────────────────────────────────────────────
-- 8-1. 함정 계열 — 정본 32종. C1~C8 + C9 글 구조 단서(지시어·첫 등장·단락 순서 등 — 순서·삽입 유형의 핵심 함정).
INSERT INTO public.csat_dx_trap_family (trap_key, family, note) VALUES
  ('어휘 함정', 'C1', NULL), ('어휘 반복 유인', 'C1', NULL), ('동어 반복 유인', 'C1', NULL),
  ('무관', 'C2', NULL), ('총론-각론 역전', 'C2', NULL),
  ('부분 사실', 'C3', NULL), ('전칭 검증 부담', 'C3', NULL),
  ('인과 역전', 'C4', NULL), ('시간·인과 순서 역전', 'C4', NULL), ('조건-귀결 절단', 'C4', NULL),
  ('주체 역전', 'C5', NULL), ('범위 과대', 'C5', NULL), ('범위 과소', 'C5', NULL), ('임계값 경계', 'C5', NULL),
  ('대소 비교 뒤집기', 'C5', NULL), ('등장인물 혼동', 'C5', NULL), ('항목 짝 바꾸기', 'C5', NULL),
  ('반대 진술', 'C6', NULL), ('연결사 방향 충돌', 'C6', NULL),
  ('지문 밖 상식', 'C7', NULL),
  ('지시어 선행사 절단', 'C9', '글 구조 단서'), ('지시어 선행사 없음', 'C9', '글 구조 단서'),
  ('지시어 선행사 앞당김', 'C9', '글 구조 단서'), ('첫 등장 위반', 'C9', '글 구조 단서'),
  ('첫 등장 뒤집힘', 'C9', '글 구조 단서'), ('첫 등장 역전', 'C9', '글 구조 단서'),
  ('단락 순서 교란', 'C9', '글 구조 단서'), ('단락 순서 오판', 'C9', '글 구조 단서'),
  ('열거·병렬 절단', 'C9', '글 구조 단서'), ('예고–응답 분리', 'C9', '글 구조 단서'),
  ('마무리 문장 위치 오판', 'C9', '글 구조 단서'), ('국소 어색함', NULL, '어법·어휘 국소형')
ON CONFLICT (trap_key) DO NOTHING;

-- 8-2. 선지 함정 — 문항별 최신 published 분석, 오답 선지만, 원래 라벨 그대로
INSERT INTO public.csat_dx_option_trap (item_id, option_no, trap_key, source, analysis_version)
SELECT l.item_id, (e->>'n')::smallint, e->>'trap', 'analysis', l.version
  FROM (SELECT DISTINCT ON (item_id) item_id, version, choice_analysis
          FROM public.csat_item_analyses WHERE status = 'published'
         ORDER BY item_id, version DESC) l
  JOIN public.csat_items i ON i.id = l.item_id,
       jsonb_array_elements(l.choice_analysis) e
 WHERE (e->>'n') ~ '^[1-5]$'
   AND coalesce(e->>'trap', '') NOT IN ('', '-')
   AND NOT ((e->>'n')::int = coalesce(i.answer, -1) OR (e->>'n')::int = ANY (coalesce(i.answers, '{}')))
ON CONFLICT (item_id, option_no) DO NOTHING;

-- 8-3. 유형별 기본 역량 가중치(초기 추정 — 관리자 화면에서 고친다)
INSERT INTO public.csat_dx_type_attribute (type_id, attribute_code, weight)
SELECT t, a, w FROM (VALUES
  ('R-PURPOSE','A1',1),('R-PURPOSE','A3',1),('R-PURPOSE','A4',1),('R-PURPOSE','A5',1),
  ('R-MOOD','A1',2),('R-MOOD','A5',1),
  ('R-CLAIM','A3',1),('R-CLAIM','A4',2),('R-CLAIM','A5',1),
  ('R-IMPLY','A1',1),('R-IMPLY','A2',1),('R-IMPLY','A4',2),('R-IMPLY','A6',1),
  ('R-GIST','A3',1),('R-GIST','A4',2),('R-GIST','A5',1),
  ('R-TOPIC','A1',1),('R-TOPIC','A3',1),('R-TOPIC','A4',2),
  ('R-TITLE','A3',1),('R-TITLE','A4',2),('R-TITLE','A6',1),
  ('R-CHART','A5',2),('R-CHART','A9',1),
  ('R-FACT','A2',1),('R-FACT','A5',2),
  ('R-NOTICE','A5',2),('R-NOTICE','A9',1),
  ('R-GRAMMAR','A2',1),('R-GRAMMAR','A8',2),
  ('R-VOCAB','A1',2),('R-VOCAB','A3',1),
  ('R-BLANK','A1',1),('R-BLANK','A2',1),('R-BLANK','A3',2),('R-BLANK','A4',2),('R-BLANK','A6',1),
  ('R-BLANK2','A3',2),('R-BLANK2','A4',1),
  ('R-IRRELEVANT','A3',2),
  ('R-ORDER','A2',1),('R-ORDER','A3',2),
  ('R-INSERT','A2',1),('R-INSERT','A3',2),
  ('R-SUMMARY','A1',1),('R-SUMMARY','A4',2),
  ('R-REFER','A2',1),('R-REFER','A3',1),
  ('X-TITLE','A3',1),('X-TITLE','A4',2),('X-TITLE','A9',1),
  ('X-BLANK','A3',2),('X-BLANK','A4',1),('X-BLANK','A9',1),
  ('X-BLANK2','A3',2),('X-BLANK2','A4',1),('X-BLANK2','A9',1),
  ('X-VOCAB','A1',2),('X-VOCAB','A3',1),('X-VOCAB','A9',1),
  ('X-ORDER','A3',2),('X-ORDER','A9',1),
  ('X-REFER','A2',1),('X-REFER','A3',1),('X-REFER','A9',1),
  ('X-FACT','A5',2),('X-FACT','A9',1)
) v(t, a, w)
WHERE EXISTS (SELECT 1 FROM public.csat_types ct WHERE ct.id = v.t)
ON CONFLICT (type_id, attribute_code) DO NOTHING;

-- 8-4. 문항 역량 — 유형 기본값 복사(검수 전)
INSERT INTO public.csat_dx_item_attribute (item_id, attribute_code, weight, source)
SELECT i.id, ta.attribute_code, ta.weight, 'type_default'
  FROM public.csat_items i JOIN public.csat_dx_type_attribute ta ON ta.type_id = i.type_id
ON CONFLICT (item_id, attribute_code) DO NOTHING;

-- 8-5. 엔진 설정 v1(초기 추정값 — 습관 피드백·누적 데이터로 조정한다)
INSERT INTO public.csat_dx_settings (settings, active, note)
SELECT '{
  "grade_cuts": [90, 80, 70, 60, 50, 40, 30, 20],
  "half_life_days": 60,
  "credit": { "sure": 1.0, "unsure": 0.7, "guess": 0.3, "timeout": 0.3 },
  "retake_weight": 0.5,
  "min_observations": 5,
  "listening": { "attribute": "A7", "weight": 2 },
  "trap": { "min_exposure": 5, "vulnerable_ratio": 0.3 },
  "habits": {
    "time_collapse": { "from_no": 41, "to_no": 45, "ratio": 1.5, "timeout_count": 2 },
    "guessing": { "guess_ratio": 0.15, "easy_error_rate": 0.2, "easy_wrong_count": 2 },
    "word_reuse": { "family": "C1", "ratio": 0.4 },
    "cutline_90": { "sessions": 3, "lo": 86, "hi": 93 },
    "ebs": { "gap": 0.2 },
    "listening": { "to_no": 17, "wrong_count": 2, "consecutive": 2 }
  },
  "reference_exam": null,
  "scenario_exams": { "hard": null, "normal": null, "easy": null },
  "confidence": { "high": { "exams": 4, "responses": 150 }, "medium": { "exams": 2, "responses": 60 } },
  "recommend": { "weak_attributes": 2, "vulnerable_traps": 1, "max_lines": 3 },
  "diagnostic_test": { "size": 20 }
}'::jsonb, true, 'v1 초기값(지시문 수치)'
WHERE NOT EXISTS (SELECT 1 FROM public.csat_dx_settings);

COMMENT ON TABLE public.csat_dx_session IS '진단용 시험 기록 한 회. 채점은 서버 엔진 — lib/csat/diagnosis/engine.';
COMMENT ON TABLE public.csat_dx_snapshot IS '진단 결과 누적(덮어쓰지 않음). settings_id · engine_version 으로 재현.';
COMMENT ON TABLE public.csat_dx_option_trap IS '선지×함정. 시드는 최신 published 분석(source=analysis), 관리자 수정은 source=admin.';
