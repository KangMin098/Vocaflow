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

-- ── 되돌리기(한 트랜잭션 · 각 줄 앞의 「-- 」를 벗겨 실행) — M8(180000) 뷰 본문으로 ────────────────────
-- 검증: scripts/knowledge/g2-m9-test.mjs 가 이 블록을 격리 DB 에서 실제로 실행한다.
-- begin;
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
