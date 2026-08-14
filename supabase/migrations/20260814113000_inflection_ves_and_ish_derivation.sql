-- supabase/migrations/20260814113000_inflection_ves_and_ish_derivation.sql
-- 형태 규칙 구조적 갭 2건 — Simplicissimus 처분 중 드러난 것을 코퍼스 전체로 일반화.
--
-- ── 갭 1. en_inflection_bases 에 -ves 복수 규칙이 아예 없다
--
-- 영어 `-f`/`-fe` 명사의 복수는 `-ves` 다(knife→knives · wolf→wolves). 그런데 이 함수엔
-- 그 규칙이 없어 `wheatsheaves` → `wheatsheave` 만 나왔다(실측). 지금까지 thieves·wolves·
-- loaves 가 해석된 것은 english_irregular_forms 와 cluster 티어가 개별로 덮고 있었기 때문이고,
-- 규칙 자체는 빠져 있어 **바인딩 경로(trg_lbv_fill_lemma)가 이 부류를 통째로 놓쳤다.**
--
-- ★ 그대로 넣으면 안 된다 — 동사의 3인칭 `-ves` 와 충돌한다:
--     saves → safe · caves → cafe · serves → serf   (전부 사전에 실재하는 표제어)
--   바인딩 트리거는 `ORDER BY id.word LIMIT 1`(알파벳)이라 safe 가 save 를 이긴다.
--
-- 가드: `-ve` 로 끝나는 base 가 사전에 있으면 -f/-fe 후보를 내지 않는다.
--   (save·cave·serve·achieve·archive·arrive 는 전부 사전에 있으므로 자동 차단)
--
-- 실측 (전 카탈로그, `%ves` 210 lemma):
--   차단 182 — absolves · achieves · adjectives · alcoves · archives · arrives · behaves …
--   통과  28 — knife · wolf · thief · loaf · wife · self · sheaf · scarf · hoof · wharf ·
--              elf · turf · midwife · housewife · beef · bookshelf · mischief · wheatsheaf …
--   → **미바인딩 486행 / 28 lemma 가 새로 바인딩**된다.
--   오탐 후보 2 (`reeves→reef` · `lieves→lief`) — 현재는 아무 뜻도 못 주는 상태라 순손실은 아니다.
--
-- ── 갭 2. en_derivational_bases 의 `-ish` 만 `+e` 복원 변형이 없다
--
-- 같은 파일의 형제 규칙(-ly · -er · -en · -ion · -ity · -able · -or · -ance · -ence)은 전부
-- `strip` 과 `strip+e` 두 벌을 낸다. `-ish` 만 한 벌이라 `epicurish` → `epicur`(실패) 였다.
-- `epicure`(V10)가 사전에 있는데도 파생 base 를 못 찾던 것 — 규칙의 비대칭이 원인이다.
--
-- ── 하지 않은 것: lookup_word_meaning 의 derivation 티어를 en_derivational_bases 로 통합
--
-- 두 규칙 집합이 갈라져 있다(전자 12 규칙 · 후자 100+). 통합이 자연스러워 보여 실측했더니
-- **통합하면 안 된다**: not_found 5,827 중 453건이 en_derivational_bases 로 base 를 얻지만
-- 부정 접두사 가드를 통과한 274건조차 품질이 나쁘다 —
--   `ation → at` · `barant → bar` · `bative → bat` · `bombance → bombe` · `archlight → arch`.
-- ADR 0004 D4 가 정한 "틀린 뜻은 뜻이 없는 것보다 나쁘다"에 정면으로 걸린다.
-- 두 집합의 분리는 결함이 아니라 **재현율(seed 후보 — 사람/배치가 뒤에서 검수) 대
-- 정밀도(학습자 즉시 노출)의 의도된 분리**다. DB_SCHEMA 에 명시했다.
--
-- 되돌리기: 두 함수를 이전 정의로 CREATE OR REPLACE (본 파일 이전 버전은 git 이력).
-- 멱등: 순수 함수 교체. 데이터 변경 없음. 반영에는 backfill_book_lemmas + fill_lbv_resolution 필요.

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1) en_inflection_bases — -ves 복수 (동사 -ve 충돌 가드)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.en_inflection_bases(p text)
RETURNS text[]
LANGUAGE sql
STABLE
AS $fn$
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
        -- ★ -f / -fe 명사의 -ves 복수 (knife→knives · wolf→wolves).
        --   동사 3인칭 -ves(saves·caves·serves)와 충돌하므로, `-ve` base 가 사전에 있으면 내지 않는다.
        (CASE WHEN p LIKE '%ves' AND length(p) >= 5
                   AND NOT EXISTS (SELECT 1 FROM shared_dictionary sdv
                                    WHERE sdv.word = substr(p, 1, length(p)-3) || 've'
                                      AND sdv.classified_by IS NOT NULL
                                      AND sdv.meaning_ko IS NOT NULL
                                      AND length(sdv.meaning_ko) > 0)
              THEN substr(p, 1, length(p)-3) || 'f' END),
        (CASE WHEN p LIKE '%ves' AND length(p) >= 5
                   AND NOT EXISTS (SELECT 1 FROM shared_dictionary sdv
                                    WHERE sdv.word = substr(p, 1, length(p)-3) || 've'
                                      AND sdv.classified_by IS NOT NULL
                                      AND sdv.meaning_ko IS NOT NULL
                                      AND length(sdv.meaning_ko) > 0)
              THEN substr(p, 1, length(p)-3) || 'fe' END),
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
$fn$;

COMMENT ON FUNCTION public.en_inflection_bases(text) IS
  '굴절 base 후보. v06.36 — -ves 복수 규칙 추가(-f/-fe). '
  '동사 3인칭 -ves 와 충돌하므로 `-ve` base 가 사전에 있으면 후보를 내지 않는다(saves→safe 차단).';

-- ─────────────────────────────────────────────────────────────
-- 2) en_derivational_bases — `-ish` 에 +e 복원 변형 추가
--    (형제 규칙과 동일한 strip / strip+e 두 벌 구조로 맞춘다)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.en_derivational_bases(p text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT ARRAY(
    SELECT DISTINCT v FROM (VALUES
      (CASE WHEN p LIKE '%ness' AND length(p)>=5 THEN substr(p, 1, length(p)-4) END),
      (CASE WHEN p LIKE '%iness' AND length(p)>=6 THEN substr(p, 1, length(p)-5) || 'y' END),
      (CASE WHEN p LIKE '%ment' AND length(p)>=5 THEN substr(p, 1, length(p)-4) END),
      (CASE WHEN p LIKE '%tion' AND length(p)>=5 THEN substr(p, 1, length(p)-4) END),
      (CASE WHEN p LIKE '%ation' AND length(p)>=6 THEN substr(p, 1, length(p)-5) || 'ate' END),
      (CASE WHEN p LIKE '%ation' AND length(p)>=6 THEN substr(p, 1, length(p)-5) || 'e' END),
      (CASE WHEN p LIKE '%ation' AND length(p)>=6 THEN substr(p, 1, length(p)-5) END),
      (CASE WHEN p LIKE '%ion' AND length(p)>=5 THEN substr(p, 1, length(p)-3) END),
      (CASE WHEN p LIKE '%ion' AND length(p)>=5 THEN substr(p, 1, length(p)-3) || 'e' END),
      (CASE WHEN p LIKE '%sion' AND length(p)>=5 THEN substr(p, 1, length(p)-4) END),
      (CASE WHEN p LIKE '%osity' AND length(p)>=6 THEN substr(p, 1, length(p)-5) || 'ous' END),
      (CASE WHEN p LIKE '%ility' AND length(p)>=6 THEN substr(p, 1, length(p)-5) || 'ile' END),
      (CASE WHEN p LIKE '%ility' AND length(p)>=6 THEN substr(p, 1, length(p)-5) || 'le' END),
      (CASE WHEN p LIKE '%ity' AND length(p)>=4 THEN substr(p, 1, length(p)-3) END),
      (CASE WHEN p LIKE '%ity' AND length(p)>=4 THEN substr(p, 1, length(p)-3) || 'e' END),
      (CASE WHEN p LIKE '%ty' AND length(p)>=5 THEN substr(p, 1, length(p)-2) END),
      (CASE WHEN p LIKE '%cy' AND length(p)>=5 THEN substr(p, 1, length(p)-2) || 't' END),
      (CASE WHEN p LIKE '%ence' AND length(p)>=5 THEN substr(p, 1, length(p)-4) END),
      (CASE WHEN p LIKE '%ence' AND length(p)>=5 THEN substr(p, 1, length(p)-4) || 'e' END),
      (CASE WHEN p LIKE '%ence' AND length(p)>=5 THEN substr(p, 1, length(p)-4) || 'ent' END),
      (CASE WHEN p LIKE '%ance' AND length(p)>=5 THEN substr(p, 1, length(p)-4) END),
      (CASE WHEN p LIKE '%ance' AND length(p)>=5 THEN substr(p, 1, length(p)-4) || 'e' END),
      (CASE WHEN p LIKE '%ance' AND length(p)>=5 THEN substr(p, 1, length(p)-4) || 'ant' END),
      (CASE WHEN p LIKE '%hood' AND length(p)>=5 THEN substr(p, 1, length(p)-4) END),
      (CASE WHEN p LIKE '%ship' AND length(p)>=5 THEN substr(p, 1, length(p)-4) END),
      (CASE WHEN p LIKE '%dom' AND length(p)>=5 THEN substr(p, 1, length(p)-3) END),
      (CASE WHEN p LIKE '%ry' AND length(p)>=5 THEN substr(p, 1, length(p)-2) END),
      (CASE WHEN p LIKE '%ery' AND length(p)>=5 THEN substr(p, 1, length(p)-3) END),
      (CASE WHEN p LIKE '%or' AND length(p)>=5 THEN substr(p, 1, length(p)-2) END),
      (CASE WHEN p LIKE '%or' AND length(p)>=5 THEN substr(p, 1, length(p)-2) || 'e' END),
      (CASE WHEN p LIKE '%ator' AND length(p)>=6 THEN substr(p, 1, length(p)-3) || 'e' END),
      (CASE WHEN p LIKE '%er' AND length(p)>=4 THEN substr(p, 1, length(p)-2) END),
      (CASE WHEN p LIKE '%er' AND length(p)>=4 THEN substr(p, 1, length(p)-2) || 'e' END),
      (CASE WHEN p LIKE '%ant' AND length(p)>=5 THEN substr(p, 1, length(p)-3) END),
      (CASE WHEN p LIKE '%ate' AND length(p)>=5 THEN substr(p, 1, length(p)-3) END),
      -- 숫자 형용사
      (CASE WHEN p LIKE '%teen' AND length(p)>=6 THEN substr(p, 1, length(p)-4) END),
      (CASE WHEN p LIKE '%ty' AND p ~ '^(twen|thir|for|fif|six|seven|eigh|nine)ty$'
            THEN substr(p, 1, length(p)-2) END),
      -- 형용사 파생
      (CASE WHEN p LIKE '%ful' AND length(p)>=4 THEN substr(p, 1, length(p)-3) END),
      (CASE WHEN p LIKE '%less' AND length(p)>=5 THEN substr(p, 1, length(p)-4) END),
      (CASE WHEN p LIKE '%able' AND length(p)>=5 THEN substr(p, 1, length(p)-4) END),
      (CASE WHEN p LIKE '%able' AND length(p)>=5 THEN substr(p, 1, length(p)-4) || 'e' END),
      (CASE WHEN p LIKE '%ible' AND length(p)>=5 THEN substr(p, 1, length(p)-4) END),
      (CASE WHEN p LIKE '%ous' AND length(p)>=5 THEN substr(p, 1, length(p)-3) END),
      (CASE WHEN p LIKE '%ic' AND length(p)>=5 THEN substr(p, 1, length(p)-2) END),
      (CASE WHEN p LIKE '%ical' AND length(p)>=6 THEN substr(p, 1, length(p)-4) END),
      (CASE WHEN p LIKE '%ical' AND length(p)>=6 THEN substr(p, 1, length(p)-2) END),
      (CASE WHEN p LIKE '%ive' AND length(p)>=5 THEN substr(p, 1, length(p)-3) END),
      (CASE WHEN p LIKE '%ary' AND length(p)>=5 THEN substr(p, 1, length(p)-3) END),
      (CASE WHEN p LIKE '%ory' AND length(p)>=5 THEN substr(p, 1, length(p)-3) END),
      (CASE WHEN p LIKE '%ish' AND length(p)>=4 THEN substr(p, 1, length(p)-3) END),
      -- ★ v06.36 — 형제 규칙과 동일한 +e 복원. epicurish→epicure · millionairish→millionaire
      (CASE WHEN p LIKE '%ish' AND length(p)>=6 THEN substr(p, 1, length(p)-3) || 'e' END),
      (CASE WHEN p LIKE '%en' AND length(p)>=4 THEN substr(p, 1, length(p)-2) END),
      (CASE WHEN p LIKE '%en' AND length(p)>=4 THEN substr(p, 1, length(p)-2) || 'e' END),
      -- 부사 파생
      (CASE WHEN p LIKE '%ably' AND length(p)>=6 THEN substr(p, 1, length(p)-4) || 'able' END),
      (CASE WHEN p LIKE '%ibly' AND length(p)>=6 THEN substr(p, 1, length(p)-4) || 'ible' END),
      (CASE WHEN p LIKE '%arily' AND length(p)>=6 THEN substr(p, 1, length(p)-5) || 'ary' END),
      (CASE WHEN p LIKE '%ically' AND length(p)>=7 THEN substr(p, 1, length(p)-6) || 'ic' END),
      (CASE WHEN p LIKE '%ically' AND length(p)>=7 THEN substr(p, 1, length(p)-6) || 'ical' END),
      (CASE WHEN p LIKE '%ily' AND length(p)>=5 THEN substr(p, 1, length(p)-3) || 'y' END),
      (CASE WHEN p LIKE '%ly' AND length(p)>=4 THEN substr(p, 1, length(p)-2) END),
      (CASE WHEN p LIKE '%ly' AND length(p)>=4 THEN substr(p, 1, length(p)-2) || 'e' END),
      -- 복합어
      (CASE WHEN p LIKE '%man' AND length(p)>=5 THEN substr(p, 1, length(p)-3) END),
      (CASE WHEN p LIKE '%men' AND length(p)>=5 THEN substr(p, 1, length(p)-3) END),
      (CASE WHEN p LIKE '%sman' AND length(p)>=6 THEN substr(p, 1, length(p)-4) END),
      (CASE WHEN p LIKE '%woman' AND length(p)>=7 THEN substr(p, 1, length(p)-5) END),
      (CASE WHEN p LIKE '%house' AND length(p)>=7 THEN substr(p, 1, length(p)-5) END),
      (CASE WHEN p LIKE '%land' AND length(p)>=6 THEN substr(p, 1, length(p)-4) END),
      (CASE WHEN p LIKE '%side' AND length(p)>=6 THEN substr(p, 1, length(p)-4) END),
      (CASE WHEN p LIKE '%bed' AND length(p)>=5 THEN substr(p, 1, length(p)-3) END),
      (CASE WHEN p LIKE '%room' AND length(p)>=6 THEN substr(p, 1, length(p)-4) END),
      (CASE WHEN p LIKE '%work' AND length(p)>=6 THEN substr(p, 1, length(p)-4) END),
      (CASE WHEN p LIKE '%yard' AND length(p)>=6 THEN substr(p, 1, length(p)-4) END),
      (CASE WHEN p LIKE '%light' AND length(p)>=7 THEN substr(p, 1, length(p)-5) END),
      (CASE WHEN p LIKE '%board' AND length(p)>=7 THEN substr(p, 1, length(p)-5) END),
      (CASE WHEN p LIKE '%keeper' AND length(p)>=8 THEN substr(p, 1, length(p)-6) END),
      (CASE WHEN p LIKE '%maker' AND length(p)>=7 THEN substr(p, 1, length(p)-5) END),
      (CASE WHEN p LIKE '%fall' AND length(p)>=6 THEN substr(p, 1, length(p)-4) END),
      (CASE WHEN p LIKE '%stone' AND length(p)>=7 THEN substr(p, 1, length(p)-5) END),
      (CASE WHEN p LIKE '%mark' AND length(p)>=6 THEN substr(p, 1, length(p)-4) END),
      (CASE WHEN p LIKE '%back' AND length(p)>=6 THEN substr(p, 1, length(p)-4) END),
      (CASE WHEN p LIKE '%hold' AND length(p)>=6 THEN substr(p, 1, length(p)-4) END),
      (CASE WHEN p LIKE '%ward' AND length(p)>=5 THEN substr(p, 1, length(p)-4) END),
      (CASE WHEN p LIKE '%wards' AND length(p)>=6 THEN substr(p, 1, length(p)-5) END),
      (CASE WHEN p LIKE '%like' AND length(p)>=5 THEN substr(p, 1, length(p)-4) END),
      (CASE WHEN p LIKE '%plate' AND length(p)>=7 THEN substr(p, 1, length(p)-5) END),
      (CASE WHEN p LIKE '%boat' AND length(p)>=6 THEN substr(p, 1, length(p)-4) END),
      (CASE WHEN p LIKE '%word' AND length(p)>=6 THEN substr(p, 1, length(p)-4) END),
      (CASE WHEN p LIKE '%shot' AND length(p)>=6 THEN substr(p, 1, length(p)-4) END),
      (CASE WHEN p LIKE '%stick' AND length(p)>=7 THEN substr(p, 1, length(p)-5) END),
      (CASE WHEN p LIKE '%road' AND length(p)>=6 THEN substr(p, 1, length(p)-4) END),
      -- 접두사
      (CASE WHEN p LIKE 'un%' AND length(p)>=5 THEN substr(p, 3) END),
      (CASE WHEN p LIKE 're%' AND length(p)>=5 THEN substr(p, 3) END),
      (CASE WHEN p LIKE 're-%' AND length(p)>=5 THEN substr(p, 4) END),
      (CASE WHEN p LIKE 'dis%' AND length(p)>=6 THEN substr(p, 4) END),
      (CASE WHEN p LIKE 'mis%' AND length(p)>=6 THEN substr(p, 4) END),
      (CASE WHEN p LIKE 'over%' AND length(p)>=7 THEN substr(p, 5) END),
      (CASE WHEN p LIKE 'under%' AND length(p)>=8 THEN substr(p, 6) END),
      (CASE WHEN p LIKE 'out%' AND length(p)>=6 THEN substr(p, 4) END),
      (CASE WHEN p LIKE 'pre%' AND length(p)>=6 THEN substr(p, 4) END),
      (CASE WHEN p LIKE 'non%' AND length(p)>=6 THEN substr(p, 4) END),
      (CASE WHEN p LIKE 'fore%' AND length(p)>=7 THEN substr(p, 5) END),
      (CASE WHEN p LIKE 'im%' AND length(p)>=6 THEN substr(p, 3) END),
      (CASE WHEN p LIKE 'in%' AND length(p)>=6 THEN substr(p, 3) END),
      (CASE WHEN p LIKE 'en%' AND length(p)>=5 THEN substr(p, 3) END),
      (CASE WHEN p LIKE 'en%' AND length(p)>=5 THEN substr(p, 3) || 'e' END),
      (CASE WHEN p LIKE 'un%' AND p LIKE '%ly' AND length(p)>=6 THEN substr(p, 3, length(p)-4) END),
      (CASE WHEN p LIKE 'un%' AND p LIKE '%ed' AND length(p)>=6 THEN substr(p, 3, length(p)-4) END),
      (CASE WHEN p LIKE 'un%' AND p LIKE '%ing' AND length(p)>=7 THEN substr(p, 3, length(p)-5) END),
      (CASE WHEN p LIKE 're%' AND p LIKE '%ed' AND length(p)>=6 THEN substr(p, 3, length(p)-4) END),
      (CASE WHEN p LIKE 'over%' AND p LIKE '%ed' AND length(p)>=7 THEN substr(p, 5, length(p)-6) END),
      (CASE WHEN p LIKE 'im%' AND p LIKE '%able' AND length(p)>=8 THEN substr(p, 3, length(p)-6) || 'e' END),
      (CASE WHEN p LIKE 'in%' AND p LIKE '%able' AND length(p)>=8 THEN substr(p, 3, length(p)-6) || 'e' END)
    ) AS t(v)
    WHERE v <> p AND length(v) >= 2
  );
$fn$;

COMMENT ON FUNCTION public.en_derivational_bases(text) IS
  '파생 base 후보 — **재현율 우선**. seed 후보 생성과 진단 deriv_base 전용이며, '
  '뒤에서 사람/배치가 검수하는 것을 전제로 한다. '
  '학습자에게 즉시 노출되는 뜻(lookup_word_meaning 의 derivation 티어)에는 쓰지 말 것 — '
  '실측상 ation→at · barant→bar 류 오탐이 다수 (ADR 0004 D4: 틀린 뜻은 뜻이 없는 것보다 나쁘다). '
  'v06.36 — -ish 에 +e 복원 추가(epicurish→epicure).';

COMMIT;
