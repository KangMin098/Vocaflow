-- 20260713160000_resolve_dict_headword.sql
-- 도서/추출 공용 해소 헬퍼 — surface → 사전 표제어.
--   tier: direct → inflected_forms(cluster 불규칙) → en_inflection_bases(규칙 역굴절) → 투명 파생 strip.
--   base 표제어가 실재할 때만 반환 → 규칙 날조 불가(쓰레기 없음). 미해소 시 NULL(=탈락).
--   파생 strip 은 base 길이>=4 + junk('foreign_word_proxy') 제외로 과도 strip(reely→ree) 방지.
CREATE OR REPLACE FUNCTION public.resolve_dict_headword(p_surface text) RETURNS text
LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
  WITH q AS (SELECT lower(trim(p_surface)) AS s)
  SELECT COALESCE(
    (SELECT d.word FROM shared_dictionary d, q WHERE d.word=q.s
       AND d.classified_by IS NOT NULL AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko)>0 LIMIT 1),
    (SELECT d.word FROM shared_dictionary d, q WHERE d.inflected_forms @> ARRAY[q.s]
       AND d.classified_by IS NOT NULL AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko)>0
       ORDER BY d.frequency_rank NULLS LAST LIMIT 1),
    (SELECT d.word FROM q, unnest(en_inflection_bases(q.s)) c(c) JOIN shared_dictionary d ON d.word=c.c
       WHERE d.classified_by IS NOT NULL AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko)>0
       ORDER BY d.frequency_rank NULLS LAST LIMIT 1),
    (SELECT d.word FROM q, unnest(array_remove(ARRAY[
        CASE WHEN q.s ~ 'ically$' THEN regexp_replace(q.s,'ically$','ic') END,
        CASE WHEN q.s ~ 'ily$'  THEN regexp_replace(q.s,'ily$','y') END,
        CASE WHEN q.s ~ 'ly$'   THEN regexp_replace(q.s,'ly$','') END,
        CASE WHEN q.s ~ 'iness$' THEN regexp_replace(q.s,'iness$','y') END,
        CASE WHEN q.s ~ 'ness$' THEN regexp_replace(q.s,'ness$','') END,
        CASE WHEN q.s ~ 'iless$' THEN regexp_replace(q.s,'iless$','y') END,
        CASE WHEN q.s ~ 'less$' THEN regexp_replace(q.s,'less$','') END,
        CASE WHEN q.s ~ 'fully$' THEN regexp_replace(q.s,'fully$','') END,
        CASE WHEN q.s ~ 'ful$'  THEN regexp_replace(q.s,'ful$','') END,
        CASE WHEN q.s ~ 'ish$'  THEN regexp_replace(q.s,'ish$','') END,
        CASE WHEN q.s ~ 'like$' THEN regexp_replace(q.s,'like$','') END,
        CASE WHEN q.s ~ 'wise$' THEN regexp_replace(q.s,'wise$','') END
      ], NULL)) c(cand) JOIN shared_dictionary d ON d.word=c.cand
       WHERE length(c.cand)>=4 AND d.classified_by IS NOT NULL AND d.meaning_ko IS NOT NULL
         AND length(d.meaning_ko)>0 AND d.meaning_ko <> 'foreign_word_proxy'
       ORDER BY d.frequency_rank NULLS LAST LIMIT 1)
  )
$function$;
