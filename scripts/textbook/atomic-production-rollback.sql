-- scripts/textbook/atomic-production-rollback.sql
-- Prepared rollback only. Stop capture/finalize/publish/serve traffic before use.
-- This deletes all production group, snapshot, and artifact records. Do not run
-- without separate authorization for destructive data loss.
BEGIN;
DROP FUNCTION IF EXISTS public.serve_reading_production_artifact(uuid);
DROP FUNCTION IF EXISTS public.publish_reading_production_artifact(uuid,text,text);
DROP FUNCTION IF EXISTS public.finalize_reading_production_snapshot(uuid,text,text);
DROP FUNCTION IF EXISTS public.capture_reading_production_snapshot(text);
DROP FUNCTION IF EXISTS public._reading_production_evidence(text);
DROP FUNCTION IF EXISTS public.approve_reading_production_output(uuid,text,text);
DROP FUNCTION IF EXISTS public.register_reading_production_group(text,integer,jsonb,jsonb,jsonb);
DROP FUNCTION IF EXISTS public._reading_verify_ed25519(jsonb,text);
DROP FUNCTION IF EXISTS public._reading_target_key(jsonb);
DROP FUNCTION IF EXISTS public._reading_json_hash(jsonb);
DROP FUNCTION IF EXISTS public._reading_canonical_json(jsonb);
DROP TABLE IF EXISTS public.reading_production_artifact;
DROP TABLE IF EXISTS public.reading_production_snapshot;
DROP TABLE IF EXISTS public.reading_production_group;
COMMIT;
-- Keep pgsodium installed: it may be shared. An extension removal requires a
-- separate dependency audit and explicit approval.
