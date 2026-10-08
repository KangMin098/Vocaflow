-- docs/csat-learner/g2-draft/learning_task_attempts_ext.sql
--
-- ⚠️ 초안 — 적용 금지. supabase/migrations 에 두지 않는다(자동 적용·번호 충돌 방지).
-- G2 에서 vocaflow-b5 의 **통합 SQL 세트**에 합류한다(사용자 결정 2026-10-08 · VNEXT_MERGE.md §0).
-- 근거 계약: docs/csat-learner/G0_LEARNING_CONTRACT.md §6.
--
-- 대상: 정본 public.learning_task_attempts (feat/methodology-vnext 20261008120000, 개발 DB 적용분 — 행 0, 2026-10-08 SELECT 확인)
-- 원칙: 기존 열·행·RLS 를 바꾸지 않는다. 새 열은 모두 NULL 허용(기존 호출 코드 호환).
--
-- 합의가 남은 것(G2 심사):
--   · client_attempt_id 유일 범위 — 아래는 학습자 단위 (user_id, client_attempt_id). 세션 단위로 좁힐지 결정
--   · phase 에 'review' 를 더할지(아래 포함) — 효과 프로토콜 쪽 의미와 충돌하지 않는지 b5 확인
--   · 세션 표를 둘지 — 이 초안은 「(a) 새 표 없음」안: session_id 로 묶고 시도 0건 세션은 서버에 남기지 않는다
--   · item_ref — 기출이면 csat_items.id, 비기출 과제는 별도 식별자(사용자 결정)

begin;

-- 1. 새 열(모두 NULL 허용)
alter table public.learning_task_attempts
  add column if not exists client_attempt_id uuid,
  add column if not exists session_id uuid,
  add column if not exists activity text,
  add column if not exists help_level text;

alter table public.learning_task_attempts
  add constraint learning_task_attempts_activity_check
    check (activity is null or activity in ('theater', 'dissect', 'practice')),
  add constraint learning_task_attempts_help_level_check
    check (help_level is null or help_level in ('independent', 'hint', 'viewed_first'));

-- 2. phase 에 'review' 추가(기존 값은 그대로 통과)
alter table public.learning_task_attempts drop constraint if exists learning_task_attempts_phase_check;
alter table public.learning_task_attempts
  add constraint learning_task_attempts_phase_check
    check (phase in ('pre', 'practice', 'post', 'delayed', 'transfer', 'review'));

-- 3. 멱등 — 같은 시도는 한 행(기존 행은 client_attempt_id 가 NULL 이라 영향 없음)
create unique index if not exists learning_task_attempts_client_attempt_uidx
  on public.learning_task_attempts (user_id, client_attempt_id)
  where client_attempt_id is not null;
create index if not exists learning_task_attempts_session_idx
  on public.learning_task_attempts (session_id)
  where session_id is not null;

-- 4. 기록 함수 — 서버(service_role)만. 같은 id 에 같은 내용이면 기존 행, **다른 내용이면 충돌(덮지 않음)**
create or replace function public.learning_task_attempt_record(
  p_user_id uuid,
  p_client_attempt_id uuid,
  p_session_id uuid,
  p_task_key text,
  p_activity text,
  p_phase text,
  p_help_level text,
  p_item_ref text,
  p_content_hash text,
  p_response jsonb,
  p_is_correct boolean,
  p_sec integer,
  p_synthetic boolean
) returns table (attempt_id bigint, outcome text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.learning_task_attempts%rowtype;
begin
  insert into public.learning_task_attempts
    (user_id, client_attempt_id, session_id, task_key, activity, phase, help_level, item_ref, content_hash, response, is_correct, sec, synthetic)
  values
    (p_user_id, p_client_attempt_id, p_session_id, p_task_key, p_activity, p_phase, p_help_level, p_item_ref, p_content_hash,
     coalesce(p_response, '{}'::jsonb), p_is_correct, p_sec, coalesce(p_synthetic, false))
  on conflict (user_id, client_attempt_id) where client_attempt_id is not null do nothing
  returning id into attempt_id;

  if attempt_id is not null then
    outcome := 'inserted';
    return next;
    return;
  end if;

  select * into v_existing
    from public.learning_task_attempts
   where user_id = p_user_id and client_attempt_id = p_client_attempt_id;

  attempt_id := v_existing.id;
  -- jsonb 는 의미 비교(키 순서 무관) — JSON 문자열 비교 금지(AGENTS 「두 번 이상 고친 실수」)
  if v_existing.session_id is not distinct from p_session_id
     and v_existing.task_key = p_task_key
     and v_existing.phase = p_phase
     and v_existing.item_ref is not distinct from p_item_ref
     and v_existing.response = coalesce(p_response, '{}'::jsonb)
     and v_existing.is_correct is not distinct from p_is_correct then
    outcome := 'duplicate';
  else
    outcome := 'conflict';
  end if;
  return next;
end $$;

revoke all on function public.learning_task_attempt_record(uuid, uuid, uuid, text, text, text, text, text, text, jsonb, boolean, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.learning_task_attempt_record(uuid, uuid, uuid, text, text, text, text, text, text, jsonb, boolean, integer, boolean)
  to service_role;

commit;

-- ── 이벤트 허용 목록(funnel_events CHECK)에 넣을 기출 쪽 이름 — SQL 은 b5 가 합집합으로 한 번에 ──
--   csat_item_opened · csat_source_ready · csat_prediction_submitted · csat_prediction_skipped ·
--   csat_step_advanced · csat_session_completed · csat_review_scheduled · csat_review_completed ·
--   csat_principle_saved · csat_transfer_submitted · csat_browse_filtered · csat_paper_failed · csat_learning_error
--   (속성은 숫자 · 불리언 · 닫힌 열거형만 — vnext-audit 02 §6)
--
-- ── 되돌리기(롤백 초안) ──
--   drop function if exists public.learning_task_attempt_record(uuid, uuid, uuid, text, text, text, text, text, text, jsonb, boolean, integer, boolean);
--   drop index if exists public.learning_task_attempts_session_idx;
--   drop index if exists public.learning_task_attempts_client_attempt_uidx;
--   -- phase 에 'review' 행이 생긴 뒤에는 제약을 되돌리기 전에 그 행을 먼저 정리해야 한다
--   alter table public.learning_task_attempts drop constraint if exists learning_task_attempts_help_level_check,
--     drop constraint if exists learning_task_attempts_activity_check;
--   alter table public.learning_task_attempts drop column if exists help_level, drop column if exists activity,
--     drop column if exists session_id, drop column if exists client_attempt_id;
