// apps/web/src/lib/csat/listening/fixtures/__tests__/fixtures.test.ts
// 픽스처가 원본 대본·감사(readiness.json)와 어긋나지 않는지, 계약 검증기의 발화·근거·음원 층을 통과하는지 본다.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { validateListeningItem } from '../../validate'
import type { ListeningItem } from '../../types'
import { TRACE_FIXTURES, traceFixtureByKey, type ListeningTraceFixture } from '..'

const ROOT = resolve(__dirname, '../../../../../../../../')
const source = JSON.parse(readFileSync(resolve(ROOT, 'scripts/csat/data/listening/2023.json'), 'utf8')) as { no: number; turns: { who: string; text: string }[] }[]
const readiness = JSON.parse(readFileSync(resolve(ROOT, 'docs/csat-listening/readiness.json'), 'utf8')) as {
  items: { id: string; answer: { value: number; formBinding: string }; transcript: { sha256: string; review: string }; choices: { present: boolean }; audio: { present: boolean } }[]
}

/** 선지 층만 비운 계약 모양 탐침 — 선지 관련 오류만 남아야 한다 */
function probe(fx: ListeningTraceFixture): ListeningItem {
  return {
    examId: fx.examId,
    itemNo: fx.itemNo,
    typeId: fx.typeId,
    stem: fx.stem,
    choices: [],
    answer: fx.officialAnswer?.choice ?? 1,
    speakers: fx.speakers,
    utterances: fx.utterances,
    evidence: fx.evidence,
    rationales: [],
    audio: fx.audio,
    provenance: fx.provenance,
    readiness: fx.readiness,
  }
}

describe.each(TRACE_FIXTURES.map((f) => [f.key, f] as const))('%s', (key, fx) => {
  const raw = source.find((s) => s.no === fx.itemNo)!
  const audit = readiness.items.find((i) => i.id === key)!

  it('발화가 원본 대본 턴과 글자 그대로 같다', () => {
    expect(fx.utterances.map((u) => ({ who: u.speaker, text: u.text }))).toEqual(raw.turns.map((t) => ({ who: t.who, text: t.text })))
  })

  it('감사 결과와 같다: 정답 번호 · 대본 해시 · 검수 상태 · 선지/음원 없음', () => {
    expect(fx.officialAnswer?.choice).toBe(audit.answer.value)
    expect(fx.officialAnswer?.formBinding).toBe(audit.answer.formBinding)
    expect(fx.provenance.sha256).toBe(audit.transcript.sha256)
    expect(fx.transcriptReview).toBe(audit.transcript.review)
    expect(audit.choices.present).toBe(false)
    expect(fx.choiceLayer.status).toBe('BLOCKED_EVIDENCE')
    expect(audit.audio.present).toBe(false)
    expect(fx.audio).toEqual({ kind: 'none', rights: 'unverified' })
  })

  it('계약 검증: 발화 · 근거 · 음원 층은 통과, 오류는 막아 둔 선지 층뿐', () => {
    const codes = validateListeningItem(probe(fx)).map((e) => e.code)
    expect(codes.filter((c) => c !== 'choices-count' && c !== 'rationale-correct-count')).toEqual([])
  })

  it('후보는 하나만 남고, 근거·발화 id 가 실재한다', () => {
    const ids = new Set(fx.utterances.map((u) => u.id))
    const ev = new Set(fx.evidence.map((e) => e.id))
    expect(fx.candidates.filter((c) => c.expected === 'remaining')).toHaveLength(1)
    for (const c of fx.candidates) {
      c.keyUtteranceIds.forEach((u) => expect(ids.has(u)).toBe(true))
      c.evidenceIds.forEach((e) => expect(ev.has(e)).toBe(true))
    }
  })
})

describe('표 행 재구성', () => {
  const fx = traceFixtureByKey('2023-L10')!
  it('합성 재구성으로 표시되고, 9번 발화 시점(조건 셋)에 두 행이 남는다', () => {
    expect(fx.candidatesSource).toBe('synthetic-reconstruction')
    const firstThree = new Set(['2023-L10-u4', '2023-L10-u6', '2023-L10-u8'])
    const left = fx.candidates.filter((c) => !(c.expected === 'eliminated' && c.keyUtteranceIds.some((u) => firstThree.has(u))))
    expect(left.map((c) => c.id)).toEqual(['D', 'E'])
  })
  it('이유 카드는 대본 유래', () => {
    expect(traceFixtureByKey('2023-L07')!.candidatesSource).toBe('transcript-derived')
    expect(traceFixtureByKey('nope')).toBeNull()
  })
})
