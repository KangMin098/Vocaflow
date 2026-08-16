-- supabase/migrations/20260816180000_fix_topic_corpus_gap_conflict.sql
--
-- `ingest_topic_corpus_doc` 갭 적재 결함 수정 — 문서 52%가 통째로 롤백되던 원인.
--
-- ── 무엇이 잘못됐나 (실측 2026-08-16, 첫 로컬 수확 162편 중 85편 실패) ──
-- `pending_words` 에는 **lemma 전역 유니크** 인덱스가 있다(`idx_pending_words_lemma_unique`).
-- 그런데 `20260816160000` 의 갭 적재는 "이미 있음" 을 이렇게만 판정했다:
--     WHERE p.lemma = g.surface AND p.user_id IS NULL AND p.status = 'pending'
-- 즉 **코퍼스가 만든 pending 행만** 기존으로 쳤다. 그래서 같은 단어가
--   · 학습자 신고로 이미 있거나(user_id NOT NULL — 실측 39건)
--   · 이미 처리돼 status 가 pending 이 아니면
-- 기존으로 인식되지 않아 INSERT 를 시도했고, 유니크 위반으로 **함수 전체가 예외**로 죽었다.
-- 함수는 원자적이라 그 문서의 통계·원장이 전부 롤백된다 — 갭 한 단어 때문에 문서 하나가 통째로.
--
-- 큰 문서일수록 갭 단어가 많아 충돌 확률이 높다. 그래서 실패가 장문 소스에 몰렸다
-- (wikipedia 0/2 · wikivoyage 1/7 · plos 2/6 · simple_wikipedia 9/34).
--
-- ── 어떻게 고쳤나 ──
--   ① `fresh` 의 가드를 **pending_words 전체**에 대한 존재 검사로 바꾼다 (소유자·상태 무관).
--   ② 그 위에 `ON CONFLICT (lemma) DO NOTHING` 을 덧댄다 — 동시에 두 문서가 같은 새 갭 단어를
--      만나는 경쟁 상태에서는 ①만으로 부족하다(둘 다 "없음" 을 보고 둘 다 INSERT 한다).
--
-- ── 학습자 신고 행은 건드리지 않는다 ──
-- 코퍼스 조우로 학습자 행의 `encounter_count` 를 올리지 않는다. 그 숫자는 "학습자가 몇 번
-- 만났나" 라는 분류 판단의 근거이고, 코퍼스 빈도를 섞으면 그 뜻이 오염된다. 코퍼스 쪽 빈도는
-- 어차피 `topic_word_stats` 에 정확히 남는다.

CREATE OR REPLACE FUNCTION public.ingest_topic_corpus_doc(
  p_source_id     text,
  p_external_id   text,
  p_url           text,
  p_content_hash  text,
  p_counts        jsonb,
  p_running_words integer DEFAULT 0,
  p_truncated     integer DEFAULT 0,
  p_title         text DEFAULT NULL,
  p_speaker       text DEFAULT NULL,
  p_published_at  timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_doc_id     uuid;
  v_unique     integer := 0;
  v_resolved   integer := 0;
  v_gap        integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM topic_corpus_sources WHERE id = p_source_id) THEN
    RAISE EXCEPTION 'unknown topic corpus source: %', p_source_id;
  END IF;

  SELECT id INTO v_doc_id FROM topic_corpus_docs
   WHERE source_id = p_source_id AND external_id = p_external_id;
  IF v_doc_id IS NOT NULL THEN
    RETURN jsonb_build_object('doc_id', v_doc_id, 'already_ingested', true,
                              'unique_words', 0, 'resolved_words', 0, 'gap_words', 0);
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

  WITH gaps AS (
    SELECT surface, SUM(n)::integer AS n
    FROM _tc_words WHERE headword IS NULL
    GROUP BY surface
  ), merged AS (
    -- 코퍼스가 만든 pending 행만 카운트를 올린다 (학습자 행은 위 주석대로 건드리지 않는다).
    UPDATE pending_words p
       SET encounter_count = p.encounter_count + g.n, updated_at = now()
      FROM gaps g
     WHERE p.lemma = g.surface AND p.user_id IS NULL AND p.status = 'pending'
    RETURNING p.lemma
  ), fresh AS (
    INSERT INTO pending_words (lemma, surface, user_id, encounter_count, context_snippet)
    SELECT g.surface, g.surface, NULL, g.n, 'corpus:' || p_source_id
      FROM gaps g
     -- ① 소유자·상태와 무관하게 그 lemma 가 이미 있으면 넣지 않는다.
     WHERE NOT EXISTS (SELECT 1 FROM pending_words p WHERE p.lemma = g.surface)
    -- ② 경쟁 상태 대비 — ①은 같은 순간의 다른 트랜잭션을 보지 못한다.
    ON CONFLICT (lemma) DO NOTHING
    RETURNING 1
  )
  SELECT (SELECT COUNT(*) FROM gaps) INTO v_gap;

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
    'doc_id', v_doc_id, 'already_ingested', false,
    'unique_words', v_unique, 'resolved_words', v_resolved, 'gap_words', v_gap
  );
END;
$fn$;
