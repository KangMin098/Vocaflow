// apps/web/src/lib/csat/inquiry/__tests__/data.test.ts
//
// 탐구 데이터는 분석 버전에 묶인다 — 버전이 다르면 stale(보이지 않음) · 없으면 missing
import { describe, expect, it } from 'vitest'

import data from '../../inquiry-data.json'
import { lookupInquiry } from '../data'

const items = (data as { items: Record<string, { analysis_version: number }> }).items
const [someId, rec] = Object.entries(items)[0] ?? []

describe('탐구 데이터 조회', () => {
  it('없는 문항은 missing', () => {
    expect(lookupInquiry('9999#99', 1).state).toBe('missing')
  })
  it.runIf(Boolean(someId))('같은 버전이면 ready, 다르거나 모르면 stale', () => {
    expect(lookupInquiry(someId!, rec!.analysis_version).state).toBe('ready')
    expect(lookupInquiry(someId!, rec!.analysis_version + 1).state).toBe('stale')
    expect(lookupInquiry(someId!, null).state).toBe('stale')
  })
  it('정적 정본에 원문(지문 · 발문 · 선지 문장)이 없다 — v3 의 choices 는 판정 객체, sentences 는 근거 번호다', () => {
    const raw = JSON.stringify(data)
    expect(raw).not.toMatch(/"(passage|stem)"\s*:/)
    const items = (data as { items: Record<string, { v3?: { choices: unknown[]; meanings: { sentences: unknown[] }[] } }> }).items
    for (const r of Object.values(items)) {
      if (!r.v3) continue
      for (const c of r.v3.choices) expect(typeof c).toBe('object')
      for (const m of r.v3.meanings) for (const n of m.sentences) expect(typeof n).toBe('number')
    }
  })
})

describe('번들 가드', () => {
  it("클라이언트 컴포넌트는 정적 정본(data.ts → inquiry-data.json)을 import 하지 않는다 — 라벨은 labels.ts", async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const dir = path.resolve(__dirname, '../../../../components/csat/theater')
    for (const f of fs.readdirSync(dir).filter((f: string) => f.endsWith('.tsx'))) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8')
      if (src.includes("'use client'")) expect(src, f).not.toMatch(/inquiry\/data'|inquiry-data\.json/)
    }
  })
})
