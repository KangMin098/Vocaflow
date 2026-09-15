-- supabase/migrations/20260916021500_csat_trap_attempts.sql
--
-- **오답 감별 훈련의 기록** — ④「내가 되풀이해 걸리는 수법」의 저장소.
--
-- ── 왜 새 표인가 ──────────────────────────────────────────────────────
-- `csat_item_attempts` 가 이미 있지만 **문항을 담을 칸이 없다**: `question_id` · `text_id` ·
-- `dcp_item_id` 가 전부 `uuid` 인데 `csat_items.id` 는 'M2309#42' 같은 **TEXT** 다.
-- 그 표에 TEXT 칸을 덧대면 「어떤 문항 체계의 기록인가」가 행마다 달라져 읽는 쪽이 매번
-- 분기해야 한다. 기출 훈련은 저장할 것이 다르므로(정답 함정 · 고른 함정) 표를 가른다.
--
-- ── 무엇을 남기고 무엇을 안 남기나 ────────────────────────────────────
-- 남기는 것: 누가 · 어느 문항의 몇 번 선지를 · 어떤 수법으로 봤고 · 실제는 무엇이었나.
-- 안 남기는 것: 지문·선지 원문(애초에 훈련 화면에 없다) · 자유 문자열.
--
-- ⚠️ `answer_trap` 에 FK 를 걸지 않는다. 함정 이름은 분석(`csat_item_analyses.choice_analysis`)이
--    쥐고 있고 이름이 바뀔 수 있는데, **과거 기록은 그때의 이름으로 남는 것이 옳다.**
--    지난 답을 소급해 고치면 그건 기록이 아니다.

create table if not exists public.csat_trap_attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  item_id     text not null references public.csat_items(id) on delete cascade,
  -- 몇 번 선지에 대한 판정이었나 — 같은 문항의 다른 오답이 다른 문제가 된다.
  choice      smallint not null,
  answer_trap text not null,
  picked_trap text not null,
  -- 파생이므로 저장 컬럼으로 둔다. 읽는 쪽이 같은 비교를 되풀이하지 않게.
  is_correct  boolean generated always as (answer_trap = picked_trap) stored,
  answered_at timestamptz not null default now()
);

comment on table public.csat_trap_attempts is
  '오답 감별 훈련 기록. 한 행 = 한 문제에 한 번 답한 것. 세트 단위가 아니라 문제 단위로 쌓는다 — 중간에 그만둔 것도 기록이다.';

-- 「내 기록」은 늘 한 사람 것을 최근 순으로 읽는다.
create index if not exists csat_trap_attempts_user_time
  on public.csat_trap_attempts (user_id, answered_at desc);

-- 함정별 집계용 — ④의 분포가 이 색인 위에서 돈다.
create index if not exists csat_trap_attempts_user_trap
  on public.csat_trap_attempts (user_id, answer_trap);

alter table public.csat_trap_attempts enable row level security;

-- 자기 기록만 읽고 쓴다. 남의 성적은 보이지 않는다.
drop policy if exists csat_trap_attempts_own_select on public.csat_trap_attempts;
create policy csat_trap_attempts_own_select on public.csat_trap_attempts
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists csat_trap_attempts_own_insert on public.csat_trap_attempts;
create policy csat_trap_attempts_own_insert on public.csat_trap_attempts
  for insert to authenticated with check (auth.uid() = user_id);

-- ⚠️ update / delete 정책은 **일부러 두지 않는다.** 지난 답을 고칠 수 있으면 기록이 아니다.
--    (RLS 가 켜져 있으므로 정책이 없는 동작은 전부 막힌다.)
