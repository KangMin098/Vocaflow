-- supabase/migrations/20260816003000_daily_activity_total_seconds.sql
--
-- `daily_activity.total_minutes` 가 학습 시간을 **이벤트마다 반올림하며 잃고 있었다.**
--
-- 원인: `agg_daily_activity_from_score()` 가 score 1건마다
--       `ROUND(COALESCE(NEW.duration_seconds,0)/60.0)::int` 를 더했다.
--       30초 미만 세션은 **0분으로 반올림되어 영원히 누적되지 않는다.**
--
-- 실측(2026-08-16, 적용 직전):
--   · scores 63행 중 **39행(62%)이 1~29초** → 각각 0분으로 기록
--   · 실제 합계 1,263초(21.1분) vs 기록 등가 1,140초(19분) — 약 10% 과소
--   · 더 심한 것은 **하루 단위 판정**이었다: 20초짜리 세션 세 번을 한 날은 0분으로 남아
--     "학습 안 한 날" 로 읽혔다. /dashboard 히트맵이 8일 연속 학습 계정을
--     "28일 중 1일" 로 그린 원인(v06.201 에서 화면 쪽은 리뷰 건수 기준으로 이미 교체).
--   · 아직 살아 있는 소비자: `lib/learner/weekly-report.ts`(주간 리포트 "N분" 저장)
--     · `components/reports/ReportsClient.tsx`(렌더) · `wordvault/hub/FlowStripe.tsx`
--
-- 해결: **초를 원본으로 누적하고 분은 그 누적값에서 파생한다.**
--       반올림이 이벤트마다 일어나지 않고 조회 시점에 한 번만 일어난다.
--
-- ⚠️ 백필이 필수다(이 마이그레이션에서 가장 중요한 줄).
--    `total_seconds` 를 0으로 두고 트리거만 바꾸면, 기존 행에 다음 이벤트가 들어올 때
--    `total_minutes = ROUND((0 + 신규초)/60.0)` 이 되어 **이미 쌓인 분이 통째로 지워진다**
--    (예: 5분이 쌓인 날에 30초 세션이 들어오면 5분 → 1분). 그래서 기존 분을 초로 환산해
--    연속성을 만든다. `ROUND(m*60/60) = m` 이므로 기존 표시값은 **정확히 보존**된다.
--
-- 과거 손실분은 복구 불가다 — 원본 `scores.duration_seconds` 는 남아 있지만 `daily_activity`
-- 재집계는 `learning_records` 쪽 트리거 이력과 뒤섞여 있어 안전하게 되돌릴 수 없다.
-- 이 마이그레이션은 **적용 시점부터** 정확해진다. 백필은 복구가 아니라 연속성 확보다.
--
-- 영향 규모(적용 직전 실측): daily_activity **25행** · 그중 분>0 **12행** · 합계 **64분** · 사용자 3.
-- 순수 추가(컬럼 1 · 함수 1 교체) — 삭제·파괴 없음.

-- ① 초 단위 원본 컬럼
ALTER TABLE public.daily_activity
  ADD COLUMN IF NOT EXISTS total_seconds integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.daily_activity.total_seconds IS
  '학습 시간 원본(초). total_minutes 는 이 값에서 파생 — 이벤트별 반올림 손실 방지.';

COMMENT ON COLUMN public.daily_activity.total_minutes IS
  'total_seconds 에서 파생된 분(ROUND). 직접 누적 금지 — 30초 미만이 0으로 사라진다.';

-- ② 백필 — 기존 분을 초로 환산해 연속성 확보 (위 ⚠️ 참조)
UPDATE public.daily_activity
   SET total_seconds = COALESCE(total_minutes, 0) * 60
 WHERE total_seconds = 0
   AND COALESCE(total_minutes, 0) > 0;

-- ③ 트리거 함수 — 초로 누적하고 분은 파생
CREATE OR REPLACE FUNCTION public.agg_daily_activity_from_score()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_seconds int := GREATEST(0, COALESCE(NEW.duration_seconds, 0));
BEGIN
  INSERT INTO daily_activity (user_id, date, total_seconds, total_minutes, total_words)
  VALUES (
    NEW.user_id,
    (NEW.created_at AT TIME ZONE 'Asia/Seoul')::date,
    v_seconds,
    ROUND(v_seconds / 60.0)::int,
    COALESCE(NEW.correct_count, 0)
  )
  ON CONFLICT (user_id, date) DO UPDATE SET
    total_seconds = daily_activity.total_seconds + v_seconds,
    -- 파생 — 누적 초에서 한 번만 반올림한다. `+ ROUND(신규/60)` 로 두면 원래 결함으로 돌아간다.
    total_minutes = ROUND((daily_activity.total_seconds + v_seconds) / 60.0)::int,
    total_words   = daily_activity.total_words + COALESCE(NEW.correct_count, 0);
  RETURN NEW;
END $function$;

COMMENT ON FUNCTION public.agg_daily_activity_from_score() IS
  'scores → daily_activity 집계. 시간은 초로 누적하고 분은 파생(20260816003000).';
