-- docs/csat-learner/content-review/2015-25/sql/analysis-v6.draft.sql
--
-- ⚠️ 초안 — 적용하지 않았다. 사람 내용 감수 + 사용자 DB 승인(SQL·sha256 확인) 뒤에만 실행한다.
-- 2015#25 분석 v6 를 v5(published) 에서 복사해 ⑤ · 의도 · 정답 위치 · 풀이 2단계만 고친 **새 판본**으로 넣는다.
-- 비파괴: v1~v5 행은 바꾸지 않는다. v6 는 in_review 로 들어가 학습자에게 보이지 않는다.
-- 영향: csat_item_analyses 1행 추가. 다른 표 무변경.

begin;

-- 전제 확인: v5 가 published 이고 v6 가 아직 없다
do $$
begin
  if not exists (select 1 from csat_item_analyses where item_id = '2015#25' and version = 5 and status = 'published') then
    raise exception '2015#25 v5 published 가 아니다 — 중단';
  end if;
  if exists (select 1 from csat_item_analyses where item_id = '2015#25' and version = 6) then
    raise exception '2015#25 v6 가 이미 있다 — 중단';
  end if;
end $$;

insert into csat_item_analyses (item_id, version, measured_ability, design_intent, answer_locus, choice_analysis, solve_procedure,
  time_budget_sec, difficulty, required_vocab, answer_unknown, body_recovered, status, source, analyst_run, units_version, units_hash)
select
  item_id, 6, measured_ability,
  'Email Addresses 는 2006년 29%, 2012년 53%다. 53÷29 는 약 1.8배라 「three times」가 성립하지 않는다(④). Cell Phone Numbers 는 2%→20%로, 두 퍼센트 값의 차는 18 퍼센트포인트이지만 증가율은 900%다. ⑤의 「an eighteen percent increase」는 퍼센트포인트를 퍼센트로 쓴 진술이라 도표와 맞지 않고, 평가원은 정답표에서 ④·⑤를 모두 정답으로 인정했다. [사실] 정답 집합 ④·⑤ — 평가원 정답표. [보도 근거] ⑤의 정정 사유(퍼센트·퍼센트포인트 혼동). [가설] 원래 출제 설계는 ④ 하나를 겨냥했을 가능성 — 공식 확인 없음.',
  jsonb_build_object(
    'quote', jsonb_build_array('the percentage of 2012 was three times higher than that of 2006', 'an eighteen percent increase in the category of cell phone numbers'),
    'reasoning', '④: 29×3=87 이어야 하지만 53 이라 약 1.8배. ⑤: 2→20 의 차는 18 퍼센트포인트, 증가율은 (20−2)÷2=900% 라 「eighteen percent increase」는 도표와 어긋난다. 정답 집합은 평가원 정답표의 ④·⑤.',
    'sentence_index', jsonb_build_array(5, 6)
  ),
  (
    select jsonb_agg(
      case when (e->>'n')::int = 5 then jsonb_build_object(
        'n', 5, 'verdict', 'correct', 'trap', '퍼센트·퍼센트포인트 혼동',
        'why_correct', '[6]의 「an eighteen percent increase」를 Cell Phone Numbers 의 두 값으로 확인한다. 2→20 은 차이로는 18 퍼센트포인트, 원래 값 대비 증가율로는 900%다. 「percent increase」는 증가율을 말하므로 18% 증가는 도표와 맞지 않는다. 평가원은 이 선지를 ④와 함께 정답으로 인정했다(정답표 「④, ⑤」).',
        'confirmed_at', jsonb_build_object('note', '평가원 정답표 2015 홀수형 25번 「④, ⑤」(sha256 eec2f406…). 도표 값은 v5 확인값(Cell Phone Numbers 2/20) 그대로.', 'sentence_index', jsonb_build_array(6))
      ) else e end order by (e->>'n')::int)
    from jsonb_array_elements(choice_analysis) e
  ),
  (
    select jsonb_agg(
      case when ord = 2 then jsonb_set(s, '{step}', to_jsonb('선지마다 비교 종류를 표시한다 — each/highest 는 크기 비교, three times 는 나눗셈, 「몇 퍼센트 증가」는 원래 값 대비 비율, 「몇 퍼센트포인트」는 뺄셈.'::text)) else s end order by ord)
    from jsonb_array_elements(solve_procedure) with ordinality as t(s, ord)
  ),
  time_budget_sec, difficulty, required_vocab, answer_unknown, body_recovered,
  'in_review', 'content-review-2015-25', 'content-review-package/2015-25', units_version, units_hash
from csat_item_analyses where item_id = '2015#25' and version = 5;

commit;

-- ── 사람 내용 승인 뒤 공개(별도 실행 · 별도 승인) ─────────────────
-- update csat_item_analyses set status = 'published', updated_at = now() where item_id = '2015#25' and version = 6 and status = 'in_review';

-- ── 복구(비파괴) ──────────────────────────────────────────────
-- update csat_item_analyses set status = 'rejected', updated_at = now() where item_id = '2015#25' and version = 6;
-- v1~v5 는 이 초안이 건드리지 않으므로 복구 대상이 아니다.
