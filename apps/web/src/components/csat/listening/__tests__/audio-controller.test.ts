// apps/web/src/components/csat/listening/__tests__/audio-controller.test.ts
// 합성 테스트 음원(가짜 오디오 요소)으로 재생 · 구간 반복 · 속도 · 실패 · 원음 없음 상태를 본다. 실제 음원은 없다.
import { describe, expect, it } from 'vitest'

import { createAudioController, type AudioLike } from '../useListeningAudio'

function fakeAudio(opts: { rejectPlay?: boolean } = {}) {
  const ls = new Map<string, Set<() => void>>()
  const emit = (t: string) => ls.get(t)?.forEach((f) => f())
  const el: AudioLike & { emit: typeof emit; paused: boolean } = {
    currentTime: 0,
    playbackRate: 1,
    paused: true,
    play() {
      if (opts.rejectPlay) return Promise.reject(new Error('NotAllowedError'))
      el.paused = false
      emit('play')
      return Promise.resolve()
    },
    pause() {
      el.paused = true
      emit('pause')
    },
    addEventListener: (t, f) => void (ls.get(t) ?? ls.set(t, new Set()).get(t)!).add(f),
    removeEventListener: (t, f) => void ls.get(t)?.delete(f),
    emit,
  }
  return el
}

const SYN = { kind: 'synthetic-test-fixture', url: '/test/synthetic.mp3', rights: 'unverified' } as const

describe('createAudioController', () => {
  it("kind 'none' → no-source, 요소를 만들지 않는다", () => {
    let made = 0
    const c = createAudioController({ kind: 'none', rights: 'unverified' }, () => {
      made++
      return fakeAudio()
    })
    expect(c.get().status).toBe('no-source')
    c.toggle()
    expect(made).toBe(0)
  })

  it('권리 미검증 official 은 재생하지 않는다', () => {
    expect(createAudioController({ kind: 'official', url: '/a.mp3', rights: 'unverified' }, () => fakeAudio()).get().status).toBe('no-source')
  })

  it('재생 · 일시정지 · 속도 · 구간 반복 끝에서 멈춤', () => {
    const el = fakeAudio()
    const c = createAudioController(SYN, () => el)
    expect(c.get().status).toBe('idle')
    c.toggle()
    expect(c.get().status).toBe('playing')
    c.toggle()
    expect(c.get().status).toBe('paused')
    c.setRate(0.75)
    expect(el.playbackRate).toBe(0.75)
    expect(c.get().rate).toBe(0.75)
    c.playSegment(2000, 4000)
    expect(el.currentTime).toBe(2)
    expect(c.get().segmentEndMs).toBe(4000)
    el.currentTime = 4.01
    el.emit('timeupdate')
    expect(el.paused).toBe(true)
    expect(c.get().segmentEndMs).toBeNull()
  })

  it('요소 오류 · 재생 거부 → error', async () => {
    const el = fakeAudio()
    const c = createAudioController(SYN, () => el)
    el.emit('error')
    expect(c.get().status).toBe('error')
    const c2 = createAudioController(SYN, () => fakeAudio({ rejectPlay: true }))
    c2.toggle()
    await Promise.resolve()
    await Promise.resolve()
    expect(c2.get().status).toBe('error')
    const c3 = createAudioController(SYN, () => {
      throw new Error('no Audio')
    })
    expect(c3.get().status).toBe('error')
  })
})
