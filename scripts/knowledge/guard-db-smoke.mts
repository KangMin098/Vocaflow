// scripts/knowledge/guard-db-smoke.mts
//
// 재검토 전파 DB 가드(20261008140000) 실제 개발 DB smoke — **한 트랜잭션 안에서만 바꾸고 끝에 전부 롤백한다**(2026-10-08).
// 관리자 화면을 거치지 않는 SQL 직접 변경으로(가드가 막으려는 경로) 실제 「주장과 근거」 사슬에:
//   S1 기제 문장 변경 · S2 방법에 근거 추가 · S3 기제 근거 축 변경 · S4 문장+상태 한 UPDATE · S5 근거 이동(옛 주인)
// 각 경우 대상 + 아래 층 검토 중 · 적용(문항 · 지도) 중단 · 학습자 게이트 닫힘(앱과 같은 resolveChain 규칙) · 수행 기록 보존을 본다.
// 시나리오마다 SAVEPOINT 로 되돌리고, 마지막에 전체 ROLLBACK → 실제 사슬이 실행 전과 같은지 확인한다.
//   cd apps/web && node <tsx cli> --tls-max-v1.2 --env-file=<.env.local> ../../scripts/knowledge/guard-db-smoke.mts
import fs from 'node:fs'
import { createRequire } from 'node:module'

import { resolveChain, type ChainItem, type ChainLink } from '../../apps/web/src/lib/knowledge/live-chain.ts'

const req = createRequire('D:/workspace/Vocaflow-ec-smoke/scripts/csat/error-evidence/isolated-pg/package.json')
const pg = req('pg')
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { ca: fs.readFileSync('D:/workspace/Vocaflow-ec-reveal/tmp/reveal-db-deployment/supabase-ca.crt', 'utf8') } })
let fail = 0
const rec = (name: string, ok: boolean, detail: unknown = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail === '' ? '' : ' — ' + JSON.stringify(detail).slice(0, 240)}`) }
const q = async <T = Record<string, unknown>>(sql: string, p: unknown[] = []) => (await c.query(sql, p)).rows as T[]
const SLUGS = { P: 'claim-support-relation', M: 'method-claim-support-marking', T: 'task-claim-support-link' }

async function state() {
  const items = await q<ChainItem>(`select id, slug, title, layer, kind, status, version, efficacy from knowledge_items`)
  const links = await q<ChainLink>(`select from_id, to_id, kind from knowledge_links where kind = 'implements'`)
  const apps = await q<{ surface: string; surface_ref: string; status: string; item_id: string }>(`select surface, surface_ref, status, item_id from knowledge_applications`)
  const bySlug = Object.fromEntries(items.map((i) => [i.slug, i]))
  const T = bySlug[SLUGS.T]
  const live = resolveChain(T.id, items, links).live
  const itemApp = apps.find((a) => a.surface === 'csat_item_task' && a.surface_ref === 'claim-support:2022-20')
  const mapApp = apps.find((a) => a.surface === 'learning_map_find' && a.surface_ref === 'b6-3')
  // product-server.loadLiveApplication / loadMapPracticeLinks 와 같은 조건(주석 서명은 DB 와 무관해 여기서 다루지 않는다)
  const itemGate = itemApp?.status === 'active' && live
  const mapGate = mapApp?.status === 'active' && live && itemGate
  return { P: bySlug[SLUGS.P].status, M: bySlug[SLUGS.M].status, T: T.status, itemApp: itemApp?.status, mapApp: mapApp?.status, itemGate, mapGate, ids: { P: bySlug[SLUGS.P].id, M: bySlug[SLUGS.M].id, T: T.id } }
}

await c.connect()
const before = await q(`select (select count(*)::int from knowledge_reviews) reviews, (select count(*)::int from learning_task_attempts) attempts, (select count(*)::int from knowledge_evidence) evidence`)
await c.query('begin')
try {
  const s0 = await state()
  rec('S0 · 실제 사슬 살아 있음 · 문항 · 지도 게이트 열림', s0.P === 'adopted' && s0.M === 'adopted' && s0.T === 'applied' && s0.itemGate && s0.mapGate, s0)
  // 수행 기록 보존 확인용 — 실제 계정 하나에 합성 기록 한 줄(롤백된다)
  const [u] = await q<{ id: string }>(`select id from auth.users order by created_at limit 1`)
  const [att] = await q<{ id: number }>(`insert into learning_task_attempts (user_id, task_key, item_ref, phase, synthetic, response, is_correct)
    values ($1, 'claim-support', '2022#20', 'practice', true, '{"smoke":true}', true) returning id`, [u.id])

  const scenario = async (name: string, sql: string, params: unknown[], want: { P: string; M: string; T: string }) => {
    await c.query('savepoint s')
    await c.query(sql, params)
    const s = await state()
    rec(`${name} → 상태 ${JSON.stringify(want)}`, s.P === want.P && s.M === want.M && s.T === want.T, { P: s.P, M: s.M, T: s.T })
    rec(`${name} → 문항 · 지도 적용 자동 중단`, s.itemApp === 'paused' && s.mapApp === 'paused', { item: s.itemApp, map: s.mapApp })
    rec(`${name} → 학습자 게이트 닫힘(문항 원리 칸 · 지도 링크)`, !s.itemGate && !s.mapGate)
    const kept = await q(`select id from learning_task_attempts where id = $1`, [att.id])
    rec(`${name} → 기존 수행 기록 보존`, kept.length === 1)
    const why = await q<{ reason: string }>(`select reason from knowledge_reviews where item_id = any($1) and to_status = 'in_review' order by at desc limit 1`, [[want.M === 'in_review' ? s.ids.M : s.ids.T]])
    rec(`${name} → 검토 기록에 이유`, why.length > 0 && why.every((w) => (w.reason ?? '').length > 0), why.map((w) => w.reason))
    await c.query('rollback to savepoint s')
  }
  await scenario('S1 기제 문장 직접 변경', `update knowledge_items set statement = statement || ' (smoke)', updated_by = 'smoke' where slug = $1`, [SLUGS.P], { P: 'in_review', M: 'in_review', T: 'in_review' })
  await scenario('S2 방법에 근거 직접 추가', `insert into knowledge_evidence (item_id, grade, attribution, source_type, external_url, external_title, created_by)
    select id, 'C', 'stated', 'external', 'https://example.com/smoke', 'smoke', 'smoke' from knowledge_items where slug = $1`, [SLUGS.M], { P: 'adopted', M: 'in_review', T: 'in_review' })
  await scenario('S3 기제 근거 축 직접 변경', `update knowledge_evidence set applicability = 'partial' where item_id = (select id from knowledge_items where slug = $1)`, [SLUGS.P], { P: 'in_review', M: 'in_review', T: 'in_review' })
  // 20261008150000 — Codex 커밋 리뷰가 짚은 두 우회 경로
  await scenario('S4 과제 문장 + 상태(adopted → applied) 한 UPDATE', `update knowledge_items set status = 'adopted', updated_by = 'smoke' where slug = '${SLUGS.T}';
    update knowledge_items set statement = statement || ' (smoke)', status = 'applied', updated_by = 'smoke' where slug = '${SLUGS.T}'`, [], { P: 'adopted', M: 'adopted', T: 'in_review' })
  await scenario('S5 기제 근거를 다른 항목(cohesion-cues)으로 이동 — 옛 주인 재검토', `update knowledge_evidence set item_id = (select id from knowledge_items where slug = 'cohesion-cues')
    where id = (select e.id from knowledge_evidence e join knowledge_items i on i.id = e.item_id where i.slug = '${SLUGS.P}' limit 1)`, [], { P: 'in_review', M: 'in_review', T: 'in_review' })
  const s4 = await state()
  rec('SAVEPOINT 되돌림 뒤 사슬 · 게이트 원상', s4.P === 'adopted' && s4.M === 'adopted' && s4.T === 'applied' && s4.itemGate && s4.mapGate, s4)
} catch (e) {
  rec('실행 오류 없이 끝남', false, (e as Error).message)
} finally {
  await c.query('rollback')
  const after = await q(`select (select count(*)::int from knowledge_reviews) reviews, (select count(*)::int from learning_task_attempts) attempts, (select count(*)::int from knowledge_evidence) evidence`)
  const fin = await state()
  rec('전체 롤백 — 검토 기록 · 수행 기록 · 근거 수가 실행 전과 같고 실제 사슬 살아 있음', JSON.stringify(before) === JSON.stringify(after) && fin.itemGate && fin.mapGate, { before, after })
  await c.end()
  console.log(fail ? `실패 ${fail}` : '모든 단언 통과')
  process.exit(fail ? 1 : 0)
}
