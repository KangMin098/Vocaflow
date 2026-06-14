-- supabase/migrations/20260614180000_acp_article_word_set_pipeline.sql
-- ACP v1.1 — 글(스크립트)을 LCP 책과 동일한 학습 모델로: 발행 시 단어장 자동 생성 + 학습 시작 시 구독.
--
-- 책(LCP) 체인 미러:
--   admin_force_publish_book → trigger → publish_book_word_sets → shared_word_sets(library_book) + shared_words
--   enroll_library_book → _enroll_book_subscribe_word_sets → user_word_set_subscriptions + vocabularies
-- 글(ACP) 대응 (글=단일 섹션이라 챕터 루프 대신 단어장 1개):
--   admin_force_publish_article → trigger(신규) → publish_article_word_set → shared_word_sets(library_article) + shared_words
--   startArticleLearning → subscribe_article_word_set(신규) → user_word_set_subscriptions + vocabularies
--
-- 선정 로직은 select_book_chapter_vocab 동일 정책: register 필터(고어/시대어/구phrase 제외)
--   + classified_by/meaning_ko 존재 + composite(freq 0.70 + salience 0.10) 랭킹.
--   책의 v_level >= book_v_level 임계는 글에 book_v_level 이 없어 제외(글 학습 단어 전부 후보).

-- ─────────────────────────────────────────────────────────────
-- 1. 글 학습 단어 선정 (select_book_chapter_vocab 의 단일-섹션 버전)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.select_article_vocab(p_article_id uuid)
RETURNS TABLE(
  word text, lemma text, meaning_ko text, v_level smallint, cefr_level text,
  pos text, example_en text, word_register text, frequency_rank integer,
  frequency_in_article integer, skill_level smallint, composite_score numeric,
  sort_order integer, first_sentence text
)
LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  WITH cand AS (
    SELECT DISTINCT ON (sd.word)
      sd.word                          AS word,
      sd.meaning_ko                    AS meaning_ko,
      sd.v_level                       AS v_level,
      sd.cefr_level                    AS cefr_level,
      sd.pos                           AS pos,
      sd.example_en                    AS example_en,
      COALESCE(sd.word_register, 'standard') AS word_register,
      sd.frequency_rank                AS frequency_rank,
      av.frequency_in_article          AS frequency_in_article,
      sd.skill_level                   AS skill_level,
      av.first_sentence                AS first_sentence
    FROM library_article_vocabularies av
    JOIN shared_dictionary sd ON sd.word = COALESCE(av.lemma, av.word)
    WHERE av.library_article_id = p_article_id
      AND sd.classified_by IS NOT NULL
      AND sd.meaning_ko IS NOT NULL AND length(sd.meaning_ko) > 0
      AND COALESCE(sd.word_register, 'standard')
            NOT IN ('archaic_literary', 'period_cultural', 'phrase_unit')
    ORDER BY sd.word, av.frequency_in_article DESC NULLS LAST
  ),
  scored AS (
    SELECT c.*,
      ROUND(
          0.70 * (1.0 / LOG(10, COALESCE(c.frequency_rank, 50000)::numeric + 10))
        + 0.10 * (1.0 - 1.0 / (COALESCE(c.frequency_in_article, 1) + 1))
      , 4) AS composite_score
    FROM cand c
  )
  SELECT
    s.word,
    s.word AS lemma,
    s.meaning_ko,
    s.v_level,
    s.cefr_level,
    s.pos,
    s.example_en,
    s.word_register,
    s.frequency_rank,
    s.frequency_in_article,
    s.skill_level,
    s.composite_score,
    ROW_NUMBER() OVER (
      ORDER BY s.composite_score DESC, s.frequency_in_article DESC NULLS LAST,
               s.v_level ASC, s.word
    )::int AS sort_order,
    s.first_sentence
  FROM scored s
$function$;

-- ─────────────────────────────────────────────────────────────
-- 2. 글 발행 시 단어장 1개 생성 (publish_book_word_sets 의 단일-set 버전, 멱등)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.publish_article_word_set(p_article_id uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $function$
DECLARE
  v_art RECORD;
  v_set_id uuid;
  v_count int;
BEGIN
  SELECT id, title, cefr_level, source INTO v_art
  FROM library_articles WHERE id = p_article_id;
  IF v_art IS NULL THEN RAISE EXCEPTION 'Article % not found', p_article_id; END IF;

  -- 이미 발행된 단어장 있으면 재사용 (멱등 — 재발행 시 중복 생성 방지)
  SELECT id INTO v_set_id FROM shared_word_sets
   WHERE category = 'library_article'
     AND (curation_query->>'article_id') = p_article_id::text;
  IF v_set_id IS NOT NULL THEN RETURN v_set_id; END IF;

  INSERT INTO shared_word_sets (
    title, description, category, cefr_level, is_published, auto_curated,
    slug, cover_emoji, version, curation_query
  ) VALUES (
    v_art.title,
    '스크립트 핵심 어휘 — ' || COALESCE(v_art.source, 'article'),
    'library_article', v_art.cefr_level, true, true,
    'article-' || v_art.id::text,
    '📄', 1,
    jsonb_build_object(
      'article_id', v_art.id,
      'filter', 'select_article_vocab',
      'selection', 'v06.51 learning-optimal (register-filtered, composite-ranked)'
    )
  ) RETURNING id INTO v_set_id;

  INSERT INTO shared_words (
    set_id, word, lemma, meaning_ko, cefr_level, sort_order,
    source_sentence, part_of_speech, example_en
  )
  SELECT v_set_id, s.word, s.lemma, s.meaning_ko, s.cefr_level, s.sort_order,
         s.first_sentence, s.pos, s.example_en
  FROM select_article_vocab(p_article_id) s
  ORDER BY s.sort_order;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE shared_word_sets SET word_count = v_count WHERE id = v_set_id;

  RETURN v_set_id;
END $function$;

-- ─────────────────────────────────────────────────────────────
-- 3. status='published' 전이 트리거 (trg_publish_book_word_sets 미러)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_publish_article_word_set()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published') THEN
    PERFORM publish_article_word_set(NEW.id);
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_la_publish_word_set ON public.library_articles;
CREATE TRIGGER trg_la_publish_word_set
  AFTER UPDATE OF status ON public.library_articles
  FOR EACH ROW EXECUTE FUNCTION trg_publish_article_word_set();

-- ─────────────────────────────────────────────────────────────
-- 4. 학습 시작 시 단어장 구독 + vocabularies 시드 (_enroll_book_subscribe_word_sets 미러)
--    auth.uid() 사용 (임의 user_id 주입 차단) → startArticleLearning 에서 rpc 호출.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.subscribe_article_word_set(p_article_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  INSERT INTO user_word_set_subscriptions (user_id, set_id)
  SELECT v_uid, sws.id
    FROM shared_word_sets sws
   WHERE sws.is_published = true
     AND sws.category = 'library_article'
     AND sws.curation_query->>'article_id' = p_article_id::text
  ON CONFLICT (user_id, set_id) DO NOTHING;

  INSERT INTO vocabularies (
    user_id, word, meaning, example_sentence,
    pronunciation, pos, cefr_level, origin, shared_set_id
  )
  SELECT
    v_uid, sw.word, sw.meaning_ko, sw.example_en,
    sw.pronunciation, sw.part_of_speech, sw.cefr_level, 'shared_set', sw.set_id
  FROM shared_words sw
   JOIN shared_word_sets sws ON sws.id = sw.set_id
  WHERE sws.is_published = true
    AND sws.category = 'library_article'
    AND sws.curation_query->>'article_id' = p_article_id::text
  ON CONFLICT (user_id, word) DO NOTHING;
END $function$;

-- ─────────────────────────────────────────────────────────────
-- 5. 기존 published 글 backfill — 트리거 도입 전 발행분에 단어장 생성
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM library_articles WHERE status = 'published' LOOP
    PERFORM publish_article_word_set(r.id);
  END LOOP;
END $$;
