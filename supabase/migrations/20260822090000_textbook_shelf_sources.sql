-- supabase/migrations/20260822090000_textbook_shelf_sources.sql
--
-- **교재 권별 지문 출처 집계** — 서가의 4번째 분류축("이 권의 지문은 어디서 왔나").
--
-- ── 왜 필요한가 ─────────────────────────────────────────────────────
-- 학습자가 교재를 고를 때 알고 싶은 것 중 화면이 아직 말하지 못하는 것이 출처다.
-- 같은 '고2 · 순서/삽입' 권이라도 지문이 백과에서 온 것과 논문에서 온 것은 다른 책이다.
--
-- ⚠️ **기출 축은 만들지 않는다.** 실측(2026-08-22) `csat_dcp_items` 5,952문항 전수 조회 결과
--    기출 지문은 **0건**이다(전부 공개 원문 기반 창작 또는 도서 발췌). 기출 매대를 세우면
--    없는 상품을 파는 것이 된다. 이 함수는 **실재하는 출처만** 센다.
--
-- ── 왜 테이블을 열지 않고 함수인가 ──────────────────────────────────
-- `csat_dcp_items` 의 RLS 는 `dcp_admin [ALL]` 하나뿐이다. 그대로 두는 이유는
-- 테이블을 열면 **지문·선지·정답까지 열리고 그건 상품성을 훼손하기 때문**이다
-- (`20260821120000_textbook_shelf_inventory` 와 같은 판단). 그래서 집계만 여는 함수를 하나 더 둔다.
--
-- ⚠️ 이 함수는 **본문 컬럼(payload·answer_key)을 어떤 경로로도 선택하지 않는다.**
--    출처 문자열조차 원문 링크가 아니라 `source_id` 의 **앞머리(갈래)** 만 잘라 낸다 —
--    개별 지문을 특정할 수 있으면 집계가 아니라 목록이 된다.
--
-- ── 라벨은 여기서 짓지 않는다 ───────────────────────────────────────
-- `'simple_wikipedia'` → '백과' 같은 학습자 표기는 **코드가 소유한다**
-- (`lib/textbook/source-guide.ts`). SQL 이 한국어 라벨을 들면 화면과 DB 두 곳에서 갈린다 —
-- `SERIES_SPINE` 이 권 제목을 소유하는 것과 같은 이유다.
--
-- 되돌리기: `DROP FUNCTION public.textbook_shelf_sources();` 하나.
-- 기존 `textbook_shelf_inventory()` 는 건드리지 않는다(시그니처 유지 — 호출부가 깨지지 않는다).

CREATE OR REPLACE FUNCTION public.textbook_shelf_sources()
  RETURNS TABLE(v_level integer, source_family text, item_count bigint)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  -- 집계만. payload·answer_key 는 어떤 경우에도 선택하지 않는다.
  SELECT i.v_level,
         CASE
           WHEN i.kind = 'book' THEN 'book'
           -- `voa:abc123` · `simple_wikipedia:66137` · `original:v3-5` → 앞머리만.
           -- 갈래를 못 읽으면 'unknown' — 조용히 빼면 권의 합계가 유형별 합계와 어긋난다.
           ELSE COALESCE(NULLIF(split_part(la.source_id, ':', 1), ''), 'unknown')
         END      AS source_family,
         count(*) AS item_count
    FROM csat_dcp_items i
    LEFT JOIN library_articles la
           ON la.id = i.ref_id
          AND i.kind = 'article'
   WHERE i.v_level IS NOT NULL
   GROUP BY 1, 2;
$function$;

COMMENT ON FUNCTION public.textbook_shelf_sources() IS
  '교재 권별 지문 출처 갈래 집계. 본문·정답은 열지 않는다. 학습자 표기는 코드가 소유(20260822090000).';

-- 서가는 비로그인에도 열려 있다(발견·SEO — apps/web/CLAUDE.md 공개 표면 표).
-- 기존 textbook_shelf_inventory() 와 **같은 범위**로 맞춘다.
GRANT EXECUTE ON FUNCTION public.textbook_shelf_sources() TO anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- **교육과정 어휘 보유량** — 초등 3종(rhyme·word_meaning·spell_blank)의 생성 가능 수.
--
-- ⚠️ 왜 이것도 함수여야 하나 (실측 2026-08-22):
--    이 수는 `shared_dictionary.list_tags` 에서 나오는데, 그 표의 RLS 는
--    `authenticated read dictionary` 하나뿐이다. **서가는 비로그인에도 열려 있으므로**
--    (apps/web/CLAUDE.md 공개 표면 표) 익명 방문자는 0을 받았고, 화면은 그것을
--    '근간 예정'(재료 없음)으로 인쇄했다 — 계단 1·2 가 로그아웃 상태에서만 비어 보였다
--    (로그인 7/7 vs 비로그인 5/7). 로그인해서 확인하면 멀쩡하니 아무도 못 잡는 종류다.
--
-- ⚠️ 낱말 자체는 나가지 않는다. **태그별 개수뿐**이다 — 사전 45,292행은 이 서비스의 상품이다.
--
-- 되돌리기: `DROP FUNCTION public.textbook_curriculum_vocab_counts();`

CREATE OR REPLACE FUNCTION public.textbook_curriculum_vocab_counts()
  RETURNS TABLE(list_tag text, word_count bigint)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  -- 2022 개정 교육과정 기본어휘 3종만. 다른 태그는 세지 않는다(이 함수의 용도가 그것뿐이다).
  SELECT t.tag AS list_tag, count(*) AS word_count
    FROM shared_dictionary d
    CROSS JOIN LATERAL unnest(d.list_tags) AS t(tag)
   WHERE t.tag IN ('kcurr2022_1', 'kcurr2022_2', 'kcurr2022_0')
   GROUP BY t.tag;
$function$;

COMMENT ON FUNCTION public.textbook_curriculum_vocab_counts() IS
  '교육과정 기본어휘 태그별 개수(초등 문항 생성 가능 수). 낱말은 나가지 않는다(20260822090000).';

GRANT EXECUTE ON FUNCTION public.textbook_curriculum_vocab_counts()
  TO anon, authenticated, service_role;
