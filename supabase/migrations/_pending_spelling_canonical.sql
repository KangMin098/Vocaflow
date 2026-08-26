-- supabase/migrations/<ts>_spelling_canonical.sql
--
-- **영/미 철자 중복을 표제어 차원에서 통합한다** — 183쌍, 그중 66개는 지금 학습자가 두 항목으로 만난다.
--
-- ── 무엇이 문제인가 (2026-08-26 실측) ───────────────────────────────
-- `resolve_dict_headword` 의 **L5 는 이미 영/미 철자를 양방향으로 해석한다**(규칙 기반 —
-- `-ize↔-ise` · `-or↔-our` 등 정규식. `spelling_variants` 컬럼과 무관하다).
-- 그런데 **L1(정확 일치)이 먼저다.** 두 철자가 **모두 표제어로 등재돼 있으면**
-- 각자 L1 에서 자기 자신에 걸려 L5 까지 가지 않는다.
--
--   resolve('colour') → L1 히트 → 'colour'
--   resolve('color')  → L1 히트 → 'color'
--
-- 즉 통합 장치는 **처음부터 있었고, 데이터가 그것을 우회하게 만들었다.**
--
-- ── 실제 범위 ───────────────────────────────────────────────────────
--   `-ise/-ize` 112쌍 · `our→or` 50 · `tre→ter` 11 · `ogue→og` 6 · `ll→l` 4  = **183쌍**
--   발행 세트에 등장 137쌍 · **둘 다 발행 세트에 66쌍**
--   `labor` 17개 세트 / `labour` 5개 세트 — 뜻은 둘 다 "노동; 분만; 수고하다"
--   `neighbor`/`neighbour` V2/V1 · `theater`/`theatre` V3/V2 — **난이도까지 갈린다**
--
-- ── 왜 표제어를 지우지 않나 ─────────────────────────────────────────
-- `labour` 는 5개 발행 세트가 참조한다. 표제어를 지우면 그 세트의 낱말이 뜻을 잃는다.
-- 그래서 **행은 남기고 "정본이 누구인지" 만 표시한다.** 기존 참조는 그대로 살아 있고,
-- 해석기만 정본으로 모은다.
--
-- ── 정본을 미국식으로 두는 이유 ─────────────────────────────────────
-- 이 서비스의 학습자는 한국 중·고등학생~성인이고 국내 영어 교육 표준은 미국식이다.
-- 반면 **본문은 영국 고전이 많아 영국식 표면형이 자주 나온다** — 그래서 영국식을 *버리는* 게
-- 아니라 **표면형으로 인식하고 정본으로 모은다.** L5 가 이미 양방향이므로 반대 방향도 계속 된다.
--
-- ⚠️ 이 마이그레이션은 **구조만** 만든다. 어느 쌍을 어느 정본으로 묶을지는 데이터 작업이라
--    별도다(`variant_of` 를 채우는 백필). 구조와 데이터를 한 번에 넣으면 되돌리기 어렵다.

-- ── 1) 정본 표시 ────────────────────────────────────────────────────
ALTER TABLE public.shared_dictionary
  ADD COLUMN IF NOT EXISTS variant_of text;

COMMENT ON COLUMN public.shared_dictionary.variant_of IS
  '이 표제어가 다른 표제어의 철자 변이일 때 그 정본(예: colour.variant_of = ''color''). '
  'NULL 이면 자신이 정본이다. resolve_dict_headword 의 L1 이 이 값을 따라간다. '
  '행을 지우지 않는 이유: 기존 발행 세트가 변이 표제어를 참조하고 있다(labour 5개 세트).';

-- 자기 자신을 가리키면 무한 루프가 된다 — 값이 들어올 때 막는다.
ALTER TABLE public.shared_dictionary
  DROP CONSTRAINT IF EXISTS shared_dictionary_variant_not_self;
ALTER TABLE public.shared_dictionary
  ADD CONSTRAINT shared_dictionary_variant_not_self
  CHECK (variant_of IS NULL OR variant_of <> word);

-- 변이는 소수(183쌍)라 부분 인덱스로 충분하다.
CREATE INDEX IF NOT EXISTS idx_shared_dictionary_variant_of
  ON public.shared_dictionary (variant_of) WHERE variant_of IS NOT NULL;

-- ── 2) L1 을 정본으로 돌려주는 조각 ─────────────────────────────────
--
-- ⚠️ **이 함수를 만드는 것만으로는 아무 일도 일어나지 않는다.**
--    `resolve_dict_headword` 본체는 아직 이것을 부르지 않는다. 본체의 L1 을 이 호출로
--    바꾸려면 함수 전체를 `CREATE OR REPLACE` 로 다시 써야 하고(SQL 은 본문 일부만 못 고친다),
--    그건 **백필과 같은 단계에서** 하는 편이 낫다 — 구조·데이터·동작이 한 번에 켜지고,
--    문제가 생기면 그 한 커밋만 되돌리면 된다.
--
--    지금 이 파일이 하는 일은 둘뿐이다: `variant_of` 자리를 만들고, L1 규칙을 **한 곳에 적어 둔다.**
--    그래서 다음 단계의 diff 가 "본체에서 L1 세 줄이 이 호출로 바뀌었다" 로 읽힌다 —
--    나머지 계층(L2~L5)에 손대지 않았음을 리뷰에서 눈으로 확인할 수 있다.
CREATE OR REPLACE FUNCTION public.resolve_dict_headword_l1(p_surface text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(d.variant_of, d.word)
  FROM shared_dictionary d
  WHERE d.word = lower(trim(p_surface))
    AND d.classified_by IS NOT NULL
    AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0
  LIMIT 1
$function$;

COMMENT ON FUNCTION public.resolve_dict_headword_l1(text) IS
  'resolve_dict_headword 의 L1(정확 일치) — variant_of 가 있으면 정본을 돌려준다. '
  '함수로 떼어 둔 이유: 본체 SQL 이 길어 L1 만 고치려면 전체를 다시 써야 하고, '
  '그러면 나머지 계층에 손대지 않았다는 것을 리뷰에서 확인하기 어렵다.';
