// apps/web/src/components/echo/__tests__/echo-finish-attempt.test.ts
// T-0227 Codex P2 — stopRecording 의 판정 · 상태 전이(순수 함수)와 Player 가 그 함수를 실제로 부른다는 소스 결속.
// 저장소에 jsdom/testing-library 가 없어 실제 렌더 왕복(await 사이 클릭 · 마이크 권한)은 PC 하네스가 덮는다.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { computeShadowMatch } from '@/lib/workspace/shadow-match'

import {
  HEARD_REASON_TEXT,
  gateAfterStop,
  isLiveRecog,
  measureTranscript,
  scoredOutcome,
  visibleHeard,
  type RecogAttemptState,
} from '../heard-reference'

const TARGET = 'The cat sat on the mat.'
const recog = (over: Partial<RecogAttemptState> = {}): RecogAttemptState => ({
  supported: true,
  startFailed: false,
  errored: false,
  transcript: '',
  ...over,
})
const score = { pitch: 70, energy: 60, timing: 80, overall: 71 }
const base = {
  supported: true,
  bind: { gen: 4, materialKey: 's1|h', authToken: 9 },
  textId: 't1',
  libraryBookId: undefined,
  sentenceId: 's1',
  prevAttempts: 0,
  score,
  durationMs: 1234,
  expectedUserId: 'u1',
}

describe('measureTranscript — 비율 입력 = 표시 문자열', () => {
  it('비율 계산에 넘긴 trim 문자열이 그대로 화면 스냅숏 문자열이 된다', () => {
    const seen: string[] = []
    const m = measureTranscript(TARGET, recog({ transcript: '  the cat sat  ' }), (t, s) => {
      seen.push(s)
      return computeShadowMatch(t, s)
    })
    expect(seen).toEqual(['the cat sat'])
    expect(m.used).toBe('the cat sat')
    expect(m.ratio).toBe(computeShadowMatch(TARGET, 'the cat sat').ratio)
    const o = scoredOutcome({ ...base, measured: m })
    expect(o.heard).toMatchObject({ kind: 'text', text: seen[0] })
  })

  it('빈 인식은 비율 미측정(null) · 「빈 결과」 사유', () => {
    const m = measureTranscript(TARGET, recog({ transcript: '   ' }))
    expect(m).toMatchObject({ used: null, ratio: null, matchedKeys: null, failed: false })
    expect(scoredOutcome({ ...base, measured: m }).heard).toMatchObject({ kind: 'unconfirmed', reason: 'empty' })
  })

  it('start() 가 false · onError · stop() 예외는 「빈 결과」가 아니라 실패 사유', () => {
    for (const over of [{ startFailed: true }, { errored: true }]) {
      const m = measureTranscript(TARGET, recog(over))
      expect(m.failed).toBe(true)
      const h = scoredOutcome({ ...base, measured: m }).heard
      expect(h).toMatchObject({ kind: 'unconfirmed', reason: 'failed' })
      expect(HEARD_REASON_TEXT.failed).toContain('실패')
    }
  })

  it('일부 인식 뒤 onError — 참고문장이 아니라 실패 사유(채점 비율은 기존대로 잰다)', () => {
    const m = measureTranscript(TARGET, recog({ transcript: 'the cat', errored: true }))
    expect(m.used).toBe('the cat')
    expect(m.ratio).toBe(computeShadowMatch(TARGET, 'the cat').ratio)
    expect(scoredOutcome({ ...base, measured: m }).heard).toMatchObject({ kind: 'unconfirmed', reason: 'failed' })
  })

  it('stop() 이 던지면 기존처럼 비율을 재지 않고 실패 사유', () => {
    const m = measureTranscript(TARGET, recog({ transcript: 'the cat', stopThrew: true }))
    expect(m).toMatchObject({ used: null, ratio: null, matchedKeys: null, failed: true })
    expect(scoredOutcome({ ...base, measured: m }).heard).toMatchObject({ kind: 'unconfirmed', reason: 'failed' })
  })

  it('미지원 브라우저는 실패가 아니라 미지원 사유', () => {
    const m = measureTranscript(TARGET, recog({ supported: false, startFailed: true }))
    expect(m.failed).toBe(false)
    expect(scoredOutcome({ ...base, supported: false, measured: m }).heard).toMatchObject({ kind: 'unconfirmed', reason: 'unsupported' })
  })
})

describe('isLiveRecog — 늦은 콜백 · 다른 세대 무시', () => {
  it('같은 세대 · 인식 열림일 때만 살아 있다', () => {
    expect(isLiveRecog(4, 4, 4)).toBe(true)
    expect(isLiveRecog(4, null, 4)).toBe(false) // 정지 뒤 늦은 콜백
    expect(isLiveRecog(3, 4, 4)).toBe(false) // 이전 시도의 콜백 · 오류
    expect(isLiveRecog(4, 4, 5)).toBe(false) // 문장 이동 · 화면 이탈
  })
  it('자료 · 계정이 바뀐 뒤 정리 전에 온 이전 콜백도 무시', () => {
    const ok = { startedKey: 's1|h', currentKey: 's1|h', authCurrent: true }
    expect(isLiveRecog(4, 4, 4, ok)).toBe(true)
    expect(isLiveRecog(4, 4, 4, { ...ok, currentKey: 's1|other' })).toBe(false)
    expect(isLiveRecog(4, 4, 4, { ...ok, currentKey: null })).toBe(false)
    expect(isLiveRecog(4, 4, 4, { ...ok, authCurrent: false })).toBe(false)
  })
})

describe('gateAfterStop — 계정 · 자료 변경 시 저장 0', () => {
  const run = (g: ReturnType<typeof gateAfterStop>) => {
    const saves: unknown[] = []
    if (g === 'ok') saves.push(scoredOutcome({ ...base, measured: measureTranscript(TARGET, recog({ transcript: 'cat' })) }).save)
    return saves.length
  }
  it('await 사이 세대가 바뀌면 stale — 저장 0', () => {
    expect(gateAfterStop({ startedGen: 4, currentGen: 5, authCurrent: true, expectedUserId: 'u1' })).toBe('stale')
    expect(run(gateAfterStop({ startedGen: 4, currentGen: 5, authCurrent: true, expectedUserId: 'u1' }))).toBe(0)
  })
  it('계정이 바뀌거나 주인이 없으면 denied — 저장 0', () => {
    expect(run(gateAfterStop({ startedGen: 4, currentGen: 4, authCurrent: false, expectedUserId: 'u1' }))).toBe(0)
    expect(run(gateAfterStop({ startedGen: 4, currentGen: 4, authCurrent: true, expectedUserId: null }))).toBe(0)
  })
  it('같은 세대 · 같은 사람이면 저장 1', () => {
    expect(run(gateAfterStop({ startedGen: 4, currentGen: 4, authCurrent: true, expectedUserId: 'u1' }))).toBe(1)
  })
})

describe('scoredOutcome — 저장 payload 는 기존과 같다', () => {
  it('기존 saveEchoAttempt 인자 모양 · 값 그대로(transcript 는 싣지 않는다)', () => {
    const o = scoredOutcome({ ...base, prevAttempts: 2, measured: measureTranscript(TARGET, recog({ transcript: 'the cat' })) })
    expect(o.attemptNumber).toBe(3)
    expect(o.save).toStrictEqual({
      textId: 't1',
      libraryBookId: null,
      sentenceId: 's1',
      attemptNumber: 3,
      score,
      durationMs: 1234,
      expectedUserId: 'u1',
    })
    expect(JSON.stringify(o.save)).not.toContain('the cat')
  })
  it('스냅숏은 시작 세대 · 자료 · 계정에 묶여 바뀌면 보이지 않는다', () => {
    const o = scoredOutcome({ ...base, measured: measureTranscript(TARGET, recog({ transcript: 'cat' })) })
    const now = { scored: true, gen: 4, materialKey: 's1|h', authCurrent: (t: number) => t === 9 }
    expect(visibleHeard(o.heard, now)).not.toBeNull()
    expect(visibleHeard(o.heard, { ...now, materialKey: 's1|other' })).toBeNull()
    expect(visibleHeard(o.heard, { ...now, authCurrent: () => false })).toBeNull()
  })
})

describe('Player 소스 결속 — 위 함수를 실제로 부른다', () => {
  const src = readFileSync(join(__dirname, '..', 'EchoMatchPlayer.tsx'), 'utf8')
  it('정지 판정 · 게이트 · 결과 · 콜백 세대 판정을 순수 함수로', () => {
    expect(src).toMatch(/measureTranscript\(sentence\.text,/)
    expect(src).toMatch(/gateAfterStop\(\{/)
    expect(src).toMatch(/const outcome = scoredOutcome\(\{/)
    expect(src).toMatch(/setHeard\(outcome\.heard\)/)
    expect(src).toMatch(/void saveEchoAttempt\(outcome\.save\)/)
    expect(src).toMatch(/isLiveRecog\(gen, recogGenRef\.current, runGenRef\.current, \{\s*startedKey,\s*currentKey: materialKeyRef\.current,\s*authCurrent: authGuard\.isCurrent\(startedAuth\),/)
    expect(src.match(/if \(!live\(\)\) return/g)?.length).toBe(2)
    expect(src).toMatch(/onError: \(\) =>/)
    expect(src).toMatch(/if \(!started\) recogStartFailedRef\.current = true/)
  })
  it('Player 안에 옛 인라인 판정이 남지 않는다', () => {
    expect(src).not.toMatch(/computeShadowMatch/)
    expect(src).not.toMatch(/saveEchoAttempt\(\{/)
    expect(src.match(/saveEchoAttempt\(/g)?.length).toBe(1)
  })
})
