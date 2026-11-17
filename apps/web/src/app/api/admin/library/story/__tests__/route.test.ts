// apps/web/src/app/api/admin/library/story/__tests__/route.test.ts
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ create: vi.fn(), service: vi.fn(), cookie: null as unknown }))
vi.mock('@/lib/supabase/server', () => ({ createClient: h.create }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: h.service }))

import { GET } from '../route'

const VERSION = '11111111-1111-4111-8111-111111111111'
const USER = '22222222-2222-4222-8222-222222222222'
const request = (query = 'kind=slots') => new Request(`http://localhost/api/admin/library/story?${query}`)

function cookie(user: { id: string } | null = { id: USER }, profile: { role: string; status: string } | null = { role: 'curator', status: 'active' }) {
  const getUser = vi.fn(async () => ({ data: { user }, error: null }))
  const maybeSingle = vi.fn(async () => ({ data: profile, error: null }))
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  const rpc = vi.fn(async (name: string) => name === 'story_admin_list_slots'
    ? { data: [], error: null }
    : { data: null, error: { message: 'story:edition_version_not_found' } })
  return { auth: { getUser }, from, select, eq, maybeSingle, rpc }
}

beforeEach(() => {
  vi.clearAllMocks()
  h.cookie = cookie()
  h.create.mockImplementation(async () => h.cookie)
})
afterEach(() => { vi.unstubAllEnvs() })

it.each(['', 'kind=constructor', 'kind=unknown', 'kind=bundle', 'kind=bundle&edition_version_id=invalid'])('invalid read %s creates no client or query', async query => {
  const response = await GET(request(query))
  expect(response.status).toBe(400)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect((await response.json()).code).toBe('invalid_input')
  expect(h.create).not.toHaveBeenCalled()
  expect(h.service).not.toHaveBeenCalled()
})

it.each(['kind=slots', `kind=bundle&edition_version_id=${VERSION}`])('signed-out read %s cannot use DEV_ADMIN_BYPASS or query private data', async query => {
  vi.stubEnv('DEV_ADMIN_BYPASS', '1')
  const client = cookie(null); h.cookie = client
  const response = await GET(request(query))
  expect(response.status).toBe(401)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect((await response.json()).code).toBe('auth_required')
  expect(client.from).not.toHaveBeenCalled()
  expect(client.rpc).not.toHaveBeenCalled()
  expect(h.service).not.toHaveBeenCalled()
})

it.each([
  { role: 'user', status: 'active' },
  { role: 'curator', status: 'suspended' },
  { role: 'admin', status: 'deleted' },
  null,
])('unusable staff profile %j cannot read slots or bundles', async profile => {
  const client = cookie({ id: USER }, profile); h.cookie = client
  for (const query of ['kind=slots', `kind=bundle&edition_version_id=${VERSION}`]) {
    const response = await GET(request(query))
    expect(response.status).toBe(403)
    expect(response.headers.get('cache-control')).toBe('no-store')
  }
  expect(client.eq).toHaveBeenCalledWith('user_id', USER)
  expect(client.rpc).not.toHaveBeenCalled()
  expect(h.service).not.toHaveBeenCalled()
})

it('waits for actual getUser before profile and data reads', async () => {
  let resolve!: (value: { data: { user: { id: string } | null }; error: null }) => void
  const client = cookie(); h.cookie = client
  client.auth.getUser.mockReturnValue(new Promise(r => { resolve = r }))
  const pending = GET(request())
  await Promise.resolve()
  expect(client.from).not.toHaveBeenCalled()
  expect(client.rpc).not.toHaveBeenCalled()
  resolve({ data: { user: null }, error: null })
  expect((await pending).status).toBe(401)
})

it.each(['admin', 'curator'])('active %s reads slots with cookie RPC, no cache or writes', async role => {
  const client = cookie({ id: USER }, { role, status: 'active' }); h.cookie = client
  const response = await GET(request())
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.json()).toEqual({ ok: true, viewer: { uid: USER, role }, data: { slots: [] } })
  expect(client.rpc).toHaveBeenCalledTimes(1)
  expect(client.rpc).toHaveBeenCalledWith('story_admin_list_slots', {})
  expect(h.service).not.toHaveBeenCalled()
})

it('bundle forwards only the validated version to existing cookie-guarded RPC', async () => {
  const client = cookie(); h.cookie = client
  const response = await GET(request(`kind=bundle&edition_version_id=${VERSION}`))
  expect(response.status).toBe(404)
  expect((await response.json()).code).toBe('story:edition_version_not_found')
  expect(client.rpc).toHaveBeenCalledTimes(1)
  expect(client.rpc).toHaveBeenCalledWith('story_admin_get_bundle', { p_edition_version_id: VERSION })
  expect(h.service).not.toHaveBeenCalled()
})

it('RPC/client failures are explicit unavailable results, never an empty success', async () => {
  const client = cookie(); h.cookie = client
  client.rpc.mockRejectedValueOnce(new Error('offline'))
  const unavailable = await GET(request())
  expect(unavailable.status).toBe(503)
  expect((await unavailable.json()).ok).toBe(false)
  h.create.mockRejectedValueOnce(new Error('unavailable'))
  const failed = await GET(request())
  expect(failed.status).toBe(503)
  expect((await failed.json()).code).toBe('server_error')
})
