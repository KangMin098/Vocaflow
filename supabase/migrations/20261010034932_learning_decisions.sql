-- supabase/migrations/_pending_20261010120000_learning_decisions.sql
-- 학습 결정 기록(2026-10-10 · 사용자 승인 「추천 기록 테이블」 — 적용은 SQL 확인 뒤 별도 승인)
-- 학습 지도가 내린 원리 기반 추천(learning-decision)을 **그때의 근거와 함께** 남긴다:
--   관찰(확인 문항 · 정오 · 막힌 부분) · 정책 버전 · 행동 · 초점 · 선택 이유 · 원리 · 방법 · 과제 항목 id 와 버전 ·
--   지도 연결 적용(id · 버전 · 대상 조건) · 그 원리에 연결된 근거 id(당시 스냅숏) · 합성 여부.
-- 같은 학습자 · 같은 근거 · 같은 결정은 한 번만(fingerprint) — 화면을 다시 열 때마다 쌓이지 않는다.
-- 학습자는 자기 행만 읽는다 · 쓰기는 서버(service_role)만 — 클라이언트가 결정을 지어 넣지 못한다.
-- 효과 판정이 아니다: 이 표는 「무엇을 왜 권했나」의 기록이다.

create table public.learning_decisions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  step_key text not null check (length(step_key) between 1 and 40),
  find_task_id text not null check (length(find_task_id) between 1 and 40),
  policy_version text not null check (length(policy_version) between 1 and 40),
  action text not null check (action in ('start_check','check_more','practice_method','move_on','recheck_new','recheck_passed','no_principle')),
  focus text check (focus is null or focus in ('claim','support','relation')),
  observation jsonb not null,
  reason text not null check (length(reason) between 1 and 2000),
  principle_id uuid references public.knowledge_items(id),
  principle_version integer,
  method_id uuid references public.knowledge_items(id),
  method_version integer,
  task_id uuid references public.knowledge_items(id),
  task_version integer,
  application_id uuid references public.knowledge_applications(id),
  application_version integer,
  applicability jsonb not null default '{}'::jsonb,
  evidence_ids uuid[] not null default '{}',
  synthetic boolean not null default false,
  fingerprint text not null check (length(fingerprint) between 16 and 128),
  created_at timestamptz not null default now(),
  unique (user_id, fingerprint)
);

create index learning_decisions_user_created_idx on public.learning_decisions (user_id, created_at desc);
create index learning_decisions_principle_idx on public.learning_decisions (principle_id, principle_version) where principle_id is not null;

alter table public.learning_decisions enable row level security;
revoke all on public.learning_decisions from anon, authenticated;
grant select on public.learning_decisions to authenticated;
create policy learning_decisions_own_select on public.learning_decisions
  for select to authenticated using (user_id = (select auth.uid()));
-- 쓰기는 service_role 만(정책 없음 = RLS 로 막힘 · service_role 은 RLS 우회)

-- 되돌리기:
-- drop table public.learning_decisions;
