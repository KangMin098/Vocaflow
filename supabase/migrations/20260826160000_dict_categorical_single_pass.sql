-- 20260826160000_dict_categorical_single_pass.sql
--
-- `dict_categorical_distributions()` — 7회 전체 스캔을 **1회**로.
--
-- ── 왜 (실측 2026-08-26) ────────────────────────────────────────────────
-- 관리자 전수 훑기 도중 dev 서버 로그에 이것이 찍혔다:
--
--     [fetchCategoricalDistributions] RPC failed: canceling statement due to statement timeout
--     GET /admin/vrl 200 in 9166ms
--
-- 화면은 **HTTP 200 으로 떴다.** 그래서 훑기의 어떤 축도 이것을 못 봤다 —
-- 서버 컴포넌트 안에서 RPC 가 죽고 `fetchCategoricalDistributions` 가 `null` 을
-- 돌려주면, 화면은 그냥 **분포가 빈 채로** 정상 렌더된다. 관리자는 "아직 데이터가
-- 없나 보다" 로 읽는다. 브라우저가 보는 요청은 전부 200 이라 네트워크 축도 못 잡는다.
--
-- ── 원인 ────────────────────────────────────────────────────────────────
-- 함수 본문이 `shared_dictionary`(48,962행) 를 **일곱 번 따로** 훑는다.
-- 일곱 집계가 전부 같은 테이블을 GROUP BY 만 달리해서 읽는다.
--
--   EXPLAIN ANALYZE (집계 1개):  Seq Scan … Buffers: shared hit=13926 read=5875
--                                Execution Time: 1206 ms
--   × 7  ≈  8.4 초  →  statement timeout 초과
--
-- ── 고침 ────────────────────────────────────────────────────────────────
-- 필요한 7개 컬럼만 뽑아 `MATERIALIZED` CTE 로 **한 번** 훑고, 일곱 집계는 그
-- 좁은 중간 결과에서 돌린다. 넓은 원본 행(155MB)이 아니라 좁은 temp 를 읽으므로
-- 두 번째 집계부터는 16~19ms 로 끝난다.
--
--   실측:  8.4초(추정, 1.2초 × 7)  →  **1,257 ms**   (약 6.7배)
--   첫 스캔 1,087ms + 나머지 6개 합계 약 106ms
--
-- ⚠️ **결과는 바꾸지 않는다.** 적용 전 같은 DB 에서 대조했다:
--       SELECT <새 본문> = public.dict_categorical_distributions()  →  true
--    집계 순서·키 이름·`pct` 반올림까지 동일하다. 이 마이그레이션은 순수 성능 변경이다.

CREATE OR REPLACE FUNCTION public.dict_categorical_distributions()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result JSONB;
BEGIN
  -- 한 번만 훑는다. 필요한 컬럼만 — 넓은 원본 행을 일곱 번 읽던 것이 병목이었다.
  WITH src AS MATERIALIZED (
    SELECT primary_pos, v_level, v_level_rule_v1, source, cefr_level, frequency_band, verified
    FROM public.shared_dictionary
  )
  SELECT jsonb_build_object(
    'by_primary_pos', (
      SELECT jsonb_object_agg(primary_pos, n)
      FROM (
        SELECT primary_pos, COUNT(*) AS n
        FROM src
        WHERE primary_pos IS NOT NULL
        GROUP BY primary_pos
      ) x
    ),
    'by_v_level', (
      SELECT jsonb_object_agg(v_level::text, n)
      FROM (
        SELECT v_level, COUNT(*) AS n
        FROM src
        WHERE v_level IS NOT NULL
        GROUP BY v_level
      ) x
    ),
    'by_v_level_rule_v1', (
      SELECT jsonb_object_agg(v_level_rule_v1::text, n)
      FROM (
        SELECT v_level_rule_v1, COUNT(*) AS n
        FROM src
        WHERE v_level_rule_v1 IS NOT NULL
        GROUP BY v_level_rule_v1
      ) x
    ),
    'by_source', (
      SELECT jsonb_object_agg(source, n)
      FROM (
        SELECT source, COUNT(*) AS n
        FROM src
        WHERE source IS NOT NULL
        GROUP BY source
      ) x
    ),
    'by_cefr_level', (
      SELECT jsonb_object_agg(cefr_level, n)
      FROM (
        SELECT cefr_level, COUNT(*) AS n
        FROM src
        WHERE cefr_level IS NOT NULL
        GROUP BY cefr_level
      ) x
    ),
    'verified_by_v_level', (
      SELECT jsonb_object_agg(
        v_level::text,
        jsonb_build_object(
          'total', total,
          'verified', verified_count,
          'pct', CASE WHEN total > 0
                      THEN ROUND(100.0 * verified_count / total, 2)
                      ELSE 0 END
        )
      )
      FROM (
        SELECT v_level,
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE verified = true) AS verified_count
        FROM src
        WHERE v_level IS NOT NULL
        GROUP BY v_level
      ) x
    ),
    'by_frequency_band', (
      SELECT jsonb_object_agg(frequency_band, n)
      FROM (
        SELECT frequency_band, COUNT(*) AS n
        FROM src
        WHERE frequency_band IS NOT NULL
        GROUP BY frequency_band
      ) x
    )
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.dict_categorical_distributions() IS
  'shared_dictionary 범주형 분포 7종. 단일 MATERIALIZED CTE 로 한 번만 스캔한다 '
  '(20260826160000 이전에는 7회 전체 스캔 ≈ 8.4초로 statement timeout 을 넘겨 '
  '/admin/vrl 의 분포가 조용히 비어 있었다).';
