-- docs/csat-learner/lecture-audit-c-20261024/g/db-fix/C-2023-32/stage-a.sql
-- 2023#32 단계 A: 분석 v5 draft 1행 — v4(published) 를 그대로 복사하고 choice_analysis 안 lure_quote 인용 1곳만 trans-missible → transmissible.
-- 지문 · 검수 · 발행은 건드리지 않는다(로더는 published 최고 version = v4 를 계속 쓴다 → 학습자 화면 불변). 사용자 별도 승인 + 승인형 러너로만.
do $$
declare v4 public.csat_item_analyses; ca jsonb;
begin
  select * into v4 from public.csat_item_analyses
   where id = 'efb293fa-8755-43e0-87c5-5d71b54ba0d7' and item_id = '2023#32' and version = 4 and status = 'published'
     and md5(choice_analysis::text) = 'e38082cf2d0bf0a6261e9fbe604cf083'
     and md5(design_intent) = '8732f1c4a97fde5392b83270678caa12'
     and md5(solve_procedure::text) = 'd448929511a89f1f67561e570ac5a8ac';
  if not found then raise exception '2023#32 v4 가 준비 시점 값과 다르다'; end if;
  if exists (select 1 from public.csat_item_analyses where item_id = '2023#32' and version >= 5) then raise exception 'v5 이상이 이미 있다'; end if;
  if (length(v4.choice_analysis::text) - length(replace(v4.choice_analysis::text, 'trans-missible', ''))) / 14 <> 1 then raise exception '인용 trans-missible 이 정확히 1곳이 아니다'; end if;
  ca := replace(v4.choice_analysis::text, 'trans-missible', 'transmissible')::jsonb;
  if md5(ca::text) <> '2c95d468a2c7173ae1550c15d0b73c1c' then raise exception 'v5 choice_analysis 가 예정 값과 다르다'; end if;
  insert into public.csat_item_analyses (item_id, version, measured_ability, design_intent, answer_locus, choice_analysis, solve_procedure,
         time_budget_sec, difficulty, required_vocab, answer_unknown, body_recovered, status, source, analyst_run, units_version, units_hash)
  values ('2023#32', 5, v4.measured_ability, v4.design_intent, v4.answer_locus, ca, v4.solve_procedure,
         v4.time_budget_sec, v4.difficulty, v4.required_vocab, v4.answer_unknown, v4.body_recovered,
         'draft', v4.source, 'lecture-audit-c-2023-32-quote', v4.units_version, v4.units_hash);
end $$;
