-- supabase/migrations/20260930203522_csat_review_ledgers.sql
--
-- **학평 독립 검수 모니터의 원장 3개** (2026-10-01 사용자 승인 · 적용)
--
-- 왜: 검수 진행·사전 검사·배치 비용·추적 목록이 로컬 파일(_precheck-*.json · _metrics.jsonl · _followups.jsonl)에만
-- 있어 관리자 화면(/admin/csat/evidence 「검수 진행」)에서 볼 수 없었다. 화면이 DB 에서 바로 읽도록 옮긴다.
--
--  · csat_review_prechecks  — 사전 검사 결과. **판정은 CLI(precheckAnalysis)가 하고** 여기는 기록만 한다(화면이 다른
--    판정 로직을 갖지 않게). 검사 당시 분석 해시·근거 단위 해시·검사기 버전을 키에 넣어, 화면이 현재 해시와 비교해
--    「오래된 결과」를 가린다. 같은 분석·같은 목록·같은 검사기 버전으로 다시 돌리면 같은 행(재실행 안전).
--  · csat_review_batches    — 배치 비용 원장. batch 이름이 자연키. 토큰을 모르면 null(화면은 「미기록」, 0 이 아니다).
--  · csat_review_followups  — 추적 목록. (item_id, source, finding_key) 가 자연키 — finding_key 는 소견 글의 해시.
--
-- 셋 다 서비스 역할 로더만 읽는다(anon/authenticated 권한 없음).

begin;

create table if not exists public.csat_review_prechecks (
  analysis_id      uuid not null references public.csat_item_analyses(id) on delete cascade,
  item_id          text not null references public.csat_items(id) on delete cascade,
  analysis_hash    text not null,
  units_hash       text not null default '',          -- 목록이 없으면 '' (PK 에 null 을 두지 않는다)
  units_version    int,
  precheck_version int  not null check (precheck_version >= 1),
  commit           text,
  errors           jsonb not null default '[]' check (jsonb_typeof(errors) = 'array'),
  warnings         jsonb not null default '[]' check (jsonb_typeof(warnings) = 'array'),
  checked_at       timestamptz not null default now(),
  primary key (analysis_id, analysis_hash, units_hash, precheck_version)
);
create index if not exists csat_review_prechecks_item_idx on public.csat_review_prechecks(item_id, checked_at desc);

create table if not exists public.csat_review_batches (
  batch        text primary key check (length(batch) between 3 and 120),
  run_date     date not null,
  kind         text not null check (kind in ('blind', 'rereview', 'correction')),
  chunk_size   int check (chunk_size is null or chunk_size > 0),
  items        int not null check (items >= 0),
  agents       int check (agents is null or agents >= 0),
  tokens       jsonb check (tokens is null or jsonb_typeof(tokens) = 'object'),   -- null = 미기록
  published    int check (published is null or published >= 0),
  refused      int check (refused is null or refused >= 0),
  re_rejected  int check (re_rejected is null or re_rejected >= 0),
  detail       jsonb not null default '{}' check (jsonb_typeof(detail) = 'object'),
  note         text,
  recorded_at  timestamptz not null default now()
);

create table if not exists public.csat_review_followups (
  item_id      text not null,                          -- 문항 id 또는 규칙 항목(예: 「(규칙) lib-evidence-units v1」)
  source       text not null,
  finding_key  text not null check (length(finding_key) = 64),
  finding      text not null check (length(finding) >= 5),
  severity     text not null check (severity in ('minor', 'revise', 're-reject', 'reference', 'rule')),
  status       text not null default 'open' check (status in ('open', 'in_correction', 'fixed-published', 'dismissed')),
  noted_on     date not null,
  updated_at   timestamptz not null default now(),
  primary key (item_id, source, finding_key)
);

alter table public.csat_review_prechecks enable row level security;
alter table public.csat_review_batches   enable row level security;
alter table public.csat_review_followups enable row level security;
revoke all on public.csat_review_prechecks, public.csat_review_batches, public.csat_review_followups from anon, authenticated;

comment on table public.csat_review_prechecks is '학평 검수 전 사전 검사 결과(review-drain precheck --commit). 판정은 CLI 의 precheckAnalysis — 화면은 현재 해시와 비교해 오래된 결과를 가린다';
comment on table public.csat_review_batches   is '학평 검수·교정 배치 비용 원장. tokens null = 미기록';
comment on table public.csat_review_followups is '학평 검수 추적 목록(경미한 소견·반려·규칙 과제)';

commit;

-- ── 되돌리기 ──────────────────────────────────────────────────────────
--  drop table csat_review_followups; drop table csat_review_batches; drop table csat_review_prechecks;
