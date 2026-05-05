-- ============================================================
-- Migration: 20260504144011_add_shared_dictionary.sql
-- Source: 영단어 마스터 사전 (AI 호출 캐시)
-- Created: 2026-05-04
-- ============================================================
--
-- 영단어 → 한국어 뜻/품사/CEFR 마스터 캐시.
--
-- 다른 테이블과의 역할 구분:
--   shared_dictionary  : 시스템 캐시 (사용자 노출 X) — 본 테이블
--   shared_words       : 큐레이션 단어장 콘텐츠 (사용자 노출 O)
--   vocabularies       : 사용자 개인 단어장
--
-- 데이터 흐름:
--   사용자 텍스트 입력 → 단어 토큰화 → shared_dictionary 조회
--   → 히트(목표 90%): 즉시 반환
--   → 미스(10%): Claude API 호출 → shared_dictionary INSERT (캐시)
--                              → 사용자 vocabularies INSERT
--
-- 발음:
--   IPA/US 발음기호는 의도적으로 제외 (Web Speech API TTS 로 처리)
--
-- 인덱스 전략:
--   - cefr_level    : CEFR 별 분포 조회
--   - frequency_rank: 빈도 기반 추천 (NULL 제외 partial index)
--   - source        : 데이터 출처 추적
--
-- 데이터 정규화 규약:
--   word PRIMARY KEY 는 반드시 소문자(lowercase) 로 저장.
--   클라이언트/서버 INSERT 시 LOWER(word) 강제 — application layer 책임 (Phase B).
-- ============================================================

CREATE TABLE shared_dictionary (
  -- 기본 검색 키 (소문자 정규화 필수)
  word TEXT PRIMARY KEY,

  -- 의미 정보
  meaning_ko TEXT NOT NULL,                 -- 대표 한국어 뜻 1개
  meanings_ko JSONB,                        -- 다중 의미 [{ pos, meaning }, ...]

  -- 품사
  pos TEXT NOT NULL,                        -- 대표 품사 ('noun'|'verb'|'adj'|'adv'|...)
  pos_all TEXT[],                           -- 모든 가능 품사

  -- 학습 메타
  cefr_level TEXT CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),
  frequency_rank INT,                       -- COCA 등 빈도 순위 (낮을수록 빈출)

  -- 보조
  example_en TEXT,
  synonyms TEXT[],
  antonyms TEXT[],

  -- 출처 + 검증
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('oxford5000','cefrj','coca','ngsl','ai-generated','manual')),
  verified BOOLEAN DEFAULT false,

  -- 운영
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 인덱스 ──
CREATE INDEX idx_dict_cefr ON shared_dictionary(cefr_level);
CREATE INDEX idx_dict_freq ON shared_dictionary(frequency_rank)
  WHERE frequency_rank IS NOT NULL;
CREATE INDEX idx_dict_source ON shared_dictionary(source);

-- ── updated_at 자동 갱신 (set_updated_at() 은 20251101000006_triggers_and_rls.sql 정의됨) ──
CREATE TRIGGER trg_shared_dictionary_updated
  BEFORE UPDATE ON shared_dictionary
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ──
ALTER TABLE shared_dictionary ENABLE ROW LEVEL SECURITY;

-- 모든 인증 사용자 SELECT 가능 (캐시는 공유 자원)
CREATE POLICY "authenticated read dictionary"
  ON shared_dictionary
  FOR SELECT
  TO authenticated
  USING (true);

-- 쓰기는 service_role 만 (API 라우트의 server.ts 에서만)
-- 클라이언트에서 직접 INSERT/UPDATE/DELETE 차단
CREATE POLICY "service write dictionary"
  ON shared_dictionary
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
