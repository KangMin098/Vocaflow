-- supabase/migrations/20260906030000_fix_analyze_book_vrl_column.sql
--
-- `analyze_book_vrl(uuid)` 이 존재하지 않는 컬럼 `book_id` 를 읽는다 → 호출하면 반드시 42703.
--
-- 실제 컬럼은 `library_book_vocabularies.library_book_id` 다(실측: id · **library_book_id** ·
-- chapter_idx · word · frequency_in_book · … · noise_kind). 세 군데가 틀렸다:
--   12행  SELECT COUNT(*) … WHERE book_id = p_book_id
--   19행  … FROM library_book_vocabularies lbv … WHERE lbv.book_id = p_book_id
--   28행  같은 형태
--
-- ── 어떻게 찾았나 ──────────────────────────────────────────────────────
-- 2026-09-06 DB 헬스 ⑥ integrity 축(`collect_db_health_integrity`)의 **첫 실행**이 잡았다.
-- 함수 128개를 plpgsql_check 로 정적 분석해 나온 25건 중, 런타임 임시 테이블 오탐 21건을
-- 걸러 남은 4건에 이것이 있었다.
--
-- **어떤 테스트도 이걸 잡을 수 없었다** — 부르는 곳이 저장소에 하나도 없어서 실행된 적이 없다.
-- 실행되지 않는 코드는 런타임 테스트로는 영원히 안 잡히고, SQL 함수 본문은 타입 검사도 받지 않는다.
-- 정적 분석이 아니면 도서 VRL 분석을 배선하는 날에야 알게 됐을 것이다.
--
-- 로직은 한 글자도 바꾸지 않는다 — 컬럼 이름만 고친다.
-- (원본 정의는 VRL Phase 2. 이 마이그레이션은 그 본문을 그대로 두고 참조만 정정한다.)

create or replace function public.analyze_book_vrl(p_book_id uuid)
returns jsonb
language plpgsql
stable
as $function$
DECLARE
  v_vocab_count INT;
  v_mlf NUMERIC;
  v_msl NUMERIC := 12.0;
  v_idiom_d NUMERIC; v_phrasal_d NUMERIC; v_polysemy_d NUMERIC;
  v_high_v_d NUMERIC; v_kice_ratio NUMERIC; v_ngsl_ratio NUMERIC;
  v_base_lexile NUMERIC; v_ko_adj NUMERIC; v_score INT; v_vl SMALLINT;
BEGIN
  IF p_book_id IS NULL THEN RETURN NULL; END IF;

  SELECT COUNT(*) INTO v_vocab_count
  FROM library_book_vocabularies WHERE library_book_id = p_book_id;

  IF v_vocab_count = 0 THEN
    RETURN jsonb_build_object('book_vrl_score', NULL, 'book_v_level', NULL,
                              'error', 'no vocabulary attached to book',
                              'components', '{}'::jsonb);
  END IF;

  WITH band_nums AS (
    SELECT CASE WHEN sd.lemma_band ~ '^\d+k$'
                THEN (regexp_replace(sd.lemma_band, 'k$', ''))::int ELSE NULL END AS band_n
    FROM library_book_vocabularies lbv
    JOIN shared_dictionary sd ON sd.word = lbv.lemma
    WHERE lbv.library_book_id = p_book_id)
  SELECT ln(GREATEST(AVG(band_n), 1.0)) INTO v_mlf FROM band_nums WHERE band_n IS NOT NULL;
  v_mlf := COALESCE(v_mlf, 2.3);

  WITH book_vocab AS (
    SELECT sd.primary_pos, sd.v_level, sd.list_tags, sd.meanings_ko, sd.word
    FROM library_book_vocabularies lbv
    JOIN shared_dictionary sd ON sd.word = lbv.lemma
    WHERE lbv.library_book_id = p_book_id)
  SELECT
    COUNT(*) FILTER (WHERE primary_pos = 'idiom')::NUMERIC / v_vocab_count,
    COUNT(*) FILTER (WHERE primary_pos = 'phrasal_verb')::NUMERIC / v_vocab_count,
    COUNT(*) FILTER (WHERE jsonb_array_length(meanings_ko) >= 3)::NUMERIC / v_vocab_count,
    COUNT(*) FILTER (WHERE v_level >= 8)::NUMERIC / v_vocab_count,
    COUNT(*) FILTER (WHERE EXISTS(
      SELECT 1 FROM lexicon_frequencies lf
      JOIN frequency_data_sources fds ON fds.id = lf.source_id
      WHERE lf.lemma = book_vocab.word AND fds.source_key = 'kice_csat'))::NUMERIC / v_vocab_count,
    COUNT(*) FILTER (WHERE list_tags && ARRAY['ngsl_gr_1.0','ngsl_1.2']::TEXT[])::NUMERIC / v_vocab_count
  INTO v_idiom_d, v_phrasal_d, v_polysemy_d, v_high_v_d, v_kice_ratio, v_ngsl_ratio
  FROM book_vocab;

  v_base_lexile := 0.0073 * v_mlf * 100 + 0.0408 * v_msl * 100 + 159;
  v_ko_adj := (COALESCE(v_idiom_d,0) * 200)
            + (COALESCE(v_phrasal_d,0) * 150)
            + (COALESCE(v_polysemy_d,0) * 100)
            + (COALESCE(v_high_v_d,0) * 250)
            - (COALESCE(v_kice_ratio,0) * 100)
            - (COALESCE(v_ngsl_ratio,0) * 80);
  v_score := GREATEST(200, LEAST(1500, ROUND(v_base_lexile + v_ko_adj)::int));

  v_vl := CASE
    WHEN v_score < 350 THEN 2 WHEN v_score < 500 THEN 3 WHEN v_score < 650 THEN 4
    WHEN v_score < 800 THEN 5 WHEN v_score < 950 THEN 6 WHEN v_score < 1100 THEN 7
    WHEN v_score < 1250 THEN 8 WHEN v_score < 1400 THEN 9 WHEN v_score < 1500 THEN 10
    ELSE 11 END;

  RETURN jsonb_build_object(
    'book_vrl_score', v_score,
    'book_v_level', v_vl,
    'components', jsonb_build_object(
      'mlf', round(v_mlf::numeric, 3),
      'msl_placeholder', v_msl,
      'idiom_density', round(COALESCE(v_idiom_d,0)::numeric, 4),
      'phrasal_density', round(COALESCE(v_phrasal_d,0)::numeric, 4),
      'polysemy_density', round(COALESCE(v_polysemy_d,0)::numeric, 4),
      'high_v_density', round(COALESCE(v_high_v_d,0)::numeric, 4),
      'kice_ratio', round(COALESCE(v_kice_ratio,0)::numeric, 4),
      'ngsl_ratio', round(COALESCE(v_ngsl_ratio,0)::numeric, 4),
      'vocab_count', v_vocab_count,
      'base_lexile', round(v_base_lexile::numeric, 2),
      'ko_adj', round(v_ko_adj::numeric, 2)),
    'calculated_at', now());
END;
$function$;

comment on function public.analyze_book_vrl(uuid) is
  '도서 VRL 점수·레벨 산출. 2026-09-06 library_book_id 컬럼명 정정(그 전에는 호출 시 42703 으로 반드시 실패).';
