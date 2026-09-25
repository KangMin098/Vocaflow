-- 20260923060000_csat_pipeline_approvals.sql
--
-- **교재 공장 9단계의 승인을 한 표에 모은다** (DD-69 B5 · 점수 0 → 2).
--
-- ── 왜 필요한가 (DB 실측 2026-09-23) ────────────────────────────────
-- `csat_*` · `textbook_*` 전체를 `approv|decided|approver` 로 훑으면 **컬럼이 0개**다.
-- 즉 이 파이프라인에는 「사람이 봤다」는 흔적이 어디에도 없다. 그 결과가 실측으로 드러난다:
--
--   ⑦ 검수 3인 전원 pass = **29문항** / 검수된 321문항
--   그런데 ⑧ 조판 19권은 전부 `auto_passed = auto_total`, `failed_checks` 전 행 NULL,
--   카탈로그는 19권 전부 「냈음」.
--
-- 게이트가 없어서가 아니라 **게이트를 지난 흔적을 남길 자리가 없어서**다. 조판기는
-- `csat_item_reviews` 를 실제로 읽어 fail 문항을 빼지만, 그 판단은 스크립트 안에서 끝나고
-- 화면도 다음 세션도 그것을 볼 수 없다.
--
-- ── 왜 단계마다 표를 만들지 않나 ────────────────────────────────────
-- 아홉 개를 만들면 아홉 개가 갈라진다. 이 저장소는 이미 그 값을 치렀다 —
-- 「3인 검수」가 기출(`csat_analysis_reviews`)과 교재(`csat_item_reviews`) 두 가지를 뜻하게 되어
-- ⑦ 화면의 눈금이 **다른 것을 세면서 초록**이었다(20260912210000 머리말).
-- 승인은 단계마다 대상이 다를 뿐 **모양이 같다** — 누가 · 무엇을 · 어떤 근거로 · 왜.
--
-- ── 사유를 왜 CHECK 로 강제하나 ─────────────────────────────────────
-- 반려·철회에 사유가 없으면 다음 세션이 **왜 막혔는지 모른 채 같은 것을 다시 올린다.**
-- 이 저장소의 드레인 규약이 「빈 값·너무 짧은 값을 넣지 않는다」인 것과 같은 이유다.
--
-- 되돌리기: `drop table public.csat_pipeline_approvals;`
--   — 잃는 것은 승인 기록뿐이다. 이 표는 아무것도 참조당하지 않는다(FK 없음 — subject_id 가
--     volume(series:band) · item(uuid) · article(uuid) 를 섞어 가리키므로 타입이 하나로 안 선다).

create table if not exists public.csat_pipeline_approvals (
  id           uuid primary key default gen_random_uuid(),

  -- 공정 8칸 + 소재 적격. 값은 `lib/csat/factory-model.ts` 의 StageId 와 'source' 하나다.
  stage        text not null check (stage in (
                 'evidence', 'source', 'market', 'blueprint',
                 'material', 'author', 'explain', 'review', 'press')),

  -- 무엇을 승인했나. 타입이 섞이므로 FK 가 아니라 종류 + 문자열 id 다.
  --   volume  → '<series>:<band>' (예: 'vocab:5')  · textbook_volume_renders 의 복합 키
  --   item    → csat_dcp_items.id (uuid)
  --   article → library_articles.id (uuid)
  --   type    → csat_types.id · gate → '<stage>:<metric>' · run → csat_drain_runs.id
  subject_kind text not null check (subject_kind in ('volume', 'item', 'article', 'type', 'gate', 'run')),
  subject_id   text not null,

  decision     text not null check (decision in ('approved', 'rejected', 'withdrawn')),

  -- ⚠️ 반려·철회는 사유 없이 남길 수 없다. 사유 없는 반려는 다음 세션에게 「막혔다」만 남기고
  --    무엇을 고쳐야 하는지는 안 남긴다 — 그러면 같은 것이 다시 올라온다.
  reason       text,

  -- 사람 이름 또는 에이전트 이름('claude' · 'codex'). 누가 눌렀는지가 승인의 절반이다.
  decided_by   text not null check (length(btrim(decided_by)) > 0),
  decided_at   timestamptz not null default now(),

  -- 무엇을 보고 결정했나 — 그때의 눈금값. 나중에 「그때는 이랬다」를 재구성할 수 있게 한다.
  evidence     jsonb not null default '{}'::jsonb,

  constraint csat_pipeline_approvals_reason_required
    check (decision = 'approved' or (reason is not null and length(btrim(reason)) >= 10))
);

-- 화면의 질의 모양 그대로 — 「이 대상의 최신 결정은 무엇인가」.
create index if not exists csat_pipeline_approvals_subject_idx
  on public.csat_pipeline_approvals (stage, subject_kind, subject_id, decided_at desc);

-- 「지금 승인 대기가 몇 건인가」는 이 표의 부재로 판정하므로, 단계별 최신 결정을 훑는다.
create index if not exists csat_pipeline_approvals_stage_idx
  on public.csat_pipeline_approvals (stage, decided_at desc);

-- `csat_item_reviews` 와 같다: RLS 를 켜고 정책을 두지 않는다 → 서버(Admin 액션·드레인)만.
alter table public.csat_pipeline_approvals enable row level security;

comment on table public.csat_pipeline_approvals is
  '교재 공장 9단계의 승인 기록. 되돌릴 수 없는 동작(적재·발행·게이트 변경) 앞에 한 행이 남는다. 단계마다 표를 나누지 않는다 — 나누면 「승인」이 아홉 가지 뜻이 된다.';
comment on column public.csat_pipeline_approvals.subject_id is
  'volume=<series>:<band> · item/article=uuid · gate=<stage>:<metric> · run=csat_drain_runs.id. 타입이 섞여 FK 를 못 건다 — 대신 subject_kind 가 읽는 법을 말한다.';
comment on column public.csat_pipeline_approvals.evidence is
  '결정 시점의 눈금값. 「그때는 이랬다」를 재구성하는 유일한 근거다.';
