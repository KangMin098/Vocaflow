-- 롤백: P0 집계층 되돌리기 (추가물 제거 — 원천 스트림/기존 데이터는 무영향)
-- 주의: known_word_count 컬럼 DROP 시 캐시 값 손실(재계산 가능, vocabularies 는 무손실).

DROP TRIGGER IF EXISTS trg_daily_activity_from_lr ON public.learning_records;
DROP TRIGGER IF EXISTS trg_daily_activity_from_score ON public.scores;
DROP FUNCTION IF EXISTS public.agg_daily_activity_from_learning_record();
DROP FUNCTION IF EXISTS public.agg_daily_activity_from_score();
DROP FUNCTION IF EXISTS public.refresh_user_known_word_count(uuid);
ALTER TABLE public.user_stats DROP COLUMN IF EXISTS known_word_count;
-- daily_activity 누적 행은 보존(원하면 TRUNCATE 별도).
