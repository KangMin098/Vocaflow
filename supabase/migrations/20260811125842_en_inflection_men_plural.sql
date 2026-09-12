-- 20260811125842_en_inflection_men_plural.sql
-- en_inflection_bases 에 `-men → -man` 복수 규칙 추가 + `-en` 과거분사 규칙에서 men$ 제외.
--
-- 문제 (v06.35 실측): lookup_word_meaning('seamen') → "솔기"(seam).
--   원인은 D4 에서 넣은 과거분사 `-en` 규칙이 seamen → seam 을 만들고,
--   -man 복수형 후보가 아예 없어서 seaman 이 경쟁조차 못 한 것.
--   (inflection 티어는 ORDER BY frequency_rank 라 흔한 seam 이 이긴다.)
--   winkNLP 쪽에서 -men→-man 무가드 변환을 되돌린(unmangleMenPlural) 뒤로는
--   표면형 `seamen` 이 그대로 넘어오므로 이 티어가 유일한 해소 경로가 된다.
--
-- 안전성:
--   · men$ 를 -en 규칙에서 뺀다 — 영어에 `-men` 으로 끝나는 정규 과거분사는 없다.
--   · length >= 5 이므로 'men' 자체는 대상 밖.
--   · omen·hymen·specimen·abdomen·regimen·acumen·bitumen·foramen 은 direct 티어가
--     먼저 잡으므로 이 티어에 도달하지 않는다 (hymen → direct 실측 확인).
--   · women→woman · children 은 english_irregular_forms 가 이미 흡수.
--
-- ⚠️ 후속 정정: 이 판본의 무조건 men$ 제외는 중세영어 동사 어미(-en)를 함께 막아
--   becomen → becom 후보가 사라지는 회귀를 냈다. 20260811_..._men_plural_defer 에서
--   "`-man` 형태가 사전에 있을 때만 양보" 로 좁힌다.

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
        -- ★ v06.35: -man 복수. -en 규칙보다 구체적이므로 men$ 는 아래 -en 에서 제외한다.
        (CASE WHEN p LIKE '%men' AND length(p) >= 5 THEN substr(p, 1, length(p)-3) || 'man' END),
        -- 과거분사 -en — men$ 제외 (seamen→seam · workmen→workm 오답 차단)
        (CASE WHEN p LIKE '%en' AND p NOT LIKE '%men' AND length(p) >= 4
              THEN substr(p, 1, length(p)-2) END)
      ) AS t(v) WHERE v IS NOT NULL
    ) AS u
    WHERE u.v <> p AND length(u.v) >= 2
  );
$function$;
