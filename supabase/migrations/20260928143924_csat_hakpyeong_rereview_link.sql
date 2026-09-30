-- supabase/migrations/20260928143924_csat_hakpyeong_rereview_link.sql
--
-- **학평 독립 검수 게이트 v2 — 분석만 바뀐 재검수는 최초 블라인드 풀이에 잇는다** (2026-09-28 사용자 승인 · 적용)
--
-- 왜: 분석을 교정하면 분석 해시가 바뀌어 기존 pass 는 무효가 된다(의도). 그런데 원문·선지·공식 정답이
-- 그대로라면, 검수자가 정답을 보기 **전에** 확정한 최초 풀이는 여전히 유효한 증거다. 매 교정마다
-- 블라인드 풀이를 새로 시키면 비용만 들고, 이미 정답을 본 검수자의 «새 블라인드 풀이» 는 증거가 아니다.
--
-- 규칙:
--   · 검수 실행에 종류를 둔다 — blind(처음: solve → reveal → submit) · rereview(재검수: 풀이 없이 reveal → submit)
--   · rereview 는 반드시 **같은 문항 · 같은 페르소나의 blind 실행**(parent)에 묶인다
--   · 게이트는 rereview 를 다음일 때만 센다:
--       parent 가 solve_committed_at < revealed_at 이고,
--       parent 풀이 당시의 입력 해시·정답 해시가 **지금** 해시와 같고(원문·선지·정답이 바뀌었으면 무효 → 새 blind 필요),
--       parent·rereview 실행 주체 모두 새 분석의 analyst_run 과 다르며,
--       rereview 판정이 reveal 뒤에 기록됐고 박제 해시(입력·정답·분석)가 지금과 같다
--   · 정답을 이미 본 검수자의 재검수를 blind 로 기록하는 길은 없다(rereview 는 solve 불가)
--   · 기존 blind 경로는 그대로다
--
-- 풀이 당시의 정답 해시를 알아야 하므로 solve 가 정답 해시도 박제한다(solve_answer_hash).
-- 이 마이그레이션 이전의 blind 실행 18건은 정답 해시를 박제하지 않았다. csat_items 에는 수정 시각이 없어
-- "그 사이 정답이 안 바뀌었다" 를 직접 증명할 수 없다. 대신 **풀이 답 = 지금 정답(단일 정답)** 인 실행만 채운다 —
-- 파일럿 18건은 공개 때 정답과 18/18 일치했으므로(2026-09-28 실측), 지금도 같으면 공개 당시 정답과 같다.
-- 다르면 채우지 않는다(그 실행은 재검수 parent 가 될 수 없고, 새 blind 가 필요하다).
-- 채운 행은 solve_answer_hash_backfilled = true 로 표시해 출처를 숨기지 않는다.

begin;

alter table public.csat_review_runs
  add column if not exists kind text not null default 'blind',
  add column if not exists parent_run_id uuid references public.csat_review_runs(id),
  add column if not exists solve_answer_hash text,
  add column if not exists solve_answer_hash_backfilled boolean not null default false;
alter table public.csat_review_runs drop constraint if exists csat_review_runs_kind_check;
alter table public.csat_review_runs add constraint csat_review_runs_kind_check check (
  kind in ('blind', 'rereview')
  and (kind = 'blind' or (parent_run_id is not null and solve_answer is null and solve_committed_at is null))
);

update public.csat_review_runs r
   set solve_answer_hash = public.csat_item_answer_hash(r.item_id), solve_answer_hash_backfilled = true
  from public.csat_items i
 where i.id = r.item_id and r.kind = 'blind' and r.solve_committed_at is not null and r.solve_answer_hash is null
   and i.answer = r.solve_answer and i.answers = array[r.solve_answer::int];

-- rereview 삽입 검증: parent 는 같은 문항·같은 페르소나의 풀이·공개가 끝난 blind 여야 한다
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
  end if;
  return new;
end $$;
drop trigger if exists csat_review_run_check_trg on public.csat_review_runs;
create trigger csat_review_run_check_trg before insert on public.csat_review_runs
  for each row execute function public.csat_review_run_check();

-- solve: blind 만, 정답 해시도 박제
create or replace function public.csat_review_solve(p_run uuid, p_answer smallint, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare r csat_review_runs;
begin
  select * into r from csat_review_runs where id = p_run for update;
  if r.id is null or r.role <> 'reviewer' then raise exception '검수 실행이 아니다: %', p_run; end if;
  if r.kind <> 'blind' then raise exception '재검수 실행은 풀이를 확정하지 않는다(이미 정답을 본 검수다): %', p_run; end if;
  if r.solve_committed_at is not null then raise exception '독립 풀이는 한 번만 확정한다: %', p_run; end if;
  update csat_review_runs
     set solve_answer = p_answer, solve_note = p_note,
         solve_input_hash = csat_item_input_hash(r.item_id), solve_answer_hash = csat_item_answer_hash(r.item_id),
         solve_committed_at = clock_timestamp()
   where id = p_run;
end $$;

-- reveal: blind 는 풀이 뒤에만 · rereview 는 parent 가 풀이·공개를 마쳤을 때만
create or replace function public.csat_review_reveal(p_run uuid)
returns table(answer smallint, answers smallint[], analysis_id uuid, analysis jsonb)
language plpgsql security definer set search_path = public as $$
declare r csat_review_runs; p csat_review_runs;
begin
  select * into r from csat_review_runs where id = p_run for update;
  if r.kind = 'rereview' then
    select * into p from csat_review_runs where id = r.parent_run_id;
    if p.solve_committed_at is null or p.revealed_at is null then raise exception '재검수 parent 의 풀이·공개가 끝나지 않았다: %', p_run; end if;
  elsif r.solve_committed_at is null then
    raise exception '독립 풀이를 먼저 확정해야 공개한다: %', p_run;
  end if;
  update csat_review_runs set revealed_at = coalesce(revealed_at, clock_timestamp()) where id = p_run;
  return query
    select i.answer::smallint, i.answers::smallint[], a.id, to_jsonb(a) - 'status'
      from csat_items i join csat_item_analyses a on a.id = r.analysis_id where i.id = r.item_id;
end $$;

-- 게이트: blind 경로 + rereview 경로
create or replace function public.csat_guard_published() returns trigger
language plpgsql security definer set search_path = public as $$
declare n_pass int; n_indep int; cur_in text; cur_ans text; cur_an text;
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

  perform 1 from csat_items where id = new.item_id for share;
  cur_in := csat_item_input_hash(new.item_id);
  cur_ans := csat_item_answer_hash(new.item_id);
  cur_an := csat_analysis_hash(new);
  select count(distinct r.persona) into n_indep
    from csat_independent_reviews r
    join csat_review_runs run on run.id = r.review_run_id
    left join csat_review_runs par on par.id = run.parent_run_id
   where r.analysis_id = new.id and r.verdict = 'pass'
     and run.role = 'reviewer' and run.analysis_id = new.id and run.persona = r.persona
     and new.analyst_run is not null and run.agent_run <> new.analyst_run
     and run.revealed_at is not null and run.revealed_at <= r.reviewed_at
     and r.item_input_hash = cur_in and r.item_answer_hash = cur_ans and r.analysis_hash = cur_an
     and (
       -- blind: 이 실행이 풀고 → 공개받았다
       (run.kind = 'blind' and run.solve_committed_at is not null and run.solve_committed_at < run.revealed_at)
       or
       -- rereview: 최초 blind 풀이가 지금과 같은 원문·정답 위에서 공개 전에 확정됐다
       (run.kind = 'rereview' and par.kind = 'blind' and par.item_id = new.item_id and par.persona = r.persona
        and par.solve_committed_at is not null and par.revealed_at is not null and par.solve_committed_at < par.revealed_at
        and par.solve_input_hash = cur_in and par.solve_answer_hash = cur_ans
        and par.agent_run <> new.analyst_run)
     );
  if n_indep < 3 then
    raise exception '학평 분석 %: 독립 검수 3인이 필요하다(자기 검수·풀이 전 공개·원문/정답/분석 변경 뒤 승인은 무효) — 현재 %', new.item_id, n_indep
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

revoke all on function public.csat_review_run_check(), public.csat_guard_published() from public, anon, authenticated;
revoke all on function public.csat_review_solve(uuid, smallint, text), public.csat_review_reveal(uuid) from public, anon, authenticated;

commit;

-- ── 되돌리기 ──────────────────────────────────────────────────────────
--  drop trigger csat_review_run_check_trg on csat_review_runs; drop function csat_review_run_check();
--  csat_review_solve · csat_review_reveal · csat_guard_published 를 20260928141215 정의로 create or replace;
--  alter table csat_review_runs drop constraint csat_review_runs_kind_check,
--    drop column solve_answer_hash_backfilled, drop column solve_answer_hash, drop column parent_run_id, drop column kind;
--  (rereview 실행·검수 행이 이미 있으면 먼저 지워야 한다 — 그 검수로 발행된 분석은 게이트가 다시 막는다)
