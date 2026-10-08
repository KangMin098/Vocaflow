// scripts/knowledge/vnext-schema-test.mjs
//
// knowledge_* 마이그레이션 전체 + 20261008120000_knowledge_vnext 를 PGlite 에 적용하고 불변식을 시험한다(원격 DB 안 씀).
// 실행: node scripts/knowledge/vnext-schema-test.mjs <@electric-sql/pglite 가 설치된 디렉터리> [migrations 디렉터리]
// 앱 의존성을 늘리지 않으려고 PGlite 는 저장소 밖에 설치한다(scripts/methodology/schema-test.mjs 와 같은 방식).
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const { PGlite } = createRequire(path.join(path.resolve(process.argv[2] ?? '.'), 'noop.js'))('@electric-sql/pglite')
const MIG = process.argv[3] ?? path.resolve('supabase/migrations')
const db = new PGlite()
const files = fs.readdirSync(MIG).filter((f) => /knowledge|methodology_intelligence/.test(f) && f.endsWith('.sql')).sort()

await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create table public.csat_items (id text primary key);
  create table public.funnel_events (id bigserial primary key, event text not null,
    constraint funnel_events_event_check check (event = any (array['screen_viewed','csat_dx_viewed']::text[])));
`)
for (const f of files) {
  try { await db.exec(fs.readFileSync(path.join(MIG, f), 'utf8')) ; console.log('applied', f) }
  catch (e) { console.log('FAIL', f, e.message); process.exit(1) }
}

let pass = 0, fail = 0
async function expect(name, sql, shouldFail, match) {
  try {
    await db.exec(sql)
    if (shouldFail) { fail++; console.log('✗', name, '— 성공해 버림') } else { pass++; console.log('✓', name) }
  } catch (e) {
    if (shouldFail && (!match || e.message.includes(match))) { pass++; console.log('✓', name, '→', e.message.slice(0, 70)) }
    else { fail++; console.log('✗', name, e.message) }
  }
}
async function one(sql) { return (await db.query(sql)).rows[0] }

await db.exec(`
  insert into auth.users values ('00000000-0000-0000-0000-000000000001');
  insert into knowledge_items (layer, slug, title, statement, status, created_by, updated_by) values
    ('essence','cap-x','역량','s','in_review','t','t'),
    ('method','meth-x','방법','s','in_review','t','t'),
    ('principle','pr-x','원리','s','in_review','t','t');
  insert into knowledge_evidence (item_id, grade, attribution, source_type, external_url, external_title, created_by)
    select id, 'B', 'stated', 'external', 'https://doi.org/x', 'x', 't' from knowledge_items;
`).catch((e) => { console.log('seed fail', e.message); process.exit(1) })

await expect('facet 은 원리에만', `update knowledge_items set facet='language' where slug='cap-x'`, true, 'facet')
await expect('원리 facet 허용', `update knowledge_items set facet='learning' where slug='pr-x'`, false)
await expect('research_level 값 검사', `update knowledge_evidence set research_level='vibes'`, true)
await expect('처음부터 deployed 금지', `insert into knowledge_designs (slug,title,learner_summary,procedure,module_key,assessment,status,created_by,updated_by)
  values ('d0','t','s','[{"title":"a"}]','csat_claim_evidence','{}','deployed','t','t')`, true, '새 설계')
await db.exec(`insert into knowledge_designs (slug,title,learner_summary,procedure,module_key,assessment,created_by,updated_by)
  values ('d1','t','s','[{"title":"a"}]','csat_claim_evidence','{}','t','t')`)
await expect('연결 없는 배포 거부', `update knowledge_designs set status='deployed' where slug='d1'`, true, '역량 또는 방법론')
await db.exec(`insert into knowledge_design_items select d.id, i.id, case i.layer when 'essence' then 'capability' when 'method' then 'method' else 'learning_mechanism' end
  from knowledge_designs d, knowledge_items i where d.slug='d1'`)
await expect('미채택 항목 배포 거부', `update knowledge_designs set status='deployed' where slug='d1'`, true, '채택되지 않은')
await db.exec(`update knowledge_items set status='adopted', updated_by='human'`)
await expect('모두 채택 → 배포', `update knowledge_designs set status='deployed', updated_by='human' where slug='d1'`, false)
console.log('  열린 배포', await one(`select count(*)::int n, max(design_version) v from knowledge_deployments where ended_at is null`))
await expect('배포 중 내용 변경 거부', `update knowledge_designs set learner_summary='x' where slug='d1'`, true, '배포 중')
await expect('배포 중 연결 변경 거부', `delete from knowledge_design_items where design_id=(select id from knowledge_designs where slug='d1') and role='method'`, true, '배포 중')

const dep = await one(`select id, design_id from knowledge_deployments where ended_at is null`)
const uid = '00000000-0000-0000-0000-000000000001'
await expect('열린 배포에 실기록', `insert into knowledge_task_runs (user_id,design_id,design_version,deployment_id,item_id,phase,response,claim_hit)
  values ('${uid}','${dep.design_id}',1,'${dep.id}','2026#20','train','{"claimSentence":5}',true)`, false)
await expect('배포 버전 불일치 거부', `insert into knowledge_task_runs (user_id,design_id,design_version,deployment_id,item_id,phase,response)
  values ('${uid}','${dep.design_id}',2,'${dep.id}','2026#20','train','{}')`, true, '버전')
await expect('배포 없이 실기록 거부', `insert into knowledge_task_runs (user_id,design_id,design_version,item_id,phase,response)
  values ('${uid}','${dep.design_id}',1,'2026#20','train','{}')`, true)
await expect('미리보기는 배포 없이 허용', `insert into knowledge_task_runs (user_id,design_id,design_version,item_id,phase,response,preview)
  values ('${uid}','${dep.design_id}',1,'2026#20','train','{}',true)`, false)

// 근거 변화 → 자동 중단
await db.exec(`update knowledge_items set status='in_review', updated_by='regrade' where slug='meth-x'`)
console.log('  설계 상태', await one(`select status, status_reason from knowledge_designs where slug='d1'`))
console.log('  배포 끝', await one(`select end_reason from knowledge_deployments where id='${dep.id}'`))
const st = await one(`select status from knowledge_designs where slug='d1'`)
if (st.status === 'paused') { pass++; console.log('✓ 채택 해제 → 설계 paused') } else { fail++; console.log('✗ 자동 중단 안 됨') }
const er = await one(`select end_reason from knowledge_deployments where id='${dep.id}'`)
if (er.end_reason === 'evidence_changed') { pass++; console.log('✓ 배포 끝 이유 evidence_changed') } else { fail++; console.log('✗ end_reason', er) }
await expect('닫힌 배포에 실기록 거부', `insert into knowledge_task_runs (user_id,design_id,design_version,deployment_id,item_id,phase,response)
  values ('${uid}','${dep.design_id}',1,'${dep.id}','2026#20','train','{}')`, true, '열린 배포')

// 중단 뒤 내용 변경 → version 2
await db.exec(`update knowledge_designs set learner_summary='고침', updated_by='h' where slug='d1'`)
console.log('  버전', await one(`select version from knowledge_designs where slug='d1'`))
// 수동 중단 이유
await db.exec(`update knowledge_items set status='adopted', updated_by='h' where slug='meth-x'`)
await db.exec(`update knowledge_designs set status='deployed', updated_by='h' where slug='d1'`)
await db.exec(`update knowledge_designs set status='paused', status_reason='운영자 중단', updated_by='h' where slug='d1'`)
console.log('  수동 중단', await one(`select end_reason, design_version from knowledge_deployments order by started_at desc, design_version desc limit 1`))
// 근거 축 변경 → 채택 항목 재검토 → 배포 자동 중단
await db.exec(`update knowledge_designs set status='ready', status_reason=null, updated_by='h' where slug='d1'`)
await db.exec(`update knowledge_designs set status='deployed', updated_by='h' where slug='d1'`)
await db.exec(`update knowledge_evidence set fit='weak' where item_id=(select id from knowledge_items where slug='pr-x')`)
const ax = await one(`select (select status from knowledge_items where slug='pr-x') item, (select status from knowledge_designs where slug='d1') design, (select end_reason from knowledge_deployments order by started_at desc, design_version desc limit 1) er`)
if (ax.item === 'in_review' && ax.design === 'paused' && ax.er === 'evidence_changed') { pass++; console.log('✓ 근거 축 하향 → 재검토 → 배포 중단', ax) } else { fail++; console.log('✗ 근거 축 경로', ax) }
await expect('합성은 효과 판정 금지', `insert into knowledge_validation_runs (design_id,design_version,synthetic,n_learners,n_runs,metrics,verdict,computed_by)
  values ('${dep.design_id}',1,true,30,300,'{}','positive','t')`, true)
await expect('결론엔 불확실성 필수', `insert into knowledge_inquiries (slug,question,status,conclusion,created_by,updated_by) values ('q','?','concluded','c','t','t')`, true)
await expect('이벤트 허용 목록 덧붙임', `insert into funnel_events (event) values ('knowledge_task_submitted'),('csat_dx_viewed')`, false)

// RLS: authenticated 는 자기 행만
await db.exec(`grant usage on schema public to authenticated; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`)
await db.exec(`set role authenticated; select set_config('test.uid','${uid}',false);`)
const mine = await one(`select count(*)::int n from knowledge_task_runs`)
await db.exec(`select set_config('test.uid','00000000-0000-0000-0000-000000000009',false);`)
const other = await one(`select count(*)::int n from knowledge_task_runs`)
await expect('authenticated 쓰기 불가', `insert into knowledge_task_runs (user_id,design_id,design_version,item_id,phase,response,preview) values ('${uid}','${dep.design_id}',1,'x','train','{}',true)`, true)
await expect('authenticated 설계 읽기 불가', `select * from knowledge_designs`, true)
await db.exec(`reset role`)
if (mine.n === 2 && other.n === 0) { pass++; console.log('✓ RLS 자기 행만', mine.n, other.n) } else { fail++; console.log('✗ RLS', mine, other) }

console.log(`\n${pass} 통과 · ${fail} 실패`)
process.exit(fail ? 1 : 0)
