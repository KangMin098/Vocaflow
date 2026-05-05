-- ============================================================
-- Migration: 20251101000006_triggers_and_rls.sql
-- Source: CLAUDE.md §"🗄 Supabase DB 스키마"
-- Created: 2025-11-01
-- ============================================================
--
-- 트리거 + RLS 일괄
--   - set_updated_at() 함수
--   - 4 테이블 updated_at 자동 갱신 트리거
--   - 15 테이블 RLS ENABLE
--   - 15 테이블 RLS POLICY
--
-- 의존성:
--   - 모든 테이블 (20251101000002 ~ 20251101000005)
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- updated_at 자동 갱신 함수
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ────────────────────────────────────────────────────────────
-- updated_at 트리거 — updated_at 컬럼이 있는 테이블 4종
-- ────────────────────────────────────────────────────────────
CREATE TRIGGER trg_texts_updated
  BEFORE UPDATE ON texts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_vocabularies_updated
  BEFORE UPDATE ON vocabularies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_user_stats_updated
  BEFORE UPDATE ON user_stats
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_user_profiles_updated
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- RLS — Row Level Security 활성화 (15 테이블)
-- ============================================================

ALTER TABLE texts                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabularies                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_records             ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE dictation_sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE dictation_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activity               ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_word_sets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_words                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_word_set_subscriptions  ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- RLS POLICY — 사용자 데이터 (본인만 SELECT/INSERT/UPDATE/DELETE)
-- ============================================================

CREATE POLICY "own data" ON texts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own data" ON vocabularies
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own data" ON learning_records
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own data" ON quiz_questions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own data" ON scores
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own data" ON dictation_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own data" ON dictation_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own data" ON user_stats
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own data" ON user_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own data" ON daily_activity
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own data" ON achievements
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- RLS POLICY — reports
-- 본인 작성만 SELECT/INSERT 가능, UPDATE 는 admin role 만 (Phase 2 admin 정책)
-- ============================================================

CREATE POLICY "own reports SELECT" ON reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "own reports INSERT" ON reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- RLS POLICY — 공용 단어장 구독
-- ============================================================

CREATE POLICY "own subs" ON user_word_set_subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- RLS POLICY — 공용 자원 (게시된 것만 모든 인증 사용자 SELECT)
-- 관리자만 shared_* 에 INSERT/UPDATE — 별도 admin role 정책 (Phase 2)
-- ============================================================

CREATE POLICY "read published" ON shared_word_sets
  FOR SELECT USING (is_published = true);

CREATE POLICY "read words of published" ON shared_words
  FOR SELECT USING (
    set_id IN (SELECT id FROM shared_word_sets WHERE is_published = true)
  );
