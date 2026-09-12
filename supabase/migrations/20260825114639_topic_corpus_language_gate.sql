-- supabase/migrations/_pending_topic_corpus_language_gate.sql
--
-- 주제 코퍼스 적재에 **언어 게이트**를 세우고, 갭 낱말에 **문서 빈도**를 남긴다.
--
-- ── 왜 (실측 2026-08-25) ────────────────────────────────────────────
-- `pending_words` 11,081행 중 학습자가 만든 것은 39개뿐이고 나머지는 이 적재 경로가 넣었다.
-- 그 큐를 채운 베트남어(cua·nhung·khong…)·스페인어·프랑스어의 출처를 문서 단위로 좁히니
-- **1,935편 중 4행**이었다 — 자막이 통째로 비영어인 TED talk 3편(1편은 중복 적재):
--
--   Is Taste a Blessing Or a Curse (ESG)        unique 710 · gap 654 (92.1%)
--   Una teoría para acabar con las burbujas…    unique 694 · gap 504 (72.6%)
--   The island itself | TEDxHANU  (×2)          unique 369 · gap 228 (61.8%)
--
-- 지금까지의 유일한 언어 가드는 `harvest.ts` 의 "토큰 0개면 거부" 하나뿐이라, 자막이 통째로
-- 다른 언어여도 토큰이 1개만 살면 통과했다.
--
-- ── 임계값을 짐작으로 정하지 않았다 ─────────────────────────────────
-- unique_words >= 100 인 문서 1,889편의 **실제 gap 비율**:
--   평균 2.4% · 정상 문서 최대 **12.3%** · 위 4행 61.8~92.1%
-- 임계 0.30 은 정상 최대의 2.4배, 최악 사례의 절반이다. 0.25·0.30·0.40 어디로 잡아도
-- 걸리는 문서는 **똑같이 그 4행뿐**이다 — 오탐 비용이 사실상 0인 구간을 골랐다.
-- unique_words 100 하한을 두는 이유: NASA 이미지 캡션(unique 40~56)은 정상인데도 24.5% 까지 오른다.
--
-- ── 두 번째 변경: 갭 낱말의 문서 빈도 ───────────────────────────────
-- `topic_word_stats` 는 **해석된 낱말에만** doc_freq 를 남긴다. 갭 낱말은 등장 횟수 합계
-- (`encounter_count`)만 갖는다. 그래서 **한 편에서 107번 나온 `cua`** 가
-- **12편에 걸쳐 나온 `microbiome`** 보다 큐 위에 온다 — 있는 신호 중 가장 약한 것으로 줄을 세웠다.
-- `pending_words.doc_freq` 를 더해 "몇 편에 나왔나" 로 줄을 세울 수 있게 한다.
-- 기존 행은 되계산할 수 없어 0 으로 남는다(= 미집계, 2026-08-25 이전 적재분).
--
-- ── 세 번째: 죽은 오버로드 제거 ─────────────────────────────────────
-- `p_proper_nouns` 없는 10-인자 판이 남아 있었다. 호출부 둘(harvest.ts · local-corpus.ts)은
-- 모두 11-인자를 쓰지만, 인자 하나를 빠뜨린 호출이 생기면 **고유명사·노이즈 필터와 이 게이트를
-- 통째로 건너뛴 채** 조용히 성공한다. 그 경로를 막는다.

-- ─────────────────────────────────────────────────────────────
-- ① 갭 낱말 문서 빈도
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.pending_words
  ADD COLUMN IF NOT EXISTS doc_freq integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.pending_words.doc_freq IS
  '이 낱말이 나온 코퍼스 문서 수. 0 = 미집계(2026-08-25 이전 적재분) 또는 학습자 추출분. 등재 우선순위는 encounter_count(총 등장)가 아니라 이 값으로 판단한다 — 한 문서에서 반복된 비영어 토큰이 총량으로는 위에 오기 때문.';

-- ─────────────────────────────────────────────────────────────
-- ② 죽은 10-인자 오버로드 제거
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.ingest_topic_corpus_doc(text, text, text, text, jsonb, integer, integer, text, text, timestamptz);

-- ─────────────────────────────────────────────────────────────
-- ③ 언어 게이트 + doc_freq 적재
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ingest_topic_corpus_doc(
  p_source_id text, p_external_id text, p_url text, p_content_hash text, p_counts jsonb,
  p_running_words integer DEFAULT 0, p_truncated integer DEFAULT 0, p_title text DEFAULT NULL::text,
  p_speaker text DEFAULT NULL::text, p_published_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_proper_nouns text[] DEFAULT '{}'::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc_id     uuid;
  v_unique     integer := 0;
  v_resolved   integer := 0;
  v_gap        integer := 0;
  v_proper     integer := 0;
  v_gap_unique integer := 0;
  v_ratio      numeric;
  -- 정상 문서 최대 12.3% · 비영어 문서 61.8% 이상 (2026-08-25 실측 1,889편)
  c_min_unique constant integer := 100;
  c_max_gap    constant numeric := 0.30;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM topic_corpus_sources WHERE id = p_source_id) THEN
    RAISE EXCEPTION 'unknown topic corpus source: %', p_source_id;
  END IF;

  SELECT id INTO v_doc_id FROM topic_corpus_docs
   WHERE source_id = p_source_id AND external_id = p_external_id;
  IF v_doc_id IS NOT NULL THEN
    RETURN jsonb_build_object('doc_id', v_doc_id, 'already_ingested', true, 'rejected', false,
                              'unique_words', 0, 'resolved_words', 0,
                              'gap_words', 0, 'proper_nouns', 0);
  END IF;

  DROP TABLE IF EXISTS _tc_words;
  CREATE TEMP TABLE _tc_words ON COMMIT DROP AS
  SELECT
    lower(trim(e.key))                    AS surface,
    GREATEST((e.value)::text::integer, 1) AS n,
    resolve_dict_headword(e.key)          AS headword
  FROM jsonb_each(p_counts) AS e
  WHERE length(trim(e.key)) >= 2;

  SELECT COUNT(*) INTO v_unique FROM _tc_words;
  SELECT COUNT(*) INTO v_gap_unique FROM _tc_words WHERE headword IS NULL;

  -- ★ 언어 게이트 — 아무것도 쓰기 전에 거른다.
  --   사전이 곧 언어 판별기다. 절반 넘게 해석되지 않는 문서는 영어 문서가 아니다.
  IF v_unique >= c_min_unique THEN
    v_ratio := v_gap_unique::numeric / v_unique;
    IF v_ratio > c_max_gap THEN
      UPDATE topic_corpus_queue
         SET status = 'failed',
             last_error = 'non_english_doc: gap ' || round(v_ratio * 100, 1) || '% of '
                          || v_unique || ' unique (threshold ' || round(c_max_gap * 100) || '%)',
             claimed_at = NULL, updated_at = now()
       WHERE source_id = p_source_id AND external_id = p_external_id;

      DROP TABLE IF EXISTS _tc_words;
      RETURN jsonb_build_object(
        'doc_id', NULL, 'already_ingested', false, 'rejected', true,
        'reason', 'non_english_doc', 'gap_ratio', round(v_ratio, 3),
        'unique_words', v_unique, 'resolved_words', 0, 'gap_words', 0, 'proper_nouns', 0);
    END IF;
  END IF;

  WITH folded AS (
    SELECT headword AS word, SUM(n)::bigint AS tf
    FROM _tc_words WHERE headword IS NOT NULL
    GROUP BY headword
  ), upserted AS (
    INSERT INTO topic_word_stats (source_id, word, doc_freq, term_freq)
    SELECT p_source_id, word, 1, tf FROM folded
    ON CONFLICT (source_id, word) DO UPDATE
      SET doc_freq     = topic_word_stats.doc_freq + 1,
          term_freq    = topic_word_stats.term_freq + EXCLUDED.term_freq,
          last_seen_at = now()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_resolved FROM upserted;

  -- 해석 실패분을 두 갈래로 나눈다.
  --   ① 고유명사 후보 → proper_noun_forms (사전에 넣을 대상이 아니다)
  --   ② 나머지        → pending_words    (실제 사전 갭 백로그)
  WITH gaps AS (
    SELECT surface, SUM(n)::integer AS n
    FROM _tc_words WHERE headword IS NULL
    GROUP BY surface
  ), proper AS (
    INSERT INTO proper_noun_forms (form, evidence, occurrences, book_count)
    SELECT g.surface, 'corpus_capitalization', g.n, 0
      FROM gaps g
     WHERE g.surface = ANY(p_proper_nouns)
    ON CONFLICT (form) DO UPDATE
      SET occurrences = proper_noun_forms.occurrences + EXCLUDED.occurrences
    RETURNING 1
  ), real_gaps AS (
    SELECT g.surface, g.n FROM gaps g
     WHERE NOT (g.surface = ANY(p_proper_nouns))
       -- 이미 알려진 잡음·고유명사도 갭으로 다시 올리지 않는다.
       AND NOT EXISTS (SELECT 1 FROM noise_blacklist nb WHERE lower(nb.form) = g.surface)
       AND NOT EXISTS (SELECT 1 FROM proper_noun_forms pf WHERE lower(pf.form) = g.surface)
  ), merged AS (
    UPDATE pending_words p
       -- doc_freq: 이 문서에서 한 번 봤으므로 +1. 같은 문서 안의 반복은 encounter_count 가 받는다.
       SET encounter_count = p.encounter_count + r.n,
           doc_freq        = p.doc_freq + 1,
           updated_at      = now()
      FROM real_gaps r
     WHERE p.lemma = r.surface AND p.user_id IS NULL AND p.status = 'pending'
    RETURNING p.lemma
  ), fresh AS (
    INSERT INTO pending_words (lemma, surface, user_id, encounter_count, doc_freq, context_snippet)
    SELECT r.surface, r.surface, NULL, r.n, 1, 'corpus:' || p_source_id
      FROM real_gaps r
     WHERE NOT EXISTS (SELECT 1 FROM pending_words p WHERE p.lemma = r.surface)
    ON CONFLICT (lemma) DO NOTHING
    RETURNING 1
  )
  SELECT (SELECT COUNT(*) FROM real_gaps), (SELECT COUNT(*) FROM gaps WHERE surface = ANY(p_proper_nouns))
    INTO v_gap, v_proper;

  INSERT INTO topic_corpus_docs (
    source_id, external_id, url, title, speaker, published_at, content_hash,
    running_words, unique_words, resolved_words, gap_words, truncated
  ) VALUES (
    p_source_id, p_external_id, p_url, p_title, p_speaker, p_published_at, p_content_hash,
    COALESCE(p_running_words, 0), v_unique, v_resolved, v_gap, COALESCE(p_truncated, 0)
  ) RETURNING id INTO v_doc_id;

  UPDATE topic_corpus_queue
     SET status = 'done', completed_at = now(), last_error = NULL,
         claimed_at = NULL, updated_at = now()
   WHERE source_id = p_source_id AND external_id = p_external_id;

  RETURN jsonb_build_object(
    'doc_id', v_doc_id, 'already_ingested', false, 'rejected', false,
    'unique_words', v_unique, 'resolved_words', v_resolved,
    'gap_words', v_gap, 'proper_nouns', v_proper
  );
END;
$function$;

COMMENT ON FUNCTION public.ingest_topic_corpus_doc(text, text, text, text, jsonb, integer, integer, text, text, timestamptz, text[]) IS
  '주제 코퍼스 문서 1편 적재. 사전 해석률이 낮으면(unique>=100 이고 gap>30%) 비영어 문서로 보고 아무것도 쓰지 않은 채 rejected 로 반환하고 큐를 failed 로 닫는다. 갭 낱말에는 doc_freq 를 누적한다.';
