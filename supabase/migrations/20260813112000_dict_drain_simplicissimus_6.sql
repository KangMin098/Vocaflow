-- supabase/migrations/20260813112000_dict_drain_simplicissimus_6.sql
-- 사전 등재 큐 드레인 6건 — 20260813103000 이 addable_modern 으로 올린 것.
-- 절차는 project_book_dict_registration_process 의 2-phase 중 phase 2:
--   addable_modern SELECT → 뜻 생성 → shared_dictionary INSERT(ON CONFLICT DO NOTHING)
--   → archaic_candidates processed 마킹 → backfill_book_lemmas 재실행.
--
-- word_register 는 단어별 실제 성격대로 부여했다 (일괄 배제용으로 쓰지 않는다):
--   landsknecht·mainguard = period_cultural  (30년전쟁 군사 역사어)
--   gallowsbird·inkslinger = archaic_literary (고어·구식 속어)
--   holmoak·wheatsheaf     = modern_advanced  (현대에도 쓰는 희귀 복합명사)
-- 앞 4개는 select_book_chapter_vocab 의 register 배제에 걸려 학습 세트에 들어가지 않는다.
-- 뒤 2개는 배제 대상이 아니지만 책 내 1회 출현이라 composite_score 로 사실상 선정되지 않는다.
--
-- wheatsheaf 는 inflected_forms 에 'wheatsheaves' 를 명시한다 —
-- en_inflection_bases 가 -ves→-f 를 지원하지 않아(실측: wheatsheaves→wheatsheave)
-- cluster 티어만이 책의 복수형을 회수할 수 있다.
--
-- 되돌리기: DELETE FROM shared_dictionary WHERE word IN (...) AND classified_by='claude_code_opus_5';
-- 멱등: ON CONFLICT (word) DO NOTHING.

BEGIN;

-- classified_by 화이트리스트에 Opus 5 추가. 생성 주체를 정확히 기록하기 위한 것으로,
-- 기존 값(rule_v1 · opus_4_7 · sonnet_4_6 · derivational · opus_4_8 · fable_5)은 그대로 둔다.
ALTER TABLE public.shared_dictionary
  DROP CONSTRAINT IF EXISTS shared_dictionary_classified_by_check;
ALTER TABLE public.shared_dictionary
  ADD CONSTRAINT shared_dictionary_classified_by_check
  CHECK (classified_by = ANY (ARRAY[
    'rule_v1', 'claude_code_opus_4_7', 'claude_code_sonnet_4_6',
    'claude_code_derivational', 'claude_code_opus_4_8', 'claude_code_fable_5',
    'claude_code_opus_5'
  ]));

INSERT INTO shared_dictionary
  (word, pos, meaning_ko, meanings_ko, v_level, cefr_level, word_register,
   source, classified_by, example_en, verified, inflected_forms)
VALUES
  ('landsknecht', 'noun',
   '란츠크네히트 — 16~17세기 독일 용병 보병',
   '[{"pos":"noun","meaning":"란츠크네히트 — 16~17세기 독일 용병 보병","v_level":11}]'::jsonb,
   11, 'C2', 'period_cultural', 'ai-generated', 'claude_code_opus_5',
   'And deeds of blood and deeds of shame, all may ye put to the landsknecht''s name.',
   false, NULL),

  ('mainguard', 'noun',
   '본부 위병소, 주력 경비대',
   '[{"pos":"noun","meaning":"본부 위병소, 주력 경비대","v_level":11}]'::jsonb,
   11, 'C2', 'period_cultural', 'ai-generated', 'claude_code_opus_5',
   'The officer posted a sentry before the mainguard.',
   false, NULL),

  ('gallowsbird', 'noun',
   '(고어) 교수형감, 교수대에 갈 놈',
   '[{"pos":"noun","meaning":"(고어) 교수형감, 교수대에 갈 놈","v_level":11}]'::jsonb,
   11, 'C2', 'archaic_literary', 'ai-generated', 'claude_code_opus_5',
   'The old woman called him a rogue and a gallowsbird.',
   false, NULL),

  ('inkslinger', 'noun',
   '(구식 속어·경멸) 글쟁이, 필경사',
   '[{"pos":"noun","meaning":"(구식 속어·경멸) 글쟁이, 필경사","v_level":11}]'::jsonb,
   11, 'C2', 'archaic_literary', 'ai-generated', 'claude_code_opus_5',
   'They took inkslingers and footmen in place of old soldiers.',
   false, NULL),

  ('holmoak', 'noun',
   '털가시나무 — 지중해산 상록 참나무',
   '[{"pos":"noun","meaning":"털가시나무 — 지중해산 상록 참나무","v_level":11}]'::jsonb,
   11, 'C2', 'modern_advanced', 'ai-generated', 'claude_code_opus_5',
   'The holmoak by the wind beset and brought to ruin.',
   false, NULL),

  ('wheatsheaf', 'noun',
   '밀단 — 베어 묶어 세운 밀 다발',
   '[{"pos":"noun","meaning":"밀단 — 베어 묶어 세운 밀 다발","v_level":10}]'::jsonb,
   10, 'C1', 'modern_advanced', 'ai-generated', 'claude_code_opus_5',
   'The reapers bound the corn into wheatsheaves and left them standing in the field.',
   false, ARRAY['wheatsheaves'])
ON CONFLICT (word) DO NOTHING;

-- 큐에서 내린다
UPDATE archaic_candidates
SET classification = 'processed', processed_at = now(), updated_at = now()
WHERE word IN ('landsknecht','mainguard','gallowsbird','inkslinger','holmoak','wheatsheaf')
  AND classification = 'addable_modern';

COMMIT;
