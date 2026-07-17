-- 20260709194335_shared_word_sets_subscriber_count.sql
-- 공용 단어장 사용빈도/인기 랭킹 — subscriber_count denormalized 컬럼 + 트리거 유지.
--   user_word_set_subscriptions 는 RLS 본인전용이라 클라에서 전체 구독수 집계 불가 →
--   shared_word_sets 에 카운트를 비정규화하고 INSERT/DELETE 트리거로 동기 유지(공용 read).

ALTER TABLE public.shared_word_sets ADD COLUMN IF NOT EXISTS subscriber_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.shared_word_sets.subscriber_count IS
  '구독자 수(denormalized) — user_word_set_subscriptions INSERT/DELETE 트리거로 유지. 공용 단어장 사용빈도/인기 랭킹용(RLS 본인전용 집계 회피).';

-- 기존 구독 백필
UPDATE public.shared_word_sets s
SET subscriber_count = COALESCE(c.n, 0)
FROM (SELECT set_id, count(*) n FROM public.user_word_set_subscriptions GROUP BY set_id) c
WHERE c.set_id = s.id;

-- 트리거 함수 (SECURITY DEFINER — 구독자 RLS 무관하게 카운트 유지)
CREATE OR REPLACE FUNCTION public.tg_maintain_set_subscriber_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.shared_word_sets SET subscriber_count = subscriber_count + 1 WHERE id = NEW.set_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.shared_word_sets SET subscriber_count = GREATEST(0, subscriber_count - 1) WHERE id = OLD.set_id;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_maintain_set_subscriber_count ON public.user_word_set_subscriptions;
CREATE TRIGGER trg_maintain_set_subscriber_count
  AFTER INSERT OR DELETE ON public.user_word_set_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_maintain_set_subscriber_count();
