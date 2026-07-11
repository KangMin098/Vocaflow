-- docs/proposals/game-suite-module-enum.sql
-- 마이그레이션 제안(미적용) — 승인 후 apply_migration.
-- 아케이드 스위트 6종의 learning_records.module / scores.module persistence 활성.
--
-- 배경: module_id ENUM 이 learning_records.module·scores.module 을 제약(20251101000001).
--   6 신규 게임(cascade/connections/word-economy/daily-blitz/letter-forge/ghost-race)은
--   TS ModuleId/ScoreModule 엔 추가했으나 DB enum 미확장 → FSRS audit/scores insert 거부(게임은
--   fire-and-forget void 로 흡수, 카드 SRS 갱신은 유효). 본 마이그레이션이 audit/scores 완전 활성.
--
-- 안전성: 순수 additive(값 추가만). 기존 값·데이터 무영향. IF NOT EXISTS 로 재적용 안전.
--   ALTER TYPE ... ADD VALUE 는 PG12+ 트랜잭션 내 허용(같은 tx 내 사용만 불가 — 여기선 추가만).

ALTER TYPE module_id ADD VALUE IF NOT EXISTS 'cascade';
ALTER TYPE module_id ADD VALUE IF NOT EXISTS 'connections';
ALTER TYPE module_id ADD VALUE IF NOT EXISTS 'word-economy';
ALTER TYPE module_id ADD VALUE IF NOT EXISTS 'daily-blitz';
ALTER TYPE module_id ADD VALUE IF NOT EXISTS 'letter-forge';
ALTER TYPE module_id ADD VALUE IF NOT EXISTS 'ghost-race';
