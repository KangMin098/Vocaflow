-- supabase/migrations/20261002120000_csat_map.sql
--
-- **내 진단 「학습 지도」(목표 → 영역 → 라인 → 원리 → 트랙) 저장소.** 기존 테이블은 바꾸지 않는다(새 테이블만).
-- 계획 정본: .agent-plan.md §1 · 목적: .agent-goal.md. 시드는 csat_map_seed(jsonb) 한 번 호출(원자적 · 재실행 안전).
--
--   · 보류는 **저장**한다 — 출처 0건인 연결선 · 노드는 basis / evidence_status = 'pending'.
--     트리거가 파생값을 항상 재계산하므로 직접 써도 덮인다(출처 연결 변경 · 연결 이동 모두 OLD·NEW 부모를 id 순으로 잠그고 재계산).
--   · 학습자는 읽기만(본인 목표 · 과제 완료는 서버 API 가 service role 로 쓴다) — 우회 쓰기 경로가 없다. DB 제약은 그래도 건다.
--   · 목표율 · 성취율은 저장하지 않는다(화면을 열 때 계산).
--
-- 되돌리기: DROP TABLE csat_map_task_done, csat_map_goal, csat_map_item_rate, csat_map_line_link, csat_map_task,
--           csat_map_edge_source, csat_map_node_source, csat_map_edge, csat_map_node, csat_map_source, csat_map_settings CASCADE;
--           DROP FUNCTION csat_map_seed(jsonb), csat_map_recompute_edge(), csat_map_recompute_node(),
--                         csat_map_edge_source_touch(), csat_map_node_source_touch();

-- ── 1. 출처 ──────────────────────────────────────────────────────────────────────
CREATE TABLE public.csat_map_source (
  id         text PRIMARY KEY,
  citation   text NOT NULL,                         -- 서지 정보(지어내지 않는다 — 모르면 모른다고 적는다)
  supports   text NOT NULL,                         -- 뒷받침하는 내용
  status     text NOT NULL CHECK (status IN ('verified', 'needs_review')),
  url        text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 2. 노드 · 연결선 ───────────────────────────────────────────────────────────────
CREATE TABLE public.csat_map_node (
  code            text PRIMARY KEY,                 -- GOAL · A..J(영역) · A1..J5(라인) · P1..P8(원리) · T1..T3(트랙)
  kind            text NOT NULL CHECK (kind IN ('goal', 'axis', 'line', 'principle', 'track')),
  name            text NOT NULL,
  axis            text REFERENCES public.csat_map_node (code),   -- line 만
  track           text REFERENCES public.csat_map_node (code),   -- line 만
  summary         text,                              -- 영역 · 원리 · 트랙의 설명
  why             text,                              -- line: 왜 이렇게 분류했나
  signal          text,                              -- line: 진단에서 보는 지표
  color_token     text,
  sort            integer NOT NULL DEFAULT 0,
  evidence_status text NOT NULL DEFAULT 'pending' CHECK (evidence_status IN ('sourced', 'pending'))
);

CREATE TABLE public.csat_map_edge (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  from_code     text NOT NULL REFERENCES public.csat_map_node (code),
  to_code       text NOT NULL REFERENCES public.csat_map_node (code),
  kind          text NOT NULL CHECK (kind IN ('goal', 'member', 'reason', 'route')),
  basis_claimed text NOT NULL CHECK (basis_claimed IN ('direct', 'inferred', 'pending')),   -- 첨부 원값
  basis         text NOT NULL DEFAULT 'pending' CHECK (basis IN ('direct', 'inferred', 'pending')),  -- 저장된 유효값(트리거가 맞춘다)
  UNIQUE (from_code, to_code, kind)
);

CREATE TABLE public.csat_map_node_source (
  node_code text NOT NULL REFERENCES public.csat_map_node (code) ON DELETE CASCADE,
  source_id text NOT NULL REFERENCES public.csat_map_source (id),
  PRIMARY KEY (node_code, source_id)
);

CREATE TABLE public.csat_map_edge_source (
  edge_id   bigint NOT NULL REFERENCES public.csat_map_edge (id) ON DELETE CASCADE,
  source_id text NOT NULL REFERENCES public.csat_map_source (id),
  PRIMARY KEY (edge_id, source_id)
);

-- ── 3. 과제 · 라인 연결 · 문항 오답률 ────────────────────────────────────────────────
CREATE TABLE public.csat_map_task (
  id          text PRIMARY KEY,                     -- 'A1-1'
  line_code   text NOT NULL REFERENCES public.csat_map_node (code),
  ord         smallint NOT NULL CHECK (ord >= 1),
  title       text NOT NULL,
  how         text NOT NULL,
  cadence     text NOT NULL,
  done_when   text NOT NULL,
  material    text NOT NULL CHECK (material IN ('past', 'core')),   -- 기출 / 본질
  method_line text REFERENCES public.csat_map_node (code),
  UNIQUE (line_code, ord)
);

-- 라인 ↔ 문항 · 신호 대응. A = attribute(코드 그대로) · B = type / item_no · C = trap_family · D = habit.
CREATE TABLE public.csat_map_line_link (
  line_code text NOT NULL REFERENCES public.csat_map_node (code),
  link_kind text NOT NULL CHECK (link_kind IN ('attribute', 'type', 'item_no', 'trap_family', 'habit')),
  ref       text NOT NULL,
  PRIMARY KEY (line_code, link_kind, ref)
);

-- 문항 오답률(지도 목표율 계산 전용 — csat_items.official_error_rate 는 건드리지 않는다). 0~1 비율.
CREATE TABLE public.csat_map_item_rate (
  exam_id    text NOT NULL REFERENCES public.csat_exams (id),
  no         smallint NOT NULL CHECK (no BETWEEN 1 AND 45),
  error_rate numeric NOT NULL CHECK (error_rate >= 0 AND error_rate <= 1),
  source_id  text NOT NULL REFERENCES public.csat_map_source (id),
  PRIMARY KEY (exam_id, no)
);

-- ── 4. 학습자 상태 · 설정 ────────────────────────────────────────────────────────────
CREATE TABLE public.csat_map_goal (
  user_id      uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  target_score smallint NOT NULL CHECK (target_score BETWEEN 0 AND 100),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.csat_map_task_done (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  task_id text NOT NULL REFERENCES public.csat_map_task (id) ON DELETE CASCADE,
  done_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, task_id)
);

-- 지도 설정(기존 csat_dx_settings 는 건드리지 않는다). 활성 1행.
CREATE TABLE public.csat_map_settings (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  settings   jsonb NOT NULL,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX csat_map_settings_one_active ON public.csat_map_settings (active) WHERE active;

-- ── 5. 보류 저장 트리거 ──────────────────────────────────────────────────────────────
-- ⓐ 연결선 자신의 BEFORE 트리거: 직접 대입(재조회 없음). 출처 ≥1 → basis_claimed, 0 → pending. basis 를 직접 써도 덮는다.
CREATE OR REPLACE FUNCTION public.csat_map_recompute_edge() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.basis := CASE WHEN EXISTS (SELECT 1 FROM csat_map_edge_source s WHERE s.edge_id = NEW.id)
                    THEN NEW.basis_claimed ELSE 'pending' END;
  RETURN NEW;
END $$;
CREATE TRIGGER csat_map_edge_basis BEFORE INSERT OR UPDATE ON public.csat_map_edge
  FOR EACH ROW EXECUTE FUNCTION public.csat_map_recompute_edge();

CREATE OR REPLACE FUNCTION public.csat_map_recompute_node() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.evidence_status := CASE WHEN EXISTS (SELECT 1 FROM csat_map_node_source s WHERE s.node_code = NEW.code)
                              THEN 'sourced' ELSE 'pending' END;
  RETURN NEW;
END $$;
CREATE TRIGGER csat_map_node_evidence BEFORE INSERT OR UPDATE ON public.csat_map_node
  FOR EACH ROW EXECUTE FUNCTION public.csat_map_recompute_node();

-- ⓑ 출처 연결 변경 AFTER 트리거: OLD · NEW 부모를 **식별자 오름차순으로** 잠그고(교착 방지 — 외래키 검사의 KEY SHARE 를 올리지 않도록 FOR NO KEY UPDATE) UPDATE 로 ⓐ 를 다시 태운다.
CREATE OR REPLACE FUNCTION public.csat_map_edge_source_touch() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE ids bigint[];
BEGIN
  ids := ARRAY(SELECT DISTINCT x FROM unnest(ARRAY[
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.edge_id END,
    CASE WHEN TG_OP IN ('UPDATE', 'INSERT') THEN NEW.edge_id END]) x WHERE x IS NOT NULL ORDER BY x);
  PERFORM 1 FROM csat_map_edge WHERE id = ANY (ids) ORDER BY id FOR NO KEY UPDATE;
  UPDATE csat_map_edge SET basis_claimed = basis_claimed WHERE id = ANY (ids);
  RETURN NULL;
END $$;
CREATE TRIGGER csat_map_edge_source_touch AFTER INSERT OR UPDATE OR DELETE ON public.csat_map_edge_source
  FOR EACH ROW EXECUTE FUNCTION public.csat_map_edge_source_touch();

CREATE OR REPLACE FUNCTION public.csat_map_node_source_touch() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE codes text[];
BEGIN
  codes := ARRAY(SELECT DISTINCT x FROM unnest(ARRAY[
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.node_code END,
    CASE WHEN TG_OP IN ('UPDATE', 'INSERT') THEN NEW.node_code END]) x WHERE x IS NOT NULL ORDER BY x);
  PERFORM 1 FROM csat_map_node WHERE code = ANY (codes) ORDER BY code FOR NO KEY UPDATE;
  UPDATE csat_map_node SET name = name WHERE code = ANY (codes);
  RETURN NULL;
END $$;
CREATE TRIGGER csat_map_node_source_touch AFTER INSERT OR UPDATE OR DELETE ON public.csat_map_node_source
  FOR EACH ROW EXECUTE FUNCTION public.csat_map_node_source_touch();

REVOKE EXECUTE ON FUNCTION public.csat_map_recompute_edge(), public.csat_map_recompute_node(),
  public.csat_map_edge_source_touch(), public.csat_map_node_source_touch() FROM PUBLIC, anon, authenticated;

-- ── 6. 권한 — 참조 테이블은 읽기만, 본인 상태는 본인 행 읽기만(쓰기는 서버 API) ───────────────
ALTER TABLE public.csat_map_source      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_map_node        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_map_edge        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_map_node_source ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_map_edge_source ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_map_task        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_map_line_link   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_map_item_rate   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_map_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_map_goal        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_map_task_done   ENABLE ROW LEVEL SECURITY;

CREATE POLICY csat_map_source_read      ON public.csat_map_source      FOR SELECT TO authenticated USING (true);
CREATE POLICY csat_map_node_read        ON public.csat_map_node        FOR SELECT TO authenticated USING (true);
CREATE POLICY csat_map_edge_read        ON public.csat_map_edge        FOR SELECT TO authenticated USING (true);
CREATE POLICY csat_map_node_source_read ON public.csat_map_node_source FOR SELECT TO authenticated USING (true);
CREATE POLICY csat_map_edge_source_read ON public.csat_map_edge_source FOR SELECT TO authenticated USING (true);
CREATE POLICY csat_map_task_read        ON public.csat_map_task        FOR SELECT TO authenticated USING (true);
CREATE POLICY csat_map_line_link_read   ON public.csat_map_line_link   FOR SELECT TO authenticated USING (true);
CREATE POLICY csat_map_item_rate_read   ON public.csat_map_item_rate   FOR SELECT TO authenticated USING (true);
CREATE POLICY csat_map_settings_read    ON public.csat_map_settings    FOR SELECT TO authenticated USING (true);
CREATE POLICY csat_map_goal_own_select      ON public.csat_map_goal      FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY csat_map_task_done_own_select ON public.csat_map_task_done FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.csat_map_source, public.csat_map_node, public.csat_map_edge, public.csat_map_node_source,
  public.csat_map_edge_source, public.csat_map_task, public.csat_map_line_link, public.csat_map_item_rate,
  public.csat_map_settings, public.csat_map_goal, public.csat_map_task_done FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.csat_map_source, public.csat_map_node, public.csat_map_edge, public.csat_map_node_source,
  public.csat_map_edge_source, public.csat_map_task, public.csat_map_line_link, public.csat_map_item_rate,
  public.csat_map_settings, public.csat_map_goal, public.csat_map_task_done TO authenticated;

-- ── 7. 시드 — service role 전용 RPC 하나(함수 하나 = 트랜잭션 하나: 직렬화 · 실패 시 전체 롤백) ─────────
-- p = { sources[], nodes[], edges[], node_sources[], edge_sources[], tasks[], line_links[], item_rates[], settings }
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

  INSERT INTO csat_map_item_rate (exam_id, no, error_rate, source_id)
  SELECT x->>'exam', (x->>'no')::smallint, (x->>'rate')::numeric, x->>'source'
  FROM jsonb_array_elements(coalesce(p->'item_rates', '[]')) x
  ON CONFLICT (exam_id, no) DO UPDATE SET error_rate = excluded.error_rate, source_id = excluded.source_id;

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
