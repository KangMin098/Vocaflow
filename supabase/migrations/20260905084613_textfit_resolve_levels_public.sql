-- supabase/migrations/20260905084613_textfit_resolve_levels_public.sql
--
-- 공개(미로그인) 지문 진단이 **사전 해석기를 쓸 수 있게** 한다.
--
-- 무엇이 문제였나 (2026-09-05 실측)
--   `/fit` 은 로그인 없이 지문의 어휘 커버리지를 재는 획득 관문이다. 그런데 레벨 해석 정본인
--   `textfit_resolve_levels`(20260826102758)는 SECURITY **INVOKER** 라 호출자 권한으로 돌고,
--   `shared_dictionary` 에는 `authenticated read dictionary` 정책만 있다.
--   → anon 이 부르면 **오류 없이 0행**이 온다(실측: 10낱말 요청 → 0행 103ms).
--   ⚠️ 권한 문제가 아니다 — anon 은 이 함수에 EXECUTE 를 이미 갖고 있다(PUBLIC 기본값).
--      막는 것은 RLS 이고, INVOKER 라 RLS 가 그대로 적용된다.
--
--   그래서 공개 경로는 anon 이 읽을 수 있는 `shared_words` 를 **전량 적재**하는 우회로를 썼다
--   (`lib/textfit/level-map.ts`). 그 표는 **681,021행인데 distinct 표제어는 29,308개**다 —
--   23배 중복을 통째로 끌어온다. PostgREST 페이지가 1,000행 고정이라 왕복 200회 · **콜드 88초**가
--   걸리고, 로더 상한 `MAX_ROWS` 200,000 에서 **조용히 멈춘다**. 잘린 맵은 오류를 내지 않고
--   빠진 낱말을 '미지어' 로 세어 **커버리지를 낮게** 답한다.
--
--   대안도 재 봤다: 표적 `.in()` 조회는 50 표제어에 7,617행 9.5초, 600 표제어에 84,466행 41초 —
--   지문 규모에 못 쓴다. service_role 로 사전을 전량 적재해도 페이지 상한 탓에 ~49 왕복이다.
--   **요청당 RPC 해석만이 빠르다.** 그건 로그인 경로(`lib/textfit/queries.ts`)가 이미 쓰는 방식이다.
--
-- 무엇을 하는가
--   기존 함수를 건드리지 않고(로그인 경로의 의미가 바뀌면 안 된다) **공개용 쌍둥이**를 만든다.
--   본문은 `textfit_resolve_levels` 와 동일하고 차이는 `SECURITY DEFINER` 하나다.
--
-- 안전성
--   - 읽기 전용(STABLE). 쓰기·DDL 없음. 새 테이블 없음.
--   - 반환은 **surface · headword · v_level 3열뿐** — 뜻(meaning_ko)·예문·태그는 나가지 않는다.
--   - `SET search_path TO 'public'` — DEFINER 함수의 search_path 탈취를 막는다.
--   - `REVOKE ALL FROM PUBLIC` 후 anon·authenticated 에만 EXECUTE.
--   - 입력 상한 4,000(토크나이저 MAX_UNIQUE 와 같은 자리수) · `statement_timeout 15s`.
--   - 호출 관문은 `/api/fit` 하나이고 거기에 토큰버킷 레이트리밋이 이미 있다.
--   ⚠️ **수용한 위험**: 4,000개씩 ~13회 부르면 사전 48,657 낱말의 V-Level 을 열거할 수 있다.
--      지금도 `/fit` 에 지문을 붙여넣으면 같은 값이 나오므로 **새로 열리는 정보는 아니고**
--      토크나이저 단계가 없어져 싸질 뿐이다. 통제 수단은 레이트리밋이다.
--   - 재실행 안전(CREATE OR REPLACE). 롤백은 DROP FUNCTION 한 줄.

CREATE OR REPLACE FUNCTION public.textfit_resolve_levels_public(p_words text[])
RETURNS TABLE(surface text, headword text, v_level smallint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '15000'
AS $function$
  WITH input_words AS (
    SELECT DISTINCT lower(trim(w)) AS w
    FROM unnest(p_words) AS w
    WHERE length(trim(w)) >= 2
    LIMIT 4000
  ),
  resolved AS (
    SELECT iw.w AS surface, public.resolve_dict_headword(iw.w) AS hw
    FROM input_words iw
  )
  SELECT
    r.surface,
    d.word AS headword,
    d.v_level
  FROM resolved r
  JOIN public.shared_dictionary d ON d.word = r.hw
  WHERE d.classified_by IS NOT NULL;
$function$;

COMMENT ON FUNCTION public.textfit_resolve_levels_public(text[]) IS
  '공개 TextFit 용 — 표면형을 표제어·V-Level 로 해석. textfit_resolve_levels 의 SECURITY DEFINER 쌍둥이(anon 은 shared_dictionary 를 못 읽는다). 반환 3열, 뜻 미포함. 읽기 전용.';

REVOKE ALL ON FUNCTION public.textfit_resolve_levels_public(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.textfit_resolve_levels_public(text[]) TO anon, authenticated;

-- 롤백:
--   DROP FUNCTION IF EXISTS public.textfit_resolve_levels_public(text[]);
