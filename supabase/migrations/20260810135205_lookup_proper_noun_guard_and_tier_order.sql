-- 20260810130000_lookup_proper_noun_guard_and_tier_order.sql
-- ADR 0004 D4a + D4b — 읽기 중 단어 탭이 문맥과 무관한 뜻을 주던 결함 제거.
--
-- 현재 티어 순서 (실측):
--   direct → inflection → variant → cluster → derivation
--   → **coverage-clean** → coverage-clean_en → dialect → spelling → normalized → … → not_found
--
-- 결함 두 가지:
--
-- (1) 자동 임포트 사전(lexicon_clean, Wiktionary 유래)이 **수기 큐레이션 dialect_map 보다 앞**에 있다.
--       thee   → "번창하기 위해; 번영하기 위해"        (dialect_map: you)
--       hast   → ", 2d 당. 노래하다. 대가. 의."        (dialect_map: have)
--       didst  → ", 2D 사람. 노래하다. 꼬마 도깨비."   (dialect_map: do)
--       spake  → "꼬마 도깨비. ~의"                    (dialect_map: speak)
--     dialect_map 에 있는 13단어 / 609출현이 전부 오역 중. → coverage-clean 이 dialect_map
--     보유 형태를 양보하게 한다 (뒤의 dialect 티어가 정확히 잡는다).
--
--     ⚠️ spelling 티어는 건드리지 않는다. spelling_norm 312,642행은 자동 생성이라
--        짧은 토큰에 엉뚱한 표준형이 붙어 있다 — mary→marry(인명!) · gardiner→gardener(인명!)
--        · de→the · al→all · les→less · ha→would · ing→king · ami→amigurumi.
--        앞세우면 기존 오역을 새 오역으로 바꾸는 셈이다. 검증분은 D4c 로 dialect_map 에 승격한다.
--
-- (2) lexicon_clean 은 Wiktionary 인명·지명 항목을 포함한다 → 고유명사가 동음 일반명사 뜻을 받는다.
--     coverage-clean 해석 3,520단어 중 **91단어 / 3,582출현(23.6%)**:
--       Louis (Les Misérables 56회) → "12년간 세계 헤비급 챔피언이었던 미국…"(권투선수)
--       Davy  (Treasure Island)     → "전기화학의 선구자이자 나트륨·칼륨을 발견한…"(화학자)
--       Pierre                      → "사우스다코타 주의 주도"
--
-- 구현 노트: 함수 본문을 손으로 옮겨쓰지 않는다. lookup_word_meaning 은 티어 14개짜리
--   장문이라 재작성 시 surface_variants/dmetaphone 같은 세부를 놓치기 쉽다(실제로 초안에서
--   normalized·suggestion 티어를 잘못 복원했다). pg_get_functiondef 로 원본을 읽어
--   **국소 치환 3건**만 적용하고, 각 치환이 실제로 일어났는지 단언한다.

-- ─────────────────────────────────────────────────────────────
-- D4a — 고유명사 증거 테이블 (코퍼스 대문자 근거)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.proper_noun_forms (
  form         text PRIMARY KEY,
  evidence     text NOT NULL,
  occurrences  integer,
  book_count   integer,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.proper_noun_forms IS
  'ADR 0004 D4a — 코퍼스에서 대문자로만 등장한 형태(인명·지명). lookup_word_meaning 이 coverage-clean 앞에서 차단해 동음이의어 오역을 막는다.';
COMMENT ON COLUMN public.proper_noun_forms.evidence IS
  'corpus_capitalized = 본문에서 Initcap 으로만 등장(소문자 출현 0).';

ALTER TABLE public.proper_noun_forms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proper_noun_forms_read ON public.proper_noun_forms;
CREATE POLICY proper_noun_forms_read ON public.proper_noun_forms FOR SELECT USING (true);
GRANT SELECT ON public.proper_noun_forms TO anon, authenticated;

-- 판정 규칙: 본문에서 Initcap 으로 등장한 적이 있고 소문자로는 **한 번도** 안 나온 형태.
--   문두 대문자 오탐 방지 조건이다 (문두에만 대문자로 나온 실단어는 소문자 출현도 있어 제외).
--   이미 사전 정식 표제어면 대상 아님 — 사전 뜻이 우선이고 direct 티어가 먼저 잡는다.
WITH agg AS (
  SELECT lower(trim(v.word)) AS form,
         SUM(COALESCE(v.frequency_in_book, 1))::int AS occurrences,
         COUNT(DISTINCT v.library_book_id)::int     AS book_count,
         bool_or(v.first_sentence ~ ('\m' || initcap(lower(trim(v.word))) || '\M')) AS capd,
         bool_or(v.first_sentence ~ ('\m' || lower(trim(v.word)) || '\M'))          AS lowerd
  FROM library_book_vocabularies v
  WHERE v.first_sentence IS NOT NULL
    AND length(trim(v.word)) >= 2
  GROUP BY lower(trim(v.word))
)
INSERT INTO public.proper_noun_forms (form, evidence, occurrences, book_count)
SELECT a.form, 'corpus_capitalized', a.occurrences, a.book_count
FROM agg a
WHERE a.capd AND NOT a.lowerd
  AND NOT EXISTS (
    SELECT 1 FROM shared_dictionary d
    WHERE d.word = a.form
      AND d.classified_by IS NOT NULL
      AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0
  )
ON CONFLICT (form) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- D4a + D4b — lookup_word_meaning 국소 패치
-- ─────────────────────────────────────────────────────────────
DO $mig$
DECLARE def text; out text; guard text; defer text;
BEGIN
  def := pg_get_functiondef('public.lookup_word_meaning(text)'::regprocedure);

  guard :=
    '  IF EXISTS (SELECT 1 FROM proper_noun_forms pnf WHERE pnf.form = s) THEN' || E'\n' ||
    '    RETURN QUERY SELECT false, p_surface, NULL::text, NULL::text, NULL::text, NULL::text, NULL::smallint, NULL::text, ''proper_noun''::text, NULL::text, NULL::text, NULL::text;' || E'\n' ||
    '    RETURN;' || E'\n' ||
    '  END IF;' || E'\n';

  defer := ' AND NOT EXISTS (SELECT 1 FROM dialect_map dmx WHERE dmx.variant = ANY(ARRAY[s] || en_inflection_bases(s)))';

  -- ① coverage-clean 티어 직전에 고유명사 가드 삽입
  out := replace(
    def,
    '  RETURN QUERY SELECT true, p_surface, lc.word, lc.meaning_ko, lc.pos, NULL::text, NULL::smallint, NULL::text, ''coverage-clean''::text',
    guard ||
    '  RETURN QUERY SELECT true, p_surface, lc.word, lc.meaning_ko, lc.pos, NULL::text, NULL::smallint, NULL::text, ''coverage-clean''::text'
  );
  IF out = def THEN RAISE EXCEPTION 'D4a 패치 실패 — coverage-clean 티어 앵커 불일치'; END IF;
  def := out;

  -- ② coverage-clean 이 dialect_map 보유 형태를 양보
  out := replace(
    def,
    'FROM lexicon_clean lc WHERE lc.word = ANY (ARRAY[s] || en_inflection_bases(s)) AND lc.meaning_ko IS NOT NULL',
    'FROM lexicon_clean lc WHERE lc.word = ANY (ARRAY[s] || en_inflection_bases(s))' || defer || ' AND lc.meaning_ko IS NOT NULL'
  );
  IF out = def THEN RAISE EXCEPTION 'D4b 패치 실패 — coverage-clean 조건절 앵커 불일치'; END IF;
  def := out;

  -- ③ coverage-clean_en 도 동일
  out := replace(
    def,
    'FROM lexicon_clean lc WHERE lc.word = ANY (ARRAY[s] || en_inflection_bases(s)) AND lc.gloss_en IS NOT NULL',
    'FROM lexicon_clean lc WHERE lc.word = ANY (ARRAY[s] || en_inflection_bases(s))' || defer || ' AND lc.gloss_en IS NOT NULL'
  );
  IF out = def THEN RAISE EXCEPTION 'D4b 패치 실패 — coverage-clean_en 조건절 앵커 불일치'; END IF;
  def := out;

  EXECUTE def;
END $mig$;

COMMENT ON FUNCTION public.lookup_word_meaning(text) IS
  'ADR 0004 D4a+D4b — coverage-clean 앞에 고유명사 가드(match_via=proper_noun) + dialect_map 보유 형태는 coverage-clean 이 양보.';
