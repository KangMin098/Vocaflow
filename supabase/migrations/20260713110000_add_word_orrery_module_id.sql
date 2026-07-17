-- 20260713110000_add_word_orrery_module_id.sql
-- 아케이드 ⑧ The Word Orrery module_id enum 확장 — FSRS learning_records.module / scores.module persistence 활성.
-- ✅ 원격 적용 완료(2026-07-13) — apply_migration name=add_word_orrery_module_id. DB 검증: enum 에 'word-orrery' 존재.
-- 안전성: 순수 additive(값 추가만). 기존 값·데이터 무영향. IF NOT EXISTS 로 재적용 안전.

ALTER TYPE module_id ADD VALUE IF NOT EXISTS 'word-orrery';
