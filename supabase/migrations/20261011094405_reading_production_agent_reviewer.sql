-- supabase/migrations/20261011094405_reading_production_agent_reviewer.sql
-- Prepared for review. Do not apply without explicit migration approval.
-- Vocaflow has one human administrator. The independent second approval of a production output is given by
-- an agent reviewer (Claude Code or Codex) that did not produce the output. The human admin registers each
-- agent's Ed25519 public key once; the agent signs a review receipt bound to the exact snapshot and output hash.
-- The existing human approval RPC is unchanged.
BEGIN;

CREATE TABLE public.reading_production_agent_reviewer (
  reviewer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent text NOT NULL CHECK (agent IN ('claude', 'codex')),
  public_key text NOT NULL UNIQUE CHECK (public_key LIKE '-----BEGIN PUBLIC KEY-----%'),
  active boolean NOT NULL DEFAULT true,
  registered_by uuid NOT NULL,
  registered_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX reading_production_agent_reviewer_one_active
  ON public.reading_production_agent_reviewer (agent) WHERE active;
ALTER TABLE public.reading_production_agent_reviewer ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.reading_production_agent_review (
  snapshot_id uuid PRIMARY KEY,
  group_id text NOT NULL,
  reviewer_id uuid NOT NULL REFERENCES public.reading_production_agent_reviewer(reviewer_id),
  producer_agent text NOT NULL,
  receipt jsonb NOT NULL,
  receipt_hash text NOT NULL CHECK (receipt_hash ~ '^[a-f0-9]{64}$'),
  approved_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.reading_production_agent_review ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.reading_production_group
  ADD COLUMN produced_by_agent text CHECK (produced_by_agent IN ('claude', 'codex'));

-- The single human admin registers (or rotates) an agent reviewer key. Rotation deactivates the old key.
CREATE FUNCTION public.register_reading_production_agent_reviewer(p_agent text, p_public_key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog' AS $$
DECLARE v_profile public.user_profiles%ROWTYPE; v_id uuid;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'authenticated' OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'administrator identity required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO v_profile FROM public.user_profiles WHERE user_id = auth.uid() FOR SHARE;
  IF v_profile.user_id IS NULL OR v_profile.status IS DISTINCT FROM 'active' OR
     v_profile.role IS DISTINCT FROM 'admin' OR public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'administrator identity required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_agent IS NULL OR p_agent NOT IN ('claude', 'codex') THEN
    RAISE EXCEPTION 'agent reviewer must be claude or codex' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.reading_production_agent_reviewer SET active = false WHERE agent = p_agent AND active;
  INSERT INTO public.reading_production_agent_reviewer(agent, public_key, registered_by)
    VALUES (p_agent, p_public_key, auth.uid()) RETURNING reviewer_id INTO v_id;
  RETURN v_id;
END $$;

-- The pipeline declares which agent produced a group, once, before any approval.
CREATE FUNCTION public.declare_reading_production_producer(p_group_id text, p_agent text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog' AS $$
DECLARE v_group public.reading_production_group%ROWTYPE;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO v_group FROM public.reading_production_group WHERE group_id = p_group_id FOR UPDATE;
  IF v_group.group_id IS NULL OR v_group.produced_by_agent IS NOT NULL OR v_group.approved_output_hash IS NOT NULL OR
     p_agent IS NULL OR p_agent NOT IN ('claude', 'codex') THEN
    RAISE EXCEPTION 'producer must be declared once, before approval' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.reading_production_group SET produced_by_agent = p_agent WHERE group_id = p_group_id;
END $$;

-- Independent approval by the other agent. The receipt is signed with the reviewer's registered key and binds
-- the snapshot, its evidence hash and the output hash; it must pass every criterion with a written rationale.
CREATE FUNCTION public.approve_reading_production_output_by_agent(p_snapshot_id uuid, p_snapshot_hash text,
  p_output_hash text, p_receipt jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog' AS $$
DECLARE v_group public.reading_production_group%ROWTYPE; v_snapshot public.reading_production_snapshot%ROWTYPE;
  v_reviewer public.reading_production_agent_reviewer%ROWTYPE; v_current jsonb; v_basis_hash text; v_receipt_hash text;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_output_hash IS NULL OR p_output_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'output hash invalid' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_reviewer FROM public.reading_production_agent_reviewer
    WHERE reviewer_id::text = p_receipt->>'reviewer_id' AND active FOR SHARE;
  IF v_reviewer.reviewer_id IS NULL OR NOT public._reading_verify_ed25519(p_receipt, v_reviewer.public_key) THEN
    RAISE EXCEPTION 'agent review receipt unverified' USING ERRCODE = 'check_violation';
  END IF;
  IF p_receipt->>'schema' IS DISTINCT FROM 'reading-production-agent-review/1' OR
     p_receipt->>'agent' IS DISTINCT FROM v_reviewer.agent OR
     p_receipt->>'snapshot_id' IS DISTINCT FROM p_snapshot_id::text OR
     p_receipt->>'snapshot_hash' IS DISTINCT FROM p_snapshot_hash OR
     p_receipt->>'output_hash' IS DISTINCT FROM p_output_hash OR
     p_receipt->>'verdict' IS DISTINCT FROM 'pass' OR
     jsonb_typeof(p_receipt->'criteria') IS DISTINCT FROM 'object' OR
     (SELECT count(*) FROM jsonb_each(p_receipt->'criteria')) = 0 OR
     EXISTS (SELECT 1 FROM jsonb_each(p_receipt->'criteria') WHERE value IS DISTINCT FROM 'true'::jsonb) OR
     length(btrim(COALESCE(p_receipt->>'rationale', ''))) < 40 THEN
    RAISE EXCEPTION 'agent review receipt does not pass this output' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_snapshot FROM public.reading_production_snapshot WHERE snapshot_id = p_snapshot_id FOR SHARE;
  IF v_snapshot.snapshot_id IS NULL OR v_snapshot.evidence_hash IS DISTINCT FROM p_snapshot_hash OR
     v_snapshot.output_hash IS DISTINCT FROM p_output_hash OR v_snapshot.finalized_at IS NULL OR
     v_snapshot.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'current rendered snapshot required' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_group FROM public.reading_production_group WHERE group_id = v_snapshot.group_id FOR UPDATE;
  IF v_group.group_id IS NULL OR v_group.group_revision IS DISTINCT FROM v_snapshot.group_revision OR
     v_group.approved_output_hash IS NOT NULL OR v_group.produced_by_agent IS NULL OR
     v_group.produced_by_agent = v_reviewer.agent OR v_group.registered_by = v_reviewer.reviewer_id THEN
    RAISE EXCEPTION 'independent current output approval required' USING ERRCODE = 'check_violation';
  END IF;
  v_current := public._reading_production_evidence(v_group.group_id);
  IF v_current IS DISTINCT FROM v_snapshot.evidence OR v_snapshot.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'approval evidence changed' USING ERRCODE = 'check_violation';
  END IF;
  v_basis_hash := encode(extensions.digest(convert_to((v_current - 'approved_output_hash' - 'approved_by')::text, 'UTF8'), 'sha256'), 'hex');
  v_receipt_hash := public._reading_json_hash(p_receipt);
  INSERT INTO public.reading_production_agent_review(snapshot_id, group_id, reviewer_id, producer_agent, receipt, receipt_hash)
    VALUES (p_snapshot_id, v_group.group_id, v_reviewer.reviewer_id, v_group.produced_by_agent, p_receipt, v_receipt_hash);
  UPDATE public.reading_production_group SET approved_output_hash = p_output_hash,
    approved_evidence_hash = v_basis_hash, approved_snapshot_id = NULL,
    approved_by = v_reviewer.reviewer_id, approved_at = clock_timestamp() WHERE group_id = v_group.group_id;
  RETURN jsonb_build_object('group_id', v_group.group_id, 'group_revision', v_group.group_revision,
    'approved_output_hash', p_output_hash, 'approved_evidence_hash', v_basis_hash,
    'reviewer_agent', v_reviewer.agent, 'receipt_hash', v_receipt_hash);
END $$;

REVOKE ALL ON FUNCTION public.register_reading_production_agent_reviewer(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.declare_reading_production_producer(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_reading_production_output_by_agent(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_reading_production_agent_reviewer(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.declare_reading_production_producer(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_reading_production_output_by_agent(uuid, text, text, jsonb) TO service_role;
REVOKE ALL ON public.reading_production_agent_reviewer, public.reading_production_agent_review FROM anon, authenticated;

COMMIT;
