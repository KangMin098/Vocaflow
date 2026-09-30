-- supabase/migrations/_pending_20260930120000_csat_review_stamp_at_reveal.sql
--
-- **학평 검수 게이트 v3 — PR #126 리뷰(2026-09-30) P1·P2 보정** (초안 · 적용 전 사용자 승인 필요)
--
--  1) 검수 행은 **제출 순간**이 아니라 **공개(reveal) 순간**에 본 것의 해시를 박제한다. 공개 뒤 원문·정답·분석·
--     근거 단위가 바뀌었으면 제출을 거부한다(검수자는 A 를 봤는데 B 의 승인이 되는 길을 막는다).
--     blind 는 풀이 시점 입력·정답 해시가 공개 시점과 같아야 하고, 게이트도 현재 값과 대조한다.
--  2) 목록 변경과 발행이 **같은 잠금**(csat_items 행)을 먼저 잡는다 — 발행은 FOR SHARE, 목록 쓰기는 FOR UPDATE.
--     목록 쓰기 쪽 자동 보류는 잠금을 얻은 뒤의 새 스냅숏으로 발행 여부를 본다.
--  3) «현재 목록» 을 원문 해시까지 묶어 **한 문장으로** 돌려주는 함수(csat_current_units_many) — 로더가 목록 해시만으로
--     옛 원문의 목록 글을 받는 길을 막는다.
--  4) 목록 생성 입력(원문 + 원문 해시)을 한 문장으로 돌려주는 함수, 그리고 **쓰기 시점 대조** 트리거
--     (적재하려는 input_hash 가 지금 원문 해시와 다르면 거부).
--  6) 유효 승인 페르소나를 게이트와 **같은 함수**로 센다(csat_valid_review_personas) — export 도 이 함수를 쓴다.
--  7) 재검수 parent 는 **지금 원문·정답 해시와 맞는** 가장 최근 blind 풀이만(csat_rereview_parent) · 삽입 검증도 같은 조건.

begin;

-- ── 1. 공개 시점 박제 ─────────────────────────────────────────────────
alter table public.csat_review_runs
  add column if not exists reveal_input_hash    text,
  add column if not exists reveal_answer_hash   text,
  add column if not exists reveal_analysis_hash text,
  add column if not exists reveal_units_hash    text;

create or replace function public.csat_review_reveal(p_run uuid)
returns table(answer smallint, answers smallint[], analysis_id uuid, analysis jsonb)
language plpgsql security definer set search_path = public as $$
declare r csat_review_runs; p csat_review_runs; a csat_item_analyses;
begin
  select * into r from csat_review_runs where id = p_run for update;
  if r.id is null or r.role <> 'reviewer' then raise exception '검수 실행이 아니다: %', p_run; end if;
  if r.kind = 'rereview' then
    select * into p from csat_review_runs where id = r.parent_run_id;
    if p.solve_committed_at is null or p.revealed_at is null then raise exception '재검수 parent 의 풀이·공개가 끝나지 않았다: %', p_run; end if;
  elsif r.solve_committed_at is null then
    raise exception '독립 풀이를 먼저 확정해야 공개한다: %', p_run;
  end if;
  perform 1 from csat_items where id = r.item_id for share;
  select * into a from csat_item_analyses where id = r.analysis_id;
  -- 첫 공개만 박제한다 — 다시 불러도 박제는 그대로(그 사이 바뀌었으면 제출이 거부된다)
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

create or replace function public.csat_independent_review_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
declare a csat_item_analyses; r csat_review_runs; p csat_review_runs;
begin
  if tg_op = 'INSERT' then
    select * into r from csat_review_runs where id = new.review_run_id;
    if r.id is null or r.analysis_id is distinct from new.analysis_id or r.persona is distinct from new.persona then
      raise exception '검수 행이 실행(분석·페르소나)과 맞지 않는다';
    end if;
    if r.revealed_at is null or r.reveal_input_hash is null then
      raise exception '공개 기록이 없다(또는 이 규약 이전의 공개다) — 새 실행으로 다시 검수한다';
    end if;
    perform 1 from csat_items where id = r.item_id for share;
    select * into a from csat_item_analyses where id = new.analysis_id;
    if (r.reveal_input_hash, r.reveal_answer_hash, r.reveal_analysis_hash, coalesce(r.reveal_units_hash, ''))
       is distinct from (csat_item_input_hash(r.item_id), csat_item_answer_hash(r.item_id), csat_analysis_hash(a), coalesce(csat_current_units_hash(r.item_id), '')) then
      raise exception '공개 뒤 원문·정답·분석·근거 단위 중 무엇이 바뀌었다 — 검수자가 본 것과 다르다. 새 실행으로 다시 검수한다';
    end if;
    if r.kind = 'blind' and (r.solve_input_hash is distinct from r.reveal_input_hash or r.solve_answer_hash is distinct from r.reveal_answer_hash) then
      raise exception '풀이 뒤 공개 전에 원문·정답이 바뀌었다 — 이 풀이는 블라인드 증거가 아니다';
    end if;
    if r.kind = 'rereview' then
      select * into p from csat_review_runs where id = r.parent_run_id;
      if p.solve_input_hash is distinct from r.reveal_input_hash or p.solve_answer_hash is distinct from r.reveal_answer_hash then
        raise exception '재검수 parent 의 풀이가 지금 원문·정답과 맞지 않는다 — 새 blind 가 필요하다';
      end if;
    end if;
    new.item_input_hash  := r.reveal_input_hash;          -- 공개 시점 = 검수자가 본 것
    new.item_answer_hash := r.reveal_answer_hash;
    new.analysis_hash    := r.reveal_analysis_hash;
    new.units_hash       := r.reveal_units_hash;
    new.reviewed_at      := clock_timestamp();
    return new;
  end if;
  if (new.item_input_hash, new.item_answer_hash, new.analysis_hash, new.units_hash, new.reviewed_at, new.review_run_id, new.analysis_id, new.persona)
     is distinct from (old.item_input_hash, old.item_answer_hash, old.analysis_hash, old.units_hash, old.reviewed_at, old.review_run_id, old.analysis_id, old.persona) then
    raise exception '독립 검수 행의 박제 칸은 고칠 수 없다 — 재검수는 새 회차로 추가한다';
  end if;
  return new;
end $$;

-- ── 6. 유효 승인 페르소나 — 게이트와 export 의 단일 기준 ──────────────────
create or replace function public.csat_valid_review_personas(p_analysis uuid) returns text[]
language plpgsql stable security definer set search_path = public as $$
declare a csat_item_analyses; cur_in text; cur_ans text; cur_an text; out text[];
begin
  select * into a from csat_item_analyses where id = p_analysis;
  if a.id is null or a.analyst_run is null then return '{}'; end if;
  cur_in := csat_item_input_hash(a.item_id);
  cur_ans := csat_item_answer_hash(a.item_id);
  cur_an := csat_analysis_hash(a);
  select coalesce(array_agg(distinct r.persona order by r.persona), '{}') into out
    from csat_independent_reviews r
    join csat_review_runs run on run.id = r.review_run_id
    left join csat_review_runs par on par.id = run.parent_run_id
   where r.analysis_id = a.id and r.verdict = 'pass'
     and run.role = 'reviewer' and run.analysis_id = a.id and run.persona = r.persona
     and run.agent_run <> a.analyst_run
     and run.revealed_at is not null and run.revealed_at <= r.reviewed_at
     and r.item_input_hash = cur_in and r.item_answer_hash = cur_ans and r.analysis_hash = cur_an
     and (a.units_hash is null or r.units_hash = a.units_hash)
     and (
       (run.kind = 'blind' and run.solve_committed_at is not null and run.solve_committed_at < run.revealed_at
        and run.solve_input_hash = cur_in and run.solve_answer_hash = cur_ans)
       or
       (run.kind = 'rereview' and par.kind = 'blind' and par.item_id = a.item_id and par.persona = r.persona
        and par.solve_committed_at is not null and par.revealed_at is not null and par.solve_committed_at < par.revealed_at
        and par.solve_input_hash = cur_in and par.solve_answer_hash = cur_ans
        and par.agent_run <> a.analyst_run)
     );
  return out;
end $$;

create or replace function public.csat_valid_review_personas_many(p_analyses uuid[])
returns table(analysis_id uuid, personas text[])
language sql stable security definer set search_path = public as $$
  select x, csat_valid_review_personas(x) from unnest(p_analyses) x
$$;

-- ── 게이트: 잠금 먼저 · 단일 기준 함수 사용 ──────────────────────────────
create or replace function public.csat_guard_published() returns trigger
language plpgsql security definer set search_path = public as $$
declare n_pass int; t text; ps text[];
begin
  if new.status <> 'published' then return new; end if;
  if not csat_is_hakpyeong_item(new.item_id) then
    select count(distinct persona) into n_pass
      from csat_analysis_reviews where analysis_id = new.id and verdict = 'pass';
    if n_pass < 3 then
      raise exception '분석 %: 서로 다른 페르소나 3인의 pass 가 필요하다 (현재 %)', new.item_id, n_pass using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- 목록 쓰기(FOR UPDATE)와 같은 행을 먼저 잠근다 — 이 뒤의 조회는 상대가 커밋한 뒤의 값을 본다
  select type_id into t from csat_items where id = new.item_id for share;
  if t = 'R-CHART' then
    raise exception '학평 분석 %: 도표 이미지 근거 없음 — 발행 보류(도표를 입력에 붙인 뒤 다시 검수)', new.item_id using errcode = 'check_violation';
  end if;
  if new.units_hash is not null and csat_current_units_hash(new.item_id) is distinct from new.units_hash then
    raise exception '학평 분석 %: 분석이 본 근거 단위 목록이 현재 목록과 다르다 — 번호를 다시 대조해야 한다', new.item_id using errcode = 'check_violation';
  end if;
  -- BEFORE 트리거라 new 는 아직 표에 없다 — 같은 기준을 new 에 적용하기 위해 id 로 센다(분석 내용 칸은 발행 전환에서 안 바뀐다)
  if csat_analysis_hash(new) is distinct from (select csat_analysis_hash(x) from csat_item_analyses x where x.id = new.id) then
    raise exception '학평 분석 %: 발행과 동시에 분석 내용을 바꿀 수 없다', new.item_id using errcode = 'check_violation';
  end if;
  ps := csat_valid_review_personas(new.id);
  if coalesce(array_length(ps, 1), 0) < 3 then
    raise exception '학평 분석 %: 독립 검수 3인이 필요하다(자기 검수·풀이 전 공개·원문/정답/분석/근거 단위 변경 뒤 승인은 무효) — 현재 %', new.item_id, coalesce(array_length(ps, 1), 0)
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- ── 2·4. 목록 쓰기: 잠금 + 쓰기 시점 원문 대조 ───────────────────────────
create or replace function public.csat_item_units_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform 1 from csat_items where id = new.item_id for update;     -- 발행(FOR SHARE)과 같은 행
  if new.input_hash is distinct from csat_item_input_hash(new.item_id) then
    raise exception '근거 단위 목록 %: 원문이 목록을 만든 뒤 바뀌었다 — 다시 만든다', new.item_id;
  end if;
  return new;
end $$;
drop trigger if exists csat_item_units_guard_trg on public.csat_item_units;
create trigger csat_item_units_guard_trg before insert or update on public.csat_item_units
  for each row execute function public.csat_item_units_guard();
-- 자동 보류(csat_hold_on_units_change, AFTER)는 그대로 — BEFORE 에서 잡은 잠금 뒤의 새 스냅숏으로 발행 여부를 본다

-- ── 3. 현재 목록을 원문 해시와 함께 한 문장으로 ──────────────────────────
create or replace function public.csat_current_units_many(p_items text[])
returns table(item_id text, units_version int, units_hash text, input_hash text, units jsonb)
language sql stable security definer set search_path = public as $$
  select distinct on (u.item_id) u.item_id, u.units_version, u.units_hash, u.input_hash, u.units
    from csat_item_units u
   where u.item_id = any(p_items) and u.input_hash = csat_item_input_hash(u.item_id)
   order by u.item_id, u.units_version desc
$$;

-- ── 4. 목록 생성 입력 — 원문과 원문 해시를 같은 문장에서 ──────────────────
create or replace function public.csat_units_build_input()
returns table(id text, type_id text, passage text, input_hash text)
language sql stable security definer set search_path = public as $$
  select i.id, i.type_id, i.passage, csat_item_input_hash(i.id)
    from csat_items i join csat_exams e on e.id = i.exam_id
   where e.organizer = 'edu_office'
   order by i.id
$$;

-- ── 7. 재검수 parent: 지금 원문·정답과 맞는 가장 최근 blind ────────────────
create or replace function public.csat_rereview_parent(p_item text, p_persona text, p_analyst_run text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from csat_review_runs
   where item_id = p_item and persona = p_persona and kind = 'blind' and role = 'reviewer'
     and solve_committed_at is not null and revealed_at is not null and solve_committed_at < revealed_at
     and solve_input_hash = csat_item_input_hash(p_item) and solve_answer_hash = csat_item_answer_hash(p_item)
     and agent_run is distinct from p_analyst_run
   order by solve_committed_at desc limit 1
$$;

create or replace function public.csat_review_run_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare p csat_review_runs;
begin
  if new.kind = 'rereview' then
    select * into p from csat_review_runs where id = new.parent_run_id;
    if p.id is null or p.kind <> 'blind' then raise exception '재검수는 blind 실행에만 잇는다'; end if;
    if p.item_id <> new.item_id or p.persona is distinct from new.persona then
      raise exception '재검수 parent 는 같은 문항·같은 페르소나여야 한다';
    end if;
    if p.solve_committed_at is null or p.revealed_at is null then
      raise exception '재검수 parent 는 풀이 확정과 공개가 끝난 실행이어야 한다';
    end if;
    if p.solve_input_hash is distinct from csat_item_input_hash(new.item_id) or p.solve_answer_hash is distinct from csat_item_answer_hash(new.item_id) then
      raise exception '재검수 parent 의 풀이가 지금 원문·정답과 맞지 않는다 — 새 blind 가 필요하다';
    end if;
  end if;
  return new;
end $$;

revoke all on function public.csat_valid_review_personas(uuid), public.csat_valid_review_personas_many(uuid[]),
  public.csat_item_units_guard(), public.csat_current_units_many(text[]), public.csat_units_build_input(),
  public.csat_rereview_parent(text, text, text), public.csat_review_run_check(), public.csat_review_reveal(uuid),
  public.csat_independent_review_stamp(), public.csat_guard_published() from public, anon, authenticated;

commit;

-- ── 되돌리기 ──────────────────────────────────────────────────────────
--  drop trigger csat_item_units_guard_trg on csat_item_units; drop function csat_item_units_guard();
--  drop function csat_valid_review_personas_many(uuid[]), csat_valid_review_personas(uuid), csat_current_units_many(text[]),
--    csat_units_build_input(), csat_rereview_parent(text, text, text);
--  csat_review_reveal · csat_review_run_check 를 20260928143924 정의로, csat_independent_review_stamp · csat_guard_published 를
--    20260928152323 정의로 create or replace;
--  alter table csat_review_runs drop column reveal_units_hash, drop column reveal_analysis_hash, drop column reveal_answer_hash, drop column reveal_input_hash;
