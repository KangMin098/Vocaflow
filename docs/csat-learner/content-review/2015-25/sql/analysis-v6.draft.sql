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
  'Email Addresses 는 2006년 29%, 2012년 53%다. 53÷29 는 약 1.8배라 「three times」가 성립하지 않는다(④). Cell Phone Numbers 는 2%→20%로, 두 퍼센트 값의 차는 18 퍼센트포인트이지만 증가율은 900%다. ⑤의 「an eighteen percent increase」는 퍼센트포인트를 퍼센트로 쓴 진술이라 도표와 맞지 않고, 평가원은 ④·⑤를 모두 정답으로 인정했다. [공식 사실] 정답 집합 ④·⑤(정답표) · ⑤ 인정 사유 percent 와 percent point 의 구분(평가원 이의심사 결과 발표, 정책브리핑 2014-11-24). [확정하지 않음] 원래 ④ 하나만 의도했는지는 공식 근거가 없다.',
  -- answer_locus: 기존 키 보존(quote 는 **문자열** 그대로 — 로더 계약), reasoning · sentence_index 만 덮는다
  answer_locus || jsonb_build_object(
    'reasoning', '④: 29×3=87 이어야 하지만 53 이라 약 1.8배. ⑤: 2→20 의 차는 18 퍼센트포인트, 증가율은 (20−2)÷2=900% 라 「eighteen percent increase」는 도표와 어긋난다. 정답 집합은 평가원 정답표의 ④·⑤.',
    'sentence_index', jsonb_build_array(5, 6)
  ),
  (
    -- ⑤: 기존 키 보존 + 판정·근거 추가. how_to_reject(「맞는 진술이라 답이 아니다」)만 새 판정과 모순이라 뺀다 — v5 에 원문이 남는다
    select jsonb_agg(
      case when (e->>'n')::int = 5 then (e - 'how_to_reject') || jsonb_build_object(
        'verdict', 'correct', 'trap', '퍼센트·퍼센트포인트 혼동',
        'why_correct', '[6]의 「an eighteen percent increase」를 Cell Phone Numbers 의 두 값으로 확인한다. 2→20 은 차이로는 18 퍼센트포인트, 원래 값 대비 증가율로는 900%다. 「percent increase」는 증가율을 말하므로 18% 증가는 도표와 맞지 않는다. 평가원은 이 선지를 ④와 함께 정답으로 인정했다(정답표 「④, ⑤」).',
        'confirmed_at', jsonb_build_object('note', '평가원 정답표 2015 홀수형 25번 「④, ⑤」(sha256 eec2f406…) · 평가원 이의심사 결과 발표(정책브리핑 2014-11-24) — percent 는 백분율, percent point 는 백분율 간 차이. 도표 값은 v5 확인값(Cell Phone Numbers 2/20) 그대로.', 'sentence_index', jsonb_build_array(6))
      ) else e end order by (e->>'n')::int)
    from jsonb_array_elements(choice_analysis) e
  ),
  (
    select jsonb_agg(
      -- 2단계: step 과 on_fail 둘 다(감수 r2 — on_fail 이 「숫자 낱말만 보고 곱셈/차이」로 남으면 eighteen percent 를 차이로 오독)
      case when ord = 2 then jsonb_set(jsonb_set(s, '{step}', to_jsonb('선지마다 비교 종류를 표시한다 — each/highest 는 크기 비교, three times 는 나눗셈, 「몇 퍼센트 증가」는 원래 값 대비 비율, 「몇 퍼센트포인트」는 뺄셈.'::text)),
        '{on_fail}', to_jsonb('숫자만 보지 말고 함께 쓰인 표현을 확인한다. three times 는 비교값÷기준값, percent increase 는 (나중 값−처음 값)÷처음 값×100, percentage points 는 두 백분율 값의 차이로 계산한다.'::text)) else s end order by ord)
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
