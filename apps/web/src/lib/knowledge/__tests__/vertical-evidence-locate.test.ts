// apps/web/src/lib/knowledge/__tests__/vertical-evidence-locate.test.ts
// E축 확인 과제 — 합의 주석(골격 앵커 · 역할 학습자 · 판정자 B) · 채점(순수) · 커밋된 주석이 지금 골격과 맞는지
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { skeletonSig } from '../claim-support'
import { CURATED, EVIDENCE_TASK_TYPES, MAX_EVIDENCE, deriveEvidenceAnnotation, type CuratedEvidence, evidencePanelProps, gradeEvidence, parseEvidenceResponse, type SkeletonLike } from '../evidence-locate'

const DIR = path.join(process.cwd(), 'src/lib/csat/skeleton-data')
const all: SkeletonLike[] = fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'index.json')
  .flatMap((f) => (JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) as { items: SkeletonLike[] }).items)

const sk = (over: Partial<SkeletonLike> = {}): SkeletonLike => ({
  id: 'X#31', type_id: 'R-BLANK', sentences: [{ chars: 10 }, { chars: 20 }, { chars: 30 }, { chars: 40 }, { chars: 50 }],
  anchors: [{ id: 'answer', sentences: [2] }, { id: 'reject:1', sentences: [3], lure: true }, { id: 'reject:2', sentences: [2], lure: true }, { id: 'reject:3', sentences: [4] }],
  ...over,
})

const SIG = skeletonSig([10, 20, 30, 40, 50])
const table = (over: Partial<CuratedEvidence> = {}): Record<string, CuratedEvidence> => ({ 'X#31': { key: 'evidence-locate', skeletonSig: SIG, sentenceCount: 5, blank: 4, evidence: [2], disputed: [1], ...over } })

describe('합의 주석', () => {
  it('근거 · 갈린 문장은 합의 주석 · 함정 = lure 앵커(근거 · 갈린 문장 제외) · 서명은 골격 문장 길이', () => {
    const a = deriveEvidenceAnnotation('evidence-locate', sk(), table())!
    expect(a).toMatchObject({ key: 'evidence-locate', itemId: 'X#31', sentenceCount: 5, evidence: [2], disputed: [1], blank: 4, lures: [3] })
    expect(a.skeletonSig).toBe(SIG)
  })
  it('골격 answer 앵커만으로는 만들지 않는다(빈칸 문장을 가리킨 사례) · 빈칸 문장은 근거에서 뺀다', () => {
    expect(deriveEvidenceAnnotation('evidence-locate', sk(), {})).toBeNull()
    expect(deriveEvidenceAnnotation('evidence-locate', sk(), table({ evidence: [4] }))).toBeNull()
  })
  it('유형 · 과제 키 · 서명 · 문장 수가 다르거나 근거가 너무 많으면 만들지 않는다', () => {
    expect(deriveEvidenceAnnotation('option-restate', sk(), table())).toBeNull()
    expect(deriveEvidenceAnnotation('evidence-locate', sk(), table({ key: 'option-restate' }))).toBeNull()
    expect(deriveEvidenceAnnotation('evidence-locate', sk(), table({ skeletonSig: 'x' }))).toBeNull()
    expect(deriveEvidenceAnnotation('evidence-locate', sk({ sentences: [{ chars: 1 }, { chars: 2 }, { chars: 3 }] }), table())).toBeNull()
    expect(deriveEvidenceAnnotation('evidence-locate', sk(), table({ evidence: [0, 1, 2] }))).toBeNull()
    expect(deriveEvidenceAnnotation('evidence-locate', null, table())).toBeNull()
  })
  it('화면 모양에 근거 · 함정 위치가 없다', () => {
    const p = evidencePanelProps(deriveEvidenceAnnotation('evidence-locate', sk(), table())!)
    expect(p).toEqual({ taskKey: 'evidence-locate', sentenceCount: 5 })
  })
})

describe('채점', () => {
  const a = deriveEvidenceAnnotation('evidence-locate', sk(), table())!
  it('입력 검증 — 범위 밖 · 정수 아님 · 다른 키는 거부', () => {
    expect(parseEvidenceResponse({ pick: 2 }, a)).toEqual({ pick: 2 })
    expect(parseEvidenceResponse({ pick: 5 }, a)).toBeNull()
    expect(parseEvidenceResponse({ pick: 1.5 }, a)).toBeNull()
    expect(parseEvidenceResponse({ pick: 1, extra: true }, a)).toBeNull()
    expect(parseEvidenceResponse(null, a)).toBeNull()
  })
  it('근거 문장이면 정답 · 함정 문장이면 함정 표시', () => {
    expect(gradeEvidence(a, { pick: 2 })).toEqual({ evidenceOk: true, lurePicked: false, isCorrect: true })
    expect(gradeEvidence(a, { pick: 3 })).toEqual({ evidenceOk: false, lurePicked: true, isCorrect: false })
    expect(gradeEvidence(a, { pick: 0 })).toEqual({ evidenceOk: false, lurePicked: false, isCorrect: false })
    expect(gradeEvidence(a, { pick: 1 }).isCorrect).toBe(true) // 갈린 문장은 틀리지 않는다
    expect(gradeEvidence(a, { pick: 4 }).isCorrect).toBe(false) // 빈칸 문장 자체는 근거가 아니다
  })
})

describe('커밋된 합의 주석', () => {
  it('모든 합의 주석이 지금 골격과 서명이 같고 살아 있다 · 근거에 빈칸 문장이 없다', () => {
    const byId = new Map(all.map((i) => [i.id, i]))
    for (const [id, c] of Object.entries(CURATED)) {
      const a = deriveEvidenceAnnotation(c.key as 'option-restate' | 'evidence-locate', byId.get(id) ?? null)
      expect(a, id).not.toBeNull()
      if (c.blank !== null) expect(a!.evidence.includes(c.blank)).toBe(false)
    }
    expect(CURATED['2026#32'].evidence).not.toContain(CURATED['2026#32'].blank)
  })
  it('지문 원문이 없다(문장 번호만)', () => {
    const raw = fs.readFileSync(path.join(process.cwd(), 'src/lib/knowledge/annotations/evidence-tasks.v1.json'), 'utf8')
    expect(raw).not.toMatch(/[A-Za-z]{4,} [A-Za-z]{4,} [A-Za-z]{4,}/)
  })

  it('과제마다 확인 문항 · CHECK 문항이 충분하다(직접 확인 2 + 다시 확인 2 이상)', () => {
    for (const key of Object.keys(EVIDENCE_TASK_TYPES) as (keyof typeof EVIDENCE_TASK_TYPES)[]) {
      const ok = all.map((i) => deriveEvidenceAnnotation(key, i)).filter(Boolean)
      expect(ok.length).toBeGreaterThanOrEqual(4)
      for (const a of ok) {
        expect(a!.evidence.length).toBeLessThanOrEqual(MAX_EVIDENCE)
        expect(a!.lures.some((l) => a!.evidence.includes(l))).toBe(false)
      }
    }
  })
})
