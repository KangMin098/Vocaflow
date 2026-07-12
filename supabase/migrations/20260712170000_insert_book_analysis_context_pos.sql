-- Phase 3 forward-wiring — insert_book_analysis 가 신규 도서 lbv 에 context_pos 저장.
-- extract-lemmas 가 chapter 지배 POS(winkNLP)를 ChapterWord.context_pos 로 계산 → p_words 로 전달.
-- 이로써 신규 도서는 백필 없이 파이프라인에서 바로 문맥 sense 매칭 가능(Phase 3 추출 함수가 사용).
-- additive · nullable — 구 p_words(context_pos 누락)도 NULL 로 안전 삽입.

CREATE OR REPLACE FUNCTION public.insert_book_analysis(p_book_id uuid, p_chapters jsonb, p_words jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
 SET statement_timeout TO '240s'
AS $function$
DECLARE
  v_chapter JSONB;
  v_word JSONB;
BEGIN
  DELETE FROM library_chapters_master WHERE library_book_id = p_book_id;
  DELETE FROM library_book_vocabularies WHERE library_book_id = p_book_id;

  FOR v_chapter IN SELECT * FROM jsonb_array_elements(p_chapters)
  LOOP
    INSERT INTO library_chapters_master (
      library_book_id, chapter_idx, chapter_title, group_label, source_href,
      content_hash, word_count, cefr_level,
      paragraph_offsets, sentence_offsets
    ) VALUES (
      p_book_id,
      (v_chapter->>'chapter_idx')::INT,
      NULLIF(v_chapter->>'chapter_title', ''),
      NULLIF(v_chapter->>'group_label', ''),
      NULLIF(v_chapter->>'source_href', ''),
      v_chapter->>'content_hash',
      (v_chapter->>'word_count')::INT,
      v_chapter->>'cefr_level',
      ARRAY(SELECT jsonb_array_elements_text(v_chapter->'paragraph_offsets'))::INT[],
      ARRAY(SELECT jsonb_array_elements_text(v_chapter->'sentence_offsets'))::INT[]
    );
  END LOOP;

  FOR v_word IN SELECT * FROM jsonb_array_elements(p_words)
  LOOP
    INSERT INTO library_book_vocabularies (
      library_book_id, chapter_idx, word,
      frequency_in_book, frequency_in_chapter,
      first_sentence, base_learning_value, context_pos
    ) VALUES (
      p_book_id,
      (v_word->>'chapter_idx')::INT,
      v_word->>'word',
      (v_word->>'frequency_in_book')::INT,
      (v_word->>'frequency_in_chapter')::INT,
      v_word->>'first_sentence',
      (v_word->>'base_learning_value')::FLOAT,
      NULLIF(v_word->>'context_pos', '')
    )
    ON CONFLICT (library_book_id, word) DO UPDATE
      SET frequency_in_book    = EXCLUDED.frequency_in_book,
          frequency_in_chapter = EXCLUDED.frequency_in_chapter,
          base_learning_value  = EXCLUDED.base_learning_value,
          first_sentence       = EXCLUDED.first_sentence,
          context_pos          = EXCLUDED.context_pos;
  END LOOP;
END $function$;
