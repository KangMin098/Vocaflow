// apps/web/src/components/library/story/__tests__/story-render.test.tsx
//
// 서가 · 독서 화면 렌더 회귀(renderToString — node 환경이라 effect · 클릭은 돌지 않는다).
// 렌더만으로는 위치 · 완료 · 이벤트가 하나도 나가지 않는다는 것(화면 진입이 기록하지 않는다)을 함께 잠근다.
// 클릭 · 응답 순서 · 인증 전환은 story-reader-session.test.ts 가, 실제 브라우저 상호작용은 격리 하네스가 검증한다.

import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }))
vi.mock('@/lib/analytics/client', () => ({ track: vi.fn() }))

import { track } from '@/lib/analytics/client'
import type { StoryCatalogPageState, StoryReaderPageState } from '@/lib/library/story/learner-types'

import { StoryCatalog } from '../StoryCatalog'
import { StoryReader } from '../StoryReader'
import { StorySourcePanel } from '../StorySourcePanel'
import { StoryUnitText } from '../StoryUnitText'
import { StoryVaultReturnBar } from '../StoryVaultReturn'
import { StoryWordSave } from '../StoryWordSave'
import { WordVaultBrowseClient, WordVaultViewerGate } from '@/components/wordvault/WordVaultBrowseClient'
import { vocabRowToWord } from '@/lib/wordvault/browse-queries'
import { storyVaultHref } from '@/lib/library/story/return-context'
import type { WordLookup } from '@/lib/library/reader-queries'
import type { StoryAuthSource } from '../use-story-auth-guard'
import {
  CAUTION_A,
  CAUTION_B,
  KEY_A,
  KEY_B,
  KEY_C,
  OTHER,
  UNIT_TEXT,
  VIEWER,
  catalogGuidance,
  context,
  guidanceView,
  progressRow,
  readyState,
  release,
  unitBody,
} from './fixtures'

/** 시험 전용 — 브라우저 신원을 동기적으로 아는 원천(undefined = 확인 전). 실제 브라우저 원천은 이것을 구현하지 않는다. */
const knownAuth = (userId: string | null | undefined): StoryAuthSource => ({
  subscribe: () => () => {},
  currentUserId: () => new Promise<string | null>(() => {}),
  testOnlyKnownUserId: () => userId,
})
const LOGIN = '/login?next=%2Flibrary%2Fstories'

function catalog(state: StoryCatalogPageState, onEvent = vi.fn(), auth?: StoryAuthSource) {
  const source = auth ?? knownAuth(state.status === 'ready' ? state.viewerId : null)
  return { html: renderToString(<StoryCatalog state={state} onEvent={onEvent} authSource={source} />), onEvent }
}

function reader(state: StoryReaderPageState, auth: StoryAuthSource = knownAuth(state.status === 'ready' ? state.viewerId : null)) {
  const actions = { recordPosition: vi.fn(), completeUnit: vi.fn() }
  const onEvent = vi.fn()
  const onRefresh = vi.fn()
  const html = renderToString(
    <StoryReader state={state} releaseKey={KEY_A} actions={actions} onEvent={onEvent} onRefresh={onRefresh} authGuard={auth} />,
  )
  // 렌더는 기록하지 않는다
  expect(actions.recordPosition).not.toHaveBeenCalled()
  expect(actions.completeUnit).not.toHaveBeenCalled()
  expect(onEvent).not.toHaveBeenCalled()
  expect(track).not.toHaveBeenCalled()
  return html
}

const ready = (over: Partial<Extract<StoryCatalogPageState, { status: 'ready' }>> = {}): StoryCatalogPageState => ({
  status: 'ready',
  signedIn: true,
  viewerId: VIEWER,
  releases: [
    release(),
    release({ releaseKey: KEY_B, editionKey: 'easy', kind: 'easy_reader', targetCefr: 'A2', coverage: 'episode', completionLabel: 'adapted_partial' }),
  ],
  progress: [progressRow()],
  progressError: null,
  guidance: catalogGuidance(),
  ...over,
})

describe('StoryCatalog', () => {
  it('작품 하나 · 판본 둘 — 실제 수 · HOOK 이 시작 행동보다 먼저 · 편집 목표 · 범위 문구', () => {
    const { html, onEvent } = catalog(ready())
    expect((html.match(/data-story-work="true"/g) ?? []).length).toBe(1)
    expect(html).toContain('작품 1편 · 판본 2개')
    const hookAt = html.indexOf('data-story-hook')
    const firstAction = html.indexOf('data-story-open')
    expect(hookAt).toBeGreaterThan(0)
    expect(hookAt).toBeLessThan(firstAction)
    expect(html).toContain('편집 목표 난이도 B1')
    expect(html).toContain('편집 목표 난이도 A2')
    expect(html).toContain('작품 전체 각색')
    expect(html).toContain('에피소드')
    expect(html).not.toMatch(/원문 완독|진단 결과|내 수준|mastery/i)
    // 내 진도 — 위치와 완료 표시를 나눠 말한다
    expect(html).toContain('마지막으로 연 단위 2/3')
    expect(html).toContain('완료 표시 1/3')
    expect(onEvent).not.toHaveBeenCalled() // 이벤트는 effect(마운트 뒤)에서만
  })

  it('서가 완료는 DB 완료 기록(completedAt) + 전 단위 표시일 때만 — 전권은 각색 완독 · 에피소드는 이 부분 읽기 완료', () => {
    const doneAt = '2026-10-25T02:00:00Z'
    const { html } = catalog(
      ready({
        progress: [
          progressRow({ completedUnitCount: 3, completedAt: doneAt }),
          progressRow({ releaseKey: KEY_B, completionLabel: 'adapted_partial', countsAsWorkCompletion: false, completedUnitCount: 3, completedAt: doneAt }),
        ],
      }),
    )
    expect(html).toContain('각색 완독')
    expect(html).toContain('이 부분 읽기 완료')
    // 수는 다 찼지만 완료 기록이 없으면 완료라 말하지 않는다
    const pending = catalog(ready({ progress: [progressRow({ completedUnitCount: 3, completedAt: null })] })).html
    expect(pending).toContain('완료 표시 3/3')
    expect(pending).not.toContain('각색 완독')
  })

  it('로그인 전: 메타 + HOOK 만 · 시작은 로그인으로(복귀 = 고른 판본 입구 · D4-UX01) · 진도 없음', () => {
    const { html } = catalog(ready({ signedIn: false, viewerId: null, progress: null }))
    expect(html).toContain('data-story-hook')
    // 판본마다 자기 입구로 돌아오는 공용 복귀 주소(next) — 서가 일반 복귀가 아니다
    for (const key of [KEY_A, KEY_B]) expect(html).toContain(`href="/login?next=${encodeURIComponent(`/library/stories/${key}`)}"`)
    expect(html).not.toContain(`href="${LOGIN}"`)
    expect((html.match(/data-story-open="login"/g) ?? []).length).toBe(2)
    expect(html).toContain('로그인하고 읽기')
    expect(html).not.toContain(`/library/stories/${KEY_A}`)
    expect(html).not.toContain('data-story-progress-line')
  })

  it('빈 서가는 정직한 빈 상태(지어낸 예시 없음) · 조회 실패는 다른 문구 + 다시 시도', () => {
    const empty = catalog(ready({ releases: [], progress: [] })).html
    expect(empty).toContain('아직 공개된 이야기가 없어요')
    expect(empty).not.toContain('data-story-work')
    expect(empty).not.toContain('data-story-counts')

    const { html, onEvent } = catalog({ status: 'error', failure: { ok: false, code: 'temporary', message: '서버에 연결하지 못했어요.', retryable: true } })
    expect(html).toContain('이야기 서가를 불러오지 못했어요')
    expect(html).toContain('다시 시도')
    expect(html).not.toContain('아직 공개된 이야기가 없어요')
    expect(onEvent).not.toHaveBeenCalled()
  })

  it('열 수 없는 판본 기록은 링크 · 본문 없이 기록으로만', () => {
    const { html } = catalog(
      ready({
        progress: [progressRow({ releaseKey: KEY_C, releaseAvailable: false, completedUnitCount: 2 }), progressRow({ releaseKey: 'lsr_' + 'd'.repeat(32), workKey: 'gone', releaseAvailable: false })],
      }),
    )
    expect(html).toContain('data-story-history="work"')
    expect(html).toContain('data-story-history="orphan"')
    expect(html).not.toContain(`/library/stories/${KEY_C}`)
    expect(html).toContain('완료 표시 2/3')
  })

  it('진도 조회 실패는 서가를 지우지 않고 따로 알린다', () => {
    const { html } = catalog(ready({ progress: null, progressError: { ok: false, code: 'temporary', message: '잠시 뒤', retryable: true } }))
    expect(html).toContain('data-story-progress="error"')
    expect(html).toContain('data-story-work')
  })

  it('서버 viewerId 를 DOM 에 싣지 않는다', () => {
    expect(catalog(ready()).html).not.toContain(VIEWER)
  })
})

describe('StoryReader', () => {
  it('로그인 전: 로그인 CTA · 메타 · HOOK 만 — 본문 · 목차 없음', () => {
    const html = reader({ status: 'signed_out', loginHref: '/login?next=x', release: release(), guidance: guidanceView() })
    expect(html).toContain('href="/login?next=x"')
    expect(html).toContain('data-story-hook')
    expect(html).not.toContain('data-story-body')
    expect(html).not.toContain('data-story-toc')
  })

  it('차단 계정 · 이용 불가 상태는 본문 없이 정직하게', () => {
    expect(reader({ status: 'blocked' })).toContain('data-story-state="blocked"')
    const notReady = reader({ status: 'unavailable', failure: { ok: false, code: 'reader_not_ready', message: '아직 준비 중이에요.', retryable: false } })
    expect(notReady).toContain('읽기 화면 준비 중')
    expect(notReady).not.toContain('data-story-body')
    expect(notReady).not.toContain('data-story-retry')
    const temp = reader({ status: 'unavailable', failure: { ok: false, code: 'temporary', message: '잠시 뒤', retryable: true } })
    expect(temp).toContain('data-story-retry')
    for (const code of ['release_unavailable', 'unit_not_found', 'reader_data_invalid'] as const) {
      const html = reader({ status: 'unavailable', failure: { ok: false, code, message: 'm', retryable: false } })
      expect(html).toContain(`data-story-state="${code}"`)
      expect(html).not.toContain('data-story-body')
    }
  })

  it('작품 입구(?unit 없음): 본문 없이 목차 · 진도 · 다음 행동 하나(이어 읽기)', () => {
    const html = reader(readyState({ unit: null }))
    expect(html).toContain('data-story-reader="entry"')
    expect(html).not.toContain('data-story-body')
    expect((html.match(/data-story-go="resume"/g) ?? []).length).toBe(1)
    expect(html).toContain('마지막으로 연 단위 2/3')
    expect(html).toContain('완료 표시 1/3')
    expect(html).not.toContain('data-story-source-panel')
  })

  it('기록이 없으면 다음 행동은 처음부터(start 0)', () => {
    const ctx = context({ progress: null, toc: context().toc.map((t) => ({ ...t, completed: false })) })
    const html = reader(readyState({ unit: null, context: ctx }))
    expect(html).toMatch(/data-story-go="start"[^>]*data-unit="0"|data-unit="0"[^>]*data-story-go="start"/)
    expect(html).toContain('아직 읽은 기록이 없어요')
  })

  it('읽기 화면: 본문은 텍스트 노드(HTML 해석 없음) · 읽음 표시 버튼은 이동과 별개 · 원문 대응은 닫혀 있다', () => {
    const html = reader(readyState())
    expect(html).toContain('data-story-body')
    expect(html).toContain('&lt;b&gt;not bold&lt;/b&gt;')
    expect(html).not.toContain('<b>not bold</b>')
    expect((html.match(/<p>/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(html).toContain('data-story-complete="ready"')
    expect(html).toContain('이 단위 읽음 표시')
    expect(html).toContain('data-story-go="prev"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('data-story-source-panel')
    expect(html).toContain('tabindex="-1"')
    expect(html).toContain('href="#story-content"')
    expect(html).toContain('aria-live="polite"')
    expect(html).not.toContain(VIEWER)
  })

  it('이미 표시한 단위는 다시 누를 버튼 대신 표시됨 · 마지막 단위 도착만으로 완료가 아니다', () => {
    const ctx = context({ unit: { unitIndex: 2, unitTitle: 'Rock', anchors: [] }, progress: { lastUnitIndex: 2, furthestUnitIndex: 2, completedUnitCount: 1, completed: false } })
    const html = reader(readyState({ context: ctx, unit: { releaseKey: KEY_A, unitIndex: 2, unitCount: 3, unitTitle: 'Rock', text: 'End.' } }))
    expect(html).toContain('완료 표시 1/3')
    expect(html).not.toContain('각색 완독')
    expect(html).not.toContain('data-story-done')

    const marked = context({ toc: context().toc.map((t) => ({ ...t, completed: t.unitIndex !== 2 })), progress: { lastUnitIndex: 1, furthestUnitIndex: 1, completedUnitCount: 2, completed: false } })
    const html2 = reader(readyState({ context: marked }))
    expect(html2).toContain('data-story-complete="marked"')
    expect(html2).toContain('다음 단위 읽기')
  })

  it('전 단위 표시: 전권은 각색 완독 · 부분 판본은 이 부분 읽기 완료', () => {
    const all = context().toc.map((t) => ({ ...t, completed: true }))
    const full = context({ toc: all, progress: { lastUnitIndex: 1, furthestUnitIndex: 2, completedUnitCount: 3, completed: true } })
    expect(reader(readyState({ context: full }))).toContain('각색 완독')
    const partial = context({ ...full, coverage: 'episode', completionLabel: 'adapted_partial', countsAsWorkCompletion: false })
    const html = reader(readyState({ context: partial }))
    expect(html).toContain('이 부분 읽기 완료')
    expect(html).not.toContain('각색 완독')
  })

  it('다른 판본: 링크 + 따로 기록 안내 · null 은 「불러오지 못했어요」 · 빈 목록은 「없어요」', () => {
    const html = reader(readyState())
    expect(html).toContain(`/library/stories/${KEY_B}`)
    expect(html).toContain('따로 기록돼요')
    expect(reader(readyState({ siblings: null }))).toContain('다른 판본을 불러오지 못했어요')
    const none = reader(readyState({ siblings: [] }))
    expect(none).toContain('다른 판본은 아직 없어요')
    expect(none).not.toContain('불러오지 못했어요')
  })

  it('주소의 발행 키와 서버 상태가 다르면 내용을 그리지 않는다', () => {
    const html = reader(readyState({ context: context({ releaseKey: KEY_B }) }))
    expect(html).toContain('data-story-state="reader_data_invalid"')
    expect(html).not.toContain('data-story-body')
  })
})

describe('StorySourcePanel', () => {
  const base = context().source
  const render = (sourceUrl: string | null, over: Partial<typeof base> = {}) =>
    renderToString(
      <StorySourcePanel
        id="p"
        source={{ ...base, ...over, sourceUrl }}
        anchors={context().unit.anchors}
        unitIndex={1}
        unitTitle="Gull"
        selected={0}
        onSelect={() => {}}
      />,
    )

  it('http(s) 만 새 창 링크(rel noopener noreferrer)', () => {
    const html = render('https://example.org/gull-rock')
    expect(html).toContain('href="https://example.org/gull-rock"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('링크 href 는 저장된 주소 글자 그대로(정규화 없음) · 공백이 낀 값은 글자로만', () => {
    for (const url of ['HTTP://Example.ORG', 'https://example.org', 'https://example.org/a%7Eb?x=1#frag']) {
      const html = render(url)
      expect(html, url).toContain(`href="${url}"`)
      expect(html, url).toContain('data-story-source-link')
    }
    const padded = render(' https://example.org/ ')
    expect(padded).not.toContain('data-story-source-link')
    expect(padded).toContain('data-story-source-text')
  })

  it('javascript: · data: · ftp: 는 링크가 아니라 글자로만', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,<script>x</script>', 'ftp://example.org/x']) {
      const html = render(bad)
      expect(html, bad).not.toContain('data-story-source-link')
      expect(html, bad).not.toMatch(/href="(javascript|data|ftp):/i)
      expect(html, bad).toContain('data-story-source-text')
    }
  })

  it('저장된 인용 그대로 + 원문 N문단 · 고른 인용이 어느 단위의 근거인지 말한다 · 번역본이면 번역자', () => {
    const html = render(null, { originalLanguage: 'fr', translator: 'T. Ranslator' })
    expect(html).toContain('원문 3문단')
    expect(html).toContain('the gull sat as still as stone')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('2번째 단위 · Gull의 근거')
    expect(html).toContain('번역본')
    expect(html).toContain('T. Ranslator')
    expect(html).not.toContain('data-story-source-link')
  })
})

describe('표시 문 — 브라우저 신원 긍정 확인(same) 뒤에만 개인 내용', () => {
  const PRIVATE = ['data-story-body', 'data-story-toc', 'data-story-progress=', 'data-story-completion', 'The tide came in fast', 'data-story-source-panel', 'Gull</']

  function privateAbsent(html: string) {
    for (const marker of PRIVATE) expect(html, marker).not.toContain(marker)
    expect(html).not.toContain('완료 표시')
    expect(html).not.toContain('단위 위치')
  }

  it('기준선 지연(checking): 공개 메타 · HOOK · 편집 목표 · 원천 줄 + 확인 중 알림만 · 조작 없음 · 액션 0번', () => {
    const html = reader(readyState(), knownAuth(undefined))
    privateAbsent(html)
    expect(html).toContain('data-story-private="hidden"')
    expect(html).toContain('data-story-identity="checking"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('data-story-hook')
    expect(html).toContain('편집 목표 난이도 B1')
    expect(html).toContain('data-story-source-line')
    expect(html).not.toContain('data-story-go=')
    expect(html).not.toContain('data-story-complete')
  })

  it('서버 A · 브라우저 B: 개인 내용 없음 · 바뀜 화면', () => {
    const html = reader(readyState(), knownAuth(OTHER))
    privateAbsent(html)
    expect(html).toContain('data-story-state="auth_changed"')
    expect(html).not.toContain('data-story-hook') // 바뀜 화면은 이전 화면의 어떤 내용도 다시 그리지 않는다
  })

  it('서버 A · 브라우저 로그아웃: 개인 내용 없음', () => {
    privateAbsent(reader(readyState(), knownAuth(null)))
  })

  it('같은 사람(same): 본문 · 목차 · 진도가 보인다', () => {
    const html = reader(readyState(), knownAuth(VIEWER))
    expect(html).toContain('data-story-private="shown"')
    expect(html).toContain('data-story-body')
    expect(html).toContain('data-story-toc')
    expect(html).toContain('완료 표시 1/3')
  })

  it('서가: 확인 중에는 내 진도 · 기록을 그리지 않고 확인 중 알림 · 같은 사람이면 보인다 · 다른 사람이면 지운다', () => {
    const state = ready({ progress: [progressRow(), progressRow({ releaseKey: KEY_C, releaseAvailable: false })] })
    const checking = catalog(state, vi.fn(), knownAuth(undefined)).html
    expect(checking).toContain('data-story-identity="checking"')
    expect(checking).not.toContain('data-story-progress-line')
    expect(checking).not.toContain('data-story-history')
    expect(checking).toContain('data-story-hook') // 공개 메타 · HOOK 은 그대로
    const other = catalog(state, vi.fn(), knownAuth(OTHER)).html
    expect(other).toContain('data-story-auth="changed"')
    expect(other).not.toContain('data-story-progress-line')
    expect(other).not.toContain('data-story-history')
    const same = catalog(state, vi.fn(), knownAuth(VIEWER)).html
    expect(same).toContain('data-story-progress-line')
    expect(same).toContain('data-story-history')
  })
})

describe('작품 입구 — 시작 전 학습자 정보 · 완료 뒤 다음 이야기', () => {
  it('HOOK · 편집 목표 난이도(진단 아님) · 원천 줄(원작 · 본문 언어 · 번역자 · 원천 판본)이 시작 행동보다 먼저', () => {
    const ctx = context({ source: { ...context().source, originalLanguage: 'fr', translator: 'T. Ranslator' } })
    const html = reader(readyState({ unit: null, context: ctx }))
    const hookAt = html.indexOf('data-story-hook')
    expect(hookAt).toBeGreaterThan(0)
    expect(hookAt).toBeLessThan(html.indexOf('data-story-go='))
    expect(html).toContain('편집 목표 난이도 B1')
    expect(html).toContain('진단 결과가 아니에요')
    const line = html.slice(html.indexOf('data-story-source-line'))
    expect(line).toMatch(/원작 언어 [^·]+ · 본문 언어 [^·]+ · 번역 T\. Ranslator · 원천 판본 Synthetic test edition/)
  })

  it('편집 목표가 없으면 「편집 목표 없음」 · 서가 메타 조회 실패(release null)는 「작품 정보를 불러오지 못했어요」(HOOK 없음과 구분)', () => {
    expect(reader(readyState({ unit: null, release: release({ targetCefr: null }) }))).toContain('편집 목표 없음')
    const missing = reader(readyState({ unit: null, release: null }))
    expect(missing).toContain('작품 정보를 불러오지 못했어요')
    expect(missing).not.toContain('data-story-hook')
  })

  it('전 단위 완료 뒤에만 「다음 이야기 고르기」(서가로 · 추천 엔진 없음)', () => {
    expect(reader(readyState({ unit: null }))).not.toContain('data-story-next-story')
    const all = context().toc.map((t) => ({ ...t, completed: true }))
    const full = context({ toc: all, progress: { lastUnitIndex: 2, furthestUnitIndex: 2, completedUnitCount: 3, completed: true } })
    const html = reader(readyState({ unit: null, context: full }))
    expect(html).toContain('data-story-next-story')
    expect(html).toContain('href="/library/stories"')
  })
})

describe('요청형 단어 뜻 — 본문 낱말에만 · 기본은 숨김', () => {
  it('기본: 본문은 글자 그대로 · 낱말 버튼 · 툴팁 없음 · 켜기 버튼만', () => {
    const html = renderToString(<StoryUnitText text={UNIT_TEXT} tracing={false} lookup={() => <div data-lookup />} />)
    expect(html).toContain('data-story-word-mode="off"')
    expect(html).not.toContain('data-word-index')
    expect(html).not.toContain('data-lookup')
    expect(html).toContain('The tide came in fast.')
  })

  it('켜면 지금 단위 낱말만 버튼 · 로빙 초점(탭 정지 하나) · 글자는 그대로 이어진다 · 열기 전 툴팁 없음', () => {
    const html = renderToString(<StoryUnitText text={UNIT_TEXT} tracing={false} defaultWordMode lookup={() => <div data-lookup />} />)
    const buttons = html.match(/data-word-index="\d+"/g) ?? []
    // The tide came in fast(5) · The gull did not move(5) · <b>not bold</b> 의 b · not · bold · b(4) — 꺾쇠 · 구두점은 낱말이 아니다
    expect(buttons.length).toBe(14)
    expect((html.match(/tabindex="0"/g) ?? []).length).toBe(1)
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).toContain('&lt;')
    expect(html).not.toContain('data-lookup')
    expect(html).not.toContain('<b>')
  })

  it('외래어 · 결합 부호 · 축약 · 하이픈: 버튼 낱말(조회 표제)은 통째 · 렌더 글자를 이으면 원문 그대로', () => {
    const text = "A naïve café, café and naïve résumé — don't, it's well-known."
    const html = renderToString(<StoryUnitText text={text} tracing={false} defaultWordMode lookup={() => null} />)
    const decode = (s: string) =>
      s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    const surfaces = [...html.matchAll(/<button[^>]*data-word-index="\d+"[^>]*>([^<]*)<\/button>/g)].map((m) => decode(m[1]))
    expect(surfaces).toEqual(['A', 'naïve', 'café', 'café', 'and', 'naïve', 'résumé', "don't", "it's", 'well-known'])
    const body = html.slice(html.indexOf('data-story-body'))
    const rendered = decode(body.slice(body.indexOf('<p>')).replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ''))
    expect(rendered).toBe(text)
  })

  it('독서 화면에서 단어 뜻은 개인 내용이 보일 때만 있다', () => {
    expect(reader(readyState())).toContain('data-story-word-mode')
    expect(reader(readyState(), knownAuth(undefined))).not.toContain('data-story-word-mode')
  })
})

describe('개인 내용이 없는 서버 상태 — 브라우저가 로그인돼 있어도 실제 이유를 그대로', () => {
  it('blocked + 브라우저 사용자 A: 차단 이유 · 바뀜 화면 아님', () => {
    const html = reader({ status: 'blocked' }, knownAuth(VIEWER))
    expect(html).toContain('data-story-state="blocked"')
    expect(html).toContain('이 계정으로는 지금 읽을 수 없어요')
    expect(html).not.toContain('auth_changed')
    expect(html).not.toContain('로그인 상태가 바뀌었어요')
  })

  it('unavailable(reader_not_ready) + 브라우저 사용자 A: 「읽기 화면 준비 중」', () => {
    const html = reader(
      { status: 'unavailable', failure: { ok: false, code: 'reader_not_ready', message: '아직 준비 중이에요.', retryable: false } },
      knownAuth(VIEWER),
    )
    expect(html).toContain('data-story-state="reader_not_ready"')
    expect(html).toContain('읽기 화면 준비 중')
    expect(html).not.toContain('auth_changed')
  })

  it('모든 unavailable 이유 + 브라우저 사용자 A: 그 이유 그대로 · 일시 오류만 다시 시도', () => {
    const codes = ['release_unavailable', 'unit_not_found', 'reader_data_invalid', 'invalid_input', 'temporary', 'viewer_changed', 'auth_required', 'account_blocked'] as const
    for (const code of codes) {
      const html = reader({ status: 'unavailable', failure: { ok: false, code, message: 'm', retryable: code === 'temporary' } }, knownAuth(VIEWER))
      expect(html, code).toContain(`data-story-state="${code}"`)
      expect(html, code).not.toContain('data-story-state="auth_changed"')
      expect(html.includes('data-story-retry'), code).toBe(code === 'temporary')
    }
  })

  it('signed_out + 브라우저 로그인: 로그인 안내 그대로(개인 내용 없음 · 바뀜 화면 아님)', () => {
    const html = reader({ status: 'signed_out', loginHref: '/login?next=x', release: release(), guidance: guidanceView() }, knownAuth(VIEWER))
    expect(html).toContain('data-story-reader="signed_out"')
    expect(html).not.toContain('data-story-body')
    expect(html).not.toContain('auth_changed')
  })

  it('ready + 다른 브라우저 사용자: 이 경우에만 바뀜 화면', () => {
    expect(reader(readyState(), knownAuth(OTHER))).toContain('data-story-state="auth_changed"')
  })
})

describe('읽은 뒤 서버 거부 → refresh → blocked 화면', () => {
  it('ready 에서 거부 뒤 서버가 blocked 를 다시 그리면, 브라우저 사용자 A 라도 차단 이유를 보인다', () => {
    const ready = reader(readyState(), knownAuth(VIEWER))
    expect(ready).toContain('data-story-body')
    const after = reader({ status: 'blocked' }, knownAuth(VIEWER))
    expect(after).toContain('data-story-state="blocked"')
    expect(after).not.toContain('data-story-body')
    expect(after).not.toContain('로그인 상태가 바뀌었어요')
  })
})

describe('시작 전 선택 안내(U1) — 편집 판단 · 접힌 주의 · 「없음」과 「못 불러옴」 구분', () => {
  const summaryOf = (html: string) => /<summary>([^<]*)<\/summary>/.exec(html)?.[1] ?? null

  it('작품 입구: 부담 한 줄(편집 판단 · 측정 아님)과 접힌 주의가 시작 행동보다 먼저 · 요약에 장면 없음 · 문장은 저장 순서 그대로', () => {
    const html = reader(readyState({ unit: null }))
    const at = html.indexOf('data-story-guidance="ready"')
    expect(at).toBeGreaterThan(-1)
    expect(at).toBeLessThan(html.indexOf('data-story-go='))
    expect(html).toContain('편집 판단 · 추론 부담 높음 · 배경지식 부담 보통 (측정한 값이 아니에요)')
    expect(html).toMatch(/<details[^>]*data-story-cautions/)
    expect(html).not.toMatch(/<details[^>]*\sopen/)
    expect(summaryOf(html)).toBe('읽기 전 주의 2가지 · 펼치면 장면 내용이 조금 드러나요')
    expect(summaryOf(html)).not.toContain('범인')
    expect(html.indexOf(`<li>${CAUTION_A}</li>`)).toBeGreaterThan(at)
    expect(html.indexOf(`<li>${CAUTION_A}</li>`)).toBeLessThan(html.indexOf(`<li>${CAUTION_B}</li>`))
  })

  it('주의가 없으면 경고 요소 · 주의 문구를 만들지 않는다(부담 줄만)', () => {
    const html = reader(readyState({ unit: null, guidance: guidanceView({ cautions: [] }) }))
    expect(html).toContain('data-story-guidance-load')
    expect(html).not.toContain('data-story-cautions')
    expect(html).not.toContain('주의')
  })

  it('불러오지 못함 · 확인하지 못함은 「주의 없음」이 아니라고 말한다(주의 요소 없음 · 독서 행동은 그대로)', () => {
    for (const reason of ['not_ready', 'temporary', 'invalid'] as const) {
      const html = reader(readyState({ unit: null, guidance: { status: 'unavailable', reason } }))
      expect(html, reason).toContain(`data-story-guidance-reason="${reason}"`)
      expect(html, reason).toContain('주의할 내용이 없다는 뜻은 아니에요')
      expect(html, reason).toContain(reason === 'invalid' ? '확인하지 못해 보여 드리지 않아요' : '지금 불러오지 못했어요')
      expect(html, reason).not.toContain('data-story-cautions')
      expect(html, reason).toContain('data-story-go="resume"')
    }
  })

  it('단위 화면에는 안내를 그리지 않는다', () => {
    expect(reader(readyState())).not.toContain('data-story-guidance')
  })

  it('작품 입구: 실제로 동작하는 요청형 도움(단어 뜻 · 원문 대응) 한 줄은 시작 행동 뒤의 선택 펼침 안에 있다(D4-UX01) · 안내를 못 불러와도 그대로 · 단위 화면에는 없다', () => {
    for (const guidance of [guidanceView(), { status: 'unavailable', reason: 'not_ready' } as const]) {
      const html = reader(readyState({ unit: null, guidance }))
      const at = html.indexOf('data-story-help-line')
      expect(at).toBeGreaterThan(-1)
      expect(at).toBeGreaterThan(html.indexOf('data-story-go='))
      expect(at).toBeGreaterThan(html.indexOf('data-story-entry-details'))
      expect(html).not.toMatch(/<details[^>]*data-story-entry-details[^>]*sopen/)
      expect(html).toContain('「단어 뜻 보기」를 켜면 본문 낱말을 눌러 뜻을 찾아볼 수 있고')
      expect(html).toContain('원문 인용이 연결된 단위는 「원문 대응 보기」로')
    }
    const unitPage = reader(readyState())
    expect(unitPage).not.toContain('data-story-help-line')
    // 단위 화면에는 그 한 줄이 말한 실제 조작이 있다
    expect(unitPage).toContain('단어 뜻 보기')
    expect(unitPage).toContain('원문 대응 보기')
  })

  it('로그인 전 판본 화면: HOOK 뒤 · 로그인 행동 앞에 같은 안내', () => {
    const html = reader({ status: 'signed_out', loginHref: '/login?next=x', release: release(), guidance: guidanceView() })
    const at = html.indexOf('data-story-guidance="ready"')
    expect(at).toBeGreaterThan(html.indexOf('data-story-hook'))
    expect(at).toBeLessThan(html.indexOf('data-story-login'))
    expect(summaryOf(html)).toBe('읽기 전 주의 2가지 · 펼치면 장면 내용이 조금 드러나요')
  })

  it('서가: 로그인 전에도 판본마다 안내 · 주의 있는 판본만 접힌 주의 · 없는 판본은 경고 없음', () => {
    const { html } = catalog(ready({ signedIn: false, viewerId: null, progress: null }))
    expect((html.match(/data-story-guidance="ready"/g) ?? []).length).toBe(2)
    expect((html.match(/data-story-cautions/g) ?? []).length).toBe(1)
    expect(html).toContain('편집 판단 · 추론 부담 낮음 · 배경지식 부담 낮음')
  })

  it('서가: 안내 조회 실패는 판본마다 「불러오지 못함」 · 서가와 시작 행동은 그대로', () => {
    const { html } = catalog(ready({ guidance: { status: 'unavailable', reason: 'not_ready' } }))
    expect((html.match(/data-story-guidance="unavailable"/g) ?? []).length).toBe(2)
    expect((html.match(/data-story-open=/g) ?? []).length).toBe(2)
    expect(html).not.toContain('data-story-cautions')
  })

  it('서가: 조회는 됐는데 그 판본 행이 없으면 「불러오지 못함」(주의 없음으로 바꾸지 않는다)', () => {
    const { html } = catalog(ready({ guidance: { status: 'ready', byRelease: { [KEY_A]: catalogGuidanceRow() } } }))
    expect((html.match(/data-story-guidance="ready"/g) ?? []).length).toBe(1)
    expect((html.match(/data-story-guidance="unavailable"/g) ?? []).length).toBe(1)
  })
})

function catalogGuidanceRow() {
  const g = catalogGuidance()
  if (g.status !== 'ready') throw new Error('ready expected')
  return g.byRelease[KEY_A]
}

describe('단위 시대적 맥락 설명(W2) — 본문 뒤 · 접힘 · 「없음」과 「못 불러옴」 구분 · 지금 단위에만', () => {
  const NOTE_1 = { id: 'note-head-size', text: '머리 크기로 지능을 짐작하는 묘사는 이 시대의 생각이에요(시험 문장).' }
  const NOTE_2 = { id: 'note-wife-affection', text: '부부 사이 묘사는 이 시대 소설의 관습이에요(시험 문장).' }
  const notes = (list = [NOTE_1, NOTE_2], over: { releaseKey?: string; unitIndex?: number } = {}) =>
    ({ status: 'ready', releaseKey: KEY_A, unitIndex: 1, notes: list, ...over }) as const

  it('본문 뒤 · 읽음 표시 앞에 접힌 <details> 하나 · 요약은 개수만 · 문장은 저장 순서 그대로', () => {
    const html = reader(readyState({ contextNotes: notes() }))
    const at = html.indexOf('data-story-context-notes="2"')
    expect(at).toBeGreaterThan(html.indexOf('data-story-body'))
    expect(at).toBeLessThan(html.indexOf('data-story-complete'))
    expect(html).toMatch(/<details[^>]*data-story-context-notes="2"/)
    expect(html).not.toMatch(/<details[^>]*data-story-context-notes[^>]*\sopen/)
    expect(html).toContain('<summary>시대적 맥락 2가지 · 원할 때 펼쳐 보세요</summary>')
    expect(html.indexOf(NOTE_1.text)).toBeGreaterThan(at)
    expect(html.indexOf(NOTE_1.text)).toBeLessThan(html.indexOf(NOTE_2.text))
    expect(html).toContain(`data-story-context-note="${NOTE_1.id}"`)
  })

  it('설명 없음(빈 배열) · 입구(null)는 아무것도 그리지 않는다', () => {
    for (const html of [reader(readyState({ contextNotes: notes([]) })), reader(readyState({ unit: null, contextNotes: null }))]) {
      expect(html).not.toContain('data-story-context-notes')
      expect(html).not.toContain('시대적 맥락')
    }
  })

  it('불러오지 못함 · 확인하지 못함은 「설명 없음」이 아니라고 말한다 · 본문 · 읽음 표시는 그대로', () => {
    for (const reason of ['not_ready', 'temporary', 'invalid'] as const) {
      const html = reader(readyState({ contextNotes: { status: 'unavailable', reason } }))
      expect(html, reason).toContain(`data-story-context-notes-reason="${reason}"`)
      expect(html, reason).toContain('설명이 없다는 뜻은 아니에요')
      expect(html, reason).not.toContain('<details')
      expect(html, reason).toContain('data-story-body')
      expect(html, reason).toContain('data-story-complete')
    }
  })

  it('지금 화면과 다른 발행 키 · 단위의 결과(늦은 응답)는 설명을 보이지 않고 「확인하지 못함」', () => {
    for (const over of [{ unitIndex: 2 }, { releaseKey: KEY_B }]) {
      const html = reader(readyState({ contextNotes: notes(undefined, over) }))
      expect(html).not.toContain(NOTE_1.text)
      expect(html).toContain('data-story-context-notes-reason="invalid"')
    }
  })

  it('개인 내용 문 — 확인 중 · 다른 사람 · 로그아웃이면 설명도 없다', () => {
    for (const auth of [knownAuth(undefined), knownAuth(OTHER), knownAuth(null)]) {
      const html = reader(readyState({ contextNotes: notes() }), auth)
      expect(html).not.toContain('data-story-context-notes')
      expect(html).not.toContain(NOTE_1.text)
    }
  })
})

describe('D4 — 시작 정보 순서 · 단위 머리 · 맥락 진입 · 완료 뒤 공급 인지', () => {
  const LONG_HOOK = 'Two days after Christmas, Dr. Watson finds Holmes on the sofa. He hands Watson the lens.'
  const FULL = (k = 1) => context({ progress: { lastUnitIndex: k, furthestUnitIndex: 2, completedUnitCount: 3, completed: true }, toc: context().toc.map((t) => ({ ...t, completed: true })) })

  it('입구(UX01): 첫 문장 → 편집 목표 → 부담 · 접힌 주의 → 시작 행동 → 선택 펼침(첫 장면 전체 · 원천 · 도움) · 전문은 저장값 그대로', () => {
    const html = reader(readyState({ unit: null, release: release({ hookText: LONG_HOOK }) }))
    const at = (m: string) => html.indexOf(m)
    expect(at('data-story-hook-preview')).toBeGreaterThan(-1)
    expect(html).toContain('Two days after Christmas, Dr. Watson finds Holmes on the sofa.')
    expect(at('data-story-hook-preview')).toBeLessThan(at('data-story-target'))
    expect(at('data-story-target')).toBeLessThan(at('data-story-cautions'))
    expect(at('data-story-cautions')).toBeLessThan(at('data-story-go='))
    expect(at('data-story-go=')).toBeLessThan(at('data-story-entry-details'))
    expect(at('data-story-entry-details')).toBeLessThan(at('data-story-hook='))
    expect(html).toContain(`>${LONG_HOOK}</blockquote>`)
    expect(at('data-story-source-line')).toBeGreaterThan(at('data-story-entry-details'))
    expect(html).not.toMatch(/<details[^>]*data-story-entry-details[^>]*\sopen/)
    // 지어낸 장르 · 소개 · 적합 판정 · 예상 시간 없음
    expect(html).not.toMatch(/장르|추천|적합해요|분 걸려요|당신에게/)
  })

  it('입구 · 로그인 전: 한 문장 HOOK 은 전문을 그대로(잘라 보일 것 없음) · 로그인 전 화면도 첫 문장 → 주의 → 로그인 → 첫 장면 전체', () => {
    const one = reader(readyState({ unit: null }))
    expect(one).toContain('data-story-hook="true"')
    expect(one).not.toContain('data-story-hook-preview')
    const anon = reader({ status: 'signed_out', loginHref: '/login?next=x', release: release({ hookText: LONG_HOOK }), guidance: guidanceView() })
    expect(anon.indexOf('data-story-hook-preview')).toBeLessThan(anon.indexOf('data-story-cautions'))
    expect(anon.indexOf('data-story-cautions')).toBeLessThan(anon.indexOf('data-story-login'))
    expect(anon.indexOf('data-story-login')).toBeLessThan(anon.indexOf('data-story-hook='))
    expect(anon).not.toContain('data-story-body')
  })

  it('단위 머리(UX02): 단위 제목이 h1(#story-unit-heading) · 작품 이름은 작은 맥락 · 큰 작품 제목 반복 없음 · 본문 그대로', () => {
    const html = reader(readyState())
    expect(html).toMatch(/<h1 id="story-unit-heading"[^>]*>2번째 단위 · Gull<\/h1>/)
    expect((html.match(/<h1/g) ?? []).length).toBe(1)
    expect(html).toContain('data-story-head="unit"')
    expect(html).toContain('The tide came in fast.')
    expect(html).not.toContain('<h2 id="story-unit-heading"')
  })

  it('맥락 진입(UX02): 결속된 ready 설명이 있을 때만 도구 줄에 수와 함께 · 접힌 상태 · 오류/미적용/어긋남/0개/확인 중/바뀜에는 없다', () => {
    const notes = [{ id: 'n1', text: '설명 하나' }, { id: 'n2', text: '설명 둘' }]
    const ok = reader(readyState({ contextNotes: { status: 'ready', releaseKey: KEY_A, unitIndex: 1, notes } }))
    expect(ok).toContain('data-story-context-entry="2"')
    expect(ok).toContain('이 단위의 시대적 맥락 2가지')
    expect(ok).toMatch(/data-story-context-entry="2"[^>]*>|aria-expanded="false"/)
    expect(ok.indexOf('data-story-context-entry')).toBeLessThan(ok.indexOf('data-story-body'))
    expect(ok).not.toMatch(/<details[^>]*data-story-context-notes[^>]*\sopen/)
    const none: Array<Parameters<typeof readyState>[0]> = [
      { contextNotes: null },
      { contextNotes: { status: 'ready', releaseKey: KEY_A, unitIndex: 1, notes: [] } },
      { contextNotes: { status: 'ready', releaseKey: KEY_A, unitIndex: 2, notes } },
      { contextNotes: { status: 'ready', releaseKey: KEY_B, unitIndex: 1, notes } },
      { contextNotes: { status: 'unavailable', reason: 'not_ready' } },
      { contextNotes: { status: 'unavailable', reason: 'invalid' } },
      { contextNotes: { status: 'unavailable', reason: 'temporary' } },
    ]
    for (const over of none) expect(reader(readyState(over)), JSON.stringify(over)).not.toContain('data-story-context-entry')
    for (const auth of [knownAuth(undefined), knownAuth(OTHER), knownAuth(null)]) {
      expect(reader(readyState({ contextNotes: { status: 'ready', releaseKey: KEY_A, unitIndex: 1, notes } }), auth)).not.toContain('data-story-context-entry')
    }
  })

  it('완료 뒤(UX04): 다음 행동은 본문 한 곳(레일에 같은 링크 없음) · 다른 작품 0 → 「Stories 둘러보기」+ 없다는 사실 · 있으면 「다른 이야기 고르기」 · 서가 실패 → 중립', () => {
    for (const [otherWorks, label, kind] of [
      [0, 'Stories 둘러보기', 'only-work'],
      [3, '다른 이야기 고르기', 'other-works'],
      [null, 'Stories 서가로', 'unknown'],
    ] as const) {
      for (const unit of [null, unitBody({ unitIndex: 2, unitTitle: 'Rock' })]) {
        const html = reader(readyState({ unit, context: FULL(unit ? 2 : 1), otherWorks }))
        expect((html.match(/data-story-next-story/g) ?? []).length, `${otherWorks}/${unit ? 'unit' : 'entry'}`).toBe(1)
        expect(html).toContain(label)
        expect(html).toContain(`data-story-after-completion="${kind}"`)
        const aside = html.slice(html.indexOf('<aside'))
        expect(aside).not.toContain('data-story-next-story')
        expect(html).not.toMatch(/추천|다음 에피소드/)
      }
    }
    expect(reader(readyState({ unit: unitBody({ unitIndex: 2, unitTitle: 'Rock' }), context: FULL(2), otherWorks: 0 }))).toContain('지금 공개된 다른 이야기는 없어요')
    // 완료 전에는 완료 뒤 행동이 없다
    expect(reader(readyState({ otherWorks: 0 }))).not.toContain('data-story-after-completion')
  })

  it('이어 읽기(UX04): 「마지막으로 연 단위」 · 그 단위 첫머리에서 시작(문장 위치 저장 없음) — 완료와 구분', () => {
    const html = reader(readyState({ unit: null }))
    expect(html).toContain('마지막으로 연 단위는 2번째 단위 · Gull예요')
    expect(html).toContain('문장 위치는 저장하지 않아요')
    expect(html).toContain('완료 표시 1/3')
  })

  it('단어 도구(UX03): 낱말 모드에서 고른 낱말을 여는 44px 대체 단추(본문 낱말 간격은 그대로) · 기본은 꺼짐', () => {
    const on = renderToString(<StoryUnitText text={UNIT_TEXT} tracing={false} defaultWordMode />)
    expect(on).toMatch(/data-story-word-picker[^>]*>뜻 보기 · <span lang="en">The<\/span>/)
    expect((on.match(/tabindex="0"/g) ?? []).length).toBe(1)
    expect(on).toContain('화살표 · Home · End')
    const off = renderToString(<StoryUnitText text={UNIT_TEXT} tracing={false} />)
    expect(off).not.toContain('data-story-word-picker')
    expect(off).toContain('data-story-word-mode="off"')
  })
})

describe('D5 — 선택 낱말 저장 조작 · 단어장 Story 복귀 줄', () => {
  const lookup = (over: Partial<WordLookup> = {}): WordLookup => ({
    found: true, surface: 'looked', resolvedWord: 'look', meaningKo: '보다', pos: 'verb', cefrLevel: 'A1', vLevel: 1, exampleEn: 'Look at this.',
    matchVia: 'inflection', wordRegister: null, collocations: null, exampleKo: null, derived: null, synonyms: null, antonyms: null, lang: 'en', ...over,
  })
  const noop = async () => ({ stale: true as const })
  const save = (l: WordLookup | null, surface = 'looked') =>
    renderToString(<StoryWordSave lookup={l} surface={surface} wordIndex={7} onSave={noop} vaultHref={`/wordvault/browse?story_release=${KEY_A}&story_unit=1`} />)

  it('확정 영어 표제어: 담을 표제어와 본문 낱말을 구분해 보이고 단추 하나 · 담기 전에는 단어장 링크 없음 · 상태 자리는 aria-live', () => {
    const html = save(lookup())
    expect(html).toContain('data-story-word-save="idle"')
    expect(html).toMatch(/담을 낱말 <strong lang="en">look<\/strong>/)
    expect(html).toContain('본문 <span lang="en">looked</span>의 사전 원형')
    expect(html).toMatch(/<button[^>]*data-story-word-save-button[^>]*>내 단어장에 담기<\/button>/)
    expect(html).toMatch(/role="status" aria-live="polite"[^>]*data-story-word-save-status/)
    expect(html).not.toContain('data-story-word-save-vault')
    // 같은 낱말이면 원형 안내 없음
    expect(save(lookup({ resolvedWord: 'looked' }))).not.toContain('사전 원형')
  })

  it('없음 · 유사어 추정 · 이름 · 외국어 · 뜻 없음 · 조회 결과 없음 → 단추 없이 「확정된 낱말만」 한 줄', () => {
    for (const l of [
      lookup({ found: false, resolvedWord: null, meaningKo: null, matchVia: 'not_found' }),
      lookup({ matchVia: 'suggestion' }),
      lookup({ found: false, matchVia: 'proper_noun', resolvedWord: null }),
      lookup({ lang: 'fr' }),
      lookup({ meaningKo: '' }),
      null,
    ]) {
      const html = save(l)
      expect(html, JSON.stringify(l)).toContain('data-story-word-save="unavailable"')
      expect(html).not.toContain('data-story-word-save-button')
      expect(html).toContain('사전에서 확정된 낱말만')
    }
  })

  it('복귀 줄: ok = 제목 · n번째 단위(0-based+1) · 단위 첫머리 안내 · 같은 발행본 단위로 · 다른 상태는 각각 안전한 한 줄', () => {
    const ok = renderToString(<StoryVaultReturnBar state={{ status: 'ok', releaseKey: KEY_A, unitIndex: 2, title: 'The Gull', unitCount: 3 }} />)
    expect(ok).toContain('data-story-vault-return="ok"')
    expect(ok).toContain('3<!-- -->번째 단위')
    expect(ok).toContain('단위 첫머리로 돌아가요')
    expect(ok).toContain(`href="/library/stories/${KEY_A}?unit=2"`)
    expect(ok).not.toMatch(/이 이야기 단어|Story 단어 목록/)
    const bad = renderToString(<StoryVaultReturnBar state={{ status: 'bad_unit', releaseKey: KEY_A, title: 'The Gull', unitCount: 3 }} />)
    expect(bad).toContain(`href="/library/stories/${KEY_A}"`)
    expect(bad).toContain('그 단위를 찾을 수 없어요')
    const gone = renderToString(<StoryVaultReturnBar state={{ status: 'unavailable' }} />)
    expect(gone).toContain('href="/library/stories"')
    expect(gone).not.toContain(KEY_A)
    const err = renderToString(<StoryVaultReturnBar state={{ status: 'error', releaseKey: KEY_A, unitIndex: 1 }} />)
    expect(err).toContain('확인하지 못했어요')
    expect(err).toContain(`href="/library/stories/${KEY_A}?unit=1"`)
    const mix = renderToString(<StoryVaultReturnBar state={{ status: 'conflict' }} />)
    expect(mix).toContain('data-story-vault-return="conflict"')
    expect(mix).not.toContain('href=')
  })

  it('단위 화면: 저장 액션이 있어도 렌더 자체는 아무것도 기록하지 않는다 · 액션이 없으면 저장 조작을 넘기지 않는다', () => {
    const saveWord = vi.fn()
    const html = renderToString(
      <StoryReader state={readyState()} releaseKey={KEY_A} actions={{ recordPosition: vi.fn(), completeUnit: vi.fn(), saveWord }} authGuard={knownAuth(VIEWER)} />,
    )
    expect(html).toContain('data-story-body')
    expect(saveWord).not.toHaveBeenCalled()
  })
})

// Same D5 integration: full private WordVault subtree, not only its Story return bar.
describe('D5 WordVault authenticated renderer integration', () => {
  const A = '11111111-1111-4111-8111-111111111111'
  const B = '22222222-2222-4222-8222-222222222222'
  const RK = `lsr_${'a'.repeat(32)}`
  const row = (id: string, word: string, meaning: string) =>
    ({ id, word, meaning, example_sentence: `The ${word} example.`, pronunciation: '', pos: 'noun', cefr_level: 'B1', difficulty: null, stability: null, last_review_at: null, next_review_at: null, module_history: [], review_count: 0, text_id: null, shared_set_id: 'set-1', created_at: '2026-10-27T00:00:00Z' }) as unknown as Parameters<typeof vocabRowToWord>[0]
  const words = [row('v1', 'privateword', '사적인뜻'), row('v2', 'secondword', '두번째뜻')].map((r, i) => vocabRowToWord(r, i))
  const known = (userId: string | null): StoryAuthSource => ({ subscribe: () => () => {}, currentUserId: async () => userId, testOnlyKnownUserId: () => userId })
  const pending: StoryAuthSource = { subscribe: () => () => {}, currentUserId: () => new Promise(() => {}) }
  const reopen = storyVaultHref({ releaseKey: RK, unitIndex: 2 })

  function render(source: StoryAuthSource) {
    return renderToStaticMarkup(
      <WordVaultViewerGate viewerId={A} reopenHref={reopen} authSource={source}>
        <WordVaultBrowseClient
          words={words}
          textChips={[{ id: 'text:t1', label: '사적인 본문 칩', count: 1 }]}
          setChips={[{ id: 'set:set-1', label: '사적인 세트 칩', count: 2 }]}
          storyReturn={<StoryVaultReturnBar state={{ status: 'ok', releaseKey: RK, unitIndex: 2, title: 'Gull Rock', unitCount: 3 }} />}
        />
      </WordVaultViewerGate>,
    )
  }
  const PRIVATE = ['privateword', '사적인뜻', 'secondword', '사적인 본문 칩', '사적인 세트 칩', 'data-story-vault-return', '단어장 도구']

  describe('WordVaultViewerGate — 서버 주인으로 긍정 확인될 때만 개인 내용', () => {
    it('브라우저 = 서버 주인(A): 실제 목록 · 칩 · 듣기 · Story 복귀 줄', () => {
      const html = render(known(A))
      expect(html).toContain('data-vault-private="shown"')
      for (const s of PRIVATE) expect(html, s).toContain(s)
      expect(html).not.toContain(A) // uid 는 비교에만
    })

    for (const [name, source, state] of [
      ['다른 계정(B)', known(B), 'changed'],
      ['로그아웃', known(null), 'changed'],
      ['확인 전(기준선 대기)', pending, 'checking'],
    ] as const) {
      it(`${name}: 목록 · 칩 · 듣기 · 복귀 줄 0 · ${state}`, () => {
        const html = render(source)
        expect(html).toContain(`data-vault-private="${state}"`)
        for (const s of PRIVATE) expect(html, s).not.toContain(s)
        expect(html).not.toContain(A)
        expect(html).not.toContain(B)
        expect(html).toContain('data-vault-reopen')
        expect(html.replaceAll('&amp;', '&')).toContain(`href="${reopen}"`)
        if (state === 'changed') {
          const login = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replaceAll('&amp;', '&')).find((h) => h.startsWith('/login'))
          expect(new URL(login!, 'http://x').searchParams.get('next')).toBe(reopen)
        } else {
          expect(html).not.toContain('data-vault-login')
        }
      })
    }

    it('기준선을 못 읽으면 same 으로 치지 않는다(checking 그대로)', () => {
      const failing: StoryAuthSource = { subscribe: () => () => {}, currentUserId: () => Promise.reject(new Error('storage')) }
      expect(render(failing)).toContain('data-vault-private="checking"')
    })
  })

})
