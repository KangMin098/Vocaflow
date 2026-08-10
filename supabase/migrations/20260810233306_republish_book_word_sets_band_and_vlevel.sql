-- 20260811100000_republish_book_word_sets.sql
-- ADR 0004 재발행 2단계 — 이미 발행된 도서의 챕터 단어장을 새 선정 정책으로 갱신.
--
-- 배경: publish_book_word_sets 는 세트가 이미 있으면 `CONTINUE` 로 건너뛴다(중복 발행 방지).
--   그래서 D1/D2 를 적용해도 기존 발행 13권에는 소급되지 않는다.
--
-- 새 함수를 만들지 않는다: `republish_book_word_sets(uuid,int)` 가 이미
--   `20260718100070_republish_and_gate_wire` 에 있고 in-place 갱신(세트 유지 + shared_words 교체)
--   이라는 올바른 형태를 갖췄다. 거의 같은 함수를 하나 더 두면 어느 쪽이 정본인지 흐려진다.
--   → 기존 함수를 **확장**한다. 시그니처·반환형(integer)·SECURITY DEFINER·게이트 모두 유지.
--
-- 왜 in-place 여야 하는가 (기존 설계의 근거를 여기 남긴다):
--   · user_word_set_subscriptions.set_id 는 **ON DELETE CASCADE**. 세트를 지우면 구독이 사라진다.
--     실측: Twenty years after 90 · Gibbon 71 · Pride and Prejudice 61 · Pinocchio 36
--           · A Christmas Carol 10 · Ammachi 1.
--   · vocabularies.shared_set_id 는 SET NULL — 지우면 출처 링크가 끊긴다(269행).
--   · FSRS 진도는 안전하다: difficulty/stability/next_review_at 등은 학습자 자신의
--     vocabularies 행에 있고 shared_words 를 가리키는 FK 는 존재하지 않는다(실측).
--     세트는 카탈로그이지 진도가 아니다.
--
-- 이번 변경 3가지:
--   ① v_level 적재 (ADR 0004 D6 — 발행물이 CEFR 6단계로만 남아 학습자 레벨 하위 필터가 불가했다)
--   ② 세트 설명·curation_query 에 밴드 범위 기록 + version=3 (publish_book_word_sets 와 동형)
--   ③ **신규 선정이 0 인 챕터의 세트는 비우지 않는다.** 기존 구현은 책 전체 shared_words 를
--      먼저 DELETE 한 뒤 새 선정만 INSERT 해서, 선정이 0 인 챕터는 빈 세트로 남는다.
--      (현재 13권에는 해당 챕터가 없지만, 밴드가 좁아지는 고레벨 책에서 언제든 발생할 수 있다.)

CREATE OR REPLACE FUNCTION public.republish_book_word_sets(p_book_id uuid, p_cap integer DEFAULT 40)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sets  int;
  v_bvl   smallint;
  v_title text;
  v_floor int;
  v_ceil  int;
BEGIN
  IF NOT content_gate_publishable('book', p_book_id) THEN
    RAISE EXCEPTION 'book % 게이트 FAIL — 재발행 차단', p_book_id;
  END IF;

  SELECT lb.book_v_level, lb.title INTO v_bvl, v_title
  FROM library_books lb WHERE lb.id = p_book_id;
  IF v_bvl IS NULL THEN
    RAISE EXCEPTION 'book % 에 book_v_level 없음 — compute_book_vrl 선행 필요', p_book_id;
  END IF;
  v_floor := GREATEST(v_bvl - 1, 1);
  v_ceil  := LEAST(v_bvl + 3, 11);

  -- 이번 선정 결과를 먼저 고정한다 (아래에서 두 번 참조 + 0선정 챕터 판정에 필요).
  DROP TABLE IF EXISTS _resel;
  CREATE TEMP TABLE _resel ON COMMIT DROP AS
    SELECT * FROM select_book_chapter_vocab(p_book_id) WHERE sort_order <= p_cap;

  -- 갱신 대상 = 이 책의 발행 세트 중 **신규 선정이 1개 이상인 챕터**만.
  DROP TABLE IF EXISTS _target;
  CREATE TEMP TABLE _target ON COMMIT DROP AS
    SELECT sws.id AS set_id, (sws.curation_query->>'chapter_idx')::int AS ch
    FROM shared_word_sets sws
    WHERE sws.category = 'library_book' AND sws.is_published
      AND (sws.curation_query->>'book_id') = p_book_id::text
      AND EXISTS (SELECT 1 FROM _resel s WHERE s.chapter_idx = (sws.curation_query->>'chapter_idx')::int);

  DELETE FROM shared_words sw USING _target t WHERE sw.set_id = t.set_id;

  INSERT INTO shared_words (
    set_id, word, lemma, meaning_ko, cefr_level, v_level, sort_order,
    library_book_vocabulary_id, source_sentence
  )
  SELECT t.set_id, s.word, s.lemma, s.meaning_ko, s.cefr_level, s.v_level, s.sort_order,
         s.library_book_vocabulary_id, s.first_sentence
  FROM _target t
  JOIN _resel s ON s.chapter_idx = t.ch;

  UPDATE shared_word_sets sws SET
    word_count  = (SELECT count(*) FROM shared_words w WHERE w.set_id = sws.id),
    version     = 3,
    description = v_title || ' 챕터 ' || t.ch || ' 핵심 어휘 (V' || v_floor || '~V' || v_ceil || ')',
    curation_query = sws.curation_query || jsonb_build_object(
      'book_v_level',   v_bvl,
      'band_floor',     v_floor,
      'band_ceil',      v_ceil,
      'cap',            p_cap,
      'selection',      'ADR 0004 D1+D2 relative band (floor=bvl-1, ceil=bvl+3, i+1 composite, cap)',
      'republished_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF')
    )
  FROM _target t
  WHERE sws.id = t.set_id;
  GET DIAGNOSTICS v_sets = ROW_COUNT;

  DROP TABLE IF EXISTS _resel;
  DROP TABLE IF EXISTS _target;
  RETURN v_sets;
END;
$function$;

COMMENT ON FUNCTION public.republish_book_word_sets(uuid, integer) IS
  'ADR 0004 — 발행 도서 챕터 단어장 in-place 재발행. 세트 행 유지(구독·출처 링크 보존) + shared_words 교체 + v_level/밴드 기록. 신규 선정 0 챕터는 건드리지 않는다.';
