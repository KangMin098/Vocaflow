-- 20260815090000_ngsl_top2000_basic_gaps.sql
--
-- 빈도 상위 어휘의 사전 구멍 10종을 메운다 (+ 굴절 연결 2종).
--
-- 근거 (scripts/dict-quality/frequency-gap.ts · 2026-08-15 실측):
--   NGSL 1.2 상위 2000 + NGSL-Spoken 1.2 상위 721 중 **해석 불가 10종**.
--   상위 100 은 구멍 0 이고, 구멍은 대명사·부사·전치사·수사 같은 **기초 기능어**에 몰려 있다.
--   발행 콘텐츠 31편 코퍼스에서도 `something`(5편) · `throughout`(7편) 이 미해결 상위였다.
--   즉 어떤 글을 넣어도 학습자가 이 단어들에서 막힌다 — 도메인 문제가 아니라 기초 결손이다.
--
-- 왜 이 10종만인가: 상위 2000 에서 **실제로 못 푸는 것 전부**다. 더 넣으면 검수 없이
--   사전을 늘리는 것이고, ADR 0004 D4("틀린 뜻은 뜻이 없는 것보다 나쁘다")에 걸린다.
--
-- 뜻·예문은 손으로 썼다(source='manual'). 예문 규칙:
--   ① 표제어가 반드시 예문 안에 등장할 것 (dict-quality 프로브 A 검사)
--   ② 한 문장 안에서 그 단어의 쓰임이 드러날 것 — "She answered the question somewhere."
--      같은 문법적으로만 맞고 뜻은 안 보이는 문장을 만들지 않는다(기존 derivational-seed 실패 사례)
--
-- 되돌리기: 이 마이그레이션이 넣은 행은 source='manual' + created_at 으로 식별된다.
--   DELETE FROM shared_dictionary WHERE word IN (...) AND source = 'manual';

BEGIN;

-- ── 1) 신규 표제어 10종 ────────────────────────────────────────────
-- ON CONFLICT DO NOTHING — 동시 세션이 먼저 넣었다면 그쪽을 존중한다(덮어쓰지 않는다).
INSERT INTO shared_dictionary
  (word, pos, primary_pos, pos_set, meaning_ko, meanings_ko, cefr_level, example_en, senses, source, verified, word_register)
VALUES
  ('something', 'pronoun', 'pronoun', ARRAY['pronoun'],
   '어떤 것, 무언가',
   '[{"pos":"pronoun","meaning":"어떤 것, 무언가"}]'::jsonb,
   'A1', 'I heard something moving behind the door.',
   '[{"pos":"pronoun","sense_idx":0,"sense_ko":"어떤 것, 무언가","sense_en":null,"register":"neutral","examples":[{"en":"I heard something moving behind the door."}]}]'::jsonb,
   'manual', true, 'standard'),

  ('someone', 'pronoun', 'pronoun', ARRAY['pronoun'],
   '누군가, 어떤 사람',
   '[{"pos":"pronoun","meaning":"누군가, 어떤 사람"}]'::jsonb,
   'A1', 'Someone left an umbrella by the front door.',
   '[{"pos":"pronoun","sense_idx":0,"sense_ko":"누군가, 어떤 사람","sense_en":null,"register":"neutral","examples":[{"en":"Someone left an umbrella by the front door."}]}]'::jsonb,
   'manual', true, 'standard'),

  ('whatever', 'pronoun', 'pronoun', ARRAY['pronoun','determiner'],
   '무엇이든, ~하는 것은 무엇이나',
   '[{"pos":"pronoun","meaning":"무엇이든, ~하는 것은 무엇이나"},{"pos":"determiner","meaning":"어떤 ~이든"}]'::jsonb,
   'A2', 'Take whatever you need from the shelf.',
   '[{"pos":"pronoun","sense_idx":0,"sense_ko":"무엇이든, ~하는 것은 무엇이나","sense_en":null,"register":"neutral","examples":[{"en":"Take whatever you need from the shelf."}]}]'::jsonb,
   'manual', true, 'standard'),

  ('throughout', 'preposition', 'preposition', ARRAY['preposition','adverb'],
   '~내내, ~ 전체에 걸쳐',
   '[{"pos":"preposition","meaning":"~내내, ~ 전체에 걸쳐"},{"pos":"adverb","meaning":"처음부터 끝까지, 곳곳에"}]'::jsonb,
   'B1', 'The library stays open throughout the summer.',
   '[{"pos":"preposition","sense_idx":0,"sense_ko":"~내내, ~ 전체에 걸쳐","sense_en":null,"register":"neutral","examples":[{"en":"The library stays open throughout the summer."}]}]'::jsonb,
   'manual', true, 'standard'),

  ('okay', 'adjective', 'adjective', ARRAY['adjective','adverb','interjection'],
   '괜찮은, 좋아',
   '[{"pos":"adjective","meaning":"괜찮은, 무방한"},{"pos":"interjection","meaning":"좋아, 알겠어"}]'::jsonb,
   'A1', 'Is it okay if I open the window?',
   '[{"pos":"adjective","sense_idx":0,"sense_ko":"괜찮은, 무방한","sense_en":null,"register":"informal","examples":[{"en":"Is it okay if I open the window?"}]}]'::jsonb,
   'manual', true, 'standard'),

  ('onto', 'preposition', 'preposition', ARRAY['preposition'],
   '~ 위로',
   '[{"pos":"preposition","meaning":"~ 위로 (표면에 닿는 이동)"}]'::jsonb,
   'A2', 'The cat jumped onto the kitchen table.',
   '[{"pos":"preposition","sense_idx":0,"sense_ko":"~ 위로 (표면에 닿는 이동)","sense_en":null,"register":"neutral","examples":[{"en":"The cat jumped onto the kitchen table."}]}]'::jsonb,
   'manual', true, 'standard'),

  ('everywhere', 'adverb', 'adverb', ARRAY['adverb'],
   '어디에나, 모든 곳에',
   '[{"pos":"adverb","meaning":"어디에나, 모든 곳에"}]'::jsonb,
   'A2', 'By morning, snow had settled everywhere in the valley.',
   '[{"pos":"adverb","sense_idx":0,"sense_ko":"어디에나, 모든 곳에","sense_en":null,"register":"neutral","examples":[{"en":"By morning, snow had settled everywhere in the valley."}]}]'::jsonb,
   'manual', true, 'standard'),

  ('hi', 'interjection', 'interjection', ARRAY['interjection'],
   '안녕 (가벼운 인사)',
   '[{"pos":"interjection","meaning":"안녕 (가벼운 인사)"}]'::jsonb,
   'A1', 'Hi, I did not expect to see you here.',
   '[{"pos":"interjection","sense_idx":0,"sense_ko":"안녕 (가벼운 인사)","sense_en":null,"register":"informal","examples":[{"en":"Hi, I did not expect to see you here."}]}]'::jsonb,
   'manual', true, 'standard'),

  ('fifteen', 'determiner', 'determiner', ARRAY['determiner','number'],
   '15, 열다섯',
   '[{"pos":"determiner","meaning":"15, 열다섯"}]'::jsonb,
   'A1', 'The next bus leaves in fifteen minutes.',
   '[{"pos":"determiner","sense_idx":0,"sense_ko":"15, 열다섯","sense_en":null,"register":"neutral","examples":[{"en":"The next bus leaves in fifteen minutes."}]}]'::jsonb,
   'manual', true, 'standard'),

  ('forty', 'determiner', 'determiner', ARRAY['determiner','number'],
   '40, 마흔',
   '[{"pos":"determiner","meaning":"40, 마흔"}]'::jsonb,
   'A1', 'She swam forty laps before breakfast.',
   '[{"pos":"determiner","sense_idx":0,"sense_ko":"40, 마흔","sense_en":null,"register":"neutral","examples":[{"en":"She swam forty laps before breakfast."}]}]'::jsonb,
   'manual', true, 'standard')
ON CONFLICT (word) DO NOTHING;

-- ── 2) `cannot` — 새 표제어 대신 `can` 의 굴절형으로 잇는다 ─────────
-- 9회차 원칙: 굴절형은 lemma 와 같은 뜻이므로 **뜻을 창작하지 않고** 연결한다.
-- `cannot` 은 부정형이라 뜻이 뒤집히므로 굴절이 아니라 **별도 표제어**가 맞다 —
-- 다만 학습자에게 필요한 것은 "can 의 부정" 이라는 사실이므로 그렇게 적는다.
INSERT INTO shared_dictionary
  (word, pos, primary_pos, pos_set, meaning_ko, meanings_ko, cefr_level, example_en, senses, source, verified, word_register, base_word)
VALUES
  ('cannot', 'auxiliary', 'auxiliary', ARRAY['auxiliary'],
   '~할 수 없다 (can 의 부정)',
   '[{"pos":"auxiliary","meaning":"~할 수 없다 (can 의 부정)"}]'::jsonb,
   'A1', 'I cannot open this jar by myself.',
   '[{"pos":"auxiliary","sense_idx":0,"sense_ko":"~할 수 없다 (can 의 부정)","sense_en":null,"register":"neutral","examples":[{"en":"I cannot open this jar by myself."}]}]'::jsonb,
   'manual', true, 'standard', 'can')
ON CONFLICT (word) DO NOTHING;

-- ── 3) 굴절 연결 — 뜻을 만들지 않고 기존 표제어에 붙인다 ────────────
-- `proven` 은 prove 의 과거분사(미국식 병용형)다. 뜻이 같으므로 표제어를 늘리지 않는다.
UPDATE shared_dictionary
   SET inflected_forms = (
         SELECT ARRAY(SELECT DISTINCT unnest(coalesce(inflected_forms, ARRAY[]::text[]) || ARRAY['proven']))
       ),
       updated_at = now()
 WHERE word = 'prove'
   AND NOT ('proven' = ANY(coalesce(inflected_forms, ARRAY[]::text[])));

COMMIT;

-- ── 적용 후 확인 ────────────────────────────────────────────────
-- SELECT word, resolve_dict_headword(word) FROM (VALUES
--   ('something'),('someone'),('whatever'),('throughout'),('okay'),('onto'),
--   ('everywhere'),('hi'),('fifteen'),('forty'),('cannot'),('proven')
-- ) AS t(word);
-- → 12행 모두 non-null 이어야 한다.
