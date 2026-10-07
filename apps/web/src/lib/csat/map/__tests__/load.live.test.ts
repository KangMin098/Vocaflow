// apps/web/src/lib/csat/map/__tests__/load.live.test.ts
//
// 라이브 스모크 — 실제 DB 로 loadMapPage 를 한 번 돌려 본다. 기본은 건너뜀:
//   MAP_LIVE_USER=<user uuid> pnpm --filter web exec vitest run src/lib/csat/map/__tests__/load.live.test.ts
// (SUPABASE_URL · SERVICE_ROLE_KEY 가 .env.local 에 있어야 한다. 읽기 전용 — DB 를 쓰지 않는다.)

import { describe, expect, it } from 'vitest'

import { createAdminClient } from '@/lib/supabase/admin'

import { loadMapPage } from '../load'
import { TASK_STAGE } from '../prescription'

const USER = process.env.MAP_LIVE_USER

describe.skipIf(!USER)('loadMapPage (live)', () => {
  it('실제 DB 에서 지도를 조립한다', async () => {
    const db = createAdminClient()
    const data = await loadMapPage(db as never, USER as string, new Date('2026-10-03T12:00:00Z'))
    expect(data).not.toBeNull()
    const d = data!
    const m = d.model
    const lines = d.nodes.filter((n) => n.kind === 'line')
    console.log('기준 시험', m.reference.exams.map((e) => e.label), 'shortfall', m.reference.shortfall, 'skipped', m.reference.skipped)
    console.log('목표', m.goal, '현재 점수', m.currentScore, '오답률 결측', m.missingRate, 'mayOverstate', m.mayOverstate)
    const row = (code: string) => {
      const v = m.nodes[code]
      return `${code} target=${v.target === null ? '-' : v.target.toFixed(3)} achieved=${v.achieved === null ? '-' : v.achieved.toFixed(3)} status=${v.status} n=${v.n} pts=${v.points} ${v.note ?? ''}`
    }
    for (const code of ['GOAL', 'A', 'B', 'C', 'D', 'A1', 'A7', 'B1', 'B4', 'B6', 'B10', 'C1', 'C8', 'D1', 'D9', 'T1', 'P1']) console.log(row(code))
    expect(lines).toHaveLength(54)
    // 처방 단계 대응표(prescription.ts) = DB 의 과제 id 전부 — 시드가 바뀌면 대응표도 고친다
    expect(d.tasks.map((t) => t.id).sort()).toEqual(Object.keys(TASK_STAGE).sort())
    expect(d.tasks).toHaveLength(182)   // 162 + FIND 보강 20(2026-10-07)
    expect(m.reference.exams.length).toBeGreaterThan(0)
    // 만점 목표(기본값)에서 연결 문항이 있는 라인의 목표율은 1
    expect(m.nodes.B1.target).toBe(1)
    expect(m.nodes.C8.status).toBe('no_items')
  })
})
