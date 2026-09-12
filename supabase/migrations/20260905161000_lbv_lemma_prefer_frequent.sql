-- supabase/migrations/20260905161000_lbv_lemma_prefer_frequent.sql
--
-- **`shining` 카드가 「정강이」를 가르치고 있었다.**
--
-- `en_inflection_bases('shining')` 은 e-탈락형과 비탈락형을 **둘 다** 돌려준다 —
-- `{shin, shine}`. 그런데 `trg_lbv_fill_lemma` 의 선택이 `ORDER BY id.word LIMIT 1` 이라,
-- 짧은 어간이 긴 표제어의 **접두사**여서 알파벳순에서 **항상 이긴다.**
--
-- 실측 2026-09-05 (`shared_words` 발행분):
--
--   카드 앞면   저장 lemma   학습자가 보는 뜻              옳은 뜻        행
--   shining     shin         정강이, 무릎 아래 다리 앞쪽    빛나다         190
--   spared      spar         스파링하다                    할애하다        126
--   faded       fad          일시적 유행                   바래다          105
--   raging      rag          헝겊, 걸레                    격노            96
--   firing      fir          전나무                        불, 화재        74
--   dined       din          시끄럽고 불쾌한 소음           식사하다        73
--   cured       cur          잡종개, 똥개                  치유하다        73
--   paler       pal          친구 (구어)                   창백한          72
--
-- 뜻만이 아니다 — `flashcard/scoped-words.ts` 의 `fetchDictExtras` 가 **lemma 로** 조회하므로
-- 연어·유의어·니모닉까지 전부 `shin`·`fad`·`cur` 것이 딸려 온다.
--
-- ── 고치는 법 ────────────────────────────────────────────────────────
-- 알파벳순 대신 **빈도순**으로 고른다. `shine`(rank 2,632)이 `shin`(11,107)을,
-- `fire`(613)가 `fir`(9,911)을 이긴다. 검증한 9건이 전부 풀리고, 후보가 하나뿐인
-- `studies→study` · `running→run` · `baked→bake` 는 그대로다.
--
--   ORDER BY id.frequency_rank NULLS LAST, length(id.word) DESC, id.word
--
-- 빈도가 없으면(NULL) 뒤로 보내고, 그다음은 **긴 쪽**을 고른다 — 이 결함이 짧은 쪽이
-- 이겨서 생겼으므로 동점일 때의 기본값을 반대로 둔다. 마지막 `id.word` 는 결정성을 위한 것이다.
--
-- 영향 범위(실측): 굴절 456,944행 중 **307쌍 / 6,846행**만 바뀐다. 좁다.
--
-- ⚠️ 이 마이그레이션은 **앞으로 들어올 행**만 고친다. 이미 박힌 lemma 와, 그것을 복사해 간
--    `shared_words` 의 뜻은 `scripts/dict/backfill-lemma-frequent.mts` 가 배치로 고친다 —
--    `en_inflection_bases` 를 456,944행에 한 문장으로 돌리면 statement timeout 이 난다(실측).

CREATE OR REPLACE FUNCTION public.trg_lbv_fill_lemma()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE library_book_vocabularies lbv
  SET lemma = COALESCE(
    (SELECT d.word FROM shared_dictionary d
       WHERE d.word = lower(trim(lbv.word))
         AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL
         AND d.meaning_ko IS NOT NULL AND LENGTH(d.meaning_ko) > 0
       LIMIT 1),
    (SELECT id.word
       FROM unnest(en_inflection_bases(lower(trim(lbv.word)))) AS cand(c)
       JOIN shared_dictionary id ON id.word = cand.c
       WHERE id.v_level IS NOT NULL AND id.classified_by IS NOT NULL
         AND id.meaning_ko IS NOT NULL AND LENGTH(id.meaning_ko) > 0
         AND en_negation_preserved(lower(trim(lbv.word)), id.word)
         AND COALESCE(id.word_register, 'standard') <> 'abbreviation'
       -- ⚠️ 알파벳순으로 고르면 짧은 어간이 항상 이긴다 (shining→shin 「정강이」).
       --    빈도순으로 고른다. 동점이면 **긴 쪽** — 이 결함이 짧은 쪽이 이겨서 생겼다.
       ORDER BY id.frequency_rank NULLS LAST, length(id.word) DESC, id.word
       LIMIT 1)
  )
  FROM new_rows nr
  WHERE lbv.id = nr.id AND lbv.lemma IS NULL;

  UPDATE library_book_vocabularies lbv
  SET resolved_via  = COALESCE(r.match_via, 'not_found'),
      resolved_lang = r.lang,
      resolved_word = r.resolved_word,
      noise_kind    = COALESCE(
        (SELECT c.classification FROM archaic_candidates c
          WHERE c.word = lower(trim(lbv.word))
            AND c.classification IN ('person_noise', 'geo_noise')
          LIMIT 1),
        CASE WHEN is_quoted_foreign_citation(lbv.first_sentence, lower(trim(lbv.word)))
             THEN 'foreign_citation' END
      )
  FROM new_rows nr
  LEFT JOIN LATERAL lookup_word_meaning(lower(trim(nr.word))) r ON true
  WHERE lbv.id = nr.id AND lbv.lemma IS NULL;

  RETURN NULL;
END $function$;

COMMENT ON FUNCTION public.trg_lbv_fill_lemma() IS
  '표면형 → 표제어. 후보가 여럿이면 **빈도순**으로 고른다 — 알파벳순은 짧은 어간이 '
  '긴 표제어의 접두사라 항상 이겨서 shining→shin(정강이) 같은 뜻을 가르쳤다(실측 2026-09-05).';
