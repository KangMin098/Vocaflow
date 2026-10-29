// apps/web/src/components/dictation/__tests__/results-boundary.test.tsx
// @vitest-environment node
// 결과 화면 경계 — R1 요청 결속(보관된 A 결과를 B 요청 화면에 붙이지 않음) · R2 재생 실행 시점 판정(guard · 유효 snapshot).
import fs from 'node:fs'
import path from 'node:path'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  seeded: [] as unknown[],
  search: new URLSearchParams(),
}))

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    // 효과가 돌기 전의 보관 상태(stored · state)를 그대로 심는다 — 실제 DictationResultsClient 의 ready 분기를 그린다.
    useState: (init: unknown) =>
      h.seeded.length > 0 ? [h.seeded.shift(), () => {}] : actual.useState(init),
  }
})
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => h.search,
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/recommend/use-next-action', () => ({ useNextAction: () => null }))
vi.mock('@/components/recommend/NextActionCard', () => ({ NextActionCard: () => null }))
vi.mock('@/lib/dictation/persist', () => ({ fetchDictationSessionDetail: vi.fn() }))
vi.mock('@/components/library/story/use-story-auth-guard', async () => {
  const actual = await vi.importActual<typeof import('@/components/library/story/use-story-auth-guard')>(
    '@/components/library/story/use-story-auth-guard',
  )
  return {
    ...actual,
    useStoryAuthGuard: (owner: string | null) => {
      const guard = new actual.StoryAuthGuard(owner)
      if (owner) guard.observe({ event: 'KNOWN', userId: owner })
      return { guard, status: guard.status }
    },
  }
})

import { StoryAuthGuard } from '@/components/library/story/use-story-auth-guard'
import type { SessionDetail } from '@/lib/dictation/persist'
import { ResultsRelisten } from '@/lib/dictation/results-relisten'
import {
  DictationResultsClient,
  acceptLoaded,
  currentSnapshot,
  replayAllowed,
} from '../DictationResultsClient'

function snap(id: string, owner: string, sentence: string, input: string): SessionDetail {
  return {
    session: {
      id,
      title: `title-${id}`,
      sourceKind: 'custom',
      avgAccuracy: 50,
      completedItems: 1,
      totalItems: 1,
      completedAt: '2026-10-28T00:00:00Z',
      startedAt: '2026-10-28T00:00:00Z',
      totalHints: 0,
      durationMs: 1000,
      longestPerfectWords: 0,
      textId: null,
      sharedSetId: null,
      chapterIdx: null,
      userId: owner,
    },
    attempts: [
      {
        itemIdx: 0,
        expected: sentence,
        userInput: input,
        accuracy: 50,
        hintsUsed: 0,
        replayCount: 0,
        skipped: false,
        wordResults: [],
        errorTags: [],
        targetWords: [],
        targetHits: [],
      },
    ],
  } as SessionDetail
}
const A = snap('sess-a', 'user-a', 'Alpha sentence here.', 'alpha typed')
const B = snap('sess-b', 'user-a', 'Bravo sentence here.', 'bravo typed')

function renderWith(stored: SessionDetail | null, state: string, sessionId: string | null) {
  h.seeded = [stored, state]
  h.search = new URLSearchParams(sessionId ? { sessionId } : {})
  return renderToString(<DictationResultsClient />)
}

beforeEach(() => {
  h.seeded = []
})

describe('R1 요청 결속 — 실제 DictationResultsClient 분기', () => {
  it('효과 전 렌더: A 결과를 보관한 채 URL 이 B 를 요청하면 A 본문 · 입력 · 재생을 그리지 않고 기다린다', () => {
    const html = renderWith(A, 'ready', 'sess-b')
    expect(html).not.toContain('Alpha sentence here.')
    expect(html).not.toContain('alpha typed')
    expect(html).not.toContain('attempt-relisten')
    expect(html).toContain('결과를 불러오는 중')
  })
  it('요청 id 가 없으면 보관 결과를 그리지 않는다', () => {
    const html = renderWith(A, 'ready', null)
    expect(html).not.toContain('Alpha sentence here.')
  })
  it('B 를 보관하고 B 를 요청하면 B 를 그린다(정상)', () => {
    const html = renderWith(B, 'ready', 'sess-b')
    expect(html).toContain('Bravo sentence here.')
    expect(html).toContain('bravo typed')
    expect(html).toContain('data-testid="attempt-relisten"')
  })
  it('missing 안내는 그대로', () => {
    expect(renderWith(null, 'missing', 'sess-b')).toContain('이 결과를 찾을 수 없어요')
  })
  it('뒤늦은 A 응답은 B 요청에서 받아들이지 않고, B 응답은 받아들인다', () => {
    expect(acceptLoaded('sess-b', A)).toBe(false)
    expect(acceptLoaded('sess-b', B)).toBe(true)
    expect(acceptLoaded(null, B)).toBe(false)
    expect(currentSnapshot(A, 'sess-b')).toBeNull()
    expect(currentSnapshot(B, 'sess-b')).toBe(B)
  })
})

function deferredSpeaker() {
  const pending: Array<() => void> = []
  return {
    pending,
    speak: vi.fn(() => new Promise<void>((r) => pending.push(r))),
    cancel: vi.fn(),
  }
}

/** 결과 화면이 하는 연결 그대로 — liveRef(렌더 때 갱신) · snapshot 에 묶인 allow · guard 구독 → revalidate */
function connect(owner: string, detail: SessionDetail) {
  const guard = new StoryAuthGuard(owner)
  const live = { guard, detail: detail as SessionDetail | null }
  const sp = deferredSpeaker()
  const player = new ResultsRelisten(sp, () => replayAllowed(live, detail))
  player.activate()
  guard.subscribe(() => player.revalidate())
  // 보관된 A 행 콜백
  const callback = () => player.toggle(0, detail.attempts[0].expected)
  return { guard, live, sp, player, callback }
}

describe('R2 재생 실행 시점 판정 — guard · 유효 snapshot 연결', () => {
  it('확인 중(checking)에는 보관된 콜백이 발화하지 않는다', () => {
    const c = connect('user-a', A)
    c.callback()
    expect(c.sp.speak).not.toHaveBeenCalled()
  })

  it('A 재생 중 B 로 바뀌면(React 정리 전) 즉시 취소되고, 보관된 콜백은 발화 0', () => {
    const c = connect('user-a', A)
    c.guard.observe({ event: 'KNOWN', userId: 'user-a' })
    c.callback()
    expect(c.sp.speak).toHaveBeenCalledTimes(1)
    expect(c.player.playingIdx).toBe(0)
    const cancelsBefore = c.sp.cancel.mock.calls.length
    c.guard.observe({ event: 'SIGNED_IN', userId: 'user-b' })
    expect(c.guard.status).toBe('changed')
    expect(c.sp.cancel.mock.calls.length).toBeGreaterThan(cancelsBefore)
    expect(c.player.playingIdx).toBeNull()
    c.callback()
    expect(c.sp.speak).toHaveBeenCalledTimes(1)
  })

  it('guard 가 checking 으로 돌아가면(재확인) 진행 중 A 를 끊고 발화 0', () => {
    const c = connect('user-a', A)
    c.guard.observe({ event: 'KNOWN', userId: 'user-a' })
    c.callback()
    c.guard.recheck({ currentUserId: () => new Promise(() => {}) })
    expect(c.guard.status).toBe('checking')
    expect(c.player.playingIdx).toBeNull()
    c.callback()
    expect(c.sp.speak).toHaveBeenCalledTimes(1)
  })

  it('다른 요청 결과로 바뀐 뒤(폐기된 view) 옛 콜백은 stop() 뒤에도 발화하지 않는다', () => {
    const c = connect('user-a', A)
    c.guard.observe({ event: 'KNOWN', userId: 'user-a' })
    c.live.detail = B // 렌더가 현재 snapshot 을 B 로 갱신
    c.player.stop()
    c.callback()
    expect(c.sp.speak).not.toHaveBeenCalled()
  })

  it('폐기(dispose)된 플레이어의 콜백은 허용 상태여도 발화하지 않는다', () => {
    const c = connect('user-a', A)
    c.guard.observe({ event: 'KNOWN', userId: 'user-a' })
    c.player.dispose()
    c.player.stop()
    c.callback()
    expect(c.sp.speak).not.toHaveBeenCalled()
  })

  it('정상: 같은 계정 · 현재 snapshot 이면 발화한다', () => {
    const c = connect('user-a', A)
    c.guard.observe({ event: 'KNOWN', userId: 'user-a' })
    c.callback()
    expect(c.sp.speak).toHaveBeenCalledWith('Alpha sentence here.')
  })
})

describe('R2 폐기된 view 의 콜백은 공용 음성 엔진을 건드리지 않는다', () => {
  /** 기기 전역 음성 엔진처럼 cancel 이 누구의 발화든 끊는 공용 상태 */
  function sharedEngine() {
    const state = { speaking: null as string | null, cancels: 0 }
    const speaker = {
      speak: vi.fn((text: string) => {
        state.speaking = text
        return new Promise<void>(() => {})
      }),
      cancel: vi.fn(() => {
        state.cancels++
        state.speaking = null
      }),
    }
    return { state, speaker }
  }

  it('A 폐기 → B 재생 중 → 옛 A 콜백(toggle · stop · revalidate)은 B 를 끊지 않고 cancel 도 늘지 않는다', () => {
    const eng = sharedEngine()
    const a = new ResultsRelisten(eng.speaker, () => true)
    a.activate()
    a.dispose()
    const b = new ResultsRelisten(eng.speaker, () => true)
    b.activate()
    b.toggle(0, 'Bravo sentence here.')
    expect(eng.state.speaking).toBe('Bravo sentence here.')
    const cancels = eng.state.cancels
    a.toggle(0, 'Alpha sentence here.')
    a.stop()
    a.revalidate()
    a.dispose()
    expect(eng.state.speaking).toBe('Bravo sentence here.')
    expect(eng.state.cancels).toBe(cancels)
    expect(b.playingIdx).toBe(0)
    expect(eng.speaker.speak).toHaveBeenCalledTimes(1)
  })

  it('재생하지 않던 view 의 폐기는 cancel 을 부르지 않는다', () => {
    const eng = sharedEngine()
    const a = new ResultsRelisten(eng.speaker, () => true)
    a.dispose()
    expect(eng.state.cancels).toBe(0)
  })

  it('같은 살아 있는 view 에서는 정지 → 다시 재생이 정상', () => {
    const eng = sharedEngine()
    const b = new ResultsRelisten(eng.speaker, () => true)
    b.activate()
    b.toggle(0, 'Bravo sentence here.')
    b.stop()
    expect(eng.state.speaking).toBeNull()
    b.toggle(0, 'Bravo sentence here.')
    expect(eng.state.speaking).toBe('Bravo sentence here.')
    expect(b.playingIdx).toBe(0)
  })
})

describe('T-0254 — 조회 실패는 부재와 다르고, 명시적 다시 불러오기로만 다시 본다(소스 결속)', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../DictationResultsClient.tsx'), 'utf8')
  it('readDictationSessionDetail 로 실패/부재를 가르고, 늦은 응답은 버린다', () => {
    expect(src).toContain("const read = await readDictationSessionDetail(createClient(), sessionId)")
    expect(src).toMatch(/if \(!mounted\) return\n\s*if \(read\.status === 'failed'\) \{\n\s*setState\('failed'\)/)
    expect(src).toMatch(/if \(read\.status === 'absent' \|\| !acceptLoaded\(sessionId, read\.detail\)\) \{\n\s*setState\('missing'\)/)
    expect(src).toMatch(/\}, \[sessionId, router, reloadSeq\]\)/)
    expect(src).not.toMatch(/fetchDictationSessionDetail/)
  })
  it('다시 불러오기는 누를 때만(자동 재조회 없음) · 진행 중 aria-disabled · 실패 화면 유지 · 성공 뒤 결과 제목 1회 초점', () => {
    expect(src.match(/setReloadSeq\(/g)?.length).toBe(1)
    expect(src).toMatch(/if \(retrying\) return\n\s*setReloadSeq\(\(n\) => n \+ 1\)/)
    expect(src).toMatch(/aria-disabled=\{retrying \? 'true' : undefined\}/)
    expect(src).toMatch(/prev === 'failed' \|\| prev === 'retrying'\) \? 'retrying' : 'loading'/)
    expect(src).toMatch(/focusResultAfterRetry\.current = reloadSeq > 0/)
    expect(src).toMatch(/<h1 ref=\{resultHeadRef\} tabIndex=\{-1\}/)
    expect(src).not.toMatch(/setInterval|setTimeout\(\(\) => setReloadSeq/)
  })
})
