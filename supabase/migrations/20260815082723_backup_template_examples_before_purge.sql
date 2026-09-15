-- 20260815082723_backup_template_examples_before_purge.sql
--
-- `20260815093000_template_examples_remove_and_reauthor.sql` 는 예문 8,403행을 NULL 로 비운다.
-- 그 파일의 주석은 "되돌려야 한다면 백업에서 example_en 컬럼만 복원할 것" 이라고 적었으나
-- 정작 백업을 만들지 않았다 — 되돌릴 수 없는 변경을 되돌릴 수 있게 만들고 나서 지운다.
--
-- 캡처 시점 실측: shared_dictionary 5,452 · shared_words 2,951 = 8,403행.
--
-- 왜 public 이 아닌가: `backup` 스키마는 PostgREST 노출 대상이 아니다.
--   public 에 두면 익명 클라이언트에 새 표면이 생기고 RLS 정책을 따로 져야 한다.
--
-- 복원 (예문만 되돌릴 때):
--   UPDATE shared_dictionary d SET example_en = b.example_en, senses = b.senses
--     FROM backup.template_examples_20260815 b
--    WHERE b.src = 'shared_dictionary' AND d.word = b.row_id;
--   UPDATE shared_words w SET example_en = b.example_en
--     FROM backup.template_examples_20260815 b
--    WHERE b.src = 'shared_words' AND w.id::text = b.row_id;
--
-- 정리: 재작성 드레인이 끝나 원본이 필요 없어지면 `DROP SCHEMA backup CASCADE;`
--
-- 재실행 안전: CREATE ... IF NOT EXISTS + ON CONFLICT DO NOTHING.
--   단, 이미 비워진 뒤 재실행하면 매칭이 0건이라 아무것도 추가되지 않는다(기존 백업 유지).

CREATE SCHEMA IF NOT EXISTS backup;

CREATE TABLE IF NOT EXISTS backup.template_examples_20260815 (
  src         text NOT NULL,          -- 'shared_dictionary' | 'shared_words'
  row_id      text NOT NULL,          -- dict = word · sets = id
  word        text NOT NULL,
  example_en  text NOT NULL,
  senses      jsonb,                  -- dict 만 (senses[0].examples 도 함께 바뀐다)
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (src, row_id)
);

WITH frames(frame) AS (VALUES
  ('the {w} is mentioned several times in the text.'),
  ('the result seemed remarkably {w} to everyone.'),
  ('the result appeared notably {w}.'),
  ('she answered the question {w}.'),
  ('they decided to {w} the matter together.'),
  ('he often uses the expression "{w}" in conversation.'),
  ('they planned to {w} the issue carefully.'),
  ('she responded to the question {w}.'),
  ('the report contains the abbreviation "{w}".')
)
INSERT INTO backup.template_examples_20260815 (src, row_id, word, example_en, senses)
SELECT 'shared_dictionary', d.word, d.word, d.example_en, d.senses
  FROM shared_dictionary d
 WHERE d.example_en IS NOT NULL
   AND lower(regexp_replace(d.example_en, '\m' || d.word || '\M', '{W}', 'gi')) IN (SELECT frame FROM frames)
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
  ('the report contains the abbreviation "{w}".')
)
INSERT INTO backup.template_examples_20260815 (src, row_id, word, example_en, senses)
SELECT 'shared_words', w.id::text, w.word, w.example_en, NULL
  FROM shared_words w
 WHERE w.example_en IS NOT NULL
   AND lower(regexp_replace(w.example_en, '\m' || w.word || '\M', '{W}', 'gi')) IN (SELECT frame FROM frames)
ON CONFLICT (src, row_id) DO NOTHING;
