// apps/web/src/lib/csat/map/v62/__tests__/authored-supply.pglite.test.ts
// FINAL §4.2 — 창작 산출물(authored_item) · 권리/Gold 사람 결정 보류 SQL(`_pending_authored_supply.sql`)을
// DB-1(C → B → I1-S) + I2 + G2 위에 격리 Postgres(PGlite)로 적용해 규칙과 반례를 확인한다. 개발 DB 무관.
// ⚠️ 한계: PGlite 는 연결이 하나라 진짜 동시 트랜잭션은 없다 — 경합은 순차 재전송과 고유 제약으로 본다.
import fs from 'node:fs'
import path from 'node:path'

import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'

import type { WorkspaceDemand } from '../demand'
import { canonicalDemand } from '../persist-contract'
import { AXES, B_SQL, C_SQL, STUB, as, errorOf, revOf } from './supply-sql-harness'

const MIG = path.resolve(__dirname, '../../../../../../../../supabase/migrations')
const read = (f: string) => fs.readFileSync(path.join(MIG, f), 'utf8')
const I1_STUB = fs.readFileSync(path.join(__dirname, 'supply-i1-stub.sql'), 'utf8')
const S_SQL = read('_pending_workspace_supply_i1_safety.sql')
const I2_SQL = read('20261018120000_workspace_supply_c_annotation_binding.sql')
const G2_SQL = read('20261018120100_r5_delivery_g2_binding.sql')
const AU_SQL = read('_pending_authored_supply.sql')
const G2_COLUMNS = `alter table public.learning_task_attempts add column if not exists activity text,
  add column if not exists help_level text, add column if not exists content_hash text, add column if not exists received_at timestamptz default now();
  alter table public.learning_sessions add column if not exists stage text;`

const ADMIN = '00000000-0000-4000-8000-0000000000a1'
const A = '00000000-0000-4000-8000-0000000000b1'
const B = '00000000-0000-4000-8000-0000000000b2'
const TASK = 'r.central_meaning'
const TKEY = 'authored-central-meaning'
const ASSESS = ['independent_check', 'transfer', 'delayed_check']

let n = 0
const key = () => `00000000-0000-4000-9000-${String(++n).padStart(12, '0')}`
let db: PGlite
let wsA: string
let wsB: string
const q1 = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]!

const body = (tag: string) => ({ title: tag, sentences: [`${tag} one.`, `${tag} two.`, `${tag} three.`], stem: 'q', choices: ['a', 'b', 'c', 'd', 'e'] })
const gold = (tag: string) => ({ answer: 2, claim: 1, claimRestated: [], support: [2], supportDisputed: [], opposed: [], relationProbe: { sentence: 2, relation: 'reason' }, tag })

async function register(id: string, role: string, group: string, tag = id) {
  await as(db, ADMIN)
  const cls = ASSESS.includes(role) ? 'assessment' : 'instruction'
  return (await q1<{ r: string }>(`select public.authored_item_register($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10::jsonb) r`,
    [`authored:${id}`, TASK, TKEY, cls, role, group, JSON.stringify(body(tag)), JSON.stringify(gold(tag)), `${TKEY}-${id}.v1`,
      JSON.stringify({ author: 'agent', method: 'test', derivedFrom: [] })])).r
}
const goldHash = async (ref: string) => (await q1<{ h: string }>(`select public.authored_item_gold_hash($1) h`, [ref])).h

async function lineFor(uid: string, ws: string, role: string, qty = 10): Promise<string> {
  const d = {
    key: 'k', template: 'ws.reading', workspaceId: ws, goalVersion: null, planVersion: 1, definitionVersion: `v6.2-${++n}`,
    asOf: '2026-10-18T00:00:00Z', core: TASK, support: [], purpose: { need: null, evidence: 'x', independentItems: null, unknowns: [] },
    lines: [{ role, task: TASK, quantity: { n: qty }, csatTypes: ['R-TOPIC'], taskKeys: [], requires: [], reason: 'need' }],
  } as unknown as WorkspaceDemand
  await as(db, uid)
  const dem = (await q1<{ id: string }>(`select public.workspace_demand_record($1) id`, [canonicalDemand(uid, d)])).id
  return (await q1<{ id: string }>(`select id from public.workspace_content_demand_line where demand_id = $1`, [dem])).id
}

async function qualify(ref: string, role: string, o: { ahash?: string; aref?: string } = {}) {
  const rev = (await revOf(db, 'authored_item', ref))!
  const gh = o.ahash ?? await goldHash(ref)
  const aref = o.aref ?? `${TKEY}-${ref.slice('authored:'.length)}.v1`
  await as(db, ADMIN)
  return (await q1<{ id: string }>(
    `select public.content_qualification_record('FQ1.1','authored_item',$1,$2,$3,$4,$5::jsonb,'self',$6,null,'gold',$7,$8,$7,'{}','{ev}','맹검 2인 + 사람 Gold',null) id`,
    [ref, rev, TASK, role, JSON.stringify(AXES()), rev, gh, aref])).id
}
async function decide(kind: 'rights' | 'gold', ref: string, o: { scope?: string[]; attest?: string; subject?: string } = {}) {
  const rev = (await revOf(db, 'authored_item', ref))!
  await as(db, ADMIN)
  return (await q1<{ id: string }>(`select public.content_human_decision_record($1,'authored_item',$2,$3,$4,$5,$6,$7,$8) id`,
    [kind, ref, rev, o.subject ?? (kind === 'rights' ? rev : await goldHash(ref)), kind === 'rights' ? 'self_authored_original' : 'human_gold_review',
      o.scope ?? (kind === 'rights' ? ['store', 'display', 'transmit'] : ['assess']), 'docs/final/review/x.md#sha', o.attest ?? 'human-reviewed'])).id
}
async function approve(q: string, scope: 'public' | 'assessment') {
  await as(db, ADMIN)
  return (await q1<{ id: string }>(`select public.content_release_approve($1, $2) id`, [q, scope])).id
}
async function deliver(uid: string, line: string, q: string, approval: string) {
  await as(db, uid)
  return (await q1<{ id: string }>(`select public.workspace_delivery_record($1, null, $2, $3, $4) id`, [line, q, approval, key()])).id
}
/** 등록 · 자격 · 사람 결정 · 승인 · 공급 한 번에 */
async function full(uid: string, ws: string, id: string, role: string, group: string, o: { gold?: boolean } = {}) {
  const ref = await register(id, role, group)
  const q = await qualify(ref, role)
  await decide('rights', ref)
  if (o.gold !== false) await decide('gold', ref)
  const pub = await approve(q, 'public')
  const asm = ASSESS.includes(role) ? await approve(q, 'assessment') : null
  const line = await lineFor(uid, ws, role)
  const delivery = await deliver(uid, line, q, asm ?? pub)
  return { ref, q, pub, asm, line, delivery }
}
async function attempt(uid: string, ref: string, o: { phase?: string; activity?: string; help?: string; hash?: string; taskKey?: string; annotation?: string } = {}) {
  const k = o.taskKey ?? TKEY
  const sid = (await q1<{ id: string }>(`insert into public.learning_sessions (user_id, item_ref, task_key, help_level, revealed_at) values ($1,$2,$3,$4, now()) returning id`,
    [uid, ref, k, o.help ?? 'independent'])).id
  const ann = o.annotation ?? `${TKEY}-${ref.slice('authored:'.length)}.v1`
  return Number((await q1<{ id: string }>(
    `insert into public.learning_task_attempts (user_id, task_key, item_ref, session_id, phase, activity, help_level, content_hash, response)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) returning id`,
    [uid, k, ref, sid, o.phase ?? 'practice', o.activity ?? 'theater', o.help ?? 'independent', o.hash ?? await goldHash(ref),
      JSON.stringify({ annotation: ann, grade: { isCorrect: true } })])).id)
}
async function bind(uid: string, delivery: string, att: number) {
  await as(db, uid)
  return (await q1<{ id: string }>(`select public.workspace_delivery_attempt_record($1, $2, $3) id`, [delivery, att, key()])).id
}
const bound = (id: string) => q1<Record<string, unknown>>(`select * from public.workspace_delivery_attempt where id = $1`, [id])
const valid = async (d: string) => {
  await as(db, ADMIN)
  return (await q1<{ v: boolean }>(`select public.supply_delivery_valid($1) v`, [d])).v
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(STUB)
  await db.exec(I1_STUB)
  await db.exec(G2_COLUMNS)
  await db.exec(`alter default privileges in schema public grant all on tables to anon, authenticated`)
  await db.exec(C_SQL)
  await db.exec(B_SQL)
  await db.exec(S_SQL)
  await db.exec(I2_SQL)
  await db.exec(G2_SQL)
  await db.exec(AU_SQL)
  await db.exec(`insert into auth.users values ('${ADMIN}'), ('${A}'), ('${B}'); insert into public.admins values ('${ADMIN}', 'admin');`)
  await db.exec(`insert into public.csat_items (id, exam_id, no, stem, passage, choices, answer) values ('C#1','C',1,'s','Exam passage.','[1,2,3,4,5]',1);`)
  wsA = (await q1<{ id: string }>(`insert into public.learner_workspace (user_id) values ($1) returning id`, [A])).id
  wsB = (await q1<{ id: string }>(`insert into public.learner_workspace (user_id) values ($1) returning id`, [B])).id
  await db.query(`insert into public.learner_workspace_plan (workspace_id, user_id, plan_version) values ($1, $2, 1), ($3, $4, 1)`, [wsA, A, wsB, B])
}, 90000)

describe('설치 · 권한', () => {
  it('G2 가 없으면 적용 전에 멈추고, 두 번 적용하면 멈춘다', async () => {
    const bare = new PGlite()
    await bare.exec(STUB); await bare.exec(I1_STUB); await bare.exec(G2_COLUMNS)
    await bare.exec(C_SQL); await bare.exec(B_SQL); await bare.exec(S_SQL); await bare.exec(I2_SQL)
    expect(await errorOf(bare.exec(AU_SQL))).toMatch(/requires DB-1 \+ I2 \+ G2 first/)
    await bare.exec(G2_SQL)
    expect(await errorOf(bare.exec(AU_SQL))).toBeNull()
    expect(await errorOf(bare.exec(AU_SQL))).toMatch(/already installed/)
    await bare.close()
  }, 90000)

  it('학습자는 창작 원장 · 사람 결정을 쓸 수 없고 내부 판정기를 실행할 수 없다', async () => {
    const p = await q1<Record<string, boolean>>(`select
      has_table_privilege('authenticated','public.authored_item','INSERT,UPDATE,DELETE,TRUNCATE') au_w,
      has_table_privilege('authenticated','public.content_human_decision','INSERT,UPDATE,DELETE,TRUNCATE') hd_w,
      has_table_privilege('anon','public.authored_item','SELECT') au_anon,
      has_function_privilege('authenticated','public.authored_item_gold_hash(text)','execute') gh,
      has_function_privilege('authenticated','public.supply_human_decisions_ok(uuid)','execute') hok,
      has_function_privilege('anon','public.authored_item_register(text,text,text,text,text,text,jsonb,jsonb,text,jsonb)','execute') reg_anon`)
    expect(p).toEqual({ au_w: false, hd_w: false, au_anon: false, gh: false, hok: false, reg_anon: false })
  })

  it('학습자 · 로그아웃 세션은 등록 · 사람 결정을 기록할 수 없다', async () => {
    await as(db, A)
    expect(await errorOf(db.query(`select public.authored_item_register('authored:x-learner','${TASK}','${TKEY}','instruction','guided_practice','g-x','{"sentences":["a.","b."]}','{}','${TKEY}-x.v1','{"author":"a","method":"m","derivedFrom":[]}')`))).toMatch(/Forbidden/)
    await as(db, null)
    expect(await errorOf(db.query(`select public.content_human_decision_record('rights','authored_item','authored:x','r','${'a'.repeat(64)}','self_authored_original','{display}','e','human-reviewed')`))).toMatch(/Forbidden/)
  })
})

describe('등록 규칙', () => {
  it('같은 ref 같은 본문 = 같은 결과 · 다른 본문 = 거절(행 불변)', async () => {
    const r = await register('reg-1', 'guided_practice', 'g-reg')
    expect(await register('reg-1', 'guided_practice', 'g-reg')).toBe(r)
    expect(await errorOf(register('reg-1', 'guided_practice', 'g-reg', 'changed'))).toMatch(/different body/)
    await as(db, ADMIN)
    expect(await errorOf(db.query(`update public.authored_item set task_key = 'x' where ref = $1`, [r]))).toMatch(/append-only/)
  })

  it('교수 · 연습 지문 묶음에 평가 산출물을 넣을 수 없다(반대도)', async () => {
    await register('mix-1', 'model_explanation', 'g-mix')
    expect(await errorOf(register('mix-2', 'transfer', 'g-mix'))).toMatch(/mixes instruction and assessment/)
    await register('mix-3', 'independent_check', 'g-mix-a')
    expect(await errorOf(register('mix-4', 'guided_practice', 'g-mix-a'))).toMatch(/mixes/)
  })

  it('역할군과 의도 역할이 어긋나면 · 주석 ref 가 과제 키로 시작하지 않으면 거절', async () => {
    await as(db, ADMIN)
    const call = (cls: string, role: string, aref: string) => db.query(
      `select public.authored_item_register($1,'${TASK}','${TKEY}',$2,$3,'g-bad',$4::jsonb,'{}'::jsonb,$5,'{"author":"a","method":"m","derivedFrom":[]}'::jsonb)`,
      [`authored:bad-${++n}`, cls, role, JSON.stringify(body('b')), aref])
    expect(await errorOf(call('instruction', 'transfer', `${TKEY}-b.v1`))).toMatch(/check/)
    expect(await errorOf(call('assessment', 'transfer', `other-task-b.v1`))).toMatch(/check/)
  })
})

describe('사람 결정 · 공급', () => {
  it('정상: 자체 창작 권리 + 사람 Gold → 독립 확인 공급 · 현재 유효', async () => {
    const f = await full(A, wsA, 'ok-ind', 'independent_check', 'g-ok-ind')
    expect(await valid(f.delivery)).toBe(true)
    const d = await q1(`select artifact_kind, artifact_ref, role from public.workspace_content_delivery where id = $1`, [f.delivery])
    expect(d).toEqual({ artifact_kind: 'authored_item', artifact_ref: f.ref, role: 'independent_check' })
  })

  it('권리 결정이 없으면 공급 거절(교수 역할도)', async () => {
    const ref = await register('no-rights', 'model_explanation', 'g-no-rights')
    const q = await qualify(ref, 'model_explanation')
    const pub = await approve(q, 'public')
    const line = await lineFor(A, wsA, 'model_explanation')
    expect(await errorOf(deliver(A, line, q, pub))).toMatch(/human rights\/gold decision missing/)
    await decide('rights', ref)
    expect(await errorOf(deliver(A, line, q, pub))).toBeNull()
  })

  it('평가 역할은 사람 Gold 가 없으면 거절 · 교수 역할은 Gold 없이 공급', async () => {
    const ref = await register('no-gold', 'transfer', 'g-no-gold')
    const q = await qualify(ref, 'transfer')
    await decide('rights', ref)
    await approve(q, 'public')
    const asm = await approve(q, 'assessment')
    const line = await lineFor(A, wsA, 'transfer')
    expect(await errorOf(deliver(A, line, q, asm))).toMatch(/decision missing/)
    const g = await full(A, wsA, 'teach-nogold', 'guided_practice', 'g-teach-nogold', { gold: false })
    expect(await valid(g.delivery)).toBe(true)
  })

  it('사람 진술(attest)이 없거나 · 권리 범위에 transmit 이 없거나 · Gold hash 가 현재 값이 아니면 기록 · 공급 불가', async () => {
    const ref = await register('attest', 'delayed_check', 'g-attest')
    expect(await errorOf(decide('rights', ref, { attest: 'ai-reviewed' }))).toMatch(/human attestation required/)
    expect(await errorOf(decide('gold', ref, { subject: 'e'.repeat(64) }))).toMatch(/current gold hash/)
    await decide('rights', ref, { scope: ['store', 'display'] })
    await decide('gold', ref)
    const q = await qualify(ref, 'delayed_check')
    await approve(q, 'public')
    const asm = await approve(q, 'assessment')
    const line = await lineFor(A, wsA, 'delayed_check')
    expect(await errorOf(deliver(A, line, q, asm))).toMatch(/decision missing/)
  })

  it('자격 주석 hash 가 현재 Gold 와 다르면 거절(다른 채점으로 공급 금지)', async () => {
    const ref = await register('hash-x', 'guided_practice', 'g-hash-x')
    const q = await qualify(ref, 'guided_practice', { ahash: 'f'.repeat(64) })
    await decide('rights', ref)
    const pub = await approve(q, 'public')
    const line = await lineFor(A, wsA, 'guided_practice')
    expect(await errorOf(deliver(A, line, q, pub))).toMatch(/authored gold differs/)
  })

  it('권리 결정 철회 → 현재 유효성 false(이력 보존) · 새 공급 거절', async () => {
    const f = await full(A, wsA, 'revoke', 'independent_check', 'g-revoke')
    const dec = (await q1<{ id: string }>(`select id from public.content_human_decision where artifact_ref = $1 and kind = 'rights'`, [f.ref])).id
    await as(db, ADMIN)
    await db.query(`select public.content_human_decision_revoke($1, 'test')`, [dec])
    expect(await valid(f.delivery)).toBe(false)
    expect((await q1<{ n: number }>(`select count(*)::int n from public.workspace_content_delivery where id = $1`, [f.delivery])).n).toBe(1)
    const line = await lineFor(B, wsB, 'independent_check')
    expect(await errorOf(deliver(B, line, f.q, f.asm!))).toMatch(/decision missing or revoked/)
  })

  it('기출(csat_item)도 권리 결정 없이는 공급되지 않는다(권리 결속 없는 공급 금지)', async () => {
    const rev = (await revOf(db, 'csat_item', 'C#1'))!
    await as(db, ADMIN)
    const q = (await q1<{ id: string }>(
      `select public.content_qualification_record('FQ1.1','csat_item','C#1',$1,$2,'guided_practice',$3::jsonb,'src',$4,null,'gold',$4,'claim-support-c1.v1',$4,'{}','{ev}','x',null) id`,
      [rev, TASK, JSON.stringify(AXES()), 'a'.repeat(64)])).id
    await db.query(`insert into public.supply_current_annotation values ('C#1',$1,$2,'claim-support-c1.v1',$3)`, [TASK, rev, 'a'.repeat(64)])
    const pub = await approve(q, 'public')
    const line = await lineFor(A, wsA, 'guided_practice')
    expect(await errorOf(deliver(A, line, q, pub))).toMatch(/human rights\/gold decision missing/)
    expect(await errorOf(db.query(`select 1`))).toBeNull()
  })
})

describe('노출(G) — 지문 묶음', () => {
  it('같은 묶음의 다른 평가 문항을 풀었으면 평가 공급 거절(shared_passage_seen)', async () => {
    const first = await full(A, wsA, 'grp-1', 'independent_check', 'g-grp')
    await attempt(A, first.ref)
    const ref2 = await register('grp-2', 'delayed_check', 'g-grp')
    const q2 = await qualify(ref2, 'delayed_check')
    await decide('rights', ref2); await decide('gold', ref2)
    await approve(q2, 'public')
    const asm = await approve(q2, 'assessment')
    const line = await lineFor(A, wsA, 'delayed_check')
    expect(await errorOf(deliver(A, line, q2, asm))).toMatch(/exposure shared_passage_seen/)
    // 다른 학습자에게는 공급된다
    const lineB = await lineFor(B, wsB, 'delayed_check')
    expect(await errorOf(deliver(B, lineB, q2, asm))).toBeNull()
  })

  it('이미 화면을 연 평가 문항은 공급 거절(item_seen)', async () => {
    const ref = await register('seen-1', 'transfer', 'g-seen')
    const q = await qualify(ref, 'transfer')
    await decide('rights', ref); await decide('gold', ref)
    await approve(q, 'public')
    const asm = await approve(q, 'assessment')
    await db.query(`insert into public.learning_sessions (user_id, item_ref) values ($1, $2)`, [A, ref])
    const line = await lineFor(A, wsA, 'transfer')
    expect(await errorOf(deliver(A, line, q, asm))).toMatch(/exposure item_seen/)
  })
})

describe('G2 결속 — 창작 산출물', () => {
  it('독립 확인 납품 → 첫 독립 시도 = 근거 · 노출 키는 지문 묶음', async () => {
    const f = await full(A, wsA, 'g2-ind', 'independent_check', 'g-g2-ind')
    const r = await bound(await bind(A, f.delivery, await attempt(A, f.ref)))
    expect(r).toMatchObject({ artifact_kind: 'authored_item', artifact_ref: f.ref, help_state: 'independent', first_exposure: true,
      evidence: true, exposure_key: 'passage:authored:g-g2-ind', annotation_hash: await goldHash(f.ref) })
  })

  it('전이 납품 + theater/transfer = 근거 · 도움 받은 시도 = 비근거', async () => {
    const t = await full(A, wsA, 'g2-tr', 'transfer', 'g-g2-tr')
    expect(await bound(await bind(A, t.delivery, await attempt(A, t.ref, { phase: 'transfer' })))).toMatchObject({ help_state: 'transfer', evidence: true })
    const h = await full(A, wsA, 'g2-help', 'independent_check', 'g-g2-help')
    expect(await bound(await bind(A, h.delivery, await attempt(A, h.ref, { help: 'hint' }))))
      .toMatchObject({ help_state: 'helped', evidence: false, non_evidence_reason: 'help_state_mismatch' })
  })

  it('안내 연습 납품의 시도 = 비근거(role_not_evidence) — 기록은 남는다', async () => {
    const g = await full(A, wsA, 'g2-guided', 'guided_practice', 'g-g2-guided', { gold: false })
    expect(await bound(await bind(A, g.delivery, await attempt(A, g.ref, { activity: 'practice' }))))
      .toMatchObject({ help_state: 'practice', evidence: false })
  })

  it('과제 키 · 주석 ref · 채점 hash 가 산출물과 다르면 결속 거절', async () => {
    const f = await full(A, wsA, 'g2-map', 'independent_check', 'g-g2-map')
    expect(await errorOf(bind(A, f.delivery, await attempt(A, f.ref, { taskKey: 'claim-support' })))).toMatch(/does not map to delivery TASK/)
    expect(await errorOf(bind(A, f.delivery, await attempt(A, f.ref, { annotation: `${TKEY}-other.v1` })))).toMatch(/does not map/)
    expect(await errorOf(bind(A, f.delivery, await attempt(A, f.ref, { hash: '0'.repeat(64) })))).toMatch(/annotation differs/)
  })

  it('같은 묶음 두 번째 납품의 시도는 첫 노출이 아니다(not_first_exposure)', async () => {
    const f1 = await full(B, wsB, 'g2-dup1', 'independent_check', 'g-g2-dup')
    const ref2 = await register('g2-dup2', 'delayed_check', 'g-g2-dup')
    const q2 = await qualify(ref2, 'delayed_check')
    await decide('rights', ref2); await decide('gold', ref2)
    await approve(q2, 'public')
    const asm = await approve(q2, 'assessment')
    // 두 납품을 먼저 받고(아직 아무것도 안 풂) 첫 문항을 푼 뒤 두 번째를 푼다
    const line = await lineFor(B, wsB, 'delayed_check')
    expect(await errorOf(deliver(B, line, q2, asm))).toMatch(/shared_passage_seen/)
    expect(await bound(await bind(B, f1.delivery, await attempt(B, f1.ref)))).toMatchObject({ first_exposure: true, evidence: true })
  })
})
