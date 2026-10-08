-- supabase/migrations/20261002130000_csat_map_item_rate_ledger.sql
--
-- **문항 오답률을 「관측 원장」으로 — 관측 방식 · 수집 시각 · 순위를 함께 저장한다.** (가산: ADD COLUMN 만, 기존 열 불변)
-- 배경: EBSi 오답률은 평가원 공식값이 아니라 응답자 집계이고, 시험별 TOP15 만 제공된다(나머지는 미관측 — 0 · 평균 아님).
--       그래서 csat_items.official_error_rate 에 넣지 않고 출처별 관측 원장으로만 쓴다(.agent-plan.md §9).
--   metric                 관측 방식. 지금은 wrong_rate_top15(시험별 오답률 상위 15문항 — 이 밖의 문항은 미관측)
--   retrieved_at           수집일(재수집 때 갱신)
--   rank                   시험 안 순위(1 = 오답률 가장 높음)
--   unreported_choice_rate 선택지 비율 합이 100% 에 모자란 만큼(재정규화하지 않고 보존)
-- csat_map_item_rate 는 비어 있어(적재 전) NOT NULL 열을 바로 더할 수 있다.
--
-- 되돌리기: ALTER TABLE csat_map_item_rate DROP COLUMN metric, DROP COLUMN retrieved_at, DROP COLUMN rank, DROP COLUMN unreported_choice_rate;

ALTER TABLE public.csat_map_item_rate
  ADD COLUMN metric text NOT NULL DEFAULT 'wrong_rate_top15' CHECK (metric IN ('wrong_rate_top15')),
  ADD COLUMN retrieved_at date NOT NULL,
  ADD COLUMN rank smallint CHECK (rank BETWEEN 1 AND 45),
  ADD COLUMN unreported_choice_rate numeric CHECK (unreported_choice_rate >= 0 AND unreported_choice_rate <= 1);

-- 시드 RPC 갱신 — item_rates 가 새 열(metric · retrieved_at · rank · unreported)을 채운다. 권한은 그대로(service_role 전용).
CREATE OR REPLACE FUNCTION public.csat_map_seed(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n_edge_pending int;
  n_principle_pending int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('csat_map_seed'));

  INSERT INTO csat_map_source (id, citation, supports, status, url)
  SELECT x->>'id', x->>'citation', x->>'supports', x->>'status', x->>'url'
  FROM jsonb_array_elements(coalesce(p->'sources', '[]')) x
  ON CONFLICT (id) DO UPDATE SET citation = excluded.citation, supports = excluded.supports, status = excluded.status, url = excluded.url;

  -- 노드: 자기 참조 FK(axis · track)가 있어 영역 · 트랙 · 목표 먼저, 그 다음 나머지
  INSERT INTO csat_map_node (code, kind, name, axis, track, summary, why, signal, color_token, sort)
  SELECT x->>'code', x->>'kind', x->>'name', x->>'axis', x->>'track', x->>'summary', x->>'why', x->>'signal', x->>'color_token', coalesce((x->>'sort')::int, 0)
  FROM jsonb_array_elements(coalesce(p->'nodes', '[]')) x
  WHERE x->>'kind' IN ('goal', 'axis', 'track', 'principle')
  ON CONFLICT (code) DO UPDATE SET kind = excluded.kind, name = excluded.name, summary = excluded.summary, color_token = excluded.color_token, sort = excluded.sort;
  INSERT INTO csat_map_node (code, kind, name, axis, track, summary, why, signal, color_token, sort)
  SELECT x->>'code', x->>'kind', x->>'name', x->>'axis', x->>'track', x->>'summary', x->>'why', x->>'signal', x->>'color_token', coalesce((x->>'sort')::int, 0)
  FROM jsonb_array_elements(coalesce(p->'nodes', '[]')) x
  WHERE x->>'kind' = 'line'
  ON CONFLICT (code) DO UPDATE SET name = excluded.name, axis = excluded.axis, track = excluded.track, why = excluded.why, signal = excluded.signal, color_token = excluded.color_token, sort = excluded.sort;

  INSERT INTO csat_map_edge (from_code, to_code, kind, basis_claimed)
  SELECT x->>'from', x->>'to', x->>'kind', x->>'basis'
  FROM jsonb_array_elements(coalesce(p->'edges', '[]')) x
  ON CONFLICT (from_code, to_code, kind) DO UPDATE SET basis_claimed = excluded.basis_claimed;

  INSERT INTO csat_map_node_source (node_code, source_id)
  SELECT x->>'node', x->>'source' FROM jsonb_array_elements(coalesce(p->'node_sources', '[]')) x
  ON CONFLICT DO NOTHING;

  INSERT INTO csat_map_edge_source (edge_id, source_id)
  SELECT e.id, x->>'source'
  FROM jsonb_array_elements(coalesce(p->'edge_sources', '[]')) x
  JOIN csat_map_edge e ON e.from_code = x->>'from' AND e.to_code = x->>'to' AND e.kind = x->>'kind'
  ON CONFLICT DO NOTHING;

  INSERT INTO csat_map_task (id, line_code, ord, title, how, cadence, done_when, material, method_line)
  SELECT x->>'id', x->>'line', (x->>'ord')::smallint, x->>'title', x->>'how', x->>'cadence', x->>'done_when', x->>'material', x->>'method_line'
  FROM jsonb_array_elements(coalesce(p->'tasks', '[]')) x
  ON CONFLICT (id) DO UPDATE SET title = excluded.title, how = excluded.how, cadence = excluded.cadence, done_when = excluded.done_when,
    material = excluded.material, method_line = excluded.method_line;

  INSERT INTO csat_map_line_link (line_code, link_kind, ref)
  SELECT x->>'line', x->>'kind', x->>'ref' FROM jsonb_array_elements(coalesce(p->'line_links', '[]')) x
  ON CONFLICT DO NOTHING;

  -- 오답률 원장: 수집일(retrieved_at)이 없으면 NOT NULL 위반으로 시드 전체가 롤백된다(빈 출처 날짜를 조용히 넣지 않는다)
  INSERT INTO csat_map_item_rate (exam_id, no, error_rate, source_id, metric, retrieved_at, rank, unreported_choice_rate)
  SELECT x->>'exam', (x->>'no')::smallint, (x->>'rate')::numeric, x->>'source',
         coalesce(x->>'metric', 'wrong_rate_top15'), (x->>'retrieved_at')::date, (x->>'rank')::smallint, (x->>'unreported')::numeric
  FROM jsonb_array_elements(coalesce(p->'item_rates', '[]')) x
  ON CONFLICT (exam_id, no) DO UPDATE SET error_rate = excluded.error_rate, source_id = excluded.source_id, metric = excluded.metric,
    retrieved_at = excluded.retrieved_at, rank = excluded.rank, unreported_choice_rate = excluded.unreported_choice_rate;

  IF p ? 'settings' AND NOT EXISTS (SELECT 1 FROM csat_map_settings WHERE active) THEN
    INSERT INTO csat_map_settings (settings) VALUES (p->'settings');
  END IF;

  SELECT count(*) INTO n_edge_pending FROM csat_map_edge WHERE basis = 'pending';
  SELECT count(*) INTO n_principle_pending FROM csat_map_node WHERE kind = 'principle' AND evidence_status = 'pending';
  RETURN jsonb_build_object(
    'nodes', (SELECT count(*) FROM csat_map_node), 'edges', (SELECT count(*) FROM csat_map_edge),
    'edges_pending', n_edge_pending, 'principles_pending', n_principle_pending,
    'tasks', (SELECT count(*) FROM csat_map_task), 'sources', (SELECT count(*) FROM csat_map_source),
    'line_links', (SELECT count(*) FROM csat_map_line_link), 'item_rates', (SELECT count(*) FROM csat_map_item_rate));
END $$;

REVOKE ALL ON FUNCTION public.csat_map_seed(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.csat_map_seed(jsonb) TO service_role;
