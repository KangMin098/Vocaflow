-- supabase/migrations/20260812160000_fix_i10_gate_drop_cap40.sql
--
-- I10 발행세트 SSoT 드리프트 게이트 — 제거된 챕터당 cap 40 을 아직 적용하던 오탐 수정.
--
-- 무엇이 잘못됐나:
--   ADR 0004 에서 "분량은 D7 cap 이 아니라 L2 deliver_chapter_vocab 이 결정" 으로 바뀌며
--   republish_book_word_sets 의 p_cap 기본값이 NULL(무제한)이 됐다. 발행 세트는 무제한으로
--   적재되는데, I10 은 비교 대상(cur)만 `sort_order <= 40` 으로 잘라서 비교했다.
--   → 챕터당 41위 이하 단어가 전부 "드리프트" 로 계산돼 **발행 도서 12권 전부 critical FAIL**.
--
-- 실측(2026-08-12):
--   Pride and Prejudice — 발행 1,794단어 = 현 select 1,794행, 무제한 비교 시 드리프트 0.
--   그런데 게이트는 195 FAIL 을 보고했고, 이는 `sort_order > 40` 행 수(195)와 정확히 일치.
--   전 12권 무제한 재계산: 8권 드리프트 0(순수 오탐), 4권만 실드리프트
--   (Mysterious Affair at Styles 1,449 · A Christmas Carol 623 · Winnie-the-Pooh 305 · Fables 4).
--
-- 왜 위험했나:
--   이 오탐을 믿고 12권을 재발행하면 실제로는 멀쩡한 8권의 발행 단어를 DELETE 후 재INSERT 하게
--   된다(republish_book_word_sets 는 파괴적). "게이트가 빨간색" 이 곧 재발행 트리거이므로,
--   틀린 게이트는 멀쩡한 학습자 데이터를 갈아엎는 지시로 작동한다.
--
-- 변경: 단 한 곳 — book scope I10 의 cur CTE 에서 `WHERE sort_order<=40` 제거.
--       나머지 본문은 기존 정의 그대로(pg_get_functiondef 원문).

CREATE OR REPLACE FUNCTION public.run_content_quality_gates(p_scope text DEFAULT 'global'::text, p_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(pipeline text, invariant text, severity text, fail_count bigint, verdict text, detail jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '60000'
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
    -- ★ 2026-08-12 수정: `WHERE sort_order<=40` 제거.
    --   발행은 cap 없이(republish_book_word_sets p_cap DEFAULT NULL) 적재되므로 비교도 무제한이어야
    --   한다. cap 을 남겨 두면 41위 이하가 전부 드리프트로 계산돼 멀쩡한 도서가 critical FAIL 이 된다.
    cur AS (SELECT chapter_idx ci, word w FROM _gsel),
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
