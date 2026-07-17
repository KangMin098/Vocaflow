-- 20260704090000_lbv_lemma_insert_gate.sql
-- lbv INSERT 시 lemma 자동 채움 — statement-level 트리거로 모든 ingest 경로 공통 게이트.
-- 배경: LCP process 라우트의 backfill_book_lemmas 호출이 supabase-js rpc 무-throw 특성으로
--       실패가 침묵(try/catch 는 죽은 코드 — rpc 는 { error } 반환, throw 안 함)
--       → Les Misérables 13,351행 lemma 100% NULL 로 추출 3경로(direct-bind/percentile/seed) 무력화됐던 결함 재발 방지.
-- 로직은 기존 backfill_book_lemmas 와 동일 (사전 직접 매칭 → en_inflection_bases 굴절형 매칭).
-- 기존 RPC 는 수동 재실행/reprocess-book.mjs 호환을 위해 그대로 유지.

CREATE OR REPLACE FUNCTION public.trg_lbv_fill_lemma()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE library_book_vocabularies lbv
  SET lemma = COALESCE(
    (SELECT d.word FROM shared_dictionary d
       WHERE d.word = lower(trim(lbv.word))
         AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL
         AND d.meaning_ko IS NOT NULL AND LENGTH(d.meaning_ko) > 0
       LIMIT 1),
    (SELECT id.word
       FROM unnest(en_inflection_bases(lower(trim(lbv.word)))) AS cand(c)
       JOIN shared_dictionary id ON id.word = cand.c
       WHERE id.v_level IS NOT NULL AND id.classified_by IS NOT NULL
         AND id.meaning_ko IS NOT NULL AND LENGTH(id.meaning_ko) > 0
       ORDER BY id.word LIMIT 1)
  )
  FROM new_rows nr
  WHERE lbv.id = nr.id AND lbv.lemma IS NULL;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS lbv_fill_lemma_after_insert ON public.library_book_vocabularies;
CREATE TRIGGER lbv_fill_lemma_after_insert
AFTER INSERT ON public.library_book_vocabularies
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.trg_lbv_fill_lemma();
