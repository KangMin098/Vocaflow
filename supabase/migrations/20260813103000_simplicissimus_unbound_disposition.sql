-- supabase/migrations/20260813103000_simplicissimus_unbound_disposition.sql
-- The Adventurous Simplicissimus (e9b6c98d-93ea-4333-8fd3-c1299ec8b5db) 미바인딩 진단
-- genuine_miss 30건의 개별 처분. 일괄 변환이 아니라 근거별 분류다 —
-- ADR 0004 D4c 가 251 후보 중 14건만 채택한 것과 같은 방식(수율 5.6%).
--
-- 근거는 전부 library_book_vocabularies.first_sentence 실측:
--   ch.46  "Mih werne daho blasna sebao, bowe deme ho gbabo Oberstowi"
--          ("Take we the fool: bring we him to the Colonel")
--          → 보헤미아어 대사를 본문이 괄호로 영역 병기. 번역 필요 없음(이미 있음).
--   ch.93  "Ze elegtuary and ze powder for ze white tooths ... zese will I sell"
--          → 돌팔이 약장수의 독일식 억양을 저자가 의도적으로 뭉갠 철자.
--             같은 챕터에 정상형 electuary(8회)가 따로 존재한다.
--   ch.12  "an exequiae and ludi gladiatorii" / ch.90 "oleum talci"
--   ch.129 "Nosce teipsum"  → 라틴어 인용.
--
-- 되돌리기: noise_blacklist 는 is_blocking=false 로 해제(행 삭제 아님 — ADR 0004 D3),
--           spelling_norm/archaic_candidates 는 해당 행 DELETE.
-- 멱등: 전부 ON CONFLICT 가드. 재실행 안전.

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1) 외국어 원문 인용 14건 → noise_blacklist(foreign_word)
--    학습 단어가 아니고, 표준 영어형이 존재하지 않는다.
-- ─────────────────────────────────────────────────────────────
INSERT INTO noise_blacklist (form, category, note, source) VALUES
  ('werne',        'foreign_word', '보헤미아어 대사 원문 (Simplicissimus ch.46) — 본문이 괄호로 영역 병기', 'manual-simplicissimus'),
  ('daho',         'foreign_word', '보헤미아어 대사 원문 (Simplicissimus ch.46)', 'manual-simplicissimus'),
  ('blasna',       'foreign_word', '보헤미아어 대사 원문 (Simplicissimus ch.46) — "fool"', 'manual-simplicissimus'),
  ('sebao',        'foreign_word', '보헤미아어 대사 원문 (Simplicissimus ch.46)', 'manual-simplicissimus'),
  ('gbabo',        'foreign_word', '보헤미아어 대사 원문 (Simplicissimus ch.46)', 'manual-simplicissimus'),
  ('nagonie',      'foreign_word', '보헤미아어 대사 원문 (Simplicissimus ch.46)', 'manual-simplicissimus'),
  ('possadeime',   'foreign_word', '보헤미아어 대사 원문 (Simplicissimus ch.46) — "set we him"', 'manual-simplicissimus'),
  ('rosumi',       'foreign_word', '보헤미아어 대사 원문 (Simplicissimus ch.46)', 'manual-simplicissimus'),
  ('niemezki',     'foreign_word', '보헤미아어 대사 원문 (Simplicissimus ch.46) — 슬라브어 "독일의"', 'manual-simplicissimus'),
  ('exequiae',     'foreign_word', '라틴어 인용 (Simplicissimus ch.12) — "an exequiae and ludi gladiatorii"', 'manual-simplicissimus'),
  ('gladiatorii',  'foreign_word', '라틴어 인용 (Simplicissimus ch.12) — "ludi gladiatorii"', 'manual-simplicissimus'),
  ('physiognomia', 'foreign_word', '라틴어 인용 (Simplicissimus ch.52)', 'manual-simplicissimus'),
  ('talci',        'foreign_word', '라틴어 인용 (Simplicissimus ch.90) — "oleum talci" 속격', 'manual-simplicissimus'),
  ('teipsum',      'foreign_word', '라틴어 인용 (Simplicissimus ch.129) — "Nosce teipsum"', 'manual-simplicissimus')
ON CONFLICT (form) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 2) 의도적 오철자 4건 → noise_blacklist(corrupt_token)
--    저자가 독일식 억양을 표기한 것. 표제어가 될 수 없는 토큰이다.
--    elegtuary 의 정상형 electuary 는 이미 coverage-clean 으로 해석되고(8회)
--    읽기 지원 패널에 노출되므로, 여기서 별도 매핑을 만들지 않는다.
-- ─────────────────────────────────────────────────────────────
INSERT INTO noise_blacklist (form, category, note, source) VALUES
  ('elegtuary', 'corrupt_token', '독일식 억양 표기 (Simplicissimus ch.93) — 정상형 electuary 가 같은 챕터에 8회 존재', 'manual-simplicissimus'),
  ('frients',   'corrupt_token', '독일식 억양 표기 (Simplicissimus ch.93) — friends', 'manual-simplicissimus'),
  ('zese',      'corrupt_token', '독일식 억양 표기 (Simplicissimus ch.93) — these (ze/zat/wizout 계열)', 'manual-simplicissimus'),
  ('zenn',      'corrupt_token', '독일식 억양 표기 (Simplicissimus ch.93) — then (ze/zat/wizout 계열)', 'manual-simplicissimus')
ON CONFLICT (form) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 3) 고어 2인칭 굴절 1건 + 인용된 욕설 1건
--    ADR 0002 D2 의 경계: 학습 가치 있는 고어는 archaic_dictionary,
--    외울 필요 없는 조동사·2인칭 굴절은 noise_blacklist(archaic_grammar).
-- ─────────────────────────────────────────────────────────────
INSERT INTO noise_blacklist (form, category, note, source) VALUES
  ('plannest', 'archaic_grammar',     '고어 2인칭 (Simplicissimus ch.43) — "thou plannest" (hadst/mayst 계열)', 'manual-simplicissimus'),
  ('cursemes', 'interjection_noise',  '인용된 욕설 (Simplicissimus ch.25) — "bloodies, dammes, and cursemes"', 'manual-simplicissimus')
ON CONFLICT (form) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 4) 철자 정규화 1건 → spelling_norm
--    necessy → necessary. 표준형이 shared_dictionary 정식 표제어(V2)라
--    spelling 티어가 실제로 뜻을 준다 (전제 확인: necessary v_level=2, classified_by NOT NULL).
--    이 조건을 못 갖춘 elegtuary/panfull 은 여기 넣지 않았다 — 넣어도 뜻이 안 나온다.
-- ─────────────────────────────────────────────────────────────
INSERT INTO spelling_norm (variant, standard, source) VALUES
  ('necessy', 'necessary', 'manual-simplicissimus')
ON CONFLICT (variant) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 5) 실단어 6건 → 사전 등재 큐 (addable_modern)
--    뜻 생성·등재는 Claude Code 배치가 addable_modern 을 드레인해 처리한다.
--    책에 굴절형으로 나온 것은 base 를 큐에 올린다 —
--      inkslingers → inkslinger (en_inflection_bases 가 -s 회수)
--      wheatsheaves → wheatsheaf (-ves 는 en_inflection_bases 미지원 →
--                     드레인이 inflected_forms 에 'wheatsheaves' 를 채워야 cluster 티어가 회수한다)
--    전부 word_register 를 period_cultural/archaic_literary 로 받게 되므로
--    select_book_chapter_vocab 의 register 배제에 걸려 학습 세트에는 들어가지 않는다.
--    목적은 "읽는 중 탭하면 뜻이 뜬다" 이지 암기 대상 추가가 아니다.
-- ─────────────────────────────────────────────────────────────
INSERT INTO archaic_candidates
  (word, total_frequency, book_count, first_seen_book_id, sample_sentence, classification)
SELECT
  m.headword,
  SUM(COALESCE(bv.frequency_in_book, 1))::int,
  1,
  bv.library_book_id,
  MAX(bv.first_sentence),
  'addable_modern'
FROM (VALUES
    ('landsknecht', 'landsknecht'),
    ('gallowsbird', 'gallowsbird'),
    ('inkslinger',  'inkslingers'),
    ('holmoak',     'holmoak'),
    ('mainguard',   'mainguard'),
    ('wheatsheaf',  'wheatsheaves')
  ) AS m(headword, surface)
JOIN library_book_vocabularies bv
  ON lower(trim(bv.word)) = m.surface
 AND bv.library_book_id = 'e9b6c98d-93ea-4333-8fd3-c1299ec8b5db'::uuid
GROUP BY m.headword, bv.library_book_id
ON CONFLICT (word) DO UPDATE
  SET classification = 'addable_modern', updated_at = now()
  WHERE archaic_candidates.classification = 'pending';

-- ─────────────────────────────────────────────────────────────
-- 6) 미처리 3건 (의도적 보류)
--    becalfed  ch.40 "my becalfed bedfellows"  — 번역자 조어, 근거 자산 없음
--    epicurish ch.64 "an epicurish life"       — epicure(V10)+ -ish, derivation 티어가
--                                                 'epicur' 로 잘라 실패. 접미사 규칙 확장 사안
--    panfull   ch.16 "a whole panfull of gold" — lexicon_clean 에 panful 은 있으나
--                                                 shared_dictionary 미등재라 spelling 티어 불가
--    셋 다 1회 출현. 추측으로 뜻을 만들지 않고 genuine_miss 로 남긴다.
-- ─────────────────────────────────────────────────────────────

COMMIT;
