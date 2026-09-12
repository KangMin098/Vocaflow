-- supabase/migrations/20260825140000_game_ranking_plan_fix.sql
--
-- 랭킹 RPC 실행 계획 교정 — 인덱스가 **쓰이지 않고 있었다**.
--
-- ══ 무엇이 문제였나 (EXPLAIN 실측 · 2026-08-25) ═══════════════════════════
--
-- ① `game_leaderboard` 의 `s.module::text = p_module` 은 enum 컬럼을 text 로 캐스팅한다.
--    그 순간 `idx_scores_module_created (module, created_at)` 는 **쓸 수 없는 인덱스**가 된다.
--    실측 계획(enable_seqscan=off 로 강제해도):
--       Index Scan using idx_scores_user_date
--         Index Cond: (created_at >= …)
--         Filter: ((module)::text = 'ghost-race'::text)   ← 인덱스가 아니라 필터
--    즉 전 기간 스캔 후 게임으로 거른다. 바로 앞 마이그레이션에서 이 인덱스를 만들어 놓고
--    정작 함수가 못 쓰게 짜 놨다 — 지금(78행)은 어느 쪽이든 1ms 라 아무 증상이 없고,
--    기록이 쌓인 뒤에야 느려진다. 그래서 **행이 적을 때 고쳐 둔다.**
--
--    enum 끼리 비교하면 두 컬럼이 모두 Index Cond 로 들어간다:
--       Index Scan using idx_scores_module_created
--         Index Cond: ((module = 'ghost-race'::module_id) AND (created_at >= …))
--
-- ② `game_rank_summary` 는 창 안의 `scores` **전체**(모든 게임 · 모든 학습자)를 집계한 뒤
--    맨 마지막에 내 행만 남긴다. 실측: Seq Scan on scores(78행) → 19행으로 집계 → 4행 반환.
--    내 백분위를 구하려면 "그 게임의 모든 참가자" 가 필요한 것은 맞지만,
--    **내가 플레이하지 않은 게임까지** 집계할 이유는 없다. 내 게임 목록으로 먼저 좁힌다.
--
-- ══ 안전 ═══════════════════════════════════════════════════════════════
-- `p_module::module_id` 는 없는 라벨이면 예외를 던진다(22P02). 순위표 하나 때문에 화면이
-- 죽으면 안 되므로 잡아서 **빈 결과**로 돌려준다 — 카탈로그에 없는 slug 로 호출한 쪽의
-- 실수이지, 학습자가 볼 오류가 아니다.

create or replace function public.game_leaderboard(
  p_module text,
  p_period text default 'all',
  p_limit  int  default 10
)
returns table (
  rank          int,
  label         text,
  best_score    int,
  plays         bigint,
  best_accuracy numeric,
  last_played   timestamptz,
  is_me         boolean,
  player_count  bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_since  timestamptz := public.game_rank_window(p_period);
  v_me     uuid        := auth.uid();
  v_module public.module_id;
begin
  p_limit := least(greatest(coalesce(p_limit, 10), 1), 100);

  -- enum 으로 좁힌다(인덱스를 쓰기 위해). 없는 라벨이면 빈 순위표.
  begin
    v_module := p_module::public.module_id;
  exception
    when invalid_text_representation then
      return;
  end;

  return query
  with bests as (
    select
      s.user_id,
      max(s.score)      as best_score,
      count(*)          as plays,
      max(s.accuracy)   as best_accuracy,
      max(s.created_at) as last_played
    from public.scores s
    join public.user_profiles p on p.user_id = s.user_id
    where s.module = v_module
      and s.created_at >= v_since
      and p.leaderboard_visibility <> 'hidden'
    group by s.user_id
  ),
  ranked as (
    select
      b.*,
      rank() over (order by b.best_score desc, b.last_played asc) as rnk,
      count(*) over () as total
    from bests b
  )
  select
    r.rnk::int,
    case
      when pr.leaderboard_visibility = 'name' and coalesce(nullif(btrim(pr.display_name), ''), '') <> ''
        then pr.display_name
      else public.game_rank_alias(r.user_id)
    end,
    r.best_score,
    r.plays,
    r.best_accuracy,
    r.last_played,
    coalesce(r.user_id = v_me, false),
    r.total
  from ranked r
  join public.user_profiles pr on pr.user_id = r.user_id
  where r.rnk <= p_limit
     or r.user_id = v_me
  order by r.rnk;
end;
$$;

comment on function public.game_leaderboard(text, text, int) is
  '게임 하나의 상위 N + 내 행(집계만 반환). module 을 enum 으로 좁혀 idx_scores_module_created 를 쓴다.';

create or replace function public.game_rank_summary(p_period text default 'all')
returns table (
  module          text,
  best_score      int,
  plays           bigint,
  my_rank         int,
  player_count    bigint,
  percentile      numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_since timestamptz := public.game_rank_window(p_period);
  v_me    uuid        := auth.uid();
begin
  if v_me is null then
    return;
  end if;

  return query
  -- 내가 플레이한 게임만 — 백분위에는 그 게임의 전 참가자가 필요하지만,
  -- 내가 안 한 게임까지 집계할 이유는 없다(이전 판은 창 안의 scores 전체를 훑었다).
  with my_modules as (
    select distinct s.module
    from public.scores s
    where s.user_id = v_me
      and s.created_at >= v_since
  ),
  bests as (
    select s.module as m, s.user_id, max(s.score) as best, count(*) as plays
    from public.scores s
    join public.user_profiles p on p.user_id = s.user_id
    where s.created_at >= v_since
      and s.module in (select mm.module from my_modules mm)
      and p.leaderboard_visibility <> 'hidden'
    group by s.module, s.user_id
  ),
  ranked as (
    select b.*,
      rank() over (partition by b.m order by b.best desc) as rnk,
      count(*) over (partition by b.m) as total
    from bests b
  )
  select
    r.m::text,
    r.best::int,
    r.plays,
    r.rnk::int,
    r.total,
    -- 참가자가 1명이면 백분위는 정의되지 않는다. 100 으로 적으면 "전체 1위" 라는
    -- 거짓 성취가 되므로 null 을 준다 — 화면은 이때 순위 대신 개인 최고만 말한다.
    case when r.total > 1
      then round(100.0 * (r.total - r.rnk) / (r.total - 1), 1)
      else null
    end
  from ranked r
  where r.user_id = v_me
  order by r.m::text;
end;
$$;

comment on function public.game_rank_summary(text) is
  '내가 플레이한 게임별 최고점·순위·백분위. 내 게임 목록으로 먼저 좁힌다(창 전체 집계 금지). 참가자 1명이면 백분위 null.';

revoke all on function public.game_leaderboard(text, text, int) from public, anon;
revoke all on function public.game_rank_summary(text) from public, anon;
grant execute on function public.game_leaderboard(text, text, int) to authenticated;
grant execute on function public.game_rank_summary(text) to authenticated;
