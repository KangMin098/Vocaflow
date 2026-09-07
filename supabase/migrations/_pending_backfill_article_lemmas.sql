-- supabase/migrations/<ts>_backfill_article_lemmas.sql
--
-- **글 어휘의 `lemma` 를 채우는 함수** — 도서에는 있고 글에는 없던 것.
--
-- ── 무엇이 어긋나 있었나 (2026-08-26 실측) ──────────────────────────
-- `library_article_vocabularies.lemma` 가 **779개 글 132,476행 전부 NULL** 이다.
-- 한 번도 채워진 적이 없다(발행 160 + 대기 619).
--
-- 원인은 파이프라인 한 단계가 빠진 것이다:
--
--   도서(LCP)  analyze → INSERT → **`backfill_book_lemmas(book_id)` 호출** → lemma 94.8% 채움
--   글(ACP)    analyze → INSERT → **(없음)**                              → lemma 100% NULL
--
-- `analyze-article.ts` 의 매핑에도 `lemma` 가 없지만, 도서도 마찬가지다 —
-- 도서는 **INSERT 뒤에 RPC 로 채운다**(`api/lcp/process/route.ts`). 글에는 그 호출이 없고,
-- 부를 함수 자체도 없었다.
--
-- ── 왜 중요한가 ─────────────────────────────────────────────────────
-- 읽는 쪽(`select_article_vocab`)이 lemma 로 사전을 만난다. lemma 가 없으면
-- **굴절형이 통째로 사전과 못 만난다** — `acting` 은 사전에 없고 `act` 가 있다.
-- 표본 3,000행 실측: `word` 직접 매칭 78.3% vs 해석 후 99.1%.
-- 즉 **지금 학습자가 보는 글에서 어휘 다섯 중 하나가 뜻 없이 나온다**(발행 160개 포함).
-- 극단적으로는 매칭이 하나도 안 돼 "추출 0단어" 로 게시가 막힌다(대기 619 중 ~70개).
--
-- ── 로직은 도서와 **같아야 한다** ───────────────────────────────────
-- 두 파이프라인이 다른 규칙으로 lemma 를 정하면 같은 낱말이 도서와 글에서 다른 표제어에
-- 붙고, 학습자의 단어장이 갈라진다. 그래서 `backfill_book_lemmas` 본문을 그대로 따른다:
--   ① `word` 가 사전에 직접 있으면 그것
--   ② 없으면 `en_inflection_bases()` 후보 중 사전에 있는 것
--      (`en_negation_preserved` 로 부정 뒤집힘 차단 · 축약어 제외)
-- 어느 쪽도 못 찾으면 **NULL 로 남긴다** — 틀린 표제어를 붙이는 것보다 없는 편이 낫다.
--
-- ⚠️ 이 함수는 **재실행 안전**하다(`WHERE lemma IS NULL` — 이미 채운 것을 건드리지 않는다).
--    사전이 자라면 다시 돌려 남은 NULL 을 줄일 수 있다.

CREATE OR REPLACE FUNCTION public.backfill_article_lemmas(p_article_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_filled INT;
BEGIN
  UPDATE library_article_vocabularies lav
  SET lemma = COALESCE(
    (SELECT d.word FROM shared_dictionary d
       WHERE d.word = lower(trim(lav.word))
         AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL
         AND d.meaning_ko IS NOT NULL AND LENGTH(d.meaning_ko) > 0
       LIMIT 1),
    (SELECT id.word FROM unnest(en_inflection_bases(lower(trim(lav.word)))) AS cand(c)
       JOIN shared_dictionary id ON id.word = cand.c
       WHERE id.v_level IS NOT NULL AND id.classified_by IS NOT NULL
         AND id.meaning_ko IS NOT NULL AND LENGTH(id.meaning_ko) > 0
         AND en_negation_preserved(lower(trim(lav.word)), id.word)
         AND COALESCE(id.word_register, 'standard') <> 'abbreviation'
       ORDER BY id.word LIMIT 1)
  )
  WHERE lav.library_article_id = p_article_id AND lav.lemma IS NULL;

  GET DIAGNOSTICS v_filled = ROW_COUNT;
  RETURN v_filled;
END $function$;

COMMENT ON FUNCTION public.backfill_article_lemmas(uuid) IS
  '글 어휘의 lemma 를 사전 표제어로 채운다. backfill_book_lemmas 와 같은 규칙 — '
  '두 파이프라인이 다른 규칙을 쓰면 같은 낱말이 도서와 글에서 다른 표제어에 붙는다. '
  'WHERE lemma IS NULL 이라 재실행 안전.';
