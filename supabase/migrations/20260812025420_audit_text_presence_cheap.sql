-- 20260812010000_audit_text_presence_cheap.sql
-- audit_book_extraction 의 04/90 판정을 캐시를 파괴하지 않는 방식으로.
--
-- 사고 기록 (2026-08-12):
--   이 함수를 305권에 돌린 것이 DB 를 Unhealthy 로 만들었다.
--     pg_stat_statements: 총 5,823초 · 317회 · 평균 18.4초 → CPU 93분
--     Supabase 대시보드: "Project is depleting its Disk IO Budget" · STATUS Unhealthy
--   원인은 04/90 판정이 **미해결 단어마다** content_chunks 를 정규식으로 훑는 것:
--       NOT EXISTS (SELECT 1 FROM … WHERE c.content ~* '\m<word>\M')
--   미해결 N개 × 챕터 M개 = N×M 번 본문 전체 스캔이다. NANO(RAM 0.5GB)에서는
--   122MB 짜리 content_chunks 를 반복해서 읽는 순간 캐시에 있던 사전 데이터가
--   전부 밀려나(cache thrashing) 이후 모든 조회가 디스크로 간다.
--   **측정이 파이프라인의 자원을 빼앗은 것이다.**
--
-- 수정 두 가지:
--   ① 미해결이 0건이면 본문을 아예 읽지 않는다.
--      실측상 대부분의 도서가 여기 해당한다(311권 6,044행 = 평균 19행, 다수는 0).
--      추출 파이프라인이 keepLemmaOnlyIfInText 로 유령을 구조적으로 막은 뒤로는
--      신규 도서의 04 가 항상 0이므로, 이 가드 하나로 대부분의 비용이 사라진다.
--   ② 미해결이 있으면 본문을 **1회만** 토큰으로 분해해 집합으로 비교한다.
--      N×M 번 정규식 → M 번 분해. 판정 기준(단어 경계 일치)은 동일하다.
--
-- 판정 동등성: 기존 정규식 `\m<word>\M` 은 단어 경계 매칭이고,
--   `regexp_split_to_table(lower(content), '[^a-z'']+')` 는 같은 경계로 쪼갠 토큰 집합이다.
--   대소문자는 양쪽 다 lower 로 접는다. 하이픈은 기존 정규식에서 이스케이프 대상이었고
--   여기서는 분리자에 포함되므로, `co-operation` 같은 하이픈 복합어는 조각으로 분해된다
--   — 다만 lbv 의 미해결 단어는 isValidLearningWord 를 통과한 형태라 하이픈이 있어도
--   양쪽 조각이 본문에 있으므로 판정이 뒤집히지 않는다.

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

  -- 결함 01·02·03·05 — 조인만으로 끝난다(본문 접근 없음)
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

  -- ★ 가드 — 미해결이 없으면 본문을 읽지 않는다 (대부분의 도서가 여기서 끝난다)
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

  -- 미해결이 있을 때만 본문을 1회 분해해 집합으로 비교한다
  INSERT INTO book_extraction_audit (library_book_id, defect, rows, words, occurrences)
  WITH toks AS (
    SELECT DISTINCT t AS w
    FROM library_chapters_master m
    JOIN content_chunks c ON c.hash = m.content_hash,
         LATERAL regexp_split_to_table(lower(c.content), '[^a-z'']+') AS t
    WHERE m.library_book_id = p_book_id AND length(t) >= 2
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
  '한 권의 추출 결함 6종 계산 → book_extraction_audit 저장(멱등). 04/90 은 미해결이 있을 때만 본문을 1회 토큰 분해해 판정한다(캐시 파괴 방지).';
