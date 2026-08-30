-- 20260830150000_textbook_vocab_counts_use_gin.sql
--
-- `textbook_curriculum_vocab_counts()` 가 shared_dictionary(231MB)를 **전량 스캔**하고 있었다.
--
-- ── 왜 인덱스가 안 먹었나 (실측 2026-08-30) ────────────────────────────
-- `list_tags` 에는 이미 GIN 인덱스가 있다(`idx_dict_list_tags`). 그런데 기존 본문은
-- 배열을 먼저 `unnest` 해서 **펼쳐진 값**에 조건을 걸었다:
--
--     CROSS JOIN LATERAL unnest(d.list_tags) AS t(tag)  WHERE t.tag IN (...)
--
-- 이 형태로는 플래너가 인덱스를 쓸 방법이 없다 — 조건이 걸린 `t.tag` 는 테이블의 열이
-- 아니라 함수 출력이다. 그래서 48,969행을 전부 읽고 나서 걸렀다.
--
-- 배열 자체에 겹침 연산자(`&&`)를 **먼저** 걸면 GIN 이 후보를 3,025행으로 줄이고,
-- unnest 는 그 뒤에 돈다. 두 조건이 함께 있어야 한다 — `&&` 는 "이 태그 중 하나라도
-- 가진 행" 을 고르는 것이지 **다른 태그를 떨어뜨리지는 않기** 때문이다.
--
-- ── 실측 ───────────────────────────────────────────────────────────────
--   전: Execution Time 2,092.897 ms  (Seq Scan · shared hit=10144 read=10587)
--   후: Execution Time    41.463 ms  (Bitmap Index Scan on idx_dict_list_tags)
--   반환값 동일 — 3행(kcurr2022_0/1/2), 같은 개수.
--
-- 이 함수는 **공개 카탈로그**(`/library/textbooks`)가 요청마다 부른다. 그래서 이 2초는
-- 화면 하나가 느린 문제가 아니라, 트래픽이 붙는 순간 DB 가 먼저 무너지는 형태였다.
--
-- 되돌리기: 이전 본문(WHERE 절의 `d.list_tags && ...` 한 줄만 뺀 것)으로 다시 REPLACE.
-- 표·데이터·시그니처는 건드리지 않는다.

CREATE OR REPLACE FUNCTION public.textbook_curriculum_vocab_counts()
 RETURNS TABLE(list_tag text, word_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT t.tag AS list_tag, count(*) AS word_count
    FROM shared_dictionary d
    CROSS JOIN LATERAL unnest(d.list_tags) AS t(tag)
   -- GIN(idx_dict_list_tags) 을 켜는 줄. 아래 IN 과 **둘 다** 있어야 한다.
   WHERE d.list_tags && ARRAY['kcurr2022_1', 'kcurr2022_2', 'kcurr2022_0']
     AND t.tag IN ('kcurr2022_1', 'kcurr2022_2', 'kcurr2022_0')
   GROUP BY t.tag;
$function$;
