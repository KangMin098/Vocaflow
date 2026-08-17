// apps/web/src/app/admin/compose/__tests__/console-render.test.tsx
//
// ACP §20 콘솔 렌더 스모크 — 7면을 한 번씩 그려 본다.
//
// 왜 필요한가: 이 화면은 데이터가 대부분 비어 있는 상태로 시작한다(피드 0 · 취재 0 · 발주 0).
// 빈 배열에서 첫 원소를 꺼내거나 `.find()` 결과를 그대로 쓰는 실수는 **데이터가 생긴 뒤에야**
// 터지기 쉬운데, 그때는 이미 관리자가 쓰고 있다. 빈 상태와 채워진 상태를 둘 다 그려 둔다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { COMPOSE_TABS } from '@/lib/admin/compose-tabs'

import {
  ComposeConsoleClient,
  type AttestationRow,
  type BatchRow,
  type ComposeCounts,
  type ComposedRow,
  type FactRow,
  type FeedRow,
  type GateRow,
  type JobRow,
  type SourceRow,
  type TrackRow,
} from '../ComposeConsoleClient'

const EMPTY_COUNTS: ComposeCounts = {
  feeds: null,
  feedsEnabled: null,
  batches: null,
  facts: null,
  jobsPending: null,
  jobsClaimed: null,
  jobsDone: null,
  published: null,
}

const TRACKS: TrackRow[] = [
  {
    track: 'csat_korean',
    label: '수능 국내',
    feasible: true,
    composable: true,
    topics: '3/4',
    sources: 'noaa, voa',
    words: { min: 130, max: 190 },
    avgSentenceWords: 22,
    vBand: { min: 4, max: 8 },
    registers: ['expository'],
    skills: ['single_word'],
    activities: ['read', 'word_set', 'order', 'insert'],
    note: '가장 짧고 밀도 높은 유형',
  },
  {
    track: 'conversational',
    label: '생활 회화',
    feasible: true,
    composable: true,
    topics: '4/4',
    sources: 'bbc, ap',
    words: { min: 150, max: 260 },
    avgSentenceWords: 12,
    vBand: { min: 2, max: 6 },
    registers: ['news'],
    skills: ['idiom'],
    // 듣기 계열이 들어 있어야 "음성 없으면 잠김" 경로가 실제로 그려진다.
    activities: ['read', 'word_set', 'dictation', 'shadowing', 'discussion'],
    note: '소프트 뉴스가 재료',
  },
  {
    track: 'literary',
    label: '문학',
    feasible: false,
    composable: false,
    topics: '0/0',
    sources: '—',
    words: { min: 0, max: 0 },
    avgSentenceWords: 0,
    vBand: { min: 4, max: 9 },
    registers: ['narrative'],
    skills: ['polysemy'],
    activities: [],
    note: '재저작 대상 아님',
  },
]

const FEEDS: FeedRow[] = [
  {
    id: 'f1',
    source_key: 'bbc',
    url: 'https://bbc.co.uk/news/rss.xml',
    label: '세계 뉴스',
    enabled: true,
    robots_status: 'ok',
    robots_at: '2026-08-17T00:00:00Z',
    last_polled_at: '2026-08-17T00:00:00Z',
    last_found: 4,
    last_note: null,
  },
  {
    id: 'f2',
    source_key: 'reuters',
    url: 'https://reuters.com/rss',
    label: '통신사',
    enabled: false,
    robots_status: 'failed',
    robots_at: null,
    last_polled_at: null,
    last_found: null,
    last_note: null,
  },
]

const BATCHES: BatchRow[] = [
  {
    id: 'b1',
    topic: '2026-08 캘리포니아 중부 지진',
    event_occurred_at: '2026-08-14T09:00:00Z',
    status: 'ledger_ready',
    created_at: '2026-08-14T12:00:00Z',
  },
]

const SOURCES: SourceRow[] = [
  {
    id: 's1',
    batch_id: 'b1',
    publisher: 'reuters.com',
    url: 'https://reuters.com/a',
    published_at: '2026-08-14T09:00:00Z',
    access_basis: 'publisher-feed',
    wire: 'reuters',
  },
  {
    id: 's2',
    batch_id: 'b1',
    publisher: 'bbc.co.uk',
    url: 'https://bbc.co.uk/a',
    published_at: '2026-08-14T12:00:00Z',
    access_basis: 'publisher-feed',
    wire: null,
  },
]

const FACTS: FactRow[] = [
  {
    id: 'x1',
    batch_id: 'b1',
    claim: '3명이 경상으로 치료를 받았다',
    kind: 'figure',
    quote: null,
    quote_is_public: null,
    created_at: '2026-08-14T13:00:00Z',
  },
  {
    id: 'x2',
    batch_id: 'b1',
    claim: '흔들림이 약 20초 지속됐다',
    kind: 'event',
    quote: null,
    quote_is_public: null,
    created_at: '2026-08-14T13:05:00Z',
  },
]

// x1 은 독립 2계통, x2 는 1계통 — 화면이 후자를 경고로 표시해야 한다.
const ATTESTATIONS: AttestationRow[] = [
  { fact_id: 'x1', source_id: 's1', ordinal: 1 },
  { fact_id: 'x1', source_id: 's2', ordinal: 0 },
  { fact_id: 'x2', source_id: 's1', ordinal: 2 },
]

const JOBS: JobRow[] = [
  {
    id: 'j1',
    batch_id: 'b1',
    track: 'csat_korean',
    register: 'expository',
    target_v_level: 6,
    skill_focus: 'single_word',
    words_min: 130,
    words_max: 190,
    status: 'done',
    claimed_by: 'session-A',
    claimed_at: '2026-08-16T00:00:00Z',
    attempts: 1,
    last_error: null,
    article_id: 'a1',
  },
  {
    id: 'j2',
    batch_id: 'b1',
    track: 'conversational',
    register: 'news',
    target_v_level: 4,
    skill_focus: 'idiom',
    words_min: 150,
    words_max: 260,
    status: 'done',
    claimed_by: 'session-B',
    claimed_at: '2026-08-16T01:00:00Z',
    attempts: 1,
    last_error: null,
    article_id: 'a2',
  },
]

const COMPOSED: ComposedRow[] = [
  {
    id: 'a1',
    title: 'A quake on the central coast',
    status: 'ready',
    register: 'expository',
    cefr_level: 'B2',
    article_v_level: 6,
    word_count: 172,
    audio_url: null,
    compose_batch_id: 'b1',
    content_hash: 'hash-1',
  },
  {
    id: 'a2',
    title: 'People felt the ground move',
    status: 'ready',
    register: 'news',
    cefr_level: 'A2',
    article_v_level: 4,
    word_count: 210,
    audio_url: null, // 음성이 아직 없다 — 듣기 계열이 잠긴 것으로 보여야 한다
    compose_batch_id: 'b1',
    content_hash: 'hash-2',
  },
]

const GATES: GateRow[] = [
  {
    article_id: 'a1',
    invariant: 'I12 출처 독립성',
    severity: 'critical',
    verdict: 'PASS',
    detail: '사실 2건 전부 독립 2그룹에서 확인',
    content_hash: 'hash-1',
  },
  {
    article_id: 'a1',
    invariant: 'I14 구조 독립성',
    severity: 'critical',
    verdict: 'FAIL',
    detail: '서술 순서가 reuters.com 기사와 ρ=1.00 으로 일치한다',
    content_hash: 'hash-1',
  },
]

function render(tab: string, filled: boolean): string {
  return renderToString(
    <ComposeConsoleClient
      counts={filled ? { ...EMPTY_COUNTS, feedsEnabled: 1, feeds: 2 } : EMPTY_COUNTS}
      tracks={TRACKS}
      feeds={filled ? FEEDS : []}
      batches={filled ? BATCHES : []}
      jobs={filled ? JOBS : []}
      sources={filled ? SOURCES : []}
      facts={filled ? FACTS : []}
      attestations={filled ? ATTESTATIONS : []}
      composed={filled ? COMPOSED : []}
      gates={filled ? GATES : []}
      feedSourceOptions={[{ key: 'bbc', publisher: 'bbc.co.uk', tier: 'corroborating' }]}
      envMissing={false}
      initialTab={tab as never}
    />,
  )
}

describe('Compose 콘솔 렌더', () => {
  it.each([...COMPOSE_TABS])('%s 면이 빈 데이터로도 그려진다', (tab) => {
    expect(() => render(tab, false)).not.toThrow()
  })

  it.each([...COMPOSE_TABS])('%s 면이 채워진 데이터로도 그려진다', (tab) => {
    expect(() => render(tab, true)).not.toThrow()
  })

  it('소스 면은 재저작 불가 유형을 "대상 아님" 으로 구별한다', () => {
    const html = render('소스', true)
    expect(html).toContain('대상 아님')
    expect(html).toContain('수능 국내')
  })

  it('피드 면은 robots 실패를 눈에 띄게 알린다', () => {
    expect(render('피드', true)).toContain('실패 · 건너뜀')
  })

  it('원장 면은 독립 계통 2 미만인 사실을 경고한다', () => {
    const html = render('원장', true)
    expect(html).toContain('2 미만이면 쓸 수 없습니다')
  })

  it('작성 면에는 작성 버튼이 없다 — 드레인이 쓴다', () => {
    const html = render('작성', true)
    expect(html).toContain('발주 추가')
    expect(html).not.toContain('지금 작성')
  })

  it('가공 면은 음성이 없으면 듣기 계열이 잠긴 것으로 표시한다', () => {
    const html = render('가공', true)
    expect(html).toContain('음성 필요')
  })

  it('발행 면은 게이트 실패를 보여 주고 발행 버튼을 잠근다', () => {
    const html = render('발행', true)
    expect(html).toContain('I14 구조 독립성')
    expect(html).toContain('게이트를 통과해야 발행할 수 있습니다')
  })

  it('데이터가 비어도 다음에 무엇을 하라고 말한다 (빈 화면 금지)', () => {
    expect(render('발견', false)).toContain('활성 피드')
    expect(render('원장', false)).toContain('③ 발견에서 사건을 골라')
    expect(render('작성', false)).toContain('취재 묶음을 만들고')
    expect(render('가공', false)).toContain('⑤ 작성에서 발주를 만들고')
  })
})
