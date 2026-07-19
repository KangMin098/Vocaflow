-- VCB 노이즈 정리: F.1(library 세트)을 전 발행 세트로 일반화.
-- 확장 게이트 I7 이 VCB '교육과정 기본어휘(중등)' 세트의 "technic"(archaic, technique 옛표현) 검출.
DELETE FROM shared_words sw
USING shared_word_sets sws, shared_dictionary sd
WHERE sw.set_id = sws.id
  AND sd.word = lower(sw.word)
  AND sws.is_published
  AND sd.word_register IN ('archaic_literary','period_cultural','phrase_unit','brand','abbreviation','proper_noun');

UPDATE shared_word_sets sws SET word_count = c.n
FROM (SELECT set_id, count(*) n FROM shared_words GROUP BY set_id) c
WHERE sws.id = c.set_id AND sws.word_count IS DISTINCT FROM c.n;
