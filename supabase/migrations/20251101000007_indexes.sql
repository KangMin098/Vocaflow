-- ============================================================
-- Migration: 20251101000007_indexes.sql
-- Source: CLAUDE.md §"🗄 Supabase DB 스키마"
-- Created: 2025-11-01
-- ============================================================
--
-- 모든 인덱스 일괄 생성
--   - 핵심 콘텐츠 (texts, vocabularies, learning_records, scores, quiz_questions)
--   - Dictation (dictation_sessions, dictation_items)
--   - 공용 단어장 (shared_word_sets, shared_words)
--   - User 캐시 (daily_activity, achievements, reports)
--
-- 의존성:
--   - 모든 테이블 (20251101000002 ~ 20251101000005)
--
-- ※ UNIQUE 제약 (vocabularies UNIQUE(user_id, word)) 은 테이블 정의에 포함되어
--    별도 인덱스 불필요 (PostgreSQL 자동 생성).
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- texts
-- ────────────────────────────────────────────────────────────
CREATE INDEX idx_texts_user_lastopened ON texts(user_id, last_opened DESC NULLS LAST);
CREATE INDEX idx_texts_user_status     ON texts(user_id, status);
-- 부분 인덱스 — 북마크된 항목만 인덱스 (저장 공간 절약)
CREATE INDEX idx_texts_user_bookmark   ON texts(user_id, is_bookmarked) WHERE is_bookmarked = true;


-- ────────────────────────────────────────────────────────────
-- vocabularies
-- ────────────────────────────────────────────────────────────
CREATE INDEX idx_vocabularies_user_next ON vocabularies(user_id, next_review_at NULLS LAST);
CREATE INDEX idx_vocabularies_text      ON vocabularies(text_id);
CREATE INDEX idx_vocabularies_user_cefr ON vocabularies(user_id, cefr_level);


-- ────────────────────────────────────────────────────────────
-- learning_records
-- ────────────────────────────────────────────────────────────
CREATE INDEX idx_records_user_date   ON learning_records(user_id, attempted_at DESC);
CREATE INDEX idx_records_vocab       ON learning_records(vocabulary_id, attempted_at DESC);
CREATE INDEX idx_records_user_module ON learning_records(user_id, module);


-- ────────────────────────────────────────────────────────────
-- scores
-- ────────────────────────────────────────────────────────────
CREATE INDEX idx_scores_user_module_date ON scores(user_id, module, created_at DESC);
CREATE INDEX idx_scores_user_date        ON scores(user_id, created_at DESC);


-- ────────────────────────────────────────────────────────────
-- quiz_questions
-- ────────────────────────────────────────────────────────────
CREATE INDEX idx_quiz_text ON quiz_questions(text_id);


-- ────────────────────────────────────────────────────────────
-- dictation_sessions / dictation_items
-- ────────────────────────────────────────────────────────────
CREATE INDEX idx_dictation_sessions_user_date ON dictation_sessions(user_id, started_at DESC);
CREATE INDEX idx_dictation_items_session      ON dictation_items(session_id, index);


-- ────────────────────────────────────────────────────────────
-- shared_word_sets / shared_words
-- ────────────────────────────────────────────────────────────
CREATE INDEX idx_shared_sets_published ON shared_word_sets(is_published, sort_order);
CREATE INDEX idx_shared_sets_category  ON shared_word_sets(category);
CREATE INDEX idx_shared_words_set      ON shared_words(set_id, sort_order);


-- ────────────────────────────────────────────────────────────
-- daily_activity / achievements / reports
-- ────────────────────────────────────────────────────────────
CREATE INDEX idx_daily_activity_user_date ON daily_activity(user_id, date DESC);
CREATE INDEX idx_achievements_user_date   ON achievements(user_id, achieved_at DESC);
CREATE INDEX idx_reports_status_date      ON reports(status, created_at DESC);
