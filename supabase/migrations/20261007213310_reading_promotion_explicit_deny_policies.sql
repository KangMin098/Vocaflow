-- supabase/migrations/20261007213310_reading_promotion_explicit_deny_policies.sql
-- Explicit restrictive deny policies document that API table access is never
-- allowed. postgres-owned SECURITY DEFINER RPCs and service_role bypass RLS;
-- they retain their pre-existing EXECUTE and table ACL checks.
BEGIN;
CREATE POLICY reading_promotion_private_deny ON public.reading_promotion_audit
  AS RESTRICTIVE FOR ALL TO PUBLIC USING (false) WITH CHECK (false);
CREATE POLICY reading_promotion_private_deny ON public.reading_promotion_permit
  AS RESTRICTIVE FOR ALL TO PUBLIC USING (false) WITH CHECK (false);
CREATE POLICY reading_promotion_private_deny ON public.reading_promotion_authority
  AS RESTRICTIVE FOR ALL TO PUBLIC USING (false) WITH CHECK (false);
CREATE POLICY reading_promotion_private_deny ON public.reading_product_order_revision
  AS RESTRICTIVE FOR ALL TO PUBLIC USING (false) WITH CHECK (false);
CREATE POLICY reading_promotion_private_deny ON public.reading_promotion_approval
  AS RESTRICTIVE FOR ALL TO PUBLIC USING (false) WITH CHECK (false);
COMMIT;
