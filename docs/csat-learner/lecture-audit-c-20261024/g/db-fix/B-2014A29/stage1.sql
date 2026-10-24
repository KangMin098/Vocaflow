-- docs/csat-learner/lecture-audit-c-20261024/g/db-fix/B-2014A29/stage1.sql (make-stages.mjs 생성)
-- 단계 1: 2014A#29 지문 각주 정정 + 분석 v6 초안. 검수 기록 · 발행 없음. 개발 DB jajenrevcbmrpaliomxv. 사용자 승인 전 실행 금지.
-- 학습자 화면: 공식 PDF 추출 + 최신 published 분석(v5) 그대로 — 이 단계만으로 바뀌지 않는다.
do $$
declare v5 public.csat_item_analyses; n int;
begin
  update public.csat_items set passage = replace(passage, $q$5:00 p.m. month. Fees$q$, $q$5:00 p.m. * The museum is closed on the first Monday of every month. Fees$q$)
   where id = '2014A#29' and md5(passage) = '354dba3df716d6db04d6cc643afeec3e';
  get diagnostics n = row_count;
  if n <> 1 then raise exception '2014A#29 지문이 승인 시점 값과 다르다'; end if;

  select * into v5 from public.csat_item_analyses
   where id = '74f606c7-159d-46b7-a1cd-6b7f634f3683' and item_id = '2014A#29' and version = 5 and status = 'published'
     and md5(choice_analysis::text) = 'e766e2a03aaba5b7d2566518a9f720df'
     and md5(design_intent) = '541722052453b4f9518e8ff16f0e4542'
     and md5(solve_procedure::text) = '49d2cd0a8c9bb507c14cfee13673e732';
  if not found then raise exception 'v5 가 감수 시점 값과 다르다'; end if;
  if exists (select 1 from public.csat_item_analyses where item_id = '2014A#29' and version >= 6) then raise exception 'v6 이상이 이미 있다'; end if;
  if position($q$확인 가능한 오답 셋은 각각 한 항목의 성분 하나를 바꿨다$q$ in v5.design_intent) = 0 or position($q$③(매주 월요일 휴관)은 Hours 별표 각주가 지문에 'month.' 조각만 남아 휴관 주기 원문을 확인할 수 없으므로 판정을 보류하고, 정답은 ③에 기대지 않고 정한다.$q$ in v5.design_intent) = 0 then raise exception 'design_intent 바꿀 문장이 없다'; end if;
  if (v5.solve_procedure->3->>'on_fail') not like '각주 문장이 온전히 읽히지 않으면%' then raise exception 'solve_procedure 4단계가 예상과 다르다'; end if;

  insert into public.csat_item_analyses (item_id, version, measured_ability, design_intent, answer_locus, choice_analysis, solve_procedure,
         time_budget_sec, difficulty, required_vocab, answer_unknown, body_recovered, status, source, analyst_run, units_version, units_hash)
  values ('2014A#29', 6, v5.measured_ability,
         replace(replace(v5.design_intent, $q$확인 가능한 오답 셋은 각각 한 항목의 성분 하나를 바꿨다$q$, $q$오답 넷은 각각 한 항목의 성분 하나를 바꿨다$q$), $q$③(매주 월요일 휴관)은 Hours 별표 각주가 지문에 'month.' 조각만 남아 휴관 주기 원문을 확인할 수 없으므로 판정을 보류하고, 정답은 ③에 기대지 않고 정한다.$q$, $q$③(매주 월요일 휴관)은 Hours 별표 각주의 ‘매월 첫째 월요일’을 ‘매주 월요일’로 바꾸어 휴관 범위를 넓힌 함정이다.$q$),
         v5.answer_locus,
         (select jsonb_agg(case when e->>'n' = '3' then jsonb_set(e, '{how_to_reject}', to_jsonb($q$[4] Hours 의 별표(*) 각주는 휴관을 'the first Monday of every month', 곧 한 달에 한 번 첫째 월요일로 정한다. ③ '매주 월요일'은 주기가 달라 안내문과 일치하지 않는다.$q$::text)) else e end order by o)
            from jsonb_array_elements(v5.choice_analysis) with ordinality t(e, o)),
         jsonb_set(v5.solve_procedure, '{3,on_fail}', to_jsonb($q$각주가 안 보이면 Hours 줄의 * 를 찾아, * 로 시작하는 각주 문장에서 every 뒤 낱말(week·month)과 first 가 있는지 확인하고 선지가 말하는 휴관 주기와 대조한다$q$::text)),
         v5.time_budget_sec, v5.difficulty, v5.required_vocab, v5.answer_unknown, v5.body_recovered,
         'draft', v5.source, 'lecture-audit-c-2014A29-footnote', v5.units_version, v5.units_hash);
end $$;
