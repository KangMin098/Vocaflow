-- ============================================================
-- Migration: 20260504101620_add_user_profile_role_and_cefr.sql
-- Source: 관리자 권한 분리 + 학습자 CEFR + 계정 라이프사이클 도입
-- Created: 2026-05-04
-- ============================================================
--
-- user_profiles 테이블에 컬럼 3종 추가:
--
--   1) role          — 사용자 권한 분리
--      - 'user'    : 일반 사용자 (default)
--      - 'admin'   : 관리자 콘솔 (/admin/*) 전체 접근 권한
--      - 'curator' : 공용 단어장 (shared_word_sets) 등록·편집 권한
--      → middleware.ts 에서 /admin/* 진입 시 role='admin' 검증 (Phase 2)
--
--   2) cefr_level    — 학습자 자가 평가 레벨 (NULL 허용)
--      - A1~C2 6단계 또는 NULL (미설정 = Cold 사용자)
--      - 콘텐츠 추천 엔진 P3 (Library 큐레이션 매칭) + Hub Today CTA 분기
--      - Settings 페이지에서 사용자 직접 변경
--
--   3) status        — 계정 라이프사이클
--      - 'active'    : 활성 (default)
--      - 'suspended' : 관리자에 의한 정지 (Reports 처리 결과)
--      - 'deleted'   : Soft delete (auth.users 제거 전 단계)
--      → 미들웨어에서 status != 'active' 시 로그인 차단
--
-- 부분 인덱스 2종:
--   - 대부분 사용자가 role='user' / status='active' 이므로
--     예외 케이스만 인덱싱하여 저장 공간 + INSERT 비용 절약
--
-- 의존성:
--   - user_profiles 테이블 (20251101000005_user_stats_table.sql)
--   - 기존 RLS 정책 그대로 적용 (20251101000006_triggers_and_rls.sql)
--     "own data" ON user_profiles — 본인 row 만 SELECT/UPDATE
--     ※ admin role 글로벌 SELECT 정책은 별도 추후 마이그레이션
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- ALTER user_profiles — 컬럼 3종 추가
-- ────────────────────────────────────────────────────────────
ALTER TABLE user_profiles
  ADD COLUMN role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin', 'curator')),
  ADD COLUMN cefr_level TEXT
    CHECK (cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'deleted'));


-- ────────────────────────────────────────────────────────────
-- 부분 인덱스 — 비기본값 row 만 (cardinality 작음)
-- ────────────────────────────────────────────────────────────

-- 관리자·큐레이터만 빠르게 조회 (Admin Console 사용자 관리, curator 권한 부여)
CREATE INDEX idx_user_profiles_role
  ON user_profiles(role)
  WHERE role != 'user';

-- 정지·삭제 계정만 빠르게 조회 (Admin Console 모니터링, soft delete 정리)
CREATE INDEX idx_user_profiles_status
  ON user_profiles(status)
  WHERE status != 'active';
