-- supabase/migrations/20261008060000_reading_promotion_tables_rls.sql
-- Defense in depth: no API table policy; SECURITY DEFINER RPCs retain their
-- explicit identity and evidence checks. service_role retains audit SELECT.
BEGIN;
ALTER TABLE public.reading_promotion_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_promotion_permit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_promotion_authority ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_product_order_revision ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_promotion_approval ENABLE ROW LEVEL SECURITY;
COMMIT;
