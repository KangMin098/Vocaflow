// apps/web/src/lib/knowledge/__tests__/vertical-cohesion-link.test.ts
// Phase 3 두 번째 수직 경로 — 「앞 문장과 이어 주는 단서」 주석 · 채점(순수)
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { skeletonSig } from '../claim-support'
import { cohesionAnnotationFor, cohesionPanelProps, gradeCohesion, parseCohesionResponse } from '../cohesion-link'

const ann = cohesionAnnotationFor('2022#36')!

describe('응집 단서 주석 2022#36', () => {
  it('있고, 커밋된 골격과 문장 경계가 같다(서명)', () => {
    const sk = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/lib/csat/skeleton-data/2022.json'), 'utf8')) as { items: { id: string; sentences: { chars: number }[] }[] }
    const it = sk.items.find((i) => i.id === '2022#36')!
    expect(skeletonSig(it.sentences.map((s) => s.chars))).toBe(ann.skeletonSig)
    expect(it.sentences.length).toBe(ann.sentenceCount)
  })
  it('단서마다 정답 · 갈린 문장이 겹치지 않고 범위 안 · 단서 문장은 정답이 아니다', () => {
    for (const p of ann.probes) {
      expect(p.referent.length).toBeGreaterThan(0)
      for (const n of [...p.referent, ...p.disputed, p.cueSentence]) expect(n >= 0 && n < ann.sentenceCount).toBe(true)
      expect(p.referent.some((r) => p.disputed.includes(r))).toBe(false)
      expect(p.referent.includes(p.cueSentence)).toBe(false)
    }
    expect(ann.order.options[ann.order.answer]).toMatch(/\(B\).*\(A\).*\(C\)/)
  })
  it('지문 원문이 없다(문장 번호 · 짧은 한국어 단서 설명만)', () => {
    const raw = fs.readFileSync(path.join(process.cwd(), 'src/lib/knowledge/annotations/cohesion-link-2022-36.v1.json'), 'utf8')
    expect(raw).not.toMatch(/green taxes|market response|garbage/i)
  })
  it('화면 모양에는 정답이 없다', () => {
    const p = cohesionPanelProps(ann)
    expect(JSON.stringify(p)).not.toMatch(/referent|disputed|answer/)
  })
})

describe('채점', () => {
  const ok = { picks: { cue1: 3, cue2: 2 }, order: 1 }
  it('정답', () => expect(gradeCohesion(ann, parseCohesionResponse(ok, ann)!).isCorrect).toBe(true))
  it('갈린 문장(5번째)을 골라도 틀리지 않는다', () => expect(gradeCohesion(ann, parseCohesionResponse({ ...ok, picks: { cue1: 4, cue2: 2 } }, ann)!).isCorrect).toBe(true))
  it('단서마다 · 순서 따로 판정', () => {
    const g = gradeCohesion(ann, parseCohesionResponse({ picks: { cue1: 0, cue2: 2 }, order: 2 }, ann)!)
    expect(g.probes).toEqual({ cue1: false, cue2: true })
    expect(g.orderOk).toBe(false)
    expect(g.isCorrect).toBe(false)
  })
  it('입력 검증 — 빠진 단서 · 모르는 단서 · 범위 밖 · 순서 범위 밖은 거부', () => {
    expect(parseCohesionResponse({ picks: { cue1: 3 }, order: 1 }, ann)).toBeNull()
    expect(parseCohesionResponse({ picks: { cue1: 3, cue2: 2, cue9: 1 }, order: 1 }, ann)).toBeNull()
    expect(parseCohesionResponse({ picks: { cue1: 7, cue2: 2 }, order: 1 }, ann)).toBeNull()
    expect(parseCohesionResponse({ picks: { cue1: 3, cue2: 2 }, order: 5 }, ann)).toBeNull()
  })
})
