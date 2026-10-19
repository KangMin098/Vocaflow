-- supabase/migrations/_pending_ai_verified_ledger.sql
--
-- ⚠️ 보류(적용 안 함) — AUTONOMOUS_DELEGATED 제안(docs/agents/AUTONOMOUS_DELEGATED.md §4). 사용자 승인 전 개발 DB 에 적용하지 않는다.
-- AI 합의 검수(AI_VERIFIED)를 **사람 결정 원장(content_human_decision)과 분리된** 추가 전용 원장에 남긴다.
--   · HUMAN_REVIEWED 의 의미는 그대로다 — 이 표의 행은 사람 확인이 아니며 content_human_decision 에 쓰이지 않는다.
--   · 출시 등급: internal(격리 · 내부 검증 · 합성 학습자) 만 이 원장으로 열 수 있다. 실제 학습자 공개(learner_public)는
--     기존 사람 Gold 조건 그대로 — 사용자가 정책으로 AI_VERIFIED 공개를 채택하기 전까지 공급 판정(supply_human_decisions_ok)은 바뀌지 않는다.
--   · 철회는 별도 행(content_ai_verification_revocation) — 행 수정 · 삭제 없음.
-- 전제: content_human_decision 원장(_pending_authored_supply.sql)과 같은 artifact_kind · ref · revision 체계.

begin;

create table public.content_ai_verification (
  id               bigint generated always as identity primary key,
  artifact_kind    text not null check (artifact_kind in ('authored_item', 'csat_item')),
  artifact_ref     text not null check (length(artifact_ref) between 1 and 200),
  artifact_revision text not null check (artifact_revision ~ '^[0-9a-f]{64}$'),
  gold_hash        text not null check (gold_hash ~ '^[0-9a-f]{64}$'),
  tier             text not null check (tier in ('internal')),               -- learner_public 은 이 표로 열 수 없다(정책 채택 뒤 별도 마이그레이션)
  author_agent     text not null check (author_agent in ('claude')),
  reviewer_agent   text not null check (reviewer_agent in ('codex')),       -- 작성자와 다른 독립 판정자
  verdict          text not null check (verdict in ('pass', 'fail')),
  evidence         jsonb not null check (
    jsonb_typeof(evidence) = 'object'
    and evidence ? 'blind_agreement' and evidence ? 'validator' and evidence ? 'transfer_check' and evidence ? 'rationale'),
  recorded_at      timestamptz not null default now(),
  recorded_by      uuid not null references auth.users (id),
  unique (artifact_kind, artifact_ref, artifact_revision, gold_hash, reviewer_agent)
);
comment on table public.content_ai_verification is 'AI_VERIFIED — Claude 작성 · Codex 독립 판정의 기록. 사람 확인(HUMAN_REVIEWED)이 아니다. 출시 등급 internal 만';

create table public.content_ai_verification_revocation (
  id             bigint generated always as identity primary key,
  verification_id bigint not null unique references public.content_ai_verification (id),
  reason         text not null check (length(reason) between 2 and 500),
  revoked_at     timestamptz not null default now(),
  revoked_by     uuid not null references auth.users (id)
);

alter table public.content_ai_verification enable row level security;
alter table public.content_ai_verification_revocation enable row level security;
revoke all on public.content_ai_verification, public.content_ai_verification_revocation from public, anon, authenticated;

-- 추가 전용 — 수정 · 삭제 거절
create function public.content_ai_verification_append_only()
returns trigger language plpgsql set search_path to 'public', 'pg_temp' as $$
begin
  raise exception 'content_ai_verification is append-only' using errcode = '42501';
end $$;
create trigger content_ai_verification_no_update before update or delete on public.content_ai_verification
  for each row execute function public.content_ai_verification_append_only();
create trigger content_ai_verification_revocation_no_update before update or delete on public.content_ai_verification_revocation
  for each row execute function public.content_ai_verification_append_only();

-- 내부 등급 판정 — 철회되지 않은 pass 가 그 revision · Gold 해시에 있는가(공급 판정과 별개 · 학습자 공개에 쓰지 않는다)
create function public.content_ai_verified_internal(p_kind text, p_ref text, p_revision text, p_gold_hash text)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select exists (
    select 1 from public.content_ai_verification v
    where v.artifact_kind = p_kind and v.artifact_ref = p_ref and v.artifact_revision = p_revision and v.gold_hash = p_gold_hash
      and v.verdict = 'pass' and v.tier = 'internal'
      and not exists (select 1 from public.content_ai_verification_revocation r where r.verification_id = v.id))
$$;
revoke all on function public.content_ai_verified_internal(text, text, text, text) from public, anon, authenticated;

commit;
