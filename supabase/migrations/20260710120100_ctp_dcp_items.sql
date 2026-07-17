-- CTP P1/P2 (③) — DCP 문항 확장: quiz_questions type CHECK + item_role
-- 결정론 순서·삽입 문항(order/insert · LLM 0) + 문항 역할(practice/verify).
-- 근거: ctp_p0_20260709.md — 기존 type=('multiple','truefalse','blank'), item_role 부재.
-- ⚠ 승인 후 apply. 기존 3종 값 전부 보존.

-- type CHECK 교체 — 제약명은 환경별 상이 가능 → 동적 DROP(P0 이름 미고정).
DO $$
DECLARE cn text;
BEGIN
  SELECT conname INTO cn
  FROM pg_constraint
  WHERE conrelid = 'public.quiz_questions'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%type%'
  LIMIT 1;
  IF cn IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.quiz_questions DROP CONSTRAINT %I', cn);
  END IF;
END $$;

ALTER TABLE public.quiz_questions
  ADD CONSTRAINT quiz_questions_type_check
  CHECK (type = ANY (ARRAY['multiple','truefalse','blank','order','insert']));

-- item_role — 문항 목적. practice(연습 · order/insert) / verify(확인 · gist류). NULL=미분류(기존).
ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS item_role text
  CHECK (item_role IS NULL OR item_role IN ('practice','verify'));

COMMENT ON COLUMN public.quiz_questions.item_role IS
  'CTP DCP: practice(order/insert 연습) · verify(gist 확인). Today 처방이 stage≥S3 practice / verify 슬롯 분기.';