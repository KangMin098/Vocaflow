// scripts/knowledge/concurrency-test.mjs
// 학습 원리 근거 불변식 — 두 세션 경쟁 조건 검증 (migration 20260928140000 · 20260928150000, Codex 재리뷰 P2 세 건).
// 시나리오 6: 근거 삭제↔채택 양방향(P2-1) · 재등급→G↔근거 추가 양방향(P2-2) · A→B 재등급↔채택 양방향(P2-3).
// 단일 세션 시험으로는 안 보이는 경쟁을 두 연결로 재현한다. 시험 데이터는 zz- 접두·가짜 해시로 만들고 끝에 지운다.
//
// 사용 (pg 는 저장소 의존성이 아니다 — 외부 폴더에 설치해 경로로 넘긴다):
//   npm i --prefix <폴더> pg
//   node --env-file=apps/web/.env.local scripts/knowledge/concurrency-test.mjs <폴더>
// 필요한 환경변수: SUPABASE_DB_URL (직접 접속 · session pooler 5432 또는 direct). 값은 출력하지 않는다.
import { createRequire } from 'node:module'
import path from 'node:path'

const dir = process.argv[2]
const url = process.env.SUPABASE_DB_URL
if (!dir || !url) {
  console.error('사용: node --env-file=apps/web/.env.local scripts/knowledge/concurrency-test.mjs <pg 설치 폴더>  (SUPABASE_DB_URL 필요)')
  process.exit(2)
}
const { Client } = createRequire(path.resolve(dir, 'package.json'))('pg')

const SLUG = 'zz-concurrency-test'
const SHA = 'f'.repeat(64) // 실제 지문 해시와 겹치지 않는 가짜 원천
const WAIT_MS = 1500

async function connect() {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await c.connect()
  await c.query("set statement_timeout = '20s'")
  return c
}

/** q 가 WAIT_MS 동안 끝나지 않으면 「막혔다」 — 잠금이 실제로 줄을 세우는지 확인한다. */
async function isBlocked(promise) {
  const t = new Promise((r) => setTimeout(() => r('blocked'), WAIT_MS))
  const settled = promise.then(() => 'done', () => 'done')
  return (await Promise.race([t, settled])) === 'blocked'
}

async function settle(promise) {
  try {
    await promise
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

const admin = await connect()
const results = []
function record(name, pass, detail) {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${detail}`)
}

async function cleanup() {
  await admin.query('delete from knowledge_items where slug = $1', [SLUG]) // 근거·기록은 cascade
  await admin.query('delete from knowledge_csat_origins where passage_sha256 = $1', [SHA])
}

async function setupItemWithEvidence() {
  await cleanup()
  const { rows } = await admin.query(
    `insert into knowledge_items (layer, slug, title, statement, status, created_by, updated_by)
     values ('principle', $1, 'concurrency', 'test', 'in_review', 'test', 'test') returning id`,
    [SLUG]
  )
  const id = rows[0].id
  await admin.query(
    `insert into knowledge_evidence (item_id, grade, attribution, source_type, external_url, external_title, created_by)
     values ($1, 'B', 'inferred', 'external', 'https://example.org/test', 'test', 'test')`,
    [id]
  )
  return id
}

async function itemState(id) {
  const { rows } = await admin.query(
    'select i.status, (select count(*)::int from knowledge_evidence e where e.item_id = i.id) n from knowledge_items i where i.id = $1',
    [id]
  )
  return rows[0]
}

try {
  // ── P2-1a 삭제가 먼저 잠금 → 채택이 기다렸다가 근거 0 을 보고 거부돼야 한다
  {
    const id = await setupItemWithEvidence()
    const c1 = await connect()
    const c2 = await connect()
    await c1.query('begin')
    await c1.query('delete from knowledge_evidence where item_id = $1', [id])
    const adopt = c2.query("update knowledge_items set status = 'adopted', updated_by = 'test' where id = $1", [id])
    const blocked = await isBlocked(adopt)
    await c1.query('commit')
    const r = await settle(adopt)
    const s = await itemState(id)
    record('P2-1a 삭제 먼저 → 채택', blocked && !r.ok && s.status === 'in_review' && s.n === 0,
      `막힘 ${blocked} · 채택 ${r.ok ? '성공(문제)' : '거부'} · 최종 ${s.status}/근거 ${s.n}`)
    await c1.end(); await c2.end()
  }

  // ── P2-1b 채택이 먼저 잠금 → 삭제가 기다렸다가 채택을 보고 재검토로 되돌려야 한다
  {
    const id = await setupItemWithEvidence()
    const c1 = await connect()
    const c2 = await connect()
    await c1.query('begin')
    await c1.query("update knowledge_items set status = 'adopted', updated_by = 'test' where id = $1", [id])
    const del = c2.query('delete from knowledge_evidence where item_id = $1', [id])
    const blocked = await isBlocked(del)
    await c1.query('commit')
    const r = await settle(del)
    const s = await itemState(id)
    record('P2-1b 채택 먼저 → 삭제', blocked && r.ok && s.status === 'in_review' && s.n === 0,
      `막힘 ${blocked} · 삭제 ${r.ok ? '성공' : r.error} · 최종 ${s.status}/근거 ${s.n}`)
    await c1.end(); await c2.end()
  }

  // ── P2-2a 재등급(→G)이 먼저 잠금 → 근거 추가가 기다렸다가 G 를 보고 거부돼야 한다
  {
    const id = await setupItemWithEvidence()
    await admin.query(
      `insert into knowledge_csat_origins (passage_sha256, representative_item_id, item_ids, exam_id, status, source_title, audited_at, audit_ref)
       values ($1, 'ZZ#1', array['ZZ#1'], 'ZZ', 'confirmed_exact', 'test', current_date, 'test')`,
      [SHA]
    )
    const c1 = await connect()
    const c2 = await connect()
    await c1.query('begin')
    await c1.query("update knowledge_csat_origins set status = 'unresolved' where passage_sha256 = $1", [SHA])
    const add = c2.query(
      `insert into knowledge_evidence (item_id, grade, attribution, source_type, csat_passage_sha256, created_by)
       values ($1, 'A', 'inferred', 'csat_origin', $2, 'test')`,
      [id, SHA]
    )
    const blocked = await isBlocked(add)
    await c1.query('commit')
    const r = await settle(add)
    const { rows } = await admin.query('select count(*)::int n from knowledge_evidence where csat_passage_sha256 = $1', [SHA])
    record('P2-2a 재등급 먼저 → 근거 추가', blocked && !r.ok && rows[0].n === 0,
      `막힘 ${blocked} · 추가 ${r.ok ? '성공(문제)' : '거부'} · G 원천 근거 ${rows[0].n}`)
    await c1.end(); await c2.end()
  }

  // ── P2-2b 근거 추가가 먼저 잠금 → 재등급이 기다렸다가 새 근거까지 지워야 한다
  {
    const id = await setupItemWithEvidence()
    await admin.query(
      `insert into knowledge_csat_origins (passage_sha256, representative_item_id, item_ids, exam_id, status, source_title, audited_at, audit_ref)
       values ($1, 'ZZ#1', array['ZZ#1'], 'ZZ', 'confirmed_exact', 'test', current_date, 'test')`,
      [SHA]
    )
    const c1 = await connect()
    const c2 = await connect()
    await c1.query('begin')
    await c1.query(
      `insert into knowledge_evidence (item_id, grade, attribution, source_type, csat_passage_sha256, created_by)
       values ($1, 'C', 'inferred', 'csat_origin', $2, 'test')`,
      [id, SHA]
    )
    const regrade = c2.query("update knowledge_csat_origins set status = 'unresolved' where passage_sha256 = $1", [SHA])
    const blocked = await isBlocked(regrade)
    await c1.query('commit')
    const r = await settle(regrade)
    const { rows } = await admin.query('select count(*)::int n from knowledge_evidence where csat_passage_sha256 = $1', [SHA])
    record('P2-2b 근거 추가 먼저 → 재등급', blocked && r.ok && rows[0].n === 0,
      `막힘 ${blocked} · 재등급 ${r.ok ? '성공' : r.error} · G 원천 근거 ${rows[0].n}`)
    await c1.end(); await c2.end()
  }

  // 원천 A + 그 원천을 근거로 가진 항목(검토 중) — P2-3 용. 근거는 기출 원천 하나뿐이다.
  async function setupItemWithCsatEvidence() {
    await cleanup()
    await admin.query(
      `insert into knowledge_csat_origins (passage_sha256, representative_item_id, item_ids, exam_id, status, source_title, audited_at, audit_ref)
       values ($1, 'ZZ#1', array['ZZ#1'], 'ZZ', 'confirmed_exact', 'test', current_date, 'test')`,
      [SHA]
    )
    const { rows } = await admin.query(
      `insert into knowledge_items (layer, slug, title, statement, status, created_by, updated_by)
       values ('principle', $1, 'concurrency', 'test', 'in_review', 'test', 'test') returning id`,
      [SLUG]
    )
    await admin.query(
      `insert into knowledge_evidence (item_id, grade, attribution, source_type, csat_passage_sha256, created_by)
       values ($1, 'A', 'inferred', 'csat_origin', $2, 'test')`,
      [rows[0].id, SHA]
    )
    return rows[0].id
  }

  async function csatState(id) {
    const { rows } = await admin.query(
      'select i.status, (select grade from knowledge_evidence e where e.item_id = i.id) grade from knowledge_items i where i.id = $1',
      [id]
    )
    return rows[0]
  }

  // ── P2-3a 채택 먼저 → A→B 재등급이 기다렸다가 커밋된 채택을 보고 재검토로 되돌려야 한다
  {
    const id = await setupItemWithCsatEvidence()
    const c1 = await connect()
    const c2 = await connect()
    await c1.query('begin')
    await c1.query("update knowledge_items set status = 'adopted', updated_by = 'test' where id = $1", [id])
    const regrade = c2.query("update knowledge_csat_origins set status = 'supported_candidate' where passage_sha256 = $1", [SHA])
    const blocked = await isBlocked(regrade)
    await c1.query('commit')
    const r = await settle(regrade)
    const s = await csatState(id)
    record('P2-3a 채택 먼저 → A→B 재등급', blocked && r.ok && s.status === 'in_review' && s.grade === 'B',
      `막힘 ${blocked} · 재등급 ${r.ok ? '성공' : r.error} · 최종 ${s.status}/근거 ${s.grade}`)
    await c1.end(); await c2.end()
  }

  // ── P2-3b A→B 재등급 먼저 → 채택이 기다렸다가 이미 B 인 근거를 본다.
  //    결과 adopted/B 는 직렬 순서 「재등급 → 채택」과 같다(B 근거 채택은 허용). 핵심은 채택이 기다리는 것.
  {
    const id = await setupItemWithCsatEvidence()
    const c1 = await connect()
    const c2 = await connect()
    await c1.query('begin')
    await c1.query("update knowledge_csat_origins set status = 'supported_candidate' where passage_sha256 = $1", [SHA])
    const adopt = c2.query("update knowledge_items set status = 'adopted', updated_by = 'test' where id = $1", [id])
    const blocked = await isBlocked(adopt)
    await c1.query('commit')
    const r = await settle(adopt)
    const s = await csatState(id)
    record('P2-3b A→B 재등급 먼저 → 채택', blocked && r.ok && s.status === 'adopted' && s.grade === 'B',
      `막힘 ${blocked} · 채택 ${r.ok ? '성공' : r.error} · 최종 ${s.status}/근거 ${s.grade}`)
    await c1.end(); await c2.end()
  }
} finally {
  await cleanup()
  const { rows } = await admin.query(
    'select (select count(*)::int from knowledge_items where slug = $1) items, (select count(*)::int from knowledge_csat_origins where passage_sha256 = $2) origins',
    [SLUG, SHA]
  )
  console.log(`정리 — 시험 항목 ${rows[0].items} · 가짜 원천 ${rows[0].origins}`)
  await admin.end()
}

const failed = results.filter((r) => !r.pass).length
console.log(`${results.length - failed}/${results.length} 통과`)
process.exit(failed === 0 ? 0 : 1)
