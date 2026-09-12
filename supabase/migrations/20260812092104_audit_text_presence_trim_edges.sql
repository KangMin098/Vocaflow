-- 20260812092104_audit_text_presence_trim_edges.sql
-- 감사 04/90 판정 — 토큰 문자 집합을 추출 계층과 일치시킨다.
--
-- 회귀 2단계 기록 (경량화가 판정을 바꾼 사례):
--   20260812025420 에서 본문 실재 판정을 정규식 `\m<word>\M` → 토큰 분해로 바꿨다.
--   성능은 3배 좋아졌지만(권당 18.4→6.25초) **판정 동등성을 실측하지 않고**
--   "기준이 같다" 고 주석에 단정했다. 두 번 틀렸다:
--
--   ① 분리자 `[^a-z'']+` — 하이픈이 분리자가 되어
--      `over-recompenced` 가 `over` + `recompenced` 로 쪼개짐
--      → 본문에 실재하는데 유령(결함 04)으로 오탐 (The Wealth of Nations)
--   ② 분리자 `[^a-z''-]+` — 이번엔 아포스트로피가 단어 문자라
--      본문 `'uncatholic and unchristian'` 에서 토큰이 `'uncatholic`
--      → lbv 의 `uncatholic` 과 매칭 실패 (Eminent Victorians)
--
-- 근본 원인은 두 계층이 **다른 단어 개념**을 쓴 것이다.
--   extract-lemmas 의 isValidLearningWord 는 `[a-z'-]` 를 허용하되
--   **앞뒤의 '/- 는 거부**한다(`/^['-]|['-]$/`). 토큰도 같은 형태로 정규화해야
--   "추출이 만든 것을 감사가 못 찾는" 불일치가 생기지 않는다.
--
-- 수정: 분리자 `[^a-z''-]+` + 토큰 앞뒤 `btrim(t, '''-')`.
--
-- 교훈: 측정 코드의 성능 최적화는 **결과 동등성을 실측으로 확인**한 뒤에 확정해야 한다.
--   숫자가 틀린 감사는 없는 감사보다 나쁘다 — 고칠 것을 잘못 가리킨다.

CREATE OR REPLACE FUNCTION public.audit_book_extraction(p_book_id uuid)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '180000'
AS $function$
DECLARE
  v_n      integer;
  v_unres  integer;
BEGIN
  DELETE FROM book_extraction_audit WHERE library_book_id = p_book_id;

  INSERT INTO book_extraction_audit (library_book_id, defect, rows, words, occurrences)
  SELECT p_book_id, '01 반대말 결합',
         count(*)::int, count(DISTINCT lower(trim(v.word)))::int,
         COALESCE(sum(v.frequency_in_book), 0)::bigint
  FROM library_book_vocabularies v
  WHERE v.library_book_id = p_book_id AND v.lemma IS NOT NULL
    AND NOT en_negation_preserved(lower(trim(v.word)), v.lemma)
  UNION ALL
  SELECT p_book_id, '02 register 노이즈 오결합',
         count(*)::int, count(DISTINCT lower(trim(v.word)))::int,
         COALESCE(sum(v.frequency_in_book), 0)::bigint
  FROM library_book_vocabularies v JOIN shared_dictionary d ON d.word = v.lemma
  WHERE v.library_book_id = p_book_id
    AND d.word_register IN ('proper_noun', 'brand', 'abbreviation')
    AND lower(trim(v.word)) <> v.lemma
  UNION ALL
  SELECT p_book_id, '03 문맥POS 미대응 sense',
         count(*)::int, count(DISTINCT lower(trim(v.word)))::int,
         COALESCE(sum(v.frequency_in_book), 0)::bigint
  FROM library_book_vocabularies v JOIN shared_dictionary d ON d.word = v.lemma
  WHERE v.library_book_id = p_book_id
    AND v.context_pos IS NOT NULL AND d.pos IS NOT NULL AND v.context_pos <> d.pos
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(d.meanings_ko, '[]'::jsonb)) s
                    WHERE s->>'pos' = v.context_pos)
  UNION ALL
  SELECT p_book_id, '05 HTML 엔티티 잔존',
         count(*)::int, count(DISTINCT lower(trim(v.word)))::int,
         COALESCE(sum(v.frequency_in_book), 0)::bigint
  FROM library_book_vocabularies v
  WHERE v.library_book_id = p_book_id AND position('&#' in COALESCE(v.first_sentence, '')) > 0;

  GET DIAGNOSTICS v_n = ROW_COUNT;

  -- 미해결이 0건이면 본문을 아예 읽지 않는다 (대부분의 도서가 여기서 끝난다)
  SELECT count(*) INTO v_unres
  FROM library_book_vocabularies v
  WHERE v.library_book_id = p_book_id
    AND v.lemma IS NULL AND v.noise_kind IS NULL
    AND COALESCE(v.resolved_via, 'not_found') IN ('not_found', 'invalid');

  IF v_unres = 0 THEN
    INSERT INTO book_extraction_audit (library_book_id, defect, rows, words, occurrences)
    VALUES (p_book_id, '04 유령 어휘(본문에 없음)', 0, 0, 0),
           (p_book_id, '90 사전 미수록 잔여(정보)', 0, 0, 0);
    RETURN v_n + 2;
  END IF;

  INSERT INTO book_extraction_audit (library_book_id, defect, rows, words, occurrences)
  WITH toks AS (
    -- 분리자는 a-z/'/- 외 전부. 잘라낸 토큰의 앞뒤 '/- 는 제거해
    -- isValidLearningWord 가 만드는 형태와 일치시킨다.
    SELECT DISTINCT btrim(t, '''-') AS w
    FROM library_chapters_master m
    JOIN content_chunks c ON c.hash = m.content_hash,
         LATERAL regexp_split_to_table(lower(c.content), '[^a-z''-]+') AS t
    WHERE m.library_book_id = p_book_id AND length(btrim(t, '''-')) >= 2
  ),
  unres AS (
    SELECT lower(trim(v.word)) AS w, v.frequency_in_book AS f
    FROM library_book_vocabularies v
    WHERE v.library_book_id = p_book_id
      AND v.lemma IS NULL AND v.noise_kind IS NULL
      AND COALESCE(v.resolved_via, 'not_found') IN ('not_found', 'invalid')
  ),
  judged AS (
    SELECT u.w, u.f, EXISTS (SELECT 1 FROM toks WHERE toks.w = u.w) AS present
    FROM unres u
  )
  SELECT p_book_id, '04 유령 어휘(본문에 없음)',
         count(*)::int, count(DISTINCT w)::int, COALESCE(sum(f), 0)::bigint
  FROM judged WHERE NOT present
  UNION ALL
  SELECT p_book_id, '90 사전 미수록 잔여(정보)',
         count(*)::int, count(DISTINCT w)::int, COALESCE(sum(f), 0)::bigint
  FROM judged WHERE present;

  RETURN v_n + 2;
END;
$function$;

COMMENT ON FUNCTION public.audit_book_extraction(uuid) IS
  '한 권의 추출 결함 6종 계산 → book_extraction_audit 저장(멱등). 04/90 은 미해결이 있을 때만 본문을 1회 토큰 분해해 판정(토큰 형태를 isValidLearningWord 와 일치: a-z''- 허용, 앞뒤 ''- 제거).';
