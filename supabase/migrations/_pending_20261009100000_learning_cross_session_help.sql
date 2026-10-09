-- supabase/migrations/_pending_20261009100000_learning_cross_session_help.sql
--
-- **M9 — 효과 판정 게이트가 세션을 건너온 도움을 반영한다.** 미적용 · 승인 대기(2026-10-09). 전제: M8(180000) · F7(190000) 적용됨.
--
-- 문제: 첫 시도 뷰(learning_first_attempts)는 시도가 붙은 **그 세션**의 도움 · 해설 시각만 본다. 같은 학습자가 같은 문항을
--   다른 세션(새로고침 · 문항 재선택 · 다른 기기 · 해설 극장 공개)에서 먼저 보고 판단하면, 효과 게이트(analyzed_guard)가
--   그 판단을 독립 표본으로 센다(Codex P1). 화면 쪽은 이미 읽을 때 판정한다(apps/web/src/lib/knowledge/prior-help.ts).
--
-- 독립 수행의 기준(이 뷰가 정하는 것): 같은 학습자(user_id) · 같은 문항(item_ref)에 대해, 판단 시각 이전에
--   **어느 세션에서든** 도움(hint · viewed_first) 노출이나 해설 열람이 없었던 판단. 과제 · 활동은 가리지 않는다 —
--   해설은 문항 단위로 정답 · 근거를 보여 주므로 같은 문항의 어떤 과제에도 영향을 준다. 콘텐츠 버전은 문항 id 로 묶는다
--   (같은 문항의 주석 개정은 정답 · 근거를 바꾸지 않는다 — 바뀌면 문항 id 가 아니라 새 검증으로 다룬다).
--
-- 시간 순서 보존(M8 규칙을 세션 사이로 넓힘 · 화면 판정 prior-help.crossSessionHelp 와 같다):
--   도움받음  : 다른 세션 도움/해설 시각 ≤ 판단 시각 − 2분
--   시각 불확실: |판단 − 도움| < 2분 · 서버가 도움을 먼저 받았는데 그 뒤 도착한 판단이 더 이르다고 주장 ·
--              판단 기기 지연(수신 − 판단 > 2분) 폭 안의 도움 · 도움 기기 시계 의심 세션
--   그 밖(도움이 판단 뒤)은 **과거의 실제 독립 시도를 바꾸지 않는다**.
-- 시도 행은 고치지 않는다(실효 값은 뷰가 계산). 열 순서 · 이름은 M8 그대로(create or replace view).
-- 기존 데이터 영향: 행 변경 없음 · 실제 시도 0 · 분석 완료 검증 0(2026-10-09 실측).
-- 검증: scripts/knowledge/g2-m9-test.mjs(격리 PostgreSQL) · 되돌리기 블록도 그 하네스가 실행한다.

create or replace view public.learning_first_attempts with (security_invoker = true) as
with base as (
  select distinct on (a.user_id, a.task_key, coalesce(a.item_ref, ''), a.phase)
    a.*
  from public.learning_task_attempts a
  order by a.user_id, a.task_key, coalesce(a.item_ref, ''), a.phase, a.answered_at, a.id
), cross_help as (
  -- 다른 세션의 도움 · 해설 사건(같은 학습자 · 같은 문항)
  select b.id as attempt_id,
    bool_or(e.at <= b.answered_at - interval '2 minutes') as helped,
    bool_or(
      x.help_clock_suspect
      or abs(extract(epoch from (b.answered_at - e.at))) < 120
      or (e.srv is not null and b.received_at is not null and e.srv <= b.received_at and b.answered_at < e.at)
      or (b.received_at is not null and (b.received_at - b.answered_at) > interval '2 minutes'
          and abs(extract(epoch from (b.answered_at - e.at))) < extract(epoch from (b.received_at - b.answered_at)))
    ) as uncertain
  from base b
  join public.learning_sessions x
    on x.user_id = b.user_id and x.item_ref = b.item_ref and x.id is distinct from b.session_id
  cross join lateral (values (x.help_received_at, x.help_server_at), (x.explanation_viewed_at, x.explanation_server_at)) as e(at, srv)
  where e.at is not null
  group by b.id
)
select
  a.id as attempt_id, a.user_id, a.task_key, a.item_ref, a.phase, a.activity, a.session_id, a.is_correct, a.answered_at,
  case when coalesce(c.helped, false) then 'viewed_first'
       when s.id is null then a.help_level
       when s.help_received_at is null then s.help_level
       when a.answered_at >= s.help_received_at then s.help_level
       else 'independent' end as help_level,
  (case when coalesce(c.helped, false) then 'viewed_first'
        when s.id is null then a.help_level
        when s.help_received_at is null then s.help_level
        when a.answered_at >= s.help_received_at then s.help_level
        else 'independent' end) = 'viewed_first' as after_viewed_first,
  (s.explanation_viewed_at is not null and a.answered_at >= s.explanation_viewed_at) as after_explanation,
  (a.synthetic or coalesce(s.synthetic, false)) as synthetic,
  ((s.help_received_at is not null and abs(extract(epoch from (a.answered_at - s.help_received_at))) < 120)
    or (s.explanation_viewed_at is not null and abs(extract(epoch from (a.answered_at - s.explanation_viewed_at))) < 120)
    or (a.received_at is not null and a.answered_at > a.received_at + interval '2 minutes')
    or coalesce(s.help_clock_suspect, false)
    or (s.help_server_at is not null and a.received_at is not null and a.received_at > s.help_server_at
        and s.help_received_at is not null and a.answered_at < s.help_received_at)
    or (a.received_at is not null and (a.received_at - a.answered_at) > interval '2 minutes'
        and ((s.help_received_at is not null and abs(extract(epoch from (a.answered_at - s.help_received_at))) < extract(epoch from (a.received_at - a.answered_at)))
          or (s.explanation_viewed_at is not null and abs(extract(epoch from (a.answered_at - s.explanation_viewed_at))) < extract(epoch from (a.received_at - a.answered_at)))))
    or (s.explanation_server_at is not null and a.received_at is not null and a.received_at > s.explanation_server_at
        and s.explanation_viewed_at is not null and a.answered_at < s.explanation_viewed_at)
    -- M9 세션을 건너온 도움의 시각 순서가 불확실하다(도움받음이 확정이면 보류가 아니라 도움받음)
    or (coalesce(c.uncertain, false) and not coalesce(c.helped, false))) as timing_uncertain
from base a
left join public.learning_sessions s on s.id = a.session_id
left join cross_help c on c.attempt_id = a.id;

-- ── M9-B 표본 서명 — 분석 완료 때의 표본과 지금 표본이 **같을 때만** 그 결과를 효과 근거로 쓴다(DB 쓰기 게이트 · Codex P1 반복 뒤 재설계) ──────────
-- 이 뷰는 같은 학습자 · 문항의 **다른 세션**에 기대므로, 분석 완료 뒤 늦게 도착한 도움 기록이 고정된 표본을 바꿀 수 있다.
-- 쓰기 경로마다 트리거로 표시를 거는 방식은 시도 제출 · 재분석 · 도움 기록의 잠금 순서를 엮어 교착 · 누락을 반복했다.
-- 그래서 ① 분석 완료로 바뀌는 순간(analyzed_guard) 자격 표본(실제 학습자의 독립 · 시각 확실 첫 시도)의 서명을 남기고
-- ② 그 결과를 **쓰는 순간**(효과 판정 게이트) 지금 표본의 서명과 비교한다. 하나라도 빠지거나 바뀌었으면 재분석 전까지 근거로 쓰지 않는다
-- (남은 인원이 최소 표본을 넘어도 결과가 달라질 수 있으므로 — Codex P1). 쓰기 경로에는 잠금 · 트리거를 더하지 않는다.
alter table public.knowledge_trials add column sample_signature text;   -- M9-B 분석 완료 때 자격 표본(첫 시도 id) 서명

-- 자격 표본 서명 — 실제 학습자의 독립 · 시각 확실 첫 시도(사전 · 사후) attempt id 를 정렬해 md5. 자격 표본이 없으면 null
create function public.knowledge_trial_sample_signature(p_trial uuid) returns text
language sql stable security invoker set search_path = public as $$
  select md5(string_agg(f.phase || ':' || f.attempt_id::text, ',' order by f.phase, f.attempt_id))
    from public.learning_first_attempts f join public.learning_task_attempts a on a.id = f.attempt_id
   where a.trial_id = p_trial and f.phase in ('pre', 'post') and not f.synthetic and f.help_level = 'independent' and not coalesce(f.after_explanation, false) and not f.timing_uncertain
$$;
revoke all on function public.knowledge_trial_sample_signature(uuid) from public, anon, authenticated;
grant execute on function public.knowledge_trial_sample_signature(uuid) to service_role;

-- 분석 게이트 — M8(180000) 본문 + 통과하면 표본 서명을 남긴다.
-- 최소 표본 검사와 서명을 **한 질의(같은 스냅숏)**에서 만든다 — 따로 읽으면 사이에 다른 세션 도움이 들어와 검사한 표본과
-- 서명한 표본이 달라질 수 있다(Codex P1).
create or replace function public.knowledge_trials_analyzed_guard() returns trigger
language plpgsql set search_path = public as $$
declare
  need int := greatest(coalesce((new.design->>'min_n')::int, 1), 1);
  v_pre int;
  v_post int;
  v_sig text;
begin
  if new.status = 'analyzed' and not new.synthetic and (tg_op = 'INSERT' or old.status is distinct from 'analyzed') then
    -- M8-F 진행 중인 시도 쓰기가 모두 끝날 때까지 기다리고, 이 트랜잭션이 끝날 때까지 새 시도 쓰기를 막는다
    perform pg_advisory_xact_lock(hashtext('learning_trial_sample'));
    perform 1 from public.learning_sessions where id in (select session_id from public.learning_task_attempts where trial_id = new.id and session_id is not null) order by id for update;
    select count(distinct f.user_id) filter (where f.phase = 'pre'),
           count(distinct f.user_id) filter (where f.phase = 'post'),
           md5(string_agg(f.phase || ':' || f.attempt_id::text, ',' order by f.phase, f.attempt_id))
      into v_pre, v_post, v_sig
      from public.learning_first_attempts f join public.learning_task_attempts a on a.id = f.attempt_id
     where a.trial_id = new.id and f.phase in ('pre', 'post') and not f.synthetic and f.help_level = 'independent' and not coalesce(f.after_explanation, false) and not f.timing_uncertain;
    if coalesce(v_pre, 0) < need or coalesce(v_post, 0) < need then
      raise exception '실제 학습자의 독립(independent) 첫 시도(사전 · 사후)가 최소 표본(%)에 못 미친다 — 시각이 불확실한 판단은 세지 않는다 · 분석 완료로 바꿀 수 없다', need;
    end if;
    -- M9-B 이 분석이 본 자격 표본의 서명(검사와 같은 스냅숏) — 효과 판정 게이트가 쓸 때 지금 표본과 비교한다
    new.sample_signature := v_sig;
  end if;
  return new;
end $$;

-- 효과 판정 게이트 — F7(190000) 본문 + 「분석 때 표본과 지금 표본이 같다」 한 조건
create or replace function public.knowledge_items_applied_guard() returns trigger
language plpgsql set search_path = public as $$
declare old_status text;
        old_eff text;
begin
  if tg_op = 'UPDATE' then old_status := old.status; old_eff := old.efficacy; end if;
  if new.status = 'applied' and old_status is distinct from 'applied' and not exists (
    select 1 from public.knowledge_applications a where a.item_id = new.id and a.status = 'active') then
    raise exception '활성 제품 적용 없이 applied 로 바꿀 수 없다';
  end if;
  if new.efficacy <> 'not_assessed' and new.efficacy is distinct from old_eff and not (
    exists (select 1 from public.knowledge_evidence e where e.item_id = new.id and e.source_type = 'research'
             and e.evidence_level in ('meta_analysis','systematic_review','rct','quasi_experimental')
             and e.applicability in ('high','partial'))
    or exists (select 1 from public.knowledge_trials t join public.knowledge_applications a on a.id = t.application_id
               where a.item_id = new.id and t.status = 'analyzed' and not t.synthetic and t.review_required_at is null
                 and t.sample_signature is not null and t.sample_signature = public.knowledge_trial_sample_signature(t.id)
                 and t.result = case new.efficacy when 'research_supported' then 'supported' else new.efficacy end)) then
    raise exception '효과 판정(%)을 뒷받침하는 연구 근거(준실험 이상)나 같은 결과의 실제 학습자 검증이 없다(검증 표본이 분석 때와 달라졌으면 재분석해야 한다)', new.efficacy;
  end if;
  return new;
end $$;

-- ── 되돌리기(한 트랜잭션 · 각 줄 앞의 「-- 」를 벗겨 실행) — M8(180000) 뷰 본문으로 ────────────────────
-- 검증: scripts/knowledge/g2-m9-test.mjs 가 이 블록을 격리 DB 에서 실제로 실행한다.
-- begin;
-- create or replace function public.knowledge_items_applied_guard() returns trigger
-- language plpgsql set search_path = public as $$
-- declare old_status text;
--         old_eff text;
-- begin
--   if tg_op = 'UPDATE' then old_status := old.status; old_eff := old.efficacy; end if;
--   if new.status = 'applied' and old_status is distinct from 'applied' and not exists (
--     select 1 from public.knowledge_applications a where a.item_id = new.id and a.status = 'active') then
--     raise exception '활성 제품 적용 없이 applied 로 바꿀 수 없다';
--   end if;
--   if new.efficacy <> 'not_assessed' and new.efficacy is distinct from old_eff and not (
--     exists (select 1 from public.knowledge_evidence e where e.item_id = new.id and e.source_type = 'research'
--              and e.evidence_level in ('meta_analysis','systematic_review','rct','quasi_experimental')
--              and e.applicability in ('high','partial'))
--     or exists (select 1 from public.knowledge_trials t join public.knowledge_applications a on a.id = t.application_id
--                where a.item_id = new.id and t.status = 'analyzed' and not t.synthetic and t.review_required_at is null
--                  and t.result = case new.efficacy when 'research_supported' then 'supported' else new.efficacy end)) then
--     raise exception '효과 판정(%)을 뒷받침하는 연구 근거(준실험 이상)나 같은 결과의 실제 학습자 검증이 없다', new.efficacy;
--   end if;
--   return new;
-- end $$;
-- create or replace function public.knowledge_trials_analyzed_guard() returns trigger
-- language plpgsql set search_path = public as $$
-- declare need int := greatest(coalesce((new.design->>'min_n')::int, 1), 1);
-- begin
--   if new.status = 'analyzed' and not new.synthetic and (tg_op = 'INSERT' or old.status is distinct from 'analyzed') then
--     -- M8-F 진행 중인 시도 쓰기가 모두 끝날 때까지 기다리고, 이 트랜잭션이 끝날 때까지 새 시도 쓰기를 막는다
--     perform pg_advisory_xact_lock(hashtext('learning_trial_sample'));
--     perform 1 from public.learning_sessions where id in (select session_id from public.learning_task_attempts where trial_id = new.id and session_id is not null) order by id for update;
--     if (select count(distinct f.user_id) from public.learning_first_attempts f join public.learning_task_attempts a on a.id = f.attempt_id
--           where a.trial_id = new.id and f.phase = 'pre' and not f.synthetic and f.help_level = 'independent' and not coalesce(f.after_explanation, false) and not f.timing_uncertain) < need
--        or (select count(distinct f.user_id) from public.learning_first_attempts f join public.learning_task_attempts a on a.id = f.attempt_id
--           where a.trial_id = new.id and f.phase = 'post' and not f.synthetic and f.help_level = 'independent' and not coalesce(f.after_explanation, false) and not f.timing_uncertain) < need then
--       raise exception '실제 학습자의 독립(independent) 첫 시도(사전 · 사후)가 최소 표본(%)에 못 미친다 — 시각이 불확실한 판단은 세지 않는다 · 분석 완료로 바꿀 수 없다', need;
--     end if;
--   end if;
--   return new;
-- end $$;
-- drop function public.knowledge_trial_sample_signature(uuid);
-- alter table public.knowledge_trials drop column sample_signature;
-- create or replace view public.learning_first_attempts with (security_invoker = true) as
-- select distinct on (a.user_id, a.task_key, coalesce(a.item_ref, ''), a.phase)
--   a.id as attempt_id, a.user_id, a.task_key, a.item_ref, a.phase, a.activity, a.session_id, a.is_correct, a.answered_at,
--   case when s.id is null then a.help_level
--        when s.help_received_at is null then s.help_level
--        when a.answered_at >= s.help_received_at then s.help_level
--        else 'independent' end as help_level,
--   (case when s.id is null then a.help_level
--         when s.help_received_at is null then s.help_level
--         when a.answered_at >= s.help_received_at then s.help_level
--         else 'independent' end) = 'viewed_first' as after_viewed_first,
--   (s.explanation_viewed_at is not null and a.answered_at >= s.explanation_viewed_at) as after_explanation,
--   (a.synthetic or coalesce(s.synthetic, false)) as synthetic,
--   ((s.help_received_at is not null and abs(extract(epoch from (a.answered_at - s.help_received_at))) < 120)
--     or (s.explanation_viewed_at is not null and abs(extract(epoch from (a.answered_at - s.explanation_viewed_at))) < 120)
--     or (a.received_at is not null and a.answered_at > a.received_at + interval '2 minutes')
--     or coalesce(s.help_clock_suspect, false)
--     or (s.help_server_at is not null and a.received_at is not null and a.received_at > s.help_server_at
--         and s.help_received_at is not null and a.answered_at < s.help_received_at)
--     or (a.received_at is not null and (a.received_at - a.answered_at) > interval '2 minutes'
--         and ((s.help_received_at is not null and abs(extract(epoch from (a.answered_at - s.help_received_at))) < extract(epoch from (a.received_at - a.answered_at)))
--           or (s.explanation_viewed_at is not null and abs(extract(epoch from (a.answered_at - s.explanation_viewed_at))) < extract(epoch from (a.received_at - a.answered_at)))))
--     or (s.explanation_server_at is not null and a.received_at is not null and a.received_at > s.explanation_server_at
--         and s.explanation_viewed_at is not null and a.answered_at < s.explanation_viewed_at)) as timing_uncertain
-- from public.learning_task_attempts a
-- left join public.learning_sessions s on s.id = a.session_id
-- order by a.user_id, a.task_key, coalesce(a.item_ref, ''), a.phase, a.answered_at, a.id;
-- commit;
