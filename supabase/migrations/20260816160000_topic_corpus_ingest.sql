-- supabase/migrations/20260816160000_topic_corpus_ingest.sql
--
-- TCP (Topic Corpus Pipeline) — 주제별 외부 코퍼스에서 **어휘 증거만** 수확한다.
--
-- ── 왜 필요한가 (2026-08-16 실측) ──
-- 사전 주제 분류의 집은 이미 있다: `dictionary_categories` 566개(Oxford 18/76/472 3계층) +
-- `dictionary_word_categories` 28,079 링크. 그런데 커버리지가 21,712 / 47,137 = **46%** 이고,
-- 링크 28,079건이 전부 `source='imported'` 한 덩어리다 — **한 번 부어 넣은 뒤로 자라지 않았다.**
-- 게다가 그 taxonomy 는 사전 편찬자가 손으로 짠 것이라, 실제 담론에서 어떤 단어가 어떤 주제와
-- 함께 나타나는지에 대한 **증거가 없다**. `vocaflow_domains.science_tech`·`travel_culture` 는
-- `data_source_keys` 가 빈 배열인데도 34,094개 단어에 난이도가 매겨져 있다 — 근거 없는 추론값이다.
--
-- 이 파이프라인은 그 빈칸을 **관측**으로 채운다. 주제가 붙은 실제 글을 훑어
-- "이 단어는 이 주제에서 이만큼 나온다"를 세고, 배경 대비 두드러지는 것만 카테고리로 승격한다.
--
-- ── 원문을 저장하지 않는다 (설계 제약) ──
-- 수확 대상 코퍼스(TED 등)는 CC BY-NC-ND 처럼 **비영리·2차적저작물 금지** 라이선스인 경우가 많다.
-- 그래서 이 파이프라인은 원문을 DB 에 넣지 않는다 — 토큰화는 메모리에서 끝내고 **카운트만** 남긴다.
--   · `topic_corpus_docs` 에 **본문 컬럼이 없다.** 있는 것은 URL·제목·해시·집계 수치뿐이다.
--   · `content_hash` 는 원문 없이 중복 수확을 막기 위한 것이다(같은 글 재방문 시 재계산 회피).
-- 이 제약은 주석이 아니라 **스키마의 모양**으로 지킨다. 본문 컬럼을 추가하는 것은 조용한 실수가
-- 아니라 명시적 마이그레이션이어야 한다. 회귀 잠금: `topic-corpus-no-text.test.ts`.
--
-- ── 새 객체 ──
--   테이블 4: topic_corpus_sources · topic_corpus_queue · topic_corpus_docs · topic_word_stats
--   뷰   1: v_topic_word_salience
--   RPC  6: enqueue_topic_corpus_docs · claim_topic_corpus_batch · release_topic_corpus_claim
--           ingest_topic_corpus_doc · apply_topic_categories · topic_corpus_overview
--   변경 1: dictionary_word_categories.source CHECK 에 'corpus-derived' 추가

-- ════════════════════════════════════════════════════════════════════════
-- 1. 코퍼스 소스 레지스트리
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.topic_corpus_sources (
  id           text PRIMARY KEY,                       -- 'ted:ai'
  provider     text NOT NULL,                          -- 'ted'
  topic_key    text NOT NULL,                          -- 'ai'
  label_en     text NOT NULL,
  label_ko     text NOT NULL,
  -- 이 주제에서 두드러진 단어가 승격될 기본 카테고리. NULL 이면 승격하지 않고 통계만 쌓는다.
  category_id  text REFERENCES public.dictionary_categories(id) ON DELETE SET NULL,
  license      text NOT NULL,                          -- 'CC BY-NC-ND 4.0'
  license_url  text,
  -- 원문 저장 허용 여부. **이 파이프라인은 어떤 값이든 저장하지 않는다** — 뒤따르는 다른
  -- 파이프라인(ACP 발행 등)이 이 소스를 쓸 수 있는지 판정하는 데만 쓰는 기록용 플래그다.
  text_reusable boolean NOT NULL DEFAULT false,
  is_active    boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.topic_corpus_sources IS
  'TCP 코퍼스 소스. 주제 1개 = 행 1개. category_id 는 승격 목표 카테고리(NULL 이면 통계만).';
COMMENT ON COLUMN public.topic_corpus_sources.text_reusable IS
  '원문 재사용 가능 라이선스인지. false 여도 TCP 는 어휘 통계만 남기므로 수확 자체는 가능하다.';

-- ════════════════════════════════════════════════════════════════════════
-- 2. 드레인 큐 — 수확 대기 문서
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.topic_corpus_queue (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id    text NOT NULL REFERENCES public.topic_corpus_sources(id) ON DELETE CASCADE,
  external_id  text NOT NULL,                          -- provider 의 slug/id
  url          text NOT NULL,
  title        text,
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','claimed','done','skipped','failed')),
  attempts     integer NOT NULL DEFAULT 0,
  last_error   text,
  claimed_at   timestamptz,
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_tcq_drain
  ON public.topic_corpus_queue (source_id, status, created_at);
-- 좀비 claim 회수용 — 오래 물고 있는 행을 시간순으로 찾는다.
CREATE INDEX IF NOT EXISTS idx_tcq_claimed
  ON public.topic_corpus_queue (claimed_at) WHERE status = 'claimed';

COMMENT ON TABLE public.topic_corpus_queue IS
  'TCP 드레인 큐. claim → ingest → done. 재실행 안전(claim 은 FOR UPDATE SKIP LOCKED).';

-- ════════════════════════════════════════════════════════════════════════
-- 3. 수확 원장 — **본문 컬럼 없음** (위 설계 제약 참조)
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.topic_corpus_docs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id      text NOT NULL REFERENCES public.topic_corpus_sources(id) ON DELETE CASCADE,
  external_id    text NOT NULL,
  url            text NOT NULL,
  title          text,
  speaker        text,
  published_at   timestamptz,
  -- 정규화 본문의 sha256. 원문 없이 "같은 글을 또 훑었는지" 판정하기 위한 유일한 흔적이다.
  content_hash   text NOT NULL,
  running_words  integer NOT NULL DEFAULT 0,           -- 본문 running word 수
  unique_words   integer NOT NULL DEFAULT 0,           -- 토큰화 후 unique 후보 수
  resolved_words integer NOT NULL DEFAULT 0,           -- headword 해석 성공
  gap_words      integer NOT NULL DEFAULT 0,           -- 해석 실패 = 사전 갭
  truncated      integer NOT NULL DEFAULT 0,           -- 상한 초과로 잘린 unique 수 (0 이 아니면 누수)
  harvested_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_tcd_source ON public.topic_corpus_docs (source_id, harvested_at DESC);
CREATE INDEX IF NOT EXISTS idx_tcd_hash   ON public.topic_corpus_docs (content_hash);

COMMENT ON TABLE public.topic_corpus_docs IS
  'TCP 수확 원장. 본문 컬럼이 없는 것은 누락이 아니라 설계다 — 라이선스 제약상 원문을 저장하지 않는다.';

-- ════════════════════════════════════════════════════════════════════════
-- 4. 주제별 어휘 통계 — 이 파이프라인의 산출물
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.topic_word_stats (
  source_id     text NOT NULL REFERENCES public.topic_corpus_sources(id) ON DELETE CASCADE,
  word          text NOT NULL REFERENCES public.shared_dictionary(word) ON DELETE CASCADE,
  doc_freq      integer NOT NULL DEFAULT 0,            -- 이 단어가 등장한 문서 수
  term_freq     bigint  NOT NULL DEFAULT 0,            -- 총 등장 횟수
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, word)
);

CREATE INDEX IF NOT EXISTS idx_tws_word ON public.topic_word_stats (word);
CREATE INDEX IF NOT EXISTS idx_tws_df   ON public.topic_word_stats (source_id, doc_freq DESC);

COMMENT ON TABLE public.topic_word_stats IS
  'TCP 주제×표제어 관측 카운트. **원시 수치만 저장한다** — 두드러짐 판정은 v_topic_word_salience 에서 계산하므로 임계값을 바꿔도 재수확이 필요 없다.';

-- ════════════════════════════════════════════════════════════════════════
-- 5. 두드러짐(salience) — 배경 대비 로그오즈비
-- ════════════════════════════════════════════════════════════════════════
--
-- 원시 빈도로 주제를 정하면 결과가 전부 `people`·`make`·`think` 가 된다 — 모든 주제에서 흔하기
-- 때문이다. 그래서 **이 주제의 비율 vs 나머지 주제 전체의 비율** 을 비교한다(Dirichlet 평활).
--   salience = ln((tf_topic+α)/(total_topic+αV)) − ln((tf_rest+α)/(total_rest+αV))
-- 양수면 이 주제에서 과대표집, 0 근처면 어디서나 흔한 단어, 음수면 이 주제에선 오히려 드물다.
--
-- 뷰로 두는 이유: 임계값을 바꿀 때마다 수천 편을 다시 훑는 일이 없게 하기 위함이다.

CREATE OR REPLACE VIEW public.v_topic_word_salience AS
WITH totals AS (
  SELECT source_id, SUM(term_freq)::numeric AS topic_total
  FROM public.topic_word_stats GROUP BY source_id
),
vocab AS (
  SELECT COUNT(DISTINCT word)::numeric AS v FROM public.topic_word_stats
),
word_totals AS (
  SELECT word, SUM(term_freq)::numeric AS word_all FROM public.topic_word_stats GROUP BY word
),
src_total AS (
  SELECT SUM(term_freq)::numeric AS all_total FROM public.topic_word_stats
)
SELECT
  s.source_id,
  s.word,
  s.doc_freq,
  s.term_freq,
  t.topic_total,
  ROUND(
    LN((s.term_freq + 0.5) / (t.topic_total + 0.5 * v.v))
    - LN((GREATEST(w.word_all - s.term_freq, 0) + 0.5)
         / (GREATEST(g.all_total - t.topic_total, 1) + 0.5 * v.v))
  , 4) AS salience,
  s.first_seen_at,
  s.last_seen_at
FROM public.topic_word_stats s
JOIN totals    t ON t.source_id = s.source_id
JOIN word_totals w ON w.word = s.word
CROSS JOIN vocab v
CROSS JOIN src_total g;

COMMENT ON VIEW public.v_topic_word_salience IS
  'TCP 두드러짐. salience>0 = 배경 대비 이 주제에서 과대표집. 카테고리 승격 판정에 사용.';

-- ════════════════════════════════════════════════════════════════════════
-- 6. 카테고리 승격 출처 추가
-- ════════════════════════════════════════════════════════════════════════
-- 기존 링크 28,079건은 전부 'imported'. 코퍼스 관측으로 새로 붙는 링크는 출처가 달라야
-- 나중에 되돌리거나 재평가할 수 있다.

ALTER TABLE public.dictionary_word_categories
  DROP CONSTRAINT IF EXISTS dictionary_word_categories_source_check;
ALTER TABLE public.dictionary_word_categories
  ADD CONSTRAINT dictionary_word_categories_source_check
  CHECK (source IN ('imported','manual','ai-suggested','corpus-derived'));

-- ════════════════════════════════════════════════════════════════════════
-- 7. RPC
-- ════════════════════════════════════════════════════════════════════════

-- 7-1. 큐 적재 — 같은 (source, external_id) 는 무시. 재실행 안전.
CREATE OR REPLACE FUNCTION public.enqueue_topic_corpus_docs(
  p_source_id text,
  p_docs      jsonb          -- [{"external_id":"...","url":"...","title":"..."}]
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_inserted integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM topic_corpus_sources WHERE id = p_source_id) THEN
    RAISE EXCEPTION 'unknown topic corpus source: %', p_source_id;
  END IF;

  WITH src AS (
    SELECT
      d->>'external_id' AS external_id,
      d->>'url'         AS url,
      NULLIF(d->>'title','') AS title
    FROM jsonb_array_elements(p_docs) AS d
    WHERE COALESCE(d->>'external_id','') <> '' AND COALESCE(d->>'url','') <> ''
  ), ins AS (
    INSERT INTO topic_corpus_queue (source_id, external_id, url, title)
    SELECT p_source_id, external_id, url, title FROM src
    ON CONFLICT (source_id, external_id) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted FROM ins;

  RETURN v_inserted;
END;
$fn$;

-- 7-2. 배치 claim — 동시 드레인 안전(SKIP LOCKED). 좀비 claim(30분 초과)은 자동 회수.
CREATE OR REPLACE FUNCTION public.claim_topic_corpus_batch(
  p_source_id text DEFAULT NULL,
  p_limit     integer DEFAULT 5
) RETURNS TABLE (id uuid, source_id text, external_id text, url text, title text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  -- 좀비 회수: 드레인 프로세스가 죽으면 claimed 로 영원히 남아 큐가 조용히 마른다.
  UPDATE topic_corpus_queue q
     SET status = 'pending', claimed_at = NULL, updated_at = now()
   WHERE q.status = 'claimed' AND q.claimed_at < now() - interval '30 minutes';

  RETURN QUERY
  WITH picked AS (
    SELECT q.id FROM topic_corpus_queue q
     WHERE q.status = 'pending'
       AND (p_source_id IS NULL OR q.source_id = p_source_id)
       AND q.attempts < 3
     ORDER BY q.created_at
     LIMIT GREATEST(p_limit, 1)
     FOR UPDATE SKIP LOCKED
  )
  UPDATE topic_corpus_queue q
     SET status = 'claimed', claimed_at = now(), attempts = q.attempts + 1, updated_at = now()
    FROM picked
   WHERE q.id = picked.id
  RETURNING q.id, q.source_id, q.external_id, q.url, q.title;
END;
$fn$;

-- 7-3. claim 해제 — 수확 실패 시 사유와 함께 되돌린다(attempts 3회 초과면 failed 고정).
CREATE OR REPLACE FUNCTION public.release_topic_corpus_claim(
  p_id     uuid,
  p_status text,                 -- 'pending' | 'skipped' | 'failed'
  p_error  text DEFAULT NULL
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  UPDATE topic_corpus_queue
     SET status = CASE
                    WHEN p_status = 'pending' AND attempts >= 3 THEN 'failed'
                    ELSE p_status
                  END,
         last_error = p_error,
         claimed_at = NULL,
         completed_at = CASE WHEN p_status IN ('skipped','failed') THEN now() ELSE NULL END,
         updated_at = now()
   WHERE id = p_id;
$fn$;

-- 7-4. 수확 적재 — 이 파이프라인의 심장.
--
-- p_counts 는 {"surface": n, ...} 형태의 **표면형 카운트**다. 표제어 해석은 서버가 한다
-- (`resolve_dict_headword` 5계층) — 클라이언트가 해석하면 사전 상태와 어긋난다.
--
-- 재실행 안전: 같은 (source_id, external_id) 를 다시 넣으면 **아무것도 하지 않고** 0 을 돌려준다.
-- 통계에 두 번 더해지는 것을 막기 위함이다 — doc_freq 는 되돌릴 수 없으므로 여기서 막아야 한다.
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
AS $$
DECLARE
  v_doc_id     uuid;
  v_unique     integer := 0;
  v_resolved   integer := 0;
  v_gap        integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM topic_corpus_sources WHERE id = p_source_id) THEN
    RAISE EXCEPTION 'unknown topic corpus source: %', p_source_id;
  END IF;

  -- 이미 수확한 문서면 통계를 건드리지 않는다.
  SELECT id INTO v_doc_id FROM topic_corpus_docs
   WHERE source_id = p_source_id AND external_id = p_external_id;
  IF v_doc_id IS NOT NULL THEN
    RETURN jsonb_build_object('doc_id', v_doc_id, 'already_ingested', true,
                              'unique_words', 0, 'resolved_words', 0, 'gap_words', 0);
  END IF;

  -- 표면형 → 표제어 해석. 여러 표면형이 같은 표제어로 접히면 카운트를 합친다.
  -- ON COMMIT DROP 이지만, 한 트랜잭션에서 두 번 호출되는 경우(배치 SQL)를 위해 먼저 지운다.
  DROP TABLE IF EXISTS _tc_words;
  CREATE TEMP TABLE _tc_words ON COMMIT DROP AS
  SELECT
    lower(trim(e.key))                    AS surface,
    GREATEST((e.value)::text::integer, 1) AS n,
    resolve_dict_headword(e.key)          AS headword
  FROM jsonb_each(p_counts) AS e
  WHERE length(trim(e.key)) >= 2;

  SELECT COUNT(*) INTO v_unique FROM _tc_words;

  -- 해석 성공분 → 주제 통계. doc_freq 는 표제어당 **1** (같은 문서 안 중복 계상 금지).
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

  -- 해석 실패분 → 사전 갭 백로그. user_id NULL = 코퍼스 유래(학습자 신고와 구분된다).
  WITH gaps AS (
    SELECT surface, SUM(n)::integer AS n
    FROM _tc_words WHERE headword IS NULL
    GROUP BY surface
  ), merged AS (
    UPDATE pending_words p
       SET encounter_count = p.encounter_count + g.n, updated_at = now()
      FROM gaps g
     WHERE p.lemma = g.surface AND p.user_id IS NULL AND p.status = 'pending'
    RETURNING p.lemma
  ), fresh AS (
    INSERT INTO pending_words (lemma, surface, user_id, encounter_count, context_snippet)
    SELECT g.surface, g.surface, NULL, g.n, 'corpus:' || p_source_id
      FROM gaps g
     WHERE NOT EXISTS (SELECT 1 FROM merged m WHERE m.lemma = g.surface)
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

-- 7-5. 카테고리 승격 — 관측을 `dictionary_word_categories` 로 올린다.
--
-- 기본값(doc_freq≥3 · salience≥1.0)의 뜻: "서로 다른 글 3편 이상에서 나왔고, 배경 대비
-- 최소 e배(≈2.7배) 과대표집" — 한 편의 특이한 강연이 카테고리를 만들지 못하게 하는 문턱이다.
-- 이미 있는 링크(imported 포함)는 건드리지 않는다 — 사전 편찬 판정을 관측이 덮어쓰지 않는다.
CREATE OR REPLACE FUNCTION public.apply_topic_categories(
  p_source_id     text,
  p_min_doc_freq  integer DEFAULT 3,
  p_min_salience  numeric DEFAULT 1.0,
  p_max_words     integer DEFAULT 500,
  p_dry_run       boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_category text;
  v_eligible integer := 0;
  v_applied  integer := 0;
BEGIN
  SELECT category_id INTO v_category FROM topic_corpus_sources WHERE id = p_source_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown topic corpus source: %', p_source_id;
  END IF;
  IF v_category IS NULL THEN
    RETURN jsonb_build_object('source_id', p_source_id, 'category_id', NULL,
                              'eligible', 0, 'applied', 0,
                              'note', 'category_id 미지정 소스 — 통계만 쌓고 승격하지 않는다');
  END IF;

  DROP TABLE IF EXISTS _tc_promote;
  CREATE TEMP TABLE _tc_promote ON COMMIT DROP AS
  SELECT v.word
    FROM v_topic_word_salience v
   WHERE v.source_id = p_source_id
     AND v.doc_freq >= p_min_doc_freq
     AND v.salience >= p_min_salience
     -- 이미 그 카테고리에 붙어 있으면 대상이 아니다.
     AND NOT EXISTS (
       SELECT 1 FROM dictionary_word_categories d
        WHERE d.word = v.word AND d.category_id = v_category)
   ORDER BY v.salience DESC, v.doc_freq DESC
   LIMIT GREATEST(p_max_words, 0);

  SELECT COUNT(*) INTO v_eligible FROM _tc_promote;

  IF NOT p_dry_run THEN
    WITH ins AS (
      INSERT INTO dictionary_word_categories (word, category_id, source)
      SELECT word, v_category, 'corpus-derived' FROM _tc_promote
      ON CONFLICT (word, category_id) DO NOTHING
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_applied FROM ins;
  END IF;

  RETURN jsonb_build_object(
    'source_id', p_source_id, 'category_id', v_category,
    'eligible', v_eligible, 'applied', v_applied, 'dry_run', p_dry_run,
    'min_doc_freq', p_min_doc_freq, 'min_salience', p_min_salience
  );
END;
$fn$;

-- 7-6. Admin 현황 — 소스별 큐/수확/통계 한 줄씩.
CREATE OR REPLACE FUNCTION public.topic_corpus_overview()
RETURNS TABLE (
  source_id text, label_en text, label_ko text, category_id text,
  license text, is_active boolean,
  queued integer, claimed integer, done integer, failed integer,
  docs integer, running_words bigint, distinct_words integer,
  gap_words bigint, promoted integer, last_harvest timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    s.id, s.label_en, s.label_ko, s.category_id, s.license, s.is_active,
    COALESCE(q.queued,0)::integer, COALESCE(q.claimed,0)::integer,
    COALESCE(q.done,0)::integer,   COALESCE(q.failed,0)::integer,
    COALESCE(d.docs,0)::integer,   COALESCE(d.running_words,0)::bigint,
    COALESCE(w.distinct_words,0)::integer, COALESCE(d.gap_words,0)::bigint,
    COALESCE(p.promoted,0)::integer, d.last_harvest
  FROM topic_corpus_sources s
  LEFT JOIN (
    SELECT source_id,
           COUNT(*) FILTER (WHERE status='pending') queued,
           COUNT(*) FILTER (WHERE status='claimed') claimed,
           COUNT(*) FILTER (WHERE status='done')    done,
           COUNT(*) FILTER (WHERE status IN ('failed','skipped')) failed
      FROM topic_corpus_queue GROUP BY source_id
  ) q ON q.source_id = s.id
  LEFT JOIN (
    SELECT source_id, COUNT(*) docs, SUM(running_words) running_words,
           SUM(gap_words) gap_words, MAX(harvested_at) last_harvest
      FROM topic_corpus_docs GROUP BY source_id
  ) d ON d.source_id = s.id
  LEFT JOIN (
    SELECT source_id, COUNT(*) distinct_words FROM topic_word_stats GROUP BY source_id
  ) w ON w.source_id = s.id
  LEFT JOIN (
    SELECT tcs.id AS source_id, COUNT(*) promoted
      FROM topic_corpus_sources tcs
      JOIN dictionary_word_categories dwc
        ON dwc.category_id = tcs.category_id AND dwc.source = 'corpus-derived'
     GROUP BY tcs.id
  ) p ON p.source_id = s.id
  ORDER BY s.sort_order, s.id;
$fn$;

-- ════════════════════════════════════════════════════════════════════════
-- 8. RLS — 코퍼스 통계는 서비스/관리자 전용. 학습자 화면은 읽지 않는다.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.topic_corpus_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_corpus_queue   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_corpus_docs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_word_stats     ENABLE ROW LEVEL SECURITY;

DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['topic_corpus_sources','topic_corpus_queue',
                           'topic_corpus_docs','topic_word_stats']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_admin_all ON public.%I', t, t);
    EXECUTE format($p$
      CREATE POLICY %I_admin_all ON public.%I FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.user_profiles up
                      WHERE up.user_id = auth.uid() AND up.role IN ('admin','curator')))
      WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles up
                      WHERE up.user_id = auth.uid() AND up.role IN ('admin','curator')))
    $p$, t, t);
  END LOOP;
END $do$;

GRANT EXECUTE ON FUNCTION public.enqueue_topic_corpus_docs(text, jsonb)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_topic_corpus_batch(text, integer)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_topic_corpus_claim(uuid, text, text)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_topic_categories(text, integer, numeric, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.topic_corpus_overview()                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_topic_corpus_doc(
  text, text, text, text, jsonb, integer, integer, text, text, timestamptz)     TO authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 9. TED 15 주제 시드 — ted.com/discover 의 주제 칩 목록
-- ════════════════════════════════════════════════════════════════════════
--
-- category_id 는 **기본 승격 목표**다. TED 주제와 Oxford taxonomy 는 1:1 이 아니므로
-- 일부는 근사(sleep → health-health-and-fitness, motivation → people-personal-qualities).
-- 손실은 없다 — 주제별 원시 통계는 topic_word_stats 에 TED 주제 그대로 남는다.
--
-- 라이선스: TED 강연 자막은 CC BY-NC-ND 4.0 (비영리·2차적저작물 금지) → text_reusable=false.
-- TCP 는 어휘 카운트만 남기므로 수확 자체는 이 라이선스와 충돌하지 않는다.

INSERT INTO public.topic_corpus_sources
  (id, provider, topic_key, label_en, label_ko, category_id, license, license_url, text_reusable, sort_order)
VALUES
  ('ted:ai',              'ted','ai',             'AI',              'AI',        'science-and-technology-computers',      'CC BY-NC-ND 4.0','https://www.ted.com/about/our-organization/our-policies-terms/ted-talks-usage-policy', false,  1),
  ('ted:technology',      'ted','technology',     'Technology',      '기술',      'science-and-technology',                'CC BY-NC-ND 4.0','https://www.ted.com/about/our-organization/our-policies-terms/ted-talks-usage-policy', false,  2),
  ('ted:sustainability',  'ted','sustainability', 'Sustainability',  '지속가능성','the-natural-world-the-environment',      'CC BY-NC-ND 4.0','https://www.ted.com/about/our-organization/our-policies-terms/ted-talks-usage-policy', false,  3),
  ('ted:business',        'ted','business',       'Business',        '비즈니스',  'work-and-business-business',            'CC BY-NC-ND 4.0','https://www.ted.com/about/our-organization/our-policies-terms/ted-talks-usage-policy', false,  4),
  ('ted:health',          'ted','health',         'Health',          '건강',      'health-health-and-fitness',             'CC BY-NC-ND 4.0','https://www.ted.com/about/our-organization/our-policies-terms/ted-talks-usage-policy', false,  5),
  ('ted:personal-growth', 'ted','personal-growth','Personal Growth', '자기계발',  'people-personal-qualities',             'CC BY-NC-ND 4.0','https://www.ted.com/about/our-organization/our-policies-terms/ted-talks-usage-policy', false,  6),
  ('ted:ted-ed',          'ted','ted-ed',         'TED-Ed',          'TED-Ed',    'people-education',                      'CC BY-NC-ND 4.0','https://www.ted.com/about/our-organization/our-policies-terms/ted-talks-usage-policy', false,  7),
  ('ted:psychology',      'ted','psychology',     'Psychology',      '심리학',    'people-feelings',                       'CC BY-NC-ND 4.0','https://www.ted.com/about/our-organization/our-policies-terms/ted-talks-usage-policy', false,  8),
  ('ted:leadership',      'ted','leadership',     'Leadership',      '리더십',    'work-and-business-working-life',        'CC BY-NC-ND 4.0','https://www.ted.com/about/our-organization/our-policies-terms/ted-talks-usage-policy', false,  9),
  ('ted:education',       'ted','education',      'Education',       '교육',      'people-education',                      'CC BY-NC-ND 4.0','https://www.ted.com/about/our-organization/our-policies-terms/ted-talks-usage-policy', false, 10),
  ('ted:sleep',           'ted','sleep',          'Sleep',           '수면',      'health-health-and-fitness',             'CC BY-NC-ND 4.0','https://www.ted.com/about/our-organization/our-policies-terms/ted-talks-usage-policy', false, 11),
  ('ted:mental-health',   'ted','mental-health',  'Mental Health',   '정신건강',  'health-mental-health',                  'CC BY-NC-ND 4.0','https://www.ted.com/about/our-organization/our-policies-terms/ted-talks-usage-policy', false, 12),
  ('ted:motivation',      'ted','motivation',     'Motivation',      '동기부여',  'people-personal-qualities',             'CC BY-NC-ND 4.0','https://www.ted.com/about/our-organization/our-policies-terms/ted-talks-usage-policy', false, 13),
  ('ted:communication',   'ted','communication',  'Communication',   '의사소통',  'communication-language',                'CC BY-NC-ND 4.0','https://www.ted.com/about/our-organization/our-policies-terms/ted-talks-usage-policy', false, 14),
  ('ted:sports',          'ted','sports',         'Sports',          '스포츠',    'sport',                                 'CC BY-NC-ND 4.0','https://www.ted.com/about/our-organization/our-policies-terms/ted-talks-usage-policy', false, 15)
ON CONFLICT (id) DO UPDATE
  SET label_en = EXCLUDED.label_en, label_ko = EXCLUDED.label_ko,
      category_id = EXCLUDED.category_id, license = EXCLUDED.license,
      license_url = EXCLUDED.license_url, updated_at = now();
