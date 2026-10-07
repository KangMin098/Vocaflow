-- supabase/migrations/20261007102922_reading_gate_pin_search_path.sql
-- Pin the trigger function's lookup path after the DB checkpoint exposed
-- mutable_search_path_funcs changing from 0 to 1. No row or trigger changes.

ALTER FUNCTION public.trg_hold_reading_adaptation()
  SET search_path = pg_catalog;
