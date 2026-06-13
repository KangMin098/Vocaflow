-- 20260608121000_v_text_content_user_book_group.sql
-- v_text_content view 에 user_book_group_id 컬럼 추가.
-- 워크스페이스 layout 이 chapter 그룹 fetch 분기 시 필요.

CREATE OR REPLACE VIEW public.v_text_content AS
SELECT t.id,
    t.user_id,
    t.title,
    t.cefr_level,
    t.status,
    t.progress_percent,
    t.library_book_id,
    t.chapter_idx,
    t.chapter_title,
    t.current_paragraph_idx,
    COALESCE(t.content, cc.content) AS content,
    lcm.paragraph_offsets,
    lcm.sentence_offsets,
    lcm.word_count AS chapter_word_count,
    t.user_book_group_id
   FROM texts t
     LEFT JOIN library_chapters_master lcm
       ON lcm.library_book_id = t.library_book_id
       AND lcm.chapter_idx = t.chapter_idx
     LEFT JOIN content_chunks cc ON cc.hash = lcm.content_hash;
