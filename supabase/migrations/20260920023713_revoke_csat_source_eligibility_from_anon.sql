REVOKE EXECUTE ON FUNCTION public.csat_source_is_eligible(uuid)
  FROM anon;

REVOKE EXECUTE ON FUNCTION public.retain_source_eligibility_history()
  FROM PUBLIC, anon, authenticated;