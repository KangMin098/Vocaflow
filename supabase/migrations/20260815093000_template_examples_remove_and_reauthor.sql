-- 20260815093000_template_examples_remove_and_reauthor.sql
--
-- 예문 8,313건이 **9개 문장 틀의 복사본**이다. 학습자에게 나가는 것을 멈춘다.
--
-- 실측 (scripts/dict-quality/example-quality.ts · 2026-08-15):
--   shared_dictionary  예문 42,133 중 템플릿 5,452 (13.0%)
--   shared_words(발행) 예문 58,822 중 템플릿 2,861 (해당 9틀 기준 · 전체 틀로는 10,120 / 17.2%)
--   사전에서 고쳐 옮길 수 있는 것: **0건** — 세트와 사전이 같은 틀을 공유한다.
--
-- 왜 비우는가:
--   "The result seemed remarkably {단어} to everyone." 은 표제어를 포함하고 문법도 맞지만
--   그 단어에 대해 아무것도 가르치지 않는다. 게다가 **틀린 연어(collocation)를 가르친다** —
--   학습자는 이 문장에서 `remarkably + 형용사` 라는 무관한 패턴만 반복해 본다.
--   ADR 0004 D4 "틀린 뜻은 뜻이 없는 것보다 나쁘다" 가 예문에도 그대로 적용된다.
--   화면은 예문 없음을 이미 견딘다(`WordRow` 는 `—` 로 렌더 · 실측 확인).
--
-- 이 마이그레이션은 두 가지를 한다:
--   ① 아래 9틀에 해당하는 예문을 NULL 로 비운다 (사전 + 발행 세트 양쪽 — 세트는 사본을 갖는다)
--   ② 초급 노출이 큰 30종은 **사람이 쓴 예문으로 대체**한다 (비우지 않고 채운다)
--
-- 나머지 드레인: `/admin/vocab` VCB 재enrichment(스킬 `vcb-reenrich`)로 단어별 재생성.
--   대상 목록: npx tsx scripts/dict-quality/example-quality.ts --words <레벨>
--
-- 되돌리기: 예문 원본은 이 마이그레이션 후 복구할 수 없다(템플릿이라 가치가 없다).
--   되돌려야 한다면 백업에서 `example_en` 컬럼만 복원할 것.

BEGIN;

-- 대상 틀 — 표제어를 {W} 로 치환했을 때 아래와 일치하는 예문
CREATE TEMP TABLE _tpl_frames(frame text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _tpl_frames VALUES
  ('the {w} is mentioned several times in the text.'),
  ('the result seemed remarkably {w} to everyone.'),
  ('the result appeared notably {w}.'),
  ('she answered the question {w}.'),
  ('they decided to {w} the matter together.'),
  ('he often uses the expression "{w}" in conversation.'),
  ('they planned to {w} the issue carefully.'),
  ('she responded to the question {w}.'),
  ('the report contains the abbreviation "{w}".');

-- ── ② 먼저 재작성 (비우기 전에) — 초급 30종 ─────────────────────────
-- 예문 규칙: ① 표제어가 반드시 등장 ② 그 단어의 뜻이 문장 안에서 드러날 것
--   (기존 실패 사례: "She answered the question somewhere." — 문법만 맞고 뜻은 안 보인다)
CREATE TEMP TABLE _reauthored(word text PRIMARY KEY, example text NOT NULL) ON COMMIT DROP;
INSERT INTO _reauthored VALUES
  ('photo',        'She keeps a photo of her grandmother on the desk.'),
  ('auto',         'He works at an auto repair shop near the station.'),
  ('annoyed',      'He was annoyed that the train was late again.'),
  ('annoying',     'The annoying beep repeated every thirty seconds.'),
  ('somewhere',    'I left my keys somewhere between the car and the office.'),
  ('everyday',     'Cooking rice is an everyday task in this household.'),
  ('magician',     'The magician pulled three coins from an empty hat.'),
  ('torn',         'The map was torn along the fold and missing a corner.'),
  ('endangered',   'Only about forty of these endangered birds remain in the wild.'),
  ('faraway',      'She dreamed of faraway islands she had only seen in books.'),
  ('driverless',   'A driverless bus now runs between the two terminals.'),
  ('crisply',      'He folded the letter crisply and slid it into the envelope.'),
  ('airsick',      'She felt airsick during the bumpy descent.'),
  ('carsick',      'The child gets carsick on winding mountain roads.'),
  ('eighty',       'My grandfather turned eighty last spring.'),
  ('african',      'The museum displays African masks carved from dark wood.'),
  ('european',     'Several European cities banned cars from the old centre.'),
  ('good-looking', 'The house was good-looking from the street but cold inside.'),
  ('hard-working', 'She is a hard-working student who rarely misses a class.'),
  ('front-page',   'The flood became front-page news the next morning.'),
  ('after-school', 'He joined an after-school club that builds robots.'),
  ('deep-sea',     'Deep-sea creatures survive without any sunlight.'),
  ('deep-water',   'The port is deep-water, so large ships can dock there.'),
  ('fair-haired',  'A fair-haired boy waved from the second-floor window.'),
  ('first-class',  'The hotel offered first-class service at a modest price.'),
  ('north-east',   'The wind blew from the north-east all afternoon.'),
  ('north-west',   'They drove north-west until the road ended.'),
  ('south-east',   'Rain moves in from the south-east at this time of year.'),
  ('south-west',   'The kitchen window faces south-west and catches the sunset.'),
  ('fed up',       'She was fed up with waiting and left without her order.');

UPDATE shared_dictionary d
   SET example_en = r.example,
       senses = CASE
         WHEN jsonb_typeof(d.senses) = 'array' AND jsonb_array_length(d.senses) > 0
         THEN jsonb_set(d.senses, '{0,examples}', jsonb_build_array(jsonb_build_object('en', r.example)))
         ELSE d.senses
       END,
       updated_at = now()
  FROM _reauthored r
 WHERE d.word = r.word
   AND lower(regexp_replace(d.example_en, '\m' || d.word || '\M', '{W}', 'gi')) IN (SELECT frame FROM _tpl_frames);

UPDATE shared_words w
   SET example_en = r.example
  FROM _reauthored r
 WHERE lower(w.word) = r.word
   AND lower(regexp_replace(w.example_en, '\m' || w.word || '\M', '{W}', 'gi')) IN (SELECT frame FROM _tpl_frames);

-- ── ① 남은 템플릿 예문 비우기 ────────────────────────────────────
UPDATE shared_dictionary d
   SET example_en = NULL, updated_at = now()
 WHERE d.example_en IS NOT NULL
   AND lower(regexp_replace(d.example_en, '\m' || d.word || '\M', '{W}', 'gi')) IN (SELECT frame FROM _tpl_frames);

UPDATE shared_words w
   SET example_en = NULL
 WHERE w.example_en IS NOT NULL
   AND lower(regexp_replace(w.example_en, '\m' || w.word || '\M', '{W}', 'gi')) IN (SELECT frame FROM _tpl_frames);

COMMIT;

-- ── 적용 후 확인 ────────────────────────────────────────────────
-- npx tsx scripts/dict-quality/example-quality.ts
--   → 사전 템플릿 5,452 → 0 (9틀 기준) · 발행 세트 2,861 → 0
--   → 남은 틀(임계 10회 이상)은 동의어 무리에 같은 문장을 돌려 쓴 소규모 틀이다. 다음 회차 대상.
