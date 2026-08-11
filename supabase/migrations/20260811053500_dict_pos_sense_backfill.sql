-- 20260811160000_dict_pos_sense_backfill.sql
-- v_dict_pos_sense_gap 큐 드레인 — 동형이의어의 누락 품사 sense 보강 (Claude Code 배치).
--
-- 문제: shared_dictionary 가 동형이의어를 **단일 품사**로만 기록하고 하필 학습자에게 덜 중요한
--   뜻을 대표(meaning_ko)로 잡았다. 학습자가 `high` 를 탭하면 "황홀감, 들뜸; 약물 환각",
--   `lead` 는 "납; 흑연심", `hide` 는 "가죽", `lay` 는 "평신도의", `gun` 은
--   "엔진을 힘껏 가동하다" 가 나온다. 아동서에도 그대로 나간다.
--
-- 두 갈래로 고친다:
--   ① meanings_ko 에 **누락 품사 sense 추가** — select_*_vocab 이 context_pos 로 sense 를
--      고르므로 챕터 단어장의 뜻·V-Level 이 문맥에 맞게 바뀐다.
--   ② meaning_ko(대표 뜻) 교정 — 리더 팝오버의 direct 티어는 문맥과 무관하게 대표 뜻을
--      돌려주므로, 대표가 명백히 틀린 6건은 바꾼다.
--
-- 큐 27건 중 **17건만** 처리한다. 나머지 10건은 winkNLP 태거 오류로 판단:
--   uttered·flung(과거분사) · observing·bowing(동명사) 을 noun 으로 태깅 · star(verb 79회는
--   고전 문학에서 비현실적) · degenerate(noun) · awful·dear(adverb) — 태거만 믿고 sense 를
--   넣으면 사전이 오염된다. 큐에는 남겨두고 근거가 더 모이면 재검토한다.

-- ─────────────────────────────────────────────────────────────
-- ① 누락 품사 sense 추가 (기존 sense 는 보존, 뒤에 append)
-- ─────────────────────────────────────────────────────────────
WITH add_sense(word, sense) AS (VALUES
  ('high',    '{"pos":"adjective","meaning":"높은 — 높이·지위·수준·소리가 높은","v_level":1}'::jsonb),
  ('lead',    '{"pos":"verb","meaning":"이끌다, 인도하다; 앞서다, (~로) 이어지다","v_level":1}'::jsonb),
  ('hide',    '{"pos":"verb","meaning":"숨다, 숨기다; 감추다","v_level":2}'::jsonb),
  ('lay',     '{"pos":"verb","meaning":"놓다, 눕히다; (알을) 낳다","v_level":2}'::jsonb),
  ('gun',     '{"pos":"noun","meaning":"총, 총기; 대포","v_level":2}'::jsonb),
  ('wash',    '{"pos":"verb","meaning":"씻다, 빨다; (파도가) 밀려오다","v_level":1}'::jsonb),
  ('cover',   '{"pos":"verb","meaning":"덮다, 가리다; (주제를) 다루다","v_level":2}'::jsonb),
  ('bow',     '{"pos":"verb","meaning":"절하다, 고개를 숙이다; 굴복하다","v_level":4}'::jsonb),
  ('force',   '{"pos":"verb","meaning":"강요하다, 억지로 시키다; 억지로 열다","v_level":3}'::jsonb),
  ('bolt',    '{"pos":"verb","meaning":"빗장을 지르다; 달아나다, 뛰쳐나가다","v_level":5}'::jsonb),
  ('tie',     '{"pos":"verb","meaning":"묶다, 매다; 동점을 이루다","v_level":3}'::jsonb),
  ('lean',    '{"pos":"verb","meaning":"기대다, 기울다; 몸을 숙이다","v_level":4}'::jsonb),
  ('spring',  '{"pos":"verb","meaning":"튀어오르다, 뛰어오르다; 갑자기 나타나다","v_level":4}'::jsonb),
  ('present', '{"pos":"verb","meaning":"제시하다, 보여주다; 수여하다, 증정하다","v_level":3}'::jsonb),
  ('change',  '{"pos":"noun","meaning":"변화, 변경; 거스름돈, 잔돈","v_level":2}'::jsonb),
  ('right',   '{"pos":"noun","meaning":"권리; 오른쪽, 우측","v_level":2}'::jsonb),
  ('rival',   '{"pos":"adjective","meaning":"경쟁하는, 맞서는","v_level":6}'::jsonb)
)
UPDATE shared_dictionary d
SET meanings_ko = COALESCE(d.meanings_ko, '[]'::jsonb) || jsonb_build_array(a.sense),
    updated_at  = now()
FROM add_sense a
WHERE d.word = a.word
  -- 멱등: 같은 품사 sense 가 이미 있으면 건너뛴다
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(d.meanings_ko, '[]'::jsonb)) s
    WHERE s->>'pos' = a.sense->>'pos'
  );

-- ─────────────────────────────────────────────────────────────
-- ② 대표 뜻 교정 — 현재 대표가 학습자 기준 명백히 틀린 6건만.
--    리더 팝오버(direct 티어)는 문맥과 무관하게 meaning_ko 를 돌려준다.
--    나머지(mean·cover·spring·force 등)는 두 뜻 다 흔해 대표를 바꿀 근거가 약하므로
--    sense 추가만으로 둔다 — 문맥 기반 선택이 이미 작동한다.
-- ─────────────────────────────────────────────────────────────
UPDATE shared_dictionary SET meaning_ko = '높은 — 높이·지위·수준이 높은; (명사) 황홀감, 최고치', updated_at = now()
  WHERE word = 'high'  AND meaning_ko = '황홀감, 들뜸; 약물 환각';
UPDATE shared_dictionary SET meaning_ko = '이끌다, 인도하다; (명사) 납 (Pb), 연필심', updated_at = now()
  WHERE word = 'lead'  AND meaning_ko = '납; (미국) 흑연심';
UPDATE shared_dictionary SET meaning_ko = '숨다, 숨기다; (명사) 짐승의 가죽', updated_at = now()
  WHERE word = 'hide'  AND meaning_ko = '가죽, 짐승의 가죽; (영국) 야생 관찰용 위장 은신처';
UPDATE shared_dictionary SET meaning_ko = '놓다, 눕히다; (알을) 낳다; (형용사) 평신도의', updated_at = now()
  WHERE word = 'lay'   AND meaning_ko = '평신도의, 비전문가의';
UPDATE shared_dictionary SET meaning_ko = '총, 총기; (동사, 구어) 엔진을 힘껏 가동하다', updated_at = now()
  WHERE word = 'gun'   AND meaning_ko = '엔진을 힘껏 가동하다, 가속하다 (구어)';
UPDATE shared_dictionary SET meaning_ko = '씻다, 빨다; (명사) 세탁물, 빨래', updated_at = now()
  WHERE word = 'wash'  AND meaning_ko = '세탁물, 빨래, 옅게 칠한 색';
