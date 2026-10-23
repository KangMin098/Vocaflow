// apps/web/src/app/api/csat/lecture/route.test.ts
//
// 강의 API 의 공개 범위 — scope=until 은 서버가 경계 뒤 cue 를 응답에서 뺀다. 결속이 깨지면 409(잘라 주지 않음).
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } }),
}))
vi.mock('@/lib/csat/embargo-gate', () => ({
  canRevealItem: async () => true,
  revealHeldResponse: () => new Response(JSON.stringify({ held: 'exam_embargo' }), { status: 423 }),
}))
// 실제 대본을 읽되, 한 검사에서만 대본이 검수 뒤 바뀐 상황을 만든다
const tamper = vi.hoisted(() => ({ on: false }))
vi.mock('@/lib/csat/lecture/store', async (orig) => {
  const real = await orig<typeof import('@/lib/csat/lecture/store')>()
  return {
    ...real,
    loadLecture: (id: string) => {
      const l = real.loadLecture(id)
      if (!l || !tamper.on) return l
      const c = structuredClone(l)
      c.cues[0].segments[0].text += ' (수정)'
      return c
    },
  }
})

import { GET } from './route'

const get = (q: string) => GET(new Request(`http://x/api/csat/lecture?${q}`))
const ANSWER_SAID = /정답은\s*[^.?!]{0,12}?(?:일|이|삼|사|오)\s+번/

describe('강의 API 공개 범위', () => {
  beforeEach(() => {
    tamper.on = false
  })

  it('scope=until — 경계 앞 cue 만 · 정답 낭독 없음 · no-store', async () => {
    const res = await get('item=2026-22&scope=until')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const j = await res.json()
    expect(j.disclosure).toMatchObject({ scope: 'until', verified: true, stopBefore: 4 })
    expect(j.lecture.cues).toHaveLength(4)
    expect(JSON.stringify(j.lecture)).not.toMatch(ANSWER_SAID)
  })

  it('scope 없음 · full — 전체(정답 포함)', async () => {
    const j = await (await get('item=2026-22')).json()
    expect(j.lecture.cues.length).toBeGreaterThan(4)
    expect(JSON.stringify(j.lecture)).toMatch(ANSWER_SAID)
    expect(j.disclosure).toEqual({ scope: 'full' })
    expect((await (await get('item=2026-22&scope=full')).json()).lecture.cues.length).toBe(j.lecture.cues.length)
  })

  it('대본이 검수 뒤 바뀌었으면 409 — 잘린 강의도 전체 강의도 보내지 않는다', async () => {
    tamper.on = true
    const res = await get('item=2026-22&scope=until')
    expect(res.status).toBe(409)
    const j = await res.json()
    expect(j.ok).toBe(false)
    expect(j.lecture).toBeUndefined()
    expect(j.disclosure).toMatchObject({ verified: false, reason: 'binding_mismatch' })
  })

  it('모르는 scope 는 400', async () => {
    expect((await get('item=2026-22&scope=all')).status).toBe(400)
  })
})
