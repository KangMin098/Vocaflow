// packages/library-pipeline/src/story/attest.test.ts
//
// 검증 증명 어댑터 회귀 — DB 의 story_service_validation_input 과 같은 모양의 입력을 만들어
// (1) 정상 판은 DB 가 다시 계산할 결속 튜플 그대로 증명되고 (2) S2 계약을 어기는 판 · 검수 · 원천은 단계별로 거부되는지 본다.
// 원문 앵커 누락 · 거짓 진입 장면 · 허위 인용 · 문단 밖 · 범위 밖 · 단위 중복 · 정렬 누락 · 보존 요소 누락 · 민감 표현 미처리 ·
// 요청 활동 누락 · 낡은 검수 · 합성 자료를 모두 다룬다. 실제 DB 는 쓰지 않는다(격리 하네스가 DB 쪽을 시험한다).

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { buildValidationAttestation, snapshotFromStored } from './attest'
import { sha256Canonical } from './canonical'
import {
  requiredChecks,
  reviewBindingFor,
  validateEdition,
  validatePolicy,
  validateSnapshot,
  type EditionResult,
  type PolicyContext,
  type SourceContext,
} from './validate'

const NOW = new Date('2026-10-25T12:00:00+09:00')
const WORK = 'gull-rock-r1'
const VERSION_ID = '11111111-1111-4111-8111-111111111111'

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

function fixture(name: string): Json {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/gull-rock.${name}.json`, import.meta.url)), 'utf8')) as Json
}

/** 시험 전용 「실제 원천 형태」 — 권리는 주장(claimed_by_source)일 뿐 실제 확인이 아니다. */
function realSnapshot(): Json {
  const s = fixture('snapshot')
  s.synthetic = false
  s.edition.source_kind = 'external_file'
  s.rights = [{ asset: 'source_text', status: 'claimed_by_source', basis: '시험 전용 주장', evidence_ref: 'test-only', checked_by: null, checked_at: null }]
  return s
}

interface Env {
  source: SourceContext
  policy: PolicyContext
}

function env(snapshot: Json = realSnapshot()): Env {
  const src = validateSnapshot(snapshot, NOW)
  if (!src.value) throw new Error(JSON.stringify(src.errors))
  const pol = validatePolicy(fixture('policy'), src.value)
  if (!pol.value) throw new Error(JSON.stringify(pol.errors))
  return { source: src.value, policy: pol.value }
}

function produce(e: Env, key: string, art: Json): Json {
  art.produced_by = { agent: 'claude-code', session_id: 'producer-session', provenance: 'ai_generated' }
  art.binding = {
    source_sha256: e.source.sha256,
    source_identity_sha256: e.source.identity_sha256,
    policy_sha256: e.policy.policy_sha256,
    target_sha256: e.policy.items.get(key)!.target_sha256,
  }
  return art
}

function editionResult(e: Env, key: string, art: Json): EditionResult {
  const r = validateEdition(art, { ...e, edition_key: key, task_id: `${WORK}:${key}` })
  if (!r.value) throw new Error(JSON.stringify(r.errors))
  return r.value
}

function review(e: Env, key: string, result: EditionResult, over: Json = {}): Json {
  return {
    schema: 'lcp-story/review@1',
    review_id: `review-${key}`,
    binding: reviewBindingFor({ ...e, edition_key: key, task_id: `${WORK}:${key}` }, result),
    reviewer: { kind: 'ai_model', agent: 'codex', session_id: 'reviewer-session', role: '독립 내용 검수(시험)' },
    provenance: 'ai_review',
    checks: requiredChecks(result.edition).map((check) => ({ check, verdict: 'pass', note: '시험 입력' })),
    issues: [],
    verdict: 'approve',
    reviewed_at: '2026-10-25T10:00:00+09:00',
    ...over,
  }
}

/** DB 의 story_service_validation_input 모양 — 원천은 저장 메타 + 본문 + 본문 해시로 되살린다. */
function validationInput(snapshot: Json, artifact: Json, reviews: Json[], key = 'story-b1'): Json {
  const { text, text_sha256, ...meta } = snapshot
  return {
    edition_version_id: VERSION_ID,
    edition_key: key,
    snapshot: snapshotFromStored(meta, text as string, text_sha256 as string),
    policy: fixture('policy'),
    artifact,
    reviews,
  }
}

const e = env()
const story = produce(e, 'story-b1', fixture('story-b1.edition.out'))
const storyResult = editionResult(e, 'story-b1', story)

function attest(mutateArtifact: (a: Json) => void = () => {}, reviewsOf?: (a: Json) => Json[]) {
  const art = structuredClone(story)
  mutateArtifact(art)
  const reviews = reviewsOf ? reviewsOf(art) : [review(e, 'story-b1', storyResult)]
  return buildValidationAttestation({ validationInput: validationInput(realSnapshot(), art, reviews), now: NOW })
}

describe('정상 판 — DB 가 다시 계산할 결속 그대로 증명한다', () => {
  it('저장된 원천 · 기준 · 판본 · 검수가 S2 를 통과하면 결속 튜플과 그 해시를 낸다', () => {
    const r = attest()
    if (!r.ok) throw new Error(JSON.stringify(r))
    const rv = review(e, 'story-b1', storyResult)
    expect(r.attestation.schema).toBe('lcp-story/validation-attestation@1')
    expect(r.attestation.validator).toEqual({ name: 'lcp-story-s2', contract: 'lcp-story/s2@1' })
    expect(r.attestation.checks).toEqual({ snapshot: 'valid', policy: 'valid', edition: 'valid', reviews: 'valid' })
    expect(r.attestation.binding).toEqual({
      source_sha256: e.source.sha256,
      source_identity_sha256: e.source.identity_sha256,
      policy_sha256: e.policy.policy_sha256,
      target_sha256: e.policy.items.get('story-b1')!.target_sha256,
      edition_sha256: storyResult.edition_sha256,
      activities_sha256: storyResult.activities_sha256,
      review_sha256s: [sha256Canonical(rv)],
    })
    expect(r.bindingSha256).toBe(sha256Canonical(r.attestation.binding))
    expect(r.attestation.validated_at).toBe(NOW.toISOString())
  })

  it('검수 해시 목록은 정렬되고, 입력 키 순서와 무관하게 같은 결속이 된다', () => {
    const a = attest(() => {}, () => [review(e, 'story-b1', storyResult, { review_id: 'review-z' }), review(e, 'story-b1', storyResult, { review_id: 'review-a' })])
    const b = attest(() => {}, () => [review(e, 'story-b1', storyResult, { review_id: 'review-a' }), review(e, 'story-b1', storyResult, { review_id: 'review-z' })])
    if (!a.ok || !b.ok) throw new Error('expected ok')
    expect(a.attestation.binding.review_sha256s).toEqual([...a.attestation.binding.review_sha256s].sort())
    expect(a.bindingSha256).toBe(b.bindingSha256)
    const reversed = Object.fromEntries(Object.entries(validationInput(realSnapshot(), structuredClone(story), [review(e, 'story-b1', storyResult)])).reverse())
    const c = buildValidationAttestation({ validationInput: reversed, now: NOW })
    const d = attest()
    if (!c.ok || !d.ok) throw new Error('expected ok')
    expect(c.bindingSha256).toBe(d.bindingSha256)
  })
})

describe('S2 계약을 어기는 판은 증명하지 않는다(edition 단계)', () => {
  it.each([
    ['단위 원문 앵커 비움', (a: Json) => { a.units[0].source_anchors = [] }],
    ['거짓 진입 장면(spoiler_free=false)', (a: Json) => { a.hook.spoiler_free = false }],
    ['허위 인용', (a: Json) => { a.units[1].source_anchors[0].quote = 'This sentence is not in the source.' }],
    ['문단 밖 구간', (a: Json) => { a.units[1].source_anchors[0].paragraph = 0 }],
    ['원문 길이 밖 오프셋', (a: Json) => { a.units[1].source_anchors[0].end = 999_999 }],
    ['단위 id 중복', (a: Json) => { a.units[1].unit_id = a.units[0].unit_id }],
    ['단위 본문 중복', (a: Json) => { a.units[1].text = a.units[0].text }],
    ['문단 대응 누락(정렬 누락)', (a: Json) => { a.units.splice(6, 1); a.units.forEach((u: Json, i: number) => { u.order = i + 1 }) }],
    ['보존 요소 누락', (a: Json) => { a.units[5].preserves = [] }],
    ['민감 표현 처리 기록 누락', (a: Json) => { a.change_log = a.change_log.filter((c: Json) => c.sensitive_ref === null) }],
    ['요청한 활동 누락', (a: Json) => { a.activities = a.activities.filter((x: Json) => x.kind !== 'original_bridge') }],
    ['재서사 변경', (a: Json) => { a.change_log[0].type = 'renarration' }],
    ['합성 판본', (a: Json) => { a.produced_by.provenance = 'synthetic_fixture' }],
  ])('%s', (_label, mutate) => {
    const r = attest(mutate, (a) => {
      // 검수는 변조된 판에 결속돼 있어도(현재) 판 자체가 S2 를 어기면 증명되지 않아야 한다.
      try {
        return [review(e, 'story-b1', editionResult(e, 'story-b1', a))]
      } catch {
        return [review(e, 'story-b1', storyResult)]
      }
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.stage).toBe('edition')
  })
})

describe('원천 · 기준 · 검수 단계 거부', () => {
  it('저장 본문과 본문 해시가 다르면 snapshot 단계에서 거부', () => {
    const s = realSnapshot()
    const input = validationInput(s, structuredClone(story), [review(e, 'story-b1', storyResult)])
    input.snapshot.text = `${input.snapshot.text as string} extra`
    const r = buildValidationAttestation({ validationInput: input, now: NOW })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.stage).toBe('snapshot')
      expect(r.errors.map((x) => x.code)).toContain('text_hash_mismatch')
    }
  })

  it('합성 원천은 증명하지 않는다', () => {
    const r = buildValidationAttestation({ validationInput: validationInput(fixture('snapshot'), fixture('story-b1.edition.out'), [fixture('story-b1.review.synthetic.out')]), now: NOW })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.stage).toBe('snapshot')
  })

  it('다른 원문 판의 기준이면 policy 단계에서 거부', () => {
    const input = validationInput(realSnapshot(), structuredClone(story), [review(e, 'story-b1', storyResult)])
    input.policy.source_sha256 = 'f'.repeat(64)
    const r = buildValidationAttestation({ validationInput: input, now: NOW })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.stage).toBe('policy')
  })

  it('검수가 없거나 · 낡았거나 · 다른 판본 것이거나 · 미래 시각 · 합성이면 reviews 단계에서 거부', () => {
    const none = attest(() => {}, () => [])
    expect(none.ok).toBe(false)
    if (!none.ok) expect(none.errors.map((x) => x.code)).toEqual(['reviews_missing'])

    const stale = attest((a) => { a.units[3].text = a.units[3].text.replace('could not get up', 'could not stand up') }, () => [review(e, 'story-b1', storyResult)])
    expect(stale.ok).toBe(false)
    if (!stale.ok) {
      expect(stale.stage).toBe('reviews')
      expect(stale.errors.map((x) => x.code)).toContain('review_not_current')
    }

    const easy = produce(e, 'easy-a2', fixture('easy-a2.edition.out'))
    const other = attest(() => {}, () => [review(e, 'easy-a2', editionResult(e, 'easy-a2', easy))])
    expect(other.ok).toBe(false)
    if (!other.ok) expect(other.errors.map((x) => x.code)).toContain('review_wrong_edition')

    const future = attest(() => {}, () => [review(e, 'story-b1', storyResult, { reviewed_at: '2026-10-26T00:00:00+09:00' })])
    expect(future.ok).toBe(false)
    if (!future.ok) expect(future.errors.map((x) => x.code)).toContain('time_in_future')

    const synthetic = attest(() => {}, () => [review(e, 'story-b1', storyResult, { provenance: 'synthetic_fixture' })])
    expect(synthetic.ok).toBe(false)
    if (!synthetic.ok) expect(synthetic.errors.map((x) => x.code)).toContain('synthetic_not_publishable')
  })

  it('주입 시각이 유효하지 않으면 던지지 않고 input 단계 오류로 거부(시계를 직접 읽지 않는다)', () => {
    const input = validationInput(realSnapshot(), structuredClone(story), [review(e, 'story-b1', storyResult)])
    for (const now of [new Date(Number.NaN), new Date('not a date'), 'now' as unknown as Date, undefined as unknown as Date]) {
      const r = buildValidationAttestation({ validationInput: input, now })
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.stage).toBe('input')
        expect(r.errors.map((x) => x.code)).toEqual(['invalid_clock'])
      }
    }
  })

  it('입력 모양이 다르면(정의 밖 키 · 판본 키 오류) input 단계에서 거부', () => {
    const input = validationInput(realSnapshot(), structuredClone(story), [review(e, 'story-b1', storyResult)])
    const extra = { ...input, validated: true }
    const r1 = buildValidationAttestation({ validationInput: extra, now: NOW })
    expect(r1.ok).toBe(false)
    if (!r1.ok) expect(r1.stage).toBe('input')
    const r2 = buildValidationAttestation({ validationInput: { ...input, edition_key: 'Not A Slug' }, now: NOW })
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.stage).toBe('input')
    const r3 = buildValidationAttestation({ validationInput: { ...input, edition_key: 'story-ep9' }, now: NOW })
    expect(r3.ok).toBe(false)
    if (!r3.ok) expect(r3.stage).toBe('policy')
  })
})
