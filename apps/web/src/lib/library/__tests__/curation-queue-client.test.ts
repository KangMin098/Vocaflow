// apps/web/src/lib/library/__tests__/curation-queue-client.test.ts
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { readCurationQueue } from '../curation-queue-client'
afterEach(() => vi.unstubAllGlobals())
it('polls by uncached GET without entering the Server Action queue', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ ok: true, data: [] }))
  vi.stubGlobal('fetch', fetcher)
  expect(await readCurationQueue('voice')).toEqual({ ok: true, data: [] })
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(fetcher).toHaveBeenCalledWith('/api/admin/library/curation-jobs?kind=voice', { cache: 'no-store' })
})
it.each([
  Response.json({ error: 'Unauthorized', message: '로그인이 필요합니다.' }, { status: 401 }),
  Response.json({ ok: false, error: '큐 오류' }, { status: 503 }),
  Response.json({ ok: true, data: null }),
  new Response('invalid JSON'),
])('invalid/auth/error responses return a failure result, not missing rows', async response => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
  expect((await readCurationQueue('quiz')).ok).toBe(false)
})
it('network failure does not reject a banner load or leave Promise.all pending', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
  const results = await Promise.all([readCurationQueue('voice'), readCurationQueue('quiz'), readCurationQueue('review')])
  expect(results.every(result => !result.ok)).toBe(true)
})
it('both initial polling callers keep reads out of server actions', () => {
  for (const name of ['MyLibraryTab', 'DrainQueueBanner']) {
    const source = fs.readFileSync(path.resolve('src/components/admin/curation/' + name + '.tsx'), 'utf8')
    expect(source).toContain("from '@/lib/library/curation-queue-client'")
    expect(source).not.toMatch(/fetch(?:Curation|Quiz|Review)JobsAction/)
  }
})
