// apps/web/src/lib/csat/__tests__/trap-atlas-fresh.integration.test.ts
//
// **구운 오답 지도가 DB 와 어긋나지 않았는지** 실 DB 로 확인한다.
//
// ── 왜 필요한가 ───────────────────────────────────────────────────────
// `trap-atlas.json` 은 빌드 산출물이다. 분석이 늘거나 고쳐지면 다시 구워야 하는데,
// **안 구워도 화면은 멀쩡히 뜬다.** 막대도 그려지고 수치도 찍힌다 — 다만 **낡은 값**이다.
// 그 상태로 「아홉 가지가 60%」라고 적으면 학습자가 검증할 수 없는 주장이 되고,
// 그건 이 재설계가 없애려던 바로 그것이다.
//
// 그래서 여기서 **셈을 다시 해서** 구운 값과 견준다. 굽는 스크립트를 부르지 않는다 —
// 그러면 「스크립트가 자기 자신과 같은가」를 묻는 셈이라 아무것도 안 지킨다. 집계 규칙을
// 여기 **다시 적어** 두 길이 같은 답을 내는지 본다.
//
// ⚠️ 규칙 하나가 결정적이다: **문항마다 최신 버전 하나만** 센다. 안 접으면 같은 오답이
//    버전 수만큼 세어져 3,208 이 11,788 이 된다(실측). 굽는 쪽과 여기가 **둘 다** 접어야 한다.
//
// SERVICE_ROLE_KEY 없으면 자동 skip (CI).

import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import { BUILT_AT, CORPUS, TRAPS } from '../trap-atlas'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const skip = !SUPABASE_URL || !SERVICE_KEY

/** PostgREST 는 1,000행에서 조용히 끊는다 — 세는 조회는 반드시 페이징한다. */
async function page<T>(
  run: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const SIZE = 1000
  const out: T[] = []
  for (let from = 0; ; from += SIZE) {
    const { data, error } = await run(from, from + SIZE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < SIZE) break
  }
  return out
}

describe.skipIf(skip)('구운 오답 지도가 DB 와 맞는가 (실 DB)', () => {
  it('오답 선지 수·유형별 분포가 지금 DB 와 같다', async () => {
    const db = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })

    const items = await page<{ id: string; type_id: string | null }>((from, to) =>
      db.from('csat_items').select('id, type_id').eq('in_scope', true).range(from, to),
    )
    const analyses = await page<{ item_id: string; version: number; choice_analysis: unknown }>((from, to) =>
      db.from('csat_item_analyses').select('item_id, version, choice_analysis').eq('status', 'published').range(from, to),
    )

    // **문항마다 최신 버전 하나.** 이 한 줄이 빠지면 아래 수가 세 배가 된다.
    const latest = new Map<string, { version: number; choice_analysis: unknown }>()
    for (const a of analyses) {
      const prev = latest.get(a.item_id)
      if (!prev || a.version > prev.version) latest.set(a.item_id, a)
    }

    const typeOf = new Map(items.map((i) => [i.id, i.type_id]))
    let distractors = 0
    const byTrap = new Map<string, number>()
    for (const [itemId, a] of latest) {
      if (!typeOf.get(itemId)) continue
      for (const ch of Array.isArray(a.choice_analysis) ? a.choice_analysis : []) {
        const trap = typeof (ch as { trap?: unknown }).trap === 'string' ? String((ch as { trap: string }).trap).trim() : ''
        if (!trap) continue
        distractors += 1
        byTrap.set(trap, (byTrap.get(trap) ?? 0) + 1)
      }
    }

    const stale = `구운 지도가 낡았다 (${BUILT_AT} 에 구움) — node scripts/csat/build-trap-atlas.mjs --write`
    expect(CORPUS.distractors, stale).toBe(distractors)
    expect(CORPUS.analyzed, stale).toBe(latest.size)
    expect(CORPUS.distinct_traps, stale).toBe(byTrap.size)

    // 이름 붙은 함정마다 개수가 같은가 — 총계만 맞고 분포가 어긋나는 경우를 잡는다.
    for (const t of TRAPS) {
      expect(`${t.key}:${byTrap.get(t.key) ?? 0}`, stale).toBe(`${t.key}:${t.n}`)
    }
  }, 120_000)
})
