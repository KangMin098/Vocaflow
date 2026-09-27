-- supabase/migrations/20260923232916_article_word_set_require_vocab.sql
--
-- **글 단어장을 어휘 행 없이 만들거나 비우지 못하게 막는 이중 장치.**
--
-- ── 왜 (docs/reports/lav-retention-2026-09-24.md §3) ─────────────────────
-- `library_article_vocabularies` 의 98.6%(ready 글 몫)를 걷어내는 계획(리포트 §4)의 1단계로,
-- 「행이 없는 글을 발행하면 빈 단어장이 조용히 공개된다」고 보고 넣었다.
--
-- ⚠️ **적용 후 실측으로 그 전제가 틀렸음을 확인했다(2026-09-24).** 두 함수 모두 첫 줄에서 부르는
--    `content_gate_publishable` → `run_content_quality_gates` 의 critical 항목 「추출 비어있음(0단어)」이
--    `select_article_vocab` 출력 0 이면 FAIL 을 내어 **이미 막고 있었다**(롤백 DO 블록으로 확인).
--    그래서 이 가드는 게이트 뒤에 있어 지금은 도달하지 않는다. 그 게이트 항목이 완화·제외될 때
--    (I10 처럼 게시 차단에서 빠지는 선례가 있다) 빈 단어장 공개·기존 단어장 비움을 막는 이중 장치로 남긴다.
--
--   publish_article_word_set   가드 없이 게이트까지 빠지면 `is_published = true` · `word_count = 0` 세트를 만들고,
--                              세트가 한 번 생기면 `RETURN v_set_id` 로 다시 만들지 않는다.
--   republish_article_word_set 기존 단어를 **먼저 지우고** 다시 넣는다 → 공개된 단어장이 비워진다.
--
-- ── 무엇을 바꾸나 ────────────────────────────────────────────────────
-- 두 함수의 본문은 2026-09-24 DB 의 `pg_get_functiondef` 그대로이고, **가드 블록 하나씩만** 더했다.
--   · publish   : 기존 세트 확인 **뒤**, INSERT **앞** — 이미 발행된 글의 재호출은 그대로 통과한다.
--   · republish : 게이트 확인 뒤, DELETE **앞** — 지우기 전에 멈춘다.
-- 가드는 「행이 하나라도 있는가」만 본다. `select_article_vocab` 가 걸러서 0개를 내는 경우
-- (행은 있으나 학습 가치 낱말이 없음)는 **지금 동작을 바꾸지 않는다** — 그건 별개 판단이다.
-- 트리거 `trg_publish_article_word_set` 안에서 예외가 나면 status 갱신까지 롤백된다 = 발행이 막힌다.
-- 조회 비용: `(library_article_id, word)` 유니크 인덱스 한 번.
-- 권한: CREATE OR REPLACE 는 기존 ACL·SECURITY 속성을 유지한다(두 속성 모두 원문대로 적었다).
--
-- ── 되돌리기 ──────────────────────────────────────────────────────────
-- docs/AI_CONTEXT/rollback/20260923232916_article_word_set_require_vocab-rollback.sql
-- 재실행 안전 — CREATE OR REPLACE 만 한다.

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

  -- 2026-09-24 가드: 어휘 행이 없으면 빈 단어장을 공개하지 않는다.
  IF NOT EXISTS (SELECT 1 FROM library_article_vocabularies WHERE library_article_id = p_article_id) THEN
    RAISE EXCEPTION 'Article % 어휘 행이 없다 — 빈 단어장 공개 차단', p_article_id
      USING ERRCODE = 'check_violation',
            HINT = '글을 다시 분석(analyzeArticle → compute_article_vrl)한 뒤 발행할 것';
  END IF;

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
  -- 2026-09-24 가드: 어휘 행이 없으면 지우기 전에 멈춘다(공개 단어장이 비워지는 것을 막는다).
  IF NOT EXISTS (SELECT 1 FROM library_article_vocabularies WHERE library_article_id = p_article_id) THEN
    RAISE EXCEPTION 'article % 어휘 행이 없다 — 재발행 차단(공개 단어장이 비워진다)', p_article_id
      USING ERRCODE = 'check_violation',
            HINT = '글을 다시 분석(analyzeArticle → compute_article_vrl)한 뒤 재발행할 것';
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
