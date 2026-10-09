-- supabase/migrations/20261009120000_reading_specialized_production_gate.sql
-- P13/P14/P18/P20 have synthetic layouts, but external resource freshness and
-- timed production semantics are not yet verified by the atomic DB resolver.
-- Reject them before a production group or snapshot can be persisted.
CREATE FUNCTION public._reading_specialized_production_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE v_orders jsonb;
BEGIN
  v_orders := CASE TG_TABLE_NAME
    WHEN 'reading_production_group' THEN to_jsonb(NEW) #> '{group_document,orders}'
    WHEN 'reading_production_snapshot' THEN to_jsonb(NEW) #> '{evidence,group_document,orders}'
    ELSE NULL END;
  IF jsonb_typeof(v_orders) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'production order evidence missing' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_orders) AS row(document)
    WHERE row.document #>> '{order,product_family}' IN ('P13','P14','P18','P20')
  ) THEN
    RAISE EXCEPTION 'specialized production revalidation pending' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._reading_specialized_production_guard() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER reading_specialized_group_gate
BEFORE INSERT OR UPDATE ON public.reading_production_group
FOR EACH ROW EXECUTE FUNCTION public._reading_specialized_production_guard();

CREATE TRIGGER reading_specialized_snapshot_gate
BEFORE INSERT OR UPDATE ON public.reading_production_snapshot
FOR EACH ROW EXECUTE FUNCTION public._reading_specialized_production_guard();
