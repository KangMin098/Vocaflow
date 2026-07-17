-- compute_book_difficulty(book_id) — 도서 난이도 v2.4 앙상블 (신규 도서 파이프라인 자동 편입)
-- ⚠ 승인 후 execute_sql 로 적용($ 본문 — apply_migration 오분할 회피).
--
-- 설계: docs/proposals/book-difficulty-multiaxis.md. scripts/apply-book-difficulty.mjs 의 SQL 이식.
-- 어휘 단축(book_v_level=p75) 왜곡 교정: ease-게이트 어휘 + 통사(F-K/sent/clause) 병목 융합
--   + hidden-difficulty 커버리지 범프. Claude 검토(claude_v) 도서는 v3 권위 → 미덮음(가드).
-- 파이프라인 배선: lcp/dev-process 의 compute_book_syntax 직후 호출(모든 신호 계산 완료 후).
-- F-K(flesch_kincaid_grade)는 파이프라인 밖 배치라 없을 수 있음 → sent_p90+clause_depth 로 대체(graceful).

CREATE OR REPLACE FUNCTION public.compute_book_difficulty(p_book_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_vrl jsonb; v_fk numeric; v_ease numeric; v_syn jsonb; v_cj text; v_lemcov numeric;
  v_wavg numeric; v_p75 numeric; v_easeW numeric; v_lex numeric; v_vfk numeric;
  v_cd numeric; v_sent numeric; v_clausebump numeric; v_sentbump numeric; v_syn_axis numeric;
  v_unm numeric; v_covbump numeric; v_hi numeric; v_mn numeric; v_nv int;
  v_cjv numeric; v_spread numeric; v_conf numeric; v_old int;
BEGIN
  SELECT vrl_components, flesch_kincaid_grade, flesch_reading_ease, syntax_score, cefrj_level,
         (vrl_components->>'lemma_coverage_pct')::numeric, book_v_level
    INTO v_vrl, v_fk, v_ease, v_syn, v_cj, v_lemcov, v_old
    FROM public.library_books WHERE id = p_book_id;

  IF v_vrl IS NULL OR (v_vrl->>'p75') IS NULL THEN RETURN; END IF;          -- 메트릭 미비 → 스킵
  IF (v_vrl->'difficulty_v2'->>'claude_v') IS NOT NULL THEN RETURN; END IF; -- Claude 검토 도서 → v3 권위, 미덮음

  v_wavg := COALESCE((v_vrl->>'weighted_avg')::numeric, (v_vrl->>'p75')::numeric);
  v_p75  := (v_vrl->>'p75')::numeric;
  v_easeW := GREATEST(0, LEAST(1, (COALESCE(v_ease,60)-50)/40.0));
  v_lex := GREATEST(0, LEAST(11, v_wavg + (1-v_easeW)*(v_p75 - v_wavg)));    -- ease-게이트 (lexOffset≈0)

  -- 통사축: F-K(있으면) · sent_p90 · clause_depth 중 최대 (F-K 없어도 통사 신호 확보)
  v_vfk := CASE WHEN v_fk IS NOT NULL THEN GREATEST(0,LEAST(11,(v_fk-2)*0.62)) ELSE 0 END;
  v_cd   := COALESCE((v_syn->>'clause_depth_p90')::numeric, 0);
  v_sent := COALESCE((v_syn->>'sent_p90')::numeric, 0);
  v_clausebump := GREATEST(0, LEAST(11, (v_cd-3)*0.9));
  v_sentbump   := GREATEST(0, LEAST(11, (v_sent-15)*0.18));
  v_syn_axis := GREATEST(v_vfk, v_clausebump, v_sentbump);

  -- hidden-difficulty(방언·외래=미매칭 어휘) 커버리지 범프 (p75 높으면 감쇠 — 중복 회피)
  v_unm := 100 - COALESCE(v_lemcov, 90);
  v_covbump := GREATEST(0, LEAST(2.5, (v_unm-15)/8.0)) * (CASE WHEN v_p75<=7 THEN 1 ELSE 0.3 END);

  -- 병목(더 어려운 축) 지배 + covBump
  v_hi := GREATEST(v_lex, v_syn_axis);
  v_mn := (v_lex + v_syn_axis)/2.0;
  v_nv := round(GREATEST(0, LEAST(11, 0.75*v_hi + 0.25*v_mn + 0.6*v_covbump)));

  -- 확신: 축일치 + CEFR-J 교차확증 · 저커버리지 감쇠(신규 도서 검토 유도)
  v_cjv := CASE v_cj WHEN 'preA1' THEN 0 WHEN 'A1.1' THEN 1 WHEN 'A1.2' THEN 1 WHEN 'A1.3' THEN 2
    WHEN 'A2.1' THEN 3 WHEN 'A2.2' THEN 4 WHEN 'B1.1' THEN 5 WHEN 'B1.2' THEN 6
    WHEN 'B2.1' THEN 7 WHEN 'B2.2' THEN 8 WHEN 'C1' THEN 9 WHEN 'C2' THEN 11 ELSE NULL END;
  v_spread := abs(v_lex - v_syn_axis);
  v_conf := round(((0.5*GREATEST(0,1-v_spread/6.0)
    + 0.5*(CASE WHEN v_cjv IS NOT NULL THEN GREATEST(0,1-abs(v_nv-v_cjv)/3.0) ELSE 0.7 END))
    * (CASE WHEN v_unm>=20 THEN 0.85 ELSE 1 END))::numeric, 2);

  UPDATE public.library_books SET
    book_v_level = v_nv,
    vrl_components = jsonb_set(
      jsonb_set(vrl_components, '{book_v_level_v1}',
        COALESCE(vrl_components->'book_v_level_v1', to_jsonb(v_old)), true),
      '{difficulty_v2}', jsonb_build_object(
        'v', v_nv, 'confidence', v_conf, 'lexical', round(v_lex,2), 'syntactic', round(v_syn_axis,2),
        'cov_bump', round(v_covbump,1), 'unmatched_pct', round(v_unm,0), 'cefrj_v', v_cjv,
        'method', 'v2.4_sql'), true)
  WHERE id = p_book_id;
END $fn$;

COMMENT ON FUNCTION public.compute_book_difficulty(uuid) IS
  '도서 난이도 v2.4 앙상블(ease-게이트 어휘+통사 병목+커버리지 범프). p75 단축 왜곡 교정. claude_v 있으면 미덮음. lcp/dev-process compute_book_syntax 직후 호출.';
