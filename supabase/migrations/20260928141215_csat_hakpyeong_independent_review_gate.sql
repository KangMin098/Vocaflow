-- supabase/migrations/20260928141215_csat_hakpyeong_independent_review_gate.sql
--
-- **학평 분석 발행 게이트 — 독립 검수 · 오래된 승인 차단** (적용 2026-09-28 · 사용자 승인 · 롤백 시험 T1~T10 통과)
--
-- 적용 범위는 호출자가 넘기는 `--set` 이 아니라 **DB 의 회차 소속**(csat_exams.organizer='edu_office')으로 정한다.
-- 평가원 분석(802)·검수 테이블은 건드리지 않는다(과거 검수에 이 칸들이 없어 소급하면 전부 막힌다 — 확대는 별도 결정).
--
-- ── 설계 변경(2026-09-28 롤백 시험에서 발견) ──────────────────────────
-- 처음 초안은 기존 csat_analysis_reviews 에 칸을 더해 재검수를 «추가» 하려 했으나, 그 테이블은
-- unique(analysis_id, persona) 라 **과거 행을 둔 채 새 회차를 넣을 수 없다**(시험이 23505 로 잡았다).
-- 제약을 바꾸면 평가원 적재(onConflict analysis_id,persona)가 깨진다. 그래서 독립 검수는
-- **새 테이블 csat_independent_reviews** 에 쌓는다 — 과거 984행·평가원 흐름은 그대로이고, 회차를 여러 번 쌓을 수 있다.
--
-- ── 무엇을 보장하나 ────────────────────────────────────────────────────
--  ① 해시는 **DB 가 계산**한다(입력 = 지문·발문·선지 · 정답 = answer·answers · 분석 = 검수 대상 칸 전체).
--  ② 독립 검수 행은 삽입 순간의 세 해시와 시각을 **DB 트리거가** 박제하고, 그 뒤로 못 고친다.
--  ③ 학평 발행 = 서로 다른 페르소나 3인의 독립 검수 pass, 그 3행 모두
--       · 검수 실행(csat_review_runs, role='reviewer', 같은 페르소나)에 묶이고
--       · 실행 주체(agent_run)가 분석 실행 주체(analyst_run)와 다르며
--       · 독립 풀이 확정 < 정답·분석 공개 ≤ 검수 기록(모두 DB clock_timestamp())
--       · 박제 해시가 **지금** 해시와 같다
--     과거 자기 검수(csat_analysis_reviews)는 학평 발행 근거로 쓰지 않는다.
--  ④ 이미 발행된 학평 분석도 원문·정답·분석이 바뀌거나 독립 검수가 철회되면 **자동 in_review**.
--  ⑤ 경쟁: 발행 검사는 문항 행을 FOR SHARE 로 잠근다 — 같은 행의 원문 UPDATE 와 겹치면 한쪽이 기다린다.
--
-- 독립 풀이는 **두 단계**: `csat_review_solve()` 로 원문·선지만 보고 고른 답을 먼저 확정해야
-- `csat_review_reveal()` 이 공식 정답과 분석을 준다. solve 는 한 번만, reveal 은 solve 뒤에만.

begin;

-- ── 실행 기록 ─────────────────────────────────────────────────────────
create table if not exists public.csat_review_runs (
  id                 uuid primary key default gen_random_uuid(),
  item_id            text not null references public.csat_items(id) on delete cascade,
  analysis_id        uuid references public.csat_item_analyses(id) on delete cascade,
  role               text not null check (role in ('analyst', 'reviewer')),
  agent_run          text not null check (length(agent_run) >= 8),   -- 에이전트 실행 id
  persona            text check (persona in ('setter', 'analyst', 'tutor')),
  solve_answer       smallint check (solve_answer between 1 and 5),  -- 원문·선지만 보고 고른 답
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

alter table public.csat_item_analyses add column if not exists analyst_run text;

-- ── 독립 검수(회차를 쌓는다) ──────────────────────────────────────────
create table if not exists public.csat_independent_reviews (
  id               uuid primary key default gen_random_uuid(),
  analysis_id      uuid not null references public.csat_item_analyses(id) on delete cascade,
  review_run_id    uuid not null references public.csat_review_runs(id) on delete cascade,
  persona          text not null check (persona in ('setter', 'analyst', 'tutor')),
  verdict          text not null check (verdict in ('pass', 'revise', 'fail')),
  findings         jsonb not null default '[]',
  checked          jsonb not null default '[]',
  item_input_hash  text,
  item_answer_hash text,
  analysis_hash    text,
  reviewed_at      timestamptz,
  unique (analysis_id, persona, review_run_id)
);
create index if not exists csat_independent_reviews_analysis_idx on public.csat_independent_reviews(analysis_id);
alter table public.csat_independent_reviews enable row level security;
revoke all on public.csat_independent_reviews from anon, authenticated;

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
create or replace function public.csat_review_solve(p_run uuid, p_answer smallint, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare r csat_review_runs;
begin
  select * into r from csat_review_runs where id = p_run for update;
  if r.id is null or r.role <> 'reviewer' then raise exception '검수 실행이 아니다: %', p_run; end if;
  if r.solve_committed_at is not null then raise exception '독립 풀이는 한 번만 확정한다: %', p_run; end if;
  update csat_review_runs
     set solve_answer = p_answer, solve_note = p_note,
         solve_input_hash = csat_item_input_hash(r.item_id), solve_committed_at = clock_timestamp()
   where id = p_run;
end $$;
create or replace function public.csat_review_reveal(p_run uuid)
returns table(answer smallint, answers smallint[], analysis_id uuid, analysis jsonb)
language plpgsql security definer set search_path = public as $$
declare r csat_review_runs;
begin
  select * into r from csat_review_runs where id = p_run for update;
  if r.solve_committed_at is null then raise exception '독립 풀이를 먼저 확정해야 공개한다: %', p_run; end if;
  update csat_review_runs set revealed_at = coalesce(revealed_at, clock_timestamp()) where id = p_run;
  return query
    select i.answer::smallint, i.answers::smallint[], a.id, to_jsonb(a) - 'status'
      from csat_items i join csat_item_analyses a on a.id = r.analysis_id where i.id = r.item_id;
end $$;
revoke all on function public.csat_review_solve(uuid, smallint, text), public.csat_review_reveal(uuid) from public, anon, authenticated;

-- ── 독립 검수 행: 해시·시각 박제 · 불변 ────────────────────────────────
create or replace function public.csat_independent_review_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
declare a csat_item_analyses;
begin
  if tg_op = 'INSERT' then
    select * into a from csat_item_analyses where id = new.analysis_id;
    new.item_input_hash  := csat_item_input_hash(a.item_id);     -- 적재기 값은 버리고 DB 가 박제
    new.item_answer_hash := csat_item_answer_hash(a.item_id);
    new.analysis_hash    := csat_analysis_hash(a);
    new.reviewed_at      := clock_timestamp();                    -- now() 는 트랜잭션 고정이라 공개 뒤임을 못 가린다
    return new;
  end if;
  if (new.item_input_hash, new.item_answer_hash, new.analysis_hash, new.reviewed_at, new.review_run_id, new.analysis_id, new.persona)
     is distinct from (old.item_input_hash, old.item_answer_hash, old.analysis_hash, old.reviewed_at, old.review_run_id, old.analysis_id, old.persona) then
    raise exception '독립 검수 행의 박제 칸은 고칠 수 없다 — 재검수는 새 회차로 추가한다';
  end if;
  return new;
end $$;
drop trigger if exists csat_independent_review_stamp_trg on public.csat_independent_reviews;
create trigger csat_independent_review_stamp_trg before insert or update on public.csat_independent_reviews
  for each row execute function public.csat_independent_review_stamp();

-- ── 발행 게이트 ───────────────────────────────────────────────────────
create or replace function public.csat_guard_published() returns trigger
language plpgsql security definer set search_path = public as $$
declare n_pass int; n_indep int;
begin
  if new.status <> 'published' then return new; end if;
  if not csat_is_hakpyeong_item(new.item_id) then
    -- 평가원: 기존 규칙 그대로(서로 다른 페르소나 3인 pass)
    select count(distinct persona) into n_pass
      from csat_analysis_reviews where analysis_id = new.id and verdict = 'pass';
    if n_pass < 3 then
      raise exception '분석 %: 서로 다른 페르소나 3인의 pass 가 필요하다 (현재 %)', new.item_id, n_pass using errcode = 'check_violation';
    end if;
    return new;
  end if;

  perform 1 from csat_items where id = new.item_id for share;       -- 원문 변경과의 경쟁 차단
  select count(distinct r.persona) into n_indep
    from csat_independent_reviews r
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
drop trigger if exists csat_hold_on_review_withdraw_trg on public.csat_independent_reviews;
create trigger csat_hold_on_review_withdraw_trg after update or delete on public.csat_independent_reviews
  for each row execute function public.csat_hold_on_review_withdraw();

revoke all on function public.csat_item_input_hash(text), public.csat_item_answer_hash(text),
  public.csat_is_hakpyeong_item(text) from public, anon, authenticated;

commit;

-- ── 되돌리기 ──────────────────────────────────────────────────────────
--  drop trigger csat_hold_on_review_withdraw_trg on csat_independent_reviews; drop trigger csat_hold_on_item_change_trg on csat_items;
--  drop trigger csat_hold_on_analysis_change_trg on csat_item_analyses; drop trigger csat_independent_review_stamp_trg on csat_independent_reviews;
--  csat_guard_published 를 이전 정의(csat_analysis_reviews 3 페르소나 pass 만)로 create or replace;
--  drop function csat_review_reveal, csat_review_solve, csat_hold_*, csat_independent_review_stamp, csat_analysis_hash, csat_item_*_hash, csat_is_hakpyeong_item;
--  drop table csat_independent_reviews; alter table csat_item_analyses drop column analyst_run; drop table csat_review_runs;
