-- 20260815092528_template_examples_residue_escaped_headwords.sql
--
-- `20260815093000_template_examples_remove_and_reauthor.sql` 의 잔여 63행 + 재발 방지 함수.
--
-- 왜 남았나: 그 마이그레이션은 `'\m' || word || '\M'` 로 **표제어를 이스케이프 없이**
--   정규식에 이어 붙였다. `a breath of (fresh) air` 같은 표제어는 괄호가 정규식 그룹으로
--   해석돼 리터럴 "(fresh)" 를 못 맞춘다 → 틀에 일치하지 않아 그대로 남았다.
--   실측: 잔여 39행이 **전부** 메타문자 보유 표제어. 이스케이프하면 39/39 매칭.
--   ⚠️ 적용 전 점검에서 "정규식이 컴파일되는가" 는 봤으나 "의도한 것을 맞추는가" 는 안 봤다.
--      컴파일 성공은 매칭 정확성을 보장하지 않는다 — 216종이 조용히 빠져나갔다.
--
-- 추가로 틀 3종이 더 드러났다 (원래 9틀에 없던 같은 생성기 계열):
--   '"{W}!" he exclaimed in response.'  11
--   '"{W}!" she exclaimed in surprise.'  8
--   '{W} was the one who solved it.'     5
--
-- 규모: 사전 63행 (A1 1 · A2 1 · B2 1 · C1 13 · C2 47) · 발행 세트 10행(6 표제어)
-- 처리: 초급 3종은 사람이 쓴 예문으로 대체(기존 30종과 같은 규칙), 나머지 60종은 NULL.
-- 원본: backup.template_examples_20260815 에 추가 캡처.
--
-- 재실행 안전: 두 번 실행하면 매칭이 0건이라 no-op. 함수는 CREATE OR REPLACE.

-- ── 0) 재발 방지 — 표제어를 정규식에 넣기 전 반드시 통과시킬 것 ─────
CREATE OR REPLACE FUNCTION public.regexp_quote(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
  SELECT pg_catalog.regexp_replace(p, '([.*+?^${}()|\[\]\\])', '\\\1', 'g')
$$;

COMMENT ON FUNCTION public.regexp_quote(text) IS
  'POSIX ERE 메타문자 이스케이프. shared_dictionary.word 처럼 사용자/사전 값을 정규식에 '
  '문자열 연결할 때 반드시 경유할 것 — 안 하면 괄호·물음표를 가진 표제어(216종)가 조용히 매칭을 벗어난다.';

-- ── 1) 비우기 전 백업 ────────────────────────────────────────────
WITH frames(frame) AS (VALUES
  ('the {w} is mentioned several times in the text.'),
  ('the result seemed remarkably {w} to everyone.'),
  ('the result appeared notably {w}.'),
  ('she answered the question {w}.'),
  ('they decided to {w} the matter together.'),
  ('he often uses the expression "{w}" in conversation.'),
  ('they planned to {w} the issue carefully.'),
  ('she responded to the question {w}.'),
  ('the report contains the abbreviation "{w}".'),
  ('"{w}!" he exclaimed in response.'),
  ('"{w}!" she exclaimed in surprise.'),
  ('{w} was the one who solved it.')
)
INSERT INTO backup.template_examples_20260815 (src, row_id, word, example_en, senses)
SELECT 'shared_dictionary', d.word, d.word, d.example_en, d.senses
  FROM shared_dictionary d
 WHERE d.example_en IS NOT NULL
   AND btrim(regexp_replace(lower(regexp_replace(d.example_en,
         '\m' || regexp_quote(d.word) || '\w*\M', '{W}', 'gi')), '\s+', ' ', 'g'))
       IN (SELECT frame FROM frames)
ON CONFLICT (src, row_id) DO NOTHING;

WITH frames(frame) AS (VALUES
  ('the {w} is mentioned several times in the text.'),
  ('the result seemed remarkably {w} to everyone.'),
  ('the result appeared notably {w}.'),
  ('she answered the question {w}.'),
  ('they decided to {w} the matter together.'),
  ('he often uses the expression "{w}" in conversation.'),
  ('they planned to {w} the issue carefully.'),
  ('she responded to the question {w}.'),
  ('the report contains the abbreviation "{w}".'),
  ('"{w}!" he exclaimed in response.'),
  ('"{w}!" she exclaimed in surprise.'),
  ('{w} was the one who solved it.')
)
INSERT INTO backup.template_examples_20260815 (src, row_id, word, example_en, senses)
SELECT 'shared_words', w.id::text, w.word, w.example_en, NULL
  FROM shared_words w
 WHERE w.example_en IS NOT NULL
   AND btrim(regexp_replace(lower(regexp_replace(w.example_en,
         '\m' || regexp_quote(w.word) || '\w*\M', '{W}', 'gi')), '\s+', ' ', 'g'))
       IN (SELECT frame FROM frames)
ON CONFLICT (src, row_id) DO NOTHING;

-- ── 2) 초급 3종 재작성 ───────────────────────────────────────────
-- `mine` 의 기존 예문 "Mine was the one who solved it." 은 뜻을 안 보여줄 뿐 아니라
-- 소유대명사 용법으로 어법이 어긋난다 — 비우는 것보다 고치는 게 맞다.
WITH frames(frame) AS (VALUES
  ('he often uses the expression "{w}" in conversation.'),
  ('{w} was the one who solved it.')
),
reauthored(word, example) AS (VALUES
  ('mine',                  'The red umbrella by the door is mine.'),
  ('whichever',             'Take whichever of the two seats you prefer.'),
  ('be (all) for the best', 'In the end, missing that train was all for the best.')
)
UPDATE shared_dictionary d
   SET example_en = r.example,
       senses = CASE
         WHEN jsonb_typeof(d.senses) = 'array' AND jsonb_array_length(d.senses) > 0
         THEN jsonb_set(d.senses, '{0,examples}', jsonb_build_array(jsonb_build_object('en', r.example)))
         ELSE d.senses
       END,
       updated_at = now()
  FROM reauthored r
 WHERE d.word = r.word
   AND d.example_en IS NOT NULL
   AND btrim(regexp_replace(lower(regexp_replace(d.example_en,
         '\m' || regexp_quote(d.word) || '\w*\M', '{W}', 'gi')), '\s+', ' ', 'g'))
       IN (SELECT frame FROM frames);

WITH frames(frame) AS (VALUES
  ('he often uses the expression "{w}" in conversation.'),
  ('{w} was the one who solved it.')
),
reauthored(word, example) AS (VALUES
  ('mine',                  'The red umbrella by the door is mine.'),
  ('whichever',             'Take whichever of the two seats you prefer.'),
  ('be (all) for the best', 'In the end, missing that train was all for the best.')
)
UPDATE shared_words w
   SET example_en = r.example
  FROM reauthored r
 WHERE lower(w.word) = r.word
   AND w.example_en IS NOT NULL
   AND btrim(regexp_replace(lower(regexp_replace(w.example_en,
         '\m' || regexp_quote(w.word) || '\w*\M', '{W}', 'gi')), '\s+', ' ', 'g'))
       IN (SELECT frame FROM frames);

-- ── 3) 나머지 비우기 ─────────────────────────────────────────────
WITH frames(frame) AS (VALUES
  ('the {w} is mentioned several times in the text.'),
  ('the result seemed remarkably {w} to everyone.'),
  ('the result appeared notably {w}.'),
  ('she answered the question {w}.'),
  ('they decided to {w} the matter together.'),
  ('he often uses the expression "{w}" in conversation.'),
  ('they planned to {w} the issue carefully.'),
  ('she responded to the question {w}.'),
  ('the report contains the abbreviation "{w}".'),
  ('"{w}!" he exclaimed in response.'),
  ('"{w}!" she exclaimed in surprise.'),
  ('{w} was the one who solved it.')
)
UPDATE shared_dictionary d
   SET example_en = NULL, updated_at = now()
 WHERE d.example_en IS NOT NULL
   AND btrim(regexp_replace(lower(regexp_replace(d.example_en,
         '\m' || regexp_quote(d.word) || '\w*\M', '{W}', 'gi')), '\s+', ' ', 'g'))
       IN (SELECT frame FROM frames);

WITH frames(frame) AS (VALUES
  ('the {w} is mentioned several times in the text.'),
  ('the result seemed remarkably {w} to everyone.'),
  ('the result appeared notably {w}.'),
  ('she answered the question {w}.'),
  ('they decided to {w} the matter together.'),
  ('he often uses the expression "{w}" in conversation.'),
  ('they planned to {w} the issue carefully.'),
  ('she responded to the question {w}.'),
  ('the report contains the abbreviation "{w}".'),
  ('"{w}!" he exclaimed in response.'),
  ('"{w}!" she exclaimed in surprise.'),
  ('{w} was the one who solved it.')
)
UPDATE shared_words w
   SET example_en = NULL
 WHERE w.example_en IS NOT NULL
   AND btrim(regexp_replace(lower(regexp_replace(w.example_en,
         '\m' || regexp_quote(w.word) || '\w*\M', '{W}', 'gi')), '\s+', ' ', 'g'))
       IN (SELECT frame FROM frames);

-- ── 적용 후 확인 (2026-08-15 실측) ───────────────────────────────
--   사전: 표제어 5종 이상 재사용된 틀 **0종 / 0행** (임계를 10 → 5 로 낮춰도 0)
--   재작성 3종 반영 확인 (mine · whichever · be (all) for the best)
--   발행 세트: 표제어 5종 이상 틀 1종 남으나 **템플릿이 아니다** —
--     "Be careful not to rip the envelope when you open the letter." 한 문장이
--     같은 어간의 굴절형 5개(ripen · riper · ripest · ripped · ripping)에 붙어 있다.
--     ⚠️ 별건 결함: `ripen`(익다)에 `rip`(찢다) 예문이 달렸다 — 발행 경로의 lemma 바인딩 문제.
