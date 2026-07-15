-- 20260713172000_infer_form_pos_helper.sql
-- 추출 경로 통합(1단계, drift 방지) — 형태→품사 추론을 공유 헬퍼로.
--   3개 추출 함수(book/article/user)가 인라인 복붙 대신 이 헬퍼를 호출 → 규칙 변경 시 한 곳만 수정.
--   surface(실제 형태)와 base(해소된 표제어)의 형태차로 품사를 추론(context_pos NULL 폴백용).
--   ed/d/ied·ing→verb · ly/ily/ically→adverb · -tion/sion/ment/ness/ity/ance/ence→noun ·
--   -ous/ive/ful/less/ish/able/ible→adjective. 판별 불가 시 NULL(→ 호출부가 flat 폴백).
CREATE OR REPLACE FUNCTION public.infer_form_pos(p_surface text, p_base text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $function$
  SELECT CASE
    WHEN p_surface = p_base||'ed' OR p_surface = p_base||'d'
         OR p_surface = regexp_replace(p_base,'y$','ied') THEN 'verb'
    WHEN p_surface = p_base||'ing' OR p_surface = regexp_replace(p_base,'e$','ing') THEN 'verb'
    WHEN p_surface = p_base||'ly' OR p_surface = regexp_replace(p_base,'y$','ily')
         OR p_surface = regexp_replace(p_base,'ic$','ically') THEN 'adverb'
    WHEN p_surface <> p_base AND p_surface ~ '(tion|sion|ment|ness|ity|ance|ence)$' THEN 'noun'
    WHEN p_surface <> p_base AND p_surface ~ '(ous|ive|ful|less|ish|able|ible)$' THEN 'adjective'
    ELSE NULL
  END
$function$;
-- 검증
SELECT infer_form_pos('ransomed','ransom') a, infer_form_pos('booming','boom') b,
       infer_form_pos('quickly','quick') c, infer_form_pos('happiness','happy') d,
       infer_form_pos('run','run') e;
