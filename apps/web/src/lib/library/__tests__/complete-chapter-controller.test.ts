// apps/web/src/lib/library/__tests__/complete-chapter-controller.test.ts
import { describe, expect, it, vi } from 'vitest'
import { createCompletionController, type CompletionPhase } from '../complete-chapter-controller'
import type { CompleteChapterResult } from '../complete-chapter'

const ok = (over: Partial<CompleteChapterResult> = {}): CompleteChapterResult => ({
  ok: true, alreadyCompleted: false, nextChapterTextId: 'next', bookCompleted: false, ...over,
})

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
const flush = () => new Promise((r) => setTimeout(r, 0))

function setup(initial = 'A') {
  const pending: Array<ReturnType<typeof deferred<CompleteChapterResult>>> = []
  const complete = vi.fn<[string], Promise<CompleteChapterResult>>(() => { const d = deferred<CompleteChapterResult>(); pending.push(d); return d.promise })
  const phases: CompletionPhase[] = []
  const c = createCompletionController(initial, complete, (p) => phases.push(p))
  return { c, complete, pending, phases }
}

describe('createCompletionController', () => {
  it('성공·이미 완료 → done', async () => {
    const { c, pending } = setup()
    c.start(); pending[0].resolve(ok({ alreadyCompleted: true })); await flush()
    expect(c.phase()).toEqual({ kind: 'done', result: ok({ alreadyCompleted: true }) })
  })
  it('ok=false · reject → failed, 다시 시도하면 같은 장으로 재호출해 성공', async () => {
    const { c, complete, pending } = setup()
    c.start(); pending[0].resolve({ ...ok(), ok: false }); await flush()
    expect(c.phase().kind).toBe('failed')
    c.start(); pending[1].reject(new Error('net')); await flush()
    expect(c.phase().kind).toBe('failed')
    c.start(); pending[2].resolve(ok()); await flush()
    expect(c.phase().kind).toBe('done')
    expect(complete.mock.calls.map((x) => x[0])).toEqual(['A', 'A', 'A'])
  })
  it('진행 중 연속 조작은 호출 1회', () => {
    const { c, complete } = setup()
    expect(c.start()).toBe(true)
    expect(c.start()).toBe(false)
    expect(c.start()).toBe(false)
    expect(complete).toHaveBeenCalledTimes(1)
  })
  it('장이 바뀐 뒤 옛 응답(성공·실패)은 표시하지 않는다', async () => {
    const { c, pending } = setup()
    c.start(); c.setTextId('B'); pending[0].resolve(ok()); await flush()
    expect(c.phase()).toEqual({ kind: 'idle' })
    c.start(); c.setTextId('A'); pending[1].reject(new Error('x')); await flush()
    expect(c.phase()).toEqual({ kind: 'idle' })
  })
  it('A 저장 → B → A 복귀 → 재시도: 첫 A 응답은 버리고 새 요청 응답만 반영', async () => {
    const { c, complete, pending } = setup()
    c.start(); c.setTextId('B'); c.setTextId('A')
    expect(c.start()).toBe(true)
    pending[0].resolve(ok({ nextChapterTextId: 'stale' })); await flush()
    expect(c.phase().kind).toBe('submitting')
    expect(c.start()).toBe(false)
    pending[1].resolve(ok({ nextChapterTextId: 'fresh' })); await flush()
    expect(c.phase()).toEqual({ kind: 'done', result: ok({ nextChapterTextId: 'fresh' }) })
    expect(complete).toHaveBeenCalledTimes(2)
  })
})
