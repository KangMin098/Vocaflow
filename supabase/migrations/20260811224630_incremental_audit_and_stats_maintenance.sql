-- 20260811224630_incremental_audit_and_stats_maintenance.sql
--
-- ⑥ 통계 유지보수
--   shared_dictionary(219MB·45,682행)의 통계가 완전히 비어 있었다 — n_live_tup=0,
--   last_autoanalyze=null. 플래너가 0행으로 추정해 154만 행 lbv 와 조인하니 계획이
--   무너졌고, 120권 배치에서 83번 이후 37건이 연속 타임아웃했다.
--   원인은 구조적이다: 사전 계열은 읽기 전용이라 갱신이 없어 autoanalyze 임계값에
--   영원히 도달하지 않는다. lexicon_clean·spelling_norm 도 같은 상태였다.
--   ANALYZE 자체가 2분 statement_timeout 을 넘겨서, timeout 을 무력화한 함수로만 완주했다.
--   → 그 우회를 안전한 형태로 영구화한다. 테이블명을 문자열로 받아 format 하면
--     임의 SQL 이 되므로 화이트리스트 + %I identifier quoting 으로 좁힌다.

CREATE OR REPLACE FUNCTION public.maintain_reference_stats()
RETURNS TABLE(table_name text, live_tuples bigint, analyzed_at timestamptz)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '0'
SET lock_timeout TO '5s'
AS $function$
DECLARE
  v_tables text[] := ARRAY[
    'shared_dictionary', 'lexicon_clean', 'spelling_norm', 'dialect_map',
    'archaic_dictionary', 'coverage_lexicon', 'english_irregular_forms',
    'library_book_vocabularies', 'shared_words', 'content_chunks'
  ];
  v_t text;
BEGIN
  FOREACH v_t IN ARRAY v_tables LOOP
    IF to_regclass('public.' || quote_ident(v_t)) IS NOT NULL THEN
      EXECUTE format('ANALYZE public.%I', v_t);
    END IF;
  END LOOP;

  RETURN QUERY
  SELECT s.relname::text, s.n_live_tup, COALESCE(s.last_analyze, s.last_autoanalyze)
  FROM pg_stat_user_tables s
  WHERE s.relname = ANY(v_tables)
  ORDER BY s.n_live_tup DESC;
END;
$function$;

COMMENT ON FUNCTION public.maintain_reference_stats() IS
  '읽기 전용 참조 테이블 통계 갱신 — autoanalyze 가 돌지 않아 방치되는 사전 계열이 대상. 대량 적재/사전 갱신 후 호출.';

REVOKE ALL ON FUNCTION public.maintain_reference_stats() FROM public;
GRANT EXECUTE ON FUNCTION public.maintain_reference_stats() TO service_role;

-- ⑤ 추출 품질 감사를 전수 재계산 → 도서 단위 증분으로
--   306권 · lbv 154만 행에서 v_extraction_quality_audit 가 통째로 타임아웃했다.
--   통계를 고친 뒤 03 은 살아났지만, 04/90 은 여전히 못 돈다 —
--   미해결 6,044행 × content_chunks 정규식 스캔은 곱셈으로 커진다.
--   도서 1권 계산은 빠르므로 권당 계산 → 저장 → 합계 조회로 바꾼다.
--   반복은 scripts/lcp/audit-books.mjs · 신규 적재는 batch-extract.mjs 가 권당 호출.

CREATE TABLE IF NOT EXISTS public.book_extraction_audit (
  library_book_id uuid        NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  defect          text        NOT NULL,
  rows            integer     NOT NULL DEFAULT 0,
  words           integer     NOT NULL DEFAULT 0,
  occurrences     bigint      NOT NULL DEFAULT 0,
  computed_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (library_book_id, defect)
);

COMMENT ON TABLE public.book_extraction_audit IS
  '도서별 추출 결함 카운트 — audit_book_extraction() 이 채운다. v_extraction_quality_audit 의 원천.';

ALTER TABLE public.book_extraction_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS book_extraction_audit_admin_read ON public.book_extraction_audit;
CREATE POLICY book_extraction_audit_admin_read ON public.book_extraction_audit
  FOR SELECT TO authenticated USING (is_admin_or_curator());

CREATE OR REPLACE FUNCTION public.audit_book_extraction(p_book_id uuid)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '180000'
AS $function$
DECLARE
  v_n integer;
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
  SELECT p_book_id, '04 유령 어휘(본문에 없음)',
         count(*)::int, count(DISTINCT lower(trim(v.word)))::int,
         COALESCE(sum(v.frequency_in_book), 0)::bigint
  FROM library_book_vocabularies v
  WHERE v.library_book_id = p_book_id
    AND v.lemma IS NULL AND v.noise_kind IS NULL
    AND COALESCE(v.resolved_via, 'not_found') IN ('not_found', 'invalid')
    AND NOT EXISTS (
      SELECT 1 FROM library_chapters_master m JOIN content_chunks c ON c.hash = m.content_hash
      WHERE m.library_book_id = p_book_id
        AND c.content ~* ('\m' || regexp_replace(lower(trim(v.word)), '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') || '\M'))
  UNION ALL
  SELECT p_book_id, '05 HTML 엔티티 잔존',
         count(*)::int, count(DISTINCT lower(trim(v.word)))::int,
         COALESCE(sum(v.frequency_in_book), 0)::bigint
  FROM library_book_vocabularies v
  WHERE v.library_book_id = p_book_id AND position('&#' in COALESCE(v.first_sentence, '')) > 0
  UNION ALL
  SELECT p_book_id, '90 사전 미수록 잔여(정보)',
         count(*)::int, count(DISTINCT lower(trim(v.word)))::int,
         COALESCE(sum(v.frequency_in_book), 0)::bigint
  FROM library_book_vocabularies v
  WHERE v.library_book_id = p_book_id
    AND v.lemma IS NULL AND v.noise_kind IS NULL
    AND COALESCE(v.resolved_via, 'not_found') IN ('not_found', 'invalid')
    AND EXISTS (
      SELECT 1 FROM library_chapters_master m JOIN content_chunks c ON c.hash = m.content_hash
      WHERE m.library_book_id = p_book_id
        AND c.content ~* ('\m' || regexp_replace(lower(trim(v.word)), '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') || '\M'));

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$function$;

COMMENT ON FUNCTION public.audit_book_extraction(uuid) IS
  '한 권의 추출 결함 6종을 계산해 book_extraction_audit 에 저장(멱등). 추출/재추출 직후 호출.';

DROP VIEW IF EXISTS public.v_extraction_quality_audit;

CREATE VIEW public.v_extraction_quality_audit AS
WITH cov AS (
  SELECT count(DISTINCT library_book_id)::int AS audited,
         (SELECT count(*)::int FROM library_books WHERE status IN ('ready', 'published')) AS total,
         min(computed_at) AS oldest
  FROM book_extraction_audit
)
SELECT a.defect,
       CASE a.defect
         WHEN '01 반대말 결합'            THEN 'DEFECT — lemma 가 표면형의 부정 의미를 잃음 (imprudent→prudent)'
         WHEN '02 register 노이즈 오결합' THEN 'DEFECT — 굴절/파생 폴백이 proper_noun/brand/abbreviation 표제어에 닿음 (dren→dr)'
         WHEN '03 문맥POS 미대응 sense'   THEN 'DEFECT(사전 내용) — 문맥 POS 와 사전 POS 가 다르고 대응 sense 도 없음. 작업 큐: v_dict_pos_sense_gap'
         WHEN '04 유령 어휘(본문에 없음)' THEN 'DEFECT — 본문에 없는 행. 파이프라인이 구조적으로 차단(keepLemmaOnlyIfInText) — 0 이 아니면 구 데이터'
         WHEN '05 HTML 엔티티 잔존'       THEN 'DEFECT — 본문/근거문장에 &#NNNN; 미디코딩 (ingester decodeEntities 회귀 신호)'
         ELSE 'INFO — 결함 아님. 본문에 실재하나 어떤 사전에도 없는 말. dict-selfheal 드레인 대상'
       END AS detail,
       sum(a.rows)::int           AS rows,
       sum(a.words)::int          AS words,
       sum(a.occurrences)::bigint AS occurrences,
       (SELECT audited FROM cov)  AS books_audited,
       (SELECT total   FROM cov)  AS books_total,
       (SELECT oldest  FROM cov)  AS oldest_computed_at
FROM book_extraction_audit a
GROUP BY a.defect;

COMMENT ON VIEW public.v_extraction_quality_audit IS
  '추출 품질 결함 현황(증분 집계). books_audited < books_total 이면 미감사 도서가 있다 — audit_book_extraction 으로 채운다.';

ALTER VIEW public.v_extraction_quality_audit SET (security_invoker = true);

CREATE OR REPLACE FUNCTION public.books_needing_audit(p_limit integer DEFAULT 50)
RETURNS TABLE(library_book_id uuid, title text, computed_at timestamptz)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT lb.id, lb.title, MIN(a.computed_at)
  FROM library_books lb
  LEFT JOIN book_extraction_audit a ON a.library_book_id = lb.id
  WHERE lb.status IN ('ready', 'published')
  GROUP BY lb.id, lb.title
  HAVING MIN(a.computed_at) IS NULL OR MIN(a.computed_at) < lb.updated_at
  ORDER BY MIN(a.computed_at) NULLS FIRST
  LIMIT p_limit;
$function$;

COMMENT ON FUNCTION public.books_needing_audit(integer) IS
  '감사가 없거나 도서가 그 뒤에 갱신된 도서 목록 — 증분 감사 배치의 입력.';

GRANT EXECUTE ON FUNCTION public.audit_book_extraction(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.books_needing_audit(integer) TO authenticated;
