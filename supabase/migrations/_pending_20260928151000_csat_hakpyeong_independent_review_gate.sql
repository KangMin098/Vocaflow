-- supabase/migrations/_pending_20260928151000_csat_hakpyeong_independent_review_gate.sql
--
-- **학평 분석 발행 게이트 — 독립 검수 · 오래된 승인 차단** (초안 · 적용 전 사용자 승인 필요)
--
-- 적용 범위는 호출자가 넘기는 `--set` 이 아니라 **DB 의 회차 소속**(csat_exams.organizer='edu_office')으로 정한다.
-- 평가원 분석(802)에는 적용하지 않는다 — 과거 검수에 이 칸들이 없어 소급하면 전부 막힌다(확대는 별도 결정).
--
-- ── 무엇을 보장하나 ────────────────────────────────────────────────────
--  ① 해시는 **DB 가 계산**한다. 적재기가 보내는 해시는 받지 않는다.
--       입력 해시  = 지문 · 발문 · 선지 (풀이 입력)
--       정답 해시  = answer · answers (공식 정답 — 따로 무효화한다)
--       분석 해시  = 검수 대상 분석 칸 전체(jsonb 정규 텍스트)
--  ② 검수 행은 삽입 순간의 세 해시를 **DB 트리거가** 박제하고, 그 뒤로 못 고친다.
--  ③ 발행하려면 서로 다른 페르소나 3인이 pass 이고, 그 3행 모두
--       · 검수 실행(csat_review_runs, role='reviewer')에 묶여 있고
--       · 그 실행의 주체(agent_run)가 분석 실행 주체(analyst_run)와 다르며
--       · 독립 풀이가 공식 정답·분석 공개보다 **먼저** 확정됐고(solve_committed_at < revealed_at ≤ reviewed_at)
--       · 박제된 세 해시가 **지금** 해시와 같아야 한다
--  ④ 이미 발행된 분석도 원문·정답·분석이 바뀌거나 검수가 철회(삭제·판정 변경)되면 **자동으로 in_review**.
--  ⑤ 경쟁 조건: 발행 검사는 문항 행을 FOR SHARE 로 잠그고, 원문 변경 트리거는 같은 행의 UPDATE 이므로
--     둘이 겹치면 한쪽이 기다린다 — 기다린 뒤 도는 쪽이 최신 상태로 다시 판정한다.
--
-- 독립 풀이는 **두 단계**다: 검수자가 `csat_review_solve()` 로 원문·선지만 보고 고른 답을 먼저 확정하고,
-- 그 뒤에만 `csat_review_reveal()` 이 공식 정답과 분석을 준다. 사후에 풀이 칸을 채우는 길은 없다
-- (solve 는 한 번만, reveal 은 solve 뒤에만, 둘 다 시각은 DB now()).
--
-- 과거 검수 984행은 review_run_id 가 비어 있어 이 게이트를 **통과하지 못한다**(의도). 덮어쓰지도, 소급 기록하지도 않는다.
-- 재검수는 새 회차(run)로 **추가**한다.

begin;

-- ── 실행 기록 ─────────────────────────────────────────────────────────
create table if not exists public.csat_review_runs (
  id                 uuid primary key default gen_random_uuid(),
  item_id            text not null references public.csat_items(id) on delete cascade,
  analysis_id        uuid references public.csat_item_analyses(id) on delete cascade,
  role               text not null check (role in ('analyst', 'reviewer')),
  -- 실행 주체 식별자(에이전트 실행 id). 분석자와 검수자가 같으면 게이트가 막는다
  agent_run          text not null check (length(agent_run) >= 8),
  persona            text check (persona in ('setter', 'analyst', 'tutor')),
  -- 독립 풀이 — 원문·선지만 보고 고른 답. 공식 정답을 보기 전에 확정한다
  solve_answer       smallint check (solve_answer between 1 and 5),
  solve_note         text,
  solve_input_hash   text,
  solve_committed_at timestamptz,
  revealed_at        timestamptz,
  created_at         timestamptz not null default now(),
  check (role = 'reviewer' or (solve_answer is null and solve_committed_at is null and revealed_at is null))
);
create index if not exists csat_review_runs_item_idx on public.csat_review_runs(item_id);
alter table public.csat_review_runs enable row level security;
revoke all on public.csat_review_runs from anon, authenticated;

alter table public.csat_item_analyses
  add column if not exists analyst_run text;
alter table public.csat_analysis_reviews
  add column if not exists review_run_id    uuid references public.csat_review_runs(id),
  add column if not exists item_input_hash  text,
  add column if not exists item_answer_hash text,
  add column if not exists analysis_hash    text;

-- ── 해시(DB 계산) ─────────────────────────────────────────────────────
create or replace function public.csat_item_input_hash(p_item text) returns text
language sql stable security definer set search_path = public as $$
  select encode(sha256(convert_to(coalesce(passage, '') || E'\x1f' || coalesce(stem, '') || E'\x1f' || coalesce(choices::text, ''), 'UTF8')), 'hex')
    from csat_items where id = p_item
$$;
create or replace function public.csat_item_answer_hash(p_item text) returns text
language sql stable security definer set search_path = public as $$
  select encode(sha256(convert_to(coalesce(answer::text, '') || E'\x1f' || coalesce(answers::text, ''), 'UTF8')), 'hex')
    from csat_items where id = p_item
$$;
-- jsonb::text 는 키 순서가 정규화된다 — 적재기가 키 순서를 바꿔 보내도 같은 해시다
create or replace function public.csat_analysis_hash(a public.csat_item_analyses) returns text
language sql immutable as $$
  select encode(sha256(convert_to(jsonb_build_object(
    'measured_ability', a.measured_ability, 'design_intent', a.design_intent, 'answer_locus', a.answer_locus,
    'choice_analysis', a.choice_analysis, 'solve_procedure', a.solve_procedure, 'time_budget_sec', a.time_budget_sec,
    'difficulty', a.difficulty, 'required_vocab', to_jsonb(a.required_vocab), 'answer_unknown', a.answer_unknown
  )::text, 'UTF8')), 'hex')
$$;
create or replace function public.csat_is_hakpyeong_item(p_item text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from csat_items i join csat_exams e on e.id = i.exam_id
                  where i.id = p_item and e.organizer = 'edu_office')
$$;

-- ── 두 단계 독립 풀이 ─────────────────────────────────────────────────
-- ① 풀이 확정: 원문·선지만 보고 고른 답. run 당 한 번. 이 시점 입력 해시를 박제한다
create or replace function public.csat_review_solve(p_run uuid, p_answer smallint, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare r csat_review_runs;
begin
  select * into r from csat_review_runs where id = p_run for update;
  if r.id is null or r.role <> 'reviewer' then raise exception '검수 실행이 아니다: %', p_run; end if;
  if r.solve_committed_at is not null then raise exception '독립 풀이는 한 번만 확정한다: %', p_run; end if;
  update csat_review_runs
     set solve_answer = p_answer, solve_note = p_note,
         solve_input_hash = csat_item_input_hash(r.item_id), solve_committed_at = now()
   where id = p_run;
end $$;
-- ② 공개: 풀이가 확정된 run 에만 공식 정답과 최신 분석을 준다
create or replace function public.csat_review_reveal(p_run uuid)
returns table(answer smallint, answers smallint[], analysis_id uuid, analysis jsonb)
language plpgsql security definer set search_path = public as $$
declare r csat_review_runs;
begin
  select * into r from csat_review_runs where id = p_run for update;
  if r.solve_committed_at is null then raise exception '독립 풀이를 먼저 확정해야 공개한다: %', p_run; end if;
  update csat_review_runs set revealed_at = coalesce(revealed_at, now()) where id = p_run;
  return query
    select i.answer::smallint, i.answers::smallint[], a.id, to_jsonb(a) - 'status'
      from csat_items i join csat_item_analyses a on a.id = r.analysis_id where i.id = r.item_id;
end $$;
revoke all on function public.csat_review_solve(uuid, smallint, text), public.csat_review_reveal(uuid) from public, anon, authenticated;

-- ── 검수 행: 해시 박제 · 불변 ─────────────────────────────────────────
create or replace function public.csat_review_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
declare a csat_item_analyses;
begin
  select * into a from csat_item_analyses where id = new.analysis_id;
  if tg_op = 'INSERT' then
    -- 적재기가 보낸 값은 버리고 DB 가 지금 값으로 박제한다
    new.item_input_hash  := csat_item_input_hash(a.item_id);
    new.item_answer_hash := csat_item_answer_hash(a.item_id);
    new.analysis_hash    := csat_analysis_hash(a);
    return new;
  end if;
  if new.item_input_hash is distinct from old.item_input_hash or new.item_answer_hash is distinct from old.item_answer_hash
     or new.analysis_hash is distinct from old.analysis_hash or new.review_run_id is distinct from old.review_run_id then
    raise exception '검수 행의 박제 칸(해시·실행)은 고칠 수 없다 — 재검수는 새 행으로 추가한다';
  end if;
  return new;
end $$;
drop trigger if exists csat_review_stamp_trg on public.csat_analysis_reviews;
create trigger csat_review_stamp_trg before insert or update on public.csat_analysis_reviews
  for each row execute function public.csat_review_stamp();

-- ── 발행 게이트(학평) ─────────────────────────────────────────────────
create or replace function public.csat_guard_published() returns trigger
language plpgsql security definer set search_path = public as $$
declare n_pass int; n_indep int;
begin
  if new.status <> 'published' then return new; end if;
  select count(distinct persona) into n_pass
    from csat_analysis_reviews where analysis_id = new.id and verdict = 'pass';
  if n_pass < 3 then
    raise exception '분석 %: 서로 다른 페르소나 3인의 pass 가 필요하다 (현재 %)', new.item_id, n_pass using errcode = 'check_violation';
  end if;
  if not csat_is_hakpyeong_item(new.item_id) then return new; end if;   -- 평가원: 기존 규칙 그대로

  perform 1 from csat_items where id = new.item_id for share;         -- 원문 변경과의 경쟁 차단
  select count(distinct r.persona) into n_indep
    from csat_analysis_reviews r
    join csat_review_runs run on run.id = r.review_run_id
   where r.analysis_id = new.id and r.verdict = 'pass'
     and run.role = 'reviewer' and run.analysis_id = new.id and run.persona = r.persona
     and new.analyst_run is not null and run.agent_run <> new.analyst_run
     and run.solve_committed_at is not null and run.revealed_at is not null
     and run.solve_committed_at < run.revealed_at and run.revealed_at <= r.reviewed_at
     and r.item_input_hash  = csat_item_input_hash(new.item_id)
     and r.item_answer_hash = csat_item_answer_hash(new.item_id)
     and r.analysis_hash    = csat_analysis_hash(new);
  if n_indep < 3 then
    raise exception '학평 분석 %: 독립 검수 3인이 필요하다(자기 검수·풀이 전 공개·원문/정답/분석 변경 뒤 승인은 무효) — 현재 %', new.item_id, n_indep
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- ── 자동 보류 ─────────────────────────────────────────────────────────
-- 분석 내용이 바뀌면(발행 상태 유지 시도 포함) 학평은 in_review 로
create or replace function public.csat_hold_on_analysis_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'published' and new.status = 'published'
     and csat_analysis_hash(new) is distinct from csat_analysis_hash(old)
     and csat_is_hakpyeong_item(new.item_id) then
    new.status := 'in_review';
  end if;
  return new;
end $$;
drop trigger if exists csat_hold_on_analysis_change_trg on public.csat_item_analyses;
create trigger csat_hold_on_analysis_change_trg before update on public.csat_item_analyses
  for each row execute function public.csat_hold_on_analysis_change();

-- 원문·정답이 바뀌면 그 문항의 학평 발행 분석을 in_review 로
create or replace function public.csat_hold_on_item_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.passage, new.stem, new.choices, new.answer, new.answers)
     is distinct from (old.passage, old.stem, old.choices, old.answer, old.answers)
     and csat_is_hakpyeong_item(new.id) then
    update csat_item_analyses set status = 'in_review', updated_at = now()
     where item_id = new.id and status = 'published';
  end if;
  return new;
end $$;
drop trigger if exists csat_hold_on_item_change_trg on public.csat_items;
create trigger csat_hold_on_item_change_trg after update on public.csat_items
  for each row execute function public.csat_hold_on_item_change();

-- 검수가 철회(삭제 · pass 에서 다른 판정으로)되면 발행 분석을 in_review 로
create or replace function public.csat_hold_on_review_withdraw() returns trigger
language plpgsql security definer set search_path = public as $$
declare aid uuid := coalesce(old.analysis_id, new.analysis_id);
begin
  if (tg_op = 'DELETE' and old.verdict = 'pass')
     or (tg_op = 'UPDATE' and old.verdict = 'pass' and new.verdict <> 'pass') then
    update csat_item_analyses a set status = 'in_review', updated_at = now()
     where a.id = aid and a.status = 'published' and csat_is_hakpyeong_item(a.item_id);
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists csat_hold_on_review_withdraw_trg on public.csat_analysis_reviews;
create trigger csat_hold_on_review_withdraw_trg after update or delete on public.csat_analysis_reviews
  for each row execute function public.csat_hold_on_review_withdraw();

revoke all on function public.csat_item_input_hash(text), public.csat_item_answer_hash(text),
  public.csat_is_hakpyeong_item(text) from public, anon, authenticated;

commit;

-- ── 적용 전 시험(별도 브랜치 또는 롤백 트랜잭션) ──────────────────────
--  T1 과거 자기 검수(review_run_id 없음)로 published 시도 → 거부
--  T2 analyst_run = reviewer agent_run 으로 published 시도 → 거부
--  T3 solve 없이 reveal → 거부 · solve 두 번 → 거부
--  T4 정상 흐름(분석 run ≠ 검수 run 3, solve→reveal→review 삽입) → published 허용
--  T5 T4 뒤 지문 수정 → 자동 in_review · 재발행 시도 → 거부(박제 해시 불일치)
--  T6 T4 뒤 공식 정답 수정 → 자동 in_review
--  T7 T4 뒤 분석 칸 수정(status 유지) → 자동 in_review
--  T8 T4 뒤 pass 검수 삭제 → 자동 in_review
--  T9 검수 행의 해시 칸 UPDATE → 거부
--  T10 평가원 분석 발행 → 기존 규칙(3 페르소나 pass)만으로 허용 — 회귀 없음
--  T11 경쟁: 세션 A 발행 트랜잭션(문항 FOR SHARE) 중 세션 B 지문 수정 → B 가 기다린 뒤 A 결과 위에서 자동 보류
--
-- ── 되돌리기 ──────────────────────────────────────────────────────────
--  drop trigger csat_hold_on_review_withdraw_trg on csat_analysis_reviews; drop trigger csat_hold_on_item_change_trg on csat_items;
--  drop trigger csat_hold_on_analysis_change_trg on csat_item_analyses; drop trigger csat_review_stamp_trg on csat_analysis_reviews;
--  csat_guard_published 는 이전 정의(3 페르소나 pass 만)로 create or replace;
--  drop function csat_review_reveal, csat_review_solve, csat_hold_*, csat_review_stamp, csat_analysis_hash, csat_item_*_hash, csat_is_hakpyeong_item;
--  alter table csat_analysis_reviews drop column review_run_id, item_input_hash, item_answer_hash, analysis_hash;
--  alter table csat_item_analyses drop column analyst_run; drop table csat_review_runs;
