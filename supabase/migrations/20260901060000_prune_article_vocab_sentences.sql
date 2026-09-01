-- supabase/migrations/20260901060000_prune_article_vocab_sentences.sql
--
-- **어휘 표의 문장 사본을 필요한 17.23% 만 남기는 정리 함수.**
--
-- ⚠️ 이 마이그레이션 자체는 데이터를 바꾸지 않는다 — 함수만 만든다.
--    실제 정리는 `node scripts/acp/prune-vocab-sentences.mjs --commit` 이 이 함수를
--    배치로 호출하면서 일어난다. 그렇게 나눈 이유는 아래 §되돌리기·§디스크 참조.
--
-- ── 왜 (실측 2026-09-01) ──────────────────────────────────────────────
-- `library_article_vocabularies.first_sentence` 는 평균 188 B × 11,011,463행 = **약 2,081 MB**,
-- 정리 후 heap 의 71% 다. 그런데 이 값은 원문 속 문장의 **무압축 사본**이고
-- (2 KB 미만이라 TOAST 압축이 안 걸린다 — 표본 22,738행 중 압축된 행 0개),
-- 한 기사 안에서 같은 문장이 평균 **4.48번** 중복된다.
--
-- 누가 실제로 읽는가를 다 세어 봤다:
--
--   ① 학습자 글 단어장 — `select_article_vocab` → `publish_article_word_set` 가
--      `shared_words.source_sentence` 로 복사한다. **이미 복사가 끝났다**:
--      발행 단어장 279개 · 8,960낱말 중 `source_sentence` 있는 것 **8,960/8,960**.
--      즉 학습자가 받는 값은 이 컬럼에 의존하지 않는다.
--   ② 사전 채굴 — `select_article_coverage` · `select_extraction_residual` 이 문맥으로 쓴다.
--      **사전 미등재 낱말에만** 필요한데, **두 함수의 자가 다르다**:
--        · `select_extraction_residual` — `shared_dictionary` **직접 조회** + `lexicon_clean`
--        · `select_article_coverage`    — `en_inflection_bases` 로 **굴절형까지** 되짚음
--      그래서 **둘의 합집합**을 남겨야 한다.
--
--      ⚠️ 이 자리에서 실제로 결함을 하나 냈다가 잡았다(2026-09-01). 처음엔 굴절형 자만
--         써서 표본 21,610 중 975행만 남기게 했는데, `select_extraction_residual` 은
--         **3,352행**이 필요하다. 그대로 적용했으면 사전 채굴 잔차 목록이 조용히
--         11%p 줄고, 줄어든 목록을 근거로 "사전이 다 찼다" 고 오판했을 것이다.
--         (그 행들은 `bool_or(fs IS NOT NULL AND ...)` 가 false 가 되어 출력에서 사라진다 —
--          오류가 아니라 **누락**으로 나타나므로 눈에 안 띈다.)
--   ③ Admin 검수 화면 — 발행 전 글을 본다. 발행 글은 아래 규칙이 통째로 보존한다.
--   ④ 조판 — **안 읽는다.** `volume-pool.mjs` 가 `library_article_id, word,
--      frequency_in_article` 3열만 받는다(그 파일 주석에 실측이 적혀 있다).
--
-- ── 남기는 규칙 (보수적으로 겹쳐 잡았다) ──────────────────────────────
--   (a) 기사가 `status = 'published'` 이면 그 기사의 **모든 행**을 남긴다.
--       → 새로 단어장을 발행해도 문장이 그대로 붙는다. ①의 회귀를 원천 차단한다.
--   (b) 낱말이 4자 이상이고 `shared_dictionary` 에 직접 없으며,
--       **굴절형으로도 안 풀리거나(coverage 몫) `lexicon_clean` 에도 없으면(residual 몫)** 남긴다.
--   그 외 전부 NULL. 표본 실측 **남김 17.23% · 비움 82.77%**.
--
-- ── 절감 ──────────────────────────────────────────────────────────────
--   heap 3,199 → 약 1,180 MB · 총 3,850 → **약 1,830 MB** (VACUUM FULL 뒤)
--   (세션 시작 4,249 MB 대비 −57%)
--   ⚠️ 안전한 합집합을 쓰느라 굴절형 자만 썼을 때(1,590 MB)보다 240 MB 를 더 쓴다.
--      그 240 MB 가 사전 채굴의 정확도다 — 바꿀 값이 아니다.
--
-- ── 되돌리기 ──────────────────────────────────────────────────────────
-- **잃는 정보가 없다.** 비운 문장은 보관 중인 `library_articles.content` 에
--   normalizePunctuation → reflowSoftHyphens → extractBookLemmas → computeLearningValue
-- 를 돌리면 **비트 단위로** 되살아난다(6편 2,565행 대조 · 불일치 0 · 편당 46.5 ms).
-- 그래서 이것은 삭제가 아니라 **캐시 축출**이다.
--
-- ── 디스크 (배치로 나눈 이유) ──────────────────────────────────────────
-- UPDATE 는 행마다 새 버전을 쓴다. 11M 행을 한 번에 비우면 heap 이 정리 전에 **두 배**로
-- 부풀어 디스크가 위험하다(DB 가 이미 7.6 GB). 그래서 스크립트가 배치마다 끊어 부르고
-- 사이사이 일반 `VACUUM` 으로 공간을 재사용시킨다. 마지막에 `VACUUM FULL` 한 번.
--
-- ── 재실행 안전 ────────────────────────────────────────────────────────
-- 이미 NULL 인 행은 `first_sentence IS NOT NULL` 조건에서 빠진다. 몇 번을 돌려도
-- 같은 결과이고, 중간에 끊겨도 이어서 돌리면 된다. 남길 행은 절대 건드리지 않는다.

-- 한 배치를 비운다. 비운 행 수와 남은 대상 수를 돌려준다.
-- p_limit 은 한 번에 손댈 행 수 — 스크립트가 디스크를 보며 조절한다.
CREATE OR REPLACE FUNCTION public.prune_article_vocab_sentences(p_limit integer DEFAULT 50000)
RETURNS TABLE(pruned integer, scanned integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '600000'
AS $function$
DECLARE
  v_pruned integer;
  v_scanned integer;
BEGIN
  -- ⚠️ ctid 로 고른다. 이 표에는 대리키가 없고(마이그레이션 20260901040000 이 걷었다)
  --    복합키로 IN 을 만들면 조건이 커져 계획이 나빠진다. ctid 는 한 배치 안에서만
  --    유효하지만 우리는 고르자마자 같은 문장에서 쓰므로 안전하다.
  WITH target AS (
    SELECT l.ctid
    FROM library_article_vocabularies l
    JOIN library_articles a ON a.id = l.library_article_id
    WHERE l.first_sentence IS NOT NULL
      -- (a) 발행 글은 통째로 남긴다
      AND a.status <> 'published'
      -- (b) 사전에서 안 풀리는 낱말은 남긴다 (사전 채굴의 문맥)
      AND NOT (
        length(l.word) >= 4
        AND NOT EXISTS (
          SELECT 1 FROM shared_dictionary d
          WHERE d.word = lower(l.word)
            AND d.classified_by IS NOT NULL
            AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0
        )
        AND (
          -- coverage 몫 — 굴절형으로도 안 풀린다
          NOT EXISTS (
            SELECT 1 FROM shared_dictionary d2
            WHERE d2.word = ANY (en_inflection_bases(lower(l.word)))
              AND d2.classified_by IS NOT NULL
              AND d2.meaning_ko IS NOT NULL AND length(d2.meaning_ko) > 0
          )
          -- residual 몫 — 그쪽 자는 굴절형을 안 보고 lexicon_clean 을 본다
          OR NOT EXISTS (
            SELECT 1 FROM lexicon_clean c
            WHERE c.word = lower(l.word)
              AND (c.meaning_ko IS NOT NULL OR c.gloss_en IS NOT NULL)
          )
        )
      )
    LIMIT p_limit
  ), upd AS (
    UPDATE library_article_vocabularies v
    SET first_sentence = NULL
    FROM target t
    WHERE v.ctid = t.ctid
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM upd)::integer, (SELECT count(*) FROM target)::integer
    INTO v_pruned, v_scanned;

  pruned := v_pruned;
  scanned := v_scanned;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.prune_article_vocab_sentences(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prune_article_vocab_sentences(integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_article_vocab_sentences(integer) TO service_role;

COMMENT ON FUNCTION public.prune_article_vocab_sentences(integer) IS
  '어휘 표의 first_sentence 를 필요한 것만 남기고 배치로 비운다(캐시 축출 — 원문에서 46.5ms/편에 재현 가능). 남기는 것: 발행 글의 전 행 + 사전에서 안 풀리는 4자 이상 낱말. service_role 전용. 드라이버: scripts/acp/prune-vocab-sentences.mjs';

-- 남은 대상 수를 세는 읽기 전용 짝 — 스크립트가 진행률과 종료 판정에 쓴다.
-- (정리 함수와 **같은 술어**를 쓴다. 둘이 갈라지면 스크립트가 끝나지 않는다.)
CREATE OR REPLACE FUNCTION public.count_article_vocab_prunable()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '600000'
AS $function$
  SELECT count(*)
  FROM library_article_vocabularies l
  JOIN library_articles a ON a.id = l.library_article_id
  WHERE l.first_sentence IS NOT NULL
    AND a.status <> 'published'
    AND NOT (
      length(l.word) >= 4
      AND NOT EXISTS (
        SELECT 1 FROM shared_dictionary d
        WHERE d.word = lower(l.word)
          AND d.classified_by IS NOT NULL
          AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0
      )
      AND (
        -- coverage 몫 — 굴절형으로도 안 풀린다
        NOT EXISTS (
          SELECT 1 FROM shared_dictionary d2
          WHERE d2.word = ANY (en_inflection_bases(lower(l.word)))
            AND d2.classified_by IS NOT NULL
            AND d2.meaning_ko IS NOT NULL AND length(d2.meaning_ko) > 0
        )
        -- residual 몫 — 그쪽 자는 굴절형을 안 보고 lexicon_clean 을 본다
        OR NOT EXISTS (
          SELECT 1 FROM lexicon_clean c
          WHERE c.word = lower(l.word)
            AND (c.meaning_ko IS NOT NULL OR c.gloss_en IS NOT NULL)
        )
      )
    )
$function$;

REVOKE ALL ON FUNCTION public.count_article_vocab_prunable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.count_article_vocab_prunable() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_article_vocab_prunable() TO service_role;

COMMENT ON FUNCTION public.count_article_vocab_prunable() IS
  'prune_article_vocab_sentences 와 같은 술어로 남은 대상 수를 센다(읽기 전용). 진행률·종료 판정용.';
