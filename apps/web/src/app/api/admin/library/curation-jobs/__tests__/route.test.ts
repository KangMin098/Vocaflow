// apps/web/src/app/api/admin/library/curation-jobs/__tests__/route.test.ts
import { beforeEach, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
const { guard, create, voice, quiz, review } = vi.hoisted(() => ({ guard: vi.fn(), create: vi.fn(), voice: vi.fn(), quiz: vi.fn(), review: vi.fn() }))
vi.mock('@/lib/auth/require-admin-api', () => ({ requireAdminApi: guard }))
vi.mock('@/lib/supabase/server', () => ({ createClient: create }))
vi.mock('@/lib/library/admin-queries', () => ({ fetchCurationJobs: voice, fetchQuizJobs: quiz, fetchReviewJobs: review }))
import { GET } from '../route'
const request = (kind = 'voice') => new Request('http://localhost/api/admin/library/curation-jobs?kind=' + kind)
beforeEach(() => { vi.clearAllMocks(); guard.mockResolvedValue({ id: 'admin' }); create.mockResolvedValue({ sessionClient: true }); for (const fn of [voice, quiz, review]) fn.mockResolvedValue([]) })
it.each([401, 403])('denial %s never accesses queue data', async status => {
  guard.mockResolvedValue(NextResponse.json({ error: 'denied' }, { status }))
  const response = await GET(request())
  expect(response.status).toBe(status); expect(response.headers.get('cache-control')).toBe('no-store')
  expect(create).not.toHaveBeenCalled(); expect(voice).not.toHaveBeenCalled()
})
it('waits for identity before constructing the session data client', async () => {
  let resolve!: (value: unknown) => void
  guard.mockReturnValue(new Promise(r => { resolve = r }))
  const pending = GET(request()); await Promise.resolve()
  expect(create).not.toHaveBeenCalled()
  resolve({ id: 'admin' }); await pending
  expect(create).toHaveBeenCalledOnce()
})
it.each(['voice', 'quiz', 'review'])('uses the existing %s query and session client without altering rows', async kind => {
  const fn = { voice, quiz, review }[kind]!
  const rows = [{ id: 'job', bookId: 'book', status: 'running', taskType: kind, updatedAt: 'fixed' }]
  fn.mockResolvedValue(rows)
  const response = await GET(request(kind))
  expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.json()).toEqual({ ok: true, data: rows })
  expect(fn).toHaveBeenCalledTimes(1)
  expect(fn).toHaveBeenCalledWith({ sessionClient: true })
  expect([voice, quiz, review].filter(query => query.mock.calls.length)).toHaveLength(1)
})
it.each(['', 'constructor', 'unknown'])('invalid kind %s does not query data', async kind => {
  expect((await GET(request(kind))).status).toBe(400)
  expect(create).not.toHaveBeenCalled()
})
it('query failure is unavailable, never an empty success', async () => {
  voice.mockRejectedValue(new Error('database unavailable'))
  const response = await GET(request())
  expect(response.status).toBe(503); expect(await response.json()).toEqual({ ok: false, error: '큐 상태를 불러오지 못했습니다.' })
})
