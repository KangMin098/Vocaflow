-- ═══════════════════════════════════════════════════════════════════════════
-- Lexicon Unification Phase 2 — Step 2-B 후속 remediation
--
-- 배경: Phase 2 (commit c43726a, migration 20260521153559 lexicon_phase2_backfill)
--       의 Step 2-B 가 meanings_ko 가 plain-string 배열인 row 들을 잘못 처리.
--       `m || jsonb_build_object('sense_idx', ord - 1)` 가 m 이 jsonb string 일 때
--       JSONB || semantics 로 인해 두 값을 배열로 묶음 → senses[i] = ["str", {sense_idx:0}].
--
-- 영향: 780 row (imported 450 + ai-generated 330). kice-orphan 은 영향 없음.
--
-- 처리: 각 affected row 의 senses 를 meanings_ko 의 각 string 요소를 표준 sense
--       object 로 재포장. pos 는 primary_pos 사용 (COALESCE pos).
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE v_pre_count INT;
BEGIN
  SELECT COUNT(*) INTO v_pre_count FROM shared_dictionary sd
  WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(sd.senses) s
    WHERE NOT (s ? 'sense_idx' AND s ? 'pos' AND s ? 'sense_ko' AND s ? 'register' AND s ? 'examples'));
  RAISE NOTICE 'Remediation 대상: % rows', v_pre_count;
  IF v_pre_count <> 780 THEN
    RAISE NOTICE '⚠ 실측 % (780 예상). 다른 affected row 분포 가능 — 검증 필요.', v_pre_count;
  END IF;
END $$;

-- ── senses 재구성 ──
UPDATE shared_dictionary sd
SET senses = (
  SELECT jsonb_agg(jsonb_build_object(
    'sense_idx', ord - 1,
    'pos', COALESCE(sd.primary_pos, sd.pos),
    'sense_ko', m,           -- jsonb string 그대로 (예: "마카크원숭이")
    'sense_en', NULL,
    'register', 'neutral',
    'examples', '[]'::jsonb
  ) ORDER BY ord)
  FROM jsonb_array_elements(sd.meanings_ko) WITH ORDINALITY AS arr(m, ord)
),
pos_set = COALESCE(
  ARRAY[sd.primary_pos]::TEXT[],
  ARRAY[sd.pos]::TEXT[],
  '{}'::TEXT[]
),
updated_at = now()
WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(sd.senses) s
  WHERE NOT (s ? 'sense_idx' AND s ? 'pos' AND s ? 'sense_ko' AND s ? 'register' AND s ? 'examples'));

-- ── 검증 ──
DO $$
DECLARE
  v_bad_remaining INT;
  v_pos_set_mismatch INT;
  v_sample JSONB;
BEGIN
  SELECT COUNT(*) INTO v_bad_remaining FROM shared_dictionary sd
  WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(sd.senses) s
    WHERE NOT (s ? 'sense_idx' AND s ? 'pos' AND s ? 'sense_ko' AND s ? 'register' AND s ? 'examples'));

  SELECT COUNT(*) INTO v_pos_set_mismatch FROM shared_dictionary sd
  WHERE jsonb_array_length(sd.senses) > 0
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(sd.senses) s
      WHERE (s->>'pos') = ANY(sd.pos_set)
    );

  SELECT senses->0 INTO v_sample FROM shared_dictionary
  WHERE word = 'macaque';

  RAISE NOTICE '검증 결과:';
  RAISE NOTICE '  malformed senses 잔여: % (0 예상)', v_bad_remaining;
  RAISE NOTICE '  pos_set vs senses.pos mismatch: % (0 예상)', v_pos_set_mismatch;
  RAISE NOTICE '  macaque senses[0] = %', v_sample;

  IF v_bad_remaining > 0 THEN
    RAISE EXCEPTION 'Remediation 실패: malformed senses % row 잔여', v_bad_remaining;
  END IF;
  IF v_pos_set_mismatch > 0 THEN
    RAISE EXCEPTION 'Remediation 실패: pos_set vs senses mismatch % row', v_pos_set_mismatch;
  END IF;

  RAISE NOTICE 'Remediation 완료 ✓';
END $$;
