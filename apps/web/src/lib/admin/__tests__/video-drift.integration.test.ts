// apps/web/src/lib/admin/__tests__/video-drift.integration.test.ts
//
// **낡음 판정이 조용히 0 을 내지 않는지.**
//
// `evidenceDrift()` 가 빈 배열을 돌려주는 데는 두 가지 뜻이 있다:
//   ① 발행본의 수가 지금과 같다 — 좋다
//   ② **대조 자체를 못 했다** — 출처 문자열이 바뀌었거나 RPC 이름이 달라져 lookup 이
//      전부 null 을 돌려준 경우. 화면에는 똑같이 "다시 찍을 이유가 없습니다" 로 뜬다
//
// ②가 이 저장소가 반복해서 겪는 종류의 사고다(수신구가 204 를 주며 삼키던 계측,
// `count ?? 0` 으로 뭉개던 카운트). 그래서 **대조한 항목 수**를 따로 센다 — 0 이면 실패다.

import { describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'

import manifest from '@/lib/video/manifest.json'

const URL_ = process.env['NEXT_PUBLIC_SUPABASE_URL']
const KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const LIVE = !!URL_ && !!KEY

interface Entry {
  id: string
  evidence?: { label: string; value: string; source: string }[]
}

describe('영상 수치 낡음 판정 (integration)', () => {
  it.runIf(LIVE)('대조할 수 있는 근거가 실제로 있다 — 0 이면 판정이 죽은 것이다', async () => {
    const db = createClient(URL_ as string, KEY as string, { auth: { persistSession: false } })

    const [dict, items, inv] = await Promise.all([
      db.from('shared_dictionary').select('*', { count: 'exact', head: true }),
      db.from('csat_dcp_items').select('*', { count: 'exact', head: true }),
      db.rpc('textbook_shelf_inventory'),
    ])

    // RPC 이름이 바뀌면 여기서 먼저 걸린다 — 화면이 조용해지기 전에.
    expect(inv.error, 'textbook_shelf_inventory() 를 못 읽었다').toBeNull()

    const stock = new Map<string, number>()
    for (const r of (inv.data ?? []) as { item_type: string; item_count: number }[]) {
      stock.set(r.item_type, (stock.get(r.item_type) ?? 0) + r.item_count)
    }

    let matched = 0
    for (const v of manifest.videos as Entry[]) {
      for (const e of v.evidence ?? []) {
        if (!/^[0-9][0-9,]*$/.test(e.value)) continue
        const code = v.id.startsWith('type-') ? v.id.slice(5).replace(/-/g, '_') : null
        const found = e.source.includes('shared_dictionary')
          ? dict.count
          : e.source.includes('csat_dcp_items')
            ? items.count
            : e.source.includes('textbook_shelf_inventory') && code
              ? (stock.get(code) ?? null)
              : null
        if (found !== null && found !== undefined) matched++
      }
    }

    // 실측 2026-09-13 — 39개 수치 근거 중 27개가 대조된다(나머지는 재계산 불가한 근거).
    // 이 수가 0 으로 떨어지면 출처 문자열이나 RPC 가 바뀐 것이다.
    expect(matched, '대조된 근거가 하나도 없다 — 낡음 판정이 조용히 죽었다').toBeGreaterThan(0)
  })

  it('manifest 의 모든 근거에 출처가 있다 — 출처 없는 수치는 대조도 못 한다', () => {
    for (const v of manifest.videos as Entry[]) {
      for (const e of v.evidence ?? []) {
        expect(e.source.trim(), `${v.id} · ${e.label}`).not.toBe('')
      }
    }
  })
})
