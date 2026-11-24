// apps/web/src/lib/library/story/__tests__/story-admin-reader.test.ts
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { afterEach, expect, it, vi } from 'vitest'
import { readStoryBundle, readStorySlots } from '../admin-reader'
import { describeStoryCode } from '../messages'
import { updateAdminUrl } from '@/lib/admin/navigation'

const VERSION = '11111111-1111-4111-8111-111111111111'
const success = (data: unknown) => ({ ok: true, viewer: { uid: 'staff', role: 'curator' }, data })
afterEach(() => { vi.unstubAllGlobals() })

it('initial slots and bundle reads use same-origin no-store GET without Server Action dispatch', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(success({ slots: [] })))
    .mockResolvedValueOnce(Response.json(success({ version: { id: VERSION } })))
  vi.stubGlobal('fetch', fetcher)
  expect((await readStorySlots()).ok).toBe(true)
  expect((await readStoryBundle(VERSION)).ok).toBe(true)
  expect(fetcher).toHaveBeenNthCalledWith(1, '/api/admin/library/story?kind=slots', { cache: 'no-store', credentials: 'same-origin' })
  expect(fetcher).toHaveBeenNthCalledWith(2, `/api/admin/library/story?kind=bundle&edition_version_id=${VERSION}`, { cache: 'no-store', credentials: 'same-origin' })
  const component = fs.readFileSync(path.resolve('src/app/admin/curation/StoryCurationClient.tsx'), 'utf8')
  expect(component).toContain("from '@/lib/library/story/admin-reader'")
  expect(component).not.toMatch(/\b(?:listStorySlotsAction|loadStoryBundleAction)\b/)
  for (const action of ['checkStoryCandidateAction', 'registerStoryCandidateAction', 'submitStoryReviewAction', 'publishStoryAction']) expect(component).toContain(action)
})

it('auth failures remain actionable Story failures instead of becoming empty data', async () => {
  const denied = { ok: false, code: 'auth_required', ...describeStoryCode('auth_required'), stage: 'auth', issues: [] }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(denied, { status: 401 })))
  expect(await readStorySlots()).toEqual(denied)
})

it.each([
  Response.json(success(null)),
  Response.json(success({ slots: null })),
  Response.json({ ok: true, data: { slots: [] } }),
  Response.json(success({ slots: [] }), { status: 503 }),
  Response.json({ ok: false }),
  new Response('invalid JSON'),
])('invalid/failed read responses cannot report a valid empty catalogue', async response => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
  expect((await readStorySlots()).ok).toBe(false)
})

it('a bundle for another version and a rejected network request are failures', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json(success({ version: { id: 'another-version' } }))).mockRejectedValueOnce(new TypeError('offline')))
  expect((await readStoryBundle(VERSION)).ok).toBe(false)
  const result = await readStorySlots()
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.code).toBe('network_failed')
})

it('a delayed GET can overlap History opening the file panel without scheduling Next refresh', async () => {
  // Use the installed Next action queue. A pending Server Action would be discarded by
  // ACTION_RESTORE and schedule ACTION_REFRESH; a plain GET never enters that queue.
  const require = createRequire(import.meta.url)
  const current = new URL('http://localhost/admin/curation?line=story')
  const queuePath = require.resolve('next/dist/shared/lib/router/action-queue')
  const queueRequire = createRequire(queuePath)
  const nextModule = { exports: {} }
  // Only the unused RSC reducer is replaced: its browser-only webpack entry is not
  // available in node tests. The installed Next scheduler itself runs unchanged.
  const createMutableActionQueue = runInNewContext(`${fs.readFileSync(queuePath, 'utf8')}\nmodule.exports.createMutableActionQueue`, {
    module: nextModule, exports: nextModule.exports, window: { location: current },
    require: (specifier: string) => specifier === '../../../client/components/router-reducer/router-reducer'
      ? { reducer: () => { throw new Error('This test supplies its own state reducer') } } : queueRequire(specifier),
  })
  const queue = createMutableActionQueue()
  const dispatched: string[] = []
  queue.state = { canonicalUrl: current.href }
  queue.action = (state: { canonicalUrl: string }, action: { type: string; url?: URL }) => {
    dispatched.push(action.type)
    return action.type === 'restore' ? { canonicalUrl: action.url!.href } : state
  }
  vi.stubGlobal('window', { location: current, history: { pushState(_data: unknown, _unused: string, href: string) {
    queue.dispatch({ type: 'restore', url: new URL(href, current) }, () => {})
  } } })
  let resolve!: (value: Response) => void
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(r => { resolve = r })))
  const pending = readStorySlots()
  updateAdminUrl('/admin/curation?line=story&story_panel=files', 'push')
  expect(new URL(queue.state.canonicalUrl).searchParams.get('story_panel')).toBe('files')
  resolve(Response.json(success({ slots: [] })))
  expect((await pending).ok).toBe(true)
  expect(new URL(queue.state.canonicalUrl).searchParams.get('story_panel')).toBe('files')
  expect(dispatched).toEqual(['restore'])
  expect(queue.needsRefresh).not.toBe(true)
})
