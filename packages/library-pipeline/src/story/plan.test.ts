// packages/library-pipeline/src/story/plan.test.ts
//
// 검수 결속과 발행 계획 미리보기 회귀 — 낡은 승인 · 다른 판본 승인 · 자기 승인 · 합성 검수 ·
// 권리 미확정 · 부분 판본 완독 오인 · 판본별 진도 분리 · 불변 발행 키를 고정한다.
// 「candidate」는 로컬 미리보기일 뿐 DB 발행 허가가 아니라는 것도 결과물 자체에서 확인한다.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { countReleases, decideEdition, validateThemeCollection, type ReleasePreview, type ReviewEvidence } from './plan'
import {
  requiredChecks,
  reviewBindingFor,
  validateEdition,
  validatePolicy,
  validateReview,
  validateSnapshot,
  type EditionResult,
  type PolicyContext,
  type SourceContext,
} from './validate'

const NOW = new Date('2026-10-25T12:00:00+09:00')
const WORK = 'gull-rock-r1'

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

function fixture(name: string): Json {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/gull-rock.${name}.json`, import.meta.url)), 'utf8')) as Json
}

/** 테스트 안에서만 쓰는 「실제 원천처럼 보이는」 변형 — 권리 확인 값은 가상이다. */
function realLike(): { snapshot: Json } {
  const s = fixture('snapshot')
  s.synthetic = false
  s.edition.source_kind = 'external_file'
  s.rights = [
    {
      asset: 'source_text',
      status: 'confirmed',
      basis: '테스트 전용 가상 확인 기록',
      evidence_ref: 'test-only-evidence',
      checked_by: 'test-only-checker',
      checked_at: '2026-10-25T08:00:00+09:00',
    },
  ]
  return { snapshot: s }
}

interface Env {
  source: SourceContext
  policy: PolicyContext
}

/**
 * 에이전트가 이 원천 판본 · 기준 · 목표의 과제를 받아 다시 만든 결과물처럼 결속 · 생산자를 채운다.
 * 원천 판본이 바뀌면 결과물은 새 결속으로 다시 만들어야 한다(F1) — 이 도우미가 그 「다시 만들기」다.
 */
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

function env(snapshot: Json = fixture('snapshot'), policy: Json = fixture('policy')): Env {
  const src = validateSnapshot(snapshot, NOW)
  if (!src.value) throw new Error(JSON.stringify(src.errors))
  const pol = validatePolicy(policy, src.value)
  if (!pol.value) throw new Error(JSON.stringify(pol.errors))
  return { source: src.value, policy: pol.value }
}

function edition(e: Env, key: string, artifact: Json): EditionResult {
  const r = validateEdition(artifact, { ...e, edition_key: key, task_id: `${WORK}:${key}` })
  if (!r.value) throw new Error(JSON.stringify(r.errors))
  return r.value
}

/** 다른 세션의 AI 검수 — 필수 항목 전부 pass. 테스트 입력이며 실제 검토가 아니다. */
function aiReview(e: Env, key: string, result: EditionResult, over: Partial<Json> = {}): Json {
  return {
    schema: 'lcp-story/review@1',
    review_id: `review-${key}`,
    binding: reviewBindingFor({ ...e, edition_key: key, task_id: `${WORK}:${key}` }, result),
    reviewer: { kind: 'ai_model', agent: 'codex', session_id: 'reviewer-session', role: '독립 내용 검수' },
    provenance: 'ai_review',
    checks: requiredChecks(result.edition).map((check) => ({ check, verdict: 'pass', note: '테스트 입력' })),
    issues: [],
    verdict: 'approve',
    reviewed_at: '2026-10-25T10:00:00+09:00',
    ...over,
  }
}

function evidence(e: Env, key: string, result: EditionResult | null, review: Json, file = `${key}.review.out.json`): ReviewEvidence {
  const binding = result ? reviewBindingFor({ ...e, edition_key: key, task_id: `${WORK}:${key}` }, result) : null
  const r = validateReview(review, { edition_key: key, current_binding: binding, now: NOW })
  if (!r.value) throw new Error(JSON.stringify(r.errors))
  return { file, review: r.value.review, review_sha256: r.value.review_sha256, current: r.value.current }
}

function decide(e: Env, key: string, result: EditionResult, reviews: ReviewEvidence[]) {
  return decideEdition({ ...e, edition_key: key, edition_state: 'valid', edition: result, reviews })
}

function reasonCodes(d: { reasons: { code: string }[] }): string[] {
  return d.reasons.map((r) => r.code)
}

function deepReverseKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(deepReverseKeys)
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.keys(v)
        .reverse()
        .map((k) => [k, deepReverseKeys((v as Json)[k])]),
    )
  }
  return v
}

describe('합성 fixture 의 계획 — 실제 발행 후보로 세지 않는다', () => {
  const e = env()
  const story = edition(e, 'story-b1', fixture('story-b1.edition.out'))
  const review = evidence(e, 'story-b1', story, fixture('story-b1.review.synthetic.out'))

  it('합성 검수는 지금 판에 결속돼 있지만 fixture_only 다', () => {
    expect(review.current).toBe(true)
    const d = decide(e, 'story-b1', story, [review])
    expect(d.status).toBe('fixture_only')
    expect(reasonCodes(d)).toEqual(
      expect.arrayContaining(['synthetic_source', 'synthetic_edition', 'synthetic_rights:source_text', 'synthetic_review:synthetic-review-story-b1']),
    )
    expect(d.reasons.every((r) => r.blocks === 'fixture')).toBe(true)
    expect(d.release?.preview_kind).toBe('fixture')
    expect(d.release?.requires_followup).toEqual(
      expect.arrayContaining(['synthetic_fixture_not_publishable', 'db_publish_gate_not_implemented', 'human_review_not_performed', 'learner_pilot_not_run']),
    )
  })

  it('검수가 없는 쉬운 판본은 보류다', () => {
    const easy = edition(e, 'easy-a2', fixture('easy-a2.edition.out'))
    const d = decide(e, 'easy-a2', easy, [])
    expect(d.status).toBe('hold')
    expect(reasonCodes(d)).toContain('review_missing')
    expect(d.release).toBeNull()
  })

  it('결과물이 아직 없으면 pending, 구조 오류면 hold', () => {
    expect(decideEdition({ ...e, edition_key: 'easy-a2', edition_state: 'missing', edition: null, reviews: [] }).status).toBe('pending')
    expect(decideEdition({ ...e, edition_key: 'easy-a2', edition_state: 'in_progress', edition: null, reviews: [] }).status).toBe('pending')
    expect(decideEdition({ ...e, edition_key: 'easy-a2', edition_state: 'invalid', edition: null, reviews: [] }).status).toBe('hold')
  })
})

describe('실제 원천 형태의 변형 — 결속된 독립 승인만 후보가 된다', () => {
  const { snapshot } = realLike()
  const e = env(snapshot)
  const producer = (art: Json, key = art.edition_key as string): Json => produce(e, key, art)
  const story = edition(e, 'story-b1', producer(fixture('story-b1.edition.out')))

  it('다른 세션의 AI 승인 + 권리 확인 → candidate, 그래도 DB 발행 허가는 아니다', () => {
    const d = decide(e, 'story-b1', story, [evidence(e, 'story-b1', story, aiReview(e, 'story-b1', story))])
    expect(d.status).toBe('candidate')
    expect(d.reasons).toEqual([])
    const r = d.release!
    expect(r.release_key).toMatch(/^lsr_[0-9a-f]{32}$/)
    expect(r.preview_kind).toBe('local_candidate')
    expect(r.db_write).toBe(false)
    expect(r.publish_permission).toBe('none_local_preview')
    expect(r.structural_checks).toBe('passed_structure_only')
    expect(r.requires_followup).toEqual(
      expect.arrayContaining(['db_publish_gate_not_implemented', 'language_level_not_measured', 'meaning_preservation_is_reviewer_judgment', 'human_review_not_performed']),
    )
    expect(r.evidence_policy.reading_progress).toBe('reading_record_not_mastery')
    expect(r.evidence_policy.deep_reading_interpretive).toBe('not_scored')
    expect(r.reading_identity).toEqual({
      reading_book_key: r.release_key,
      work_count_key: 'synthetic-gull-rock',
      counts_as_work_completion: true,
      completion_label: 'adapted_full_work',
      counts_as_original_text_completion: false,
      progress_inheritance: 'none',
    })
    expect(r.versions.source.identity_sha256).toBe(e.source.identity_sha256)
  })

  it('승인 뒤 본문이 바뀌면 그 승인은 낡은 것이다 — 재사용하지 않고 보류', () => {
    const approved = aiReview(e, 'story-b1', story)
    const edited = producer(fixture('story-b1.edition.out'))
    edited.units[1].text = edited.units[1].text.replace('laughed', 'smiled')
    const now = edition(e, 'story-b1', edited)
    const ev = evidence(e, 'story-b1', now, approved)
    expect(ev.current).toBe(false)
    const d = decide(e, 'story-b1', now, [ev])
    expect(d.status).toBe('hold')
    expect(reasonCodes(d)).toContain('review_stale')
    expect(d.stale_reviews).toEqual(['story-b1.review.out.json'])
  })

  it('정답 · 근거만 바뀌어도 승인은 낡는다', () => {
    const approved = aiReview(e, 'story-b1', story)
    const changed = producer(fixture('story-b1.edition.out'))
    changed.activities[0].task.answer.correct = ['o3']
    const now = edition(e, 'story-b1', changed)
    const r = validateReview(approved, {
      edition_key: 'story-b1',
      current_binding: reviewBindingFor({ ...e, edition_key: 'story-b1', task_id: `${WORK}:story-b1` }, now),
      now: NOW,
    })
    expect(r.value?.current).toBe(false)
    expect(r.value?.mismatched_fields).toEqual(['activities_sha256'])
  })

  it('다른 판본의 검수 결과를 이 판본에 재사용하지 않는다', () => {
    const easy = edition(e, 'easy-a2', producer(fixture('easy-a2.edition.out')))
    const storyApproval = aiReview(e, 'story-b1', story)
    const binding = reviewBindingFor({ ...e, edition_key: 'easy-a2', task_id: `${WORK}:easy-a2` }, easy)
    const r = validateReview(storyApproval, { edition_key: 'easy-a2', current_binding: binding, now: NOW })
    expect(r.ok).toBe(false)
    expect(r.errors.map((x) => x.code)).toContain('review_wrong_edition')
  })

  it('판본을 만든 세션의 자기 승인은 세지 않는다', () => {
    const self = aiReview(e, 'story-b1', story, {
      reviewer: { kind: 'ai_model', agent: 'claude-code', session_id: 'producer-session', role: '자기 검수' },
    })
    const d = decide(e, 'story-b1', story, [evidence(e, 'story-b1', story, self)])
    expect(d.status).toBe('hold')
    expect(reasonCodes(d)).toContain('self_review:review-story-b1')
  })

  it('수정 요청 · 필수 항목 누락 · 열린 major 문제는 보류다', () => {
    const changes = aiReview(e, 'story-b1', story, { verdict: 'changes_requested' })
    expect(reasonCodes(decide(e, 'story-b1', story, [evidence(e, 'story-b1', story, changes)]))).toContain('review_verdict:changes_requested:review-story-b1')

    const partial = aiReview(e, 'story-b1', story)
    partial.checks = partial.checks.filter((c: Json) => c.check !== 'meaning_preservation')
    expect(reasonCodes(decide(e, 'story-b1', story, [evidence(e, 'story-b1', story, partial)]))).toContain('check_not_passed:meaning_preservation:review-story-b1')

    const major = aiReview(e, 'story-b1', story, {
      issues: [{ issue_id: 'i1', severity: 'major', status: 'open', unit_ids: ['u4'], summary: '인과가 약해졌다' }],
    })
    expect(reasonCodes(decide(e, 'story-b1', story, [evidence(e, 'story-b1', story, major)]))).toContain('major_issue_open:i1')
  })

  it('두 검수가 엇갈리면(승인 + 보류) 보류다', () => {
    const ok = evidence(e, 'story-b1', story, aiReview(e, 'story-b1', story), 'a.out.json')
    const hold = evidence(e, 'story-b1', story, aiReview(e, 'story-b1', story, { review_id: 'review-2', verdict: 'hold' }), 'b.out.json')
    expect(decide(e, 'story-b1', story, [ok, hold]).status).toBe('hold')
  })

  it('모순된 검수 기록은 구조 검증에서 거부한다', () => {
    const binding = reviewBindingFor({ ...e, edition_key: 'story-b1', task_id: `${WORK}:story-b1` }, story)
    const check = (over: Partial<Json>): string[] =>
      validateReview(aiReview(e, 'story-b1', story, over), { edition_key: 'story-b1', current_binding: binding, now: NOW }).errors.map((x) => x.code)
    const failing = aiReview(e, 'story-b1', story)
    failing.checks[0].verdict = 'fail'
    expect(check({ checks: failing.checks })).toContain('review_inconsistent')
    expect(check({ issues: [{ issue_id: 'c1', severity: 'critical', status: 'open', unit_ids: [], summary: '사실 오류' }] })).toContain('review_inconsistent')
    expect(check({ issues: [{ issue_id: 'c1', severity: 'critical', status: 'accepted_risk', unit_ids: [], summary: '사실 오류' }] })).toContain('critical_issue_accepted')
    expect(check({ reviewed_at: '2026-10-26T00:00:00+09:00' })).toContain('time_in_future')
    expect(check({ provenance: 'human_review' })).toContain('review_provenance_mismatch')
    expect(check({ free_text_score: 3 })).toContain('schema_unrecognized_keys')
  })

  it('사이트 단위 PD 표지(claimed_by_source)는 권리 확인이 아니다', () => {
    const { snapshot: s } = realLike()
    s.rights[0] = { ...s.rights[0], status: 'claimed_by_source', evidence_ref: 'site-wide-pd-label', checked_by: null, checked_at: null }
    const e2 = env(s)
    const st = edition(e2, 'story-b1', produce(e2, 'story-b1', fixture('story-b1.edition.out')))
    const d = decide(e2, 'story-b1', st, [evidence(e2, 'story-b1', st, aiReview(e2, 'story-b1', st))])
    expect(d.status).toBe('hold')
    expect(reasonCodes(d)).toContain('rights_unconfirmed:source_text')
  })

  it('원본 오디오를 상속하겠다고 선언해도 권리 · 본문 정합 확인 전에는 보류다', () => {
    const art = producer(fixture('story-b1.edition.out'))
    art.assets = [
      { asset_id: 'a-voice', kind: 'audio', origin: 'inherited_from_source', unit_ids: ['u1'], rights_status: 'confirmed', rights_evidence_ref: 'x', alignment: 'unverified' },
    ]
    const st = edition(e, 'story-b1', art)
    expect(requiredChecks(st.edition)).toContain('assets')
    const d = decide(e, 'story-b1', st, [evidence(e, 'story-b1', st, aiReview(e, 'story-b1', st))])
    expect(d.status).toBe('hold')
    expect(reasonCodes(d)).toEqual(expect.arrayContaining(['asset_alignment_unverified:a-voice', 'asset_source_rights_unconfirmed:a-voice']))
  })
})

describe('불변 발행 키 · 판본별 진도 · 작품 수', () => {
  const { snapshot } = realLike()
  const policyJson = fixture('policy')
  // 단편 일부(에피소드) 판본 — 도입~사고(0..3문단). 기존 판본 검수를 낡게 하지 않는다(production 은 기준 해시 밖).
  policyJson.production.push({
    ...policyJson.production[0],
    edition_key: 'story-ep1',
    coverage: 'episode',
    scope: { first_paragraph: 0, last_paragraph: 3 },
    activities: [],
  })
  const e = env(snapshot, policyJson)
  const producer = (art: Json, key = art.edition_key as string): Json => produce(e, key, art)
  const ep = producer(fixture('story-b1.edition.out'), 'story-ep1')
  ep.task_id = `${WORK}:story-ep1`
  ep.edition_key = 'story-ep1'
  ep.units = ep.units.slice(0, 4)
  ep.change_log = [ep.change_log[1], ep.change_log[3]].map((c: Json) => ({ ...c, unit_ids: c.unit_ids.filter((u: string) => ['u1', 'u2', 'u3', 'u4'].includes(u)) }))
  ep.change_log[0].source_anchors = ep.change_log[0].source_anchors.filter((a: Json) => a.paragraph <= 3)
  ep.activities = []

  const story = edition(e, 'story-b1', producer(fixture('story-b1.edition.out')))
  const easy = edition(e, 'easy-a2', producer(fixture('easy-a2.edition.out')))
  const episode = edition(e, 'story-ep1', ep)
  const approve = (key: string, r: EditionResult) => decide(e, key, r, [evidence(e, key, r, aiReview(e, key, r))])

  it('에피소드 판본은 후보가 되어도 원작 전권 완료로 세지 않는다', () => {
    const d = approve('story-ep1', episode)
    expect(d.status).toBe('candidate')
    expect(d.release?.coverage).toBe('episode')
    expect(d.release?.reading_identity.counts_as_work_completion).toBe(false)
    expect(d.release?.reading_identity.completion_label).toBe('adapted_partial')
  })

  it('Easy Reader 전권 완독은 작품 경험으로 셀 수 있지만 원문 완독이 아니다', () => {
    const d = approve('easy-a2', easy)
    expect(d.status).toBe('candidate')
    expect(d.release?.reading_identity).toMatchObject({
      counts_as_work_completion: true,
      completion_label: 'adapted_full_work',
      counts_as_original_text_completion: false,
    })
  })

  it('에피소드 판본은 범위 밖 원문을 가리킬 수 없다', () => {
    const bad = structuredClone(ep)
    bad.units[3].source_anchors.push(fixture('story-b1.edition.out').units[7].source_anchors[0])
    const r = validateEdition(bad, { ...e, edition_key: 'story-ep1', task_id: `${WORK}:story-ep1` })
    expect(r.errors.map((x) => x.code)).toContain('anchor_outside_scope')
  })

  it('같은 작품의 판본들은 진도 키가 다르고 작품 수는 하나다', () => {
    const releases = [approve('story-b1', story), approve('easy-a2', easy), approve('story-ep1', episode)].map((d) => d.release!)
    const keys = new Set(releases.map((r) => r.reading_identity.reading_book_key))
    expect(keys.size).toBe(3)
    expect(new Set(releases.map((r) => r.reading_identity.work_count_key))).toEqual(new Set(['synthetic-gull-rock']))
    expect(countReleases(releases)).toEqual({ releases: 3, distinct_works: 1 })
  })

  it('같은 입력이면 같은 키, 검수 판 하나만 달라도 새 키', () => {
    const a = approve('story-b1', story).release!.release_key
    const b = approve('story-b1', story).release!.release_key
    expect(a).toBe(b)
    const other = aiReview(e, 'story-b1', story, { review_id: 'review-again', reviewed_at: '2026-10-25T11:00:00+09:00' })
    const c = decide(e, 'story-b1', story, [evidence(e, 'story-b1', story, other)]).release!.release_key
    expect(c).not.toBe(a)
  })

  it('편집 기준 핵심이 바뀌면 판본 결속이 낡아 다시 만들어야 한다', () => {
    const p = fixture('policy')
    p.preserve.events[0].description = '설명 수정'
    const e2 = env(snapshot, p)
    const r = validateEdition(producer(fixture('story-b1.edition.out')), { ...e2, edition_key: 'story-b1', task_id: `${WORK}:story-b1` })
    expect(r.errors.map((x) => x.code)).toContain('edition_binding_stale')
  })

  it('테마 편성은 후보 발행본만, 서로 다른 작품 둘 이상을 잇는다', () => {
    const s = approve('story-b1', story).release!
    const z = approve('easy-a2', easy).release!
    const sameWork = {
      schema: 'lcp-story/theme-collection@1',
      collection_key: 'lighthouses',
      title: '등대 이야기',
      theme: '혼자 불을 지킨 아이들',
      entries: [
        { release_key: s.release_key, work_key: s.work_key, reason: '반어로 끝나는 이야기' },
        { release_key: z.release_key, work_key: z.work_key, reason: '쉬운 판본' },
      ],
    }
    const single = validateThemeCollection(sameWork, [s, z])
    expect(single.errors.map((x) => x.code)).toContain('collection_single_work')
    expect(single.count).toEqual({ releases: 2, distinct_works: 1 })

    const otherWork: ReleasePreview = {
      ...s,
      release_key: `lsr_${'1'.repeat(32)}`,
      work_key: 'other-work',
      reading_identity: { ...s.reading_identity, reading_book_key: `lsr_${'1'.repeat(32)}`, work_count_key: 'other-work' },
    }
    const two = { ...sameWork, entries: [sameWork.entries[0], { release_key: otherWork.release_key, work_key: 'other-work', reason: '다른 작품' }] }
    expect(validateThemeCollection(two, [s, otherWork]).ok).toBe(true)

    const fixtureRelease = { ...otherWork, preview_kind: 'fixture' as const }
    expect(validateThemeCollection(two, [s, fixtureRelease]).errors.map((x) => x.code)).toContain('collection_release_unavailable')
    expect(validateThemeCollection({ ...two, entries: [{ ...two.entries[0], text: 'body copy' }, two.entries[1]] }, [s, otherWork]).ok).toBe(false)
  })
})

describe('원천 판본 정체 결속 — 같은 본문의 다른 원천 판본(F1)', () => {
  const { snapshot: a } = realLike()
  const b = structuredClone(a)
  b.snapshot_id = 'gull-rock-second-edition'
  b.edition.revision = 'r2'
  b.edition.edition_label = 'Second printing (test-only)'
  const eA = env(a)
  const eB = env(b)
  const storyA = edition(eA, 'story-b1', produce(eA, 'story-b1', fixture('story-b1.edition.out')))
  const reviewA = aiReview(eA, 'story-b1', storyA)
  const releaseA = decide(eA, 'story-b1', storyA, [evidence(eA, 'story-b1', storyA, reviewA)]).release!

  it('본문 해시는 같고 원천 판본 정체 해시는 다르다', () => {
    expect(eB.source.sha256).toBe(eA.source.sha256)
    expect(eB.source.identity_sha256).not.toBe(eA.source.identity_sha256)
  })

  it('옛 원천 판본의 결과물을 새 원천 판본에 그대로 쓰면 결속이 낡아 거부된다', () => {
    const r = validateEdition(produce(eA, 'story-b1', fixture('story-b1.edition.out')), { ...eB, edition_key: 'story-b1', task_id: `${WORK}:story-b1` })
    expect(r.errors).toEqual([expect.objectContaining({ code: 'edition_binding_stale', path: 'edition.binding.source_identity_sha256' })])
  })

  it('옛 원천 판본의 승인을 옮겨 오면 stale 이고 보류다', () => {
    const storyB = edition(eB, 'story-b1', produce(eB, 'story-b1', fixture('story-b1.edition.out')))
    const moved = evidence(eB, 'story-b1', storyB, reviewA)
    expect(moved.current).toBe(false)
    const check = validateReview(reviewA, {
      edition_key: 'story-b1',
      current_binding: reviewBindingFor({ ...eB, edition_key: 'story-b1', task_id: `${WORK}:story-b1` }, storyB),
      now: NOW,
    })
    expect(check.value?.mismatched_fields).toEqual(expect.arrayContaining(['source_identity_sha256']))
    const d = decide(eB, 'story-b1', storyB, [moved])
    expect(d.status).toBe('hold')
    expect(reasonCodes(d)).toContain('review_stale')
  })

  it('새 원천 판본에서 다시 만들고 다시 검수하면 후보가 되지만 발행 키는 다르다', () => {
    const storyB = edition(eB, 'story-b1', produce(eB, 'story-b1', fixture('story-b1.edition.out')))
    const d = decide(eB, 'story-b1', storyB, [evidence(eB, 'story-b1', storyB, aiReview(eB, 'story-b1', storyB))])
    expect(d.status).toBe('candidate')
    expect(d.release!.release_key).not.toBe(releaseA.release_key)
    expect(d.release!.versions.source.identity_sha256).not.toBe(releaseA.versions.source.identity_sha256)
    expect(d.release!.versions.source.text_sha256).toBe(releaseA.versions.source.text_sha256)
  })

  it('원천 스냅숏의 키 순서만 다르면 같은 정체 · 같은 결속 · 같은 발행 키다', () => {
    const eR = env(deepReverseKeys(a) as Json)
    expect(eR.source.identity_sha256).toBe(eA.source.identity_sha256)
    const storyR = edition(eR, 'story-b1', produce(eA, 'story-b1', fixture('story-b1.edition.out')))
    const d = decide(eR, 'story-b1', storyR, [evidence(eR, 'story-b1', storyR, reviewA)])
    expect(d.status).toBe('candidate')
    expect(d.release!.release_key).toBe(releaseA.release_key)
  })
})

describe('번역 권리 — 본문을 이루는 권리는 전부 confirmed 여야 한다(F2)', () => {
  function translatedEnv(status: string): Env {
    const { snapshot: s } = realLike()
    s.work.original_language = 'fr'
    s.edition.translator = 'Test-only Translator'
    const confirmed = status === 'confirmed'
    s.rights.push({
      asset: 'translation',
      status,
      basis: '테스트 전용 가상 번역 권리 기록',
      evidence_ref: confirmed ? 'test-only-translation-evidence' : null,
      checked_by: confirmed ? 'test-only-checker' : null,
      checked_at: confirmed ? '2026-10-25T08:30:00+09:00' : null,
    })
    return env(s)
  }

  function planFor(e: Env) {
    const st = edition(e, 'story-b1', produce(e, 'story-b1', fixture('story-b1.edition.out')))
    return decide(e, 'story-b1', st, [evidence(e, 'story-b1', st, aiReview(e, 'story-b1', st))])
  }

  it('원문 · 번역 권리가 모두 확인되면 후보다', () => {
    expect(planFor(translatedEnv('confirmed')).status).toBe('candidate')
  })

  it.each(['hold', 'unverified', 'claimed_by_source'])('번역 권리가 %s 면 원문 권리가 확인돼도 보류다', (status) => {
    const d = planFor(translatedEnv(status))
    expect(d.status).toBe('hold')
    expect(reasonCodes(d)).toEqual(['rights_unconfirmed:translation'])
  })

  it('증거 없이 confirmed 라고 적은 번역 권리는 원천 검증에서 거부된다', () => {
    const { snapshot: s } = realLike()
    s.work.original_language = 'fr'
    s.edition.translator = 'Test-only Translator'
    s.rights.push({ asset: 'translation', status: 'confirmed', basis: '증거 없음', evidence_ref: null, checked_by: null, checked_at: null })
    expect(validateSnapshot(s, NOW).errors.map((x) => x.code)).toContain('rights_confirmation_incomplete')
  })

  it('쓰지 않는 오디오 · 삽화 권리 기록이 보류여도 본문 판본은 막지 않는다', () => {
    const { snapshot: s } = realLike()
    s.rights.push({ asset: 'audio', status: 'hold', basis: '낭독 권리 미확인', evidence_ref: null, checked_by: null, checked_at: null })
    s.rights.push({ asset: 'illustration', status: 'unverified', basis: '삽화 권리 미확인', evidence_ref: null, checked_by: null, checked_at: null })
    expect(planFor(env(s)).status).toBe('candidate')
  })
})

describe('합성 기본값은 권리 확인으로 바뀌지 않는다', () => {
  it('합성 원천의 권리 표기는 fixture 사유로만 남는다', () => {
    const e = env()
    const st = edition(e, 'story-b1', fixture('story-b1.edition.out'))
    const d = decide(e, 'story-b1', st, [evidence(e, 'story-b1', st, fixture('story-b1.review.synthetic.out'))])
    expect(d.status).toBe('fixture_only')
    expect(reasonCodes(d).filter((c) => c.startsWith('rights_'))).toEqual([])
  })
})
