// apps/web/src/lib/csat/__tests__/choice-polarity-fresh.integration.test.ts
//
// **구운 긍정형 발문 목록이 DB 와 어긋나지 않았는지** 실 DB 로 확인한다.
//
// `choice-polarity.json` 은 빌드 산출물이다(`node scripts/csat/build-choice-polarity.mjs --write`). 문항이 늘거나 발문이
// 고쳐졌는데 다시 굽지 않으면, 「일치하는 것은?」 문항의 틀린 오답이 화면에 「내용은 맞음」으로 나온다 — 학습자에게 거짓을 가르친다.
// 판정 함수는 드레인과 같은 `stemPositive` 를 불러 쓴다(규칙 자체의 회귀는 scripts/csat/__tests__/analysis-rules.test.mjs).
//
// SERVICE_ROLE_KEY 없으면 자동 skip (CI).

import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import polarity from '../choice-polarity.json'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const skip = !SUPABASE_URL || !SERVICE_KEY

describe.skipIf(skip)('구운 긍정형 발문 목록이 DB 와 맞는가 (실 DB)', () => {
  it('선택≠참거짓 유형의 긍정형 발문 문항 id 가 지금 DB 와 같다', async () => {
    const { CHOICE_TRUTH_TYPES, stemPositive } = await import('../../../../../../scripts/csat/lib-analysis-rules.mjs')
    const db = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })
    const rows: { id: string; stem: string | null }[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db
        .from('csat_items')
        .select('id, stem')
        .eq('in_scope', true)
        .in('type_id', [...(CHOICE_TRUTH_TYPES as Set<string>)])
        .order('id')
        .range(from, from + 999)
      if (error) throw new Error(error.message)
      rows.push(...(data ?? []))
      if ((data ?? []).length < 1000) break
    }
    const positive = rows.filter((r) => stemPositive(r.stem)).map((r) => r.id).sort()
    expect(polarity.positive, '목록이 낡았다 — node scripts/csat/build-choice-polarity.mjs --write').toEqual(positive)
  }, 120_000)
})
