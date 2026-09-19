-- supabase/migrations/20260825120000_game_ranking.sql
--
-- Game Lab 랭킹 — 게임별 리더보드 + 종합 랭크.
--
-- ══ 왜 RPC 인가 ═══════════════════════════════════════════════════════════
-- `scores` 의 RLS 는 `auth.uid() = user_id` 단 하나다. 즉 **자기 행만 보인다.**
-- 리더보드는 원리적으로 남의 기록을 읽어야 하므로 RLS 를 뚫는 길이 필요하고,
-- 그 길은 정책을 넓히는 것이 아니라 **집계만 돌려주는 SECURITY DEFINER 함수**여야 한다.
-- 정책을 "모두 읽기" 로 넓히면 남의 학습 이력(어느 도서를 언제 몇 점에)이 통째로 열린다.
-- 아래 함수들은 원본 행을 절대 반환하지 않는다 — 순위·최고점·판수·별칭뿐이다.
--
-- ══ 왜 별칭인가 ═══════════════════════════════════════════════════════════
-- `user_profiles.display_name` 은 실명일 수 있다. 리더보드에 실명을 **기본값으로**
-- 올리는 것은 학습자가 동의한 적 없는 공개다. 그래서 기본은 user_id 에서 결정론적으로
-- 만든 별칭이고, 실명 공개와 완전 비공개는 학습자가 고른다(`leaderboard_visibility`).
--
-- ══ 왜 점수를 게임별로만 비교하는가 ════════════════════════════════════════
-- 실측(2026-08-25 · scores 43행): 같은 "점수" 가 게임마다 전혀 다른 단위다 —
-- cascade 0~900 · pairflip 0~1460 · scriptquiz 0~40. 게다가 한 판의 점수는
-- **풀 크기와 세션 길이에 비례**한다(도서 챕터 중앙값 4단어 vs 주제 단어장 21단어).
-- 그래서 원점수 하나로 전 게임을 줄 세우면 "누가 큰 단어장을 골랐나" 를 재게 된다.
--   · 게임별 리더보드 → 원점수 비교 (같은 게임 안에서는 단위가 같다)
--   · 종합 랭크      → 게임별 **백분위의 평균** (단위를 지운 뒤에만 합산한다)
--
-- ══ 표본이 작다는 사실을 숨기지 않는다 ═══════════════════════════════════
-- 지금 이 DB 의 게임 기록은 43행·2명이다. 그 상태에서 "1위" 를 성취처럼 보여 주면
-- 거짓이다. 모든 함수가 `player_count` 를 함께 돌려주고, 화면은 그것을 반드시 표기한다.

-- ── 1. 리더보드 표시 설정 ────────────────────────────────────────────────

alter table public.user_profiles
  add column if not exists leaderboard_visibility text not null default 'alias';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_leaderboard_visibility_check'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_leaderboard_visibility_check
      check (leaderboard_visibility in ('alias', 'name', 'hidden'));
  end if;
end $$;

comment on column public.user_profiles.leaderboard_visibility is
  'Game Lab 리더보드 표시: alias(기본·결정론적 별칭) · name(display_name 공개) · hidden(순위에서 제외)';

-- ── 2. 인덱스 ────────────────────────────────────────────────────────────
-- 기존 인덱스는 전부 user_id 선행이라 "이 게임의 전체 상위" 질의에 쓸 수 없다.

create index if not exists idx_scores_module_created
  on public.scores (module, created_at desc);

-- ── 3. 별칭 ──────────────────────────────────────────────────────────────
--
-- user_id 에서 결정론적으로 만든다 — 저장하지 않으므로 마이그레이션이 백필을 하지 않고,
-- 같은 학습자는 언제나 같은 이름으로 보인다. 형용사×명사×숫자 = 20×20×100 = 40,000 조합.
-- 충돌은 가능하지만 리더보드 표시용 라벨이지 식별자가 아니다(식별은 rank 행의 is_me).

create or replace function public.game_rank_alias(p_user_id uuid)
returns text
language sql
immutable
as $$
  select (array[
    '고요한','재빠른','성실한','또렷한','느긋한','단단한','유연한','깊은','밝은','서늘한',
    '꾸준한','다정한','날카로운','묵묵한','환한','잔잔한','씩씩한','부드러운','또랑한','호젓한'
  ])[1 + (('x' || substr(md5(p_user_id::text), 1, 4))::bit(16)::int % 20)]
  || ' ' ||
  (array[
    '여우','수달','올빼미','고래','사슴','두루미','너구리','다람쥐','바다거북','산양',
    '기러기','물총새','살쾡이','물범','청둥오리','부엉이','노루','수리','해오라기','들고양이'
  ])[1 + (('x' || substr(md5(p_user_id::text), 5, 4))::bit(16)::int % 20)]
  || ' ' ||
  lpad((('x' || substr(md5(p_user_id::text), 9, 4))::bit(16)::int % 1000)::text, 3, '0');
$$;

comment on function public.game_rank_alias(uuid) is
  '리더보드 표시용 결정론적 별칭. 저장하지 않는다 — 같은 user_id 면 언제나 같은 이름.';

-- ── 4. 기간 창 ───────────────────────────────────────────────────────────
--
-- 주간은 KST 월요일 0시부터. 서버가 UTC 라 `date_trunc('week', now())` 를 그냥 쓰면
-- 한국 학습자에게는 월요일 오전 9시에 주가 바뀐다.

create or replace function public.game_rank_window(p_period text)
returns timestamptz
language sql
immutable
as $$
  select case p_period
    when 'week'  then (date_trunc('week', (now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul')
    when 'month' then (date_trunc('month', (now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul')
    else '-infinity'::timestamptz
  end;
$$;

-- ── 5. 게임별 리더보드 ───────────────────────────────────────────────────

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
  v_since timestamptz := public.game_rank_window(p_period);
  v_me    uuid        := auth.uid();
begin
  -- 상한을 강제한다 — 인자로 전체 테이블을 긁어 가지 못하게.
  p_limit := least(greatest(coalesce(p_limit, 10), 1), 100);

  return query
  with bests as (
    select
      s.user_id,
      max(s.score)                       as best_score,
      count(*)                           as plays,
      max(s.accuracy)                    as best_accuracy,
      max(s.created_at)                  as last_played
    from public.scores s
    join public.user_profiles p on p.user_id = s.user_id
    where s.module::text = p_module
      and s.created_at >= v_since
      -- 'hidden' 은 순위에서 통째로 빠진다. 본인에게도 안 보인다 —
      -- 순위표에 안 나오기로 한 사람이 자기 화면에서만 보이면 그건 다른 사람의 순위를 흔든다.
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
    -- 비로그인(auth.uid() = null)이면 `r.user_id = v_me` 는 null 이다. 3값 논리가
    -- 클라이언트로 새어 나가면 boolean 으로 다룰 수 없으므로 여기서 닫는다.
    coalesce(r.user_id = v_me, false),
    r.total
  from ranked r
  join public.user_profiles pr on pr.user_id = r.user_id
  where r.rnk <= p_limit
     -- 내 행은 상위 밖이어도 함께 돌려준다. "내가 몇 등인지" 를 모르는 순위표는
     -- 동기 장치가 아니라 남의 기록 구경이다.
     or r.user_id = v_me
  order by r.rnk;
end;
$$;

comment on function public.game_leaderboard(text, text, int) is
  '게임 하나의 상위 N + 내 행. 원본 scores 행은 반환하지 않는다(집계만). player_count 로 표본 크기 동반.';

-- ── 6. 내 랭크 요약 (전 게임) ────────────────────────────────────────────
--
-- 종합 랭크는 원점수를 더하지 않는다 — 게임마다 단위가 다르기 때문이다(헤더 참조).
-- 게임별로 "내 최고가 그 게임 참가자 중 몇 %인가" 를 구한 뒤 평균한다.

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
  with bests as (
    select s.module::text as m, s.user_id, max(s.score) as best, count(*) as plays
    from public.scores s
    join public.user_profiles p on p.user_id = s.user_id
    where s.created_at >= v_since
      and p.leaderboard_visibility <> 'hidden'
    group by s.module::text, s.user_id
  ),
  ranked as (
    select b.*,
      rank() over (partition by b.m order by b.best desc) as rnk,
      count(*) over (partition by b.m) as total
    from bests b
  )
  select
    r.m,
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
  order by r.m;
end;
$$;

comment on function public.game_rank_summary(text) is
  '내가 플레이한 게임별 최고점·순위·백분위. 참가자 1명이면 백분위는 null(거짓 성취 방지).';

-- ── 7. 권한 ──────────────────────────────────────────────────────────────
-- anon 에게는 주지 않는다. /arcade 카탈로그는 공개지만 순위는 로그인 표면이다
-- (비로그인은 `is_me` 가 없어 순위표가 남의 기록 구경으로만 남는다).

revoke all on function public.game_leaderboard(text, text, int) from public, anon;
revoke all on function public.game_rank_summary(text) from public, anon;
grant execute on function public.game_leaderboard(text, text, int) to authenticated;
grant execute on function public.game_rank_summary(text) to authenticated;
grant execute on function public.game_rank_alias(uuid) to authenticated;
grant execute on function public.game_rank_window(text) to authenticated;
