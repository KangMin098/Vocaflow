-- F: 콘텐츠 품질 게이트 베이스라인이 발견한 결함 즉시 수정.
-- 근거: content_quality_gates 불변식 I7(노이즈 register 발행 누출)·I6(발행도서 lemma NULL).
--   docs/AI_CONTEXT/diagnostics/ext_quality_p0_20260718.md 후속.

-- ── F.1 (학습자 노출) : 발행 세트에 누출된 노이즈-register junk 제거 ──
-- 현 select_*_vocab 는 abbreviation/archaic 등을 게이트 제외하나, 옛 로직으로 발행된 stale 잔존.
-- 예: xl(엑스라지) in P&P Ch.40 · mph/bc/cl/ft. 학습자 단어장에 노출 중.
DELETE FROM shared_words sw
USING shared_word_sets sws, shared_dictionary sd
WHERE sw.set_id = sws.id
  AND sd.word = lower(sw.word)
  AND sws.is_published
  AND sws.category IN ('library_book','library_article')
  AND sd.word_register IN ('archaic_literary','period_cultural','phrase_unit','brand','abbreviation','proper_noun');

-- word_count 재동기 (드리프트난 세트만)
UPDATE shared_word_sets sws SET word_count = c.n
FROM (SELECT set_id, count(*) n FROM shared_words GROUP BY set_id) c
WHERE sws.id = c.set_id AND sws.word_count IS DISTINCT FROM c.n;

-- ── F.2 (위생, 학습자 출력 무변) : 발행 도서 NULL lemma 백필 ──
-- select_*_vocab 는 COALESCE(lemma, word) 로 이미 graceful → 출력 불변.
-- backfill_book_lemmas 로직(exact→inflection base)을 발행 도서 전역에 멱등 적용.
-- percentile/seed 경로 무결성 + I6 위생. 미해소 NULL(dict 부재어)은 그대로 둠.
UPDATE library_book_vocabularies lbv
SET lemma = COALESCE(
  (SELECT d.word FROM shared_dictionary d
     WHERE d.word = lower(trim(lbv.word))
       AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL
       AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0
     LIMIT 1),
  (SELECT id.word FROM unnest(en_inflection_bases(lower(trim(lbv.word)))) AS cand(c)
     JOIN shared_dictionary id ON id.word = cand.c
     WHERE id.v_level IS NOT NULL AND id.classified_by IS NOT NULL
       AND id.meaning_ko IS NOT NULL AND length(id.meaning_ko) > 0
     ORDER BY id.word LIMIT 1)
)
FROM library_books lb
WHERE lbv.library_book_id = lb.id AND lb.status = 'published' AND lbv.lemma IS NULL;
