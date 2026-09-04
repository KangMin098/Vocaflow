// apps/web/src/lib/csat/__tests__/guide-source.integration.test.ts
//
// 가이드 원천 자료를 **실 DB 로** 한 번 만들어 보고 두 가지를 못 박는다.
//
//   ① **1000행 벽** — PostgREST 는 응답을 1000행에서 자르고 오류를 내지 않는다. 이 자료는
//      `csat_item_analyses` 2,234행을 읽으므로, 페이징이 빠지는 순간 어휘 빈도와 시간 합이
//      조용히 줄어든다. 실측 2026-09-05: 페이징 없이 읽던 콘솔이 「검수 통과 802」를 734 로
//      적고 있었고, 그 때문에 **이미 끝난 유형이 「남은 몫」 상단에 올라와** 있었다.
//   ② **저작권 경계** — 교재 원천으로 내보내는 자료에 평가원 지문이 섞이면 그 자료를 쓴
//      교재가 곧바로 문제를 안는다. 조회 컬럼에 `passage` 가 없다는 것을 결과로 확인한다.
//
// SERVICE_ROLE_KEY 없으면 자동 skip (CI).

import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import { loadCsatOverview } from '../client'
import { loadCsatGuideSource } from '../guide'
import { renderGuideMarkdown } from '../guide-fold'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const skip = !SUPABASE_URL || !SERVICE_KEY

describe.skipIf(skip)('기출 가이드 원천 자료 (실 DB)', () => {
  it('분석 전량을 읽는다 — 1000행에서 잘리면 안 된다', async () => {
    const svc = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })
    const truth = await svc
      .from('csat_item_analyses')
      .select('item_id', { count: 'exact', head: true })
      .eq('status', 'published')
    expect(truth.error).toBeNull()
    const publishedRows = truth.count ?? 0
    // 이 시험이 의미를 가지려면 자료가 실제로 벽을 넘어야 한다
    expect(publishedRows).toBeGreaterThan(1000)

    const { source, error } = await loadCsatGuideSource()
    expect(error).toBeNull()
    expect(source).not.toBeNull()

    const inScope = await svc
      .from('csat_items')
      .select('id', { count: 'exact', head: true })
      .eq('in_scope', true)
    // 문항마다 최신 버전 하나로 접으므로 analyzed ≤ 사정권 문항
    expect(source!.totals.items).toBe(inScope.count ?? 0)
    expect(source!.totals.analyzed).toBeGreaterThan(0)
    expect(source!.totals.analyzed).toBeLessThanOrEqual(source!.totals.items)
  })

  it('콘솔의 「검수 통과 문항」이 DB 실측과 같다 — 페이징이 빠지면 여기가 먼저 어긋난다', async () => {
    const svc = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })
    const { data, error } = await svc.rpc('csat_published_item_count')
    // 전용 RPC 가 없으므로 실패하면 직접 센다 (RPC 는 아직 만들지 않았다 — 마이그레이션 승인 사항)
    let expected: number
    if (error || typeof data !== 'number') {
      const rows: string[] = []
      for (let from = 0; ; from += 1000) {
        const page = await svc
          .from('csat_item_analyses')
          .select('item_id')
          .eq('status', 'published')
          .range(from, from + 999)
        if (page.error) throw new Error(page.error.message)
        const batch = (page.data ?? []) as { item_id: string }[]
        rows.push(...batch.map((r) => r.item_id))
        if (batch.length < 1000) break
      }
      expected = new Set(rows).size
    } else {
      expected = data
    }

    const overview = await loadCsatOverview()
    expect(overview.loadError).toBeNull()
    expect(overview.totals.published).toBe(expected)
  })

  it('유형별 함정 라벨을 실제로 줄인다 — 라벨 그대로는 교재 목차가 안 된다', async () => {
    const { source } = await loadCsatGuideSource()
    expect(source).not.toBeNull()
    expect(source!.totals.trapLabels).toBeGreaterThan(0)
    expect(source!.totals.trapFamilies).toBeLessThan(source!.totals.trapLabels)
    // 접힌 계열의 원 라벨은 보존된다 — 사람이 다시 판정할 수 있어야 한다
    const folded = source!.types.flatMap((t) => t.trap_families).filter((f) => f.labels.length > 1)
    expect(folded.length).toBeGreaterThan(0)
    for (const f of folded) expect(f.labels).toContain(f.key)
  })

  it('어휘 원천이 사전 등재 여부를 함께 싣는다 — 교재에 실을 뜻이 없는 낱말을 가려낸다', async () => {
    const { source } = await loadCsatGuideSource()
    expect(source!.totals.vocabLemmas).toBeGreaterThan(500)
    expect(source!.totals.vocabInDictionary).toBeGreaterThan(0)
    expect(source!.totals.vocabInDictionary).toBeLessThanOrEqual(source!.totals.vocabLemmas)
    expect(source!.vocab[0]!.items).toBeGreaterThanOrEqual(source!.vocab[source!.vocab.length - 1]!.items)
  })

  it('내보내는 Markdown 에 평가원 지문이 섞이지 않는다', async () => {
    const svc = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })
    const { source } = await loadCsatGuideSource()
    const md = renderGuideMarkdown(source!)

    // 실제 지문에서 뽑은 40자 창을 몇 개 가져와, 자료 어디에도 없는지 본다
    const items = await svc
      .from('csat_items')
      .select('passage')
      .not('passage', 'is', null)
      .eq('in_scope', true)
      .limit(25)
    const windows = ((items.data ?? []) as { passage: string }[])
      .map((r) => r.passage.replace(/\s+/g, ' ').trim().slice(60, 100))
      .filter((w) => w.length >= 40)
    expect(windows.length).toBeGreaterThan(5)
    for (const w of windows) expect(md).not.toContain(w)
  })
})
