// apps/web/src/app/api/lcp/process/route.test.ts
// LCP v2.0 Phase 7 — route handler 단위 테스트 (인증 + 요청 검증)
// LCP_INTERNAL_TOKEN 미설정 시 자동 skip

import { describe, it, expect } from 'vitest'
import { POST } from './route'

const skipIfNoEnv =
  !process.env['SUPABASE_SERVICE_ROLE_KEY'] ||
  !process.env['LCP_INTERNAL_TOKEN']

describe.skipIf(skipIfNoEnv)('POST /api/lcp/process — auth & validation', () => {
  it('401 when X-LCP-Token missing', async () => {
    const req = new Request('http://localhost/api/lcp/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg_id: 1, book_id: 'test' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('401 when X-LCP-Token mismatch', async () => {
    const req = new Request('http://localhost/api/lcp/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LCP-Token': 'WRONG_TOKEN',
      },
      body: JSON.stringify({ msg_id: 1, book_id: 'test' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('400 when body missing required fields', async () => {
    const req = new Request('http://localhost/api/lcp/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LCP-Token': process.env['LCP_INTERNAL_TOKEN']!,
      },
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
