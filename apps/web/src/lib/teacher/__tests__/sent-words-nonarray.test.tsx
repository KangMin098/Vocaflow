// apps/web/src/lib/teacher/__tests__/sent-words-nonarray.test.tsx
//
// fetchSentAssignments 응답 경계 — 저장된 words 가 배열이 아니면 빈 목록으로 바꾸지 않고 목록 실패로 돌린다
// (TEACHER-WORDS-01 §2 · T-0236). DB CHECK 가 막고 있어 실제로 관측된 적은 없다 — 방어 처리의 회귀다.
//
// 쓰기 없는 조회 대역 → 실제 Action → 실제 SentAssignments 화면까지 잇는다. 대역은 실제 마이그레이션의 테이블 · 열만 받는다
// (sent-assignments.test.ts 와 같은 규칙). 실DB 는 쓰지 않는다.

import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SentAssignments } from '@/components/teacher/SentAssignments'

const COLUMNS: Record<string, Set<string>> = {
  classes: new Set(['id', 'teacher_id', 'name', 'invite_code', 'created_at']),
  class_members: new Set(['class_id', 'user_id', 'role', 'joined_at']),
  class_assignments: new Set(['id', 'class_id', 'created_by', 'title', 'words', 'created_at']),
  class_assignment_progress: new Set(['assignment_id', 'user_id', 'opened_at', 'collected_at']),
}
type Result = { data: unknown; error: unknown }
let results: Record<string, Result> = {}
let tables: string[] = []

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
  tables.push(table)
  const q = {
    select(cols: string) { assertColumns(table, cols); return q },
    eq(col: string) { if (!COLUMNS[table].has(col)) throw new Error(`대역: 필터 ${table}.${col}`); return q },
    in(col: string) { if (!COLUMNS[table].has(col)) throw new Error(`대역: 필터 ${table}.${col}`); return q },
    order() { return q },
    limit() { return q },
    insert() { throw new Error('대역: 쓰기 금지') },
    update() { throw new Error('대역: 쓰기 금지') },
    delete() { throw new Error('대역: 쓰기 금지') },
    then(resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) {
      return Promise.resolve(results[table] ?? { data: [], error: null }).then(resolve, reject)
    },
  }
  return q
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'teacher-1' } } }) }, from }),
}))

const { fetchSentAssignments } = await import('../assignment-actions')

const row = (words: unknown, id = 'a-1') => ({ id, class_id: 'c-1', title: '7과 어휘', words, created_at: '2026-10-01T00:00:00Z', classes: { name: '1반' } })
const render = async () => {
  const sent = await fetchSentAssignments()
  return { sent, html: renderToStaticMarkup(<SentAssignments rows={sent.rows} failed={sent.failed} />) }
}

beforeEach(() => {
  results = {}
  tables = []
})

describe('fetchSentAssignments — 비배열 words 는 목록 실패', () => {
  it.each([
    ['null', null],
    ['객체', { w: 'apple' }],
    ['문자열', 'apple,pear'],
    ['숫자', 3],
  ])('words=%s → failed:true · 화면은 기존 목록 실패 안내(「저장된 단어가 없어요」 아님)', async (_n, words) => {
    results.class_assignments = { data: [row(words)], error: null }
    const { sent, html } = await render()
    expect(sent).toEqual({ rows: [], failed: true })
    expect(html).toContain('보낸 과제를 불러오지 못했어요')
    expect(html).not.toContain('저장된 단어가 없어요')
    // 인원 · 진도 후속 조회를 하지 않는다
    expect(tables).toEqual(['class_assignments'])
  })

  it('여러 과제 중 하나만 비배열이어도 목록 실패(일부만 정상인 척하지 않는다)', async () => {
    results.class_assignments = { data: [row([{ w: 'apple', m: '사과' }], 'a-1'), row(null, 'a-2')], error: null }
    const { sent } = await render()
    expect(sent).toEqual({ rows: [], failed: true })
  })
})

describe('fetchSentAssignments — 정상 배열은 그대로', () => {
  it('정상 빈 배열 → 정상 빈 단어 목록(failed 아님)', async () => {
    results.class_assignments = { data: [row([])], error: null }
    const { sent, html } = await render()
    expect(sent.failed).toBe(false)
    expect(sent.rows[0].assignment.words).toEqual([])
    expect(html).toContain('저장된 단어가 없어요')
    expect(html).not.toContain('불러오지 못했어요')
  })

  it('정상 words + 집계 실패 → 단어는 확인 가능, 집계는 불가', async () => {
    const words = [{ w: 'apple', m: '사과' }, { w: 'pear', m: null }]
    results.class_assignments = { data: [row(words)], error: null }
    results.class_members = { data: null, error: { message: 'x' } }
    const { sent, html } = await render()
    expect(sent.failed).toBe(false)
    expect(sent.rows[0].assignment.words).toEqual(words)
    expect(sent.rows[0].progress).toBeNull()
    expect(html).toContain('보낸 단어 2개 확인')
    expect(html).toContain('지금은 수행 현황을 확인할 수 없어요')
  })

  it('배열 안 잘못된 행은 서버가 그대로 넘기고 화면이 확인 불가로 판정한다(기존 malformed-row 검사 유지)', async () => {
    const words = [{ w: 'apple', m: '사과' }, null]
    results.class_assignments = { data: [row(words)], error: null }
    const { sent, html } = await render()
    expect(sent.failed).toBe(false)
    expect(sent.rows[0].assignment.words).toEqual(words)
    expect(html).toContain('보낸 단어 목록을 확인할 수 없어요')
  })
})
