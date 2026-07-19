-- 게이트 성능 최적화 — 자체 테스트가 statement_timeout 검출(앱 supabase 클라이언트 경유).
-- 원인: (1) 전역 I5 가 발행어(~40k)마다 resolve_dict_headword 2회 호출 (2) book/article scope 가
--   select_*_vocab 를 3회 호출. → G3 라이브 게이트도 앱에서 타임아웃 위험.
-- 수정: (1) I5 를 문자열 비교로 등가 경량화(resolve 제거) (2) select 출력 1회 임시테이블 재사용.
--   temp table 위해 VOLATILE 로 전환(논리적으로 read-only · 임시테이블만 생성).

CREATE OR REPLACE FUNCTION public.run_content_quality_gates(
  p_scope text DEFAULT 'global', p_id uuid DEFAULT NULL
) RETURNS TABLE(pipeline text, invariant text, severity text, fail_count bigint, verdict text, detail jsonb)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_noise text[] := ARRAY['archaic_literary','period_cultural','phrase_unit','brand','abbreviation','proper_noun'];
BEGIN
  IF auth.uid() IS NOT NULL AND NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;
  IF p_scope IN ('book','article','word_set') AND p_id IS NULL THEN
    RAISE EXCEPTION '% scope requires p_id', p_scope;
  END IF;

  IF p_scope IN ('global','dict') THEN
    RETURN QUERY SELECT '사전DB','I1 필드완비(classified: meaning/pos/v_level/cefr)','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END,
      jsonb_build_object('rule','classified 표제어 meaning/pos/v_level/cefr 완비')
    FROM shared_dictionary WHERE classified_by IS NOT NULL
      AND (meaning_ko IS NULL OR length(meaning_ko)=0 OR pos IS NULL OR v_level IS NULL OR cefr_level IS NULL);
    RETURN QUERY SELECT '사전DB','I2 다의어 per-sense v_level 결측','warning',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'WARN' END, jsonb_build_object('rule','sense별 v_level')
    FROM shared_dictionary sd WHERE sd.meanings_ko IS NOT NULL AND jsonb_typeof(sd.meanings_ko)='array'
      AND jsonb_array_length(sd.meanings_ko)>=2
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(sd.meanings_ko) s WHERE (s->>'v_level') IS NULL);
  END IF;

  IF p_scope = 'global' THEN
    -- I5 경량화: resolve 대신 문자열 비교(표면이 자체 quality 표제어인데 lemma 가 표면과 다름 = D1 미스바인딩 시그니처)
    RETURN QUERY SELECT '단어추출/VCB','I5 발행세트 바인딩 드리프트(표면≠자체표제어)','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END, jsonb_build_object('rule','전 발행 세트 표면=자체표제어')
    FROM shared_words sw JOIN shared_word_sets sws ON sws.id=sw.set_id
    WHERE sws.is_published
      AND lower(COALESCE(sw.lemma, sw.word)) <> lower(sw.word)
      AND EXISTS (SELECT 1 FROM shared_dictionary x WHERE x.word=lower(sw.word)
                  AND x.classified_by IS NOT NULL AND x.meaning_ko IS NOT NULL AND length(x.meaning_ko)>0);
    RETURN QUERY SELECT '단어추출/VCB','I7 노이즈 register 발행 누출','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END, jsonb_build_object('rule','전 발행 세트 노이즈 0')
    FROM shared_words sw JOIN shared_word_sets sws ON sws.id=sw.set_id JOIN shared_dictionary sd ON sd.word=lower(sw.word)
    WHERE sws.is_published AND sd.word_register = ANY(v_noise);
    RETURN QUERY SELECT 'LCP','I6 발행도서 resolvable NULL lemma','warning',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'WARN' END, jsonb_build_object('rule','사전존재어 lemma')
    FROM library_book_vocabularies bv JOIN library_books lb ON lb.id=bv.library_book_id
    WHERE lb.status='published' AND bv.lemma IS NULL
      AND EXISTS (SELECT 1 FROM shared_dictionary d WHERE d.word=lower(trim(bv.word)) AND d.classified_by IS NOT NULL);
    RETURN QUERY SELECT 'LCP','I8 발행도서 book_v_level 결측','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END, jsonb_build_object('rule','book_v_level')
    FROM library_books WHERE status='published' AND book_v_level IS NULL;
    RETURN QUERY SELECT 'ACP','I9 발행아티클 register 결측','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END, jsonb_build_object('rule','register')
    FROM library_articles WHERE status='published' AND register IS NULL;
    RETURN QUERY SELECT 'ACP','I11 발행아티클 라이선스(copyright_safe) 미확인','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END, jsonb_build_object('rule','copyright_safe_in_kr=true')
    FROM library_articles WHERE status='published' AND copyright_safe_in_kr IS NOT TRUE;
  END IF;

  IF p_scope = 'book' THEN
    DROP TABLE IF EXISTS _gsel;
    CREATE TEMP TABLE _gsel ON COMMIT DROP AS
      SELECT chapter_idx, word, lemma, sort_order FROM select_book_chapter_vocab(p_id);

    RETURN QUERY SELECT 'LCP','I8 book_v_level 결측','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END, jsonb_build_object('book_id',p_id)
    FROM library_books WHERE id=p_id AND book_v_level IS NULL;
    RETURN QUERY SELECT 'LCP','I6 resolvable NULL lemma','warning',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'WARN' END, jsonb_build_object('book_id',p_id)
    FROM library_book_vocabularies bv WHERE bv.library_book_id=p_id AND bv.lemma IS NULL
      AND EXISTS (SELECT 1 FROM shared_dictionary d WHERE d.word=lower(trim(bv.word)) AND d.classified_by IS NOT NULL);
    RETURN QUERY SELECT '단어추출','I7 추출 출력 노이즈 register','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END, jsonb_build_object('note','select 출력 노이즈')
    FROM _gsel v JOIN shared_dictionary sd ON sd.word=v.lemma WHERE sd.word_register = ANY(v_noise);
    RETURN QUERY SELECT '단어추출','추출 비어있음(0단어)','critical',
      CASE WHEN (SELECT count(*) FROM _gsel)=0 THEN 1::bigint ELSE 0::bigint END,
      CASE WHEN (SELECT count(*) FROM _gsel)=0 THEN 'FAIL' ELSE 'PASS' END,
      jsonb_build_object('note','추출 후보 0 = 게시 불가');
    RETURN QUERY
    WITH pub AS (
      SELECT (sws.curation_query->>'chapter_idx')::int ci, lower(sw.word) w
      FROM shared_word_sets sws JOIN shared_words sw ON sw.set_id=sws.id
      WHERE sws.category='library_book' AND sws.is_published AND (sws.curation_query->>'book_id')=p_id::text
    ),
    cur AS (SELECT chapter_idx ci, word w FROM _gsel WHERE sort_order<=40),
    drift AS (SELECT count(*) n FROM ((SELECT ci,w FROM pub EXCEPT SELECT ci,w FROM cur)
                                      UNION ALL (SELECT ci,w FROM cur EXCEPT SELECT ci,w FROM pub)) d)
    SELECT 'LCP','I10 발행세트 SSoT 드리프트(vs 현 select)','critical',
      CASE WHEN NOT EXISTS(SELECT 1 FROM pub) THEN 0::bigint ELSE (SELECT n FROM drift) END,
      CASE WHEN NOT EXISTS(SELECT 1 FROM pub) THEN 'PASS'
           WHEN (SELECT n FROM drift)=0 THEN 'PASS' ELSE 'FAIL' END,
      jsonb_build_object('note','미발행=N/A · 드리프트>0=재발행 필요');
    DROP TABLE IF EXISTS _gsel;
  END IF;

  IF p_scope = 'article' THEN
    DROP TABLE IF EXISTS _asel;
    CREATE TEMP TABLE _asel ON COMMIT DROP AS
      SELECT word, lemma, sort_order FROM select_article_vocab(p_id);

    RETURN QUERY SELECT 'ACP','I9 register 결측','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END, jsonb_build_object('article_id',p_id)
    FROM library_articles WHERE id=p_id AND register IS NULL;
    RETURN QUERY SELECT 'ACP','I11 라이선스(copyright_safe) 미확인','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END, jsonb_build_object('article_id',p_id)
    FROM library_articles WHERE id=p_id AND copyright_safe_in_kr IS NOT TRUE;
    RETURN QUERY SELECT '단어추출','I7 추출 출력 노이즈 register','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END, jsonb_build_object('article_id',p_id)
    FROM _asel v JOIN shared_dictionary sd ON sd.word=v.lemma WHERE sd.word_register = ANY(v_noise);
    RETURN QUERY SELECT '단어추출','추출 비어있음(0단어)','critical',
      CASE WHEN (SELECT count(*) FROM _asel)=0 THEN 1::bigint ELSE 0::bigint END,
      CASE WHEN (SELECT count(*) FROM _asel)=0 THEN 'FAIL' ELSE 'PASS' END,
      jsonb_build_object('note','추출 후보 0 = 게시 불가');
    DROP TABLE IF EXISTS _asel;
  END IF;

  IF p_scope = 'word_set' THEN
    RETURN QUERY SELECT 'VCB','I5 바인딩 드리프트(표면≠자체표제어)','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END, jsonb_build_object('set_id',p_id)
    FROM shared_words sw
    WHERE sw.set_id=p_id
      AND lower(COALESCE(sw.lemma, sw.word)) <> lower(sw.word)
      AND EXISTS (SELECT 1 FROM shared_dictionary x WHERE x.word=lower(sw.word)
                  AND x.classified_by IS NOT NULL AND x.meaning_ko IS NOT NULL AND length(x.meaning_ko)>0);
    RETURN QUERY SELECT 'VCB','I7 노이즈 register','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END, jsonb_build_object('set_id',p_id)
    FROM shared_words sw JOIN shared_dictionary sd ON sd.word=lower(sw.word)
    WHERE sw.set_id=p_id AND sd.word_register = ANY(v_noise);
    RETURN QUERY SELECT 'VCB','뜻(meaning_ko) 결측','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END, jsonb_build_object('set_id',p_id)
    FROM shared_words sw WHERE sw.set_id=p_id AND (sw.meaning_ko IS NULL OR length(sw.meaning_ko)=0);
    RETURN QUERY SELECT 'VCB','세트 비어있음(0단어)','critical',
      CASE WHEN (SELECT count(*) FROM shared_words WHERE set_id=p_id)=0 THEN 1::bigint ELSE 0::bigint END,
      CASE WHEN (SELECT count(*) FROM shared_words WHERE set_id=p_id)=0 THEN 'FAIL' ELSE 'PASS' END,
      jsonb_build_object('set_id',p_id);
  END IF;
END;
$function$;

-- run_content_quality_gates 가 VOLATILE(temp table) 이 됐으므로 호출자도 VOLATILE 로.
CREATE OR REPLACE FUNCTION public.content_gate_publishable(p_scope text, p_id uuid)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM run_content_quality_gates(p_scope, p_id) g
    WHERE g.severity='critical' AND g.verdict='FAIL' AND g.invariant NOT LIKE 'I10%'
  );
END;
$function$;
