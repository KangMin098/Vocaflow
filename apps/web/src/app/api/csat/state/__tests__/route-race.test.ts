// apps/web/src/app/api/csat/state/__tests__/route-race.test.ts
// FI-015(#308) — 같은 학습자의 서로 다른 「내 말로」 노트를 두 기기가 겹쳐 저장해도 둘 다 서버에 남는다.
//   실제 PUT/GET 라우트 + 격리 PGlite. 두 요청이 모두 이전 사본을 읽은 뒤 쓰도록 barrier 로 묶는다(Codex 재현 조건과 같다).
//   합성 학습자 · 합성 노트만. 원격 DB 없음.
import { PGlite } from '@electric-sql/pglite'
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

let db: PGlite
let reads = 0
let barrier = false
let release: (() => void) | undefined
let ready: Promise<void>
const USER = 'synthetic-learner-a'

type Row = { user_id: string; record: unknown; updated_at: string | null }
/** 라우트가 쓰는 supabase-js 호출만 PGlite 로 옮긴 최소 어댑터(select · insert · update + eq/is + select) */
const admin = {
  from: () => ({
    select: () => ({
      eq: (_k: string, user: string) => ({
        maybeSingle: async () => {
          const r = await db.query<Row>('select record, updated_at::text as updated_at from csat_learner_state where user_id = $1', [user])
          const snapshot = r.rows[0] ? { record: r.rows[0].record, updated_at: r.rows[0].updated_at ? new Date(r.rows[0].updated_at).toISOString() : null } : null
          if (barrier) { reads++; if (reads === 2) release!(); await ready }
          return { data: snapshot, error: null }
        },
      }),
    }),
    insert: async (row: Row) => {
      try {
        await db.query('insert into csat_learner_state(user_id, record, updated_at) values ($1, $2::jsonb, $3)', [row.user_id, JSON.stringify(row.record), row.updated_at])
        return { error: null }
      } catch (e) {
        return { error: { code: (e as { code?: string }).code ?? 'x', message: String(e) } }
      }
    },
    update: (patch: { record: unknown; updated_at: string }) => {
      const conds: { col: string; val: string | null }[] = []
      const chain = {
        eq(col: string, val: string) { conds.push({ col, val }); return chain },
        is(col: string) { conds.push({ col, val: null }); return chain },
        async select() {
          const user = conds.find((c) => c.col === 'user_id')!.val
          const at = conds.find((c) => c.col === 'updated_at')
          const r = await db.query<{ user_id: string }>(
            at && at.val === null
              ? 'update csat_learner_state set record = $2::jsonb, updated_at = $3 where user_id = $1 and updated_at is null returning user_id'
              : 'update csat_learner_state set record = $2::jsonb, updated_at = $3 where user_id = $1 and updated_at = $4::timestamptz returning user_id',
            at && at.val === null ? [user, JSON.stringify(patch.record), patch.updated_at] : [user, JSON.stringify(patch.record), patch.updated_at, at?.val])
          return { data: r.rows, error: null }
        },
      }
      return chain
    },
  }),
} as unknown as SupabaseClient

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: USER } } }) } }) }))
vi.mock('@/lib/csat/embargo-gate', () => ({
  itemRevealDecision: async () => ({ held: new Set<string>(), failed: false }),
  revealHeldResponse: () => new Response(JSON.stringify({ held: true }), { status: 423 }),
}))

import { GET, PUT } from '../route'
import { withView } from '@/lib/csat/continuity'
import { writeMeaningNote } from '@/lib/csat/meaning-note'

const NOW = 1792317600000
const ITEM = 'SYNTHETIC#1'
const binding = { analysisVersion: 1, contentHash: 'aaaaaaaaaaaaaaaa' }
const base = (id: string) => withView({ version: 1, seed: 1, onboarded: true, predictions: [], formulas: [], queue: [], completed: [],
  meaningNotes: [writeMeaningNote(null, { item: ITEM, unitId: id, text: `Synthetic own-language note ${id}`, binding }, NOW)!], updatedAt: NOW } as never, ITEM, NOW)
const put = (record: unknown) => PUT(new Request('http://isolated.test/api/csat/state', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ record }) }))
const stored = async () => ((await db.query<{ record: { meaningNotes?: { unitId: string }[] } }>('select record from csat_learner_state where user_id = $1', [USER])).rows[0]?.record?.meaningNotes ?? []).map((x) => x.unitId).sort()

beforeAll(async () => { db = new PGlite(); await db.exec('create table csat_learner_state(user_id text primary key, record jsonb, updated_at timestamptz)') })
afterAll(async () => { await db.close() })
beforeEach(async () => { await db.exec('delete from csat_learner_state'); reads = 0; barrier = false; ready = new Promise<void>((r) => (release = r)) })

describe('state PUT 동시 저장(FI-015)', () => {
  it('정상 대조군 — 순차 저장 두 노트 보존', async () => {
    const a = await put(base('unit-one'))
    const b = await put(base('unit-two'))
    expect([a.status, b.status]).toEqual([200, 200])
    expect(await stored()).toEqual(['unit-one', 'unit-two'])
  })

  it('기존 행 위 동시 저장 — 둘 다 읽은 뒤 써도 두 노트 모두 서버 · 새 GET 에 남는다', async () => {
    await put(base('unit-zero'))
    barrier = true
    const res = await Promise.all([put(base('unit-one')), put(base('unit-two'))])
    barrier = false
    expect(reads).toBeGreaterThanOrEqual(2)
    expect(res.map((r) => r.status)).toEqual([200, 200])
    expect(await stored()).toEqual(['unit-one', 'unit-two', 'unit-zero'])
    const fetched = await (await GET()).json()
    expect(fetched.record.meaningNotes.map((x: { unitId: string }) => x.unitId).sort()).toEqual(['unit-one', 'unit-two', 'unit-zero'])
  })

  it('행이 없을 때 동시 첫 저장 — 한쪽 insert 충돌은 다시 읽어 합친다', async () => {
    barrier = true
    const res = await Promise.all([put(base('unit-one')), put(base('unit-two'))])
    barrier = false
    expect(res.map((r) => r.status)).toEqual([200, 200])
    expect(await stored()).toEqual(['unit-one', 'unit-two'])
  })

  it('같은 요청 재시도(같은 노트)는 한 건 — 재시도로 중복이 생기지 않는다', async () => {
    await put(base('unit-one'))
    await put(base('unit-one'))
    expect(await stored()).toEqual(['unit-one'])
  })

  it('updated_at 이 null 인 기존 행(옛 데이터)도 비교 갱신된다', async () => {
    await db.query("insert into csat_learner_state(user_id, record, updated_at) values ($1, $2::jsonb, null)", [USER, JSON.stringify(base('unit-old'))])
    const r = await put(base('unit-new'))
    expect(r.status).toBe(200)
    expect(await stored()).toEqual(['unit-new', 'unit-old'])
  })
})

describe('state GET — 보류 판정 입력(FI-016)', () => {
  it('「내 말로」 노트만 있는 기록도 그 문항을 보류 판정에 넘긴다', async () => {
    const { correctnessItemIds } = await import('@/lib/csat/continuity')
    const rec = { version: 1, seed: 1, onboarded: true, predictions: [], formulas: [], queue: [], completed: [],
      meaningNotes: [writeMeaningNote(null, { item: ITEM, unitId: 'unit-one', text: 'Synthetic own-language note unit-one', binding }, NOW)!] }
    expect(correctnessItemIds(rec as never)).toContain(ITEM)
  })
})
