// scripts/knowledge/pending-guards-test.mjs
//
// 미적용 SQL 후보 2개의 격리 검증(2026-10-08 · Phase 3) — **공유 개발 DB 를 쓰지 않는다.**
//   20261008140000_knowledge_review_cascade_guard.sql  — 관리자 화면을 거치지 않는 변경에도 재검토 불변식(I1 · I2 · I3)
//   _pending_20261008140100_learning_task_attempts_idempotency.sql — 같은 제출 두 번 → 한 행
// 격리 PostgreSQL(embedded-postgres · Supabase 역할 bootstrap)에 등록부 마이그레이션 7개 + vNext(20261008120000) → 후보 2개 적용.
// 각 단언은 **앱 경로가 아닌 SQL 직접 변경**으로 한다(그게 이 가드가 막으려는 경로다).
//   node scripts/knowledge/pending-guards-test.mjs [--pg-dir <isolated-pg 경로>]
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..')
const PG_DIR = process.argv.includes('--pg-dir') ? process.argv[process.argv.indexOf('--pg-dir') + 1] : 'D:/workspace/Vocaflow-ec-smoke/scripts/csat/error-evidence/isolated-pg'
const { startCluster, conn } = await import(pathToFileURL(path.join(PG_DIR, 'lib.mjs')).href)
const pg = (await import(pathToFileURL(path.join(PG_DIR, 'node_modules/pg/lib/index.js')).href)).default
const M = (f) => fs.readFileSync(path.join(REPO, 'supabase/migrations', f), 'utf8')
let fail = 0
const rec = (name, ok, detail = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 240) : ''}`) }

const cluster = await startCluster()
try {
  const admin = new pg.Client({ host: '127.0.0.1', port: 54329, database: 'ec', user: 'supabase_admin', password: 'admin' })
  await admin.connect()
  await admin.query(fs.readFileSync(path.join(PG_DIR, 'bootstrap.sql'), 'utf8'))
  await admin.query('alter role postgres set search_path = public, extensions')
  await admin.end()
  const pool = conn('postgres', 'postgres')
  const q = async (sql, params = []) => { const c = await pool.connect(); try { return await c.query(sql, params) } finally { c.release() } }
  for (const f of ['20260919120000_methodology_intelligence.sql', '20260928120000_knowledge_registry.sql', '20260928130000_knowledge_evidence_invariants.sql',
    '20260928140000_knowledge_evidence_concurrency.sql', '20260928150000_knowledge_regrade_locks_items.sql', '20261001120000_knowledge_evidence_version.sql',
    '20261001130000_knowledge_evidence_observed.sql', '20261008120000_knowledge_vnext.sql',
    '20261008140000_knowledge_review_cascade_guard.sql', '_pending_20261008140100_learning_task_attempts_idempotency.sql',
    '20261008150000_knowledge_statement_review_fix.sql']) await q(M(f))
  rec('등록부 7 + vNext + 후보 2 적용', true)

  const item = async (layer, kind, slug) => (await q(`insert into knowledge_items (layer, kind, slug, title, statement, status, created_by, updated_by) values ($1,$2,$3,$3,'s','in_review','t','t') returning id`, [layer, kind, slug])).rows[0].id
  const ev = (id) => q(`insert into knowledge_evidence (item_id, grade, attribution, source_type, external_url, external_title, created_by) values ($1,'B','stated','external','https://e.x/a','t','t') returning id`, [id])
  const status = async (ids) => Object.fromEntries((await q(`select id, status from knowledge_items where id = any($1)`, [ids])).rows.map((r) => [r.id, r.status]))
  const chain = async (tag) => {
    const P = await item('principle', 'processing_mechanism', `${tag}-p`), Mi = await item('method', 'method', `${tag}-m`), T = await item('practice', 'task', `${tag}-t`)
    for (const id of [P, Mi, T]) await ev(id)
    await q(`insert into knowledge_links (from_id, to_id, kind, reason, created_by) values ($1,$2,'implements','r','t'), ($3,$1,'implements','r','t')`, [Mi, P, T])
    await q(`update knowledge_items set status = 'adopted', updated_by = 't' where id = any($1)`, [[P, Mi, T]])
    const app = (await q(`insert into knowledge_applications (item_id, surface, surface_ref, created_by, updated_by) values ($1,'module_task',$2,'t','t') returning id`, [T, tag])).rows[0].id
    await q(`insert into knowledge_trials (application_id, design, created_by) values ($1, '{"pre":true,"post":true,"min_n":1}', 't')`, [app])
    await q(`update knowledge_applications set status = 'active', released_at = now(), updated_by = 't' where id = $1`, [app])
    await q(`update knowledge_items set status = 'applied', updated_by = 't' where id = $1`, [T])
    return { P, M: Mi, T, app }
  }
  const appStatus = async (id) => (await q(`select status from knowledge_applications where id = $1`, [id])).rows[0].status

  // I2 + I3: 기제 문장을 SQL 로 바꾼다
  const c1 = await chain('c1')
  await q(`update knowledge_items set statement = 'changed', updated_by = 'sql' where id = $1`, [c1.P])
  const s1 = await status([c1.P, c1.M, c1.T])
  rec('I2 · 채택 기제 문장 변경(SQL) → 기제 검토 중', s1[c1.P] === 'in_review', s1)
  rec('I3 · 연쇄 → 방법 · 과제 검토 중(재귀)', s1[c1.M] === 'in_review' && s1[c1.T] === 'in_review', s1)
  rec('I3 뒤 · 과제 적용 자동 중단(기존 트리거)', (await appStatus(c1.app)) === 'paused')
  const rv = (await q(`select item_id, reason from knowledge_reviews where item_id = any($1) and to_status = 'in_review' and reason like '%연쇄%'`, [[c1.M, c1.T]])).rows
  rec('검토 기록에 연쇄 이유', rv.length === 2, rv.length)

  // I2 구멍(Codex P1): 문장 + 상태(adopted → applied)를 한 UPDATE 로 — 150000 이 막는다
  // 정확히 리뷰가 짚은 경로: adopted(적용 active) 과제의 문장을 바꾸며 동시에 applied 로
  const c5 = await chain('c5')
  await q(`update knowledge_items set status = 'adopted', updated_by = 't' where id = $1`, [c5.T])
  await q(`update knowledge_items set statement = 'sneak0', status = 'applied', updated_by = 'sql' where id = $1`, [c5.T])
  rec('I2 · adopted → applied + 문장 변경 한 UPDATE → 검토 중 · 적용 자동 중단(Codex P1 경로)', (await status([c5.T]))[c5.T] === 'in_review' && (await appStatus(c5.app)) === 'paused')
  const c6 = await chain('c6')
  await q(`update knowledge_applications set status = 'paused', status_reason = 'x', updated_by = 't' where id = $1`, [c6.app]).catch(() => {})
  const m6 = (await status([c6.M]))[c6.M]
  await q(`update knowledge_items set statement = 'sneak', status = 'adopted', updated_by = 'sql' where id = $1`, [c6.P])
  const s6 = await status([c6.P, c6.M])
  rec('I2 · 문장 + 상태를 한 UPDATE 로 바꿔도 검토 중(150000)', s6[c6.P] === 'in_review' && (m6 !== 'adopted' || s6[c6.M] === 'in_review'), { s6, m6 })
  const c7 = await chain('c7')
  await q(`update knowledge_items set statement = 'sneak2', status = 'applied', updated_by = 'sql' where id = $1`, [c7.T]).catch((e) => e)
  const s7 = (await status([c7.T]))[c7.T]
  rec('I2 · applied 과제 문장 + applied 재지정 → 검토 중 · 적용 자동 중단', s7 === 'in_review' && (await appStatus(c7.app)) === 'paused', { s7 })
  const c8 = await chain('c8')
  await q(`update knowledge_items set statement = 'reject-it', status = 'rejected', status_reason = 'r', updated_by = 'sql' where id = $1`, [c8.P])
  rec('I2 · 요청 상태가 이미 살아 있지 않으면(반려) 그대로 반려', (await status([c8.P]))[c8.P] === 'rejected')

  // ② 근거 이동(Codex P1): 채택 기제의 근거 하나를 다른 채택 항목으로 — 옛 주인 · 새 주인 둘 다 검토 중
  const c10 = await chain('c10'), c11 = await chain('c11')
  await ev(c10.P)
  await q(`update knowledge_items set status = 'adopted', updated_by = 't' where id = $1`, [c10.P])
  await q(`update knowledge_items set status = 'adopted', updated_by = 't' where id = any($1) and status = 'in_review'`, [[c10.M]])
  const mv = (await q(`select id from knowledge_evidence where item_id = $1 order by created_at desc limit 1`, [c10.P])).rows[0].id
  await q(`update knowledge_evidence set item_id = $2 where id = $1`, [mv, c11.P])
  const s10 = await status([c10.P, c11.P])
  rec('② 근거 이동 → 옛 주인 · 새 주인 모두 검토 중', s10[c10.P] === 'in_review' && s10[c11.P] === 'in_review', s10)
  // ③ 중간 층이 이미 검토 중이어도 연쇄(Codex P2): 기제 adopted · 방법 in_review · 과제 applied → 기제 문장 변경 → 과제 검토 중 · 적용 중단
  const c12 = await chain('c12')
  await q(`update knowledge_items set status = 'in_review', updated_by = 't' where id = $1`, [c12.M])
  // 방법을 검토 중으로 돌리면 과제도 연쇄된다 — 과제만 다시 채택 · 적용 켜기 · applied 로 살려 「중간 층만 검토 중」을 만든다
  await q(`update knowledge_items set status = 'adopted', updated_by = 't' where id = $1`, [c12.T])
  await q(`update knowledge_applications set status = 'active', status_reason = null, released_at = now(), updated_by = 't' where id = $1`, [c12.app])
  await q(`update knowledge_items set status = 'applied', updated_by = 't' where id = $1`, [c12.T])
  const pre = await status([c12.T])
  await q(`update knowledge_items set statement = 'p-changed', updated_by = 'sql' where id = $1`, [c12.P])
  rec('③ 중간 층 검토 중이어도 과제까지 연쇄 · 적용 중단', pre[c12.T] === 'applied' && (await status([c12.M]))[c12.M] === 'in_review' && (await status([c12.T]))[c12.T] === 'in_review' && (await appStatus(c12.app)) === 'paused', { pre })

  // I1: 근거 추가 · 축 변경 · 철회(SQL)
  const c2 = await chain('c2')
  await ev(c2.M)
  const s2 = await status([c2.P, c2.M, c2.T])
  rec('I1 · 채택 방법에 근거 추가(SQL) → 방법 · 아래 과제 검토 중 · 위 기제는 그대로', s2[c2.M] === 'in_review' && s2[c2.T] === 'in_review' && s2[c2.P] === 'adopted', s2)
  const c3 = await chain('c3')
  const e3 = (await q(`select id from knowledge_evidence where item_id = $1 limit 1`, [c3.P])).rows[0].id
  await q(`update knowledge_evidence set applicability = 'partial' where id = $1`, [e3])
  const s3 = await status([c3.P, c3.M, c3.T])
  rec('I1 · 근거 축 변경(SQL) → 기제 + 아래 층 검토 중', Object.values(s3).every((v) => v === 'in_review'), s3)
  const c4 = await chain('c4')
  await q(`update knowledge_evidence set note = 'x' where item_id = $1`, [c4.P])
  rec('I1 · 축이 아닌 메모만 고치면 그대로(헛재검토 없음)', (await status([c4.P]))[c4.P] === 'adopted')
  await ev(c4.P)
  const extra = (await q(`select id from knowledge_evidence where item_id = $1 order by created_at desc limit 1`, [c4.P])).rows[0].id
  await q(`update knowledge_items set status = 'adopted', updated_by = 't' where id = $1`, [c4.P])
  await q(`update knowledge_items set status = 'adopted', updated_by = 't' where id = any($1) and status = 'in_review'`, [[c4.M, c4.T]])
  await q(`delete from knowledge_evidence where id = $1`, [extra])
  rec('I1 · 근거 철회(SQL) → 검토 중', (await status([c4.P]))[c4.P] === 'in_review')
  // 살아 있지 않은 항목은 건드리지 않는다
  const draft = await item('principle', 'processing_mechanism', 'draft-p')
  await ev(draft)
  rec('검토 중 항목에 근거 추가는 상태를 바꾸지 않는다', (await status([draft]))[draft] === 'in_review')

  // 멱등 키
  const su = new pg.Client({ host: '127.0.0.1', port: 54329, database: 'ec', user: 'supabase_admin', password: 'admin' })
  await su.connect(); await su.query(`insert into auth.users (id) values ('00000000-0000-4000-8000-0000000000aa')`); await su.end()
  const key = '11111111-1111-4111-8111-111111111111'
  await q(`insert into learning_task_attempts (user_id, task_key, phase, client_attempt_id) values ('00000000-0000-4000-8000-0000000000aa','k','practice',$1)`, [key])
  let dup = null
  try { await q(`insert into learning_task_attempts (user_id, task_key, phase, client_attempt_id) values ('00000000-0000-4000-8000-0000000000aa','k','practice',$1)`, [key]) } catch (e) { dup = e.code }
  rec('멱등 · 같은 (학습자, client_attempt_id) 두 번째 INSERT 거부(23505)', dup === '23505', dup)
  const nul = await q(`insert into learning_task_attempts (user_id, task_key, phase) values ('00000000-0000-4000-8000-0000000000aa','k','practice'), ('00000000-0000-4000-8000-0000000000aa','k','practice') returning id`)
  rec('멱등 · 키 없는 기존 방식(null)은 그대로 여러 행', nul.rowCount === 2)
  await pool.end()
} catch (e) {
  rec('실행 오류 없이 끝남', false, e.message)
} finally {
  await cluster.stop()
  console.log(fail ? `실패 ${fail}` : '모든 단언 통과')
  process.exit(fail ? 1 : 0)
}
