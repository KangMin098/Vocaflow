-- G2 + 재발행 인프라: SSoT 재동기(set_id 보존) + 게시 게이트 헬퍼 + I10 false-fail 수정.
-- 근거: 도서 게이트가 P&P I10 드리프트 770 검출 — D1/D4a 개선이 발행 세트에 미반영(stale).

-- ── (1) run_content_quality_gates I10 수정: 미발행 도서 false-fail 제거 ──
-- pub 세트가 없으면(미발행) 드리프트 N/A → PASS. (기존은 |cur| 을 전부 드리프트로 오판)
CREATE OR REPLACE FUNCTION public.run_content_quality_gates(
  p_scope text DEFAULT 'global', p_id uuid DEFAULT NULL
) RETURNS TABLE(pipeline text, invariant text, severity text, fail_count bigint, verdict text, detail jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_noise text[] := ARRAY['archaic_literary','period_cultural','phrase_unit','brand','abbreviation','proper_noun'];
BEGIN
  IF auth.uid() IS NOT NULL AND NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;
  IF p_scope IN ('book','article') AND p_id IS NULL THEN
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
    RETURN QUERY SELECT '단어추출','I5 발행세트 바인딩 드리프트(표면≠자체표제어)','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END, jsonb_build_object('rule','표면=자체표제어 바인딩')
    FROM shared_words sw JOIN shared_word_sets sws ON sws.id=sw.set_id
    WHERE sws.is_published AND sws.category IN ('library_book','library_article')
      AND EXISTS (SELECT 1 FROM shared_dictionary x WHERE x.word=lower(sw.word)
                  AND x.classified_by IS NOT NULL AND x.meaning_ko IS NOT NULL AND length(x.meaning_ko)>0)
      AND resolve_dict_headword(lower(sw.word)) <> resolve_dict_headword(COALESCE(sw.lemma, sw.word));
    RETURN QUERY SELECT '단어추출','I7 노이즈 register 발행 누출','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END, jsonb_build_object('rule','노이즈 register 0')
    FROM shared_words sw JOIN shared_word_sets sws ON sws.id=sw.set_id JOIN shared_dictionary sd ON sd.word=lower(sw.word)
    WHERE sws.is_published AND sws.category IN ('library_book','library_article') AND sd.word_register = ANY(v_noise);
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
  END IF;

  IF p_scope = 'book' THEN
    RETURN QUERY SELECT 'LCP','I8 book_v_level 결측','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END, jsonb_build_object('book_id',p_id)
    FROM library_books WHERE id=p_id AND book_v_level IS NULL;
    RETURN QUERY SELECT 'LCP','I6 resolvable NULL lemma','warning',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'WARN' END, jsonb_build_object('book_id',p_id)
    FROM library_book_vocabularies bv WHERE bv.library_book_id=p_id AND bv.lemma IS NULL
      AND EXISTS (SELECT 1 FROM shared_dictionary d WHERE d.word=lower(trim(bv.word)) AND d.classified_by IS NOT NULL);
    RETURN QUERY SELECT '단어추출','I7 추출 출력 노이즈 register','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END, jsonb_build_object('note','select 출력 노이즈')
    FROM select_book_chapter_vocab(p_id) v JOIN shared_dictionary sd ON sd.word=v.lemma WHERE sd.word_register = ANY(v_noise);
    RETURN QUERY SELECT '단어추출','추출 비어있음(0단어)','critical',
      CASE WHEN (SELECT count(*) FROM select_book_chapter_vocab(p_id))=0 THEN 1::bigint ELSE 0::bigint END,
      CASE WHEN (SELECT count(*) FROM select_book_chapter_vocab(p_id))=0 THEN 'FAIL' ELSE 'PASS' END,
      jsonb_build_object('note','추출 후보 0 = 게시 불가');
    RETURN QUERY
    WITH pub AS (
      SELECT (sws.curation_query->>'chapter_idx')::int ci, lower(sw.word) w
      FROM shared_word_sets sws JOIN shared_words sw ON sw.set_id=sws.id
      WHERE sws.category='library_book' AND sws.is_published AND (sws.curation_query->>'book_id')=p_id::text
    ),
    cur AS (SELECT chapter_idx ci, word w FROM select_book_chapter_vocab(p_id) WHERE sort_order<=40),
    drift AS (SELECT count(*) n FROM ((SELECT ci,w FROM pub EXCEPT SELECT ci,w FROM cur)
                                      UNION ALL (SELECT ci,w FROM cur EXCEPT SELECT ci,w FROM pub)) d)
    SELECT 'LCP','I10 발행세트 SSoT 드리프트(vs 현 select)','critical',
      CASE WHEN NOT EXISTS(SELECT 1 FROM pub) THEN 0::bigint ELSE (SELECT n FROM drift) END,
      CASE WHEN NOT EXISTS(SELECT 1 FROM pub) THEN 'PASS'
           WHEN (SELECT n FROM drift)=0 THEN 'PASS' ELSE 'FAIL' END,
      jsonb_build_object('note','미발행=N/A · 드리프트>0=재발행 필요');
  END IF;

  IF p_scope = 'article' THEN
    RETURN QUERY SELECT 'ACP','I9 register 결측','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END, jsonb_build_object('article_id',p_id)
    FROM library_articles WHERE id=p_id AND register IS NULL;
    RETURN QUERY SELECT '단어추출','I7 추출 출력 노이즈 register','critical',
      count(*), CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL' END, jsonb_build_object('article_id',p_id)
    FROM select_article_vocab(p_id) v JOIN shared_dictionary sd ON sd.word=v.lemma WHERE sd.word_register = ANY(v_noise);
    RETURN QUERY SELECT '단어추출','추출 비어있음(0단어)','critical',
      CASE WHEN (SELECT count(*) FROM select_article_vocab(p_id))=0 THEN 1::bigint ELSE 0::bigint END,
      CASE WHEN (SELECT count(*) FROM select_article_vocab(p_id))=0 THEN 'FAIL' ELSE 'PASS' END,
      jsonb_build_object('note','추출 후보 0 = 게시 불가');
  END IF;
END;
$function$;

-- ── (2) 게시 게이트 헬퍼: pre-publish critical FAIL 있으면 false (I10 드리프트 제외 — 발행이 해소) ──
CREATE OR REPLACE FUNCTION public.content_gate_publishable(p_scope text, p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT NOT EXISTS (
    SELECT 1 FROM run_content_quality_gates(p_scope, p_id) g
    WHERE g.severity='critical' AND g.verdict='FAIL' AND g.invariant NOT LIKE 'I10%'
  );
$function$;

-- ── (3) 재발행: set_id 보존하고 shared_words 만 현 select 로 교체 (구독/진행 참조 안전) ──
CREATE OR REPLACE FUNCTION public.republish_book_word_sets(p_book_id uuid, p_cap integer DEFAULT 40)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_sets int;
BEGIN
  IF NOT content_gate_publishable('book', p_book_id) THEN
    RAISE EXCEPTION 'book % 게이트 FAIL — 재발행 차단', p_book_id;
  END IF;
  DELETE FROM shared_words sw USING shared_word_sets sws
   WHERE sw.set_id=sws.id AND sws.category='library_book' AND sws.is_published
     AND (sws.curation_query->>'book_id')=p_book_id::text;
  INSERT INTO shared_words (set_id, word, lemma, meaning_ko, cefr_level, sort_order, library_book_vocabulary_id, source_sentence)
  SELECT sws.id, s.word, s.lemma, s.meaning_ko, s.cefr_level, s.sort_order, s.library_book_vocabulary_id, s.first_sentence
  FROM shared_word_sets sws
  JOIN select_book_chapter_vocab(p_book_id) s ON s.chapter_idx=(sws.curation_query->>'chapter_idx')::int
  WHERE sws.category='library_book' AND sws.is_published AND (sws.curation_query->>'book_id')=p_book_id::text
    AND s.sort_order <= p_cap;
  UPDATE shared_word_sets sws SET word_count=(SELECT count(*) FROM shared_words w WHERE w.set_id=sws.id)
   WHERE sws.category='library_book' AND sws.is_published AND (sws.curation_query->>'book_id')=p_book_id::text;
  GET DIAGNOSTICS v_sets = ROW_COUNT;
  RETURN v_sets;
END;
$function$;

CREATE OR REPLACE FUNCTION public.republish_article_word_set(p_article_id uuid, p_cap integer DEFAULT 40)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_n int;
BEGIN
  IF NOT content_gate_publishable('article', p_article_id) THEN
    RAISE EXCEPTION 'article % 게이트 FAIL — 재발행 차단', p_article_id;
  END IF;
  DELETE FROM shared_words sw USING shared_word_sets sws
   WHERE sw.set_id=sws.id AND sws.category='library_article' AND sws.is_published
     AND (sws.curation_query->>'article_id')=p_article_id::text;
  INSERT INTO shared_words (set_id, word, lemma, meaning_ko, cefr_level, sort_order, source_sentence, part_of_speech, example_en)
  SELECT sws.id, s.word, s.lemma, s.meaning_ko, s.cefr_level, s.sort_order, s.first_sentence, s.pos, s.example_en
  FROM shared_word_sets sws
  JOIN select_article_vocab(p_article_id) s ON true
  WHERE sws.category='library_article' AND sws.is_published AND (sws.curation_query->>'article_id')=p_article_id::text
    AND s.sort_order <= p_cap;
  UPDATE shared_word_sets sws SET word_count=(SELECT count(*) FROM shared_words w WHERE w.set_id=sws.id)
   WHERE sws.category='library_article' AND sws.is_published AND (sws.curation_query->>'article_id')=p_article_id::text;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.content_gate_publishable(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.content_gate_publishable(text, uuid) TO authenticated, service_role;
