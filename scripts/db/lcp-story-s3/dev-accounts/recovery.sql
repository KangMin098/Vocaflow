-- Recovery proposal only; separate execution approval required. Preserve accounts and history.
-- Suspend only this controlled development cohort; never delete users or alter the existing admin.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';
UPDATE public.user_profiles p
   SET role = 'user', status = 'suspended'
  FROM auth.users u
 WHERE u.id = p.user_id
   AND u.raw_app_meta_data->>'vfc_dev_run' = 'lcp-story-dev-e2e-20261026-01'
   AND u.raw_app_meta_data->>'vfc_actor' = 'ai_development'
   AND u.raw_app_meta_data->>'vfc_dev_account' IN ('producer','reviewer','learner_a','learner_b');
COMMIT;
