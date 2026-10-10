// apps/web/src/lib/knowledge/__tests__/anchor-source.test.ts
// 원문 결속 관문(계약 B · MC-06) — 변이 테스트: 원문을 하나씩 바꿔 보고 과제가 닫히는지(자동 승격 · 자동 재배치 없음)
import crypto from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { NORMALIZATION_VERSION, sourceHash, textHash } from '@/lib/csat/map/evidence-anchor'
import { splitSentences } from '@/lib/csat/passage-skeleton'

import { SEGMENTATION_VERSION, checkBinding, type AnchorBinding } from '../anchor-source'
import { CURATED } from '../evidence-locate'

const S = ['Cats sleep a lot during the day.', 'They hunt at night when it is quiet.', 'This habit comes from their wild ancestors.', 'Owners often misread it as laziness.', 'In fact, it saves energy for the hunt.']
const passage = S.join(' ')
const rev = (p: string) => crypto.createHash('sha256').update(p).digest('hex')

/** anchor-bind 스크립트와 같은 방법으로 결속을 만든다 */
function bind(p: string, evidence: number[], disputed: number[] = []): AnchorBinding {
  const ranges = splitSentences(p)
  const sentences = ranges.map((r) => p.slice(r.start, r.end))
  const unit = (index: number) => ({ index, textHash: textHash(sentences[index]), charRange: { start: ranges[index].start, end: ranges[index].end } })
  return { evidence, disputed, source: { revision: rev(p), textHash: sourceHash(sentences), normalization: NORMALIZATION_VERSION, segmentation: SEGMENTATION_VERSION }, anchors: { evidence: evidence.map(unit), disputed: disputed.map(unit) } }
}
const b = bind(passage, [4], [2])
const check = (p: string, binding = b) => checkBinding(binding, 'X#31', p, rev(p))

describe('원문 결속 — 그대로면 연다', () => {
  it('같은 원문 → ok', () => expect(check(passage)).toEqual({ ok: true }))
})

describe('변이 — 하나라도 바뀌면 닫는다', () => {
  it('근거 문장 낱말 하나 변경 → stale(text_missing)', () => {
    expect(check(passage.replace('saves energy', 'wastes energy'))).toMatchObject({ ok: false, reason: 'anchor', status: 'stale' })
  })
  it('근거가 아닌 문장 변경 → 문맥 변경(context_changed) — 근거 문장이 그대로여도 재검토 전에는 닫는다', () => {
    expect(check(passage.replace('Owners often', 'Many owners'))).toMatchObject({ ok: false, reason: 'anchor', status: 'context_changed' })
  })
  it('문장 앞에 하나 추가(근거 위치 이동) → relocated — 새 위치로 자동 승격하지 않는다', () => {
    expect(check(`Here is a note. ${passage}`)).toMatchObject({ ok: false, reason: 'anchor', status: 'relocated', index: 4 }) // 결속된 번호(4)를 알린다 — 새 위치(5)로 옮기지 않는다
  })
  it('근거 문장이 두 번 나오면 → ambiguous(보류)', () => {
    expect(check(`${passage} ${S[4]}`)).toMatchObject({ ok: false, reason: 'anchor', status: 'ambiguous' })
  })
  it('따옴표 · 공백만 다르면 같은 문장(정규화 v1) — 그래도 원문 revision 이 바뀌어 재검토', () => {
    expect(check(passage.replace('during the day.', 'during the  day.'))).toMatchObject({ ok: false, status: 'context_changed' })
  })
  it('결속이 없으면(경계 서명만) 닫는다 — boundary_only 는 원문 검증이 아니다', () => {
    expect(check(passage, { evidence: [4], disputed: [] })).toEqual({ ok: false, reason: 'unbound' })
  })
  it('주석 번호를 바꾸고 재결속하지 않으면 닫는다', () => {
    expect(check(passage, { ...b, evidence: [3] })).toEqual({ ok: false, reason: 'index_mismatch' })
  })
  it('분할 규칙 버전이 다르면 stale', () => {
    expect(check(passage, { ...b, source: { ...b.source!, segmentation: 'old-split' } })).toMatchObject({ ok: false, status: 'stale' })
  })
  it('정규화 버전이 다르면 stale', () => {
    expect(check(passage, { ...b, source: { ...b.source!, normalization: 'anchor-norm-0' } })).toMatchObject({ ok: false, status: 'stale' })
  })
  it('갈린 문장(disputed)도 같은 규칙 — 갈린 문장만 바뀌어도 닫는다(근거 문장은 그대로)', () => {
    const onlyDisputed = bind(passage, [], [2])
    expect(check(passage.replace('wild ancestors', 'tame ancestors'), onlyDisputed)).toMatchObject({ ok: false, status: 'stale' })
    expect(check(passage.replace('wild ancestors', 'tame ancestors'))).toMatchObject({ ok: false })
  })
})

describe('커밋된 합의 주석', () => {
  it('11문항 모두 결속돼 있고 원문 · 근거는 해시 · 위치만(원문 복제 없음)', () => {
    const items = Object.values(CURATED) as (AnchorBinding & { key: string })[]
    expect(items.length).toBe(11)
    for (const it of items) {
      expect(it.source?.revision).toMatch(/^[0-9a-f]{64}$/)
      expect(it.anchors?.evidence.map((u) => u.index)).toEqual(it.evidence)
      expect(it.anchors?.disputed.map((u) => u.index)).toEqual(it.disputed)
    }
  })
})
