// scripts/knowledge/vnext-db-smoke.mjs
//
// 학습 원리 vNext 계약을 **실제 개발 DB 에서** 다시 확인한다(2026-10-08) — 격리 검증(vnext-schema-test.mjs)과 같은 계약을
// 한 트랜잭션 안에서 SAVEPOINT 로 돌리고 **끝에 전부 ROLLBACK** 한다(시험 행 · 상태 변경이 남지 않는다). 역할은 SET LOCAL ROLE 로 바꾼다.
// 기존 실데이터는 읽기만 한다(백필 결과 · 권한). 시험 행 slug 는 zz-vnext- 로 시작한다.
//   node --tls-max-v1.2 --env-file=<.env.local> scripts/knowledge/vnext-db-smoke.mjs
import fs from 'node:fs'
import { createRequire } from 'node:module'

const url = process.env.SUPABASE_DB_URL
if (!url?.includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const { Client } = createRequire('D:/workspace/Vocaflow-ec-smoke/scripts/csat/error-evidence/isolated-pg/node_modules/x.js')('pg')
const c = new Client({ connectionString: url.replace(/[?&]sslmode=[^&]*/, ''), ssl: { ca: fs.readFileSync('D:/workspace/Vocaflow-ec-reveal/tmp/reveal-db-deployment/supabase-ca.crt', 'utf8') } })
let fail = 0
const rec = (name, ok, detail = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 220) : ''}`) }
let sp = 0
/** 역할을 바꿔 한 문장 — 실패해도 바깥 트랜잭션은 SAVEPOINT 로 살린다 */
async function as(role, sql, params = [], uid = null) {
  const name = `s${++sp}`
  await c.query(`savepoint ${name}`)
  try {
    await c.query(`set local role ${role}`)
    if (uid) await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid])
    const r = await c.query(sql, params)
    await c.query('reset role')
    await c.query(`release savepoint ${name}`)
    return { ok: true, rows: r.rows }
  } catch (e) {
    await c.query(`rollback to savepoint ${name}`)
    await c.query('reset role')
    return { ok: false, err: e.message }
  }
}
const sr = (sql, p) => as('service_role', sql, p)
const ok = async (sql, p) => (await sr(sql, p)).ok
const one = async (sql, p) => (await c.query(sql, p)).rows

await c.connect()
await c.query('begin')
try {
  // ── 실데이터(읽기) ──
  const kinds = await one(`select layer, kind, count(*)::int n from knowledge_items group by 1,2 order by 1,2`)
  rec('153행 분류 보강 — 묶음 4 · 처리 4 · 학습 9 · 방법 18 · 과제 118 · null 0', JSON.stringify(kinds) === JSON.stringify([
    { layer: 'essence', kind: 'essence_bundle', n: 4 }, { layer: 'method', kind: 'method', n: 18 }, { layer: 'practice', kind: 'task', n: 118 },
    { layer: 'principle', kind: 'learning_mechanism', n: 9 }, { layer: 'principle', kind: 'processing_mechanism', n: 4 }]), kinds)
  const proc = (await one(`select string_agg(slug, ',' order by slug) s from knowledge_items where kind = 'processing_mechanism'`))[0].s
  rec('처리 기제 = 순차 · 응집 · 과제 주의 · 음운 해독', proc === 'cohesion-cues,phonological-decoding,sequential-processing,task-directed-attention', proc)
  const lv = await one(`select source_type, evidence_level, applicability, count(*)::int n from knowledge_evidence group by 1,2,3`)
  rec('118행 근거 — 전부 practitioner_claim · 적합성 unknown(연구 근거로 승격 0)', lv.length === 1 && lv[0].n === 118 && lv[0].evidence_level === 'practitioner_claim' && lv[0].applicability === 'unknown', lv)
  rec('세 축 분리 — grade(A/B/C) · evidence_level · applicability 가 서로 다른 열', (await one(`select count(*)::int n from information_schema.columns where table_name='knowledge_evidence' and column_name in ('grade','evidence_level','applicability')`))[0].n === 3)
  rec('efficacy 전부 not_assessed(적용으로 바뀐 것 없음)', (await one(`select count(*)::int n from knowledge_items where efficacy <> 'not_assessed'`))[0].n === 0)

  // ── 계약(시험 행 — 끝에 롤백) ──
  rec('practice 를 kind 없이 넣으면 task', (await sr(`insert into knowledge_items (layer, slug, title, statement, created_by, updated_by) values ('practice','zz-vnext-p','t','s','t','t') returning kind`)).rows?.[0]?.kind === 'task')
  const pn = await sr(`insert into knowledge_items (layer, slug, title, statement, created_by, updated_by) values ('principle','zz-vnext-pr','t','s','t','t') returning kind`)
  rec('principle 을 kind 없이 넣으면 null(기존 액션 호환)', pn.ok && pn.rows[0].kind === null, pn)
  rec('층과 맞지 않는 kind 거부', !(await ok(`insert into knowledge_items (layer, kind, slug, title, statement, created_by, updated_by) values ('method','task','zz-vnext-m','t','s','t','t')`)))
  const rs = await sr(`insert into knowledge_research_sources (citation, design, l2_context, year, created_by) values ('zz-vnext test (2020). meta.', 'meta_analysis', true, 2020, 't') returning id`)
  rec('연구 서지 설계 변경 거부', !(await ok(`update knowledge_research_sources set design='expert_opinion' where id=$1`, [rs.rows[0].id])))
  const cid = (await sr(`insert into knowledge_items (layer, kind, slug, title, statement, status, created_by, updated_by) values ('essence','competency','zz-vnext-c','주장 근거','s','in_review','t','t') returning id`)).rows[0].id
  const ev = await sr(`insert into knowledge_evidence (item_id, grade, attribution, source_type, research_source_id, evidence_level, applicability, created_by) values ($1,'B','stated','research',$2,'practitioner_claim','partial','t') returning evidence_level`, [cid, rs.rows[0].id])
  rec('연구 근거 수준은 서지 설계에서', ev.ok && ev.rows[0].evidence_level === 'meta_analysis', ev)
  rec('외부 근거에 rct 수준 거부(실무자 주장 승격 금지)', !(await ok(`insert into knowledge_evidence (item_id, grade, attribution, source_type, external_url, external_title, evidence_level, created_by) values ($1,'A','stated','external','https://x.y','t','rct','t')`, [cid])))
  rec('research 근거에 URL 섞으면 거부', !(await ok(`insert into knowledge_evidence (item_id, grade, attribution, source_type, research_source_id, external_url, created_by) values ($1,'B','stated','research',$2,'https://x.y','t')`, [cid, rs.rows[0].id])))
  rec('efficacy INSERT 우회 거부', !(await ok(`insert into knowledge_items (layer, kind, slug, title, statement, efficacy, created_by, updated_by) values ('method','method','zz-vnext-e','t','s','research_supported','t','t')`)))
  const aid = (await sr(`insert into knowledge_applications (item_id, surface, surface_ref, created_by, updated_by) values ($1,'csat_item_task','zz-vnext-a','t','t') returning id`, [cid])).rows[0].id
  await sr(`insert into knowledge_trials (application_id, design, synthetic, created_by) values ($1,'{"min_n":2}',true,'t')`, [aid])
  rec('미채택(in_review) 항목은 적용을 켤 수 없음', !(await ok(`update knowledge_applications set status='active', released_at=now() where id=$1`, [aid])))
  rec('항목 채택(근거 있음)', await ok(`update knowledge_items set status='adopted', updated_by='t' where id=$1`, [cid]))
  const a0 = (await sr(`insert into knowledge_applications (item_id, surface, surface_ref, created_by, updated_by) values ($1,'csat_item_task','zz-vnext-a0','t','t') returning id`, [cid])).rows[0].id
  rec('검증 프로토콜 없이 active 거부', !(await ok(`update knowledge_applications set status='active', released_at=now() where id=$1`, [a0])))
  rec('채택 + 프로토콜이면 active', await ok(`update knowledge_applications set status='active', released_at=now() where id=$1`, [aid]))
  rec('active 적용의 마지막 trial 삭제 거부', !(await ok(`delete from knowledge_trials where application_id=$1`, [aid])))
  rec('applied 진입(활성 적용 있음)', await ok(`update knowledge_items set status='applied', updated_by='t' where id=$1`, [cid]))
  rec('applied 항목에 근거 추가 가능(근거 버전 증가가 막히지 않음)', await ok(`insert into knowledge_evidence (item_id, grade, attribution, source_type, external_url, external_title, created_by) values ($1,'A','stated','external','https://x.y/2','t','t')`, [cid]))
  rec('중단에 이유 없으면 거부', !(await ok(`update knowledge_applications set status='paused' where id=$1`, [aid])))
  rec('마지막 active 적용 중단 → applied 항목 재검토', (await ok(`update knowledge_applications set status='paused', status_reason='시험', updated_by='t' where id=$1`, [aid]))
    && (await one(`select status from knowledge_items where id=$1`, [cid]))[0].status === 'in_review')
  await sr(`update knowledge_items set status='adopted', updated_by='t' where id=$1`, [cid])
  await sr(`update knowledge_applications set status='active', released_at=now(), status_reason=null where id=$1`, [aid])
  rec('항목 재검토 → active 적용 자동 중단', (await ok(`update knowledge_items set status='in_review', status_reason='시험', updated_by='t' where id=$1`, [cid]))
    && (await one(`select status from knowledge_applications where id=$1`, [aid]))[0].status === 'paused')
  const pid = (await sr(`insert into knowledge_items (layer, kind, slug, title, statement, status, created_by, updated_by) values ('practice','task','zz-vnext-t','과제','s','in_review','t','t') returning id`)).rows[0].id
  await sr(`insert into knowledge_evidence (item_id, grade, attribution, source_type, external_url, external_title, created_by) values ($1,'A','stated','external','https://x.y','t','t')`, [pid])
  const a2 = (await sr(`insert into knowledge_applications (item_id, surface, surface_ref, created_by, updated_by) values ($1,'csat_item_task','zz-vnext-t','t','t') returning id`, [pid])).rows[0].id
  await sr(`insert into knowledge_trials (application_id, design, synthetic, status, result, analyzed_at, created_by) values ($1,'{}',true,'analyzed','supported',now(),'t')`, [a2])
  rec('합성 학습자 검증만으로 efficacy 변경 거부', !(await ok(`update knowledge_items set efficacy='research_supported', updated_by='t' where id=$1`, [pid])))
  rec('실제 기록 없이 비합성 trial analyzed 거부(최소 표본)', !(await ok(`insert into knowledge_trials (application_id, design, synthetic, status, result, analyzed_at, created_by) values ($1,'{"min_n":1}',false,'analyzed','not_supported',now(),'t')`, [a2])))
  const users = (await one(`select id from auth.users order by created_at limit 2`)).map((r) => r.id)
  const tr = (await sr(`insert into knowledge_trials (application_id, design, synthetic, status, created_by) values ($1,'{"min_n":1}',false,'running','t') returning id`, [a2])).rows[0].id
  await sr(`insert into learning_task_attempts (user_id, task_key, trial_id, phase, is_correct) values ($1,'zz-vnext',$2,'pre',false), ($1,'zz-vnext',$2,'post',true)`, [users[0], tr])
  rec('실제 사전 · 사후 최소 표본이면 analyzed 허용', await ok(`update knowledge_trials set status='analyzed', result='not_supported', analyzed_at=now() where id=$1`, [tr]))
  rec('trial 결과와 다른 efficacy 거부', !(await ok(`update knowledge_items set efficacy='research_supported', updated_by='t' where id=$1`, [pid])))
  rec('trial 결과와 같은 efficacy 허용', await ok(`update knowledge_items set efficacy='not_supported', updated_by='t' where id=$1`, [pid]))
  rec('연구 근거(메타분석 · partial)면 efficacy 허용', await ok(`update knowledge_items set efficacy='research_supported', updated_by='t' where id=$1`, [cid]))
  rec('활성 적용 없이 applied 거부', !(await ok(`update knowledge_items set status='applied', updated_by='t' where id=$1`, [pid])))

  // RLS · 권한(학습자 역할)
  await sr(`insert into learning_task_attempts (user_id, task_key, phase, is_correct) values ($1,'zz-vnext','practice',false)`, [users[1]])
  const own = await as('authenticated', `select distinct user_id from learning_task_attempts where task_key = 'zz-vnext'`, [], users[0])
  rec('학습자는 본인 기록만 읽음', own.ok && own.rows.length === 1 && own.rows[0].user_id === users[0], own)
  rec('학습자는 직접 쓰지 못함', !(await as('authenticated', `insert into learning_task_attempts (user_id, task_key, phase) values ($1,'zz-vnext','post')`, [users[0]], users[0])).ok)
  rec('학습자는 TRUNCATE 못함', !(await as('authenticated', `truncate learning_task_attempts`, [], users[0])).ok)
  rec('학습자는 UPDATE · DELETE 못함', !(await as('authenticated', `delete from learning_task_attempts`, [], users[0])).ok)
  rec('anon 은 읽지 못함', !(await as('anon', `select 1 from learning_task_attempts`)).ok)
  rec('학습자는 관리 표(적용 · 탐구 · 서지 · trial)를 읽지 못함', !(await as('authenticated', `select 1 from knowledge_applications`, [], users[0])).ok
    && !(await as('authenticated', `select 1 from knowledge_inquiries`, [], users[0])).ok && !(await as('authenticated', `select 1 from knowledge_trials`, [], users[0])).ok)
} catch (e) {
  rec('실행 오류 없이 끝남', false, e.message)
} finally {
  await c.query('rollback')
  const left = await one(`select (select count(*)::int from knowledge_items where slug like 'zz-vnext-%') items, (select count(*)::int from learning_task_attempts) attempts, (select count(*)::int from knowledge_applications) apps, (select count(*)::int from knowledge_research_sources) rs`)
  rec('롤백 — 시험 행 0(항목 · 수행 기록 · 적용 · 서지)', left[0].items === 0 && left[0].attempts === 0 && left[0].apps === 0 && left[0].rs === 0, left[0])
  await c.end()
}
console.log(fail ? `실패 ${fail}` : '모든 단언 통과')
process.exit(fail ? 1 : 0)
