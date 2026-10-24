-- docs/csat-learner/lecture-audit-c-20261024/g/db-fix/B-2014A29/bundle.sql (make-bundle.mjs 생성)
-- 범위 B 묶음: 2014A#29 지문 각주 복원 + 분석 v6 + setter/analyst/tutor 검수 기록 + 발행. 개발 DB jajenrevcbmrpaliomxv. 사용자 승인 전 실행 금지.
-- v5 는 지우거나 바꾸지 않는다(로더는 최신 published version 을 쓴다). 하나라도 어긋나면 예외로 전부 되돌린다.
do $$
declare v5 public.csat_item_analyses; new_id uuid; n int;
begin
  -- 1) 지문: 「month.」 조각 → 공식 각주(B-2014A29/forward.sql 과 같은 compare-and-set)
  update public.csat_items
     set passage = replace(passage, '5:00 p.m. month. Fees', '5:00 p.m. * The museum is closed on the first Monday of every month. Fees')
   where id = '2014A#29' and md5(passage) = '354dba3df716d6db04d6cc643afeec3e';
  get diagnostics n = row_count;
  if n <> 1 then raise exception '2014A#29 지문이 승인 시점 값과 다르다'; end if;

  -- 2) v5 를 감수 시점 값으로 고정해 읽는다
  select * into v5 from public.csat_item_analyses
   where id = '74f606c7-159d-46b7-a1cd-6b7f634f3683' and item_id = '2014A#29' and version = 5 and status = 'published'
     and md5(choice_analysis::text) = 'e766e2a03aaba5b7d2566518a9f720df'
     and md5(design_intent) = '541722052453b4f9518e8ff16f0e4542'
     and md5(solve_procedure::text) = '49d2cd0a8c9bb507c14cfee13673e732';
  if not found then raise exception 'v5 가 감수 시점 값과 다르다'; end if;
  if exists (select 1 from public.csat_item_analyses where item_id = '2014A#29' and version >= 6) then raise exception 'v6 이상이 이미 있다'; end if;
  if position($q$확인 가능한 오답 셋은 각각 한 항목의 성분 하나를 바꿨다$q$ in v5.design_intent) = 0 or position($q$③(매주 월요일 휴관)은 Hours 별표 각주가 지문에 'month.' 조각만 남아 휴관 주기 원문을 확인할 수 없으므로 판정을 보류하고, 정답은 ③에 기대지 않고 정한다.$q$ in v5.design_intent) = 0 then raise exception 'design_intent 바꿀 문장이 없다'; end if;
  if (v5.solve_procedure->3->>'on_fail') not like '각주 문장이 온전히 읽히지 않으면%' then raise exception 'solve_procedure 4단계가 예상과 다르다'; end if;

  -- 3) v6 — 바뀌는 키만 바꾼 새 행(초안으로 넣고 검수 뒤 발행)
  insert into public.csat_item_analyses (item_id, version, measured_ability, design_intent, answer_locus, choice_analysis, solve_procedure,
         time_budget_sec, difficulty, required_vocab, answer_unknown, body_recovered, status, source, analyst_run, units_version, units_hash)
  values ('2014A#29', 6, v5.measured_ability,
         replace(replace(v5.design_intent, $q$확인 가능한 오답 셋은 각각 한 항목의 성분 하나를 바꿨다$q$, $q$오답 넷은 각각 한 항목의 성분 하나를 바꿨다$q$), $q$③(매주 월요일 휴관)은 Hours 별표 각주가 지문에 'month.' 조각만 남아 휴관 주기 원문을 확인할 수 없으므로 판정을 보류하고, 정답은 ③에 기대지 않고 정한다.$q$, $q$③(매주 월요일 휴관)은 Hours 별표 각주의 ‘매월 첫째 월요일’을 ‘매주 월요일’로 바꾸어 휴관 범위를 넓힌 함정이다.$q$),
         v5.answer_locus,
         (select jsonb_agg(case when e->>'n' = '3' then jsonb_set(e, '{how_to_reject}', to_jsonb($q$[4] Hours 의 별표(*) 각주는 휴관을 'the first Monday of every month', 곧 한 달에 한 번 첫째 월요일로 정한다. ③ '매주 월요일'은 주기가 달라 안내문과 일치하지 않는다.$q$::text)) else e end order by o)
            from jsonb_array_elements(v5.choice_analysis) with ordinality t(e, o)),
         jsonb_set(v5.solve_procedure, '{3,on_fail}', to_jsonb($q$각주가 안 보이면 Hours 줄의 * 를 찾아, * 로 시작하는 각주 문장에서 every 뒤 낱말(week·month)과 first 가 있는지 확인하고 선지가 말하는 휴관 주기와 대조한다$q$::text)),
         v5.time_budget_sec, v5.difficulty, v5.required_vocab, v5.answer_unknown, v5.body_recovered,
         'draft', v5.source, 'lecture-audit-c-2014A29-footnote', v5.units_version, v5.units_hash)
  returning id into new_id;

  -- 4) 발행 게이트가 요구하는 세 페르소나 검수(역할: setter=Codex · analyst=Claude · tutor=Claude, 판정 파일 그대로)
  insert into public.csat_analysis_reviews (analysis_id, persona, verdict, findings, checked)
  values (new_id, 'setter', 'pass', $q$["1차 revise의 번호 불일치 근거는 0-기준 focus [4]와 1-기준 분석 [4] Hours를 혼동한 오류이므로 철회한다. 작성자가 제시한 s4는 다섯 번째 문장으로 focus [4]와 일치하며, lecture_c9_v3의 'Hours에 붙은 별표 각주' 보강도 적절하다."]$q$::jsonb, $q$["persona-setter-codex.json의 1차 revise 근거와 current.json의 focus [4]를 확인했다.","FINAL_CONTENT.json의 lecture_c9_v3와 작성자의 문장 번호 체계 설명을 대조했다. splitSentences 구현과 실제 7문장 분할 결과는 직접 검증하지 않았다.","official_2014A_29.txt에서 Hours*의 각주가 'The museum is closed on the first Monday of every month.'임을 확인했다.","매월 첫째 월요일 휴관과 ③의 매주 월요일 휴관은 다르므로, lecture_c9_v3의 불일치 판정은 공식 원문에 부합한다.","파일을 쓰거나 수정하지 않았다."]$q$::jsonb);
  insert into public.csat_analysis_reviews (analysis_id, persona, verdict, findings, checked)
  values (new_id, 'analyst', 'pass', $q$["정답 5는 csat_items.answer=5, 공식 문제지 정답 ⑤와 일치한다.","오답 넷은 서로 다른 항목·성분을 짚는다: ① 비용 조건(Fees·[3][6]), ② 비교 방향(Hours·[4][5]), ③ 휴관 주기(Hours 각주), ④ 금액 대상(Fees·[6]).","③의 새 근거 'the first Monday of every month'는 공식 각주 원문과 사실이 일치하고, '매주'와 주기를 대조하는 판정이 맞다.","design_intent의 '오답 넷' 서술이 choice_analysis 4개 distractor, ⑤ why_correct의 '나머지 넷'과 일관된다.","사소한 점: ③ how_to_reject는 [4] Hours를, 강의 c9는 '다섯 번째 문장 끝'([5])을 위치로 짚는다. 각주가 [4]와 [5]에 걸친 것으로 보여 모순은 아니지만, 표기를 하나로 맞추면 더 명확하다.","근거 없는 유인·심리 서술은 없다. '휴관 범위를 넓힌 함정'은 매월 1회에서 매주로 바뀐 사실에 근거한 서술이다."]$q$::jsonb, $q$["FINAL_CONTENT.json v6 변경 3곳·강의 c9·탐구 6곳","official_2014A_29.txt Hours 각주와 선지","current.json 옛 보류 문안 대비","DB v5 choice_analysis·answer_locus·design_intent, csat_items.answer (SELECT만)"]$q$::jsonb);
  insert into public.csat_analysis_reviews (analysis_id, persona, verdict, findings, checked)
  values (new_id, 'tutor', 'pass', $q$["이력: 1차 판정은 revise였다. 4단계 on_fail 이 판정 결과를 다시 적고 ③을 미리 짚었기 때문이다. 제안 문안으로 바뀐 것을 재확인했다.","새 4단계 on_fail 은 각주를 못 찾았을 때 * 표시 찾기 → 각주 문장 읽기 → every 뒤 낱말·first 확인 → 선지 주기와 대조라는 실제 행동을 준다.","새 on_fail 은 선지 번호와 결론을 말하지 않아 다른 단계와 형식이 맞는다. 정답 ⑤ 를 미리 짚는 단계는 없다.","5단계는 서로 다른 항목을 다루고 순환 표현이 없다.","강의 c9·탐구 6곳·how_to_reject·design_intent 는 모두 ③ 불일치로 v6 와 같은 판정을 말한다.","각주 위치 안내는 학습자가 직접 찾는 행동으로 옮길 수 있다."]$q$::jsonb, $q$["FINAL_CONTENT.json 의 갱신된 solve_procedure[3].on_fail","FINAL_CONTENT.json 의 v6 변경 3곳·강의 c9·탐구 6곳에 보류 문안이 남지 않음","official_2014A_29.txt 의 Hours 각주(first Monday of every month)와 정답 ⑤","DB v5 solve_procedure 5단계·required_vocab·time_budget_sec 70 (SELECT 만)"]$q$::jsonb);

  -- 5) 발행 — csat_guard_published 가 세 페르소나 pass 를 다시 확인한다
  update public.csat_item_analyses set status = 'published', updated_at = now() where id = new_id;
end $$;
