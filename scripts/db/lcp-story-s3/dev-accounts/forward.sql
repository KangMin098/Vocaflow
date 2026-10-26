-- Proposed only: four isolated AI-development accounts; no existing account is changed.
-- Auth Admin API must first create exactly four new users with protected app_metadata:
-- vfc_dev_run=lcp-story-dev-e2e-20261026-01, vfc_actor=ai_development,
-- vfc_dev_account=producer|reviewer|learner_a|learner_b. No mail is sent.
-- Passwords are generated in process and stored only in an ignored private .env file.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';
DO $vfc_dev_accounts$
DECLARE
  account_count integer;
  label_count integer;
  matched_profiles integer;
BEGIN
  SELECT count(*), count(DISTINCT raw_app_meta_data->>'vfc_dev_account')
    INTO account_count, label_count
    FROM auth.users
   WHERE raw_app_meta_data->>'vfc_dev_run' = 'lcp-story-dev-e2e-20261026-01'
     AND raw_app_meta_data->>'vfc_actor' = 'ai_development'
     AND raw_app_meta_data->>'vfc_dev_account' IN ('producer','reviewer','learner_a','learner_b');
  IF account_count <> 4 OR label_count <> 4 THEN
    RAISE EXCEPTION 'Expected exactly four distinct controlled development accounts';
  END IF;
  SELECT count(*) INTO matched_profiles
    FROM public.user_profiles p JOIN auth.users u ON u.id = p.user_id
   WHERE u.raw_app_meta_data->>'vfc_dev_run' = 'lcp-story-dev-e2e-20261026-01'
     AND u.raw_app_meta_data->>'vfc_actor' = 'ai_development'
     AND u.raw_app_meta_data->>'vfc_dev_account' IN ('producer','reviewer','learner_a','learner_b')
     AND p.status = 'active'
     AND (p.role = 'user' OR p.role = CASE u.raw_app_meta_data->>'vfc_dev_account'
          WHEN 'producer' THEN 'curator' WHEN 'reviewer' THEN 'admin' ELSE 'user' END);
  IF matched_profiles <> 4 THEN
    RAISE EXCEPTION 'Missing profile or unexpected role/status; do not modify existing accounts';
  END IF;
  UPDATE public.user_profiles p
     SET role = CASE u.raw_app_meta_data->>'vfc_dev_account'
                  WHEN 'producer' THEN 'curator' WHEN 'reviewer' THEN 'admin' ELSE 'user' END
    FROM auth.users u
   WHERE u.id = p.user_id
     AND u.raw_app_meta_data->>'vfc_dev_run' = 'lcp-story-dev-e2e-20261026-01'
     AND u.raw_app_meta_data->>'vfc_actor' = 'ai_development'
     AND u.raw_app_meta_data->>'vfc_dev_account' IN ('producer','reviewer','learner_a','learner_b');
END
$vfc_dev_accounts$;
COMMIT;
