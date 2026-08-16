-- 20260816045450_publish_lookup_prefers_registered_inflections.sql
--
-- 발행 경로가 사전의 명시적 굴절형보다 규칙 생성 추측을 먼저 믿던 것을 고친다.
--
-- 증상 (실측 2026-08-15): 발행 세트 207행(109 표제어)의 `lemma` 가 `resolve_dict_headword()` 와 어긋났고,
--   학습자에게 **틀린 뜻**이 나갔다 — `dying`→"염색하다"(dye) · `lying`→"양잿물"(lye) ·
--   `riper`→"찢다"(rip) · `scraping`→"조각, 부스러기"(scrap).
--
-- 원인: 두 해석기의 단계 순서가 다르다.
--   resolve_dict_headword : L2 사전 등재 굴절형(inflected_forms) → L3 규칙 생성
--   lookup_word_meaning   : inflection(규칙 생성) → ... → cluster(inflected_forms)   ← 뒤집혀 있다
--   `ripe` 는 `riper`·`ripest` 를 명시적으로 등재해 두었는데, 발행 경로가 그것을 보기 전에
--   규칙 후보 `rip`(빈도 3906 < ripe 6697)을 집어갔다. `die`/`dye`, `lie`/`lye` 도 같은 구조.
--
-- 영향 시뮬레이션: 발행 세트의 서로 다른 표면 24,273 중 **20개만** 결과가 바뀐다.
--   20개 전수 확인 → 16 개선 · 3 퇴행 · 1 애매(`axes` — axe/axis 둘 다 정당한 복수형이라 그대로 둔다).
--   퇴행 3건은 순서가 아니라 **사전 데이터 오류**였으므로 아래 (1)에서 함께 고친다.
--
-- ⚠️ 자동 탐지를 두 번 시도했다가 두 번 다 실패했다:
--    "명사인데 -ed/-ing 굴절형 보유"(19건)도, "묵음 e 하나로 갈리는 명사/동사 쌍"(44건)도
--    대부분 오탐이었다 (`caned`←cane · `sited`←site · `wines`←wine 은 명사 쪽이 맞다).
--    실제 오류는 시뮬레이션이 짚어 준 2 표제어뿐이다.
--    **전수 확인 없이 일괄 적용했으면 멀쩡한 데이터 17~42건을 망쳤다.**

-- ── (1) 잘못 등재된 굴절형을 올바른 동사 표제어로 옮긴다 ──────────────
-- envelope(봉투, 명사)가 envelop(감싸다, 동사)의 굴절형을 갖고 있었다. 복수형 envelopes 는 남긴다.
UPDATE shared_dictionary
   SET inflected_forms = array_remove(array_remove(coalesce(inflected_forms,'{}'), 'enveloped'), 'enveloping'),
       updated_at = now()
 WHERE word = 'envelope';

UPDATE shared_dictionary
   SET inflected_forms = (
         SELECT ARRAY(SELECT DISTINCT unnest(coalesce(inflected_forms,'{}') || ARRAY['enveloped','enveloping','envelops']))
       ),
       updated_at = now()
 WHERE word = 'envelop';

-- wreath(화환, 명사)가 wreathe(휘감다, 동사)의 굴절형을 갖고 있었다. 복수형 wreaths 는 남긴다.
UPDATE shared_dictionary
   SET inflected_forms = array_remove(array_remove(array_remove(coalesce(inflected_forms,'{}'),
         'wreathed'), 'wreathing'), 'wreathes'),
       updated_at = now()
 WHERE word = 'wreath';

UPDATE shared_dictionary
   SET inflected_forms = (
         SELECT ARRAY(SELECT DISTINCT unnest(coalesce(inflected_forms,'{}') || ARRAY['wreathed','wreathing','wreathes']))
       ),
       updated_at = now()
 WHERE word = 'wreathe';

-- ── (2) 단계 순서를 해석기와 맞춘다 — cluster(등재) 를 inflection(규칙) 앞으로 ──
-- 나머지 단계·조건은 그대로다. 옮긴 것은 `cluster` 블록의 위치뿐이다.
CREATE OR REPLACE FUNCTION public.lookup_word_meaning(p_surface text)
 RETURNS TABLE(found boolean, surface text, resolved_word text, meaning_ko text, pos text, cefr_level text, v_level smallint, example_en text, match_via text, word_register text, gloss_en text, lang text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE s text := lower(trim(coalesce(p_surface,''))); dh text;
BEGIN
  IF s = '' OR s !~ '[a-z]' THEN
    RETURN QUERY SELECT false, p_surface, NULL::text, NULL::text, NULL::text, NULL::text, NULL::smallint, NULL::text, 'invalid'::text, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;
  dh := replace(s,'-','');

  RETURN QUERY SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint, d.example_en, 'direct'::text, d.word_register, NULL::text, 'en'::text
    FROM shared_dictionary d WHERE d.word = s AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0 LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- 사전이 이 형태를 어느 표제어의 굴절형으로 **명시해 두었다면** 규칙 추측보다 우선한다.
  -- (v06.36) 이 블록이 아래 inflection 뒤에 있던 동안 `dying`→dye · `lying`→lye · `riper`→rip 이 나갔다.
  RETURN QUERY SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint, d.example_en, 'cluster'::text, d.word_register, NULL::text, 'en'::text
    FROM shared_dictionary d WHERE d.inflected_forms @> ARRAY[s] AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0 ORDER BY d.frequency_rank NULLS LAST LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint, d.example_en, 'inflection'::text, d.word_register, NULL::text, 'en'::text
    FROM unnest(en_inflection_bases(s)) AS cand(c) JOIN shared_dictionary d ON d.word = cand.c
    WHERE d.v_level IS NOT NULL AND d.classified_by IS NOT NULL AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0 ORDER BY d.frequency_rank NULLS LAST LIMIT 1;
  IF FOUND THEN RETURN; END IF;
  RETURN QUERY SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint, d.example_en, 'variant'::text, d.word_register, NULL::text, 'en'::text
    FROM shared_dictionary d WHERE d.spelling_variants @> ARRAY[s] AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0 LIMIT 1;
  IF FOUND THEN RETURN; END IF;
  RETURN QUERY SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint, d.example_en, 'derivation'::text, d.word_register, NULL::text, 'en'::text
    FROM (SELECT unnest(array_remove(ARRAY[
        CASE WHEN s ~ 'ically$' THEN regexp_replace(s,'ically$','ic') END, CASE WHEN s ~ 'ily$' THEN regexp_replace(s,'ily$','y') END,
        CASE WHEN s ~ 'ly$' THEN regexp_replace(s,'ly$','') END, CASE WHEN s ~ 'iness$' THEN regexp_replace(s,'iness$','y') END,
        CASE WHEN s ~ 'ness$' THEN regexp_replace(s,'ness$','') END, CASE WHEN s ~ 'iless$' THEN regexp_replace(s,'iless$','y') END,
        CASE WHEN s ~ 'less$' THEN regexp_replace(s,'less$','') END, CASE WHEN s ~ 'fully$' THEN regexp_replace(s,'fully$','') END,
        CASE WHEN s ~ 'ful$' THEN regexp_replace(s,'ful$','') END, CASE WHEN s ~ 'ish$' THEN regexp_replace(s,'ish$','') END,
        CASE WHEN s ~ 'like$' THEN regexp_replace(s,'like$','') END, CASE WHEN s ~ 'wise$' THEN regexp_replace(s,'wise$','') END
      ], NULL)) AS cand) c JOIN shared_dictionary d ON d.word = c.cand
    WHERE length(c.cand) >= 3 AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0 ORDER BY d.frequency_rank NULLS LAST LIMIT 1;
  IF FOUND THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM proper_noun_forms pnf WHERE pnf.form = s) THEN
    RETURN QUERY SELECT false, p_surface, NULL::text, NULL::text, NULL::text, NULL::text, NULL::smallint, NULL::text, 'proper_noun'::text, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;
  RETURN QUERY SELECT true, p_surface, lc.word, lc.meaning_ko, lc.pos, NULL::text, NULL::smallint, NULL::text, 'coverage-clean'::text, NULL::text, lc.gloss_en, lc.lang
    FROM lexicon_clean lc WHERE lc.word = ANY (ARRAY[s] || en_inflection_bases(s)) AND NOT EXISTS (SELECT 1 FROM dialect_map dmx WHERE dmx.variant = ANY(ARRAY[s] || en_inflection_bases(s))) AND NOT EXISTS (SELECT 1 FROM archaic_dictionary ax WHERE ax.word = s AND ax.meaning_ko IS NOT NULL AND length(ax.meaning_ko) > 0) AND lc.meaning_ko IS NOT NULL AND length(lc.meaning_ko) > 0 ORDER BY (lc.word = s) DESC LIMIT 1;
  IF FOUND THEN RETURN; END IF;
  RETURN QUERY SELECT true, p_surface, lc.word, NULL::text, lc.pos, NULL::text, NULL::smallint, NULL::text, 'coverage-clean_en'::text, NULL::text, lc.gloss_en, lc.lang
    FROM lexicon_clean lc WHERE lc.word = ANY (ARRAY[s] || en_inflection_bases(s)) AND NOT EXISTS (SELECT 1 FROM dialect_map dmx WHERE dmx.variant = ANY(ARRAY[s] || en_inflection_bases(s))) AND NOT EXISTS (SELECT 1 FROM archaic_dictionary ax WHERE ax.word = s AND ax.meaning_ko IS NOT NULL AND length(ax.meaning_ko) > 0) AND lc.gloss_en IS NOT NULL AND length(lc.gloss_en) > 0 ORDER BY (lc.word = s) DESC LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY SELECT true, p_surface, COALESCE(a.modern_equivalent, a.word), a.meaning_ko, a.pos, NULL::text, NULL::smallint, NULL::text, 'archaic'::text, 'archaic_literary'::text, NULL::text, 'en'::text
    FROM archaic_dictionary a
    WHERE a.word = s AND a.meaning_ko IS NOT NULL AND length(a.meaning_ko) > 0 LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint, d.example_en, 'dialect'::text, d.word_register, NULL::text, 'en'::text
    FROM dialect_map dm JOIN shared_dictionary d ON d.word = ANY(ARRAY[dm.standard] || en_inflection_bases(dm.standard))
    WHERE dm.variant = ANY(ARRAY[s] || en_inflection_bases(s)) AND d.classified_by IS NOT NULL AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0
    ORDER BY (dm.variant = s) DESC, (d.word = dm.standard) DESC, d.frequency_rank NULLS LAST LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint, d.example_en, 'spelling'::text, d.word_register, NULL::text, 'en'::text
    FROM spelling_norm sn JOIN shared_dictionary d ON d.word = ANY(ARRAY[sn.standard] || en_inflection_bases(sn.standard))
    WHERE sn.variant = ANY(ARRAY[s] || en_inflection_bases(s)) AND d.classified_by IS NOT NULL AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0
    ORDER BY (sn.variant = s) DESC, (d.word = sn.standard) DESC, d.frequency_rank NULLS LAST LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint, d.example_en, 'normalized'::text, d.word_register, NULL::text, 'en'::text
    FROM shared_dictionary d
    WHERE d.word IN (SELECT unnest(array[sv] || en_inflection_bases(sv)) FROM unnest(surface_variants(s)) sv)
      AND d.classified_by IS NOT NULL AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0
    ORDER BY (d.word = dh) DESC, d.frequency_rank NULLS LAST LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY SELECT true, p_surface, lc.word, lc.meaning_ko, lc.pos, NULL::text, NULL::smallint, NULL::text, 'normalized-coverage'::text, NULL::text, lc.gloss_en, lc.lang
    FROM lexicon_clean lc
    WHERE lc.word IN (SELECT unnest(array[sv] || en_inflection_bases(sv)) FROM unnest(surface_variants(s)) sv)
      AND lc.meaning_ko IS NOT NULL ORDER BY (lc.word = dh) DESC LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint, d.example_en, 'suggestion'::text, d.word_register, NULL::text, 'en'::text
    FROM shared_dictionary d
    WHERE length(s) >= 5 AND dmetaphone(d.word) = dmetaphone(s) AND levenshtein(d.word, s) <= 1
      AND d.classified_by IS NOT NULL AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0 AND d.word ~ '^[a-z]+$'
    ORDER BY levenshtein(d.word, s), d.frequency_rank NULLS LAST LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY SELECT false, p_surface, NULL::text, NULL::text, NULL::text, NULL::text, NULL::smallint, NULL::text, 'not_found'::text, NULL::text, NULL::text, NULL::text;
END $function$;

-- ── 적용 후 확인 (2026-08-16 실측) ───────────────────────────────
--   dying→die(죽다) · lying→lie(거짓말하다) · riper/ripest→ripe(익은) · scraping→scrape(긁다)
--   sheathed/sheathing→sheathe · plumed→plume · waning/waned→wane · pared/paring→pare
--   severed→sever · calves→calf · shelves→shelf
--   퇴행 방지 확인: enveloped/enveloping→envelop(감싸다) · wreathes/wreathed→wreathe(휘감다)
--   옮기면 안 되는 것 확인: envelopes→envelope(봉투) · wreaths→wreath(화환)
--   `axes`→axis (axe/axis 둘 다 정당 — 발행 1행, 그대로 둔다)
--
-- ⚠️ 남은 것: `ripen`(익다)은 사전에 표제어가 없어 여전히 `rip`(찢다)으로 풀린다.
--    en_inflection_bases 의 `-en` 규칙에만 묵음 e 짝(`|| 'e'`)이 없어서 `ripe` 가 후보에 못 든다
--    (`-er`·`-est`·`-ing` 에는 전부 있다). 규칙을 넓히기 전에 `ripen`·`darken` 류의
--    파생 동사를 표제어로 등재하는 쪽이 맞다 — 다음 회차.
