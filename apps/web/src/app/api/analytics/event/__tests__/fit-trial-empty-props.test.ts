// apps/web/src/app/api/analytics/event/__tests__/fit-trial-empty-props.test.ts
// @vitest-environment node
// 수신구 — 체험 두 이벤트는 속성 {} 만 넣는다. 비어 있지 않으면 writer(insert)를 부르지 않는다. 다른 이름 · 가드는 그대로.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ insert: vi.fn(async () => ({ error: null })) }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: () => ({ insert: h.insert }) }) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }))

import { POST } from '../route'

let ip = 0
const send = (body: unknown) =>
  POST(
    new Request('http://x/api/analytics/event', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${++ip}` },
      body: JSON.stringify(body),
    }),
  )

beforeEach(() => {
  h.insert.mockClear()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:9'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only'
})

describe('fit_trial_* 속성 {} 경계', () => {
  for (const name of ['fit_trial_opened', 'fit_trial_answered']) {
    it(`${name} + {} → 넣는다(meta {})`, async () => {
      const r = await send({ name, props: {}, surface: 'fit' })
      expect(r.status).toBe(204)
      expect(h.insert).toHaveBeenCalledTimes(1)
      expect(h.insert).toHaveBeenCalledWith(expect.objectContaining({ event: name, meta: {}, surface: 'fit' }))
    })
    it(`${name} + 속성 있음 → writer 를 부르지 않는다`, async () => {
      for (const props of [{ correct: true }, { choice: 2 }, { goal: 'on' }]) {
        const r = await send({ name, props })
        expect(r.status).toBe(204)
      }
      expect(h.insert).not.toHaveBeenCalled()
    })
  }
  it('다른 이벤트의 기존 속성 규칙은 그대로(fit_sheet_opened words)', async () => {
    await send({ name: 'fit_sheet_opened', props: { words: 3 } })
    expect(h.insert).toHaveBeenCalledTimes(1)
  })
  it('모르는 이름은 기존처럼 버린다', async () => {
    await send({ name: 'fit_trial_secret', props: {} })
    expect(h.insert).not.toHaveBeenCalled()
  })
})
