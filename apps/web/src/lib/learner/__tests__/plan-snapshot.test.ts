// apps/web/src/lib/learner/__tests__/plan-snapshot.test.ts
// T-0240 — 학습 계획 읽기 facade(fetchStudyPlanSnapshot): 목록 · 실패 · viewer. 기존 fetchStudyPlanItems 배열 wrapper 호환.
// Supabase 대역 — 질의별 결과를 지정하고, 호출한 표 · 쓰기 여부를 센다.
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Res = { data: unknown; error: unknown }
const st = vi.hoisted(() => ({
  user: 'user-a' as string | null,
  res: {} as Record<string, Res>,
  calls: [] as string[],
  writes: 0,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: st.user ? { id: st.user } : null } }) },
    from: (t: string) => {
      st.calls.push(t)
      const chain: Record<string, unknown> = {}
      for (const k of ['select', 'eq', 'in', 'not', 'order']) chain[k] = () => chain
      for (const k of ['insert', 'update', 'delete', 'upsert']) chain[k] = () => { st.writes++; return chain }
      chain.then = (ok: (v: unknown) => unknown) => Promise.resolve(st.res[t] ?? { data: [], error: null }).then(ok)
      return chain
    },
  }),
}))
vi.mock('@/lib/learner/plan-material-queries', () => ({ fetchPlanBooks: vi.fn(), fetchPlanCuratedSets: vi.fn(), fetchPlanChapterSets: vi.fn() }))

import { fetchStudyPlanItems, fetchStudyPlanSnapshot } from '../plan-actions'

const ROW = (id: string, material_type: string, material_id: string) => ({ id, material_type, material_id, modules: ['read'], chapters: [], weekdays: [1] })
const ok = (data: unknown): Res => ({ data, error: null })
const err: Res = { data: null, error: { message: 'boom' } }

beforeEach(() => {
  st.user = 'user-a'
  st.calls = []
  st.writes = 0
  st.res = {
    study_plan_items: ok([ROW('p1', 'book', 'b1'), ROW('p2', 'word_set', 's1')]),
    library_books: ok([{ id: 'b1', title: 'Book One', author: 'A', book_v_level: 3, cover_image_url: null, chapter_count: 12 }]),
    shared_word_sets: ok([{ id: 's1', title: 'Set One', slug: 'x', category: null, word_count: 20, cover_emoji: null }]),
    shared_words: ok([{ set_id: 's1', chapter: 3 }]),
  }
})

describe('fetchStudyPlanSnapshot', () => {
  it('정상 — items · failed false · viewerId = 읽은 getUser', async () => {
    const s = await fetchStudyPlanSnapshot()
    expect(s.failed).toBe(false)
    expect(s.viewerId).toBe('user-a')
    expect(s.items.map((i) => [i.id, i.title, i.chapterCount])).toEqual([['p1', 'Book One', 12], ['p2', 'Set One', 3]])
  })
  it('진짜 빈 계획 — items [] · failed false(실패와 구분)', async () => {
    st.res.study_plan_items = ok([])
    expect(await fetchStudyPlanSnapshot()).toEqual({ items: [], failed: false, viewerId: 'user-a' })
  })
  it('비로그인 — 빈 · 실패 아님 · viewer null', async () => {
    st.user = null
    expect(await fetchStudyPlanSnapshot()).toEqual({ items: [], failed: false, viewerId: null })
  })
  it('주 목록 오류 · 배열 아님 → failed', async () => {
    st.res.study_plan_items = err
    expect(await fetchStudyPlanSnapshot()).toMatchObject({ items: [], failed: true, viewerId: 'user-a' })
    st.res.study_plan_items = ok({ not: 'array' })
    expect((await fetchStudyPlanSnapshot()).failed).toBe(true)
  })
  it('형식이 어긋난 행 → failed(남은 행만 「전체」로 부르지 않는다)', async () => {
    st.res.study_plan_items = ok([ROW('p1', 'book', 'b1'), { id: 'bad', material_type: 'video', material_id: 'z' }, null])
    const s = await fetchStudyPlanSnapshot()
    expect(s.failed).toBe(true)
    expect(s.items.map((i) => i.id)).toEqual(['p1'])
  })
  it('자료 메타 조회 오류 → failed(「삭제된 자료」로 완전한 계획처럼 만들지 않는다)', async () => {
    st.res.library_books = err
    expect((await fetchStudyPlanSnapshot()).failed).toBe(true)
  })
  it('세트 챕터 조회 오류 → failed(0챕터로 만들지 않는다)', async () => {
    st.res.shared_words = err
    expect((await fetchStudyPlanSnapshot()).failed).toBe(true)
  })
  it('조회는 성공했지만 자료가 없음 → 실패는 아니고 보수적 표기 「(자료를 확인할 수 없음)」', async () => {
    st.res.library_books = ok([])
    const s = await fetchStudyPlanSnapshot()
    expect(s.failed).toBe(false)
    expect(s.items[0].title).toBe('(자료를 확인할 수 없음)')
  })
  it('쓰기 0 · 조회 표는 기존과 같다(목록 1 · 메타 · 챕터)', async () => {
    await fetchStudyPlanSnapshot()
    expect(st.writes).toBe(0)
    expect(st.calls).toEqual(['study_plan_items', 'library_books', 'shared_word_sets', 'shared_words'])
  })
})

describe('fetchStudyPlanItems — 기존 배열 wrapper 호환(hub-lab · manage-overview)', () => {
  it('정상은 같은 배열', async () => {
    const a = await fetchStudyPlanItems()
    expect(a.map((i) => i.id)).toEqual(['p1', 'p2'])
  })
  it('자료가 없으면 기존 표기 「(삭제된 자료)」 그대로 · 목록 오류는 기존처럼 빈 배열', async () => {
    st.res.library_books = ok([])
    expect((await fetchStudyPlanItems())[0].title).toBe('(삭제된 자료)')
    st.res.study_plan_items = err
    expect(await fetchStudyPlanItems()).toEqual([])
  })
  it('조회 표 · 횟수는 facade 와 같다(한 번 호출에 목록 1)', async () => {
    await fetchStudyPlanItems()
    expect(st.calls.filter((c) => c === 'study_plan_items')).toHaveLength(1)
  })
})
