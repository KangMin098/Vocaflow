// apps/web/src/lib/csat/listening/__tests__/listening.test.ts
import { describe, expect, it } from 'vitest'

import {
  LISTENING_TYPE_IDS,
  LISTENING_TYPE_LABELS,
  canTransition,
  effectiveLevel,
  exposureView,
  isAudioPlayable,
  validateListeningItem,
  type ListeningItem,
} from '..'

const base = (): ListeningItem => ({
  examId: '2023',
  itemNo: 1,
  typeId: 'L-PURPOSE',
  stem: '다음을 듣고, 남자가 하는 말의 목적으로 가장 적절한 것을 고르시오.',
  choices: ['a', 'b', 'c', 'd', 'e'],
  answer: 3,
  speakers: ['M', 'W'],
  utterances: [
    { id: 'u1', speaker: 'M', text: 'Registration ends this Friday.', startMs: 0, endMs: 2000 },
    { id: 'u2', speaker: 'W', text: 'Really? I will apply.', startMs: 2100, endMs: 3500 },
  ],
  evidence: [
    { id: 'e1', utteranceId: 'u1', charStart: 0, charEnd: 12, role: 'decisive', supportsChoice: 3, refutesChoices: [1] },
  ],
  rationales: [
    { choice: 1, verdict: 'contradicted', evidenceIds: ['e1'] },
    { choice: 2, verdict: 'not-mentioned', evidenceIds: [] },
    { choice: 3, verdict: 'correct', evidenceIds: ['e1'] },
    { choice: 4, verdict: 'partial-match', evidenceIds: [] },
    { choice: 5, verdict: 'reversed-role', evidenceIds: [] },
  ],
  audio: { kind: 'none', rights: 'unverified' },
  provenance: { transcriptSource: 'kice-official-script', sha256: 'x'.repeat(64), reviewStatus: 'draft' },
  readiness: 'server-db-unverified',
})

const codes = (i: ListeningItem) => validateListeningItem(i).map((e) => e.code)

describe('types', () => {
  it('18 types with labels', () => {
    expect(LISTENING_TYPE_IDS).toHaveLength(18)
    for (const t of LISTENING_TYPE_IDS) expect(LISTENING_TYPE_LABELS[t]).toBeTruthy()
  })
})

describe('validateListeningItem', () => {
  it('valid item passes', () => expect(codes(base())).toEqual([]))

  it('exam id via exam-id.ts', () => {
    const i = base(); i.examId = 'X99'
    expect(codes(i)).toContain('exam-id-invalid')
    i.examId = 'H2503G1'
    expect(codes(i)).toEqual([])
  })

  it('span out of bounds', () => {
    const i = base(); i.evidence[0]!.charEnd = 999
    expect(codes(i)).toContain('evidence-span-out-of-bounds')
  })

  it('timing overlap / non-monotone / invalid', () => {
    const i = base(); i.utterances[1]!.startMs = 1500
    expect(codes(i)).toContain('utterance-timing-overlap')
    const j = base(); j.utterances[1] = { ...j.utterances[1]!, startMs: -1 + 0, endMs: 0 }
    expect(codes(j)).toContain('utterance-timing-invalid')
    const k = base(); k.utterances[0] = { ...k.utterances[0]!, startMs: 5000, endMs: 6000 }
    expect(codes(k)).toContain('utterance-timing-not-monotone')
  })

  it('missing references', () => {
    const i = base(); i.evidence[0]!.utteranceId = 'zz'; i.rationales[1]!.evidenceIds = ['nope']
    expect(codes(i)).toEqual(expect.arrayContaining(['evidence-utterance-missing', 'rationale-evidence-missing']))
  })

  it('exactly one correct matching answer', () => {
    const i = base(); i.rationales[0]!.verdict = 'correct'
    expect(codes(i)).toContain('rationale-correct-count')
    const j = base(); j.answer = 2
    expect(codes(j)).toContain('rationale-correct-mismatch')
  })

  it('synthetic never official; official playable only when verified', () => {
    const i = base(); i.audio = { kind: 'official', url: '/fixtures/synthetic-tts.mp3', rights: 'verified' }
    expect(codes(i)).toContain('audio-synthetic-labelled-official')
    expect(isAudioPlayable(i.audio)).toBe(false)
    expect(isAudioPlayable({ kind: 'official', url: 'https://x/a.mp3', rights: 'unverified' })).toBe(false)
    expect(isAudioPlayable({ kind: 'official', url: 'https://x/a.mp3', rights: 'verified' })).toBe(true)
    expect(isAudioPlayable({ kind: 'synthetic-test-fixture', url: '/f.mp3', rights: 'not-redistributable' })).toBe(true)
    expect(isAudioPlayable({ kind: 'none', rights: 'unverified' })).toBe(false)
  })
})

describe('exposure', () => {
  const open = { submitted: true, reveal: 'open' as const }
  it('answer hidden until submit and gate open', () => {
    expect(exposureView('L5', { submitted: false, reveal: 'open' }).answer).toBe(false)
    expect(exposureView('L5', { submitted: true, reveal: 'embargo' }).answer).toBe(false)
    expect(exposureView('L5', { submitted: true, reveal: 'failure' }).rationales).toBe(false)
    expect(exposureView('L5', { submitted: true, reveal: null }).choiceLinks).toBe(false)
    expect(exposureView('L5', open).answer).toBe(true)
    expect(effectiveLevel('L5', { submitted: false, reveal: 'open' })).toBe('L3')
  })
  it('layers per level', () => {
    expect(exposureView('L0', open)).toMatchObject({ audio: true, transcript: false })
    expect(exposureView('L1', open)).toMatchObject({ transcript: true, speakerStructure: false })
    expect(exposureView('L3', open)).toMatchObject({ evidenceHighlights: true, choiceLinks: false })
    expect(exposureView('L4', open)).toMatchObject({ rationales: true, answer: false })
  })
  it('transitions', () => {
    expect(canTransition('L0', 'L1', { submitted: false, reveal: null })).toEqual({ ok: true, to: 'L1' })
    expect(canTransition('L0', 'L2', open)).toEqual({ ok: false, reason: 'skip' })
    expect(canTransition('L3', 'L4', { submitted: false, reveal: 'open' })).toEqual({ ok: false, reason: 'not-submitted' })
    expect(canTransition('L3', 'L4', { submitted: true, reveal: 'embargo' })).toEqual({ ok: false, reason: 'reveal-held' })
    expect(canTransition('L4', 'L5', open)).toEqual({ ok: true, to: 'L5' })
    expect(canTransition('L5', 'L1', { submitted: false, reveal: null })).toEqual({ ok: true, to: 'L1' })
    expect(canTransition('L2', 'L2', open)).toEqual({ ok: false, reason: 'same' })
  })
})
