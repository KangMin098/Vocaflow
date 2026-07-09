-- CTP P3 (①) — dev-process 배선용 RPC 2종 (compute_*_vrl 패턴 동일)
-- 신규 콘텐츠 처리 시 syntax_score 자동 산출. article=content 컬럼 / book=챕터 content_chunks 집계.
-- ⚠ 승인 후 apply. backfill(기존 published)은 이미 완료(본 함수 없이 compute_syntax_score 직접).

-- article: content 컬럼 직접
CREATE OR REPLACE FUNCTION public.compute_article_syntax(p_article_id uuid)
RETURNS void
LANGUAGE sql
AS $function$
  UPDATE public.library_articles
  SET syntax_score = public.compute_syntax_score(content)
  WHERE id = p_article_id;
$function$;

-- book: 챕터 본문(content_chunks) 집계 후 산출
CREATE OR REPLACE FUNCTION public.compute_book_syntax(p_book_id uuid)
RETURNS void
LANGUAGE sql
AS $function$
  UPDATE public.library_books b
  SET syntax_score = public.compute_syntax_score(agg.txt)
  FROM (
    SELECT lcm.library_book_id, string_agg(cc.content, ' ') AS txt
    FROM public.library_chapters_master lcm
    JOIN public.content_chunks cc ON cc.hash = lcm.content_hash
    WHERE lcm.library_book_id = p_book_id
    GROUP BY lcm.library_book_id
  ) agg
  WHERE b.id = agg.library_book_id;
$function$;

COMMENT ON FUNCTION public.compute_article_syntax(uuid) IS 'CTP ① — ACP dev-process 배선(compute_syntax_score 적용).';
COMMENT ON FUNCTION public.compute_book_syntax(uuid)   IS 'CTP ① — LCP dev-process 배선(챕터 집계 → compute_syntax_score).';