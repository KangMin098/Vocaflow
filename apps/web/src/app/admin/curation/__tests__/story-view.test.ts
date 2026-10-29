// apps/web/src/app/admin/curation/__tests__/story-view.test.ts
import { describe, expect, it } from 'vitest'

import type { StoryBundle, StoryCandidateCheck, StorySlotRow, StoryViewer } from '@/lib/library/story/types'

import {
  buildStoryComparison,
  candidatePlanLabel,
  checkStoryAnchor,
  formatStoryTime,
  isStaleStoryFailure,
  nextStoryAction,
  requiredStoryRights,
  safeSourceHref,
  segmentParagraph,
  storyParagraphSpans,
  storyRegisterGate,
  storySlotHistory,
  storySlotOrigin,
  storySlotState,
  type ViewAnchor,
} from '../story-view'

// 합성 시험 입력(실데이터 아님). 앵커는 본문 전체 기준 UTF-16 오프셋이다.
const P0 = 'It was a bright cold day in April.'
const P1 = 'The clocks were striking thirteen. Winston slipped quickly through the glass doors.'
const P2 = 'The hallway smelt of boiled cabbage and old rag mats.'
const BODY = [P0, P1, P2].join('\n\n')
const at = (paragraph: number, quote: string): ViewAnchor => {
  const start = BODY.indexOf(quote)
  if (start < 0) throw new Error(quote)
  return { paragraph, start, end: start + quote.length, quote }
}
const ADMIN: StoryViewer = { uid: 'admin-0000', role: 'admin' }
const CURATOR: StoryViewer = { uid: 'curator-0000', role: 'curator' }
const PRODUCER = 'producer-0000'

function artifact(extra: Record<string, unknown> = {}) {
  return {
    title: 'Thirteen',
    edition_key: 'thirteen-story',
    produced_by: { agent: 'drain', session_id: 's1', provenance: 'ai_generated' },
    hook: { text: 'A clock strikes thirteen.', source_anchors: [at(1, 'The clocks were striking thirteen.')], spoiler_free: true },
    units: [
      { unit_id: 'u-cold', order: 1, title: 'Cold', text: 'It was cold.', source_anchors: [at(0, 'bright cold day')], preserves: [] },
      {
        unit_id: 'u-clock',
        order: 2,
        title: 'Clock',
        text: 'The clocks struck thirteen.',
        source_anchors: [at(1, 'The clocks were striking thirteen.')],
        preserves: ['clock'],
      },
      { unit_id: 'u-hall', order: 3, title: null, text: 'The hall smelt.', source_anchors: [at(2, 'boiled cabbage')], preserves: [] },
    ],
    change_log: [
      {
        change_id: 'c-clock',
        type: 'language_modernization',
        operation: 'rewrite',
        unit_ids: ['u-clock'],
        source_anchors: [at(1, 'The clocks were striking thirteen.')],
        rationale: 'simpler verb',
        learner_note: null,
      },
      {
        change_id: 'c-omit',
        type: 'level_adaptation',
        operation: 'omit',
        unit_ids: [],
        source_anchors: [at(1, 'Winston slipped quickly through the glass doors.')],
        rationale: 'not needed',
        learner_note: null,
      },
      {
        change_id: 'c-cold',
        type: 'language_modernization',
        operation: 'condense',
        unit_ids: ['u-cold'],
        source_anchors: [at(0, 'bright cold day')],
        rationale: 'shorter',
        learner_note: null,
      },
    ],
    activities: [],
    assets: [],
    ...extra,
  }
}

function bundle(over: Partial<StoryBundle> = {}, version: Partial<StoryBundle['version']> = {}): StoryBundle {
  return {
    source: {
      id: 'src-1',
      meta: { work: { title: '1984', original_language: 'en' }, edition: { text_language: 'en', source_url: null }, rights: [{ asset: 'source_text' }] },
      body: BODY,
      text_sha256: 'a'.repeat(64),
      identity_sha256: 'b'.repeat(64),
      correspondence: 'not_library_book',
      library_book_id: null,
      registered_by: PRODUCER,
      registered_at: '2026-10-25T00:00:00Z',
    },
    policy: { id: 'pol-1', policy: {}, policy_sha256: 'c'.repeat(64) },
    slot: { id: 'slot-1', edition_key: 'thirteen-story', production: {}, target_sha256: 'd'.repeat(64) },
    version: {
      id: 'ver-2',
      artifact: artifact(),
      edition_sha256: 'e'.repeat(64),
      activities_sha256: 'f'.repeat(64),
      submitted_by: PRODUCER,
      submitted_at: '2026-10-25T01:00:00Z',
      is_latest: true,
      ...version,
    },
    reviews: [],
    validation: { binding: {}, binding_sha256: '9'.repeat(64), attested: false },
    rights_ok: false,
    rights: [],
    releases: [],
    ...over,
  }
}

const review = (qualifies: boolean, submitted_by = 'reviewer-0000'): StoryBundle['reviews'][number] => ({
  id: `r-${qualifies}-${submitted_by}`,
  review: { reviewer: { kind: 'human', agent: 'staff' } },
  review_sha256: '1'.repeat(64),
  verdict: qualifies ? 'approve' : 'changes_requested',
  qualifies,
  submitted_by,
  submitted_at: '2026-10-25T02:00:00Z',
})

const SLOT: StorySlotRow = {
  slot_id: 'slot-1',
  work_key: 'nineteen-eighty-four',
  edition_key: 'thirteen-story',
  kind: 'story_edition',
  coverage: 'excerpt',
  source_id: 'src-1',
  policy_id: 'pol-1',
  latest_version_id: 'ver-2',
  version_count: 2,
  review_count: 1,
  qualifying_review_count: 0,
  live_release_key: null,
  withdrawn_release_count: 0,
}

describe('문단 구간과 전역 앵커', () => {
  it('문단 구간은 본문 전체 기준이고 구분자를 빼고 잰다', () => {
    const spans = storyParagraphSpans(BODY)
    expect(spans).toEqual([
      { index: 0, start: 0, end: P0.length },
      { index: 1, start: P0.length + 2, end: P0.length + 2 + P1.length },
      { index: 2, start: P0.length + 2 + P1.length + 2, end: BODY.length },
    ])
    expect(storyParagraphSpans('')).toEqual([])
  })

  it('두 번째 이후 문단의 전역 오프셋을 그대로 받아들인다', () => {
    const spans = storyParagraphSpans(BODY)
    const anchor = at(2, 'boiled cabbage')
    expect(anchor.start).toBeGreaterThan(P2.length)
    expect(checkStoryAnchor(BODY, spans, anchor)).toEqual({ anchor, matches: true, problem: null })
  })

  it('음수 · 범위 밖 · 빈 구간 · 다른 문단 · 인용 불일치를 가른다', () => {
    const spans = storyParagraphSpans(BODY)
    const good = at(1, 'Winston')
    expect(checkStoryAnchor(BODY, spans, { ...good, start: -1 }).problem).toBe('range_invalid')
    expect(checkStoryAnchor(BODY, spans, { ...good, end: BODY.length + 1 }).problem).toBe('range_invalid')
    expect(checkStoryAnchor(BODY, spans, { ...good, end: good.start }).problem).toBe('range_invalid')
    expect(checkStoryAnchor(BODY, spans, { ...good, paragraph: 0 }).problem).toBe('outside_paragraph')
    expect(checkStoryAnchor(BODY, spans, { ...good, paragraph: 9 }).problem).toBe('paragraph_missing')
    expect(checkStoryAnchor(BODY, spans, { ...good, quote: 'Winsten' }).problem).toBe('quote_mismatch')
    // 문단 안 오프셋(옛 오해)을 넣으면 맞지 않는다.
    const local = P1.indexOf('Winston')
    expect(checkStoryAnchor(BODY, spans, { ...good, start: local, end: local + 7 }).matches).toBe(false)
  })

  it('서로게이트 쌍(한 글자)을 가르는 구간을 거부한다', () => {
    const body = 'A smile 😀 here.\n\nNext.'
    const spans = storyParagraphSpans(body)
    const emoji = body.indexOf('😀')
    expect(checkStoryAnchor(body, spans, { paragraph: 0, start: emoji, end: emoji + 2, quote: '😀' }).matches).toBe(true)
    expect(checkStoryAnchor(body, spans, { paragraph: 0, start: emoji + 1, end: emoji + 2, quote: body.slice(emoji + 1, emoji + 2) }).problem).toBe(
      'splits_surrogate'
    )
  })
})

describe('비교 모델', () => {
  it('선택한 단위의 원문 구간을 그 문단 안에서만 강조하고 생략을 따로 표시한다', () => {
    const comparison = buildStoryComparison(bundle(), 'u-clock')
    expect(comparison.unit?.unit_id).toBe('u-clock')
    expect(comparison.paragraph_total).toBe(3)
    expect(comparison.paragraphs.map((p) => p.index)).toEqual([1])
    const segments = comparison.paragraphs[0]!.segments
    expect(segments.map((s) => s.text).join('')).toBe(P1)
    expect(segments.find((s) => s.mark === 'unit')?.text).toBe('The clocks were striking thirteen.')
    expect(segments.find((s) => s.mark === 'omit')?.text).toBe('Winston slipped quickly through the glass doors.')
    expect(comparison.changes.map((c) => c.change_id)).toEqual(['c-clock'])
    expect(comparison.omits.map((c) => c.change_id)).toEqual(['c-omit'])
    expect(comparison.anchors.every((a) => a.matches)).toBe(true)
    expect(comparison.hook?.text).toBe('A clock strikes thirteen.')
  })

  it('다른 단위를 고르면 그 단위의 문단 · 변경 기록으로 바뀐다', () => {
    const comparison = buildStoryComparison(bundle(), 'u-hall')
    expect(comparison.paragraphs.map((p) => p.index)).toEqual([2])
    expect(comparison.paragraphs[0]!.segments.find((s) => s.mark === 'unit')?.text).toBe('boiled cabbage')
    expect(comparison.changes).toEqual([])
    expect(comparison.omits).toEqual([])
  })

  it('모르는 단위는 첫 단위로, 단위 순서는 order 순으로 읽는다', () => {
    const comparison = buildStoryComparison(bundle(), 'nope')
    expect(comparison.unit?.unit_id).toBe('u-cold')
    expect(comparison.units.map((u) => u.order)).toEqual([1, 2, 3])
  })

  it('범위 밖 앵커는 그리지 않고 불일치로 센다', () => {
    const broken = artifact({
      units: [{ unit_id: 'u-x', order: 1, title: null, text: 'x', source_anchors: [{ paragraph: 1, start: 9999, end: 10005, quote: 'x' }], preserves: [] }],
    })
    const comparison = buildStoryComparison(bundle({}, { artifact: broken }), 'u-x')
    // 단위 강조는 그리지 않는다(같은 문단의 생략 기록만 남는다).
    expect(comparison.paragraphs.flatMap((p) => p.segments).some((s) => s.mark === 'unit')).toBe(false)
    expect(comparison.anchors[0]!.problem).toBe('range_invalid')
    const withoutOmit = artifact({
      units: [{ unit_id: 'u-x', order: 1, title: null, text: 'x', source_anchors: [{ paragraph: 1, start: 9999, end: 10005, quote: 'x' }], preserves: [] }],
      change_log: [],
    })
    expect(buildStoryComparison(bundle({}, { artifact: withoutOmit }), 'u-x').paragraphs).toEqual([])
  })

  it('겹치는 구간은 단위 강조가 생략 표시보다 우선한다', () => {
    const segments = segmentParagraph('abcdef', [
      { start: 1, end: 5, kind: 'omit' },
      { start: 2, end: 4, kind: 'unit' },
      { start: -3, end: 99, kind: 'omit' },
    ])
    expect(segments).toEqual([
      { text: 'ab', mark: 'omit' },
      { text: 'cd', mark: 'unit' },
      { text: 'ef', mark: 'omit' },
    ])
  })
})

describe('목록 상태는 모든 판의 누적 이력이다', () => {
  it('옛 판의 자격 없는 검수로 현재 판을 「새 판 필요」라 하지 않는다', () => {
    expect(storySlotState(SLOT)).toBe('판본 제출됨 — 현재 판 상태는 열어서 확인')
    expect(storySlotHistory(SLOT)).toBe('판 2 · 검수 기록 1건 · 자격 0건(모든 판) · 철회 0')
  })

  it('옛 판 나쁜 검수 + 새 판 검수 없음 → 다음 작업은 검수다(현재 번들로 판정)', () => {
    expect(nextStoryAction({ slot: SLOT, bundle: bundle(), viewer: ADMIN }).kind).toBe('submit_review')
  })

  it('옛 판 나쁜 검수 + 새 판 좋은 검수 → 새 판 제출을 요구하지 않는다', () => {
    const next = nextStoryAction({ slot: SLOT, bundle: bundle({ reviews: [review(true)] }), viewer: ADMIN })
    expect(next.kind).toBe('record_rights')
  })

  it('발행 중 · 판본 미제출 · 검수 기록 없음', () => {
    expect(storySlotState({ ...SLOT, live_release_key: 'lsr_x' })).toBe('발행 중')
    expect(storySlotState({ ...SLOT, latest_version_id: null })).toBe('판본 미제출')
    expect(storySlotState({ ...SLOT, review_count: 0 })).toBe('검수 기록 없음')
  })
})

describe('다음 행동 하나', () => {
  it('판본 미제출 자리는 파일을 다시 열게 한다', () => {
    const next = nextStoryAction({ slot: { ...SLOT, latest_version_id: null }, bundle: null, viewer: ADMIN })
    expect(next.kind).toBe('reopen_files')
    expect(next.title).toBe('원천·편집 기준 파일을 다시 열기')
  })

  it('최신 판이 아니면 다시 불러오기', () => {
    expect(nextStoryAction({ slot: SLOT, bundle: bundle({}, { is_latest: false }), viewer: ADMIN }).kind).toBe('reload_latest')
    expect(nextStoryAction({ slot: { ...SLOT, latest_version_id: 'ver-3' }, bundle: bundle(), viewer: ADMIN }).kind).toBe('reload_latest')
  })

  it('제출 계정은 검수할 수 없다고 말한다', () => {
    const next = nextStoryAction({ slot: SLOT, bundle: bundle(), viewer: { uid: PRODUCER, role: 'admin' } })
    expect(next.kind).toBe('submit_review')
    expect(next.blocked).toBe('이 판을 제출한 계정은 검수·발행할 수 없습니다 — 다른 인증 스태프가 필요합니다')
  })

  it('자격 없는 현재 판 검수 → 새 판 제출', () => {
    expect(nextStoryAction({ slot: SLOT, bundle: bundle({ reviews: [review(true), review(false, 'r2')] }), viewer: ADMIN }).kind).toBe(
      'resubmit_edition'
    )
  })

  it('권리 미확인 → admin 권리 결정(큐레이터는 admin 전용)', () => {
    const b = bundle({ reviews: [review(true)] })
    expect(nextStoryAction({ slot: SLOT, bundle: b, viewer: ADMIN }).blocked).toBeNull()
    expect(nextStoryAction({ slot: SLOT, bundle: b, viewer: CURATOR }).blocked).toContain('admin 전용')
  })

  it('증명 없음 → 검증 증인, 다 갖추면 admin 발행', () => {
    const ready = bundle({ reviews: [review(true)], rights_ok: true })
    expect(nextStoryAction({ slot: SLOT, bundle: ready, viewer: CURATOR }).kind).toBe('attest')
    const attested = { ...ready, validation: { ...ready.validation, attested: true } }
    const publish = nextStoryAction({ slot: SLOT, bundle: attested, viewer: ADMIN })
    expect(publish.kind).toBe('publish')
    expect(publish.blocked).toBeNull()
    expect(nextStoryAction({ slot: SLOT, bundle: attested, viewer: { uid: PRODUCER, role: 'admin' } }).blocked).toContain('제출한 계정')
    expect(nextStoryAction({ slot: SLOT, bundle: attested, viewer: CURATOR }).blocked).toContain('admin 전용')
  })

  it('자산이 있는 판은 글 판본으로 새 판 제출', () => {
    const b = bundle({}, { artifact: artifact({ assets: [{ asset_id: 'a' }] }) })
    expect(nextStoryAction({ slot: SLOT, bundle: b, viewer: ADMIN }).kind).toBe('resubmit_edition')
  })

  it('발행 중 — 권리가 확인이면 철회, 아니면 권리 다시 결정', () => {
    const live = { release_key: 'lsr_1', published_at: '2026-10-25T03:00:00Z', withdrawn_at: null, available: true }
    const withdraw = nextStoryAction({ slot: SLOT, bundle: bundle({ releases: [live], rights_ok: true }), viewer: ADMIN })
    expect(withdraw.kind).toBe('withdraw')
    // 발행본은 자리 전체의 것 — 새 판이 공개된 것처럼 말하지 않고 발행 키로 가리킨다.
    expect(withdraw.reason).toContain('이 자리에 학습자에게 열린 발행본이 있습니다 — 발행 키 lsr_1')
    expect(withdraw.reason).not.toContain('이 판본은')
    expect(
      nextStoryAction({ slot: SLOT, bundle: bundle({ releases: [{ ...live, available: false }], rights_ok: false }), viewer: ADMIN }).kind
    ).toBe('record_rights')
  })
})

describe('보조 판정', () => {
  it('번역 권리는 원작 언어가 다르거나 번역 권리를 주장할 때만 필요하다', () => {
    expect(requiredStoryRights(bundle().source)).toEqual(['source_text'])
    expect(requiredStoryRights({ meta: { work: { original_language: 'fr' }, edition: { text_language: 'en' } } })).toEqual([
      'source_text',
      'translation',
    ])
    expect(
      requiredStoryRights({ meta: { work: { original_language: 'en' }, edition: { text_language: 'en' }, rights: [{ asset: 'translation' }] } })
    ).toEqual(['source_text', 'translation'])
  })

  it('원천 URL 은 http/https 이고 고칠 것이 없을 때만 링크가 된다', () => {
    expect(safeSourceHref('https://example.org/a?b=1')).toBe('https://example.org/a?b=1')
    expect(safeSourceHref('http://example.org')).toBe('http://example.org')
    expect(safeSourceHref('javascript:alert(1)')).toBeNull()
    expect(safeSourceHref('ftp://example.org')).toBeNull()
    expect(safeSourceHref(' https://example.org')).toBeNull()
    expect(safeSourceHref('https://example.org/\u0001')).toBeNull()
    expect(safeSourceHref(null)).toBeNull()
    expect(safeSourceHref(42)).toBeNull()
  })

  it('낡은 상태 실패 코드는 접두사와 무관하게 알아본다', () => {
    expect(isStaleStoryFailure({ code: 'story:not_latest_version' })).toBe(true)
    expect(isStaleStoryFailure({ code: 'edition_binding_stale' })).toBe(true)
    expect(isStaleStoryFailure({ code: 'story:attestation_binding_mismatch' })).toBe(true)
    expect(isStaleStoryFailure({ code: 'story:review_binding_mismatch' })).toBe(true)
    expect(isStaleStoryFailure({ code: 'story:rights_unconfirmed' })).toBe(false)
  })

  it('시각은 UTC 분 단위로 고정 표기한다', () => {
    expect(formatStoryTime('2026-10-25T09:05:59.123+09:00')).toBe('2026-10-25 00:05 UTC')
    expect(formatStoryTime(null)).toBe('없음')
    expect(formatStoryTime('not a time')).toBe('not a time')
  })
})

describe('등록 단계 게이트', () => {
  const check = (over: Partial<StoryCandidateCheck> = {}, plan: 'candidate' | 'hold' | 'fixture_only' | 'pending' = 'candidate'): StoryCandidateCheck => ({
    source: {
      snapshot_id: 's',
      work_key: 'w',
      identity_sha256: 'b'.repeat(64),
      text_sha256: 'a'.repeat(64),
      paragraph_count: 3,
      coverage: 'excerpt',
      synthetic: false,
      rights: [{ asset: 'source_text', status: 'claimed_by_source' }],
    },
    policy: { policy_sha256: 'c'.repeat(64), editions: [] },
    edition: { edition_key: 'e', edition_sha256: 'e'.repeat(64), activities_sha256: 'f'.repeat(64), unit_count: 3, plan_status: plan, plan_reasons: [] },
    files: [
      { file: 'source', ok: true, issues: [] },
      { file: 'policy', ok: true, issues: [] },
      { file: 'edition', ok: true, issues: [] },
    ],
    importable: plan !== 'fixture_only',
    ...over,
  })

  it('검사 전 · 문제 난 파일 · 합성 자료는 막는다', () => {
    expect(storyRegisterGate('source', null).ok).toBe(false)
    expect(storyRegisterGate('source', check({ files: [{ file: 'source', ok: false, issues: [] }] })).ok).toBe(false)
    const synthetic = check()
    synthetic.source!.synthetic = true
    expect(storyRegisterGate('source', synthetic)).toEqual({ ok: false, reason: '합성 자료 — 적재할 수 없음' })
    expect(storyRegisterGate('edition', check({}, 'fixture_only'))).toEqual({ ok: false, reason: '합성 자료 — 적재할 수 없음' })
  })

  it('관리자 초안(hold)은 판본 제출까지 허용한다 — 발행은 아니다', () => {
    expect(storyRegisterGate('edition', check({}, 'hold'))).toEqual({ ok: true })
    expect(storyRegisterGate('policy', check())).toEqual({ ok: true })
  })

  it('편집 기준 단계는 판본 파일 없이도 열린다', () => {
    const noEdition = check({ edition: null, files: [{ file: 'source', ok: true, issues: [] }, { file: 'policy', ok: true, issues: [] }], importable: false })
    expect(storyRegisterGate('policy', noEdition)).toEqual({ ok: true })
    expect(storyRegisterGate('edition', noEdition).ok).toBe(false)
  })
})

describe('candidatePlanLabel — 합성 사유가 있으면 hold 라도 적재 불가로 말한다', () => {
  it('S2 plan 이 합성 자료에 hold 를 내도(검수 없음) 「관리자 초안」이 아니라 적재 불가', () => {
    const label = candidatePlanLabel({
      plan_status: 'hold',
      plan_reasons: [{ blocks: 'fixture' }, { blocks: 'release' }],
    })
    expect(label).toBe('합성 자료 — 적재할 수 없음')
  })
  it('합성 사유가 없는 hold 는 관리자 초안 문구, fixture_only 는 적재 불가', () => {
    expect(candidatePlanLabel({ plan_status: 'hold', plan_reasons: [{ blocks: 'release' }] })).toBe('관리자 초안으로만 저장 · 학습자 발행 아님')
    expect(candidatePlanLabel({ plan_status: 'fixture_only', plan_reasons: [] })).toBe('합성 자료 — 적재할 수 없음')
  })
})

describe('철회 뒤 재발행 — 서버가 계산한 예상 발행 키와 철회본 키를 정확히 비교한다', () => {
  const ready = () => bundle({ reviews: [review(true)], rights_ok: true, validation: { binding: {}, binding_sha256: 'b'.repeat(64), attested: true } })
  const KEY = `lsr_${'1'.repeat(32)}`
  const OLD = `lsr_${'2'.repeat(32)}`
  const withdrawn = (release_key: string) => ({ release_key, published_at: '2026-10-25T10:00:00Z', withdrawn_at: '2026-10-25T11:00:00Z', available: false })

  it('같은 키의 철회본이 있으면 발행 대신 새 판 제출을 권한다(DB story:release_key_exists)', () => {
    const b = { ...ready(), releases: [withdrawn(KEY)], prospective_release_key: KEY }
    const next = nextStoryAction({ slot: SLOT, bundle: b, viewer: ADMIN })
    expect(next.kind).toBe('resubmit_edition')
    expect(next.reason).toContain('발행 키가 같아')
  })

  it('옛 판의 철회본(다른 키)은 새 판 발행을 막지 않는다', () => {
    const b = { ...ready(), releases: [withdrawn(OLD)], prospective_release_key: KEY }
    expect(nextStoryAction({ slot: SLOT, bundle: b, viewer: ADMIN }).kind).toBe('publish')
  })

  it('검수가 바뀌어 키가 달라졌거나 키를 모르면(null) 막지 않는다 — 최종 판정은 DB', () => {
    expect(nextStoryAction({ slot: SLOT, bundle: { ...ready(), releases: [withdrawn(KEY)], prospective_release_key: OLD }, viewer: ADMIN }).kind).toBe('publish')
    expect(nextStoryAction({ slot: SLOT, bundle: { ...ready(), releases: [withdrawn(KEY)], prospective_release_key: null }, viewer: ADMIN }).kind).toBe('publish')
  })
})

describe('storySlotOrigin — 같은 작품 · 판본 키의 서로 다른 자리를 가른다', () => {
  it('앞 8자가 같은 두 원천도 구분된다 — id 전체를 보인다', () => {
    const a = storySlotOrigin({ source_id: '00000000-0000-4000-8000-00000000000a', policy_id: '00000000-0000-4000-8000-0000000000c1' })
    const b = storySlotOrigin({ source_id: '00000000-0000-4000-8000-00000000000b', policy_id: '00000000-0000-4000-8000-0000000000c1' })
    expect(a).not.toBe(b)
    expect(a).toContain('00000000-0000-4000-8000-00000000000a')
    expect(b).toBe('원천 00000000-0000-4000-8000-00000000000b · 기준 00000000-0000-4000-8000-0000000000c1')
  })
})
