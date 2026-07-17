-- 롤백: 20260709194335_shared_word_sets_subscriber_count
DROP TRIGGER IF EXISTS trg_maintain_set_subscriber_count ON public.user_word_set_subscriptions;
DROP FUNCTION IF EXISTS public.tg_maintain_set_subscriber_count();
ALTER TABLE public.shared_word_sets DROP COLUMN IF EXISTS subscriber_count;
