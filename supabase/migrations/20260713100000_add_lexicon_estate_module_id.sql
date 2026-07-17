-- 20260713100000_add_lexicon_estate_module_id.sql
-- 아케이드 ⑦ Lexicon Estate module_id enum 확장 — FSRS learning_records.module / scores.module persistence 활성.
-- ✅ 원격 적용 완료(2026-07-13) — apply_migration name=add_lexicon_estate_module_id. DB 검증: enum 에 'lexicon-estate' 존재.
-- 안전성: 순수 additive(값 추가만). 기존 값·데이터 무영향. IF NOT EXISTS 로 재적용 안전.

ALTER TYPE module_id ADD VALUE IF NOT EXISTS 'lexicon-estate';
