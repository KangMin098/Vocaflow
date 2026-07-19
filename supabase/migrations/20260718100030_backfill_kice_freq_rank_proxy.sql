-- D4a: KICE-core(수능 exam-core) NULL freq_rank → proxy rank 백필.
-- 배경: 이들은 CSAT tier>=3 빈출어인데 빈도 corpus 미랭크(NULL)로 composite 의 0.40 freq 축이 0점
--   → 추출 순위에서 부당하게 밀림(P0 §3, ext_quality_p0_20260718.md). 예: efficiency·innovation·
--   prioritize·distinction·precision — 상당수가 frequency_band='rare' 오라벨.
-- proxy: 밴드→대표 rank = 동일밴드 rank-보유 단어의 실측 중앙값(top1k=587…top25k=23500),
--   rankable 밴드 없으면 KICE-core 실측 rank 중앙값(1986). provenance = frequency_sources.proxy.
-- 범위: KICE-core 273행(밴드 135 + kice-median 138). frequency_rank IS NULL 만 → 기존값 무손실.
-- 되돌리기: frequency_sources->'proxy' 마커로 식별해 frequency_rank=NULL 복원 가능.

WITH kice AS (
  SELECT DISTINCT lower(lemma) w FROM lexicon_frequencies WHERE source_id = 1 AND frequency_tier >= 3
),
tgt AS (
  SELECT sd.word,
    CASE sd.frequency_band
      WHEN 'top1k' THEN 587 WHEN 'top2k' THEN 2089 WHEN 'top3k' THEN 2354 WHEN 'top5k' THEN 4773
      WHEN 'top10k' THEN 9031 WHEN 'top15k' THEN 14500 WHEN 'top20k' THEN 18500 WHEN 'top25k' THEN 23500
      ELSE 1986
    END AS proxy_rank,
    CASE WHEN sd.frequency_band IN ('top1k','top2k','top3k','top5k','top10k','top15k','top20k','top25k')
         THEN 'band_median' ELSE 'kice_median' END AS proxy_src
  FROM shared_dictionary sd
  WHERE lower(sd.word) IN (SELECT w FROM kice) AND sd.frequency_rank IS NULL
)
UPDATE shared_dictionary sd
SET frequency_rank = t.proxy_rank,
    frequency_sources = COALESCE(sd.frequency_sources, '{}'::jsonb)
      || jsonb_build_object('proxy', jsonb_build_object(
           'kind', t.proxy_src, 'rank', t.proxy_rank,
           'basis', 'kice_core_null_rank', 'at', '2026-07-18')),
    updated_at = now()
FROM tgt t
WHERE sd.word = t.word;
