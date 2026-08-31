-- 20260831100000_textbook_curriculum_vocab_materialized.sql
--
-- **서가의 마지막 실시간 집계를 없앤다** — 초등 계단이 부하 때마다 사라지던 자리.
--
-- ── 증상 ────────────────────────────────────────────────────────────────
-- `20260831090000` 으로 재고·출처 집계는 미리 계산해 뒀는데, **교육과정 어휘 집계 하나가
-- 남아 있었다.** 동시 드레인이 도는 동안 이것이 3초 타임아웃을 넘겼고, 그때마다
-- `elementaryMeasured=false` 가 되어 **초등 계단 3권이 '재고 확인 중'** 으로 바뀌었다
-- (실측 2026-08-31: 부하 시 3,531ms/3,243ms 타임아웃 → 7권 중 3권 소실).
--
-- ── 원인은 쿼리가 아니다 ────────────────────────────────────────────────
-- 쿼리 자체는 GIN 인덱스를 제대로 타고 **17.6ms** 다(캐시 상태). 문제는 그 뒤다:
--   Bitmap Heap Scan · Heap Blocks: exact=2679  ← 155MB 표에서 2,679블록(~21MB) 랜덤 읽기
-- 캐시가 식은 상태에서 드레인의 쓰기 부하와 겹치면 이 읽기가 초 단위로 늘어난다.
-- 즉 **인덱스를 더 얹어도 안 고쳐진다** — 공개 요청 경로가 155MB 표를 건드리는 것 자체가 문제다.
--
-- ── 고치는 법 ───────────────────────────────────────────────────────────
-- 결과는 **3행**이고, 교육과정 어휘 목록이 바뀔 때만 변한다(그런 일은 드물다).
-- `20260831090000` 이 만든 갱신 주기에 얹는다 — 같은 함수, 같은 5분 cron.
--
-- ⚠️ 값이 낡을 수 있다는 성질은 그대로다. 서가는 이미 갱신 시각을 읽을 수 있으므로
--    (`textbook_shelf_refreshed_at`) 낡은 값을 지금 값인 척하지 않는다.
--
-- 되돌리기: 함수 본문에서 세 번째 REFRESH 를 빼고, RPC 를 원래 쿼리로 되돌린 뒤
--           DROP MATERIALIZED VIEW. 사전 표는 건드리지 않는다.

CREATE MATERIALIZED VIEW public.textbook_curriculum_vocab_mv AS
SELECT t.tag  AS list_tag,
       count(*) AS word_count
  FROM public.shared_dictionary d
  CROSS JOIN LATERAL unnest(d.list_tags) AS t(tag)
 -- GIN(idx_dict_list_tags) 을 켜는 줄. 아래 IN 과 둘 다 있어야 한다(원본 함수와 동일).
 WHERE d.list_tags && ARRAY['kcurr2022_1', 'kcurr2022_2', 'kcurr2022_0']
   AND t.tag IN ('kcurr2022_1', 'kcurr2022_2', 'kcurr2022_0')
 GROUP BY t.tag;

-- CONCURRENTLY 갱신에 필요하다.
CREATE UNIQUE INDEX textbook_curriculum_vocab_mv_pk
  ON public.textbook_curriculum_vocab_mv (list_tag);

-- 읽기 RPC 를 집계표로 갈아끼운다. 시그니처는 그대로라 호출부 변경이 없다.
CREATE OR REPLACE FUNCTION public.textbook_curriculum_vocab_counts()
RETURNS TABLE(list_tag text, word_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT list_tag, word_count FROM public.textbook_curriculum_vocab_mv;
$$;

-- 같은 갱신 주기에 얹는다 — 갱신 자리를 두 군데로 나누지 않는다.
CREATE OR REPLACE FUNCTION public.refresh_textbook_shelf_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.textbook_shelf_inventory_mv;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.textbook_shelf_sources_mv;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.textbook_curriculum_vocab_mv;
  UPDATE public.textbook_shelf_stats_meta SET refreshed_at = now() WHERE id;
END;
$$;

REVOKE ALL ON public.textbook_curriculum_vocab_mv FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.textbook_curriculum_vocab_counts() TO anon, authenticated;
