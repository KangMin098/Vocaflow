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

-- ── M9-B 분석 완료 표본 보호 — 늦게 도착한 다른 세션 도움이 표본 판정을 바꿀 수 있으면 「재계산 필요」(DB 쓰기 게이트 P1) ──────────
-- 이 뷰는 같은 학습자 · 문항의 **다른 세션**에 기대므로, 분석 완료 뒤 그 세션에 도움 · 해설 시각이 새로 들어오면 고정된 표본의
-- 첫 시도가 독립 → 도움받음/보류로 바뀔 수 있다. 학습자의 실제 사건은 막지 않고(기록 유실 금지), 그 검증을 재계산 필요로 표시한다
-- (F7 review_required — 효과 게이트 F7-6 이 근거에서 빼고, 재분석으로만 해제). 분석 전환과 같은 표본 권고 잠금으로 직렬화한다.
create function public.learning_cross_help_invalidate() returns trigger
-- security definer: knowledge_trials 재검토 표시를 남긴다(세션 쓰기는 service_role RPC 경로)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_at timestamptz := least(coalesce(new.help_received_at, 'infinity'::timestamptz), coalesce(new.explanation_viewed_at, 'infinity'::timestamptz));
begin
  if v_at = 'infinity'::timestamptz or new.item_ref is null then return new; end if;
  if tg_op = 'UPDATE' and new.help_received_at is not distinct from old.help_received_at and new.explanation_viewed_at is not distinct from old.explanation_viewed_at then return new; end if;
  -- 잠금 순서 = 재분석과 같게(검증 행 → 표본 권고 잠금) — 엇갈리면 교착(DB 쓰기 게이트 P1)
  perform 1 from public.knowledge_trials t
   where t.status = 'analyzed' and not t.synthetic
     and exists (select 1 from public.learning_task_attempts a where a.trial_id = t.id and a.user_id = new.user_id and a.item_ref = new.item_ref)
   order by t.id for update;
  perform pg_advisory_xact_lock_shared(hashtext('learning_trial_sample'));
  update public.knowledge_trials t
     set review_required_at = coalesce(t.review_required_at, now()),
         review_required_reason = coalesce(t.review_required_reason, '같은 학습자 · 문항의 다른 세션 도움 기록이 늦게 도착해 표본 판정이 바뀌었을 수 있다 — 재계산 전에는 근거로 쓰지 않는다')
   where t.status = 'analyzed' and not t.synthetic and t.review_required_at is null
     and exists (select 1 from public.learning_task_attempts a
                  where a.trial_id = t.id and a.user_id = new.user_id and a.item_ref = new.item_ref
                    and a.session_id is distinct from new.id
                    -- 뷰의 불확실 조건을 모두 덮는다: 판단의 서버 수신(+2분)보다 이른 도움(지연 폭 · 서버 순서 모순 포함) · 시계 의심 세션
                    and (new.help_clock_suspect
                         or v_at <= greatest(a.answered_at, coalesce(a.received_at, a.answered_at)) + interval '2 minutes'));
  return new;
end $$;
create trigger learning_cross_help_invalidate after insert or update of help_received_at, explanation_viewed_at on public.learning_sessions
  for each row execute function public.learning_cross_help_invalidate();

-- ── 되돌리기(한 트랜잭션 · 각 줄 앞의 「-- 」를 벗겨 실행) — M8(180000) 뷰 본문으로 ────────────────────
-- 검증: scripts/knowledge/g2-m9-test.mjs 가 이 블록을 격리 DB 에서 실제로 실행한다.
-- begin;
-- drop trigger learning_cross_help_invalidate on public.learning_sessions;
-- drop function public.learning_cross_help_invalidate();
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
