-- 롤백: P1 learning_goals 제거 (사용자 목표 데이터 손실 — vocabularies/학습기록 무영향)
DROP POLICY IF EXISTS learning_goals_owner ON public.learning_goals;
DROP TABLE IF EXISTS public.learning_goals;
