-- 20260811120200_decode_entities_in_stored_sentences.sql
-- 본문 말고 **복사본**에 남은 엔티티까지 정리 + 엔티티가 만든 어휘 파편 제거.
--
-- 20260811120100 이 고치는 건 content_chunks(본문)뿐이다. 그런데 추출 당시의 문장이
-- 두 군데에 복사돼 있고 둘 다 학습자·큐레이터에게 보인다:
--   · library_book_vocabularies.first_sentence  815행 — 어드민 추출 패널 · 리더 팝오버 근거 문장
--   · shared_words.source_sentence               63행 — **발행된 챕터 단어장의 예문**
--
-- 파편 제거 판정 — 추측하지 않는다:
--   본문을 고친 뒤, 그 책의 어느 챕터에도 **단어 경계로 등장하지 않는** 미해결 어휘 행은
--   엔티티가 만들어낸 유령이다(ocial·ociety·atterns·bject·exuality·uty·ymbol …).
--   실제 텍스트에 존재하는 말(deindustrialized·rethought·kmaq·mibunsei 등)은 그대로 남는다.
--   → 열거식 blocklist 가 아니라 **본문 대조**로 판정한다. 다른 책에도 그대로 쓸 수 있다.
--
-- 선행 조건: 같은 트랜잭션/세션에서 fix_chapter_html_entities(book) 를 먼저 실행해야 한다.
--   (본문이 아직 엔티티 상태면 파편이 본문에 "존재"하는 것처럼 보여 아무것도 지우지 않는다 —
--    안전한 실패 방향이다.)

CREATE OR REPLACE FUNCTION public.decode_entities_in_stored_sentences(p_book_id uuid)
RETURNS TABLE(lbv_sentences integer, word_set_sentences integer, ghost_vocab_deleted integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120000'
AS $function$
DECLARE
  v_lbv   integer := 0;
  v_sw    integer := 0;
  v_ghost integer := 0;
BEGIN
  -- ① 근거 문장 디코딩 — 본문에 실제로 나타난 5종만 다룬다(named 엔티티 없음, 실측).
  --    generic 수치 디코딩을 SQL 로 하면 코드포인트별 분기가 필요해 과하다.
  UPDATE library_book_vocabularies v
  SET first_sentence = replace(replace(replace(replace(replace(
        v.first_sentence, '&#8217;', '’'), '&#8220;', '“'), '&#8221;', '”'), '&#8216;', '‘'), '&#8230;', '…')
  WHERE v.library_book_id = p_book_id AND v.first_sentence LIKE '%&#%';
  GET DIAGNOSTICS v_lbv = ROW_COUNT;

  -- first_sentence 는 추출 시 300자로 잘린다(extract-lemmas.ts). 경계에 엔티티가 걸리면
  -- `&#8221` 처럼 세미콜론 없이 남아 위 replace 가 못 잡는다 — 말단 파편은 그냥 떼어낸다.
  UPDATE library_book_vocabularies v
  SET first_sentence = regexp_replace(v.first_sentence, '&#x?[0-9a-fA-F]*$', '')
  WHERE v.library_book_id = p_book_id AND v.first_sentence ~ '&#x?[0-9a-fA-F]*$';
  GET DIAGNOSTICS v_lbv = ROW_COUNT;

  UPDATE shared_words sw
  SET source_sentence = replace(replace(replace(replace(replace(
        sw.source_sentence, '&#8217;', '’'), '&#8220;', '“'), '&#8221;', '”'), '&#8216;', '‘'), '&#8230;', '…')
  FROM shared_word_sets sws
  WHERE sw.set_id = sws.id
    AND (sws.curation_query->>'book_id') = p_book_id::text
    AND sw.source_sentence LIKE '%&#%';
  GET DIAGNOSTICS v_sw = ROW_COUNT;

  UPDATE shared_words sw
  SET source_sentence = regexp_replace(sw.source_sentence, '&#x?[0-9a-fA-F]*$', '')
  FROM shared_word_sets sws
  WHERE sw.set_id = sws.id
    AND (sws.curation_query->>'book_id') = p_book_id::text
    AND sw.source_sentence ~ '&#x?[0-9a-fA-F]*$';

  -- ② 유령 어휘 제거 — 고친 본문에 단어 경계로 존재하지 않는 미해결 행.
  --    lemma IS NULL 이라 발행 단어장에는 애초에 들어가지 않은 행들이다(참조 무결성 영향 0).
  WITH ghost AS (
    SELECT v.id
    FROM library_book_vocabularies v
    WHERE v.library_book_id = p_book_id
      AND v.lemma IS NULL
      AND COALESCE(v.resolved_via, 'not_found') = 'not_found'
      AND NOT EXISTS (
        SELECT 1
        FROM library_chapters_master m
        JOIN content_chunks c ON c.hash = m.content_hash
        WHERE m.library_book_id = p_book_id
          AND c.content ~* ('\m' || regexp_replace(lower(trim(v.word)), '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') || '\M')
      )
  )
  DELETE FROM library_book_vocabularies d USING ghost g WHERE d.id = g.id;
  GET DIAGNOSTICS v_ghost = ROW_COUNT;

  lbv_sentences       := v_lbv;
  word_set_sentences  := v_sw;
  ghost_vocab_deleted := v_ghost;
  RETURN NEXT;
END $function$;

COMMENT ON FUNCTION public.decode_entities_in_stored_sentences(uuid) IS
  '추출 당시 복사된 문장(lbv.first_sentence · shared_words.source_sentence)의 HTML 엔티티 디코딩 + 엔티티가 만든 유령 어휘 행 제거(본문 대조 판정). fix_chapter_html_entities 선행 필요.';
