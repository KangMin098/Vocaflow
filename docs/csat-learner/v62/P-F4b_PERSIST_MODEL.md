# v6.2 P-F4b — 영속 수요 · 주문 · 공급 모델(승인안 B · C 설계)

> 2026-10-14 · **적용하지 않은 설계안**이다. 코드 쪽 서버 계약(서명 · 본문 비교 · 상태 기계)은 `lib/csat/map/v62/persist-contract.ts` 로 먼저 고정했다(테스트). 표 · RPC 는 승인 후.

## 1. 두 표로 충분한가 — 아니다, 셋이 최소다

| 표 | 왜 필요 | 두 표안(이전 제안)에서 빠진 것 |
|---|---|---|
| `workspace_content_demand` | 학습자 · Workspace · TASK · 목표/계획/정의 버전에 결속된 수요(서명 · 정규 본문) | — |
| `factory_order` | 부족분의 생산 요청 · **상태 · 실행 기록 · 실패 · 재시도** | 공급 표에 상태를 섞으면 「생산 중 · 검수 중 · 보류 · 실패」와 재시도 이력을 담을 곳이 없다 |
| `workspace_content_delivery` | 적격 산출물이 어느 Workspace · TASK · 계획 버전에 공급됐는지 | — |

ContentArtifact 는 **새 표를 만들지 않는다** — 기존 식별자 참조(`csat_dcp_items.id` · `library_articles.id` · 확인 과제 `surface_ref` · v3 분석 revision)를 `artifact_kind + artifact_ref + artifact_revision` 으로 가리킨다.

## 2. 자격 원장(승인안 C) — 834,311행 일괄 UPDATE 를 피한다

`csat_dcp_items` 에 jsonb 열을 더해 전량 갱신하는 대신 **검수한 것만 행이 생기는 원장**:

```sql
create table public.content_qualification (
  id uuid primary key default gen_random_uuid(),
  artifact_kind text not null check (artifact_kind in ('dcp_item','article','check_task','v3_analysis')),
  artifact_ref text not null,
  artifact_revision text not null,            -- 원천 · 분석 · Gold 버전(바뀌면 새 행 — 덮지 않는다)
  task_id text not null,                      -- 영구 TASK slug
  role text not null check (role in ('source_analysis','model_explanation','guided_practice','independent_check','transfer','delayed_check')),
  producible boolean, rights boolean, content boolean, teaching boolean, gold boolean, assessment boolean, runnable boolean,  -- null = 미검수(true 로 치지 않는다)
  decided_by text not null, decided_at timestamptz not null default now(), note text,
  unique (artifact_kind, artifact_ref, artifact_revision, task_id, role)
);
-- 학습자별 노출 자격(F)은 저장하지 않는다 — 공급 시점에 첫 시도 원장 · 노출로 매번 계산한다
alter table public.content_qualification enable row level security;  -- 학습자 읽기 없음 · 쓰기 service_role
```

## 3. 승인안 B — 수요 · 주문 · 공급

```sql
create table public.workspace_content_demand (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  signature text not null,                    -- SHA-256(정규 본문)
  canonical jsonb not null,                   -- 정규 본문(같은 서명 · 다른 본문 거절에 비교)
  workspace_id uuid references public.learner_workspace(id),
  template_id text, task_id text not null,
  goal_version_id bigint, plan_version integer, definition_version text not null,
  created_at timestamptz not null default now(),
  unique (user_id, signature)
);
create table public.factory_order (
  id uuid primary key default gen_random_uuid(),
  demand_id uuid not null references public.workspace_content_demand(id),
  role text not null, task_id text not null, quantity integer not null check (quantity between 1 and 50),
  spec jsonb not null,                        -- order-spec dry-run 결과(공장 유형 · 명령 · 공백)
  state text not null check (state in ('requested','stock_search','awaiting_production','producing','reviewing','delivered','held','failed')),
  production_run_id text, reason text, attempts integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (demand_id, role)
);
create table public.factory_order_event (     -- 상태 전이 이력(추가 전용)
  id bigserial primary key, order_id uuid not null references public.factory_order(id),
  from_state text, to_state text not null, evidence jsonb, at timestamptz not null default now()
);
create table public.workspace_content_delivery (
  id uuid primary key default gen_random_uuid(),
  demand_id uuid not null references public.workspace_content_demand(id),
  user_id uuid not null,
  workspace_id uuid, task_id text not null, role text not null,
  artifact_kind text not null, artifact_ref text not null, artifact_revision text not null,
  qualification_id uuid references public.content_qualification(id),   -- 재고 재사용(확인 과제)은 그 과제의 승인 기록을 자격으로
  delivered_at timestamptz not null default now(),
  unique (demand_id, role, artifact_kind, artifact_ref)               -- 같은 수요의 중복 공급 방지
);
-- RLS: demand · delivery 본인 select · 쓰기는 service_role RPC 만. factory_order · event 는 관리자 select
```

RPC(서버 전용 · 원자 · `advisory lock(user, signature)`):
- `workspace_demand_upsert(p_user, p_signature, p_canonical, …)` — 같은 서명이 있으면 **저장된 canonical 과 비교**해 같으면 그 행, 다르면 `PT409 demand_signature_reused`(P-M2b 의 DB 이중 방어와 같은 원칙).
- `factory_order_transition(p_order, p_to, p_evidence)` — `persist-contract.canTransition` 과 같은 표(서버 · DB 양쪽 검사). `producing` 은 실행 id, `delivered` 는 자격 id 필수.
- `workspace_delivery_record(p_demand, …)` — 수요 소유자 = 호출 사용자 확인 · 자격 행 존재 확인 · unique 로 중복 공급 0.

영향: 새 표만 · 기존 표 불변 · 되돌리기 = 표 · 함수 drop. 체크포인트 `/db-checkpoint`.

## 4. 승인 전 코드 상태

| 항목 | 상태 |
|---|---|
| 정규 본문 · SHA-256 서명 · 본문 비교 | 구현 · 테스트(`persist-contract.test.ts`) |
| 주문 상태 기계(생산 실행 · 자격 · 이유 필수) | 구현 · 테스트 |
| 공급 충족도(전부 · 일부 · 없음 · null 자격은 true 아님) | 구현 · 테스트(`supply.fulfillmentOf`) |
| 표 · RPC · RLS | **승인 대기** |
