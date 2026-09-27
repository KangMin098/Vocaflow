-- 20260923205725_csat_source_eligibility_uses.sql
--
-- **① 교재 재료 태그를 판정 캐시에 싣는다. ② 드레인 실행의 끝 시각을 DB 가 찍는다.**
--
-- ── ① uses ─────────────────────────────────────────────────────────────────
-- 판정 원본은 `library_articles.csat_fit->gate->uses` 다(8,051편 실측 2026-09-23).
-- 그런데 조회 화면은 `csat_source_eligibility` 만 읽는다 — 원본을 조인하면 10만 행
-- jsonb 를 매 질의 훑어야 하고, PostgREST 의 1,000행 상한과 겹쳐 쪽 넘김이 깨진다.
-- 그래서 **투영**한다. 쓰는 곳은 `source-policy-refresh.mjs` 한 곳뿐이고,
-- `source-policy-batch.mjs` 의 changedFields 가 이 컬럼을 감시한다(빠지면 태그만 바뀐
-- 행이 「변경 없음」으로 걸러져 영영 안 써진다).
--
-- ⚠️ **NULL 과 빈 배열은 다른 뜻이다.** NULL = 아직 판정이 안 실렸다(87,720 중 79,669편).
--    '{}' = 반려돼서 뽑을 재료가 없다(705편). 둘을 같게 만들면 조회에서 「안 본 것」과
--    「봤는데 없는 것」이 섞이고, 그 구별이 바로 이 화면을 만든 이유다.
--
-- GIN 인덱스는 `uses @> '{argument}'`(PostgREST 의 `contains`)를 위한 것이다.
-- 8종뿐이라 선택도가 낮아 보이지만, 조회는 늘 등급·학령과 **겹쳐서** 걸린다.
--
-- ── ② 드레인 끝 시각 ───────────────────────────────────────────────────────
-- `started_at` 은 DB 의 now(), 끝 시각은 드레인을 돌리는 기계의 시계였다.
-- 실측(2026-09-23 첫 기록): 소요 **-1.08초**. 화면이 「끝난 뒤에 시작한 실행」을 그린다.
-- 시계를 둘 쓰면 언젠가 이렇게 된다 — 한쪽(DB)만 쓰게 만든다.
-- 트리거는 status 가 running 을 벗어나는 순간 now() 를 찍는다. 클라이언트가 보낸 값은
-- 무시된다(보내도 무해하다 — 그래서 스크립트를 먼저 고쳐 둘 수 있었다).
--
-- 되돌리기:
--   alter table public.csat_source_eligibility drop column uses;
--   drop trigger csat_drain_runs_stamp_finished on public.csat_drain_runs;
--   drop function public.csat_drain_runs_stamp_finished();
-- 잃는 것은 투영된 태그(원본은 csat_fit 에 그대로 있다)와 끝 시각 자동 기록뿐이다.

-- ① ─────────────────────────────────────────────────────────────────────────
alter table public.csat_source_eligibility
  add column if not exists uses text[];

create index if not exists csat_source_eligibility_uses_idx
  on public.csat_source_eligibility using gin (uses);

comment on column public.csat_source_eligibility.uses is
  '이 원문으로 만들 수 있는 교재 재료(gate-rules.mjs 의 SOURCE_USES 8종). csat_fit->gate->uses 의 투영이며 정본이 아니다. NULL = 아직 판정 안 실림, ''{}'' = 반려돼 재료 없음 — 둘은 다른 뜻이다.';

-- ② ─────────────────────────────────────────────────────────────────────────
create or replace function public.csat_drain_runs_stamp_finished()
returns trigger
language plpgsql
as $$
begin
  -- 끝난 실행에만 찍는다. running 으로 되돌리는 경로는 없지만, 있더라도 시각을 지운다.
  if new.status = 'running' then
    new.finished_at := null;
  elsif old.status = 'running' or new.finished_at is null then
    new.finished_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists csat_drain_runs_stamp_finished on public.csat_drain_runs;

create trigger csat_drain_runs_stamp_finished
  before update on public.csat_drain_runs
  for each row
  execute function public.csat_drain_runs_stamp_finished();

comment on function public.csat_drain_runs_stamp_finished() is
  '드레인 끝 시각을 DB 시계로 찍는다. 클라이언트 시계와 섞이면 소요가 음수가 된다(실측 -1.08초, 2026-09-23).';
