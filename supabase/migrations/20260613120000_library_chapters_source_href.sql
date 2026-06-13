-- supabase/migrations/20260613120000_library_chapters_source_href.sql
-- 챕터별 원본 소스 deep-link 저장 — admin 검수 화면 "챕터별 소스 링크" 정확도.
--
-- 배경: source-urls.ts 가 Standard Ebooks 챕터 URL 을 /text/chapter-N 으로 추측했으나
--   실제 SE 챕터 URL 은 4종(파일분리 /text/chapter-1 · 앵커 /text/fables#slug ·
--   명명 /text/charmides · 중첩 /text/chapter-1-1-1)으로 갈려 모음집·다권에서 404.
--   DB 메타만으로는 형식 구분 불가 → 적재 시 소스 TOC 를 파싱해 챕터별 실제 href 를 저장.
--
-- 이 마이그레이션:
--   1) library_chapters_master.source_href 컬럼 추가 (nullable — 미매핑/타 소스는 NULL → 렌더가 도서 TOC fallback)
--   2) insert_book_analysis 가 p_chapters[].source_href 를 적재하도록 확장

ALTER TABLE library_chapters_master
  ADD COLUMN IF NOT EXISTS source_href text;

COMMENT ON COLUMN library_chapters_master.source_href IS
  '원본 소스의 해당 챕터 deep-link URL (SE: TOC href 매핑). NULL 이면 렌더가 도서 TOC 로 fallback.';

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
      first_sentence, base_learning_value
    ) VALUES (
      p_book_id,
      (v_word->>'chapter_idx')::INT,
      v_word->>'word',
      (v_word->>'frequency_in_book')::INT,
      (v_word->>'frequency_in_chapter')::INT,
      v_word->>'first_sentence',
      (v_word->>'base_learning_value')::FLOAT
    )
    ON CONFLICT (library_book_id, word) DO UPDATE
      SET frequency_in_book    = EXCLUDED.frequency_in_book,
          frequency_in_chapter = EXCLUDED.frequency_in_chapter,
          base_learning_value  = EXCLUDED.base_learning_value,
          first_sentence       = EXCLUDED.first_sentence;
  END LOOP;
END $function$;
