-- 20260811132526_en_inflection_men_plural_defer.sql
-- 20260811125842 의 회귀 정정 — men$ 양보를 조건부로.
--
-- 앞 판본은 `-en` 규칙에서 men$ 를 무조건 뺐다. seamen→seam 오답은 막혔지만
-- 중세영어 동사 어미(-en)까지 함께 막혔다:
--     becomen → 이전 [becoman, becom] → spelling 티어가 become 을 찾음
--             → 앞 판본 이후 [becoman] 뿐 → not_found  ← 회귀
-- (swimmen 은 spelling 티어가 우연히 살려서 드러나지 않았다.)
--
-- 정정: `-man` 형태가 **실제 사전 표제어일 때만** -en 후보를 양보한다.
--   근거 — 두 규칙이 충돌하는 경우는 -man 복합명사가 실재할 때뿐이고,
--   그때만 inflection 티어의 ORDER BY frequency_rank 가 오답(seam)을 고를 수 있다.
--   -man 형태가 없으면 애초에 경쟁이 없으므로 -en 후보를 막을 이유가 없다.
--
-- 실측 검증 31단어 전수 통과:
--   seamen→seaman(선원) · policemen→policeman · gentlemen→gentleman · workmen→workman
--   fishermen→fisherman · horsemen→horseman · watchmen→watchman · freshmen→freshman
--   tradesmen→tradesman · clergymen→clergyman              ← -man 사전 보유 → -en 양보
--   becomen→become(spelling) · swimmen→swim(spelling) · crimen→crimen(coverage-clean)
--   marshalmen→not_found(정직)                              ← -man 미보유 → -en 유지
--   dolmen · hymen · omen · specimen · abdomen · regimen · acumen · bitumen · children ·
--   broken → direct 티어가 먼저 잡아 이 티어 미도달
--   oxen→ox · risen→rise · eaten→eat · fallen→fall · foramen → 기존 동작 유지

CREATE OR REPLACE FUNCTION public.en_inflection_bases(p text)
 RETURNS text[]
 LANGUAGE sql
 STABLE
AS $function$
  SELECT ARRAY(
    SELECT DISTINCT v FROM (
      SELECT base AS v FROM english_irregular_forms WHERE form = p
      UNION ALL
      SELECT v FROM (VALUES
        (CASE WHEN p LIKE '%ed' AND length(p) >= 4 THEN substr(p, 1, length(p)-2) END),
        (CASE WHEN p LIKE '%ed' AND length(p) >= 4 THEN substr(p, 1, length(p)-1) END),
        (CASE WHEN p LIKE '%ied' AND length(p) >= 5 THEN substr(p, 1, length(p)-3) || 'y' END),
        (CASE WHEN p LIKE '%ing' AND length(p) >= 5 THEN substr(p, 1, length(p)-3) END),
        (CASE WHEN p LIKE '%ing' AND length(p) >= 5 THEN substr(p, 1, length(p)-3) || 'e' END),
        (CASE WHEN p LIKE '%ying' AND length(p) >= 6 THEN substr(p, 1, length(p)-4) || 'y' END),
        (CASE WHEN p LIKE '%ies' AND length(p) >= 5 THEN substr(p, 1, length(p)-3) || 'y' END),
        (CASE WHEN p ~ '(sh|ch|ss|x|z|o)es$' AND length(p) >= 4 THEN substr(p, 1, length(p)-2) END),
        (CASE WHEN p LIKE '%s' AND p NOT LIKE '%ss' AND p NOT LIKE '%us' AND length(p) >= 4
              THEN substr(p, 1, length(p)-1) END),
        (CASE WHEN p ~ '([bdfgklmnprtvz])\1ed$' AND length(p) >= 5 THEN substr(p, 1, length(p)-3) END),
        (CASE WHEN p ~ '([bdfgklmnprtvz])\1ing$' AND length(p) >= 6 THEN substr(p, 1, length(p)-4) END),
        (CASE WHEN p LIKE '%er' AND length(p) >= 4 THEN substr(p, 1, length(p)-2) END),
        (CASE WHEN p LIKE '%er' AND length(p) >= 4 THEN substr(p, 1, length(p)-2) || 'e' END),
        (CASE WHEN p LIKE '%ier' AND length(p) >= 5 THEN substr(p, 1, length(p)-3) || 'y' END),
        (CASE WHEN p LIKE '%est' AND length(p) >= 5 THEN substr(p, 1, length(p)-3) END),
        (CASE WHEN p LIKE '%est' AND length(p) >= 5 THEN substr(p, 1, length(p)-3) || 'e' END),
        (CASE WHEN p LIKE '%iest' AND length(p) >= 6 THEN substr(p, 1, length(p)-4) || 'y' END),
        (CASE WHEN p LIKE '%th' AND length(p) >= 4 THEN substr(p, 1, length(p)-2) END),
        (CASE WHEN p LIKE '%eth' AND length(p) >= 5 THEN substr(p, 1, length(p)-3) END),
        -- -man 복수
        (CASE WHEN p LIKE '%men' AND length(p) >= 5 THEN substr(p, 1, length(p)-3) || 'man' END),
        -- 과거분사/중세영어 -en — `-man` 형태가 사전에 있을 때만 양보한다
        (CASE WHEN p LIKE '%en' AND length(p) >= 4
                   AND (p NOT LIKE '%men'
                        OR NOT EXISTS (SELECT 1 FROM shared_dictionary sdx
                                        WHERE sdx.word = substr(p, 1, length(p)-3) || 'man'
                                          AND sdx.classified_by IS NOT NULL
                                          AND sdx.meaning_ko IS NOT NULL
                                          AND length(sdx.meaning_ko) > 0))
              THEN substr(p, 1, length(p)-2) END)
      ) AS t(v) WHERE v IS NOT NULL
    ) AS u
    WHERE u.v <> p AND length(u.v) >= 2
  );
$function$;
