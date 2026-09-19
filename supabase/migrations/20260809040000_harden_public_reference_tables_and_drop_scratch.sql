-- supabase/migrations/20260809040000_harden_public_reference_tables_and_drop_scratch.sql
--
-- public 스키마 노출 정리 (2026-08-09, 사용자 승인 후 적용).
--
-- 실측된 문제: 아래 8개 테이블은 RLS 가 없는데 anon 에게 INSERT·UPDATE·DELETE·TRUNCATE
-- 권한까지 열려 있었다. anon 키는 브라우저에 실려 나가므로 누구나
--   · lexicon_clean(455,037행 — 학습자 단어 뜻 조회가 전부 여기를 거친다)을 고치고
--   · extraction_test_vocab(2,045,936행 · 1.4GB 평가 코퍼스)을 TRUNCATE 할 수 있었다.
--
-- 조치가 테이블마다 다른 이유: 이 테이블들을 읽는 함수(lookup_word_meaning 등)가 전부
-- SECURITY **INVOKER** 다. 정책 없이 RLS 만 켜면 호출자 권한으로 읽으므로 조회가 죽는다.
--   → 런타임 참조 테이블: 읽기 정책을 주고 쓰기 권한만 회수
--   → 평가 전용 테이블  : 서비스롤로만 쓰므로 정책 없이 전면 차단(서비스롤은 RLS 우회)

-- ── ① 런타임 참조 사전 — 읽기는 유지, 쓰기만 차단 ────────────────────
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
  lexicon_clean, spelling_norm, dialect_map, csat_stage_gates
  FROM anon, authenticated;

ALTER TABLE lexicon_clean    ENABLE ROW LEVEL SECURITY;
ALTER TABLE spelling_norm    ENABLE ROW LEVEL SECURITY;
ALTER TABLE dialect_map      ENABLE ROW LEVEL SECURITY;
ALTER TABLE csat_stage_gates ENABLE ROW LEVEL SECURITY;

CREATE POLICY lexicon_clean_read    ON lexicon_clean    FOR SELECT USING (true);
CREATE POLICY spelling_norm_read    ON spelling_norm    FOR SELECT USING (true);
CREATE POLICY dialect_map_read      ON dialect_map      FOR SELECT USING (true);
CREATE POLICY csat_stage_gates_read ON csat_stage_gates FOR SELECT USING (true);

COMMENT ON POLICY lexicon_clean_read ON lexicon_clean IS
  '공개 참조 사전 — 읽기만 허용. 쓰기는 권한 회수 + 정책 부재로 이중 차단(서비스롤만 갱신).';

-- ── ② 평가 전용 코퍼스 — 전면 차단 (서비스롤 스크립트만 사용) ─────────
-- scripts/dict/build-test-corpus*.mts 가 SUPABASE_SERVICE_ROLE_KEY 로 적재한다(실측).
REVOKE ALL ON extraction_test_books, extraction_test_vocab FROM anon, authenticated;
ALTER TABLE extraction_test_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_test_vocab ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE extraction_test_vocab IS
  '추출 품질 평가 코퍼스(프로덕션 분리). 서비스롤 전용 — RLS 활성 + 정책 없음으로 anon/authenticated 전면 차단.';

-- ── ③ SECURITY DEFINER 뷰 → invoker ──────────────────────────────────
-- 기존 마이그레이션 views_security_invoker(20260614011809)에서 누락된 한 건.
ALTER VIEW csat_stage_catalog SET (security_invoker = true);

-- ── ④ 스크래치 테이블 제거 ───────────────────────────────────────────
-- 코드·함수·뷰 어디에서도 참조되지 않는 중간 집계다(grep + pg_proc + pg_depend 확인).
-- extraction_test_vocab 에서 scripts/dict/fresh-residual-build.mjs 로 재생성 가능하며,
-- 삭제 전 work/db-backup/ 에 전량(54,230 / 4,212행) 백업했다.
DROP TABLE IF EXISTS _seed_lem;
DROP TABLE IF EXISTS _resid_ctx;
