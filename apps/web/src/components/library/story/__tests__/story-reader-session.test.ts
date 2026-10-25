// apps/web/src/components/library/story/__tests__/story-reader-session.test.ts
// 독서 저장 흐름 — 인증 긍정 확인 전 · 무효 뒤에는 액션 0번 / 모든 입력에 expectedViewerId / 명시적 클릭에서만 위치 기록 →
// 성공 뒤 이벤트 · 이동 / 실패는 사실대로 + 같은 내용 재전송 · 이벤트 없음 / 서버 거부(차단 · 닫힘 · 단위 없음 · 계정 바뀜 · 로그인)는
// 개인 내용 폐기 + refresh / 연타 단일 요청 / 순서 뒤바뀐 · 낡은 응답 무시 / 인증 전환 · 로그아웃이 진행 중 결과를 버린다 / 완료는 버튼 · 재호출 안전.

import { describe, expect, it, vi } from 'vitest'

import type { PublicEvent } from '@/lib/analytics/events'
import type {
  StoryLearnerFailureCode,
  StoryLearnerResult,
  StoryPositionResult,
  StoryUnitCompletionResult,
} from '@/lib/library/story/learner-types'

import {
  COMPLETE_FAILED,
  DENIAL_CODES,
  POSITION_FAILED,
  StoryReaderSession,
  readerAuthDecision,
  readerVisibility,
  type StoryCompleteInput,
  type StoryPositionInput,
  type StoryReaderActions,
} from '../story-reader-session'
import { StoryAuthGuard, type StoryAuthChange, type StoryAuthSource } from '../use-story-auth-guard'
import { KEY_A, KEY_B, OTHER, VIEWER, deferred, flush } from './fixtures'

type PosResult = StoryLearnerResult<StoryPositionResult>
type DoneResult = StoryLearnerResult<StoryUnitCompletionResult>
type ReaderEvent = Extract<PublicEvent, { name: 'story_reader_action' }>

const pos = (unitIndex: number, over: Partial<StoryPositionResult> = {}): PosResult => ({
  ok: true,
  data: {
    viewerId: VIEWER,
    releaseKey: KEY_A,
    lastUnitIndex: unitIndex,
    furthestUnitIndex: unitIndex,
    completedUnitCount: 1,
    unitCount: 3,
    completed: false,
    ...over,
  },
})
const done = (unitIndex: number, completedUnitCount: number, over: Partial<StoryUnitCompletionResult> = {}): DoneResult => ({
  ok: true,
  data: {
    viewerId: VIEWER,
    releaseKey: KEY_A,
    unitIndex,
    completedUnitCount,
    unitCount: 3,
    completed: completedUnitCount >= 3,
    completionLabel: 'adapted_full_work',
    ...over,
  },
})
const fail = (code: StoryLearnerFailureCode = 'temporary', retryable = true): PosResult & DoneResult => ({
  ok: false,
  code,
  message: code === 'temporary' ? '서버에 연결하지 못했어요.' : `거부: ${code}`,
  retryable,
})

function setup(
  opts: {
    actions?: Partial<StoryReaderActions>
    completionLabel?: 'adapted_full_work' | 'adapted_partial'
    /** 기본: 브라우저 신원을 VIEWER 로 긍정 확인한 경계. null = 확인 전(checking) 그대로. */
    browser?: string | null | 'unverified'
  } = {},
) {
  const guard = new StoryAuthGuard(VIEWER)
  const browser = opts.browser ?? VIEWER
  if (browser !== 'unverified') guard.observe({ event: 'BASELINE', userId: browser })
  const events: ReaderEvent[] = []
  const navigate = vi.fn((href: string) => void href)
  const refresh = vi.fn()
  const recordPosition = vi.fn(opts.actions?.recordPosition ?? (async (input: StoryPositionInput) => pos(input.unitIndex)))
  const completeUnit = vi.fn(opts.actions?.completeUnit ?? (async (input: StoryCompleteInput) => done(input.unitIndex, 2)))
  const session = new StoryReaderSession({
    releaseKey: KEY_A,
    viewerId: VIEWER,
    unitCount: 3,
    kind: 'story_edition',
    coverage: opts.completionLabel === 'adapted_partial' ? 'episode' : 'complete_work',
    completionLabel: opts.completionLabel ?? 'adapted_full_work',
    unitTitles: ['Tide', 'Gull', 'Rock'],
    actions: { recordPosition, completeUnit },
    auth: guard,
    navigate,
    emit: (e) => {
      if (e.name === 'story_reader_action') events.push(e)
    },
    refresh,
  })
  return { guard, session, events, navigate, refresh, recordPosition, completeUnit }
}

describe('보내기 전 문 — 인증 긍정 확인 전 · 무효 뒤 액션 0번', () => {
  it('기준선이 늦어 확인 전(checking)이면 시작 · 이동 · 완료 · 다시 시도 모두 액션을 부르지 않는다', async () => {
    const { session, guard, recordPosition, completeUnit, events, navigate } = setup({ browser: 'unverified' })
    expect(guard.status).toBe('checking')
    expect(session.canSend()).toBe(false)
    await session.go(0, 'start')
    await session.go(1, 'navigate')
    await session.complete(1)
    await session.retry()
    expect(recordPosition).not.toHaveBeenCalled()
    expect(completeUnit).not.toHaveBeenCalled()
    expect(events).toEqual([])
    expect(navigate).not.toHaveBeenCalled()
  })

  it('서버는 A, 브라우저는 B 로 확인되면 액션 0번 · 개인 내용 숨김', async () => {
    const { session, guard, recordPosition, completeUnit } = setup({ browser: OTHER })
    expect(guard.status).toBe('changed')
    await session.go(0, 'start')
    await session.complete(0)
    expect(recordPosition).not.toHaveBeenCalled()
    expect(completeUnit).not.toHaveBeenCalled()
    expect(readerVisibility(guard.status, session.getSnapshot().denied)).toBe('auth_changed')
  })

  it('무효(invalidate) 뒤 go · complete · retry 는 보내지 않는다 — 실패 뒤 다시 시도 포함', async () => {
    const { session, guard, recordPosition } = setup({ actions: { recordPosition: async () => fail() } })
    await session.go(1, 'navigate')
    expect(recordPosition).toHaveBeenCalledTimes(1)
    expect(session.getSnapshot().status?.tone).toBe('error')
    guard.invalidate()
    await session.retry()
    await session.go(2, 'navigate')
    await session.complete(2)
    expect(recordPosition).toHaveBeenCalledTimes(1)
  })

  it('모든 입력에 expectedViewerId(= 서버 viewerId)를 싣는다', async () => {
    const { session, recordPosition, completeUnit } = setup()
    await session.go(0, 'start')
    await session.complete(0)
    expect(recordPosition.mock.calls[0][0]).toEqual({ releaseKey: KEY_A, unitIndex: 0, reason: 'start', expectedViewerId: VIEWER })
    expect(completeUnit.mock.calls[0][0]).toEqual({ releaseKey: KEY_A, unitIndex: 0, expectedViewerId: VIEWER })
  })
})

describe('위치 기록 — 명시적 시작 · 이어 읽기 · 이동', () => {
  it('start: recordPosition 이 성공한 뒤에 이벤트를 보내고 그 단위로 이동한다', async () => {
    const { session, events, navigate, recordPosition } = setup()
    expect(recordPosition).not.toHaveBeenCalled() // 세션을 만드는 것만으로는 아무것도 기록하지 않는다
    await session.go(0, 'start')
    expect(events).toEqual([
      { name: 'story_reader_action', props: { action: 'start', kind: 'story_edition', coverage: 'complete_work', unit_index: 0, completed: false } },
    ])
    expect(navigate).toHaveBeenCalledWith(`/library/stories/${KEY_A}?unit=0`)
    expect(session.getSnapshot().navPending).toBeNull()
    expect(session.getSnapshot().status).toBeNull()
  })

  it('실패: 성공을 말하지 않고 · 이동 · 이벤트 없음 · 다시 시도는 같은 내용을 다시 보낸다', async () => {
    const results: PosResult[] = [fail(), pos(2)]
    const { session, events, navigate, recordPosition } = setup({ actions: { recordPosition: async () => results.shift()! } })
    await session.go(2, 'resume')
    const status = session.getSnapshot().status
    expect(status?.tone).toBe('error')
    expect(status?.message).toBe(POSITION_FAILED)
    expect(events).toEqual([])
    expect(navigate).not.toHaveBeenCalled()

    await session.retry()
    expect(recordPosition).toHaveBeenCalledTimes(2)
    expect(recordPosition.mock.calls[1][0]).toEqual(recordPosition.mock.calls[0][0])
    expect(recordPosition.mock.calls[1][0]).toEqual({ releaseKey: KEY_A, unitIndex: 2, reason: 'resume', expectedViewerId: VIEWER })
    expect(events.map((e) => e.props)).toEqual([{ action: 'resume', kind: 'story_edition', coverage: 'complete_work', unit_index: 2, completed: false }])
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it('던진 오류도 실패로 남긴다(성공 · 이벤트 없음)', async () => {
    const { session, events, navigate } = setup({
      actions: {
        recordPosition: async () => {
          throw new Error('network')
        },
      },
    })
    await session.go(1, 'navigate')
    expect(session.getSnapshot().status?.tone).toBe('error')
    expect(events).toEqual([])
    expect(navigate).not.toHaveBeenCalled()
  })

  it('연타: 진행 중에는 다음 위치 요청을 보내지 않는다(한 번만)', async () => {
    const d = deferred<PosResult>()
    const { session, recordPosition, navigate } = setup({ actions: { recordPosition: () => d.promise } })
    const first = session.go(1, 'navigate')
    void session.go(1, 'navigate')
    void session.go(2, 'navigate')
    expect(recordPosition).toHaveBeenCalledTimes(1)
    expect(session.getSnapshot().navPending).toEqual({ unitIndex: 1, reason: 'navigate' })
    d.resolve(pos(1))
    await first
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it('다른 주인의 응답은 버리고 인증 경계를 바뀜으로 고정한다', async () => {
    const { session, guard, events, navigate } = setup({ actions: { recordPosition: async () => pos(1, { viewerId: OTHER }) } })
    await session.go(1, 'navigate')
    expect(guard.status).toBe('changed')
    expect(events).toEqual([])
    expect(navigate).not.toHaveBeenCalled()
  })

  it('다른 발행본의 응답은 성공으로 치지 않는다', async () => {
    const { session, events, navigate } = setup({ actions: { recordPosition: async () => pos(1, { releaseKey: KEY_B }) } })
    await session.go(1, 'navigate')
    expect(session.getSnapshot().status?.tone).toBe('error')
    expect(events).toEqual([])
    expect(navigate).not.toHaveBeenCalled()
  })
})

describe('서버 거부 — 읽은 뒤에도 개인 내용 폐기 + refresh + 이유', () => {
  for (const code of DENIAL_CODES) {
    it(`위치 저장 ${code}: denied · refresh 1회 · 이벤트 · 이동 없음 · 이후 액션 0번`, async () => {
      const { session, guard, events, navigate, refresh, recordPosition, completeUnit } = setup({
        actions: { recordPosition: async () => fail(code, false) },
      })
      await session.go(1, 'navigate')
      const snap = session.getSnapshot()
      expect(snap.denied).toEqual({ code, message: `거부: ${code}` })
      expect(snap.status).toBeNull()
      expect(snap.completedLocal).toEqual([])
      expect(readerVisibility(guard.status, snap.denied)).toBe('denied')
      expect(refresh).toHaveBeenCalledTimes(1)
      expect(events).toEqual([])
      expect(navigate).not.toHaveBeenCalled()
      await session.go(2, 'navigate')
      await session.complete(2)
      await session.retry()
      expect(recordPosition).toHaveBeenCalledTimes(1)
      expect(completeUnit).not.toHaveBeenCalled()
    })
  }

  it('완료 저장 account_blocked: 앞서 받은 완료 표시도 지우고 refresh', async () => {
    const results: DoneResult[] = [done(0, 2), fail('account_blocked', false)]
    const { session, refresh } = setup({ actions: { completeUnit: async () => results.shift()! } })
    await session.complete(0)
    expect(session.getSnapshot().completedLocal).toEqual([0])
    await session.complete(1)
    const snap = session.getSnapshot()
    expect(snap.denied?.code).toBe('account_blocked')
    expect(snap.completedLocal).toEqual([])
    expect(snap.counts).toBeNull()
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('거부 뒤 진행 중이던 다른 응답은 버린다 · 서버가 다시 그리면 clearDenial', async () => {
    const d = deferred<DoneResult>()
    const { session, events } = setup({
      actions: {
        completeUnit: (input) => (input.unitIndex === 0 ? d.promise : Promise.resolve(fail('release_unavailable', false))),
      },
    })
    const slow = session.complete(0)
    await session.complete(1)
    d.resolve(done(0, 2))
    await slow
    expect(session.getSnapshot().completedLocal).toEqual([])
    expect(events).toEqual([])
    session.clearDenial()
    expect(session.getSnapshot().denied).toBeNull()
  })
})

describe('낡은 응답', () => {
  it('화면이 떠난 뒤(발행본 교체 · 언마운트) 도착한 응답은 버린다', async () => {
    const d = deferred<PosResult>()
    const { session, events, navigate } = setup({ actions: { recordPosition: () => d.promise } })
    const p = session.go(1, 'navigate')
    session.detach()
    d.resolve(pos(1))
    await p
    expect(events).toEqual([])
    expect(navigate).not.toHaveBeenCalled()
    expect(session.getSnapshot().navPending).toBeNull()
  })

  it('완료 응답이 순서 뒤바뀌어 와도 작은 낡은 수가 큰 수를 덮지 않고 · 단위별로 결속된다', async () => {
    const d0 = deferred<DoneResult>()
    const d2 = deferred<DoneResult>()
    const { session, events } = setup({ actions: { completeUnit: (input) => (input.unitIndex === 0 ? d0.promise : d2.promise) } })
    const a = session.complete(0)
    const b = session.complete(2)
    expect(session.getSnapshot().completing).toEqual([0, 2])
    d2.resolve(done(2, 3))
    await b
    d0.resolve(done(0, 2))
    await a
    const snap = session.getSnapshot()
    expect(snap.completedLocal).toEqual([0, 2])
    expect(snap.counts).toEqual({ completedUnitCount: 3, completed: true })
    expect(events.map((e) => e.props.unit_index)).toEqual([2, 0])
  })

  it('다른 단위 번호를 말하는 완료 응답은 반영하지 않는다', async () => {
    const { session, events } = setup({ actions: { completeUnit: async () => done(2, 2) } })
    await session.complete(1)
    expect(session.getSnapshot().completedLocal).toEqual([])
    expect(session.getSnapshot().status?.tone).toBe('error')
    expect(events).toEqual([])
  })
})

describe('인증 전환 · 로그아웃', () => {
  function fakeSource() {
    let listener: ((c: StoryAuthChange) => void) | null = null
    const source: StoryAuthSource = {
      subscribe: (l) => {
        listener = l
        return () => {
          listener = null
        }
      },
      currentUserId: () => new Promise<string | null>(() => {}),
    }
    return { source, fire: (c: StoryAuthChange) => listener?.(c) }
  }

  it('SIGNED_OUT 은 진행 중 위치 결과를 버린다(이동 · 이벤트 없음)', async () => {
    const d = deferred<PosResult>()
    const { session, guard, events, navigate } = setup({ actions: { recordPosition: () => d.promise } })
    const auth = fakeSource()
    guard.connect(auth.source)
    const p = session.go(1, 'navigate')
    auth.fire({ event: 'SIGNED_OUT', userId: null })
    expect(guard.status).toBe('changed')
    d.resolve(pos(1))
    await p
    expect(events).toEqual([])
    expect(navigate).not.toHaveBeenCalled()
  })

  it('다른 계정으로 전환되면 진행 중 완료 결과를 버린다', async () => {
    const d = deferred<DoneResult>()
    const { session, guard, events } = setup({ actions: { completeUnit: () => d.promise } })
    const auth = fakeSource()
    guard.connect(auth.source)
    const p = session.complete(1)
    auth.fire({ event: 'SIGNED_IN', userId: OTHER })
    d.resolve(done(1, 2))
    await p
    expect(session.getSnapshot().completedLocal).toEqual([])
    expect(events).toEqual([])
  })
})

describe('완료 — 버튼으로만 · 재호출 안전', () => {
  it('같은 단위 연타는 한 번만 보낸다 · 이동과 별개다', async () => {
    const d = deferred<DoneResult>()
    const { session, completeUnit, recordPosition, navigate } = setup({ actions: { completeUnit: () => d.promise } })
    const p = session.complete(1)
    void session.complete(1)
    expect(completeUnit).toHaveBeenCalledTimes(1)
    d.resolve(done(1, 2))
    await p
    expect(recordPosition).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('일부만 표시하면 「완료 표시 K/M」 · 전 단위 표시 뒤에만 각색 완독', async () => {
    const counts = [2, 3]
    const { session, events } = setup({ actions: { completeUnit: async (input) => done(input.unitIndex, counts.shift()!) } })
    await session.complete(1)
    expect(session.getSnapshot().status).toEqual({ tone: 'done', message: '2번째 단위 · Gull — 읽음으로 표시했어요 · 완료 표시 2/3' })
    await session.complete(2)
    expect(session.getSnapshot().status?.message).toBe('3번째 단위 · Rock — 읽음으로 표시했어요 · 각색 완독')
    expect(events.map((e) => [e.props.action, e.props.completed])).toEqual([
      ['unit_complete', false],
      ['unit_complete', true],
    ])
  })

  it('부분 판본은 전 단위 표시 뒤 「이 부분 읽기 완료」', async () => {
    const { session } = setup({
      completionLabel: 'adapted_partial',
      actions: { completeUnit: async (input) => done(input.unitIndex, 3, { completionLabel: 'adapted_partial' }) },
    })
    await session.complete(2)
    expect(session.getSnapshot().status?.message).toContain('이 부분 읽기 완료')
    expect(session.getSnapshot().status?.message).not.toContain('각색 완독')
  })

  it('완료 실패는 사실대로 · 다시 시도는 같은 단위를 다시 보낸다', async () => {
    const results: DoneResult[] = [fail(), done(1, 2)]
    const { session, completeUnit, events } = setup({ actions: { completeUnit: async () => results.shift()! } })
    await session.complete(1)
    expect(session.getSnapshot().status).toMatchObject({ tone: 'error', message: COMPLETE_FAILED })
    expect(events).toEqual([])
    await session.retry()
    expect(completeUnit.mock.calls.map((c) => c[0])).toEqual([
      { releaseKey: KEY_A, unitIndex: 1, expectedViewerId: VIEWER },
      { releaseKey: KEY_A, unitIndex: 1, expectedViewerId: VIEWER },
    ])
    expect(session.getSnapshot().completedLocal).toEqual([1])
    expect(events).toHaveLength(1)
  })
})

describe('StoryAuthGuard', () => {
  it('구독을 먼저 걸고 기준선을 읽는다 · 기준선 전에 온 이벤트가 이긴다', async () => {
    const order: string[] = []
    let listener: ((c: StoryAuthChange) => void) | null = null
    const baseline = deferred<string | null>()
    const guard = new StoryAuthGuard(VIEWER)
    guard.connect({
      subscribe: (l) => {
        order.push('subscribe')
        listener = l
        return () => {}
      },
      currentUserId: () => {
        order.push('baseline')
        return baseline.promise
      },
    })
    expect(order).toEqual(['subscribe', 'baseline'])
    listener!({ event: 'SIGNED_OUT', userId: null })
    expect(guard.status).toBe('changed')
    baseline.resolve(VIEWER) // 늦게 온 기준선이 바뀜을 되돌리지 않는다
    await flush()
    expect(guard.status).toBe('changed')
  })

  it('확인 전(checking)에는 isCurrent · accepts 가 거짓 — 긍정 확인 뒤에만 참', async () => {
    const baseline = deferred<string | null>()
    const guard = new StoryAuthGuard(VIEWER)
    guard.connect({ subscribe: () => () => {}, currentUserId: () => baseline.promise })
    expect(guard.isCurrent(guard.token())).toBe(false)
    expect(guard.accepts(guard.token(), VIEWER)).toBe(false)
    baseline.resolve(VIEWER)
    await flush()
    expect(guard.status).toBe('same')
    expect(guard.accepts(guard.token(), VIEWER)).toBe(true)
    expect(guard.accepts(guard.token(), OTHER)).toBe(false)
  })

  it('토큰 갱신(같은 uid)은 바꾸지 않는다 · 세대는 바뀔 때 한 번 오른다 · 되돌아와도 바뀜 유지', async () => {
    let listener: ((c: StoryAuthChange) => void) | null = null
    const guard = new StoryAuthGuard(VIEWER)
    guard.connect({ subscribe: (l) => ((listener = l), () => {}), currentUserId: async () => VIEWER })
    await flush()
    const token = guard.token()
    listener!({ event: 'TOKEN_REFRESHED', userId: VIEWER })
    expect(guard.isCurrent(token)).toBe(true)
    listener!({ event: 'SIGNED_IN', userId: OTHER })
    expect(guard.generation).toBe(token + 1)
    expect(guard.isCurrent(token)).toBe(false)
    listener!({ event: 'SIGNED_IN', userId: VIEWER })
    expect(guard.status).toBe('changed')
  })

  it('기준선이 다른 uid 면 바뀜', async () => {
    const guard = new StoryAuthGuard(VIEWER)
    guard.connect({ subscribe: () => () => {}, currentUserId: async () => OTHER })
    await flush()
    expect(guard.status).toBe('changed')
  })

  it('해제 뒤 이벤트 · 기준선은 무시한다', async () => {
    let listener: ((c: StoryAuthChange) => void) | null = null
    const guard = new StoryAuthGuard(VIEWER)
    const off = guard.connect({ subscribe: (l) => ((listener = l), () => {}), currentUserId: async () => OTHER })
    off()
    listener!({ event: 'SIGNED_OUT', userId: null })
    await flush()
    expect(guard.status).toBe('checking')
  })
})

describe('readerAuthDecision — 바뀜 화면 · 자동 새로 고침은 개인 내용이 있는 ready 에서만', () => {
  it('blocked · unavailable 은 어떤 인증 상태에서도 바뀜 화면 · 자동 새로 고침 없음', () => {
    for (const status of ['blocked', 'unavailable'] as const) {
      for (const auth of ['checking', 'same', 'changed'] as const) {
        expect(readerAuthDecision(status, auth), `${status}/${auth}`).toEqual({ authChangedView: false, autoRefresh: false })
      }
    }
  })
  it('ready 는 바뀌면 화면 + 새로 고침 · signed_out 은 화면 그대로 + 한 번 새로 고침', () => {
    expect(readerAuthDecision('ready', 'changed')).toEqual({ authChangedView: true, autoRefresh: true })
    expect(readerAuthDecision('ready', 'same')).toEqual({ authChangedView: false, autoRefresh: false })
    expect(readerAuthDecision('ready', 'checking')).toEqual({ authChangedView: false, autoRefresh: false })
    expect(readerAuthDecision('signed_out', 'changed')).toEqual({ authChangedView: false, autoRefresh: true })
  })
  it('읽은 뒤 서버 거부(account_blocked) → refresh → 서버가 blocked 를 주면 브라우저가 로그인돼 있어도 새로 고침이 다시 일어나지 않는다', async () => {
    const { session, refresh } = setup({ actions: { recordPosition: async () => fail('account_blocked', false) } })
    await session.go(1, 'navigate')
    expect(session.getSnapshot().denied?.code).toBe('account_blocked')
    expect(refresh).toHaveBeenCalledTimes(1)
    // refresh 뒤 서버 상태는 blocked — 그 상태의 경계(주인 null)는 브라우저 A 와 달라도 바뀜 처리하지 않는다
    const after = new StoryAuthGuard(null)
    after.observe({ event: 'BASELINE', userId: VIEWER })
    expect(after.status).toBe('changed')
    expect(readerAuthDecision('blocked', after.status)).toEqual({ authChangedView: false, autoRefresh: false })
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
