// apps/web/src/app/admin/curation/__tests__/story-curation-client.test.tsx
//
// 이야기 판본 라인 렌더 회귀(renderToString — node 환경이라 effect · 클릭은 돌지 않는다).
// 서버 액션은 가짜 모듈로 바꾸고, 렌더만으로는 어떤 액션도 불리지 않는다는 것(화면 진입이 쓰기를 하지 않는다)을 함께 잠근다.
// 실제 상호작용(파일 선택 · 클릭 · 뒤로/앞으로)은 격리 브라우저 하네스가 검증한다.

import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { StoryBundle, StoryCandidateCheck, StoryFailure, StorySlotRow, StoryViewer } from '@/lib/library/story/types'

const actions = vi.hoisted(() => ({
  listStorySlotsAction: vi.fn(),
  loadStoryBundleAction: vi.fn(),
  checkStoryCandidateAction: vi.fn(),
  registerStoryCandidateAction: vi.fn(),
  submitStoryReviewAction: vi.fn(),
  recordStoryRightsAction: vi.fn(),
  attestStoryValidationAction: vi.fn(),
  publishStoryAction: vi.fn(),
  withdrawStoryAction: vi.fn(),
}))
const search = vi.hoisted(() => ({ value: 'line=story' }))

vi.mock('@/app/admin/curation/story-actions', () => actions)
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(search.value) }))

import {
  StoryBundleStatus,
  StoryBundleView,
  StoryCandidateReport,
  StoryCurationClient,
  StoryFailureNotice,
  StorySlotList,
} from '../StoryCurationClient'

const P0 = 'It was a bright cold day in April.'
const P1 = 'The clocks were striking thirteen. Winston slipped quickly through the glass doors.'
const BODY = `${P0}\n\n${P1}`
const anchor = (paragraph: number, quote: string) => {
  const start = BODY.indexOf(quote)
  return { source_sha256: 'a'.repeat(64), paragraph, start, end: start + quote.length, quote }
}
const PRODUCER = 'producer-0000'
const ADMIN: StoryViewer = { uid: 'admin-0000', role: 'admin' }
const CURATOR: StoryViewer = { uid: 'curator-0000', role: 'curator' }

function bundle(over: Partial<StoryBundle> = {}, sourceUrl: unknown = null): StoryBundle {
  return {
    source: {
      id: 'src-1',
      meta: {
        work: { title: '1984', original_language: 'en' },
        edition: { text_language: 'en', edition_label: 'Synthetic test edition', source_url: sourceUrl },
        rights: [{ asset: 'source_text' }],
      },
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
      id: 'ver-1',
      artifact: {
        title: 'Thirteen',
        produced_by: { agent: 'drain-agent', session_id: 's1', provenance: 'ai_generated' },
        hook: { text: 'A clock strikes thirteen.', source_anchors: [anchor(1, 'The clocks were striking thirteen.')], spoiler_free: true },
        units: [
          { unit_id: 'u-cold', order: 1, title: 'Cold', text: 'It was cold.', source_anchors: [anchor(0, 'bright cold day')], preserves: [] },
          {
            unit_id: 'u-clock',
            order: 2,
            title: 'Clock',
            text: 'The clocks struck thirteen.',
            source_anchors: [anchor(1, 'The clocks were striking thirteen.')],
            preserves: [],
          },
        ],
        change_log: [
          {
            change_id: 'c-cold',
            type: 'language_modernization',
            operation: 'condense',
            unit_ids: ['u-cold'],
            source_anchors: [anchor(0, 'bright cold day')],
            rationale: 'shorter sentence',
            learner_note: null,
          },
        ],
        activities: [],
        assets: [],
      },
      edition_sha256: 'e'.repeat(64),
      activities_sha256: 'f'.repeat(64),
      submitted_by: PRODUCER,
      submitted_at: '2026-10-25T01:00:00Z',
      is_latest: true,
    },
    reviews: [],
    validation: { binding: {}, binding_sha256: '9'.repeat(64), attested: false },
    rights_ok: false,
    rights: [],
    releases: [],
    ...over,
  }
}

const SLOT: StorySlotRow = {
  slot_id: '11111111-2222-3333-4444-555555555555',
  work_key: 'nineteen-eighty-four',
  edition_key: 'thirteen-story',
  kind: 'story_edition',
  coverage: 'excerpt',
  source_id: 'src-1',
  policy_id: 'pol-1',
  latest_version_id: 'ver-1',
  version_count: 1,
  review_count: 0,
  qualifying_review_count: 0,
  live_release_key: null,
  withdrawn_release_count: 0,
}

const goodReview: StoryBundle['reviews'][number] = {
  id: 'r1',
  review: { reviewer: { kind: 'human', agent: 'reviewer-claim' } },
  review_sha256: '1'.repeat(64),
  verdict: 'approve',
  qualifies: true,
  submitted_by: 'reviewer-0000',
  submitted_at: '2026-10-25T02:00:00Z',
}

const html = (element: Parameters<typeof renderToString>[0]) => renderToString(element)
const text = (markup: string) => markup.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
const noop = async () => {}

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockReset()
  search.value = 'line=story'
})

describe('라인 진입은 읽기만 한다', () => {
  it('첫 렌더는 불러오는 중이고 어떤 서버 액션도 부르지 않는다', () => {
    search.value = `line=story&story_slot=${SLOT.slot_id}`
    const markup = html(createElement(StoryCurationClient))
    expect(markup).toContain('aria-busy="true"')
    expect(text(markup)).toContain('판본 자리를 불러오는 중입니다')
    expect(text(markup)).toContain('후보 파일 열기')
    for (const fn of Object.values(actions)) expect(fn).not.toHaveBeenCalled()
  })

  it('파일 패널은 URL 의 story_panel=files 로만 열린다', () => {
    search.value = 'line=story&story_panel=files'
    const markup = text(html(createElement(StoryCurationClient)))
    expect(markup).toContain('후보 파일 검사 · 등록')
    expect(markup).toContain('원천 스냅숏 (필수)')
    expect(markup).toContain('파일 패널 닫기')
  })

  it('화면 코드는 브라우저 저장소 · 텔레메트리를 쓰지 않는다', () => {
    for (const file of ['../StoryCurationClient.tsx', '../story-view.ts']) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8')
      expect(source).not.toMatch(/localStorage|sessionStorage|lib\/analytics|trackEvent|posthog/)
    }
  })
})

describe('판본 자리 목록', () => {
  it('선택은 aria-current, 판본 미제출 · 누적 이력을 그대로 말한다', () => {
    const markup = html(
      createElement(StorySlotList, {
        slots: [SLOT, { ...SLOT, slot_id: '22222222-2222-3333-4444-555555555555', latest_version_id: null, version_count: 0 }],
        selected: SLOT.slot_id,
        loading: false,
        onSelect: () => {},
      })
    )
    expect(markup.match(/aria-current="true"/g)).toHaveLength(1)
    expect(text(markup)).toContain('판본 미제출')
    expect(text(markup)).toContain('검수 기록 0건 · 자격 0건(모든 판)')
  })
})

describe('번들 — 비교 · 상태 · 다음 작업', () => {
  it('단위 선택이 원문 구간을 강조하고 그 단위의 변경 기록만 보인다', () => {
    const markup = html(createElement(StoryBundleView, { slot: SLOT, bundle: bundle(), viewer: ADMIN, onRefresh: noop, onOpenFiles: () => {} }))
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain('aria-pressed="false"')
    expect(markup).toMatch(/<mark[^>]*>bright cold day<\/mark>/)
    expect(text(markup)).toContain('shorter sentence')
    expect(text(markup)).toContain('진입 장면 — 읽기 순서 밖 미리보기')
    expect(text(markup)).not.toContain('Winston slipped')
  })

  it('검수가 없으면 다른 스태프 검수가 다음 작업이다', () => {
    const markup = text(html(createElement(StoryBundleView, { slot: SLOT, bundle: bundle(), viewer: ADMIN, onRefresh: noop, onOpenFiles: () => {} })))
    expect(markup).toContain('다른 스태프의 검수 결과 올리기')
    expect(markup).toContain('검수 결과 파일 (.json)')
  })

  it('제출 계정에게는 두 번째 스태프가 필요하다고 말한다', () => {
    const markup = text(
      html(createElement(StoryBundleView, { slot: SLOT, bundle: bundle(), viewer: { uid: PRODUCER, role: 'curator' }, onRefresh: noop, onOpenFiles: () => {} }))
    )
    expect(markup).toContain('이 판을 제출한 계정은 검수·발행할 수 없습니다 — 다른 인증 스태프가 필요합니다')
  })

  it('큐레이터에게 권리 결정은 admin 전용이다', () => {
    const markup = text(
      html(createElement(StoryBundleView, { slot: SLOT, bundle: bundle({ reviews: [goodReview] }), viewer: CURATOR, onRefresh: noop, onOpenFiles: () => {} }))
    )
    expect(markup).toContain('admin 권리 결정')
    expect(markup).toContain('admin 전용')
    expect(markup).not.toContain('근거 (필수)')
  })

  it('admin 의 권리 폼은 원문 · 번역만 제시한다(오디오 · 삽화 없음)', () => {
    const markup = text(
      html(createElement(StoryBundleView, { slot: SLOT, bundle: bundle({ reviews: [goodReview] }), viewer: ADMIN, onRefresh: noop, onOpenFiles: () => {} }))
    )
    expect(markup).toContain('근거 (필수)')
    expect(markup).toContain('원문 텍스트 (필요)')
    expect(markup).toContain('번역 (이 원천에는 필요 없음)')
    expect(markup).not.toMatch(/오디오 \(|삽화 \(/)
  })

  it('다 갖추면 admin 발행 — 텍스트 판본 안내가 발행 옆에 있다', () => {
    const ready = bundle({
      reviews: [goodReview],
      rights_ok: true,
      validation: { binding: {}, binding_sha256: '9'.repeat(64), attested: true },
    })
    const markup = text(html(createElement(StoryBundleView, { slot: SLOT, bundle: ready, viewer: ADMIN, onRefresh: noop, onOpenFiles: () => {} })))
    expect(markup).toContain('admin 발행')
    expect(markup).toContain('텍스트 판본만 발행합니다')
  })

  it('옛 판의 살아 있는 발행본은 자리 단위로 말하고 철회 대상 키를 그대로 보인다', () => {
    const live = { release_key: 'lsr_0123456789abcdef0123456789abcdef', published_at: '2026-10-25T03:00:00Z', withdrawn_at: null, available: true }
    const markup = text(
      html(createElement(StoryBundleView, { slot: SLOT, bundle: bundle({ releases: [live], rights_ok: true }), viewer: ADMIN, onRefresh: noop, onOpenFiles: () => {} }))
    )
    expect(markup).toContain('이 자리에 열린 발행본 — 필요하면 철회')
    expect(markup).toContain(`철회 대상 발행 키 · ${live.release_key}`)
    expect(markup).toContain('판이 아니라 자리 전체의 발행본입니다')
    expect(markup).not.toContain('이 판본은 학습자에게 열려')
  })

  it('파일의 생산 · 검수자 표기는 주장으로만 보인다', () => {
    const markup = text(html(createElement(StoryBundleStatus, { bundle: bundle({ reviews: [goodReview] }), viewer: ADMIN })))
    expect(markup).toContain('생산 표기 — 파일의 주장 · 권한 근거 아님')
    expect(markup).toContain('검수자 표기 — 파일의 주장')
  })

  it('원천 URL 은 http/https 만 링크이고 저장값을 고치지 않는다', () => {
    const link = html(createElement(StoryBundleStatus, { bundle: bundle({}, 'https://example.org/book?id=1'), viewer: ADMIN }))
    expect(link).toMatch(/<a[^>]*href="https:\/\/example.org\/book\?id=1"[^>]*rel="noopener noreferrer"/)
    const script = html(createElement(StoryBundleStatus, { bundle: bundle({}, 'javascript:alert(1)'), viewer: ADMIN }))
    expect(script).not.toContain('href="javascript')
    expect(text(script)).toContain('javascript:alert(1)')
    const padded = html(createElement(StoryBundleStatus, { bundle: bundle({}, ' https://example.org'), viewer: ADMIN }))
    expect(padded).not.toContain('<a')
    expect(text(html(createElement(StoryBundleStatus, { bundle: bundle(), viewer: ADMIN })))).toContain('원천 URL · 없음')
  })
})

describe('후보 파일 검사 결과', () => {
  const check = (plan: 'candidate' | 'hold' | 'fixture_only'): StoryCandidateCheck => ({
    source: {
      snapshot_id: 's',
      work_key: 'nineteen-eighty-four',
      identity_sha256: 'b'.repeat(64),
      text_sha256: 'a'.repeat(64),
      paragraph_count: 2,
      coverage: 'excerpt',
      synthetic: plan === 'fixture_only',
      rights: [{ asset: 'source_text', status: 'claimed_by_source' }],
    },
    policy: { policy_sha256: 'c'.repeat(64), editions: [{ edition_key: 'thirteen-story', kind: 'story_edition', coverage: 'excerpt', transformation: 'language_modernization' }] },
    edition: {
      edition_key: 'thirteen-story',
      edition_sha256: 'e'.repeat(64),
      activities_sha256: 'f'.repeat(64),
      unit_count: 2,
      plan_status: plan,
      plan_reasons: plan === 'hold' ? [{ code: 'rights_unconfirmed:source_text', blocks: 'release', message: '원문 권리 미확인' }] : [],
    },
    files: [
      { file: 'source', ok: true, issues: [] },
      { file: 'policy', ok: true, issues: [] },
      { file: 'edition', ok: plan !== 'fixture_only', issues: plan === 'fixture_only' ? [{ code: 'synthetic', path: '/produced_by', message: '합성 생산 기록' }] : [] },
    ],
    importable: plan !== 'fixture_only',
  })

  it('보류는 관리자 초안으로만, 권리 기록은 파일의 주장으로 보인다', () => {
    const markup = text(html(createElement(StoryCandidateReport, { check: check('hold') })))
    expect(markup).toContain('관리자 초안으로만 저장 · 학습자 발행 아님')
    expect(markup).toContain('원문 권리 미확인')
    expect(markup).toContain('권리 기록 — 파일의 주장 · 권한 근거 아님')
  })

  it('합성 자료는 적재할 수 없다고 말하고 문제를 경로와 함께 보인다', () => {
    const markup = text(html(createElement(StoryCandidateReport, { check: check('fixture_only') })))
    expect(markup).toContain('합성 자료 — 적재할 수 없음')
    expect(markup).toContain('/produced_by')
  })

  it('후보는 아직 DB 검수 · 권리 · 증인이 필요하다고 말한다', () => {
    expect(text(html(createElement(StoryCandidateReport, { check: check('candidate') })))).toContain('검증 증인')
  })
})

describe('실패 안내', () => {
  const failure = (code: string, retryable: boolean): StoryFailure => ({
    ok: false,
    code,
    message: '안내 문구',
    recovery: '복구 문구',
    stage: 'rpc',
    issues: [{ code: 'x_issue', path: '/units/0', message: '항목 문제' }],
    retryable,
  })

  it('낡은 상태는 다시 불러오기, 다시 보내도 되는 실패만 다시 시도를 낸다', () => {
    const stale = text(html(createElement(StoryFailureNotice, { failure: failure('story:not_latest_version', false), onRetry: () => {}, onReload: () => {} })))
    expect(stale).toContain('최신 상태 다시 불러오기')
    expect(stale).not.toContain('다시 시도')
    expect(stale).toContain('복구 문구')
    expect(stale).toContain('/units/0')
    const retry = text(html(createElement(StoryFailureNotice, { failure: failure('network_failed', true), onRetry: () => {} })))
    expect(retry).toContain('다시 시도')
    expect(retry).not.toContain('최신 상태 다시 불러오기')
  })
})
