-- 20260712180000_add_arcade_newconcept_module_ids.sql
-- 아케이드 신개념 6종 module_id enum 확장 — FSRS learning_records.module / scores.module persistence 활성.
-- ✅ 원격 적용 완료(2026-07-12) — apply_migration name=add_arcade_newconcept_module_ids.
--   DB 검증: enum 에 6 값(glyph-tongue/word-customs/lexicon-hands/lexicon-detective/morpheme-rules/silent-rule) 존재 확인.
--
-- 배경: 명작 해부 도시에의 6 신개념 게임(Chants/Papers Please/Balatro/Golden Idol/Baba/Witness 계열)은
--   TS ModuleId/ScoreModule 엔 추가했으나 DB enum 미확장 → audit/scores insert 거부(fire-and-forget 흡수).
--   본 마이그레이션이 6종 persistence 완전 활성 (기존 arcade 6종 20260711125000 과 동일 패턴).
--
-- 안전성: 순수 additive(값 추가만). 기존 값·데이터 무영향. IF NOT EXISTS 로 재적용 안전.

ALTER TYPE module_id ADD VALUE IF NOT EXISTS 'glyph-tongue';
ALTER TYPE module_id ADD VALUE IF NOT EXISTS 'word-customs';
ALTER TYPE module_id ADD VALUE IF NOT EXISTS 'lexicon-hands';
ALTER TYPE module_id ADD VALUE IF NOT EXISTS 'lexicon-detective';
ALTER TYPE module_id ADD VALUE IF NOT EXISTS 'morpheme-rules';
ALTER TYPE module_id ADD VALUE IF NOT EXISTS 'silent-rule';
