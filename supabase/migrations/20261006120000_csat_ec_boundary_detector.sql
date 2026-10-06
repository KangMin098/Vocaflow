-- supabase/migrations/20261006120000_csat_ec_boundary_detector.sql
--
-- 오답 원인 Pilot G4 — 서버 결정론 경계 감지기(2026-10-06 · 초안 · 개발 DB 미적용). 승인 뒤 적용한다.
-- 설계: docs/csat-learner/codebook/BOUNDARY_DETECTOR_DESIGN.md(§0 사용자 확정 결정 2026-10-06 이 기준) · 되돌리기: scripts/db/rollback-20261006120000.sql
--
-- 원칙
--   · 감지기는 원인을 판정하지 않는다 — 출력은 경계 키(봉인 taxonomy 의 provisional 경계에서 읽는다) + probe 필요 여부뿐.
--     판정 · 원인 claim · 학습 지도 · 숙달 표에 쓰지 않는다. 경계 쌍 · probe 키 · 학생 범주 문자열을 본문에 쓰지 않는다(데이터에서 읽는다).
--   · 정오 무관 — 정오 · 고른 답 · 정답표 · 채점 결과를 읽지 않는다. 같은 증거면 정답 · 오답 문항의 결과 · 시점 · 오류가 같다.
--   · 범주 없음 · 「모름」(unsure) 이면 감지하지 않는다(insufficient_evidence). 자유서술 예외는 봉인된 경계 메타데이터
--     provenance.detector.free_text_patterns 가 있을 때만 쓰는 규칙 슬롯 — v0.1 seed 에는 없어 비활성이다.
--   · 증거 정정 · 추가 → 다시 평가. 경계가 사라지면 미응답 probe 는 취소(대기 목록에서 빠짐), 응답이 있으면 obsolete 표시(기록은 지우지 않는다).
--     경계가 다시 생기면 새 신호. 같은 증거 상태로 다시 돌리면 행이 늘지 않는다.
--   · 학습자 대기 probe 는 detector 출처 · 활성 신호만(ai_run · judgment 는 정답을 보는 경로라 대기 probe 가 되지 않는다).
--
-- 바뀌는 것
--   [표]       csat_ec_detector_run(감지 실행 기록 — 결과가 바뀔 때만 한 행) · csat_ec_boundary_signal_retraction(신호 취소 · obsolete — 덧붙이기 전용)
--   [함수]     csat_ec_detect_boundaries(내부) · csat_ec_process_evidence_detect(트리거) · csat_ec_detect_boundaries_rerun(service)
--   [트리거]   csat_ec_process_evidence_detect(과정 증거 AFTER INSERT · targeted_probe 제외) · csat_ec_capture_write_guard(신호 · detector 출처)
--              · 새 두 표 덧붙이기 전용(csat_ec_forbid_update)
--   [RPC 수정] csat_ec_my_pending_probes(detector 출처 · 취소 안 된 신호 · 수집이 끝나지 않은 기록만) · csat_ec_add_process_evidence(probe 응답은 활성 detector 신호가 요구할 때만)

begin;

-- ═══ 0. preflight — 바꾸려는 함수가 예상한 정의인가 ═══
do $$
begin
  if to_regclass('public.csat_ec_capture_session') is null or to_regclass('public.csat_ec_boundary_signal') is null then
    raise exception 'csat_ec 감지기: Reveal Gate(20261005170000) · Pilot 모델(20261005130000) 먼저';
  end if;
  if position('csat_ec_boundary_signal s' in pg_get_functiondef('public.csat_ec_my_pending_probes(uuid)'::regprocedure)) = 0
     or position('재시도 멱등' in pg_get_functiondef('public.csat_ec_add_process_evidence(uuid,smallint,text,jsonb,uuid)'::regprocedure)) = 0 then
    raise exception 'csat_ec 감지기: my_pending_probes · add_process_evidence 가 예상한 정의(20261005150000)가 아니다';
  end if;
end $$;

-- ═══ 1. 감지 실행 기록 ═══
-- 「경계 없음 · 증거 부족」도 남겨야 P/N 비교 · 시점 검증이 된다(신호 표는 양성만 담는다).
-- 같은 응답 · 같은 감지기 판의 직전 행과 (taxonomy · 결과 · 경계 · 입력 증거)가 같으면 새 행을 만들지 않는다(재실행 멱등).
create table public.csat_ec_detector_run (
  id                  bigint generated always as identity primary key,
  session_id          uuid not null,
  item_no             smallint not null,
  foreign key (session_id, item_no) references public.csat_dx_response(session_id, item_no) on delete cascade,
  detector_version    text not null check (detector_version ~ '^bd-[0-9]+\.[0-9]+\.[0-9]+$'),
  taxonomy_version    text references public.csat_ec_taxonomy_version(version) on delete restrict,
  trigger_evidence_id uuid,                                  -- 다시 돌림(rerun)이면 null
  input_evidence_ids  uuid[] not null default '{}',           -- 판단에 쓴 유효 과정 증거(정렬)
  result              text not null check (result in ('boundary', 'no_boundary', 'insufficient_evidence',
                                                      'skipped_no_capture', 'skipped_not_collecting', 'skipped_not_target', 'skipped_no_taxonomy')),
  boundary_keys       text[] not null default '{}',
  probe_boundary_key  text,                                  -- 이 실행 뒤 probe 를 요구하는 경계(문항당 하나)
  created_at          timestamptz not null default now(),
  check ((result = 'boundary') = (cardinality(boundary_keys) > 0)),
  check (probe_boundary_key is null or probe_boundary_key = any(boundary_keys))
);
create index csat_ec_detector_run_response on public.csat_ec_detector_run (session_id, item_no, detector_version, id desc);
create trigger csat_ec_detector_run_no_update before update on public.csat_ec_detector_run
  for each row execute function public.csat_ec_forbid_update();

-- ═══ 2. 신호 취소 · obsolete — 신호 행은 고치지 않고(덧붙이기 전용) 이 표에 한 줄을 더한다 ═══
-- cancelled = 경계가 사라졌고 probe 응답이 없었다(학습자 대기 목록에서 빠진다)
-- obsolete  = 경계가 사라졌지만 이미 응답(건너뜀 포함)이 있었다 — 응답 · 신호는 그대로 두고 최신 증거 기준으로 낡았다고만 표시
create table public.csat_ec_boundary_signal_retraction (
  signal_id  bigint primary key references public.csat_ec_boundary_signal(id) on delete cascade,
  reason     text not null check (reason in ('cancelled', 'obsolete')),
  run_id     bigint not null references public.csat_ec_detector_run(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index csat_ec_signal_retraction_run on public.csat_ec_boundary_signal_retraction (run_id);
create trigger csat_ec_signal_retraction_no_update before update on public.csat_ec_boundary_signal_retraction
  for each row execute function public.csat_ec_forbid_update();

do $$
declare t text;
begin
  foreach t in array array['csat_ec_detector_run', 'csat_ec_boundary_signal_retraction'] loop
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- 완료 · 종료 뒤 detector 출처 신호 거부(늦게 온 재실행 · 수동 신호 포함). AI · 판정 출처는 검수 파이프라인이라 막지 않는다
create trigger csat_ec_capture_write_guard before insert on public.csat_ec_boundary_signal
  for each row when (new.source = 'detector') execute function public.csat_ec_capture_write_guard();

-- ═══ 3. 감지기 ═══
-- 입력: capture 상태 · 대상(정오 무관 봉인값) · 허용 probe(config.probes) · 봉인 taxonomy 의 provisional 경계 · 경계 양쪽 코드의 student_group
--       · 이 응답의 유효 과정 증거(정정되지 않음 · 최신 증거와 같은 입력 해시 — 해시는 같다/다르다만 비교하고 풀지 않는다).
-- 읽지 않는 것: 문항 · 응답 · 정답 · 채점 · 스냅샷 · AI · 판정 표.
-- 실패: 무결성 위반에서만 예외(증거 저장과 함께 실패). 상태 · 대상 · 증거 부족은 결과 값으로 남기고 정상 반환.
create or replace function public.csat_ec_detect_boundaries(p_session uuid, p_item_no smallint, p_trigger uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  c_version constant text := 'bd-0.1.0';
  v_c        public.csat_ec_capture_session;
  v_result   text;
  v_hash     text;
  v_ids      uuid[] := '{}';
  v_interp   jsonb;
  v_group    text;
  v_keys     text[] := '{}';
  v_probe    text;
  v_last     public.csat_ec_detector_run;
  v_run      bigint;
  v_changes  boolean;
  v_pat      text;
  v_hit      boolean;
  b          record;
  s          record;
begin
  perform pg_advisory_xact_lock(hashtextextended('csat_ec_resp|' || p_session::text || '|' || p_item_no::text, 0));
  select * into v_c from public.csat_ec_capture_session where session_id = p_session;
  if v_c.session_id is null then v_result := 'skipped_no_capture';
  elsif v_c.status <> 'collecting' then v_result := 'skipped_not_collecting';
  elsif not (p_item_no = any(v_c.targets)) then v_result := 'skipped_not_target';
  elsif not exists (select 1 from public.csat_ec_taxonomy_version t where t.version = v_c.taxonomy_version and t.status = 'sealed') then
    v_result := 'skipped_no_taxonomy';
  end if;

  if v_result is null then
    -- 유효 과정 증거: 정정되지 않았고, 가장 최근 증거와 같은 입력 해시(그 뒤 문항 원문이 바뀌었으면 옛 증거는 빠진다)
    select p.item_input_hash into v_hash from public.csat_ec_process_evidence p
     where p.session_id = p_session and p.item_no = p_item_no and p.kind <> 'targeted_probe'
     order by p.created_at desc, p.id desc limit 1;
    select coalesce(array_agg(p.id order by p.id), '{}') into v_ids from public.csat_ec_process_evidence p
     where p.session_id = p_session and p.item_no = p_item_no and p.kind in ('interpretation', 'category', 'blocked_span', 'reason')
       and p.item_input_hash = v_hash
       and not exists (select 1 from public.csat_ec_process_evidence q where q.supersedes_id = p.id);
    select p.value into v_interp from public.csat_ec_process_evidence p
     where p.id = any(v_ids) and p.kind = 'interpretation' order by p.created_at desc, p.id desc limit 1;
    select p.value->>'group' into v_group from public.csat_ec_process_evidence p
     where p.id = any(v_ids) and p.kind = 'category' order by p.created_at desc, p.id desc limit 1;
    if v_group = 'unsure' then v_group := null; end if;   -- 「모름」 = 범주 없음

    for b in select x.boundary_key, x.probe_key, x.provenance,
                    array_remove(array[ca.student_group, cb.student_group], null) as groups
               from public.csat_ec_boundary x
               join public.csat_ec_code ca on ca.version = x.version and ca.code = x.code_a
               join public.csat_ec_code cb on cb.version = x.version and cb.code = x.code_b
              where x.version = v_c.taxonomy_version and x.status = 'provisional' and x.probe_key is not null
              order by x.boundary_key collate "C" loop
      if v_interp is null or coalesce(v_interp->>'state', 'answered') <> 'answered' then continue; end if;
      v_hit := false;
      if v_group is not null then
        v_hit := v_group = any(b.groups);
      elsif jsonb_typeof(b.provenance->'detector'->'free_text_patterns') = 'array' then
        -- 자유서술 예외 슬롯 — 봉인된 경계 메타데이터의 결정론 패턴만 쓴다(본문에 패턴 없음). 잘못된 패턴은 무시한다
        for v_pat in select jsonb_array_elements_text(b.provenance->'detector'->'free_text_patterns') loop
          begin
            if (v_interp->>'text') ~* v_pat then v_hit := true; exit; end if;
          exception when invalid_regular_expression then null;
          end;
        end loop;
      end if;
      if v_hit then v_keys := v_keys || b.boundary_key; end if;
    end loop;

    -- 증거 부족을 먼저 가른다(후보 경계 유무와 무관하게 범주 없음 · 모름은 insufficient_evidence)
    if v_interp is null or coalesce(v_interp->>'state', 'answered') <> 'answered' then
      v_result := 'insufficient_evidence';                                            -- 해석 글이 없으면 경계를 가를 재료가 없다
    elsif cardinality(v_keys) > 0 then v_result := 'boundary';
    elsif v_group is null then v_result := 'insufficient_evidence';                   -- 범주 없음 · 모름(자유서술 패턴도 없거나 안 맞음)
    else v_result := 'no_boundary';                                                   -- 범주를 골랐고 어느 경계에도 걸리지 않음(후보 0 포함)
    end if;
  end if;

  -- 정리할 신호: 이 판 감지기가 만든 활성 신호 중 지금 감지되지 않는 것. 새로 낼 신호: 감지됐는데 활성 신호가 없는 것.
  -- 상태 · 대상 때문에 건너뛴 실행(skipped_*)은 신호를 건드리지 않는다
  v_changes := false;
  if v_result not like 'skipped%' then
    v_changes := exists (select 1 from public.csat_ec_boundary_signal g
                          where g.session_id = p_session and g.item_no = p_item_no and g.source = 'detector' and g.detector_version = c_version
                            and not exists (select 1 from public.csat_ec_boundary_signal_retraction r where r.signal_id = g.id)
                            and not (g.taxonomy_version = v_c.taxonomy_version and g.boundary_key = any(v_keys)))
              or exists (select 1 from unnest(v_keys) k
                          where not exists (select 1 from public.csat_ec_boundary_signal g
                                             where g.session_id = p_session and g.item_no = p_item_no and g.source = 'detector'
                                               and g.detector_version = c_version and g.taxonomy_version = v_c.taxonomy_version and g.boundary_key = k
                                               and not exists (select 1 from public.csat_ec_boundary_signal_retraction r where r.signal_id = g.id)));
    -- probe 는 문항당 하나: 살아 남는 활성 신호가 이미 probe 를 요구하면 그것, 아니면 허용 probe 가 있는 첫 경계(사전순)
    select g.boundary_key into v_probe from public.csat_ec_boundary_signal g
     where g.session_id = p_session and g.item_no = p_item_no and g.source = 'detector' and g.detector_version = c_version
       and g.taxonomy_version = v_c.taxonomy_version and g.boundary_key = any(v_keys) and g.probe_required
       and not exists (select 1 from public.csat_ec_boundary_signal_retraction r where r.signal_id = g.id)
     limit 1;
    if v_probe is null then
      select x.boundary_key into v_probe from public.csat_ec_boundary x
       where x.version = v_c.taxonomy_version and x.boundary_key = any(v_keys)
         and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(v_c.config->'probes') = 'array' then v_c.config->'probes' else '[]'::jsonb end) cp
                      where cp->>'key' = x.probe_key)
       order by x.boundary_key collate "C" limit 1;
    end if;
  end if;

  -- 실행 기록 — 직전 행과 같은 상태이고 신호 변화가 없으면 새 행을 만들지 않는다
  select * into v_last from public.csat_ec_detector_run r
   where r.session_id = p_session and r.item_no = p_item_no and r.detector_version = c_version
   order by r.id desc limit 1;
  if v_changes or v_last.id is null
     or (v_last.taxonomy_version, v_last.result, v_last.boundary_keys, v_last.input_evidence_ids, v_last.probe_boundary_key)
        is distinct from (v_c.taxonomy_version, v_result, v_keys, v_ids, v_probe) then
    insert into public.csat_ec_detector_run (session_id, item_no, detector_version, taxonomy_version, trigger_evidence_id, input_evidence_ids,
                                             result, boundary_keys, probe_boundary_key)
    values (p_session, p_item_no, c_version, v_c.taxonomy_version, p_trigger, v_ids, v_result, v_keys, v_probe)
    returning id into v_run;
  end if;

  if v_changes then
    -- 사라진 경계: 응답이 있으면 obsolete, 없으면 cancelled
    for s in select g.id, x.probe_key from public.csat_ec_boundary_signal g
               join public.csat_ec_boundary x on x.version = g.taxonomy_version and x.boundary_key = g.boundary_key
              where g.session_id = p_session and g.item_no = p_item_no and g.source = 'detector' and g.detector_version = c_version
                and not exists (select 1 from public.csat_ec_boundary_signal_retraction r where r.signal_id = g.id)
                and not (g.taxonomy_version = v_c.taxonomy_version and g.boundary_key = any(v_keys)) loop
      insert into public.csat_ec_boundary_signal_retraction (signal_id, reason, run_id)
      values (s.id,
              case when exists (select 1 from public.csat_ec_process_evidence p
                                 where p.session_id = p_session and p.item_no = p_item_no and p.kind = 'targeted_probe'
                                   and p.value->>'probe_key' = s.probe_key) then 'obsolete' else 'cancelled' end,
              v_run);
    end loop;
    -- 새로 생긴 경계(처음이거나 · 취소 뒤 다시 생김)
    insert into public.csat_ec_boundary_signal (session_id, item_no, taxonomy_version, boundary_key, boundary_status, source, detector_version, probe_required, evidence_ids)
    select p_session, p_item_no, v_c.taxonomy_version, k, x.status, 'detector', c_version, coalesce(k = v_probe, false), v_ids
      from unnest(v_keys) k
      join public.csat_ec_boundary x on x.version = v_c.taxonomy_version and x.boundary_key = k
     where not exists (select 1 from public.csat_ec_boundary_signal g
                        where g.session_id = p_session and g.item_no = p_item_no and g.source = 'detector'
                          and g.detector_version = c_version and g.taxonomy_version = v_c.taxonomy_version and g.boundary_key = k
                          and not exists (select 1 from public.csat_ec_boundary_signal_retraction r where r.signal_id = g.id));
  end if;
  return v_result;
end $$;

-- 과정 증거가 들어오면(새 증거 · 정정) 같은 트랜잭션에서 다시 평가한다. probe 응답은 감지 입력이 아니다
create or replace function public.csat_ec_process_evidence_detect() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.csat_ec_detect_boundaries(new.session_id, new.item_no, new.id);
  return null;
end $$;
create trigger csat_ec_process_evidence_detect after insert on public.csat_ec_process_evidence
  for each row when (new.kind <> 'targeted_probe') execute function public.csat_ec_process_evidence_detect();

-- (서비스) 다시 돌림 — 수집 중(collecting)인 응답만(끝난 수집의 결과는 바꾸지 않는다). 감지기 판 올림 · 장애 복구용
create or replace function public.csat_ec_detect_boundaries_rerun(p_session uuid, p_item_no smallint)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.csat_ec_capture_session c where c.session_id = p_session and c.status = 'collecting') then
    raise exception 'csat_ec: 수집 중인 기록만 다시 감지한다';
  end if;
  return public.csat_ec_detect_boundaries(p_session, p_item_no, null);
end $$;

-- ═══ 4. 학습자 대기 probe — detector 출처 · 취소/obsolete 안 된 신호만 ═══
create or replace function public.csat_ec_my_pending_probes(p_session uuid)
returns table (item_no smallint, taxonomy_version text, boundary_key text, probe_key text)
language sql stable security definer set search_path = '' as $$
  select distinct s.item_no, s.taxonomy_version, s.boundary_key, b.probe_key
    from public.csat_ec_boundary_signal s
    join public.csat_dx_session ss on ss.id = s.session_id and ss.user_id = (select auth.uid())
    join public.csat_ec_boundary b on b.version = s.taxonomy_version and b.boundary_key = s.boundary_key
   where s.session_id = p_session and s.source = 'detector' and s.probe_required and b.probe_key is not null
     and not exists (select 1 from public.csat_ec_boundary_signal_retraction r where r.signal_id = s.id)
     -- 수집이 끝난 기록은 묻지 않는다(미응답은 NOT_ASKED 로 남는다 — 완료 뒤에는 응답을 저장할 수도 없다)
     and not exists (select 1 from public.csat_ec_capture_session c where c.session_id = s.session_id and c.status in ('completed', 'closed_incomplete'))
     and not exists (select 1 from public.csat_ec_process_evidence p
                      where p.session_id = s.session_id and p.item_no = s.item_no and p.kind = 'targeted_probe'
                        and p.value->>'probe_key' = b.probe_key)
$$;

-- ═══ 5. probe 응답 — 활성 detector 신호가 요구한 것만(본문은 20261005150000 과 같고 신호 조건만 좁혔다) ═══
create or replace function public.csat_ec_add_process_evidence(p_session uuid, p_item_no smallint, p_kind text, p_value jsonb,
                                                               p_supersedes uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_b public.csat_ec_boundary;
begin
  if not exists (select 1 from public.csat_dx_session s join public.csat_dx_response r on r.session_id = s.id
                  where s.id = p_session and r.item_no = p_item_no and s.user_id = (select auth.uid())) then
    raise exception 'csat_ec: 자기 응답에만 남길 수 있다';
  end if;
  perform 1 from public.csat_dx_session where id = p_session for share;
  perform pg_advisory_xact_lock(hashtextextended('csat_ec_resp|' || p_session::text || '|' || p_item_no::text, 0));
  if exists (select 1 from public.csat_ec_review_round r
              where r.status in ('blind_review', 'reveal', 'adjudication')
                and r.targets @> jsonb_build_array(jsonb_build_object('session_id', p_session, 'item_no', p_item_no))) then
    raise exception 'csat_ec: 검수 중인 문항이라 바꿀 수 없다';
  end if;
  if p_kind = 'blocked_span' then
    if p_value->>'item_id' is distinct from (select r.item_id from public.csat_dx_response r where r.session_id = p_session and r.item_no = p_item_no) then
      raise exception 'csat_ec: 표시한 위치가 이 응답의 문항이 아니다';
    end if;
    if not exists (
        select 1 from public.csat_items i
         where i.id = p_value->>'item_id'
           and length(coalesce(case p_value->>'part' when 'passage' then i.passage when 'stem' then i.stem
                                     else i.choices->>(((p_value->>'option')::int) - 1) end, '')) > 0
           and (p_value->>'end')::int <=
                length(case p_value->>'part' when 'passage' then i.passage when 'stem' then i.stem
                            else i.choices->>(((p_value->>'option')::int) - 1) end)) then
      raise exception 'csat_ec: 표시한 위치가 문항 원문 범위 밖이다';
    end if;
  end if;
  if p_kind = 'targeted_probe' then
    select b.* into v_b from public.csat_ec_boundary b join public.csat_ec_taxonomy_version t on t.version = b.version and t.status = 'sealed'
     where b.version = p_value->>'taxonomy_version' and b.boundary_key = p_value->>'boundary_key';
    if v_b.boundary_key is null or v_b.status <> 'provisional' or v_b.probe_key is distinct from p_value->>'probe_key' then
      raise exception 'csat_ec: 사전에 정의된 미해결 경계의 probe 가 아니다';
    end if;
    -- detector 출처 · 취소/obsolete 되지 않은 신호만(AI · 판정 출처 신호로는 학습자에게 질문하지 않는다)
    if not exists (select 1 from public.csat_ec_boundary_signal s
                    where s.session_id = p_session and s.item_no = p_item_no and s.taxonomy_version = v_b.version
                      and s.boundary_key = v_b.boundary_key and s.probe_required and s.source = 'detector'
                      and not exists (select 1 from public.csat_ec_boundary_signal_retraction r where r.signal_id = s.id)) then
      raise exception 'csat_ec: 이 응답에 요구된 probe 가 아니다';
    end if;
  end if;
  -- 재시도 멱등 — 정정이 아니고 같은 종류 · 같은 값의 유효 행(지금 문항 입력 · 정정되지 않음)이 있으면 그 행
  if p_supersedes is null then
    select p.id into v_id from public.csat_ec_process_evidence p
     where p.session_id = p_session and p.item_no = p_item_no and p.kind = p_kind and p.value = p_value
       and p.item_input_hash = public.csat_ec_item_input_hash(p_session, p_item_no)
       and not exists (select 1 from public.csat_ec_process_evidence q where q.supersedes_id = p.id)
     order by p.created_at, p.id limit 1;
    if v_id is not null then return v_id; end if;
  end if;
  insert into public.csat_ec_process_evidence (session_id, item_no, user_id, kind, value, item_input_hash, supersedes_id)
  values (p_session, p_item_no, (select auth.uid()), p_kind, p_value, public.csat_ec_item_input_hash(p_session, p_item_no), p_supersedes)
  returning id into v_id;
  return v_id;
end $$;

-- ═══ 6. 권한 — 기본 EXECUTE 없음(G2). manifest: scripts/db/function-exec-manifest.json ═══
revoke all on function public.csat_ec_detect_boundaries(uuid,smallint,uuid) from public, anon, authenticated, service_role;            -- OWNER_ONLY
revoke all on function public.csat_ec_process_evidence_detect() from public, anon, authenticated, service_role;                       -- TRIGGER_ONLY
revoke all on function public.csat_ec_detect_boundaries_rerun(uuid,smallint) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_detect_boundaries_rerun(uuid,smallint) to service_role;                                     -- SERVICE_ONLY
revoke all on function public.csat_ec_my_pending_probes(uuid) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_my_pending_probes(uuid) to authenticated;                                                    -- AUTH_SELF_RPC
revoke all on function public.csat_ec_add_process_evidence(uuid,smallint,text,jsonb,uuid) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_add_process_evidence(uuid,smallint,text,jsonb,uuid) to authenticated;                       -- AUTH_SELF_RPC

commit;
