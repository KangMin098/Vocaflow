REVOKE EXECUTE ON FUNCTION public.video_job_advance(text, text, text, jsonb, text)
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.video_job_evaluate(text, integer, integer, integer, jsonb)
  FROM anon, authenticated;