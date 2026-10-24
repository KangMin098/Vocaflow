// apps/web/src/lib/csat/judgment/__tests__/server.live.test.ts
// 개발 DB 읽기 전용 대조 — 명시 실행 전용: VFC_JUDGMENT_LIVE=1 pnpm exec vitest run src/lib/csat/judgment/__tests__/server.live.test.ts
// 서버 로더가 실제 DB 에서 만든 문항 · 공개 자료가 커밋된 픽스처(export 스크립트 산출물)와 같은지 본다. 쓰기 없음.
// 환경 변수가 없으면 실패한다(건너뜀을 통과로 세지 않는다).
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { checkReveal } from '../evidence'
import { FIXTURE_TYPES, itemsOf, revealOf } from '../fixtures'
import { loadJudgmentItem, loadJudgmentReveal } from '../server'

const live = process.env.VFC_JUDGMENT_LIVE === '1'

describe.runIf(live)('판단 로더 ↔ 개발 DB (읽기 전용)', () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  it('환경 변수가 있다', () => {
    expect(url, 'NEXT_PUBLIC_SUPABASE_URL').toBeTruthy()
    expect(key, 'SUPABASE_SERVICE_ROLE_KEY').toBeTruthy()
  })
  for (const type of FIXTURE_TYPES) {
    it(`${type}: 실제 DB 로더 결과가 픽스처와 같고 공개 자료가 같은 판본에 결속된다`, async () => {
      const db = createClient(url!, key!, { auth: { persistSession: false } })
      for (const fx of itemsOf(type)) {
        const r = await loadJudgmentItem(db, fx.id, fx.version.analysisVersion)
        expect(r.state, fx.id).toBe('ready')
        if (r.state !== 'ready') continue
        expect(r.item).toEqual(fx)
        const rev = await loadJudgmentReveal(db, fx.id, fx.version.analysisVersion)
        expect(rev).toEqual(await revealOf(type, fx.id))
        expect(checkReveal(r.item, rev).ok).toBe(true)
      }
    }, 60_000)
  }
})
