// docs/csat-learner/lecture-audit-c-20261024/g/db-fix/B-2014A29/make-stages.mjs
// bundle.sql(일괄 발행 — 미승인)을 대신하는 단계 분리 SQL 생성기.
//   단계 1(stage1.sql): 지문 각주 정정 + 분석 v6 초안(draft). 검수 기록·발행 없음 → 학습자 화면 불변(로더는 최신 published 만 읽는다).
//   단계 2(stage2.sql): 사람 내용 승인 뒤에만 생성. AI 세 역할 검수를 「AI 검토」로 표시해 기록 + 사람 승인 기록 + 발행.
// AI 검수는 발행 게이트(csat_guard_published: 페르소나 3 pass)를 채우는 행이므로 단계 1 에 넣지 않는다 — 넣으면 사람 승인 없이 발행 가능한 상태가 된다.
//   node make-stages.mjs <review-dir>                                   → stage1.sql · stage1-recovery.sql
//   node make-stages.mjs <review-dir> --approver <이름> --approved-at <ISO> --binding <BINDING.json sha256>  → stage2.sql 추가
import fs from 'node:fs'
import path from 'node:path'

const [dir, ...rest] = process.argv.slice(2)
const opt = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined }
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
const fc = read('FINAL_CONTENT.json')
const q = (s) => { if (String(s).includes('$q$')) throw new Error('인용 충돌'); return `$q$${s}$q$` }
const a = fc.analysis_v6_from_v5
const [d1, d2] = a['design_intent.replace']
const RUN = 'lecture-audit-c-2014A29-footnote'
const PASSAGE_BEFORE = '354dba3df716d6db04d6cc643afeec3e'
const FROM = '5:00 p.m. month. Fees'
const TO = '5:00 p.m. * The museum is closed on the first Monday of every month. Fees'

const stage1 = `-- docs/csat-learner/lecture-audit-c-20261024/g/db-fix/B-2014A29/stage1.sql (make-stages.mjs 생성)
-- 단계 1: 2014A#29 지문 각주 정정 + 분석 v6 초안. 검수 기록 · 발행 없음. 개발 DB jajenrevcbmrpaliomxv. 사용자 승인 전 실행 금지.
-- 학습자 화면: 공식 PDF 추출 + 최신 published 분석(v5) 그대로 — 이 단계만으로 바뀌지 않는다.
do $$
declare v5 public.csat_item_analyses; n int;
begin
  update public.csat_items set passage = replace(passage, ${q(FROM)}, ${q(TO)})
   where id = '2014A#29' and md5(passage) = '${PASSAGE_BEFORE}';
  get diagnostics n = row_count;
  if n <> 1 then raise exception '2014A#29 지문이 승인 시점 값과 다르다'; end if;

  select * into v5 from public.csat_item_analyses
   where id = '${a.base.id}' and item_id = '2014A#29' and version = 5 and status = 'published'
     and md5(choice_analysis::text) = '${a.base.choice_analysis_md5}'
     and md5(design_intent) = '${a.base.design_intent_md5}'
     and md5(solve_procedure::text) = '${a.base.solve_procedure_md5}';
  if not found then raise exception 'v5 가 감수 시점 값과 다르다'; end if;
  if exists (select 1 from public.csat_item_analyses where item_id = '2014A#29' and version >= 6) then raise exception 'v6 이상이 이미 있다'; end if;
  if position(${q(d1.from)} in v5.design_intent) = 0 or position(${q(d2.from)} in v5.design_intent) = 0 then raise exception 'design_intent 바꿀 문장이 없다'; end if;
  if (v5.solve_procedure->3->>'on_fail') not like '각주 문장이 온전히 읽히지 않으면%' then raise exception 'solve_procedure 4단계가 예상과 다르다'; end if;

  insert into public.csat_item_analyses (item_id, version, measured_ability, design_intent, answer_locus, choice_analysis, solve_procedure,
         time_budget_sec, difficulty, required_vocab, answer_unknown, body_recovered, status, source, analyst_run, units_version, units_hash)
  values ('2014A#29', 6, v5.measured_ability,
         replace(replace(v5.design_intent, ${q(d1.from)}, ${q(d1.to)}), ${q(d2.from)}, ${q(d2.to)}),
         v5.answer_locus,
         (select jsonb_agg(case when e->>'n' = '3' then jsonb_set(e, '{how_to_reject}', to_jsonb(${q(a['choice_analysis[n=3].how_to_reject'])}::text)) else e end order by o)
            from jsonb_array_elements(v5.choice_analysis) with ordinality t(e, o)),
         jsonb_set(v5.solve_procedure, '{3,on_fail}', to_jsonb(${q(a['solve_procedure[3].on_fail'])}::text)),
         v5.time_budget_sec, v5.difficulty, v5.required_vocab, v5.answer_unknown, v5.body_recovered,
         'draft', v5.source, '${RUN}', v5.units_version, v5.units_hash);
end $$;
`

const recovery1 = `-- docs/csat-learner/lecture-audit-c-20261024/g/db-fix/B-2014A29/stage1-recovery.sql (make-stages.mjs 생성)
-- 단계 1 되돌리기: 지문을 정정 전 값으로(compare-and-set) + 이 실행이 만든 v6 초안 1행 삭제(검수 행이 없을 때만).
-- 행 삭제가 들어 있으므로 데이터 삭제 승인 대상이다 — 단계 1 승인과 함께 명시 승인받는다.
do $$
declare n int;
begin
  update public.csat_items set passage = replace(passage, ${q(TO)}, ${q(FROM)})
   where id = '2014A#29' and position(${q(TO)} in passage) > 0;
  get diagnostics n = row_count;
  if n <> 1 then raise exception '2014A#29 지문이 단계 1 결과와 다르다'; end if;
  if (select md5(passage) from public.csat_items where id = '2014A#29') <> '${PASSAGE_BEFORE}' then raise exception '되돌린 지문 md5 가 정정 전 값과 다르다'; end if;
  if exists (select 1 from public.csat_analysis_reviews r join public.csat_item_analyses x on x.id = r.analysis_id
              where x.item_id = '2014A#29' and x.version = 6) then raise exception 'v6 에 검수 기록이 있다 — 단계 2 이후는 이 스크립트로 되돌리지 않는다'; end if;
  delete from public.csat_item_analyses where item_id = '2014A#29' and version = 6 and status = 'draft' and analyst_run = '${RUN}';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'v6 초안이 1행이 아니다(%)', n; end if;
end $$;
`
fs.writeFileSync(path.join(here, 'stage1.sql'), stage1)
fs.writeFileSync(path.join(here, 'stage1-recovery.sql'), recovery1)
console.log('stage1.sql', stage1.length, 'stage1-recovery.sql', recovery1.length)

const approver = opt('--approver'), approvedAt = opt('--approved-at'), binding = opt('--binding')
if (approver && approvedAt && binding) {
  if (!/^[0-9a-f]{64}$/.test(binding)) throw new Error('--binding 은 BINDING.json sha256 64자')
  const personas = ['persona-setter-codex-r2.json', 'persona-analyst-claude.json', 'persona-tutor-claude.json'].map(read)
  for (const p of personas) if (p.verdict !== 'pass') throw new Error(`${p.persona} 가 pass 가 아니다`)
  // checked 는 「무엇을 봤는지」 문자열 배열이다 — 형태를 바꾸지 않고 표시 문자열 두 줄만 덧붙인다
  const marks = [`reviewer_kind: ai (AI 역할 검수 — 사람 승인 아님)`, `human_content_approval: ${approver} · ${approvedAt} · binding ${binding}`]
  const stage2 = `-- docs/csat-learner/lecture-audit-c-20261024/g/db-fix/B-2014A29/stage2.sql (make-stages.mjs 생성)
-- 단계 2: 사람 내용 승인(${approver}, ${approvedAt}) 뒤 — AI 세 역할 검수(AI 검토로 표시) + 사람 승인 기록 + v6 발행.
-- 콘텐츠 판본 결속 BINDING.json sha256 ${binding}. 저장소 콘텐츠(강의 c9 v3 · 탐구 · digest) 통합과 같은 잠금 구간에서 실행한다.
do $$
declare v6 uuid;
begin
  select id into v6 from public.csat_item_analyses where item_id = '2014A#29' and version = 6 and status = 'draft' and analyst_run = '${RUN}';
  if v6 is null then raise exception 'v6 초안이 없다 — 단계 1 먼저'; end if;
${personas.map((p) => `  insert into public.csat_analysis_reviews (analysis_id, persona, verdict, findings, checked)
  values (v6, '${p.persona}', 'pass', ${q(JSON.stringify(p.findings))}::jsonb, ${q(JSON.stringify([...p.checked, ...marks]))}::jsonb);`).join('\n')}
  update public.csat_item_analyses set status = 'published', updated_at = now() where id = v6;
end $$;
`
  fs.writeFileSync(path.join(here, 'stage2.sql'), stage2)
  console.log('stage2.sql', stage2.length)
}
