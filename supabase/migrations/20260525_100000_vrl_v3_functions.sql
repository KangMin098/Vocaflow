-- ════════════════════════════════════════════════════════════════════
-- Vocaflow Reading Level (VRL) v3 — Day 2: Classification Functions
-- ════════════════════════════════════════════════════════════════════
-- 작성: 2026-05-23
-- 범위: 5 함수 (calc_v_level / calc_track_level / calc_domain_level /
--              calc_skill_level / analyze_book_vrl)
-- 의존: Day 1 인프라 (vocaflow_*, shared_dictionary 컬럼, lexicon_frequencies)
-- 비범위: UPDATE 적재 — Day 3
-- 안전: CREATE OR REPLACE — 함수 재정의만 (테이블·데이터 변경 0).
--       STABLE 볼라틸리티 — 읽기 전용 함수, 같은 입력에 같은 출력.
--       Day 3 분류 시 사용. Day 2 자체는 행 변경 없음.
-- 결정 반영:
--   - C2 + band NULL + 시그널 0개 → L10 (L11 진짜 희귀어만)
--   - NAWL/TSL C1 → L8 (L8 결손 보정)
--   - Track ID 영역 중립 (Day 1 시드 정합)
--   - 우선순위 4.5: low-CEFR + NGSL 보호막 (over-tagging 정정, ~1,254 row)
-- ════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════
-- 1. calc_v_level(word) → SMALLINT  (V-Level 0-11)
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION calc_v_level(p_word TEXT)
RETURNS SMALLINT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_sd RECORD;
  v_kice_tier INT;
  v_in_library BOOLEAN;
BEGIN
  IF p_word IS NULL THEN RETURN NULL; END IF;

  SELECT cefr_level, list_tags, lemma_band, word
  INTO v_sd
  FROM shared_dictionary
  WHERE word = p_word;

  IF NOT FOUND THEN RETURN NULL; END IF;

  -- KICE 빈도 tier 사전 조회 (최저값 = 최상위 빈출)
  SELECT MIN(lf.frequency_tier) INTO v_kice_tier
  FROM lexicon_frequencies lf
  JOIN frequency_data_sources fds ON fds.id = lf.source_id
  WHERE lf.lemma = p_word AND fds.source_key = 'kice_csat';

  -- 라이브러리 등장 여부 (C2+NULL 분류용)
  v_in_library := EXISTS(SELECT 1 FROM library_book_vocabularies lbv WHERE lbv.lemma = p_word);

  -- ────────────────────────────────────────────────
  -- 우선순위 1: 유아·초등 (Level 0-2) — A1 NGSL + word length
  -- ────────────────────────────────────────────────
  IF v_sd.cefr_level = 'A1' AND 'ngsl_gr_1.0' = ANY(v_sd.list_tags) THEN
    IF LENGTH(v_sd.word) <= 4 THEN RETURN 0; END IF;
    IF LENGTH(v_sd.word) <= 6 THEN RETURN 1; END IF;
    RETURN 2;
  END IF;

  -- ────────────────────────────────────────────────
  -- 우선순위 2: KICE tier 2 (최상위 빈출) — 수능 핵심
  -- ※ KICE tier 1 부재 — tier 2 가 실제 최상위
  -- ────────────────────────────────────────────────
  IF v_kice_tier = 2 THEN
    RETURN CASE v_sd.cefr_level
      WHEN 'A1' THEN 2 WHEN 'A2' THEN 3 WHEN 'B1' THEN 5
      WHEN 'B2' THEN 6 WHEN 'C1' THEN 7 WHEN 'C2' THEN 7
      ELSE 6
    END;
  END IF;

  -- 우선순위 3: KICE tier 3-4 (보통·드물게)
  IF v_kice_tier IS NOT NULL THEN
    RETURN CASE v_sd.cefr_level
      WHEN 'A1' THEN 4 WHEN 'A2' THEN 4 WHEN 'B1' THEN 6
      WHEN 'B2' THEN 7 WHEN 'C1' THEN 8 WHEN 'C2' THEN 8
      ELSE 8
    END;
  END IF;

  -- ────────────────────────────────────────────────
  -- 우선순위 4: csat-prep 단어집 tags
  -- ────────────────────────────────────────────────
  IF 'csat-prep-core-2k' = ANY(v_sd.list_tags) THEN
    RETURN CASE v_sd.cefr_level
      WHEN 'A1' THEN 3 WHEN 'A2' THEN 4 WHEN 'B1' THEN 5
      WHEN 'B2' THEN 6 WHEN 'C1' THEN 7 WHEN 'C2' THEN 7
      ELSE 6
    END;
  END IF;

  IF 'csat-prep-ext-1.8k' = ANY(v_sd.list_tags) THEN
    RETURN CASE v_sd.cefr_level
      WHEN 'A2' THEN 5 WHEN 'B1' THEN 6 WHEN 'B2' THEN 7
      WHEN 'C1' THEN 8 WHEN 'C2' THEN 8
      ELSE 7
    END;
  END IF;

  -- ────────────────────────────────────────────────
  -- 우선순위 4.5 (★over-tagging 보호막 — 2026-05-23 패치):
  -- low-CEFR (A1/A2/B1) + NGSL 보유 → NGSL 우선 분류.
  -- 일반어가 NAWL/TSL/BSL 등 도메인 list 에 over-tag 되어도
  -- 본질이 일반어이므로 NGSL 분기로 강제 라우팅 (apple/government 류 정상화).
  -- 적용 전 apple(B1) → 9 (NAWL/TSL 경로), 적용 후 → 4. ~1,254 row 영향.
  -- ────────────────────────────────────────────────
  IF v_sd.list_tags && ARRAY['ngsl_gr_1.0','ngsl_1.2']::TEXT[]
     AND v_sd.cefr_level IN ('A1','A2','B1') THEN
    RETURN CASE v_sd.cefr_level
      WHEN 'A1' THEN 2
      WHEN 'A2' THEN 3
      WHEN 'B1' THEN 4
    END;
  END IF;

  -- ────────────────────────────────────────────────
  -- 우선순위 5: NAWL/TSL 학술 — C1 도 L8 (보정)
  -- ────────────────────────────────────────────────
  IF v_sd.list_tags && ARRAY['nawl_1.2','tsl_1.2']::TEXT[] THEN
    RETURN CASE v_sd.cefr_level
      WHEN 'B2' THEN 8 WHEN 'C1' THEN 8 WHEN 'C2' THEN 10
      ELSE 9
    END;
  END IF;

  -- BSL 비즈니스
  IF 'bsl_1.20' = ANY(v_sd.list_tags) THEN
    RETURN CASE v_sd.cefr_level
      WHEN 'B1' THEN 7 WHEN 'B2' THEN 8 WHEN 'C1' THEN 9
      ELSE 8
    END;
  END IF;

  -- 일반 NGSL
  IF v_sd.list_tags && ARRAY['ngsl_gr_1.0','ngsl_1.2']::TEXT[] THEN
    RETURN CASE v_sd.cefr_level
      WHEN 'A2' THEN 3 WHEN 'B1' THEN 4 WHEN 'B2' THEN 6
      WHEN 'C1' THEN 8 WHEN 'C2' THEN 9
      ELSE 5
    END;
  END IF;

  -- ────────────────────────────────────────────────
  -- 우선순위 6: C1/C2 + lemma_band
  -- ────────────────────────────────────────────────
  IF v_sd.cefr_level = 'C1' AND v_sd.lemma_band IS NOT NULL THEN
    IF v_sd.lemma_band IN ('3k','4k','5k','6k','7k','8k','9k') THEN RETURN 8; END IF;
    IF v_sd.lemma_band IN ('10k','11k','12k','13k','14k') THEN RETURN 9; END IF;
    RETURN 10;
  END IF;

  IF v_sd.cefr_level = 'C2' AND v_sd.lemma_band IS NOT NULL THEN
    IF v_sd.lemma_band IN ('3k','4k','5k','6k','7k','8k','9k') THEN RETURN 9; END IF;
    IF v_sd.lemma_band IN ('10k','11k','12k','13k','14k') THEN RETURN 10; END IF;
    IF v_sd.lemma_band IN ('15k','16k','17k','18k','19k') THEN RETURN 10; END IF;
    RETURN 11;  -- 20k+
  END IF;

  -- ────────────────────────────────────────────────
  -- 우선순위 7: C2 + band NULL — 시그널 기반 세분화
  -- (위 우선순위 모두 통과 못한 경우만 도달 — KICE / csat-prep / NAWL/TSL / BSL / NGSL 다 없음)
  -- ────────────────────────────────────────────────
  IF v_sd.cefr_level = 'C2' AND v_sd.lemma_band IS NULL THEN
    IF v_in_library THEN RETURN 10; END IF;
    -- 시그널 0개 — 진짜 희귀하지 않은 중급 C2 (L10 으로 흡수)
    IF v_sd.list_tags IS NULL OR array_length(v_sd.list_tags, 1) IS NULL THEN
      RETURN 10;
    END IF;
    -- 알 수 없는 list_tag 보유 — 일단 L11 (실제 분포 후 보정)
    RETURN 11;
  END IF;

  -- ────────────────────────────────────────────────
  -- Fallback — CEFR 기반
  -- ────────────────────────────────────────────────
  RETURN CASE v_sd.cefr_level
    WHEN 'A1' THEN 2
    WHEN 'A2' THEN 3
    WHEN 'B1' THEN 5
    WHEN 'B2' THEN 7
    WHEN 'C1' THEN 9
    WHEN 'C2' THEN 10
    ELSE NULL
  END;
END;
$$;

COMMENT ON FUNCTION calc_v_level(TEXT) IS
'VRL v3 종합 레벨 0-11 산출. KICE/csat-prep/NAWL/TSL/BSL/NGSL/lemma_band/library 다중 시그널 합성. C2+NULL+무태그 → L10 (L11 진짜 희귀어만).';


-- ════════════════════════════════════════════════════════════════════
-- 2. calc_track_level(word, track_id) → SMALLINT  (1-10)
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION calc_track_level(p_word TEXT, p_track TEXT)
RETURNS SMALLINT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_sd RECORD;
  v_kice_tier INT;
BEGIN
  IF p_word IS NULL OR p_track IS NULL THEN RETURN NULL; END IF;

  SELECT cefr_level, list_tags, lemma_band, primary_pos
  INTO v_sd FROM shared_dictionary WHERE word = p_word;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT MIN(lf.frequency_tier) INTO v_kice_tier
  FROM lexicon_frequencies lf
  JOIN frequency_data_sources fds ON fds.id = lf.source_id
  WHERE lf.lemma = p_word AND fds.source_key = 'kice_csat';

  RETURN CASE p_track

    -- ──────────── 수능 영어 ────────────
    WHEN 'csat_korean' THEN CASE
      WHEN v_kice_tier = 2 AND v_sd.cefr_level IN ('A1','A2') THEN 2
      WHEN v_kice_tier = 2 AND v_sd.cefr_level = 'B1' THEN 4
      WHEN v_kice_tier = 2 AND v_sd.cefr_level = 'B2' THEN 6
      WHEN v_kice_tier = 2 AND v_sd.cefr_level = 'C1' THEN 8
      WHEN v_kice_tier = 2 AND v_sd.cefr_level = 'C2' THEN 9
      WHEN v_kice_tier IN (3,4) AND v_sd.cefr_level = 'B1' THEN 5
      WHEN v_kice_tier IN (3,4) AND v_sd.cefr_level = 'B2' THEN 7
      WHEN v_kice_tier IN (3,4) AND v_sd.cefr_level = 'C1' THEN 9
      WHEN v_kice_tier IN (3,4) THEN 9
      WHEN 'csat-prep-core-2k' = ANY(v_sd.list_tags) THEN 7
      WHEN 'csat-prep-ext-1.8k' = ANY(v_sd.list_tags) THEN 8
      ELSE 10
    END

    -- ──────────── 비즈니스 영어 ────────────
    WHEN 'business_english' THEN CASE
      WHEN 'bsl_1.20' = ANY(v_sd.list_tags) AND v_sd.cefr_level = 'A2' THEN 3
      WHEN 'bsl_1.20' = ANY(v_sd.list_tags) AND v_sd.cefr_level = 'B1' THEN 5
      WHEN 'bsl_1.20' = ANY(v_sd.list_tags) AND v_sd.cefr_level = 'B2' THEN 7
      WHEN 'bsl_1.20' = ANY(v_sd.list_tags) AND v_sd.cefr_level = 'C1' THEN 9
      WHEN 'ndl_1.1' = ANY(v_sd.list_tags) AND v_sd.cefr_level = 'B2' THEN 7
      WHEN 'ndl_1.1' = ANY(v_sd.list_tags) AND v_sd.cefr_level = 'C1' THEN 8
      WHEN v_sd.cefr_level = 'A1' THEN 1
      WHEN v_sd.cefr_level = 'A2' THEN 3
      WHEN v_sd.cefr_level = 'B1' THEN 5
      WHEN v_sd.cefr_level = 'B2' THEN 7
      WHEN v_sd.cefr_level = 'C1' THEN 9
      WHEN v_sd.cefr_level = 'C2' THEN 10
      ELSE 10
    END

    -- ──────────── 학술 영어 ────────────
    WHEN 'academic_english' THEN CASE
      WHEN 'nawl_1.2' = ANY(v_sd.list_tags) AND v_sd.cefr_level = 'B2' THEN 4
      WHEN 'nawl_1.2' = ANY(v_sd.list_tags) AND v_sd.cefr_level = 'C1' THEN 6
      WHEN 'tsl_1.2' = ANY(v_sd.list_tags) AND v_sd.cefr_level IN ('C1','C2') THEN 7
      WHEN v_sd.cefr_level = 'B2' THEN 5
      WHEN v_sd.cefr_level = 'C1' THEN 7
      WHEN v_sd.cefr_level = 'C2' THEN 9
      ELSE 8
    END

    -- ──────────── 종합 영어 ────────────
    WHEN 'general_proficiency' THEN CASE
      WHEN 'csat-prep-ext-1.8k' = ANY(v_sd.list_tags) AND v_sd.cefr_level = 'C1' THEN 7
      WHEN 'csat-prep-core-2k' = ANY(v_sd.list_tags) AND v_sd.cefr_level = 'B2' THEN 6
      WHEN v_sd.cefr_level IN ('A1','A2') THEN 2
      WHEN v_sd.cefr_level = 'B1' THEN 5
      WHEN v_sd.cefr_level = 'B2' THEN 6
      WHEN v_sd.cefr_level = 'C1' THEN 8
      WHEN v_sd.cefr_level = 'C2' THEN 9
      ELSE 9
    END

    -- ──────────── 회화 영어 ────────────
    WHEN 'conversational' THEN CASE
      WHEN 'ngsl_spoken_1.2' = ANY(v_sd.list_tags) AND v_sd.cefr_level IN ('A1','A2') THEN 2
      WHEN 'ngsl_spoken_1.2' = ANY(v_sd.list_tags) AND v_sd.cefr_level = 'B1' THEN 4
      WHEN 'moel_1.0' = ANY(v_sd.list_tags) THEN 6
      WHEN 'fel_1.2' = ANY(v_sd.list_tags) THEN 6
      WHEN v_sd.primary_pos = 'idiom' AND v_sd.cefr_level IN ('B1','B2') THEN 6
      WHEN v_sd.primary_pos = 'phrasal_verb' AND v_sd.cefr_level IN ('A2','B1') THEN 4
      WHEN v_sd.cefr_level IN ('A1','A2') THEN 2
      WHEN v_sd.cefr_level = 'B1' THEN 5
      WHEN v_sd.cefr_level = 'B2' THEN 7
      WHEN v_sd.cefr_level = 'C1' THEN 9
      ELSE 10
    END

    -- ──────────── 문학 영어 ────────────
    WHEN 'literary' THEN CASE
      WHEN EXISTS(SELECT 1 FROM library_book_vocabularies lbv WHERE lbv.lemma = p_word) THEN
        CASE v_sd.cefr_level
          WHEN 'A1' THEN 1 WHEN 'A2' THEN 2 WHEN 'B1' THEN 3
          WHEN 'B2' THEN 4 WHEN 'C1' THEN 6 WHEN 'C2' THEN 8
          ELSE 5
        END
      ELSE NULL  -- 라이브러리 미등장 단어는 문학 트랙 미해당
    END

    ELSE NULL  -- 알 수 없는 트랙
  END;
END;
$$;

COMMENT ON FUNCTION calc_track_level(TEXT, TEXT) IS
'트랙별 1-10 레벨. p_track ∈ {csat_korean, business_english, academic_english, general_proficiency, conversational, literary}.';


-- ════════════════════════════════════════════════════════════════════
-- 3. calc_domain_level(word, domain_id) → SMALLINT  (1-5)
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION calc_domain_level(p_word TEXT, p_domain TEXT)
RETURNS SMALLINT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_sd RECORD;
BEGIN
  IF p_word IS NULL OR p_domain IS NULL THEN RETURN NULL; END IF;

  SELECT cefr_level, list_tags
  INTO v_sd FROM shared_dictionary WHERE word = p_word;
  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN CASE p_domain

    WHEN 'general' THEN CASE
      WHEN v_sd.list_tags && ARRAY['ngsl_gr_1.0','ngsl_1.2']::TEXT[] AND v_sd.cefr_level = 'A1' THEN 1
      WHEN v_sd.list_tags && ARRAY['ngsl_1.2']::TEXT[] AND v_sd.cefr_level = 'A2' THEN 2
      WHEN v_sd.list_tags && ARRAY['ngsl_1.2']::TEXT[] AND v_sd.cefr_level = 'B1' THEN 3
      WHEN v_sd.list_tags && ARRAY['ngsl_1.2']::TEXT[] AND v_sd.cefr_level = 'B2' THEN 4
      WHEN v_sd.list_tags && ARRAY['ngsl_1.2']::TEXT[] AND v_sd.cefr_level IN ('C1','C2') THEN 5
      ELSE NULL
    END

    WHEN 'business' THEN CASE
      WHEN 'bsl_1.20' = ANY(v_sd.list_tags) AND v_sd.cefr_level IN ('A2','B1') THEN 2
      WHEN 'bsl_1.20' = ANY(v_sd.list_tags) AND v_sd.cefr_level = 'B2' THEN 3
      WHEN 'bsl_1.20' = ANY(v_sd.list_tags) AND v_sd.cefr_level = 'C1' THEN 4
      WHEN 'bsl_1.20' = ANY(v_sd.list_tags) AND v_sd.cefr_level = 'C2' THEN 5
      ELSE NULL
    END

    WHEN 'academic' THEN CASE
      WHEN 'nawl_1.2' = ANY(v_sd.list_tags) AND v_sd.cefr_level = 'B2' THEN 2
      WHEN 'nawl_1.2' = ANY(v_sd.list_tags) AND v_sd.cefr_level = 'C1' THEN 3
      WHEN 'tsl_1.2' = ANY(v_sd.list_tags) AND v_sd.cefr_level = 'C1' THEN 4
      WHEN v_sd.list_tags && ARRAY['nawl_1.2','tsl_1.2']::TEXT[] AND v_sd.cefr_level = 'C2' THEN 5
      ELSE NULL
    END

    WHEN 'literature' THEN CASE
      WHEN EXISTS(SELECT 1 FROM library_book_vocabularies lbv WHERE lbv.lemma = p_word) THEN
        CASE v_sd.cefr_level
          WHEN 'A1' THEN 1 WHEN 'A2' THEN 2 WHEN 'B1' THEN 3
          WHEN 'B2' THEN 3 WHEN 'C1' THEN 4 WHEN 'C2' THEN 5
        END
      ELSE NULL
    END

    WHEN 'news_media' THEN CASE
      WHEN 'ndl_1.1' = ANY(v_sd.list_tags) AND v_sd.cefr_level IN ('B1','B2') THEN 3
      WHEN 'ndl_1.1' = ANY(v_sd.list_tags) AND v_sd.cefr_level = 'C1' THEN 4
      WHEN 'ndl_1.1' = ANY(v_sd.list_tags) AND v_sd.cefr_level = 'C2' THEN 5
      ELSE NULL
    END

    WHEN 'entertainment' THEN CASE
      WHEN v_sd.list_tags && ARRAY['fel_1.2','moel_1.0']::TEXT[] AND v_sd.cefr_level = 'A2' THEN 2
      WHEN v_sd.list_tags && ARRAY['fel_1.2','moel_1.0']::TEXT[] AND v_sd.cefr_level = 'B1' THEN 3
      WHEN v_sd.list_tags && ARRAY['fel_1.2','moel_1.0']::TEXT[] AND v_sd.cefr_level = 'B2' THEN 4
      WHEN v_sd.list_tags && ARRAY['fel_1.2','moel_1.0']::TEXT[] AND v_sd.cefr_level = 'C1' THEN 5
      ELSE NULL
    END

    ELSE NULL  -- science_tech, travel_culture, 그 외: 데이터 없음
  END;
END;
$$;

COMMENT ON FUNCTION calc_domain_level(TEXT, TEXT) IS
'도메인별 1-5 마스터리 레벨. NULL = 해당 도메인 단어 아님 (예: business 도메인에 NGSL 일반어).';


-- ════════════════════════════════════════════════════════════════════
-- 4. calc_skill_level(word) → SMALLINT  (1-5)
-- ════════════════════════════════════════════════════════════════════
-- skill_type 은 별도로 결정 (primary_pos / meanings_ko / 공백 유무).
-- skill_level 은 v_level 기반 매핑 (입문/초급/중급/상급/전문).
CREATE OR REPLACE FUNCTION calc_skill_level(p_word TEXT)
RETURNS SMALLINT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_vl SMALLINT;
BEGIN
  IF p_word IS NULL THEN RETURN NULL; END IF;
  SELECT v_level INTO v_vl FROM shared_dictionary WHERE word = p_word;
  IF v_vl IS NULL THEN
    -- v_level 미산출이면 즉시 calc 호출 (Day 3 분류 직후엔 채워져 있음)
    v_vl := calc_v_level(p_word);
  END IF;
  IF v_vl IS NULL THEN RETURN NULL; END IF;

  RETURN CASE
    WHEN v_vl <= 3 THEN 1  -- 입문
    WHEN v_vl <= 5 THEN 2  -- 초급
    WHEN v_vl <= 7 THEN 3  -- 중급
    WHEN v_vl <= 9 THEN 4  -- 상급
    ELSE             5     -- 전문
  END;
END;
$$;

COMMENT ON FUNCTION calc_skill_level(TEXT) IS
'스킬 마스터리 1-5. v_level 기반 매핑. v_level 미산출 시 calc_v_level 즉시 호출.';


-- ════════════════════════════════════════════════════════════════════
-- 5. analyze_book_vrl(book_id) → JSONB
-- ════════════════════════════════════════════════════════════════════
-- 책 VRL 점수 200-1500 + V-Level 매핑.
-- Lexile 호환 공식 + 한국 학습자 보정 (이디엄/구동사/다의어/V-Level 8+ 밀도).
--
-- 의존:
--   - library_book_vocabularies (book_id, lemma)  -- 책의 어휘 목록
--   - shared_dictionary (v_level, lemma_band, primary_pos, list_tags)
--
-- 미지원 보정 (TODO Day 4):
--   - Mean Sentence Length (MSL) — 책 본문 문장 분리 필요. 현재 placeholder.
--   - 책 본문 길이 메타 — library_books 컬럼 확인 후 적용.
--
-- 반환 구조:
--   {
--     "book_vrl_score": INT (200-1500),
--     "book_v_level": SMALLINT (0-11),
--     "components": {
--       "mlf": NUMERIC,
--       "idiom_density": NUMERIC,
--       "phrasal_density": NUMERIC,
--       "polysemy_density": NUMERIC,
--       "high_v_density": NUMERIC,
--       "kice_ratio": NUMERIC,
--       "ngsl_ratio": NUMERIC,
--       "vocab_count": INT
--     }
--   }
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION analyze_book_vrl(p_book_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_vocab_count INT;
  v_mlf NUMERIC;          -- Mean Log Frequency (lemma_band 정수화 → log)
  v_msl NUMERIC := 12.0;  -- placeholder Mean Sentence Length (Day 4 보강)
  v_idiom_d NUMERIC;
  v_phrasal_d NUMERIC;
  v_polysemy_d NUMERIC;
  v_high_v_d NUMERIC;
  v_kice_ratio NUMERIC;
  v_ngsl_ratio NUMERIC;
  v_base_lexile NUMERIC;
  v_ko_adj NUMERIC;
  v_score INT;
  v_vl SMALLINT;
BEGIN
  IF p_book_id IS NULL THEN RETURN NULL; END IF;

  -- 책 어휘 수
  SELECT COUNT(*) INTO v_vocab_count
  FROM library_book_vocabularies WHERE book_id = p_book_id;

  IF v_vocab_count = 0 THEN
    RETURN jsonb_build_object(
      'book_vrl_score', NULL,
      'book_v_level', NULL,
      'error', 'no vocabulary attached to book',
      'components', '{}'::jsonb
    );
  END IF;

  -- Mean Log Frequency — lemma_band 의 숫자부 (예: '10k' → 10) 평균에 log10
  -- band NULL 은 평균 계산에서 제외
  WITH band_nums AS (
    SELECT
      CASE
        WHEN sd.lemma_band ~ '^\d+k$' THEN (regexp_replace(sd.lemma_band, 'k$', ''))::int
        ELSE NULL
      END AS band_n
    FROM library_book_vocabularies lbv
    JOIN shared_dictionary sd ON sd.word = lbv.lemma
    WHERE lbv.book_id = p_book_id
  )
  SELECT ln(GREATEST(AVG(band_n), 1.0)) INTO v_mlf
  FROM band_nums WHERE band_n IS NOT NULL;

  v_mlf := COALESCE(v_mlf, 2.3);  -- fallback ≈ ln(10)

  -- 밀도 계산 (이디엄/구동사/다의어/V-Level 8+/KICE/NGSL)
  WITH book_vocab AS (
    SELECT sd.primary_pos, sd.v_level, sd.list_tags, sd.meanings_ko, sd.word
    FROM library_book_vocabularies lbv
    JOIN shared_dictionary sd ON sd.word = lbv.lemma
    WHERE lbv.book_id = p_book_id
  )
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

  -- Lexile-호환 base score
  v_base_lexile := 0.0073 * v_mlf * 100 + 0.0408 * v_msl * 100 + 159;

  -- 한국 학습자 보정
  v_ko_adj :=
      (COALESCE(v_idiom_d, 0)    * 200)
    + (COALESCE(v_phrasal_d, 0)  * 150)
    + (COALESCE(v_polysemy_d, 0) * 100)
    + (COALESCE(v_high_v_d, 0)   * 250)
    - (COALESCE(v_kice_ratio, 0) * 100)
    - (COALESCE(v_ngsl_ratio, 0) * 80);

  v_score := GREATEST(200, LEAST(1500, ROUND(v_base_lexile + v_ko_adj)::int));

  -- VRL → V-Level 매핑
  v_vl := CASE
    WHEN v_score < 350 THEN 2
    WHEN v_score < 500 THEN 3
    WHEN v_score < 650 THEN 4
    WHEN v_score < 800 THEN 5
    WHEN v_score < 950 THEN 6
    WHEN v_score < 1100 THEN 7
    WHEN v_score < 1250 THEN 8
    WHEN v_score < 1400 THEN 9
    WHEN v_score < 1500 THEN 10
    ELSE 11
  END;

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
      'ko_adj', round(v_ko_adj::numeric, 2)
    ),
    'calculated_at', now()
  );
END;
$$;

COMMENT ON FUNCTION analyze_book_vrl(UUID) IS
'책 VRL 200-1500 + V-Level 0-11. Lexile-호환 base + 한국 학습자 보정 (이디엄/구동사/다의어/V8+ 가산, KICE/NGSL 감산). MSL placeholder 12.0 — Day 4 본문 분석으로 보강.';


-- ════════════════════════════════════════════════════════════════════
-- 6. 검증 — 5 함수 모두 등록되었는지 + 샘플 호출
-- ════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_test_word TEXT := 'apple';
  v_vl SMALLINT;
  v_track SMALLINT;
  v_domain SMALLINT;
  v_skill SMALLINT;
BEGIN
  -- 5 함수 존재 확인
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='calc_v_level') THEN
    RAISE EXCEPTION 'calc_v_level 함수 누락';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='calc_track_level') THEN
    RAISE EXCEPTION 'calc_track_level 함수 누락';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='calc_domain_level') THEN
    RAISE EXCEPTION 'calc_domain_level 함수 누락';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='calc_skill_level') THEN
    RAISE EXCEPTION 'calc_skill_level 함수 누락';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='analyze_book_vrl') THEN
    RAISE EXCEPTION 'analyze_book_vrl 함수 누락';
  END IF;

  -- 샘플 호출 — apple (A1 NGSL, 5자 → L1)
  v_vl := calc_v_level(v_test_word);
  v_track := calc_track_level(v_test_word, 'csat_korean');
  v_domain := calc_domain_level(v_test_word, 'general');
  v_skill := calc_skill_level(v_test_word);
  RAISE NOTICE '✓ apple → v_level=%, csat_track=%, general_domain=%, skill_level=%',
    v_vl, v_track, v_domain, v_skill;

  RAISE NOTICE '✓ Day 2 함수 5종 등록 완료';
END $$;

-- ════════════════════════════════════════════════════════════════════
-- 다음 단계 (Day 3):
--   - shared_dictionary 38,630 row 일괄 분류 UPDATE
--   - track_levels jsonb, domain_levels jsonb 6+8 키 채움
--   - skill_type 결정 (primary_pos / meanings_ko / multi-word)
--   - 분포 검증 vs vocaflow_levels 시드 word_count
--   - 분포 격차 시 시드 수치 재집계 (선택)
-- ════════════════════════════════════════════════════════════════════
