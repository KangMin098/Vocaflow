-- ════════════════════════════════════════════════════════════════════
-- Vocaflow Reading Level (VRL) v3 — Day 1: Infrastructure
-- ════════════════════════════════════════════════════════════════════
-- 작성: 2026-05-23
-- 범위: 메타 테이블 4종 + 시드 + shared_dictionary/library_books/texts/user_profiles 컬럼 확장 + 인덱스 + 진단 시스템
-- 비범위: calc_v_level / calc_track_level 등 함수 — Day 2
--         shared_dictionary 38,630 행 분류 UPDATE — Day 3
-- 안전: 단일 트랜잭션, BEGIN/COMMIT 명시. 실패 시 자동 ROLLBACK.
-- 결정 반영:
--   1. KICE tier wording: "tier 2 = 최상위" (tier 1 부재 명시)
--   2. Level 11 overshoot: 메타 시드 word_count 는 실측 기반 (Day 3 후 자동 재집계 트리거 별도)
--   3. Track ID 중립화: csat_korean / business_english / academic_english /
--      general_proficiency / conversational / literary
--   4. C2 재라벨링: 보류 (Day 6 검증 후 별도 phase 계획)
-- ════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- 1. 메타 테이블 4종
-- ─────────────────────────────────────────────────────────────────

-- 1.1 vocaflow_levels (V-Level 12단계 메타)
CREATE TABLE IF NOT EXISTS vocaflow_levels (
  level             SMALLINT PRIMARY KEY CHECK (level BETWEEN 0 AND 11),
  korean_name       TEXT NOT NULL,
  korean_school     TEXT,
  english_name      TEXT,
  cefr_min          TEXT CHECK (cefr_min IN ('A1','A2','B1','B2','C1','C2')),
  cefr_max          TEXT CHECK (cefr_max IN ('A1','A2','B1','B2','C1','C2')),
  test_score_hints  TEXT,
  external_hints    JSONB DEFAULT '{}'::jsonb,
  cumulative_word_count INT,
  new_words_in_level    INT,
  estimated_study_hours INT,
  age_range         TEXT,
  description_ko    TEXT,
  display_order     SMALLINT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE  vocaflow_levels IS 'V-Level 0-11 메타 (5-7세 ~ 원어민 전문). word_count 는 Day 3 분류 후 재집계 예정.';
COMMENT ON COLUMN vocaflow_levels.external_hints IS 'UI 표시용 시험 매핑 — {"toeic":"800-850","opic":"IH","toefl":"60-80"} 등. trademark 격리.';

-- 1.2 vocaflow_tracks (6 트랙 메타 — 영역 중립 ID)
CREATE TABLE IF NOT EXISTS vocaflow_tracks (
  id                    TEXT PRIMARY KEY,
  name_ko               TEXT NOT NULL,
  name_en               TEXT,
  description_ko        TEXT,
  display_hint          TEXT,
  external_test_hints   TEXT[] DEFAULT '{}',
  data_source_keys      TEXT[] DEFAULT '{}',
  level_score_mapping   JSONB DEFAULT '{}'::jsonb,
  total_words           INT,
  display_order         SMALLINT NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE  vocaflow_tracks IS '6 트랙 — 영역 중립 ID (csat_korean / business_english 등). external_test_hints 는 UI 마케팅용으로만.';
COMMENT ON COLUMN vocaflow_tracks.external_test_hints IS 'UI 표시용 (TOEIC/TOEFL/IELTS). 코드/조회에서 사용 금지.';
COMMENT ON COLUMN vocaflow_tracks.data_source_keys IS 'lexicon_frequencies.frequency_data_sources.source_key 또는 list_tags 이름 (예: bsl_1.20).';
COMMENT ON COLUMN vocaflow_tracks.level_score_mapping IS '{"1":"200-300","2":"300-400",...,"10":"900+"} 식 외부 점수 매핑.';

-- 1.3 vocaflow_domains (8 도메인 메타)
CREATE TABLE IF NOT EXISTS vocaflow_domains (
  id                TEXT PRIMARY KEY,
  name_ko           TEXT NOT NULL,
  description_ko    TEXT,
  data_source_keys  TEXT[] DEFAULT '{}',
  total_words       INT,
  display_order     SMALLINT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- 1.4 vocaflow_skills (5 스킬 메타)
CREATE TABLE IF NOT EXISTS vocaflow_skills (
  id                TEXT PRIMARY KEY,
  name_ko           TEXT NOT NULL,
  description_ko    TEXT,
  total_words       INT,
  display_order     SMALLINT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────
-- 2. 메타 시드 데이터 (실측 기반)
-- ─────────────────────────────────────────────────────────────────

-- 2.1 vocaflow_levels 12 rows (V-Level 0-11)
INSERT INTO vocaflow_levels (level, korean_name, korean_school, english_name, cefr_min, cefr_max,
  test_score_hints, external_hints, cumulative_word_count, new_words_in_level,
  estimated_study_hours, age_range, description_ko, display_order) VALUES
(0,  '영어 첫걸음',            '5-7세 (유치원)',         'Pre-Beginner',  'A1', 'A1',
     '유치원·기초', '{"description":"5-7세 유아 영어"}'::jsonb,
     116,    116,    20,  '5-7세',
     'do, go, eat 같은 짧은 핵심 단어. 영어와 친해지기 단계.', 0),
(1,  '초1-2 영어',             '초등 저학년',            'Elementary 1', 'A1', 'A1',
     '초등 1-2학년 / NEAT 3급', '{}'::jsonb,
     231,    115,    25,  '7-9세',
     '학교 영어 도입. happy, study 등 익숙한 단어.', 1),
(2,  '초3-6 영어',             '초등 고학년',            'Elementary 2', 'A1', 'A2',
     '초등 3-6학년 / NEAT 2급', '{}'::jsonb,
     540,    309,    40,  '9-13세',
     '학교 영어 교과 어휘. 짧은 글 읽기 가능.', 2),
(3,  '중1-2 기초',             '중학 1-2학년',           'Lower Intermediate', 'A2', 'B1',
     '중1-2 / NEAT 1급', '{}'::jsonb,
     1426,   886,    60,  '13-15세',
     '중학 교과 어휘. 짧은 글·간단한 대화 이해.', 3),
(4,  '중3 졸업',               '중학 3학년',             'Intermediate Foundation', 'A2', 'B1',
     '중3 / 고1 입학 수준', '{}'::jsonb,
     2286,   860,    80,  '15-16세',
     '중학 졸업 어휘 마스터. 고등 영어 진입 준비.', 4),
(5,  '고1 모의 / 수능 5-6등급',  '고1',                  'Intermediate', 'B1', 'B2',
     '수능 5-6등급 / 고1 모의고사', '{"csat_rank":"5-6"}'::jsonb,
     3292,   1006,   100, '16-17세',
     '고1 영어 모의고사 대응. 수능 입문.', 5),
(6,  '고2 모의 / 수능 3-4등급',  '고2',                  'Upper Intermediate', 'B1', 'B2',
     '수능 3-4등급 / 고2 모의고사', '{"csat_rank":"3-4"}'::jsonb,
     5225,   1933,   140, '17-18세',
     '고2 모의고사 대응. 수능 중상위 진입.', 6),
(7,  '수능 1-2등급 / 고3 만점',  '고3 / 수능 상위',       'Advanced / CSAT Top', 'B2', 'C1',
     '수능 1-2등급 / 만점 안정권', '{"csat_rank":"1-2","csat_perfect":true}'::jsonb,
     8450,   3225,   220, '18-19세',
     '수능 상위권 / 영어 만점 어휘. KICE 핵심 빈출 다수.', 7),
(8,  '대학·취업 수준',          '대학생·취준생',          'College / Career Entry', 'C1', 'C1',
     '실무 영어 / 대학 교양', '{"toeic":"800-850","opic":"IH","ielts":"6.0-6.5"}'::jsonb,
     11503,  3053,   300, '성인',
     '대학 교양·실무 영어. 비즈니스 영어 입문.', 8),
(9,  '대학원·교환학생 수준',     '대학원·교환학생',       'Graduate / Exchange', 'C1', 'C2',
     '학술 영어 입문 / 토익 900+', '{"toeic":"900+","toefl":"80-100","ielts":"6.5-7.0"}'::jsonb,
     19776,  8273,   450, '성인',
     '학술 영어 입문. 영어권 전공 수업 청강 가능.', 9),
(10, '영문과·번역가 수준',       '영문과·번역가',         'English Major / Translator', 'C2', 'C2',
     '학술·문학 영어', '{"toefl":"100+","ielts":"7.5+","cae":"C"}'::jsonb,
     33500,  13700,  700, '성인',
     '영문학·번역 전공 수준. 문학 작품 원서 독해.', 10),
(11, '원어민 학술 / 전문',       '학자·전문 번역·원어민', 'Native Expert', 'C2', 'C2',
     '원어민 학자·전문', '{"description":"진짜 원어민 희귀어"}'::jsonb,
     38630,  5130,   1000,'—',
     '원어민 학술·전문 어휘. 영어 사전 등재 희귀어 중심. 일반 학습자 우선순위 낮음.', 11);


-- 2.2 vocaflow_tracks 6 rows (영역 중립 ID)
INSERT INTO vocaflow_tracks (id, name_ko, name_en, description_ko, display_hint,
  external_test_hints, data_source_keys, level_score_mapping, total_words, display_order) VALUES
('csat_korean',         '수능 영어',         'Korean CSAT English',
 '한국 수능 영어 1-9등급 대응 트랙.',
 '수능 9-1등급 / 모의고사',
 ARRAY['수능 1-9등급','EBS 연계'],
 ARRAY['kice_csat','csat-prep-core-2k','csat-prep-ext-1.8k'],
 '{"1":"9등급","2":"8등급","3":"7등급","4":"6등급","5":"5등급","6":"4등급","7":"3등급","8":"2등급","9":"1등급","10":"만점 안정"}'::jsonb,
 5500, 0),

('business_english',    '비즈니스 영어',     'Business English',
 '실무 영어 / 토익 / OPIc 등 직무 영어 트랙.',
 '실무 영어 점수 대비',
 ARRAY['TOEIC 200-990','OPIc IL-AL','BULATS'],
 ARRAY['bsl_1.20','ndl_1.1'],
 '{"1":"200-300","2":"300-400","3":"400-500","4":"500-600","5":"600-700","6":"700-750","7":"750-800","8":"800-850","9":"850-900","10":"900+"}'::jsonb,
 2000, 1),

('academic_english',    '학술 영어',         'Academic English',
 '논문·학술 영어 / 토플 / IELTS / 영어권 유학 트랙.',
 '학술 영어 점수 대비',
 ARRAY['TOEFL 0-120','IELTS 4.0-9.0','CAE','CPE'],
 ARRAY['nawl_1.2','tsl_1.2'],
 '{"1":"30-40","2":"40-50","3":"50-60","4":"60-70","5":"70-80","6":"80-90","7":"90-100","8":"100-110","9":"110-115","10":"115+"}'::jsonb,
 1500, 2),

('general_proficiency', '종합 영어',         'General Proficiency',
 '일반 어학 시험 / 종합 영어 능력 트랙.',
 '종합 영어 능력 평가',
 ARRAY['TEPS 200-600','G-TELP','FLEX'],
 ARRAY['csat-prep-ext-1.8k'],
 '{"1":"200-250","2":"250-300","3":"300-350","4":"350-400","5":"400-450","6":"450-500","7":"500-550","8":"550-600","9":"600+","10":"전문 학술"}'::jsonb,
 3500, 3),

('conversational',      '회화 영어',         'Conversational English',
 '원어민 회화 / 영화·드라마 / 일상 표현 트랙.',
 '원어민 회화 능력',
 ARRAY['OPIc IL-AL','IELTS Speaking','TOEFL Speaking'],
 ARRAY['ngsl_spoken_1.2','moel_1.0','fel_1.2'],
 '{"1":"NL","2":"NM","3":"NH","4":"IL","5":"IM","6":"IH","7":"AL","8":"AM","9":"AH","10":"Native"}'::jsonb,
 2500, 4),

('literary',            '문학 영어',         'Literary English',
 '영문학·고전·소설 독해 트랙.',
 '소설·고전 독해',
 ARRAY['Lexile 600L-1800L+','AR 4.0-12.0'],
 ARRAY['library_book_vocabularies'],
 '{"1":"청소년 동화","2":"YA 소설","3":"현대 소설","4":"고전 소설","5":"문학 작품","6":"고급 문학","7":"고전 명작","8":"근대 영문학","9":"전문 비평","10":"원전 연구"}'::jsonb,
 NULL, 5);


-- 2.3 vocaflow_domains 8 rows
INSERT INTO vocaflow_domains (id, name_ko, description_ko, data_source_keys, total_words, display_order) VALUES
('general',         '일상',          '일반 일상 어휘.',                    ARRAY['ngsl_gr_1.0','ngsl_1.2'],  12182, 0),
('business',        '비즈니스',      '비즈니스·실무 어휘.',                ARRAY['bsl_1.20'],                1094,  1),
('academic',        '학술',          '논문·학술 어휘.',                    ARRAY['nawl_1.2','tsl_1.2'],      1521,  2),
('literature',      '문학',          '소설·고전 등 문학 어휘.',            ARRAY['library_book_vocabularies'], NULL, 3),
('news_media',      '뉴스·시사',     '신문·뉴스 어휘.',                    ARRAY['ndl_1.1'],                 889,   4),
('entertainment',   '영화·드라마',   '영화·드라마·미디어 어휘.',           ARRAY['fel_1.2','moel_1.0'],      882,   5),
('science_tech',    '과학·기술',     '과학·기술 어휘. 추후 데이터 적재.',  ARRAY[]::TEXT[],                  NULL,  6),
('travel_culture',  '여행·문화',     '여행·문화 어휘. 추후 데이터 적재.',  ARRAY[]::TEXT[],                  NULL,  7);


-- 2.4 vocaflow_skills 5 rows
INSERT INTO vocaflow_skills (id, name_ko, description_ko, total_words, display_order) VALUES
('single_word',   '단일 단어', '일반 단일 단어 (압도적 다수).',         NULL,  0),
('idiom',         '이디엄',    '관용 표현 (kick the bucket 등).',       991,   1),
('phrasal_verb',  '구동사',    '동사 + 부사/전치사 (give up 등).',     460,   2),
('collocation',   '연어',      '자주 함께 쓰이는 단어 조합.',          4098,  3),
('polysemy',      '다의어',    '3개 이상 의미를 가진 단어.',           891,   4);


-- ─────────────────────────────────────────────────────────────────
-- 3. shared_dictionary 컬럼 확장
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE shared_dictionary
  ADD COLUMN IF NOT EXISTS v_level              SMALLINT CHECK (v_level BETWEEN 0 AND 11),
  ADD COLUMN IF NOT EXISTS track_levels         JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS domain_levels        JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS skill_type           TEXT
    CHECK (skill_type IN ('single_word','idiom','phrasal_verb','collocation','polysemy')),
  ADD COLUMN IF NOT EXISTS skill_level          SMALLINT CHECK (skill_level BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS vrl_calculated_at    TIMESTAMPTZ;

COMMENT ON COLUMN shared_dictionary.v_level IS 'VRL v3 종합 레벨 0-11. Day 3 calc_v_level() 일괄 채움.';
COMMENT ON COLUMN shared_dictionary.track_levels IS '6 트랙별 레벨 1-10. {"csat_korean":7,"business_english":5,...}';
COMMENT ON COLUMN shared_dictionary.domain_levels IS '8 도메인별 레벨 1-5. {"general":3,"business":2,...}';

CREATE INDEX IF NOT EXISTS idx_sd_v_level     ON shared_dictionary (v_level);
CREATE INDEX IF NOT EXISTS idx_sd_skill_type  ON shared_dictionary (skill_type);
CREATE INDEX IF NOT EXISTS idx_sd_skill_level ON shared_dictionary (skill_level);
CREATE INDEX IF NOT EXISTS idx_sd_track_levels  ON shared_dictionary USING GIN (track_levels);
CREATE INDEX IF NOT EXISTS idx_sd_domain_levels ON shared_dictionary USING GIN (domain_levels);


-- ─────────────────────────────────────────────────────────────────
-- 4. library_books / texts 확장 (책·텍스트 VRL)
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE library_books
  ADD COLUMN IF NOT EXISTS book_vrl_score    INT CHECK (book_vrl_score BETWEEN 0 AND 2000),
  ADD COLUMN IF NOT EXISTS book_v_level      SMALLINT CHECK (book_v_level BETWEEN 0 AND 11),
  ADD COLUMN IF NOT EXISTS lexile_measure    INT,
  ADD COLUMN IF NOT EXISTS lexile_source     TEXT,
  ADD COLUMN IF NOT EXISTS vrl_components    JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS vrl_calculated_at TIMESTAMPTZ;

COMMENT ON COLUMN library_books.book_vrl_score IS 'VRL 자체 산출 점수 200-1500. Lexile 호환 알고리즘 (한국 학습자 보정 가산).';
COMMENT ON COLUMN library_books.lexile_measure IS '외부 Lexile 참고값. 출처 표기는 lexile_source. 직접 사용 금지 — book_vrl_score 가 진실 소스.';

ALTER TABLE texts
  ADD COLUMN IF NOT EXISTS text_vrl_score    INT CHECK (text_vrl_score BETWEEN 0 AND 2000),
  ADD COLUMN IF NOT EXISTS text_v_level      SMALLINT CHECK (text_v_level BETWEEN 0 AND 11),
  ADD COLUMN IF NOT EXISTS vrl_components    JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS vrl_calculated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_library_books_v_level ON library_books (book_v_level);
CREATE INDEX IF NOT EXISTS idx_texts_v_level         ON texts (text_v_level);


-- ─────────────────────────────────────────────────────────────────
-- 5. user_profiles 확장 (4축 프로파일)
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS current_v_level         SMALLINT DEFAULT 0 CHECK (current_v_level BETWEEN 0 AND 11),
  ADD COLUMN IF NOT EXISTS target_v_level          SMALLINT CHECK (target_v_level BETWEEN 0 AND 11),
  ADD COLUMN IF NOT EXISTS current_track_levels    JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS target_track_levels     JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS current_domain_levels   JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS current_skill_levels    JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS learning_goal           TEXT,
  ADD COLUMN IF NOT EXISTS diagnostic_completed_at TIMESTAMPTZ;


-- ─────────────────────────────────────────────────────────────────
-- 6. user_level_progress (V-Level 진도 추적)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_level_progress (
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level            SMALLINT NOT NULL CHECK (level BETWEEN 0 AND 11),
  mastered_words   INT DEFAULT 0,
  learning_words   INT DEFAULT 0,
  completion_pct   NUMERIC(5,2) DEFAULT 0 CHECK (completion_pct BETWEEN 0 AND 100),
  last_studied_at  TIMESTAMPTZ,
  PRIMARY KEY (user_id, level)
);

ALTER TABLE user_level_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own data" ON user_level_progress FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────
-- 7. 진단 시스템 (3 테이블 + RLS)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vrl_diagnostic_tests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ko             TEXT NOT NULL,
  test_type           TEXT NOT NULL CHECK (test_type IN ('base_v_level','track','domain','comprehensive')),
  target_axis         TEXT NOT NULL,
  target_track_id     TEXT REFERENCES vocaflow_tracks(id) ON DELETE SET NULL,
  target_domain_id    TEXT REFERENCES vocaflow_domains(id) ON DELETE SET NULL,
  question_count      INT NOT NULL DEFAULT 30,
  estimated_minutes   INT NOT NULL DEFAULT 5,
  description_ko      TEXT,
  is_active           BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vrl_diagnostic_questions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id             UUID NOT NULL REFERENCES vrl_diagnostic_tests(id) ON DELETE CASCADE,
  word                TEXT NOT NULL REFERENCES shared_dictionary(word) ON DELETE CASCADE,
  target_v_level      SMALLINT CHECK (target_v_level BETWEEN 0 AND 11),
  target_track_level  SMALLINT CHECK (target_track_level BETWEEN 1 AND 10),
  difficulty_weight   NUMERIC(3,2) DEFAULT 1.0 CHECK (difficulty_weight BETWEEN 0 AND 5),
  display_order       SMALLINT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vrl_dq_test ON vrl_diagnostic_questions (test_id, display_order);

CREATE TABLE IF NOT EXISTS user_diagnostic_results (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_id                     UUID NOT NULL REFERENCES vrl_diagnostic_tests(id) ON DELETE CASCADE,
  responses                   JSONB NOT NULL,
  estimated_v_level           SMALLINT CHECK (estimated_v_level BETWEEN 0 AND 11),
  estimated_track_levels      JSONB DEFAULT '{}'::jsonb,
  estimated_domain_levels     JSONB DEFAULT '{}'::jsonb,
  estimated_skill_levels      JSONB DEFAULT '{}'::jsonb,
  confidence                  NUMERIC(3,2) CHECK (confidence BETWEEN 0 AND 1),
  taken_at                    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_udr_user_date ON user_diagnostic_results (user_id, taken_at DESC);

ALTER TABLE user_diagnostic_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own data" ON user_diagnostic_results FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 진단 메타·문항은 인증 사용자 모두 SELECT (시험 콘텐츠는 공유)
ALTER TABLE vrl_diagnostic_tests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE vrl_diagnostic_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read active" ON vrl_diagnostic_tests     FOR SELECT USING (is_active = true);
CREATE POLICY "read questions" ON vrl_diagnostic_questions FOR SELECT
  USING (test_id IN (SELECT id FROM vrl_diagnostic_tests WHERE is_active = true));


-- ─────────────────────────────────────────────────────────────────
-- 8. 검증 ASSERT — 시드 적재 정합 확인
-- ─────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- vocaflow_levels: 12 rows (0-11)
  IF (SELECT COUNT(*) FROM vocaflow_levels) <> 12 THEN
    RAISE EXCEPTION 'vocaflow_levels 시드 카운트 불일치: 12 expected, % found',
      (SELECT COUNT(*) FROM vocaflow_levels);
  END IF;
  IF (SELECT MIN(level) FROM vocaflow_levels) <> 0
     OR (SELECT MAX(level) FROM vocaflow_levels) <> 11 THEN
    RAISE EXCEPTION 'vocaflow_levels level 범위 0-11 아님';
  END IF;

  -- vocaflow_tracks: 6 rows, 영역 중립 ID 만
  IF (SELECT COUNT(*) FROM vocaflow_tracks) <> 6 THEN
    RAISE EXCEPTION 'vocaflow_tracks 시드 카운트 불일치: 6 expected, % found',
      (SELECT COUNT(*) FROM vocaflow_tracks);
  END IF;
  IF EXISTS (SELECT 1 FROM vocaflow_tracks WHERE id IN ('toeic','toefl','ielts','teps','toefl_ielts')) THEN
    RAISE EXCEPTION 'vocaflow_tracks 에 벤더명 ID 발견 — N2 중립화 위반';
  END IF;

  -- vocaflow_domains: 8 rows
  IF (SELECT COUNT(*) FROM vocaflow_domains) <> 8 THEN
    RAISE EXCEPTION 'vocaflow_domains 시드 카운트 불일치: 8 expected, % found',
      (SELECT COUNT(*) FROM vocaflow_domains);
  END IF;

  -- vocaflow_skills: 5 rows
  IF (SELECT COUNT(*) FROM vocaflow_skills) <> 5 THEN
    RAISE EXCEPTION 'vocaflow_skills 시드 카운트 불일치: 5 expected, % found',
      (SELECT COUNT(*) FROM vocaflow_skills);
  END IF;

  -- shared_dictionary 컬럼 추가 정합
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='shared_dictionary' AND column_name='v_level'
  ) THEN
    RAISE EXCEPTION 'shared_dictionary.v_level 컬럼 누락';
  END IF;

  RAISE NOTICE '✓ Day 1 인프라 시드 모두 정합. vocaflow_levels=12, tracks=6, domains=8, skills=5.';
END $$;

COMMIT;

-- ════════════════════════════════════════════════════════════════════
-- 다음 단계 (Day 2):
--   - calc_v_level(word) → SMALLINT (0-11)  -- 보정된 알고리즘 (C2+NULL+무태그 → L10, NAWL/TSL C1 → L8)
--   - calc_track_level(word, track_id) → SMALLINT (1-10)
--   - calc_domain_level(word, domain_id) → SMALLINT (1-5)
--   - calc_skill_level(word) → SMALLINT (1-5)
--   - analyze_book_vrl(book_id) → JSONB
-- ════════════════════════════════════════════════════════════════════
