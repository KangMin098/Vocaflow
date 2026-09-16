// apps/web/src/lib/csat/__tests__/trap-drill-fresh.integration.test.ts
//
// **훈련이 가르치는 정답이 아직 분석과 같은가** — 실 DB 로 확인한다.
//
// ── 왜 필요한가 (구멍을 실제로 발견한 날: 2026-09-16) ─────────────────
// 오답 지도에는 낡음 가드가 있는데(`trap-atlas-fresh`) **훈련 풀에는 없었다.** 둘은 같은
// 원천(`csat_item_analyses.choice_analysis`)에서 구워지므로 지도가 낡으면 풀도 낡는다.
//
// 그리고 풀이 낡는 방식은 지도보다 나쁘다: 분석가가 어떤 선지의 함정 이름을 고치면
// **훈련은 옛 이름을 정답으로 채점한다.** 학습자는 맞게 고르고도 틀렸다는 말을 듣고,
// 그 기록이 `csat_trap_attempts` 에 쌓여 「내 약점」과 「주파 순서」까지 오염시킨다.
// 화면은 끝까지 멀쩡히 돈다.
//
// `trap-drill-pool.test.ts` 는 **풀 안의 정합**(정답이 보기에 있나·자리가 쏠리나)만 본다.
// 여기서는 **바깥과의 정합**을 본다: 구운 카드의 정답이 지금 DB 의 최신 분석과 같은가.
//
// SERVICE_ROLE_KEY 없으면 자동 skip (CI).

import fs from 'node:fs'
import path from 'node:path'

import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import type { DrillCard } from '../trap-drill'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const skip = !SUPABASE_URL || !SERVICE_KEY

const POOL = path.join(process.cwd(), 'src/lib/csat/drill-data/pool.json')

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

describe.skipIf(skip)('구운 훈련 풀이 분석과 맞는가 (실 DB)', () => {
  it('모든 카드의 정답이 지금 DB 의 최신 분석과 같다', async () => {
    const pool = JSON.parse(fs.readFileSync(POOL, 'utf8')) as { built_at: string; cards: DrillCard[] }
    expect(pool.cards.length, '풀이 비었다').toBeGreaterThan(200)

    const db = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })
    const analyses = await page<{ item_id: string; version: number; choice_analysis: unknown }>((from, to) =>
      db
        .from('csat_item_analyses')
        .select('item_id, version, choice_analysis')
        .eq('status', 'published')
        .range(from, to),
    )

    // 문항마다 최신 버전 하나 — 굽는 쪽과 **같은 규칙**이라야 견줄 수 있다.
    const latest = new Map<string, { version: number; choice_analysis: unknown }>()
    for (const a of analyses) {
      const prev = latest.get(a.item_id)
      if (!prev || a.version > prev.version) latest.set(a.item_id, a)
    }

    // (item_id, 선지번호) → 지금의 함정 이름
    const now = new Map<string, string>()
    for (const [itemId, a] of latest) {
      for (const ch of Array.isArray(a.choice_analysis) ? a.choice_analysis : []) {
        const c = ch as { n?: unknown; trap?: unknown }
        const trap = typeof c.trap === 'string' ? c.trap.trim() : ''
        if (trap) now.set(`${itemId}:${Number(c.n) || 0}`, trap)
      }
    }

    const stale = `구운 풀이 낡았다 (${pool.built_at} 에 구움) — node scripts/csat/build-trap-drill.mjs --write`
    const drifted: string[] = []
    const gone: string[] = []
    for (const c of pool.cards) {
      const key = `${c.item_id}:${c.choice}`
      const cur = now.get(key)
      if (cur === undefined) gone.push(key)
      else if (cur !== c.answer) drifted.push(`${key} ${c.answer} → ${cur}`)
    }

    // **이름이 바뀐 카드가 하나라도 있으면 훈련이 틀린 답으로 채점한다.**
    expect(drifted.slice(0, 10), stale).toEqual([])
    // 사라진 선지 — 분석이 통째로 바뀌었거나 문항이 빠진 것이다.
    expect(gone.slice(0, 10), stale).toEqual([])
  }, 120_000)
})
