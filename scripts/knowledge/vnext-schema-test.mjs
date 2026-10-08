// scripts/knowledge/vnext-schema-test.mjs
//
// 학습 원리 vNext 스키마 초안(_pending_20261008120000_knowledge_vnext.sql) 격리 검증(2026-10-08) — **공유 개발 DB 를 쓰지 않는다.**
// 격리 PostgreSQL(embedded-postgres · Supabase 역할 재현 bootstrap)에 기존 등록부 마이그레이션 7개 → 실측과 같은 꼴의 표본 행 →
// 초안을 적용하고 매핑 백필 · 제약 · 트리거 · RLS 를 단언한다. 실행기 · bootstrap 은 Vocaflow-ec-smoke 의 isolated-pg 를 빌려 쓴다.
//   node scripts/knowledge/vnext-schema-test.mjs [--pg-dir <isolated-pg 경로>]
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..')
const PG_DIR = process.argv.includes('--pg-dir') ? process.argv[process.argv.indexOf('--pg-dir') + 1] : 'D:/workspace/Vocaflow-ec-smoke/scripts/csat/error-evidence/isolated-pg'
const { startCluster, conn, as } = await import(pathToFileURL(path.join(PG_DIR, 'lib.mjs')).href)
const pg = (await import(pathToFileURL(path.join(PG_DIR, 'node_modules/pg/lib/index.js')).href)).default
const M = (f) => fs.readFileSync(path.join(REPO, 'supabase/migrations', f), 'utf8')
let fail = 0
const rec = (name, ok, detail = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 240) : ''}`) }

const cluster = await startCluster()
try {
  const admin = new pg.Client({ host: '127.0.0.1', port: 54329, database: 'ec', user: 'supabase_admin', password: 'admin' })
  await admin.connect()
  await admin.query(fs.readFileSync(path.join(PG_DIR, 'bootstrap.sql'), 'utf8'))
  await admin.query('set search_path = public, extensions')
  await admin.query('alter role postgres set search_path = public, extensions')
  await admin.end()
  const pool = conn('postgres', 'postgres')
  const run = async (sql) => { const c = await pool.connect(); try { await c.query(sql) } finally { c.release() } }
  for (const f of ['20260919120000_methodology_intelligence.sql', '20260928120000_knowledge_registry.sql', '20260928130000_knowledge_evidence_invariants.sql',
    '20260928140000_knowledge_evidence_concurrency.sql', '20260928150000_knowledge_regrade_locks_items.sql', '20261001120000_knowledge_evidence_version.sql',
    '20261001130000_knowledge_evidence_observed.sql']) await run(M(f))
  rec('기존 등록부 마이그레이션 7개 적용', true)

  // 실측과 같은 꼴의 표본(층 4 · 원리 slug 13 · 근거 외부 A)
  await run(`
    insert into knowledge_items (layer, slug, title, statement, status, created_by, updated_by) values
      ('essence','essence-meaning-processing','의미 처리','s','in_review','t','t'),
      ('principle','active-recall','인출','s','in_review','t','t'),
      ('principle','sequential-processing','순차','s','in_review','t','t'),
      ('principle','cohesion-cues','응집','s','in_review','t','t'),
      ('principle','task-directed-attention','과제 주의','s','in_review','t','t'),
      ('principle','phonological-decoding','음운','s','in_review','t','t'),
      ('principle','feedback-comparison','피드백','s','in_review','t','t'),
      ('method','method-reasoned-review','근거 기록','s','in_review','t','t'),
      ('practice','yt-aaaa','과제','s','extracted','t','t');
    insert into knowledge_evidence (item_id, grade, attribution, source_type, external_url, external_title, created_by)
      select id, 'A', 'stated', 'external', 'https://youtu.be/x', '영상', 't' from knowledge_items where slug = 'yt-aaaa';`)
  const before = (await pool.query('select count(*)::int n from knowledge_reviews')).rows[0].n

  await run(M('_pending_20261008120000_knowledge_vnext.sql'))
  rec('vNext 초안 적용(한 트랜잭션)', true)

  const kinds = Object.fromEntries((await pool.query('select slug, kind from knowledge_items')).rows.map((r) => [r.slug, r.kind]))
  rec('kind 백필 — 본질 묶음 · 처리 4 · 학습 · 방법 · 과제', kinds['essence-meaning-processing'] === 'essence_bundle' && kinds['sequential-processing'] === 'processing_mechanism'
    && kinds['phonological-decoding'] === 'processing_mechanism' && kinds['active-recall'] === 'learning_mechanism' && kinds['feedback-comparison'] === 'learning_mechanism'
    && kinds['method-reasoned-review'] === 'method' && kinds['yt-aaaa'] === 'task', kinds)
  rec('백필이 검토 기록 · 상태를 바꾸지 않음', (await pool.query('select count(*)::int n from knowledge_reviews')).rows[0].n === before)
  rec('외부 근거 → practitioner_claim', (await pool.query(`select evidence_level from knowledge_evidence`)).rows.every((r) => r.evidence_level === 'practitioner_claim'))

  const sr = (sql, p) => as(pool, { role: 'service_role' }, sql, p)
  const ok = async (sql, p) => (await sr(sql, p)).ok
  rec('practice 를 kind 없이 넣으면 task(기존 import RPC 호환)', (await sr(`insert into knowledge_items (layer, slug, title, statement, created_by, updated_by) values ('practice','yt-bbbb','t','s','t','t') returning kind`)).rows?.[0]?.kind === 'task')
  const pnull = await sr(`insert into knowledge_items (layer, slug, title, statement, created_by, updated_by) values ('principle','p-x','t','s','t','t') returning kind`)
  rec('principle 을 kind 없이 넣으면 null(기존 createItemAction 호환 — NOT NULL 은 쓰기 경로 갱신 뒤)', pnull.ok && pnull.rows[0].kind === null, pnull)
  rec('층과 맞지 않는 kind 거부', !(await ok(`insert into knowledge_items (layer, kind, slug, title, statement, created_by, updated_by) values ('method','task','m-x','t','s','t','t')`)))

  const rs = await sr(`insert into knowledge_research_sources (citation, design, l2_context, year, created_by) values ('Test (2020). meta.', 'meta_analysis', true, 2020, 't') returning id`)
  rec('연구 서지 설계 변경 거부(새 서지 행으로)', !(await ok(`update knowledge_research_sources set design='expert_opinion' where id=$1`, [rs.rows[0].id])))
  const comp = await sr(`insert into knowledge_items (layer, kind, slug, title, statement, status, created_by, updated_by) values ('essence','competency','reading-claim-evidence','주장 근거','s','in_review','t','t') returning id`)
  const cid = comp.rows[0].id
  const ev = await sr(`insert into knowledge_evidence (item_id, grade, attribution, source_type, research_source_id, evidence_level, applicability, created_by) values ($1,'B','stated','research',$2,'practitioner_claim','partial','t') returning evidence_level`, [cid, rs.rows[0].id])
  rec('연구 근거 수준은 서지 설계에서(입력값 무시)', ev.ok && ev.rows[0].evidence_level === 'meta_analysis', ev)
  rec('외부 근거에 rct 수준 거부(강사 · 웹 주장이 연구 수준을 갖지 못함)', !(await ok(`insert into knowledge_evidence (item_id, grade, attribution, source_type, external_url, external_title, evidence_level, created_by) values ($1,'A','stated','external','https://x.y','t','rct','t')`, [cid])))
  rec('research 근거에 URL 섞으면 거부(출처 하나만)', !(await ok(`insert into knowledge_evidence (item_id, grade, attribution, source_type, research_source_id, external_url, created_by) values ($1,'B','stated','research',$2,'https://x.y','t')`, [cid, rs.rows[0].id])))
  rec('efficacy 를 INSERT 로 우회 불가(근거 없는 새 항목)', !(await ok(`insert into knowledge_items (layer, kind, slug, title, statement, efficacy, created_by, updated_by) values ('method','method','m-eff','t','s','research_supported','t','t')`)))

  // 적용: 채택 항목만 · 검증 프로토콜 필요
  const app = await sr(`insert into knowledge_applications (item_id, surface, surface_ref, created_by, updated_by) values ($1,'csat_item_task','claim-evidence-v1','t','t') returning id`, [cid])
  const aid = app.rows[0].id
  rec('적용 draft 생성', app.ok, app.err)
  await sr(`insert into knowledge_trials (application_id, design, synthetic, created_by) values ($1, '{"pre":true,"post":true,"delayed_days":14,"transfer":true,"min_n":2}', true, 't')`, [aid])
  rec('채택 안 된 항목(in_review)은 적용을 켤 수 없음', !(await ok(`update knowledge_applications set status='active', released_at=now() where id=$1`, [aid])))
  rec('항목 채택(근거 있음)', await ok(`update knowledge_items set status='adopted', updated_by='t' where id=$1`, [cid]))
  const app0 = await sr(`insert into knowledge_applications (item_id, surface, surface_ref, created_by, updated_by) values ($1,'csat_item_task','no-trial','t','t') returning id`, [cid])
  rec('검증 프로토콜 없이 active 거부', !(await ok(`update knowledge_applications set status='active', released_at=now() where id=$1`, [app0.rows[0].id])))
  rec('채택 + 검증 프로토콜이면 active', await ok(`update knowledge_applications set status='active', released_at=now() where id=$1`, [aid]))
  rec('active 적용의 마지막 trial 삭제 거부', !(await ok(`delete from knowledge_trials where application_id=$1`, [aid])))
  rec('항목 applied(활성 적용 있음)', await ok(`update knowledge_items set status='applied', updated_by='t' where id=$1`, [cid]))
  rec('applied 항목에 근거 추가 가능(근거 버전 증가가 applied 가드에 막히지 않음)', await ok(`insert into knowledge_evidence (item_id, grade, attribution, source_type, external_url, external_title, created_by) values ($1,'A','stated','external','https://x.y/2','t','t')`, [cid]))
  rec('pause 에 이유 없으면 거부', !(await ok(`update knowledge_applications set status='paused' where id=$1`, [aid])))
  rec('마지막 active 적용 중단 → 항목 applied 에서 in_review 로', (await ok(`update knowledge_applications set status='paused', status_reason='시험', updated_by='t' where id=$1`, [aid]))
    && (await pool.query(`select status from knowledge_items where id=$1`, [cid])).rows[0].status === 'in_review')
  // 항목이 재검토로 가면 active 적용 자동 중단
  await sr(`update knowledge_items set status='adopted', updated_by='t' where id=$1`, [cid])
  await sr(`update knowledge_applications set status='active', released_at=now(), status_reason=null where id=$1`, [aid])
  rec('항목 재검토 → active 적용 자동 중단(학습자 노출 해제)', (await ok(`update knowledge_items set status='in_review', status_reason='시험', updated_by='t' where id=$1`, [cid]))
    && (await pool.query(`select status from knowledge_applications where id=$1`, [aid])).rows[0].status === 'paused')

  // efficacy: 합성 trial · 결과 방향 · 최소 표본
  const pr = await sr(`insert into knowledge_items (layer, kind, slug, title, statement, status, created_by, updated_by) values ('practice','task','task-ce-1','과제','s','in_review','t','t') returning id`)
  const pid = pr.rows[0].id
  await sr(`insert into knowledge_evidence (item_id, grade, attribution, source_type, external_url, external_title, created_by) values ($1,'A','stated','external','https://x.y','t','t')`, [pid])
  const app2 = await sr(`insert into knowledge_applications (item_id, surface, surface_ref, created_by, updated_by) values ($1,'csat_item_task','task-ce-1','t','t') returning id`, [pid])
  await sr(`insert into knowledge_trials (application_id, design, synthetic, status, result, analyzed_at, created_by) values ($1,'{}',true,'analyzed','supported',now(),'t')`, [app2.rows[0].id])
  rec('합성 학습자 검증만으로 efficacy 변경 거부', !(await ok(`update knowledge_items set efficacy='research_supported', updated_by='t' where id=$1`, [pid])))
  rec('실제 학습자 기록 없이 비합성 trial 을 analyzed 로 거부(최소 표본)', !(await ok(`insert into knowledge_trials (application_id, design, synthetic, status, result, analyzed_at, created_by) values ($1,'{"min_n":1}',false,'analyzed','not_supported',now(),'t')`, [app2.rows[0].id])))
  const u1 = '00000000-0000-0000-0000-000000000001', u2 = '00000000-0000-0000-0000-000000000002'
  { // auth.users 는 superuser 만 쓴다(bootstrap — postgres 는 select · references 만)
    const su = new pg.Client({ host: '127.0.0.1', port: 54329, database: 'ec', user: 'supabase_admin', password: 'admin' })
    await su.connect(); await su.query(`insert into auth.users (id) values ($1), ($2)`, [u1, u2]); await su.end()
  }
  const tr = await sr(`insert into knowledge_trials (application_id, design, synthetic, status, created_by) values ($1,'{"min_n":1}',false,'running','t') returning id`, [app2.rows[0].id])
  await sr(`insert into learning_task_attempts (user_id, task_key, trial_id, phase, is_correct) values ($1,'ce',$2,'pre',false), ($1,'ce',$2,'post',true)`, [u1, tr.rows[0].id])
  rec('실제 사전 · 사후 기록이 최소 표본이면 analyzed 허용', await ok(`update knowledge_trials set status='analyzed', result='not_supported', analyzed_at=now() where id=$1`, [tr.rows[0].id]))
  rec('trial 결과(not_supported)와 다른 efficacy(research_supported) 거부', !(await ok(`update knowledge_items set efficacy='research_supported', updated_by='t' where id=$1`, [pid])))
  rec('trial 결과와 같은 efficacy(not_supported) 허용', await ok(`update knowledge_items set efficacy='not_supported', updated_by='t' where id=$1`, [pid]))
  rec('연구 근거(메타분석 · partial)가 있으면 efficacy 변경 허용', await ok(`update knowledge_items set efficacy='research_supported', updated_by='t' where id=$1`, [cid]))
  rec('활성 적용 없이 applied 거부', !(await ok(`update knowledge_items set status='applied', updated_by='t' where id=$1`, [pid])))

  // learning_task_attempts RLS · 권한
  await sr(`insert into learning_task_attempts (user_id, task_key, phase, is_correct) values ($1,'ce','practice',false)`, [u2])
  const own = await as(pool, { role: 'authenticated', uid: u1 }, `select distinct user_id from learning_task_attempts`)
  rec('학습자는 본인 기록만 읽음', own.ok && own.rows.length === 1 && own.rows[0].user_id === u1, own)
  rec('학습자는 직접 쓰지 못함(채점은 서버)', !(await as(pool, { role: 'authenticated', uid: u1 }, `insert into learning_task_attempts (user_id, task_key, phase) values ($1,'ce','post')`, [u1])).ok)
  rec('학습자는 TRUNCATE 못함(기본 ACL 회수 — RLS 는 TRUNCATE 를 막지 않는다)', !(await as(pool, { role: 'authenticated', uid: u1 }, `truncate learning_task_attempts`)).ok)
  rec('anon 은 읽지 못함', !(await as(pool, { role: 'anon' }, `select 1 from learning_task_attempts`)).ok)
  rec('학습자는 관리 표(적용 · 탐구)를 읽지 못함', !(await as(pool, { role: 'authenticated', uid: u1 }, `select 1 from knowledge_applications`)).ok)
  await pool.end()
} catch (e) {
  rec('실행 오류 없이 끝남', false, e.message)
} finally {
  await cluster.stop()
}
console.log(fail ? `실패 ${fail}` : '모든 단언 통과')
process.exit(fail ? 1 : 0)
