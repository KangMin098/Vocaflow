// apps/web/src/lib/echo/__tests__/replay.test.ts
// @vitest-environment node
// EchoMatch 다시 듣기 — 재생 하나만 · 정지/전환/이탈 · 늦은 완료/실패 폐기 · 기록 경로 호출 0 · 재생 유틸의 선택적 중단.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { EchoReplay, IDLE_REPLAY, type ReplayState } from '../replay-controller'
import { ReplayPanel } from '@/components/echo/ReplayPanel'

const BUF = {} as AudioBuffer

function deferredPlay() {
  const calls: { resolve: () => void; reject: (e: unknown) => void; signal: AbortSignal }[] = []
  const play = vi.fn(
    (_b: AudioBuffer, { signal }: { signal: AbortSignal }) =>
      new Promise<void>((resolve, reject) => calls.push({ resolve, reject, signal })),
  )
  return { play, calls }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('EchoReplay', () => {
  it('새 재생은 앞선 재생을 끊고, 끊긴 재생의 늦은 완료는 상태를 바꾸지 않는다', async () => {
    const { play, calls } = deferredPlay()
    const states: ReplayState[] = []
    const r = new EchoReplay(play, (s) => states.push(s))
    r.start('reference', BUF)
    r.start('self', BUF)
    expect(calls[0]!.signal.aborted).toBe(true)
    expect(calls[1]!.signal.aborted).toBe(false)
    calls[0]!.resolve()
    await flush()
    expect(states.at(-1)).toEqual({ playing: 'self', failed: null })
    calls[1]!.resolve()
    await flush()
    expect(states.at(-1)).toEqual(IDLE_REPLAY)
  })

  it('정지는 끊고 비우며, 그 뒤 도착한 실패는 버린다', async () => {
    const { play, calls } = deferredPlay()
    const states: ReplayState[] = []
    const r = new EchoReplay(play, (s) => states.push(s))
    r.start('self', BUF)
    r.stop()
    expect(calls[0]!.signal.aborted).toBe(true)
    calls[0]!.reject(new Error('late'))
    await flush()
    expect(states.at(-1)).toEqual(IDLE_REPLAY)
  })

  it('재생 실패는 그 대상의 재생 오류로만 남는다(동기 throw 포함)', async () => {
    const states: ReplayState[] = []
    const r = new EchoReplay(() => {
      throw new Error('no ctx')
    }, (s) => states.push(s))
    r.start('reference', BUF)
    await flush()
    expect(states.at(-1)).toEqual({ playing: null, failed: 'reference' })
  })

  it('이탈(dispose) 뒤에는 끊고 알리지도 새로 재생하지도 않는다', async () => {
    const { play, calls } = deferredPlay()
    const onChange = vi.fn()
    const r = new EchoReplay(play, onChange)
    r.start('self', BUF)
    onChange.mockClear()
    r.dispose()
    expect(calls[0]!.signal.aborted).toBe(true)
    calls[0]!.resolve()
    r.start('reference', BUF)
    r.stop()
    await flush()
    expect(onChange).not.toHaveBeenCalled()
    expect(play).toHaveBeenCalledTimes(1)
  })
})

describe('ReplayPanel', () => {
  const base = { state: IDLE_REPLAY, onPlay: () => {}, onStop: () => {} }

  it('버퍼가 없으면 그 버튼을 막고 준비되지 않았다고만 말한다', () => {
    const html = renderToStaticMarkup(createElement(ReplayPanel, { ...base, referenceReady: true, selfReady: false }))
    expect(html).toMatch(/data-replay-target="self" aria-pressed="false" disabled=""/)
    expect(html).not.toMatch(/data-replay-target="reference" aria-pressed="false" disabled=""/)
    expect(html).toContain('이번에 녹음한 발화가 없어요')
  })

  it('재생 중인 쪽은 정지 버튼(aria-pressed)이 되고, 실패는 점수를 그대로 둔다고 알린다', () => {
    const playing = renderToStaticMarkup(
      createElement(ReplayPanel, { ...base, referenceReady: true, selfReady: true, state: { playing: 'self', failed: null } }),
    )
    expect(playing).toContain('내 발화 정지')
    expect(playing).toMatch(/aria-pressed="true"/)
    const failed = renderToStaticMarkup(
      createElement(ReplayPanel, { ...base, referenceReady: true, selfReady: true, state: { playing: null, failed: 'reference' } }),
    )
    expect(failed).toContain('점수와 기록은 그대로')
  })
})

describe('playAudioBuffer signal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  function stubAudio() {
    const src = {
      buffer: null as AudioBuffer | null,
      onended: null as null | (() => void),
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(function (this: { onended: null | (() => void) }) {
        this.onended?.()
      }),
    }
    const ctx = { createBufferSource: () => src, destination: {}, close: vi.fn() }
    vi.stubGlobal('window', { AudioContext: vi.fn(() => ctx) })
    return { src, ctx }
  }

  it('abort 는 이 소스만 멈추고 resolve — 공용 컨텍스트는 닫지 않는다', async () => {
    const { src, ctx } = stubAudio()
    const { playAudioBuffer } = await import('../audio-recorder')
    const ac = new AbortController()
    const p = playAudioBuffer(BUF, { signal: ac.signal })
    expect(src.start).toHaveBeenCalled()
    ac.abort()
    await expect(p).resolves.toBeUndefined()
    expect(src.stop).toHaveBeenCalled()
    expect(ctx.close).not.toHaveBeenCalled()
  })

  it('이미 abort 된 signal 은 재생을 시작하지 않고, signal 없는 기존 호출은 그대로 끝까지 재생한다', async () => {
    const { src } = stubAudio()
    const { playAudioBuffer } = await import('../audio-recorder')
    const ac = new AbortController()
    ac.abort()
    await playAudioBuffer(BUF, { signal: ac.signal })
    expect(src.start).not.toHaveBeenCalled()
    const p = playAudioBuffer(BUF)
    expect(src.start).toHaveBeenCalledTimes(1)
    src.onended?.()
    await expect(p).resolves.toBeUndefined()
  })
})

describe('기록 경로 결속', () => {
  it('다시 듣기 모듈은 녹음 · 인식 · 저장 · 점수 · SRS 를 가져오지 않는다', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    for (const f of ['../replay-controller.ts', '../../../components/echo/ReplayPanel.tsx']) {
      const src = fs.readFileSync(path.resolve(__dirname, f), 'utf8')
      expect(src).not.toMatch(/save-attempt|record-sound|speech-recognition|recordUntilStop|requestMicAccess|fsrs|supabase|localStorage|indexedDB|fetch\(/)
    }
  })
})

describe('다시 듣기 호출 시점 경계(실제 StoryAuthGuard)', async () => {
  const { StoryAuthGuard } = await import('@/components/library/story/use-story-auth-guard')
  const { replayBufferAt, sentenceMaterialKey } = await import('../replay-controller')
  const REF = { tag: 'ref' } as unknown as AudioBuffer
  const SELF = { tag: 'self' } as unknown as AudioBuffer
  const s = { id: 't1-0', text: 'Hello there.' }

  function setup() {
    const guard = new StoryAuthGuard('owner-a')
    guard.observe({ event: 'KNOWN', userId: 'owner-a' } as never)
    const key = sentenceMaterialKey(s)
    const take = { materialKey: key, buffer: SELF, authToken: guard.token() }
    const base = {
      scored: true,
      hidden: false,
      materialKey: key as string | null,
      reference: { materialKey: key, buffer: REF },
      take: take as typeof take | null,
      guard,
    }
    return { guard, base }
  }

  it('same 이면 이 문장의 예시와 이번 녹음을 준다', () => {
    const { base } = setup()
    expect(replayBufferAt({ ...base, target: 'reference' })).toBe(REF)
    expect(replayBufferAt({ ...base, target: 'self' })).toBe(SELF)
  })

  it('정리 effect 전이라도 경계가 changed 면 잡힌 콜백은 버퍼 0 → 재생 소스 0', () => {
    const { guard, base } = setup()
    guard.observe({ event: 'SIGNED_IN', userId: 'owner-b' } as never)
    expect(guard.getStatus()).toBe('changed')
    const play = vi.fn()
    const r = new EchoReplay(play, () => {})
    for (const target of ['reference', 'self'] as const) {
      const b = replayBufferAt({ ...base, target })
      if (b) r.start(target, b)
    }
    expect(play).not.toHaveBeenCalled()
  })

  it('checking(재확인 중)에도 막고, 다시 same 이 돼도 세대가 바뀐 옛 녹음은 주지 않는다', () => {
    const { guard, base } = setup()
    guard.invalidate()
    expect(replayBufferAt({ ...base, target: 'self' })).toBeNull()
    const g2 = new StoryAuthGuard('owner-a')
    g2.observe({ event: 'KNOWN', userId: 'owner-a' } as never)
    const old = { ...base.take!, authToken: 99 }
    expect(replayBufferAt({ ...base, guard: g2, take: old, target: 'self' })).toBeNull()
  })

  it('같은 id · 다른 내용이면 예시 캐시도 녹음도 넘기지 않는다', () => {
    const { base } = setup()
    const changed = sentenceMaterialKey({ id: s.id, text: 'Hello there, friend.' })
    expect(changed).not.toBe(base.materialKey)
    expect(replayBufferAt({ ...base, materialKey: changed, target: 'reference' })).toBeNull()
    expect(replayBufferAt({ ...base, materialKey: changed, target: 'self' })).toBeNull()
  })

  it('숨김 · pagehide 뒤 잡힌 시작 콜백은 소스를 만들지 않고, 결과 화면이 아니어도 막는다', () => {
    const { base } = setup()
    expect(replayBufferAt({ ...base, hidden: true, target: 'reference' })).toBeNull()
    expect(replayBufferAt({ ...base, scored: false, target: 'self' })).toBeNull()
  })

  it('pagehide 로 stop 된 뒤 도착한 늦은 완료 · 실패는 상태를 바꾸지 않는다', async () => {
    const { play, calls } = deferredPlay()
    const states: ReplayState[] = []
    const r = new EchoReplay(play, (st) => states.push(st))
    r.start('reference', REF)
    r.start('self', SELF)
    r.stop()
    calls[0]!.reject(new Error('late'))
    calls[1]!.resolve()
    await flush()
    expect(states.at(-1)).toEqual(IDLE_REPLAY)
    expect(calls.every((c) => c.signal.aborted)).toBe(true)
  })
})
