-- CTP P3 (①) — compute_syntax_score(text) → jsonb {sent_p90, clause_depth_p90, score}
-- 자체 정규식(문장 분할 + 절 마커 count). 런타임 LLM 0 · winkNLP 불요(P0 결정).
-- compute_*_vrl 패턴과 동일 — dev-process 가 RPC 로 호출 + backfill UPDATE 에 사용.
-- ⚠ 승인 후 apply. IMMUTABLE(순수 함수).

CREATE OR REPLACE FUNCTION public.compute_syntax_score(p_content text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $function$
  WITH sents AS (
    -- 문장 분할: 종결부호(.!?) + 공백/따옴표. 빈 조각 제외.
    SELECT trim(s) AS s
    FROM regexp_split_to_table(coalesce(p_content, ''), '[.!?]+[\s"]') AS s
    WHERE length(trim(s)) > 2
  ),
  m AS (
    SELECT
      array_length(regexp_split_to_array(s, '\s+'), 1) AS wlen,
      -- 절 깊이 근사: 쉼표·세미콜론 수 + 종속접속사/관계사 매칭 수.
      (length(s) - length(regexp_replace(s, '[,;]', '', 'g')))
      + (SELECT count(*) FROM regexp_matches(lower(s),
           '\y(that|which|who|whom|whose|because|although|though|while|whereas|if|when|since|unless|before|after|as)\y', 'g')) AS clauses
    FROM sents
  )
  SELECT CASE WHEN (SELECT count(*) FROM m) = 0 THEN NULL
  ELSE jsonb_build_object(
    'sent_p90', coalesce((SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY wlen) FROM m), 0)::int,
    'clause_depth_p90', round(coalesce((SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY clauses) FROM m), 0)::numeric, 1),
    -- score 0-100: 문장길이 p90(가중 2) + 절깊이 p90(가중 6). 권장 휴리스틱(베타 보정 대상).
    'score', LEAST(100, GREATEST(0, round(
        coalesce((SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY wlen) FROM m), 0) * 2.0
      + coalesce((SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY clauses) FROM m), 0) * 6.0
    )))::int
  ) END
$function$;

COMMENT ON FUNCTION public.compute_syntax_score(text) IS
  'CTP ① 구문 난이도. 자체 정규식(문장 p90·절 깊이). NULL=텍스트 없음. score 휴리스틱은 베타 보정 대상.';