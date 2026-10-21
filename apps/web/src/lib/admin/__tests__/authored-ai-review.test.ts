// apps/web/src/lib/admin/__tests__/authored-ai-review.test.ts
import fs from 'node:fs'
import path from 'node:path'

import { NextRequest, NextResponse } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

import type { AdminUser } from '@/lib/auth/require-admin-api'
import { createAuthoredAiPost } from '../authored-ai-review'

const ROOT = path.resolve(__dirname, '../../../../../../docs/implementation/learning-outcomes-20261021/evidence/2a-ai-review')
const load = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8')
const body = () => ({
  action: 'preview',
  set_bytes: fs.readFileSync(path.resolve(__dirname, '../../knowledge/authored/r5-central-meaning.v1.json'), 'utf8'),
  receipt: JSON.parse(load('authored-final-ai-review.json')),
  evidence: {
    claude: { input: load('claude-65b8975d/input.txt'), result: load('claude-65b8975d/result.txt'), session: JSON.parse(load('claude-65b8975d/session.json')) },
    codex: { input: load('codex-f67f4b9a/input.txt'), result: load('codex-f67f4b9a/result.txt'), session: JSON.parse(load('codex-f67f4b9a/session.json')) },
  },
})
const admin = { id: '00000000-0000-4000-8000-000000000001', role: 'admin' } as AdminUser
const req = (b: unknown, origin = 'http://localhost:3000') => new NextRequest('http://localhost:3000/api/admin/csat/authored-ai-review', {
  method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(b),
})

describe('actual AI review admin boundary', () => {
  it('previews actual five reviewed items without opening a write session', async () => {
    const session = vi.fn()
    const r = await createAuthoredAiPost({ guard: async () => admin, session })(req(body()))
    expect(r.status).toBe(200)
    const j = await r.json()
    expect(j.refs).toHaveLength(5)
    expect(j).toMatchObject({ registered: false, released: false, humanReview: false, rightsGrant: false })
    expect(session).not.toHaveBeenCalled()
    expect(r.headers.get('cache-control')).toBe('no-store')
  })
  it('requires the full origin and original input/output evidence', async () => {
    const post = createAuthoredAiPost({ guard: async () => admin, session: vi.fn() })
    expect((await post(req(body(), 'https://localhost:3000'))).status).toBe(403)
    const x = body(); x.evidence.codex.input += 'changed'
    expect((await post(req(x))).status).toBe(400)
    const y = body(); y.evidence.claude.result += 'changed'
    expect((await post(req(y))).status).toBe(400)
    const z = body(); delete z.evidence.codex.session.status
    expect((await post(req(z))).status).toBe(400)
  })
  it('rejects altered Gold and does not accept a supplied user or approval', async () => {
    const session = vi.fn(), post = createAuthoredAiPost({ guard: async () => admin, session })
    const x = body(); const set = JSON.parse(x.set_bytes); set.items[0].gold.answer = 9; x.set_bytes = JSON.stringify(set)
    expect((await post(req(x))).status).toBe(422)
    expect((await post(req({ ...body(), userId: admin.id }))).status).toBe(400)
    expect(session).not.toHaveBeenCalled()
  })
  it('uses the admin session for register, never a privileged replacement client', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'not installed' } }), session = vi.fn().mockResolvedValue({ rpc })
    const r = await createAuthoredAiPost({ guard: async () => admin, session })(req({ ...body(), action: 'register' }))
    expect(r.status).toBe(503)
    expect(session).toHaveBeenCalledOnce()
    expect(rpc.mock.calls[0][0]).toBe('authored_item_register')
  })
  it('rejects unauthenticated and curator writes before opening a session', async () => {
    const session = vi.fn()
    expect((await createAuthoredAiPost({ guard: async () => NextResponse.json({}, { status: 401 }), session })(req(body()))).status).toBe(401)
    const guard = async () => ({ ...admin, role: 'curator' }) as AdminUser
    const r = await createAuthoredAiPost({ guard, session })(req({ ...body(), action: 'register' }))
    expect(r.status).toBe(403)
    expect(session).not.toHaveBeenCalled()
  })
})
