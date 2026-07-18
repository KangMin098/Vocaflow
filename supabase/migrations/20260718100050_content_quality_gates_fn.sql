-- G1: 콘텐츠 품질 게이트 함수 — 결정론 불변식 카탈로그를 codify.
-- 목적: 학습자에게 나갈 산출물이 "맞는 단어·맞는 뜻·맞는 레벨·부속완비"로 정확히 뽑혔는가를
--   기계로 검증. 실패=사전DB/파이프라인 수정 신호. 관리자 게시 신뢰 게이트.
-- 범위: 'global'(플랫폼 전체) | 'book'(도서 게시전) | 'article'(아티클 게시전) | 'dict'(사전만).
-- 근거: docs/AI_CONTEXT/diagnostics/ext_quality_p0_20260718.md · F 마이그레이션 발견 결함.
-- verdict: PASS/FAIL(critical) / WARN(warning). severity=critical 은 게시 차단 후보.

CREATE OR REPLACE FUNCTION public.run_content_quality_gates(
  p_scope text DEFAULT 'global',
  p_id uuid DEFAULT NULL
) RETURNS TABLE(pipeline text, invariant text, severity text, fail_count bigint, verdict text, detail jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_noise text[] := ARRAY['archaic_literary','period_cultural','phrase_unit','brand','abbreviation','proper_noun'];
BEGIN
  -- 비-admin authenticated 차단 (cron/service = auth.uid NULL → 통과)
  IF auth.uid() IS NOT NULL AND NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;
  IF p_scope IN ('book','article') AND p_id IS NULL THEN
    RAISE EXCEPTION '% scope requires p_id', p_scope;
  END IF;

  -- ═══════════ 사전DB (global/dict) ═══════════
  IF p_scope IN ('global','dict') THEN
    RETURN QUERY
    SELECT '사전DB','I1 필드완비(classified: meaning/pos/v_level/cefr)','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END,
      jsonb_build_object('rule','classified 표제어는 meaning_ko/pos/v_level/cefr_level 완비')
    FROM shared_dictionary
    WHERE classified_by IS NOT NULL
      AND (meaning_ko IS NULL OR length(meaning_ko)=0 OR pos IS NULL OR v_level IS NULL OR cefr_level IS NULL);

    RETURN QUERY
    SELECT '사전DB','I2 다의어 per-sense v_level 결측','warning',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'WARN' END,
      jsonb_build_object('rule','meanings_ko 각 sense 는 v_level 보유(다의어)')
    FROM shared_dictionary sd
    WHERE sd.meanings_ko IS NOT NULL AND jsonb_typeof(sd.meanings_ko)='array'
      AND jsonb_array_length(sd.meanings_ko) >= 2
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(sd.meanings_ko) s WHERE (s->>'v_level') IS NULL);
  END IF;

  -- ═══════════ 단어추출 · LCP · ACP (global) ═══════════
  IF p_scope = 'global' THEN
    -- I5 발행 세트 바인딩 드리프트 (표면이 자체 표제어인데 타 표제어로 발행)
    RETURN QUERY
    SELECT '단어추출','I5 발행세트 바인딩 드리프트(표면≠자체표제어)','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END,
      jsonb_build_object('rule','발행 단어의 lemma 는 표면형이 자체 quality 표제어면 그것이어야')
    FROM shared_words sw JOIN shared_word_sets sws ON sws.id=sw.set_id
    WHERE sws.is_published AND sws.category IN ('library_book','library_article')
      AND EXISTS (SELECT 1 FROM shared_dictionary x WHERE x.word=lower(sw.word)
                  AND x.classified_by IS NOT NULL AND x.meaning_ko IS NOT NULL AND length(x.meaning_ko)>0)
      AND resolve_dict_headword(lower(sw.word)) <> resolve_dict_headword(COALESCE(sw.lemma, sw.word));

    -- I7 노이즈 register 발행 누출
    RETURN QUERY
    SELECT '단어추출','I7 노이즈 register 발행 누출','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END,
      jsonb_build_object('rule','발행 세트에 archaic/abbreviation/phrase 등 노이즈 register 0')
    FROM shared_words sw JOIN shared_word_sets sws ON sws.id=sw.set_id
      JOIN shared_dictionary sd ON sd.word=lower(sw.word)
    WHERE sws.is_published AND sws.category IN ('library_book','library_article')
      AND sd.word_register = ANY(v_noise);

    -- I6 resolvable NULL lemma (발행도서) — 사전에 있는데 lemma 빈 것만 (정련)
    RETURN QUERY
    SELECT 'LCP','I6 발행도서 resolvable NULL lemma','warning',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'WARN' END,
      jsonb_build_object('rule','사전 존재어의 lemma 는 채워져야(비-사전어 NULL 은 정상)')
    FROM library_book_vocabularies bv JOIN library_books lb ON lb.id=bv.library_book_id
    WHERE lb.status='published' AND bv.lemma IS NULL
      AND EXISTS (SELECT 1 FROM shared_dictionary d WHERE d.word=lower(trim(bv.word)) AND d.classified_by IS NOT NULL);

    -- I8 발행도서 book_v_level 결측
    RETURN QUERY
    SELECT 'LCP','I8 발행도서 book_v_level 결측','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END,
      jsonb_build_object('rule','발행 도서는 book_v_level 보유(추출 임계 필수)')
    FROM library_books WHERE status='published' AND book_v_level IS NULL;

    -- I9 발행아티클 register 결측
    RETURN QUERY
    SELECT 'ACP','I9 발행아티클 register 결측','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END,
      jsonb_build_object('rule','발행 아티클은 register 보유(Goodhart 밴드 기준)')
    FROM library_articles WHERE status='published' AND register IS NULL;
  END IF;

  -- ═══════════ book scope (게시 전 도서) ═══════════
  IF p_scope = 'book' THEN
    RETURN QUERY
    SELECT 'LCP','I8 book_v_level 결측','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END,
      jsonb_build_object('book_id',p_id)
    FROM library_books WHERE id=p_id AND book_v_level IS NULL;

    RETURN QUERY
    SELECT 'LCP','I6 resolvable NULL lemma','warning',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'WARN' END,
      jsonb_build_object('book_id',p_id)
    FROM library_book_vocabularies bv
    WHERE bv.library_book_id=p_id AND bv.lemma IS NULL
      AND EXISTS (SELECT 1 FROM shared_dictionary d WHERE d.word=lower(trim(bv.word)) AND d.classified_by IS NOT NULL);

    RETURN QUERY
    SELECT '단어추출','I7 추출 출력 노이즈 register','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END,
      jsonb_build_object('note','select_book_chapter_vocab 출력에 노이즈 register 존재(로직 결함시)')
    FROM select_book_chapter_vocab(p_id) v JOIN shared_dictionary sd ON sd.word=v.lemma
    WHERE sd.word_register = ANY(v_noise);

    RETURN QUERY
    SELECT '단어추출','추출 비어있음(0단어)','critical',
      CASE WHEN (SELECT count(*) FROM select_book_chapter_vocab(p_id))=0 THEN 1::bigint ELSE 0::bigint END,
      CASE WHEN (SELECT count(*) FROM select_book_chapter_vocab(p_id))=0 THEN 'FAIL' ELSE 'PASS' END,
      jsonb_build_object('note','추출 후보 0 = 게시 불가');

    -- I10 SSoT parity: 발행 세트 == 현 select top-cap (드리프트=stale)
    RETURN QUERY
    WITH pub AS (
      SELECT (sws.curation_query->>'chapter_idx')::int ci, lower(sw.word) w
      FROM shared_word_sets sws JOIN shared_words sw ON sw.set_id=sws.id
      WHERE sws.category='library_book' AND sws.is_published AND (sws.curation_query->>'book_id')=p_id::text
    ),
    cur AS (SELECT chapter_idx ci, word w FROM select_book_chapter_vocab(p_id) WHERE sort_order<=40),
    drift AS (
      SELECT count(*) n FROM (
        (SELECT ci,w FROM pub EXCEPT SELECT ci,w FROM cur)
        UNION ALL
        (SELECT ci,w FROM cur EXCEPT SELECT ci,w FROM pub)
      ) d
    )
    SELECT 'LCP','I10 발행세트 SSoT 드리프트(vs 현 select)','critical',
      (SELECT n FROM drift), CASE WHEN (SELECT n FROM drift)=0 THEN 'PASS' ELSE 'FAIL' END,
      jsonb_build_object('note','발행 세트가 현 추출 로직과 불일치 = 재발행 필요');
  END IF;

  -- ═══════════ article scope (게시 전 아티클) ═══════════
  IF p_scope = 'article' THEN
    RETURN QUERY
    SELECT 'ACP','I9 register 결측','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END, jsonb_build_object('article_id',p_id)
    FROM library_articles WHERE id=p_id AND register IS NULL;

    RETURN QUERY
    SELECT '단어추출','I7 추출 출력 노이즈 register','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END, jsonb_build_object('article_id',p_id)
    FROM select_article_vocab(p_id) v JOIN shared_dictionary sd ON sd.word=v.lemma
    WHERE sd.word_register = ANY(v_noise);

    RETURN QUERY
    SELECT '단어추출','추출 비어있음(0단어)','critical',
      CASE WHEN (SELECT count(*) FROM select_article_vocab(p_id))=0 THEN 1::bigint ELSE 0::bigint END,
      CASE WHEN (SELECT count(*) FROM select_article_vocab(p_id))=0 THEN 'FAIL' ELSE 'PASS' END,
      jsonb_build_object('note','추출 후보 0 = 게시 불가');
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.run_content_quality_gates(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_content_quality_gates(text, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.run_content_quality_gates(text, uuid) IS
  '콘텐츠 품질 게이트 — 추출/사전/LCP/ACP 결정론 불변식. scope global|book|article|dict. critical FAIL=게시 차단 후보.';
