-- 20260923060100_csat_drain_runs.sql
--
-- **드레인 실행 기록** — 「마지막에 무엇이 돌았고 몇 개를 건너뛰었나」 (DD-69 B2·B3).
--
-- ── 왜 필요한가 (실측 2026-09-23) ───────────────────────────────────
-- 교재 공장 화면 11개 중 **드레인을 실행할 수 있는 곳은 0곳**이고, 명령은 전부 복사해서
-- 터미널에 붙이는 문자열이다. 그래서 화면은 「이 명령을 돌려라」까지만 말하고
-- **「그 명령이 이미 돌았는지」는 모른다.** 관리자는 안 해도 될 일을 다시 하거나,
-- 돌다 실패한 것을 돌았다고 여긴다.
--
-- 같은 Admin 안의 CCP 는 이 문제를 이미 풀어 두었다 — `admin/comic/[bookId]/drain` 이
-- 실행 상태 · 진행 · 실패 사유를 화면에 낸다. 교재 공장에는 그 대응물이 없었다.
--
-- ── 「건너뛴 수」가 왜 컬럼인가 ──────────────────────────────────────
-- 이 저장소의 드레인 규약은 **재실행 안전**이고, 그 증거는 「몇 개를 건너뛰었나」다.
-- 실측 2026-09-13: `analysis-drain-import` 의 재실행 안전이 **사실이 아니었고**
-- (jsonb 키 순서 때문에 늘 「다르다」가 나와 전량 적재가 802행을 더했다) 그것을 아무도
-- 몇 달간 못 봤다 — 건너뛴 수가 화면에 남지 않았기 때문이다.
-- 이 컬럼이 있으면 「두 번째 실행에서 건너뜀 0」이 곧바로 눈에 띈다.
--
-- ── 왜 상태가 셋뿐인가 ──────────────────────────────────────────────
-- running · ok · failed. 「부분 성공」을 따로 두지 않는다 — 부분 성공은
-- `items_done < items_total` 로 이미 보이고, 별도 상태를 만들면 그 경계가 스크립트마다 갈린다.
--
-- 되돌리기: `drop table public.csat_drain_runs;` — 잃는 것은 실행 이력뿐이다.

create table if not exists public.csat_drain_runs (
  id            uuid primary key default gen_random_uuid(),

  -- csat_pipeline_approvals.stage 와 같은 목록이다. 갈리면 두 화면이 다른 단계를 말한다.
  stage         text not null check (stage in (
                  'evidence', 'source', 'market', 'blueprint',
                  'material', 'author', 'explain', 'review', 'press')),

  -- 저장소에 실제로 있는 파일 경로. 없는 명령을 적으면 관리자가 터미널에서 막힌다
  -- (`factory-model.ts` 머리말의 같은 규칙 — 회귀가 파일 존재를 실측한다).
  script        text not null check (script like 'scripts/%'),
  args          text,

  -- 3단 구조의 어느 칸인가. render 는 조판(⑧)처럼 에이전트 몫이 없는 실행이다.
  mode          text not null check (mode in ('export', 'agent', 'validate', 'import', 'render')),

  status        text not null default 'running' check (status in ('running', 'ok', 'failed')),

  started_at    timestamptz not null default now(),
  finished_at   timestamptz,

  items_total   integer check (items_total   is null or items_total   >= 0),
  items_done    integer check (items_done    is null or items_done    >= 0),
  -- ⚠️ 재실행 안전의 증거. null = 「안 셌다」이고 0 과 다르다.
  items_skipped integer check (items_skipped is null or items_skipped >= 0),

  error         text,
  run_by        text,

  -- 끝난 실행은 끝난 시각을 갖는다. 안 그러면 「running 인 채 영원히」가 쌓이고,
  -- 화면은 그것을 「지금 돌고 있다」로 읽는다.
  constraint csat_drain_runs_finished_when_settled
    check (status = 'running' or finished_at is not null),
  constraint csat_drain_runs_error_when_failed
    check (status <> 'failed' or (error is not null and length(btrim(error)) > 0))
);

-- 화면의 질의: 「이 단계의 마지막 실행」.
create index if not exists csat_drain_runs_stage_idx
  on public.csat_drain_runs (stage, started_at desc);

-- 「지금 돌고 있는 것」 — 화면이 5초마다 되묻는다(CCP 드레인 콘솔과 같은 모양).
create index if not exists csat_drain_runs_running_idx
  on public.csat_drain_runs (status, started_at desc)
  where status = 'running';

alter table public.csat_drain_runs enable row level security;

comment on table public.csat_drain_runs is
  '드레인 실행 기록. 화면이 「그 명령이 이미 돌았는지」를 말할 수 있게 한다. items_skipped 가 재실행 안전의 증거다.';
comment on column public.csat_drain_runs.items_skipped is
  '이미 채워져 건너뛴 수. null = 안 셌다(0 과 다르다). 두 번째 실행에서 0 이면 재실행 안전이 깨진 것이다.';
