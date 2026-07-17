-- CTP ① — compute_syntax_score.score 포화 버그 재보정
-- ⚠ 승인 + CTP 임계값 재검증 후 apply. IMMUTABLE.
--
-- 문제: 기존 score = LEAST(100, sent_p90×2 + clause_depth_p90×6) 가 가중치 과대로
--   거의 모든 중급+ 텍스트가 100 포화 (Alice 112·Gibbon 212·Foundational 110·GE 112).
--   → 변별력 0. (도서 난이도 v2.2 감사에서 발견, docs/proposals/book-difficulty-multiaxis.md)
--
-- 재보정: 관측 범위(sent_p90 ~18-85, clause_depth_p90 ~2-12)를 0-100 에 선형 분산.
--   score = clamp((sent_p90 − 10)×0.75 + (clause_depth_p90 − 1)×5, 0, 100)
--   실측: 쉬움(18,2)→11 · Railway(28,4)→28 · Alice(38,6)→46 · Gibbon(76,10)→94 · 극단(85,12)→100.
--   sent_p90 / clause_depth_p90 계산은 불변 — score 공식만 교체.
--
-- ⚠ CTP 소비 주의: dev-process(article/book)·stage 파생·DCP 가 syntax_score.score 참조.
--   기존 saturated(≈100) 기준으로 튜닝된 임계값이 있으면 재검증 필요. 난이도 앙상블은 raw
--   clause_depth_p90 사용이라 무영향.

CREATE OR REPLACE FUNCTION public.compute_syntax_score(p_content text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $function$
  WITH sents AS (
    SELECT trim(s) AS s
    FROM regexp_split_to_table(coalesce(p_content, ''), '[.!?]+[\s"]') AS s
    WHERE length(trim(s)) > 2
  ),
  m AS (
    SELECT
      array_length(regexp_split_to_array(s, '\s+'), 1) AS wlen,
      (length(s) - length(regexp_replace(s, '[,;]', '', 'g')))
      + (SELECT count(*) FROM regexp_matches(lower(s),
           '\y(that|which|who|whom|whose|because|although|though|while|whereas|if|when|since|unless|before|after|as)\y', 'g')) AS clauses
    FROM sents
  )
  SELECT CASE WHEN (SELECT count(*) FROM m) = 0 THEN NULL
  ELSE jsonb_build_object(
    'sent_p90', coalesce((SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY wlen) FROM m), 0)::int,
    'clause_depth_p90', round(coalesce((SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY clauses) FROM m), 0)::numeric, 1),
    -- score 0-100 (재보정): 관측 범위 선형 분산 → 포화 회피, 변별력 확보.
    'score', GREATEST(0, LEAST(100, round(
        (coalesce((SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY wlen) FROM m), 0) - 10) * 0.75
      + (coalesce((SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY clauses) FROM m), 0) - 1) * 5.0
    )))::int
  ) END
$function$;

COMMENT ON FUNCTION public.compute_syntax_score(text) IS
  'CTP ① 구문 난이도. 자체 정규식(문장 p90·절 깊이). NULL=텍스트 없음. score v2 재보정(포화 회피, 관측범위 선형 분산).';
