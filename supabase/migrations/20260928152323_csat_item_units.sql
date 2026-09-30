-- supabase/migrations/20260928152323_csat_item_units.sql
--
-- **근거 단위 목록(csat_item_units) — 분석·검수가 같은 번호를 쓰게 한다** (2026-09-29 사용자 승인 · 적용)
--
-- 왜: 분석자와 검수자가 지문 문장을 각자 세어 번호가 어긋났다(2026-09-29 학평 8문항 검수 시험 —
-- revise 대부분이 문장 번호 오류, 검수자끼리도 8/9문장으로 갈림). 목록은 scripts/csat/lib-evidence-units.mjs
-- (UNITS_VERSION) 가 **한 번** 만들어 이 표에 두고, export·검수 CLI·validator 는 이 표만 읽는다.
--
-- 규칙:
--   · 목록은 원문 해시(csat_item_input_hash)에 묶인다 — 원문이 바뀌면 옛 목록은 «현재 목록» 이 아니다
--   · 분석은 자기가 본 목록의 units_hash 를 갖는다. 검수 행은 DB 가 현재 목록 해시를 박제한다
--   · 학평 게이트: 분석에 units_hash 가 있으면 **현재 목록과 같아야** 하고, 그 해시로 박제된 검수만 센다
--     (목록이 바뀌면 옛 번호 참조·승인 재사용 불가). units_hash 가 없는 옛 분석은 기존 규칙 그대로
--   · 새 목록이 들어와 발행된 분석의 목록과 달라지면 자동 in_review
--   · 학평 도표(R-CHART)는 **발행 보류** — 이미지가 입력에 없어 검수·분석 모두 도표를 대조하지 못했다
--     (2026-09-29: 검수자 3인 모두 블라인드 풀이 불일치, 분석은 정답표만 근거). 조용히 빼지 않고 사유를 남긴다

begin;

-- ── 목록 ──────────────────────────────────────────────────────────────
create table if not exists public.csat_item_units (
  item_id       text not null references public.csat_items(id) on delete cascade,
  units_version int  not null check (units_version >= 1),
  input_hash    text not null,
  units         jsonb not null check (jsonb_typeof(units) = 'array' and jsonb_array_length(units) >= 1),
  units_hash    text not null check (length(units_hash) = 64),
  created_at    timestamptz not null default now(),
  primary key (item_id, units_version, input_hash)
);
alter table public.csat_item_units enable row level security;
revoke all on public.csat_item_units from anon, authenticated;
comment on table public.csat_item_units is
  '근거 단위 목록(lib-evidence-units.mjs 생성). 원문 해시·버전별 1행. 분석·검수 번호의 정본 — 드레인·검수 CLI 는 다시 나누지 않는다';

-- 현재 목록 = 현재 원문 해시에 맞는 가장 높은 버전
create or replace function public.csat_current_units_hash(p_item text) returns text
language sql stable security definer set search_path = public as $$
  select units_hash from csat_item_units
   where item_id = p_item and input_hash = csat_item_input_hash(p_item)
   order by units_version desc limit 1
$$;

alter table public.csat_item_analyses
  add column if not exists units_version int,
  add column if not exists units_hash text;
alter table public.csat_independent_reviews
  add column if not exists units_hash text;

-- ── 검수 박제에 목록 해시 추가 ────────────────────────────────────────
create or replace function public.csat_independent_review_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
declare a csat_item_analyses;
begin
  if tg_op = 'INSERT' then
    select * into a from csat_item_analyses where id = new.analysis_id;
    new.item_input_hash  := csat_item_input_hash(a.item_id);
    new.item_answer_hash := csat_item_answer_hash(a.item_id);
    new.analysis_hash    := csat_analysis_hash(a);
    new.units_hash       := csat_current_units_hash(a.item_id);   -- 검수자가 본 목록(CLI 는 이 표에서만 출력한다)
    new.reviewed_at      := clock_timestamp();
    return new;
  end if;
  if (new.item_input_hash, new.item_answer_hash, new.analysis_hash, new.units_hash, new.reviewed_at, new.review_run_id, new.analysis_id, new.persona)
     is distinct from (old.item_input_hash, old.item_answer_hash, old.analysis_hash, old.units_hash, old.reviewed_at, old.review_run_id, old.analysis_id, old.persona) then
    raise exception '독립 검수 행의 박제 칸은 고칠 수 없다 — 재검수는 새 회차로 추가한다';
  end if;
  return new;
end $$;

-- ── 게이트: 도표 보류 + 목록 일치 ─────────────────────────────────────
create or replace function public.csat_guard_published() returns trigger
language plpgsql security definer set search_path = public as $$
declare n_pass int; n_indep int; cur_in text; cur_ans text; cur_an text; cur_units text; t text;
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

  select type_id into t from csat_items where id = new.item_id for share;
  if t = 'R-CHART' then
    raise exception '학평 분석 %: 도표 이미지 근거 없음 — 발행 보류(도표를 입력에 붙인 뒤 다시 검수)', new.item_id
      using errcode = 'check_violation';
  end if;

  cur_in := csat_item_input_hash(new.item_id);
  cur_ans := csat_item_answer_hash(new.item_id);
  cur_an := csat_analysis_hash(new);
  if new.units_hash is not null then
    cur_units := csat_current_units_hash(new.item_id);
    if cur_units is distinct from new.units_hash then
      raise exception '학평 분석 %: 분석이 본 근거 단위 목록이 현재 목록과 다르다 — 번호를 다시 대조해야 한다', new.item_id
        using errcode = 'check_violation';
    end if;
  end if;

  select count(distinct r.persona) into n_indep
    from csat_independent_reviews r
    join csat_review_runs run on run.id = r.review_run_id
    left join csat_review_runs par on par.id = run.parent_run_id
   where r.analysis_id = new.id and r.verdict = 'pass'
     and run.role = 'reviewer' and run.analysis_id = new.id and run.persona = r.persona
     and new.analyst_run is not null and run.agent_run <> new.analyst_run
     and run.revealed_at is not null and run.revealed_at <= r.reviewed_at
     and r.item_input_hash = cur_in and r.item_answer_hash = cur_ans and r.analysis_hash = cur_an
     and (new.units_hash is null or r.units_hash = new.units_hash)
     and (
       (run.kind = 'blind' and run.solve_committed_at is not null and run.solve_committed_at < run.revealed_at)
       or
       (run.kind = 'rereview' and par.kind = 'blind' and par.item_id = new.item_id and par.persona = r.persona
        and par.solve_committed_at is not null and par.revealed_at is not null and par.solve_committed_at < par.revealed_at
        and par.solve_input_hash = cur_in and par.solve_answer_hash = cur_ans
        and par.agent_run <> new.analyst_run)
     );
  if n_indep < 3 then
    raise exception '학평 분석 %: 독립 검수 3인이 필요하다(자기 검수·풀이 전 공개·원문/정답/분석/근거 단위 변경 뒤 승인은 무효) — 현재 %', new.item_id, n_indep
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- ── 목록이 바뀌면 그 목록으로 쓴 발행 분석을 보류 ────────────────────
create or replace function public.csat_hold_on_units_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update csat_item_analyses a set status = 'in_review', updated_at = now()
   where a.item_id = new.item_id and a.status = 'published' and a.units_hash is not null
     and a.units_hash is distinct from csat_current_units_hash(new.item_id)
     and csat_is_hakpyeong_item(a.item_id);
  return new;
end $$;
drop trigger if exists csat_hold_on_units_change_trg on public.csat_item_units;
create trigger csat_hold_on_units_change_trg after insert or update on public.csat_item_units
  for each row execute function public.csat_hold_on_units_change();

revoke all on function public.csat_current_units_hash(text), public.csat_hold_on_units_change(),
  public.csat_independent_review_stamp(), public.csat_guard_published() from public, anon, authenticated;

commit;

-- ── 되돌리기 ──────────────────────────────────────────────────────────
--  drop trigger csat_hold_on_units_change_trg on csat_item_units; drop function csat_hold_on_units_change();
--  csat_independent_review_stamp 를 20260928141215 정의로, csat_guard_published 를 20260928143924 정의로 create or replace;
--  alter table csat_independent_reviews drop column units_hash;
--  alter table csat_item_analyses drop column units_hash, drop column units_version;
--  drop function csat_current_units_hash(text); drop table csat_item_units;
