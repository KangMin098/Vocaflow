-- supabase/migrations/20261004020000_csat_drain_runs_search_path.sql
-- The existing timestamp trigger uses the caller's mutable search_path.
-- Fix its lookup scope without changing its body, privileges or any rows.
alter function public.csat_drain_runs_stamp_finished()
  set search_path = public, extensions, pg_temp;

