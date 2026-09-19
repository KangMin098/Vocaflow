-- 20260816045733_backfill_published_word_lemma_rebind.sql
--
-- 발행 세트의 낡은 lemma/뜻 190행을 재해석 결과로 백필한다.
--
-- 직전 마이그레이션(20260816045450_publish_lookup_prefers_registered_inflections)이
-- `lookup_word_meaning` 의 단계 순서를 고쳤으나, 이미 발행된 세트는 **복사본**이라 그대로다
-- (M7 SSoT 드리프트와 같은 구조 — 사전만 고치면 학습자 화면은 안 바뀐다).
--
-- 대상 선별 — 전수 확인 후 근거 있는 단계만 (실측 210행 중 190행):
--   O direct     15행 — 표면 자체가 표제어인데 어간에 묶여 있었다 (boorish→boor · brimful→brim)
--   O cluster   162행 — 사전이 명시 등재한 굴절형 (blamed "쾅!"→"비난하다" · calves→calf)
--   O inflection 13행 — 규칙 생성이지만 전수 확인 시 10단어 모두 개선
--                       (sunniest "수니파의"→"햇살이 좋은" · writeth "영장"→"쓰다" · gamer "고래 떼"→"게임")
--   X coverage-clean 18행 제외 — `lexicon_clean` 은 기계번역 덤프라 큐레이션 뜻보다 나쁘다.
--     실측: blowzy "얼굴이 불그레하고 투박한" → "창녀나 걸레의 특징이거나 어울리는 것" ·
--           arrear "연체" → Webster 원문 번역 200자. **덮으면 퇴행이다.**
--   X derivation 2행 제외 — archness: archly(짓궂게)→arch(아치) · evenness: evenly(고르게)→even(심지어).
--     접미사를 떼면 품사와 뜻이 함께 무너지는 경우다.
--
-- example_en 도 함께 옮긴다: 행이 다른 표제어로 재바인딩되므로 예문도 그 표제어 것이어야 한다.
--   (그대로 두면 `sunniest` 행에 수니파 예문이, `blamed` 행에 "Blam!" 의성어 예문이 남는다)
--   새 표제어에 예문이 없으면 NULL — 틀린 예문보다 없는 편이 낫다(ADR 0004 D4).
--
-- 원본: backup.published_lemma_rebind_20260815
--   복원: UPDATE shared_words w SET lemma=b.lemma, meaning_ko=b.meaning_ko, example_en=b.example_en,
--           part_of_speech=b.part_of_speech, cefr_level=b.cefr_level, v_level=b.v_level
--           FROM backup.published_lemma_rebind_20260815 b WHERE w.id = b.row_id;
--
-- 재실행 안전: 두 번째 실행에서는 lemma 가 이미 일치해 대상이 0건.

CREATE TABLE IF NOT EXISTS backup.published_lemma_rebind_20260815 (
  row_id         uuid PRIMARY KEY,
  word           text NOT NULL,
  lemma          text,
  meaning_ko     text,
  example_en     text,
  part_of_speech text,
  cefr_level     text,
  v_level        smallint,
  captured_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TEMP TABLE _rebind ON COMMIT DROP AS
SELECT w.id,
       l.resolved_word AS new_lemma,
       l.meaning_ko    AS new_meaning,
       l.example_en    AS new_example,
       l.pos           AS new_pos,
       l.cefr_level    AS new_cefr,
       l.v_level       AS new_v_level
  FROM shared_words w
  CROSS JOIN LATERAL lookup_word_meaning(w.word) l
 WHERE w.lemma IS NOT NULL AND l.found
   AND lower(w.lemma) IS DISTINCT FROM l.resolved_word
   AND l.match_via IN ('direct','cluster','inflection');

INSERT INTO backup.published_lemma_rebind_20260815
  (row_id, word, lemma, meaning_ko, example_en, part_of_speech, cefr_level, v_level)
SELECT w.id, w.word, w.lemma, w.meaning_ko, w.example_en, w.part_of_speech, w.cefr_level, w.v_level
  FROM shared_words w JOIN _rebind r ON r.id = w.id
ON CONFLICT (row_id) DO NOTHING;

UPDATE shared_words w
   SET lemma          = r.new_lemma,
       meaning_ko     = r.new_meaning,
       example_en     = r.new_example,
       part_of_speech = COALESCE(r.new_pos, w.part_of_speech),
       cefr_level     = COALESCE(r.new_cefr, w.cefr_level),
       v_level        = COALESCE(r.new_v_level, w.v_level)
  FROM _rebind r
 WHERE w.id = r.id;

-- ── 적용 후 확인 (2026-08-16 실측) ───────────────────────────────
--   백업 190행 · 범위 내 잔여 불일치 0 · 범위 밖 잔여 20행(coverage-clean 18 + derivation 2, 의도적)
--   dying→die "죽다" + 예문 "The flowers will die if you don't water them."
--   sunniest→sunny "햇살이 좋은" · writeth→write "(글씨를) 쓰다" · blamed→blame "비난하다"
