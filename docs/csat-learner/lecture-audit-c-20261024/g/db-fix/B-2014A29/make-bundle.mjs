// docs/csat-learner/lecture-audit-c-20261024/g/db-fix/B-2014A29/make-bundle.mjs
// 범위 B 묶음 SQL 생성: 2014A#29 지문 각주 복원 + 분석 v6(새 행) + 세 페르소나 검수 기록 + 발행을 한 트랜잭션으로.
// 입력은 감수 확정 문안(FINAL_CONTENT.json)과 페르소나 판정 JSON 3개. 출력은 bundle.sql — 실행은 사용자 DB 승인 뒤.
//   node make-bundle.mjs <review-dir>
import fs from 'node:fs'
import path from 'node:path'

const dir = process.argv[2]
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
const fc = read('FINAL_CONTENT.json')
const personas = ['persona-setter-codex-r2.json', 'persona-analyst-claude.json', 'persona-tutor-claude.json'].map(read)
for (const p of personas) if (p.verdict !== 'pass') throw new Error(`${p.persona} 가 pass 가 아니다`)
// 달러 인용 — 본문에 $q$ 가 없으면 이스케이프 없이 그대로 옮겨진다
const q = (s) => { if (String(s).includes('$q$')) throw new Error('인용 충돌'); return `$q$${s}$q$` }
const a = fc.analysis_v6_from_v5
const [d1, d2] = a['design_intent.replace']

const sql = `-- docs/csat-learner/lecture-audit-c-20261024/g/db-fix/B-2014A29/bundle.sql (make-bundle.mjs 생성)
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
   where id = '${a.base.id}' and item_id = '2014A#29' and version = 5 and status = 'published'
     and md5(choice_analysis::text) = '${a.base.choice_analysis_md5}'
     and md5(design_intent) = '${a.base.design_intent_md5}'
     and md5(solve_procedure::text) = '${a.base.solve_procedure_md5}';
  if not found then raise exception 'v5 가 감수 시점 값과 다르다'; end if;
  if exists (select 1 from public.csat_item_analyses where item_id = '2014A#29' and version >= 6) then raise exception 'v6 이상이 이미 있다'; end if;
  if position(${q(d1.from)} in v5.design_intent) = 0 or position(${q(d2.from)} in v5.design_intent) = 0 then raise exception 'design_intent 바꿀 문장이 없다'; end if;
  if (v5.solve_procedure->3->>'on_fail') not like '각주 문장이 온전히 읽히지 않으면%' then raise exception 'solve_procedure 4단계가 예상과 다르다'; end if;

  -- 3) v6 — 바뀌는 키만 바꾼 새 행(초안으로 넣고 검수 뒤 발행)
  insert into public.csat_item_analyses (item_id, version, measured_ability, design_intent, answer_locus, choice_analysis, solve_procedure,
         time_budget_sec, difficulty, required_vocab, answer_unknown, body_recovered, status, source, analyst_run, units_version, units_hash)
  values ('2014A#29', 6, v5.measured_ability,
         replace(replace(v5.design_intent, ${q(d1.from)}, ${q(d1.to)}), ${q(d2.from)}, ${q(d2.to)}),
         v5.answer_locus,
         (select jsonb_agg(case when e->>'n' = '3' then jsonb_set(e, '{how_to_reject}', to_jsonb(${q(a['choice_analysis[n=3].how_to_reject'])}::text)) else e end order by o)
            from jsonb_array_elements(v5.choice_analysis) with ordinality t(e, o)),
         jsonb_set(v5.solve_procedure, '{3,on_fail}', to_jsonb(${q(a['solve_procedure[3].on_fail'])}::text)),
         v5.time_budget_sec, v5.difficulty, v5.required_vocab, v5.answer_unknown, v5.body_recovered,
         'draft', v5.source, 'lecture-audit-c-2014A29-footnote', v5.units_version, v5.units_hash)
  returning id into new_id;

  -- 4) 발행 게이트가 요구하는 세 페르소나 검수(역할: setter=Codex · analyst=Claude · tutor=Claude, 판정 파일 그대로)
${personas.map((p) => `  insert into public.csat_analysis_reviews (analysis_id, persona, verdict, findings, checked)
  values (new_id, '${p.persona}', 'pass', ${q(JSON.stringify(p.findings))}::jsonb, ${q(JSON.stringify(p.checked))}::jsonb);`).join('\n')}

  -- 5) 발행 — csat_guard_published 가 세 페르소나 pass 를 다시 확인한다
  update public.csat_item_analyses set status = 'published', updated_at = now() where id = new_id;
end $$;
`
fs.writeFileSync(path.join(here, 'bundle.sql'), sql)
console.log('bundle.sql', sql.length)
