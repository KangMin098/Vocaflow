// apps/web/src/lib/teacher/__tests__/sent-assignments.test.ts
//
// `fetchSentAssignments` — **조회 실패가 학생 0명 · 미열람으로 보이지 않아야 한다**(TEACHER-COUNTS-01).
//
// 왜 이 테스트가 있는가:
//   인원(`class_members`) · 진도(`class_assignment_progress`) 조회 오류를 `data ?? []` 로 삼키면
//   과제는 있는데 "아직 학생이 없어요" · "아무도 열어 보지 않았어요" 가 그려졌다. 교사는 조회
//   장애를 학생 미참여로 읽고 잘못 개입한다.
//
// 조회 대역은 실제 마이그레이션(20260812124500 · 20260817130204)의 테이블·열만 받는다 —
//   없는 열을 고르거나 필터를 걸면 대역이 즉시 던진다. 실DB 는 쓰지 않는다
//   (실DB INSERT/DELETE 는 assignment-rls.integration.test.ts 몫이고 여기서 돌리지 않는다).

import { beforeEach, describe, expect, it, vi } from 'vitest'

const COLUMNS: Record<string, Set<string>> = {
  classes: new Set(['id', 'teacher_id', 'name', 'invite_code', 'created_at']),
  class_members: new Set(['class_id', 'user_id', 'role', 'joined_at']),
  class_assignments: new Set(['id', 'class_id', 'created_by', 'title', 'words', 'created_at']),
  class_assignment_progress: new Set(['assignment_id', 'user_id', 'opened_at', 'collected_at']),
}

type Result = { data: unknown; error: unknown }
type Call = { table: string; select: string; filters: [string, string, unknown][]; order?: unknown; limit?: number }

let calls: Call[] = []
let results: Record<string, Result> = {}
let user: { id: string } | null = { id: 'teacher-1' }

/** `select` 문자열의 각 열(관계 포함)이 실제 스키마에 있는지 확인한다. */
function assertColumns(table: string, select: string) {
  const known = COLUMNS[table]
  if (!known) throw new Error(`대역: 없는 테이블 ${table}`)
  const rel = /(\w+)\(([^)]*)\)/g
  let m: RegExpExecArray | null
  while ((m = rel.exec(select))) assertColumns(m[1], m[2])
  for (const col of select.replace(rel, '').split(',').map((c) => c.trim()).filter(Boolean)) {
    if (!known.has(col)) throw new Error(`대역: ${table}.${col} 없음`)
  }
}

function from(table: string) {
  const call: Call = { table, select: '', filters: [] }
  calls.push(call)
  const q = {
    select(cols: string) {
      assertColumns(table, cols)
      call.select = cols
      return q
    },
    eq(col: string, v: unknown) {
      if (!COLUMNS[table].has(col)) throw new Error(`대역: 필터 ${table}.${col} 없음`)
      call.filters.push(['eq', col, v])
      return q
    },
    in(col: string, v: unknown) {
      if (!COLUMNS[table].has(col)) throw new Error(`대역: 필터 ${table}.${col} 없음`)
      call.filters.push(['in', col, v])
      return q
    },
    order(col: string, opts: unknown) {
      call.order = [col, opts]
      return q
    },
    limit(n: number) {
      call.limit = n
      return q
    },
    then(resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) {
      return Promise.resolve(results[table] ?? { data: [], error: null }).then(resolve, reject)
    },
  }
  return q
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
    from,
  }),
}))

const { fetchSentAssignments } = await import('../assignment-actions')

const A1 = { id: 'a-1', class_id: 'c-1', title: '7과 어휘', words: [{ w: 'apple' }, { w: 'pear' }], created_at: '2026-10-01T00:00:00Z', classes: { name: '1반' } }
const A2 = { id: 'a-2', class_id: 'c-2', title: '8과 어휘', words: [{ w: 'grape' }], created_at: '2026-09-30T00:00:00Z', classes: [{ name: '2반' }] }
const ERR = { message: 'permission denied', code: '42501' }

beforeEach(() => {
  calls = []
  results = {}
  user = { id: 'teacher-1' }
})

describe('fetchSentAssignments — 목록', () => {
  it('비로그인 → 조회 없이 빈 목록, 실패 아님', async () => {
    user = null
    expect(await fetchSentAssignments()).toEqual({ rows: [], failed: false })
    expect(calls).toHaveLength(0)
  })

  it('목록 실패 → failed:true (빈 목록과 구별)', async () => {
    results.class_assignments = { data: null, error: ERR }
    expect(await fetchSentAssignments()).toEqual({ rows: [], failed: true })
  })

  it('진짜 빈 목록 → failed:false · 후속 인원/진도 조회를 하지 않는다', async () => {
    results.class_assignments = { data: [], error: null }
    expect(await fetchSentAssignments()).toEqual({ rows: [], failed: false })
    expect(calls.map((c) => c.table)).toEqual(['class_assignments'])
  })

  it('조회 수 · 열 · 필터는 그대로다(본인 created_by · 최신순 50)', async () => {
    results.class_assignments = { data: [A1, A2], error: null }
    await fetchSentAssignments()
    expect(calls).toEqual([
      {
        table: 'class_assignments',
        select: 'id, class_id, title, words, created_at, classes(name)',
        filters: [['eq', 'created_by', 'teacher-1']],
        order: ['created_at', { ascending: false }],
        limit: 50,
      },
      { table: 'class_members', select: 'class_id, user_id', filters: [['in', 'class_id', ['c-1', 'c-2']]] },
      {
        table: 'class_assignment_progress',
        select: 'assignment_id, collected_at',
        filters: [['in', 'assignment_id', ['a-1', 'a-2']]],
      },
    ])
  })
})

describe('fetchSentAssignments — 집계 실패는 progress:null, 과제는 보존', () => {
  const cases: [string, Result, Result][] = [
    ['인원 실패 · 진도 성공', { data: null, error: ERR }, { data: [{ assignment_id: 'a-1', collected_at: null }], error: null }],
    ['인원 성공 · 진도 실패', { data: [{ class_id: 'c-1' }], error: null }, { data: null, error: ERR }],
    ['양쪽 실패', { data: null, error: ERR }, { data: null, error: ERR }],
    ['오류와 함께 온 부분 data', { data: [{ class_id: 'c-1' }], error: ERR }, { data: [], error: null }],
    ['배열이 아닌 응답', { data: { class_id: 'c-1' }, error: null }, { data: [], error: null }],
    ['인원 행 [{}]', { data: [{}], error: null }, { data: [], error: null }],
    ['인원 행 [null]', { data: [null], error: null }, { data: [], error: null }],
    ['인원 class_id 타입 오류', { data: [{ class_id: 7 }], error: null }, { data: [], error: null }],
    ['인원 일부 행만 오류', { data: [{ class_id: 'c-1' }, { user_id: 'u' }], error: null }, { data: [], error: null }],
    ['진도 행 [{}]', { data: [], error: null }, { data: [{}], error: null }],
    ['진도 행 [null]', { data: [], error: null }, { data: [null], error: null }],
    ['진도 collected_at 타입 오류', { data: [], error: null }, { data: [{ assignment_id: 'a-1', collected_at: 1 }], error: null }],
    [
      '진도 일부 행만 오류',
      { data: [{ class_id: 'c-1' }], error: null },
      { data: [{ assignment_id: 'a-1', collected_at: null }, { assignment_id: 9, collected_at: null }], error: null },
    ],
  ]

  it.each(cases)('%s', async (_name, members, progress) => {
    results.class_assignments = { data: [A1, A2], error: null }
    results.class_members = members
    results.class_assignment_progress = progress
    const out = await fetchSentAssignments()
    expect(out.failed).toBe(false)
    expect(out.rows).toHaveLength(2)
    expect(out.rows.map((r) => r.progress)).toEqual([null, null])
    expect(out.rows[0].assignment).toEqual({
      id: 'a-1',
      classId: 'c-1',
      className: '1반',
      title: '7과 어휘',
      words: A1.words,
      createdAt: A1.created_at,
    })
    expect(out.rows[1].assignment.className).toBe('2반')
  })
})

describe('fetchSentAssignments — 정상 집계는 그대로', () => {
  it('정상 0명 · 0열람은 0 으로 남는다(확인할 수 없음 아님)', async () => {
    results.class_assignments = { data: [A1], error: null }
    const out = await fetchSentAssignments()
    expect(out.rows[0].progress).toEqual({ memberCount: 0, openedCount: 0, collectedCount: 0 })
  })

  it('일부 · 전체 열람/담기', async () => {
    results.class_assignments = { data: [A1, A2], error: null }
    results.class_members = {
      data: [{ class_id: 'c-1' }, { class_id: 'c-1' }, { class_id: 'c-1' }, { class_id: 'c-2' }],
      error: null,
    }
    results.class_assignment_progress = {
      data: [
        { assignment_id: 'a-1', collected_at: '2026-10-02T00:00:00Z' },
        { assignment_id: 'a-1', collected_at: null },
        { assignment_id: 'a-2', collected_at: '2026-10-02T00:00:00Z' },
      ],
      error: null,
    }
    const out = await fetchSentAssignments()
    expect(out.rows.map((r) => r.progress)).toEqual([
      { memberCount: 3, openedCount: 2, collectedCount: 1 },
      { memberCount: 1, openedCount: 1, collectedCount: 1 },
    ])
  })
})
