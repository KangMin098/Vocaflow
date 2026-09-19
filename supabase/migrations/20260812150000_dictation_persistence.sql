-- supabase/migrations/20260812150000_dictation_persistence.sql
--
-- Dictation v07 — 받아쓰기 영속화 + 학습 자산 연결.
--
-- 왜 필요한가:
--   받아쓰기는 localStorage 전용이라 scores 0행 · learning_records 0행이었다.
--   즉 완주해도 대시보드·홈·주간리포트 어디에도 나타나지 않고 기기를 바꾸면 사라졌다.
--   이 마이그레이션은 세션/시도를 DB 로 옮기고, 어떤 학습 자산(도서 챕터 · 내 스크립트 ·
--   공용 단어장)에서 온 문장인지를 행에 남겨 "무엇으로 받아썼는가"를 추적 가능하게 한다.
--
-- 단어 연결은 여기서 하지 않는다 — 타깃 단어 적중은 클라이언트가 기존
--   flushPendingSrsResults(vocabularies + learning_records) 경로로 보낸다.
--   learning_records INSERT 트리거가 daily_activity 를 자동 갱신하므로 streak 도 따라온다.
--
-- 추가 전용. 기존 테이블/함수 변경 없음.

-- ═══════════════════════════════════════════════════════════════
-- 1. 세션
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.dictation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- 어디서 온 문장인가 (자료 연결의 근거)
  source_kind text not null
    check (source_kind in ('book', 'text', 'set', 'daily', 'custom')),
  text_id uuid references public.texts(id) on delete set null,
  library_book_id uuid references public.library_books(id) on delete set null,
  chapter_idx integer,
  shared_set_id uuid references public.shared_word_sets(id) on delete set null,

  title text not null,
  -- unit/order/scoring/speed/autoRepeat/hintsAllowed 원본 보존 (재현·분석용)
  config jsonb not null default '{}'::jsonb,

  total_items integer not null default 0,
  completed_items integer not null default 0,
  avg_accuracy numeric(5, 2),
  total_hints integer not null default 0,
  duration_ms integer,
  -- 힌트 없이 100% 로 받아쓴 가장 긴 문장의 단어 수 = 청취 폭(listening span).
  -- 정확도(%)와 달리 "한 번에 붙잡을 수 있는 길이"라 성장이 눈에 보이는 지표.
  longest_perfect_words integer,

  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_dictation_sessions_user_started
  on public.dictation_sessions (user_id, started_at desc);
create index if not exists idx_dictation_sessions_user_completed
  on public.dictation_sessions (user_id, completed_at desc)
  where completed_at is not null;

comment on table public.dictation_sessions is
  '받아쓰기 세션 1행. source_kind 로 도서 챕터/내 스크립트/공용 단어장/오늘의 받아쓰기 구분.';
comment on column public.dictation_sessions.longest_perfect_words is
  '힌트 없이 100% 정확히 받아쓴 최장 문장의 단어 수 — 청취 폭 지표.';

-- ═══════════════════════════════════════════════════════════════
-- 2. 문항별 시도
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.dictation_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.dictation_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  item_idx integer not null,
  expected text not null,
  user_input text not null default '',
  accuracy numeric(5, 2) not null default 0,

  hints_used integer not null default 0,
  -- 몇 번 다시 들었는가 — 정확도와 함께 봐야 "쉽게 맞췄는지"를 알 수 있다.
  replay_count integer not null default 0,
  duration_ms integer,
  skipped boolean not null default false,

  -- 단어 정렬 결과 원본 (WordResult[]). 결과 화면 재현 + 사후 분석.
  word_results jsonb not null default '[]'::jsonb,
  -- 학습자가 이해 가능한 오류 태그: article/inflection/contraction/function-word/
  -- spelling/homophone/word-order/missed-target
  error_tags text[] not null default '{}',

  -- 이 문장이 훈련하려던 내 단어들 (도서 챕터 단어장 ∩ 내 vocabularies 등)
  target_words text[] not null default '{}',
  target_hits text[] not null default '{}',

  created_at timestamptz not null default now()
);

create index if not exists idx_dictation_attempts_session
  on public.dictation_attempts (session_id, item_idx);
create index if not exists idx_dictation_attempts_user_created
  on public.dictation_attempts (user_id, created_at desc);
create index if not exists idx_dictation_attempts_error_tags
  on public.dictation_attempts using gin (error_tags);

comment on table public.dictation_attempts is
  '받아쓰기 문항 1시도. error_tags 누적이 약점 리포트의 원천.';

-- ═══════════════════════════════════════════════════════════════
-- 3. RLS — 본인 행만
-- ═══════════════════════════════════════════════════════════════

alter table public.dictation_sessions enable row level security;
alter table public.dictation_attempts enable row level security;

drop policy if exists dictation_sessions_own on public.dictation_sessions;
create policy dictation_sessions_own on public.dictation_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists dictation_attempts_own on public.dictation_attempts;
create policy dictation_attempts_own on public.dictation_attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- 4. 통계 RPC — 허브가 한 번에 읽는다 (라운드트립 3회 → 1회)
-- ═══════════════════════════════════════════════════════════════

-- 연속 학습일 · 청취 폭 · 이번 주 정확도 · 누적 문장 · 완주 세션 수
create or replace function public.dictation_overview()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_streak integer := 0;
  v_day date;
  v_result jsonb;
begin
  if v_user is null then
    return jsonb_build_object(
      'streak', 0, 'span', 0, 'weekly_accuracy', null,
      'total_sentences', 0, 'total_sessions', 0, 'best_accuracy', null
    );
  end if;

  -- 받아쓰기 자체의 연속일 (daily_activity 전체 학습 streak 과 구분 — 이 모듈의 습관).
  -- KST 기준 date 로 오늘부터 거꾸로 훑는다.
  v_day := ((now() at time zone 'Asia/Seoul')::date);
  loop
    exit when v_streak >= 400; -- 안전 상한 (하루 1쿼리 루프)
    exit when not exists (
      select 1 from public.dictation_sessions
      where user_id = v_user
        and completed_at is not null
        and ((completed_at at time zone 'Asia/Seoul')::date) = v_day
    );
    v_streak := v_streak + 1;
    v_day := v_day - 1;
  end loop;

  -- 오늘 아직 안 했으면 어제부터 이어지는 연속을 보여준다 (오늘치가 0이라고 끊긴 건 아니다)
  if v_streak = 0 then
    v_day := ((now() at time zone 'Asia/Seoul')::date) - 1;
    loop
      exit when v_streak >= 400;
      exit when not exists (
        select 1 from public.dictation_sessions
        where user_id = v_user
          and completed_at is not null
          and ((completed_at at time zone 'Asia/Seoul')::date) = v_day
      );
      v_streak := v_streak + 1;
      v_day := v_day - 1;
    end loop;
  end if;

  select jsonb_build_object(
    'streak', v_streak,
    'span', coalesce(max(s.longest_perfect_words), 0),
    'weekly_accuracy', (
      select round(avg(s2.avg_accuracy), 1)
      from public.dictation_sessions s2
      where s2.user_id = v_user
        and s2.completed_at is not null
        and s2.completed_at > now() - interval '7 days'
    ),
    'total_sentences', coalesce(sum(s.completed_items), 0),
    'total_sessions', count(*),
    'best_accuracy', round(max(s.avg_accuracy), 1)
  ) into v_result
  from public.dictation_sessions s
  where s.user_id = v_user and s.completed_at is not null;

  return coalesce(v_result, jsonb_build_object(
    'streak', v_streak, 'span', 0, 'weekly_accuracy', null,
    'total_sentences', 0, 'total_sessions', 0, 'best_accuracy', null
  ));
end;
$$;

comment on function public.dictation_overview() is
  '받아쓰기 허브 요약 — 연속일/청취 폭/주간 정확도/누적. auth.uid() 기준.';

-- 최근 N 일 오류 태그 빈도 — "요즘 자주 놓치는 것"
create or replace function public.dictation_weakness(p_days integer default 14)
returns table (tag text, hits bigint, sample_expected text, sample_actual text)
language sql
security invoker
set search_path = public
as $$
  with tagged as (
    select unnest(a.error_tags) as tag, a.id, a.created_at, a.expected, a.user_input
    from public.dictation_attempts a
    where a.user_id = auth.uid()
      and a.created_at > now() - make_interval(days => greatest(p_days, 1))
      and array_length(a.error_tags, 1) > 0
  ),
  counts as (
    select tag, count(*)::bigint as hits from tagged group by tag
  ),
  -- 태그별 가장 최근 1건만 예시로 (join 전 축약 — counts 와 곱해지지 않게)
  latest as (
    select distinct on (tag) tag, expected, user_input
    from tagged
    order by tag, created_at desc
  )
  select c.tag, c.hits, l.expected as sample_expected, l.user_input as sample_actual
  from counts c
  join latest l on l.tag = c.tag
  order by c.hits desc, c.tag
  limit 6;
$$;

comment on function public.dictation_weakness(integer) is
  '최근 p_days 일 오류 태그 빈도 Top6 + 가장 최근 예시 1쌍.';

-- 최근 놓친 문장 — 오늘의 받아쓰기 "재도전" 슬롯의 원천
create or replace function public.dictation_recent_misses(p_limit integer default 5)
returns table (
  expected text,
  accuracy numeric,
  target_words text[],
  session_title text,
  attempted_at timestamptz
)
language sql
security invoker
set search_path = public
as $$
  select distinct on (a.expected)
         a.expected,
         a.accuracy,
         a.target_words,
         s.title as session_title,
         a.created_at as attempted_at
  from public.dictation_attempts a
  join public.dictation_sessions s on s.id = a.session_id
  where a.user_id = auth.uid()
    and a.accuracy < 85
    and a.created_at > now() - interval '30 days'
    and length(a.expected) between 12 and 400
  order by a.expected, a.created_at desc
  limit greatest(p_limit, 1);
$$;

comment on function public.dictation_recent_misses(integer) is
  '최근 30일 85% 미만으로 받아쓴 문장 — 재도전 큐 원천. 문장별 최신 1건.';

grant execute on function public.dictation_overview() to authenticated;
grant execute on function public.dictation_weakness(integer) to authenticated;
grant execute on function public.dictation_recent_misses(integer) to authenticated;
