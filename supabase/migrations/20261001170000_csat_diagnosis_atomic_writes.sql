-- supabase/migrations/20261001170000_csat_diagnosis_atomic_writes.sql
--
-- **영어 진단 관리자 쓰기 두 가지를 한 트랜잭션으로.** (PR #135 Codex 리뷰 P2)
--
-- ① 설정 버전 전환 — 예전에는 「이전 활성 끄기 → 새 버전 켜기」가 요청 두 번이었다. 그 사이에 들어온
--    진단 요청은 활성 설정이 없어 실패했고, 중간에 끊기면 진단이 계속 멈춰 있었다.
--    → 표를 잠그고 한 함수 안에서 끄고·넣는다. 동시에 두 관리자가 저장해도 차례로 처리된다.
-- ② 문항 검수 저장 — 역량 upsert(검수 표지 reviewed_at 포함)가 먼저 커밋되고 함정 쓰기가 실패하면,
--    화면은 실패라 말하는데 「검수 완료」로 세어져 진단 반영 게이트를 통과할 수 있었다.
--    → 문항 메타 · 역량 9개 · 선지 함정을 한 함수에서 쓴다. 하나라도 실패하면 전부 되돌아간다.
--
-- 둘 다 service_role 전용(관리자 액션이 requireAdmin 뒤에서 부른다).
-- 되돌리기: DROP FUNCTION public.csat_dx_activate_settings(jsonb, text, uuid);
--           DROP FUNCTION public.csat_dx_save_item_tagging(text, jsonb, jsonb, numeric, boolean, uuid);

CREATE OR REPLACE FUNCTION public.csat_dx_activate_settings(p_settings jsonb, p_note text, p_by uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
BEGIN
  LOCK TABLE csat_dx_settings IN SHARE ROW EXCLUSIVE MODE;
  UPDATE csat_dx_settings SET active = false WHERE active;
  INSERT INTO csat_dx_settings (settings, active, note, created_by)
  VALUES (p_settings, true, nullif(btrim(p_note), ''), p_by)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.csat_dx_activate_settings(jsonb, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.csat_dx_activate_settings(jsonb, text, uuid) TO service_role;

-- p_weights: {"A1":0..2, …, "A9":0..2} 9개 전부 · p_traps: {"1":"라벨"|null, …, "5":…} (정답 선지는 함수가 비운다)
CREATE OR REPLACE FUNCTION public.csat_dx_save_item_tagging(
  p_item_id text, p_weights jsonb, p_traps jsonb, p_error_rate numeric, p_ebs boolean, p_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_correct int[];
  v_now timestamptz := now();
BEGIN
  SELECT coalesce(nullif(answers, '{}'), ARRAY[answer]) INTO v_correct FROM csat_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '없는 문항: %', p_item_id;
  END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p_weights) k WHERE k ~ '^A[1-9]$') <> 9 THEN
    RAISE EXCEPTION '역량 가중치는 A1~A9 아홉 개 전부 필요하다';
  END IF;

  UPDATE csat_items SET official_error_rate = p_error_rate, ebs_linked = p_ebs WHERE id = p_item_id;

  INSERT INTO csat_dx_item_attribute (item_id, attribute_code, weight, source, reviewed_at, reviewed_by)
  SELECT p_item_id, w.key, (w.value #>> '{}')::smallint, 'admin', v_now, p_by
    FROM jsonb_each(p_weights) w
   WHERE w.key ~ '^A[1-9]$'
  ON CONFLICT (item_id, attribute_code)
  DO UPDATE SET weight = EXCLUDED.weight, source = 'admin', reviewed_at = v_now, reviewed_by = p_by;

  DELETE FROM csat_dx_option_trap
   WHERE item_id = p_item_id
     AND (option_no = ANY (v_correct) OR coalesce(p_traps ->> option_no::text, '') = '');

  INSERT INTO csat_dx_option_trap (item_id, option_no, trap_key, source, reviewed_at, reviewed_by)
  SELECT p_item_id, n, p_traps ->> n::text, 'admin', v_now, p_by
    FROM generate_series(1, 5) n
   WHERE NOT (n = ANY (v_correct)) AND coalesce(p_traps ->> n::text, '') <> ''
  ON CONFLICT (item_id, option_no)
  DO UPDATE SET trap_key = EXCLUDED.trap_key, source = 'admin', reviewed_at = v_now, reviewed_by = p_by;
END;
$$;
REVOKE ALL ON FUNCTION public.csat_dx_save_item_tagging(text, jsonb, jsonb, numeric, boolean, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.csat_dx_save_item_tagging(text, jsonb, jsonb, numeric, boolean, uuid) TO service_role;
