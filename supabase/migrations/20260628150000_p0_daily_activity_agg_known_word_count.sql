-- P0 (LEARNER_MANAGEMENT.md §2-4·§3) — 집계층 신설
--   원천 스트림(learning_records #38·#51~#59 / scores #56~#58)은 이미 흐름.
--   본 마이그레이션은 그 스트림을 daily_activity 로 자동 집계 + known_word_count 캐시.
-- 전부 추가·비파괴 (트리거는 새 INSERT 부터 적용, 기존 데이터 무변경).
-- 롤백: docs/AI_CONTEXT/rollback/P0_daily_activity_knownword_원본.sql

-- P0-1a: learning_records → daily_activity (복습 활동 + 모듈별, KST date)
CREATE OR REPLACE FUNCTION public.agg_daily_activity_from_learning_record()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO daily_activity (user_id, date, total_reviews, by_module)
  VALUES (NEW.user_id, (NEW.attempted_at AT TIME ZONE 'Asia/Seoul')::date, 1,
          jsonb_build_object(NEW.module::text, 1))
  ON CONFLICT (user_id, date) DO UPDATE SET
    total_reviews = daily_activity.total_reviews + 1,
    by_module = daily_activity.by_module
      || jsonb_build_object(NEW.module::text,
           COALESCE((daily_activity.by_module ->> NEW.module::text)::int, 0) + 1);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_daily_activity_from_lr ON learning_records;
CREATE TRIGGER trg_daily_activity_from_lr AFTER INSERT ON learning_records
  FOR EACH ROW EXECUTE FUNCTION agg_daily_activity_from_learning_record();

-- P0-1b: scores → daily_activity (세션 시간/단어)
CREATE OR REPLACE FUNCTION public.agg_daily_activity_from_score()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO daily_activity (user_id, date, total_minutes, total_words)
  VALUES (NEW.user_id, (NEW.created_at AT TIME ZONE 'Asia/Seoul')::date,
          ROUND(COALESCE(NEW.duration_seconds,0)/60.0)::int, COALESCE(NEW.correct_count,0))
  ON CONFLICT (user_id, date) DO UPDATE SET
    total_minutes = daily_activity.total_minutes + ROUND(COALESCE(NEW.duration_seconds,0)/60.0)::int,
    total_words   = daily_activity.total_words   + COALESCE(NEW.correct_count,0);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_daily_activity_from_score ON scores;
CREATE TRIGGER trg_daily_activity_from_score AFTER INSERT ON scores
  FOR EACH ROW EXECUTE FUNCTION agg_daily_activity_from_score();

-- P0-2: known_word_count (LingQ형 Implicit Progress · derived 캐시, stability>=21)
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS known_word_count integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.user_stats.known_word_count IS 'LingQ형 known-word 캐시 (vocabularies stability>=21 수). flush 시 refresh_user_known_word_count 로 갱신. §10 derived — memory_state 등과 달리 정당한 집계 캐시.';

CREATE OR REPLACE FUNCTION public.refresh_user_known_word_count(p_user_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM vocabularies WHERE user_id = p_user_id AND stability >= 21;
  INSERT INTO user_stats (user_id, known_word_count, updated_at) VALUES (p_user_id, v_count, now())
  ON CONFLICT (user_id) DO UPDATE SET known_word_count = v_count, updated_at = now();
  RETURN v_count;
END $$;
