-- supabase/migrations/20261004030000_csat_blind_protocol_holds.sql
-- Pending explicit approval. Keep disqualified blind runs as audit history.
-- A followup source `blind-invalid:<run UUID>` is a permanent evidence exclusion,
-- independent of the followup's workflow status. No rows or columns are deleted.
begin;

create or replace function public.csat_review_sources_overlap(p_left text, p_right text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select l.id = r.id
    or (l.exam_id = r.exam_id and ((l.no in (41,42) and r.no in (41,42)) or (l.no in (43,44,45) and r.no in (43,44,45))))
    or (nullif(btrim(l.passage),'') is not null and l.passage = r.passage)
    from csat_items l join csat_items r on r.id = p_right where l.id = p_left), false)
$$;

create or replace function public.csat_blind_source_unseen(p_item text, p_actor text, p_before timestamptz) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from csat_review_runs r
    where r.role = 'reviewer' and r.agent_run = p_actor and r.revealed_at < p_before
      and csat_review_sources_overlap(p_item, r.item_id))
    and not exists (select 1 from csat_review_followups f join csat_review_runs bad on f.source = 'blind-invalid:' || bad.id::text
      where bad.agent_run = p_actor and bad.created_at <= p_before and csat_review_sources_overlap(p_item,bad.item_id))
$$;

create or replace function public.csat_blind_protocol_valid(p_run uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select r.kind = 'blind' and r.role = 'reviewer' and r.solve_committed_at is not null
    and exists (select 1 from csat_items i where i.id = r.item_id and i.type_id is distinct from 'R-CHART')
    and not exists (select 1 from csat_review_followups f join csat_review_runs bad on f.source = 'blind-invalid:' || bad.id::text
      where bad.id = r.id or (bad.agent_run = r.agent_run and bad.created_at <= r.created_at and csat_review_sources_overlap(r.item_id,bad.item_id)))
    and not exists (select 1 from csat_review_runs x where x.role = 'reviewer' and x.agent_run = r.agent_run
      and x.revealed_at < r.solve_committed_at and csat_review_sources_overlap(r.item_id,x.item_id))
    from csat_review_runs r where r.id = p_run), false)
$$;

create or replace function public.csat_review_run_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare p csat_review_runs;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.agent_run,0));
  if new.role = 'reviewer' and new.kind = 'blind' and not csat_blind_source_unseen(new.item_id,new.agent_run,clock_timestamp()) then
    raise exception '이미 공개되었거나 제외된 공유 원문을 같은 실행에서 새 blind로 대체할 수 없다';
  end if;
  if new.kind = 'rereview' then
    select * into p from csat_review_runs where id = new.parent_run_id;
    if p.id is null or p.kind <> 'blind' then raise exception '재검수는 blind 실행에만 잇는다'; end if;
    if p.item_id <> new.item_id or p.persona is distinct from new.persona then raise exception '재검수 parent 는 같은 문항·같은 페르소나여야 한다'; end if;
    if p.solve_committed_at is null or p.revealed_at is null or not csat_blind_protocol_valid(p.id) then
      raise exception '재검수 parent 의 독립 풀이 증거가 유효하지 않다';
    end if;
    if p.solve_input_hash is distinct from csat_item_input_hash(new.item_id) or p.solve_answer_hash is distinct from csat_item_answer_hash(new.item_id) then
      raise exception '재검수 parent 의 풀이가 지금 원문·정답과 맞지 않는다 — 새 독립 검수 컨텍스트가 필요하다';
    end if;
  end if;
  return new;
end $$;

create or replace function public.csat_review_solve(p_run uuid, p_answer smallint, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare r csat_review_runs;
begin
  select * into r from csat_review_runs where id = p_run;
  if r.id is null or r.role <> 'reviewer' then raise exception '검수 실행이 아니다: %', p_run; end if;
  perform pg_advisory_xact_lock(hashtextextended(r.agent_run,0));
  select * into r from csat_review_runs where id = p_run for update;
  if r.kind <> 'blind' then raise exception '재검수 실행은 풀이를 확정하지 않는다: %', p_run; end if;
  if r.solve_committed_at is not null then raise exception '독립 풀이는 한 번만 확정한다: %', p_run; end if;
  if not csat_blind_source_unseen(r.item_id,r.agent_run,clock_timestamp()) then raise exception '공유 원문 분석을 보기 전에 풀이를 확정해야 한다: %', p_run; end if;
  update csat_review_runs set solve_answer = p_answer, solve_note = p_note,
    solve_input_hash = csat_item_input_hash(r.item_id), solve_answer_hash = csat_item_answer_hash(r.item_id),
    solve_committed_at = clock_timestamp() where id = p_run;
end $$;

create or replace function public.csat_rereview_parent(p_item text, p_persona text, p_analyst_run text) returns uuid
language sql stable security definer set search_path = public as $$
  select run.id from csat_review_runs run
   where run.item_id = p_item and run.persona = p_persona and run.kind = 'blind' and run.role = 'reviewer'
     and run.solve_committed_at is not null and run.revealed_at is not null and run.solve_committed_at < run.revealed_at
     and run.solve_input_hash = csat_item_input_hash(p_item) and run.solve_answer_hash = csat_item_answer_hash(p_item)
     and run.agent_run is distinct from p_analyst_run
     and not exists (select 1 from csat_review_followups f where f.source = 'blind-invalid:' || run.id::text)
     and csat_blind_protocol_valid(run.id)
   order by run.solve_committed_at desc limit 1
$$;

create or replace function public.csat_review_reveal(p_run uuid)
returns table(answer smallint, answers smallint[], analysis_id uuid, analysis jsonb)
language plpgsql security definer set search_path = public as $$
declare r csat_review_runs; p csat_review_runs; a csat_item_analyses;
begin
  select * into r from csat_review_runs where id = p_run;
  if r.id is null or r.role <> 'reviewer' then raise exception '검수 실행이 아니다: %', p_run; end if;
  perform pg_advisory_xact_lock(hashtextextended(r.agent_run,0));
  select * into r from csat_review_runs where id = p_run for update;
  if exists (select 1 from csat_review_runs pending where pending.agent_run = r.agent_run
    and pending.role = 'reviewer' and pending.kind = 'blind' and pending.solve_committed_at is null
    and not exists (select 1 from csat_review_followups f where f.source = 'blind-invalid:' || pending.id::text)) then
    raise exception '이 실행의 미저장 blind 풀이를 먼저 확정해야 다른 분석도 공개한다: %', p_run;
  end if;
  if exists (select 1 from csat_review_followups f
    where f.source = 'blind-invalid:' || r.id::text or f.source = 'blind-invalid:' || r.parent_run_id::text) then
    raise exception '독립 풀이 증거에서 제외된 실행 또는 부모: %', p_run;
  end if;
  if r.kind = 'rereview' then
    select * into p from csat_review_runs where id = r.parent_run_id;
    if p.solve_committed_at is null or p.revealed_at is null or not csat_blind_protocol_valid(p.id) then raise exception '재검수 parent 의 독립 풀이 증거가 유효하지 않다: %', p_run; end if;
  elsif r.solve_committed_at is null then
    raise exception '독립 풀이를 먼저 확정해야 공개한다: %', p_run;
  elsif not csat_blind_protocol_valid(r.id) then
    raise exception '풀이 확정 전 공유 원문 분석 노출로 독립 증거에서 제외한다: %', p_run;
  end if;
  perform 1 from csat_items where id = r.item_id for share;
  select * into a from csat_item_analyses where id = r.analysis_id;
  if r.revealed_at is null then
    update csat_review_runs
       set revealed_at = clock_timestamp(),
           reveal_input_hash = csat_item_input_hash(r.item_id),
           reveal_answer_hash = csat_item_answer_hash(r.item_id),
           reveal_analysis_hash = csat_analysis_hash(a),
           reveal_units_hash = csat_current_units_hash(r.item_id)
     where id = p_run;
  end if;
  return query
    select i.answer::smallint, i.answers::smallint[], a.id, to_jsonb(a) - 'status'
      from csat_items i where i.id = r.item_id;
end $$;

create or replace function public.csat_valid_review_personas_row(a public.csat_item_analyses) returns text[]
language plpgsql stable security definer set search_path = public as $$
declare cur_in text; cur_ans text; cur_an text; cur_units text; out text[];
begin
  if a.id is null or a.analyst_run is null then return '{}'; end if;
  cur_in := csat_item_input_hash(a.item_id);
  cur_ans := csat_item_answer_hash(a.item_id);
  cur_an := csat_analysis_hash(a);
  cur_units := csat_current_units_hash(a.item_id);
  if a.units_hash is not null and a.units_hash is distinct from cur_units then return '{}'; end if;
  select coalesce(array_agg(distinct r.persona order by r.persona), '{}') into out
    from csat_independent_reviews r
    join csat_review_runs run on run.id = r.review_run_id
    left join csat_review_runs par on par.id = run.parent_run_id
   where r.analysis_id = a.id and r.verdict = 'pass'
     and run.role = 'reviewer' and run.analysis_id = a.id and run.persona = r.persona
     and run.agent_run <> a.analyst_run
     and run.revealed_at is not null and run.revealed_at <= r.reviewed_at
     and r.item_input_hash = cur_in and r.item_answer_hash = cur_ans and r.analysis_hash = cur_an
     and r.units_hash is not distinct from cur_units
     and (a.units_hash is null or r.units_hash = a.units_hash)
     and not exists (select 1 from csat_review_followups f
       where f.source = 'blind-invalid:' || run.id::text or f.source = 'blind-invalid:' || par.id::text)
     and (
       (run.kind = 'blind' and csat_blind_protocol_valid(run.id) and run.solve_committed_at is not null and run.solve_committed_at < run.revealed_at
        and run.solve_input_hash = cur_in and run.solve_answer_hash = cur_ans)
       or
       (run.kind = 'rereview' and csat_blind_protocol_valid(par.id) and par.kind = 'blind' and par.item_id = a.item_id and par.persona = r.persona
        and par.solve_committed_at is not null and par.revealed_at is not null and par.solve_committed_at < par.revealed_at
        and par.solve_input_hash = cur_in and par.solve_answer_hash = cur_ans
        and par.agent_run <> a.analyst_run)
     );
  return out;
end $$;

create or replace function public.csat_guard_published() returns trigger
language plpgsql security definer set search_path = public as $$
declare n_pass int; t text; ps text[]; actor text;
begin
  if new.status <> 'published' then return new; end if;
  if not csat_is_hakpyeong_item(new.item_id) then
    select count(distinct persona) into n_pass from csat_analysis_reviews where analysis_id = new.id and verdict = 'pass';
    if n_pass < 3 then raise exception '분석 %: 서로 다른 페르소나 3인의 pass 가 필요하다 (현재 %)', new.item_id,n_pass using errcode = 'check_violation'; end if;
    return new;
  end if;
  for actor in select distinct actors.agent_run from (
    select run.agent_run from csat_independent_reviews review join csat_review_runs run on run.id = review.review_run_id where review.analysis_id = new.id
    union
    select par.agent_run from csat_independent_reviews review join csat_review_runs run on run.id = review.review_run_id
      join csat_review_runs par on par.id = run.parent_run_id where review.analysis_id = new.id
  ) actors order by actors.agent_run loop
    perform pg_advisory_xact_lock(hashtextextended(actor,0));
  end loop;
  select type_id into t from csat_items where id = new.item_id for share;
  if t = 'R-CHART' then raise exception '학평 분석 %: 도표 이미지 근거 없음 — 발행 보류',new.item_id using errcode = 'check_violation'; end if;
  if new.units_hash is not null and csat_current_units_hash(new.item_id) is distinct from new.units_hash then
    raise exception '학평 분석 %: 근거 단위 목록이 현재 목록과 다르다',new.item_id using errcode = 'check_violation';
  end if;
  ps := csat_valid_review_personas_row(new);
  if coalesce(array_length(ps,1),0) < 3 then
    raise exception '학평 분석 %: 유효한 독립 검수 3인이 필요하다 — 현재 %',new.item_id,coalesce(array_length(ps,1),0) using errcode = 'check_violation';
  end if;
  return new;
end $$;

create or replace function public.csat_hold_on_units_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update csat_item_analyses a set status = 'in_review', updated_at = now()
   where a.item_id = new.item_id and a.status = 'published'
     and a.units_hash is distinct from csat_current_units_hash(new.item_id)
     and csat_is_hakpyeong_item(a.item_id);
  return new;
end $$;

create or replace function public.csat_hold_on_blind_exclusion() returns trigger
language plpgsql security definer set search_path = public as $$
declare bad csat_review_runs;
begin
  if new.source not like 'blind-invalid:%' then return new; end if;
  select * into bad from csat_review_runs where new.source = 'blind-invalid:' || id::text;
  if bad.id is null or bad.role <> 'reviewer' or bad.item_id <> new.item_id then
    raise exception '독립 풀이 제외 기록은 실제 검수 실행과 같은 문항을 지목해야 한다';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(bad.agent_run,0));
  update csat_item_analyses a set status = 'in_review', updated_at = now()
   where a.item_id like 'H%' and a.status = 'published'
     and exists (select 1 from csat_independent_reviews review
       join csat_review_runs run on run.id = review.review_run_id
       left join csat_review_runs par on par.id = run.parent_run_id
       where review.analysis_id = a.id and (
         run.id = bad.id or par.id = bad.id
         or (run.agent_run = bad.agent_run and run.created_at >= bad.created_at and csat_review_sources_overlap(run.item_id,bad.item_id))
         or (par.agent_run = bad.agent_run and par.created_at >= bad.created_at and csat_review_sources_overlap(par.item_id,bad.item_id))
       ))
     and cardinality(csat_valid_review_personas_row(a)) <> 3;
  return new;
end $$;

create or replace function public.csat_blind_exclusion_immutable() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.source like 'blind-invalid:%' then
    if tg_op = 'DELETE' then raise exception '독립 풀이 제외 이력을 삭제할 수 없다'; end if;
    if new.source is distinct from old.source or new.item_id is distinct from old.item_id then
      raise exception '독립 풀이 제외 실행·문항 식별자는 바꿀 수 없다';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger csat_blind_exclusion_immutable_trg
  before delete or update of source,item_id on public.csat_review_followups
  for each row execute function public.csat_blind_exclusion_immutable();

create trigger csat_hold_on_blind_exclusion_trg
  after insert or update of source on public.csat_review_followups
  for each row execute function public.csat_hold_on_blind_exclusion();

revoke all on function public.csat_rereview_parent(text,text,text), public.csat_review_reveal(uuid),
  public.csat_valid_review_personas_row(public.csat_item_analyses), public.csat_review_sources_overlap(text,text),
  public.csat_blind_source_unseen(text,text,timestamptz), public.csat_blind_protocol_valid(uuid),
  public.csat_review_solve(uuid,smallint,text), public.csat_review_run_check(), public.csat_hold_on_units_change(),
  public.csat_hold_on_blind_exclusion(), public.csat_guard_published(), public.csat_blind_exclusion_immutable() from public, anon, authenticated;
grant execute on function public.csat_review_sources_overlap(text,text), public.csat_blind_source_unseen(text,text,timestamptz),
  public.csat_blind_protocol_valid(uuid) to service_role;

-- Recheck any currently published descendant affected by an exclusion marker.
update public.csat_item_analyses a set status = 'in_review', updated_at = now()
where a.item_id like 'H%' and a.status = 'published'
  and cardinality(public.csat_valid_review_personas_row(a)) <> 3;
commit;

