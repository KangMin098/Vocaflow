-- docs/AI_CONTEXT/rollback/20260923232916_article_word_set_require_vocab-rollback.sql
--
-- 20260923232916_article_word_set_require_vocab 를 되돌린다 — 가드 도입 직전(2026-09-24)
-- DB 의 `pg_get_functiondef` 원문 그대로다. 재실행 안전(CREATE OR REPLACE 만).
-- 되돌려도 어휘 행이 없는 글의 발행은 여전히 막힌다 — 1차 방어선은 `content_gate_publishable` 의
-- critical 「추출 비어있음(0단어)」다. 되돌리면 그 게이트 항목이 완화될 때의 이중 장치만 사라진다.

CREATE OR REPLACE FUNCTION public.publish_article_word_set(p_article_id uuid, p_cap integer DEFAULT 40)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_art RECORD;
  v_set_id uuid;
  v_count int;
BEGIN
  SELECT id, title, cefr_level, source INTO v_art
  FROM library_articles WHERE id = p_article_id;
  IF v_art IS NULL THEN RAISE EXCEPTION 'Article % not found', p_article_id; END IF;

  IF NOT content_gate_publishable('article', p_article_id) THEN
    RAISE EXCEPTION 'Article % 콘텐츠 품질 게이트 FAIL — 게시 차단', p_article_id;
  END IF;

  SELECT id INTO v_set_id FROM shared_word_sets
   WHERE category = 'library_article'
     AND (curation_query->>'article_id') = p_article_id::text;
  IF v_set_id IS NOT NULL THEN RETURN v_set_id; END IF;

  INSERT INTO shared_word_sets (
    title, description, category, cefr_level, is_published, auto_curated,
    slug, cover_emoji, version, curation_query
  ) VALUES (
    v_art.title,
    '스크립트 핵심 어휘 — ' || COALESCE(v_art.source, 'article'),
    'library_article', v_art.cefr_level, true, true,
    'article-' || v_art.id::text,
    '📄', 1,
    jsonb_build_object(
      'article_id', v_art.id,
      'filter', 'select_article_vocab',
      'cap', p_cap,
      'selection', 'v06.79 learning-optimal (P1+P2+P3: floor=V6, composite=4-axis, cap)'
    )
  ) RETURNING id INTO v_set_id;

  INSERT INTO shared_words (
    set_id, word, lemma, meaning_ko, cefr_level, sort_order,
    source_sentence, part_of_speech, example_en
  )
  SELECT v_set_id, s.word, s.lemma, s.meaning_ko, s.cefr_level, s.sort_order,
         s.first_sentence, s.pos, s.example_en
  FROM select_article_vocab(p_article_id) s
  WHERE s.sort_order <= p_cap
  ORDER BY s.sort_order;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE shared_word_sets SET word_count = v_count WHERE id = v_set_id;

  RETURN v_set_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.republish_article_word_set(p_article_id uuid, p_cap integer DEFAULT 40)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
