// apps/web/src/lib/csat/__tests__/report-markup.integration.test.ts
//
// **실제 26개 유형 리포트로 파서를 돌려 본다.**
//
// 합성 사례에서 글자를 안 잃는 것과 **실제 산문**에서 안 잃는 것은 다르다. 이 글들은
// 사람이 아니라 드레인이 쓴 것이라 모양이 제각각이고(별표 짝이 안 맞거나, 문단이 한 줄이거나,
// 인용이 괄호 안에 박히거나), 파서가 한 조각을 떨어뜨려도 **화면은 멀쩡히 돈다.**
// 그 문장은 그냥 영영 안 보인다 — 이 저장소가 가장 경계하는 종류의 실패다.
//
// 링크 수도 함께 센다. 0 이면 배선이 끊긴 것이고, 그것도 화면은 멀쩡해 보인다.
//
// SERVICE_ROLE_KEY 없으면 자동 skip (CI).

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

import { parseReportText, type Block } from '../report-markup'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const skip = !SUPABASE_URL || !SERVICE_KEY

interface Report {
  type_id: string
  answer_locus_pattern: string | null
  procedure_steps: { step?: string; on_fail?: string }[] | null
  recurring_traps: { trap?: string; signature?: string }[] | null
  failure_modes: string[] | null
}

const flatten = (blocks: Block[]): string =>
  blocks.map((b) => b.segments.map((s) => s.text).join('')).join('\n\n')

/** 파서가 «지워도 되는 것» — 별표 표시와 문단 사이 공백뿐이다. */
const normalize = (s: string): string =>
  s
    .replace(/\*\*/g, '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .join('\n\n')

describe.skipIf(skip)('유형 리포트 파서 — 실제 26개 (실 DB)', () => {
  let reports: Report[] = []
  let known: Set<string> = new Set()

  beforeAll(async () => {
    const svc: SupabaseClient = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { persistSession: false },
    })
    const { data, error } = await svc
      .from('csat_type_reports')
      .select('type_id, answer_locus_pattern, procedure_steps, recurring_traps, failure_modes')
    if (error) throw new Error(`리포트 조회 실패: ${error.message}`)
    reports = (data ?? []) as Report[]

    // 화면은 그 유형의 문항만 넘기지만, 여기서는 «파서가 링크를 만들 수 있는가» 를 보므로
    // 전체 문항 id 를 쓴다. 페이지 쪽 제한은 page.tsx 가 knownItems 로 따로 건다.
    const ids: string[] = []
    for (let from = 0; ; from += 1000) {
      const { data: page, error: e2 } = await svc
        .from('csat_items')
        .select('id')
        .order('id')
        .range(from, from + 999)
      if (e2) throw new Error(`문항 조회 실패: ${e2.message}`)
      ids.push(...(page ?? []).map((r) => (r as { id: string }).id))
      if (!page || page.length < 1000) break
    }
    known = new Set(ids)
  })

  it('리포트가 실제로 있다 — 없으면 아래 단언이 아무것도 안 지킨다', () => {
    expect(reports.length).toBeGreaterThan(0)
    expect(known.size).toBeGreaterThan(0)
  })

  it('어느 필드에서도 글자를 잃지 않는다', () => {
    const lost: string[] = []
    for (const r of reports) {
      const fields: [string, string | null | undefined][] = [
        [`${r.type_id}.answer_locus_pattern`, r.answer_locus_pattern],
        ...(r.procedure_steps ?? []).flatMap((s, i): [string, string | null | undefined][] => [
          [`${r.type_id}.procedure[${i}].step`, s.step],
          [`${r.type_id}.procedure[${i}].on_fail`, s.on_fail],
        ]),
        ...(r.recurring_traps ?? []).map((t, i): [string, string | null | undefined] => [
          `${r.type_id}.traps[${i}].signature`,
          t.signature,
        ]),
        ...(r.failure_modes ?? []).map((m, i): [string, string | null | undefined] => [
          `${r.type_id}.failure[${i}]`,
          m,
        ]),
      ]
      for (const [label, text] of fields) {
        if (!text) continue
        const got = flatten(parseReportText(text, known))
        if (got !== normalize(text)) lost.push(`${label}: ${text.length}자 → ${got.length}자`)
      }
    }
    expect(lost, `파서가 글자를 잃었다:\n  ${lost.slice(0, 5).join('\n  ')}`).toHaveLength(0)
  })

  it('문항 인용이 실제로 링크가 된다 — 0 이면 배선이 끊긴 것이다', () => {
    let links = 0
    let typesWithLinks = 0
    for (const r of reports) {
      const texts = [
        r.answer_locus_pattern ?? '',
        ...(r.procedure_steps ?? []).flatMap((s) => [s.step ?? '', s.on_fail ?? '']),
        ...(r.recurring_traps ?? []).map((t) => t.signature ?? ''),
        ...(r.failure_modes ?? []),
      ]
      const n = texts.reduce(
        (a, t) =>
          a + parseReportText(t, known).flatMap((b) => b.segments).filter((s) => s.kind === 'item').length,
        0,
      )
      links += n
      if (n > 0) typesWithLinks += 1
    }
    // 실측 2026-09-15: 리포트 전체 인용 1,182개(근거 474 · 함정 230 · 미끄러짐 472 · 절차 6).
    // 그중 실재하는 문항만 링크가 된다. 바닥은 «한참 밑» 에 둔다 — 정확한 수를 박으면
    // 드레인이 글을 고칠 때마다 이 검사가 깨진다. 여기서 막으려는 것은 **0** 이다.
    expect(links).toBeGreaterThan(800)
    expect(typesWithLinks).toBeGreaterThan(15)
  })

  it('가장 긴 문단이 원문 덩어리보다 훨씬 짧다 — 나열을 쪼갠 것이 목적이다', () => {
    let worstRaw = 0
    let worstBlock = 0
    for (const r of reports) {
      const t = r.answer_locus_pattern
      if (!t) continue
      worstRaw = Math.max(worstRaw, t.length)
      for (const b of parseReportText(t, known)) {
        worstBlock = Math.max(worstBlock, b.segments.reduce((a, s) => a + s.text.length, 0))
      }
    }
    // 실측: 원문 최대 5,931자 → 문단으로 쪼개면 최대 1,000자 안쪽.
    expect(worstRaw).toBeGreaterThan(3000)
    expect(worstBlock).toBeLessThan(worstRaw / 2)
  })
})
