-- ============================================================
-- Migration: 20260504160708_prepare_dictionary_for_seed_import.sql
-- Source: 외부 시드 import 사전 준비
-- Created: 2026-05-04
-- ============================================================
--
-- 변경 1: shared_dictionary.meaning_ko NOT NULL 제거
--   - import 시점엔 영문만 있고 한국어 뜻 없음
--   - Phase 4-4 에서 Claude API 로 일괄 생성 후 채움
--   - NULL 의 의미: "아직 번역 안 됨" (빈 문자열 '' 보다 명확)
--
-- 변경 2: source CHECK 제약에 'imported' 추가
--   - 외부 시드 데이터셋 출처 표기용
--   - 기존 6개 값 유지 + 1개 추가
--
-- 변경 3: dictionary_word_categories.source 정정
--   - DEFAULT 값 추상화 처리
--   - CHECK 제약 값 추상화 교체
--
-- 의존성:
--   - 20260504144011_add_shared_dictionary.sql (테이블 + 기존 CHECK 정의)
--   - 20260504154153_add_dictionary_categories.sql (dictionary_word_categories)
--
-- 영향 범위:
--   - 기존 데이터 무변경 (새 row 만 NULL 허용)
--   - DROP/ADD CONSTRAINT 는 트랜잭션 안에서 안전
--   - DEFAULT 값 변경은 미래 INSERT 에만 적용
-- ============================================================

-- ── 변경 1: meaning_ko NULL 허용 ──
ALTER TABLE shared_dictionary
  ALTER COLUMN meaning_ko DROP NOT NULL;

-- ── 변경 2: source CHECK 제약 갱신 (DROP → ADD) ──
ALTER TABLE shared_dictionary
  DROP CONSTRAINT IF EXISTS shared_dictionary_source_check;

ALTER TABLE shared_dictionary
  ADD CONSTRAINT shared_dictionary_source_check
  CHECK (source IN (
    'oxford5000',
    'cefrj',
    'coca',
    'ngsl',
    'ai-generated',
    'manual',
    'imported'    -- ★ 신규 추가 (외부 시드 데이터셋)
  ));

-- ── 변경 3: dictionary_word_categories.source 정정 ──

-- DEFAULT 값 추상화
ALTER TABLE dictionary_word_categories
  ALTER COLUMN source SET DEFAULT 'imported';

-- CHECK 제약 갱신 (DROP → ADD 패턴)
ALTER TABLE dictionary_word_categories
  DROP CONSTRAINT IF EXISTS dictionary_word_categories_source_check;

ALTER TABLE dictionary_word_categories
  ADD CONSTRAINT dictionary_word_categories_source_check
  CHECK (source IN (
    'imported',        -- 외부 시드 데이터
    'manual',
    'ai-suggested'
  ));
