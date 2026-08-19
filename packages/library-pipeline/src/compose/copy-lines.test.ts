// packages/library-pipeline/src/compose/copy-lines.test.ts
//
// 전재를 두 계통으로 세지 않는다.
//
// 실측 2026-08-19: 연합뉴스 로카르노 기사와 코리아헤럴드 기사가 담김 31.3% 였다(부분 전재).
// 각자 취재한 쌍 4건은 0.0~1.3% 였다. 화면은 둘 다 `계통 2/2` 로 보여 주고 있었다.

import { describe, expect, it } from 'vitest'

import {
  SAME_COPY_CONTAINMENT,
  describeCopyGroups,
  groupByCopy,
  measuredLineCount,
} from './copy-lines'
import { buildFingerprint } from './fingerprint'

/** 같은 사건을 각자 쓴 두 기사 — 낱말은 겹쳐도 7어절 연속은 거의 안 겹친다. */
const INDEPENDENT_A =
  'The stadium in Pohang will close for a full safety inspection after a piece of concrete fell during a league match on Saturday evening.'
const INDEPENDENT_B =
  'A football club said on Thursday that its home ground cannot host matches while engineers examine the ceilings above the seats.'

/** 전재 — 한쪽 문단을 그대로 옮겼다. */
const WIRE_ORIGINAL =
  'Nowhere to Lay My Eyes, the director thirty fifth feature, follows a woman who heads to the southern island of Jeju to find her mother whom she last saw ten years ago. It marked the fifth time the director was invited to the festival to screen his work.'
const REPUBLISHED =
  'The festival opened on Wednesday with a new competition line up. Nowhere to Lay My Eyes, the director thirty fifth feature, follows a woman who heads to the southern island of Jeju to find her mother whom she last saw ten years ago. It marked the fifth time the director was invited to the festival to screen his work.'

const fp = (key: string, text: string) => ({ key, fingerprint: buildFingerprint(text) })

describe('groupByCopy — 측정된 계통', () => {
  it('각자 취재한 둘은 두 계통으로 센다', () => {
    const groups = groupByCopy([fp('a', INDEPENDENT_A), fp('b', INDEPENDENT_B)])
    expect(groups).toHaveLength(2)
    expect(measuredLineCount([fp('a', INDEPENDENT_A), fp('b', INDEPENDENT_B)])).toBe(2)
  })

  it('원고를 실은 둘은 한 계통으로 센다', () => {
    const srcs = [fp('yna', WIRE_ORIGINAL), fp('herald', REPUBLISHED)]
    expect(measuredLineCount(srcs)).toBe(1)
    const [g] = groupByCopy(srcs)
    expect(g!.keys.sort()).toEqual(['herald', 'yna'])
    expect(g!.worstContainment).toBeGreaterThanOrEqual(SAME_COPY_CONTAINMENT)
  })

  it('짧은 쪽이 긴 쪽에 담겨도 잡는다 — 방향을 가리지 않는다', () => {
    // 담김은 방향이 있다. 한 방향만 보면 긴 기사에 짧은 전재가 섞인 경우를 놓친다.
    const srcs = [fp('short', WIRE_ORIGINAL), fp('long', REPUBLISHED)]
    expect(measuredLineCount(srcs)).toBe(1)
    expect(measuredLineCount([srcs[1]!, srcs[0]!])).toBe(1)
  })

  it('전이적으로 묶는다 — A=B 이고 B=C 면 셋이 한 계통이다', () => {
    const srcs = [
      fp('a', WIRE_ORIGINAL),
      fp('b', REPUBLISHED),
      fp('c', WIRE_ORIGINAL + ' The show continues next week in another hall.'),
    ]
    expect(measuredLineCount(srcs)).toBe(1)
  })

  it('전재 하나가 섞여도 남은 독립 계통은 그대로 센다', () => {
    const srcs = [fp('yna', WIRE_ORIGINAL), fp('herald', REPUBLISHED), fp('bbc', INDEPENDENT_B)]
    expect(measuredLineCount(srcs)).toBe(2)
  })

  it('소스가 하나면 한 계통이고 사유는 붙지 않는다', () => {
    const groups = groupByCopy([fp('only', INDEPENDENT_A)])
    expect(groups).toHaveLength(1)
    expect(groups[0]!.worstContainment).toBe(0)
    expect(describeCopyGroups(groups)).toEqual([])
  })

  it('빈 입력은 계통 0 — 없는 것을 1로 세지 않는다', () => {
    expect(measuredLineCount([])).toBe(0)
  })

  it('묶은 이유를 사람이 읽을 문장으로 낸다', () => {
    const groups = groupByCopy([fp('yna', WIRE_ORIGINAL), fp('herald', REPUBLISHED)])
    const [msg] = describeCopyGroups(groups)
    expect(msg).toContain('한 계통으로 센다')
    expect(msg).toMatch(/\d+% 겹친다/)
  })

  it('부분 전재도 잡는다 — 실측한 것이 바로 이 모양이다(31%)', () => {
    // 두 기사의 서두는 각자 쓰고 작품 소개 문단만 옮긴 경우. 전문 전재보다 훨씬 낮게 나오므로
    //   임계값이 90% 같은 높은 자리에 있으면 이런 것을 통째로 놓친다.
    const partial =
      'The festival named its winners on Saturday night in front of a full hall. ' +
      'Local reporters said the mood was warm and the applause lasted for several minutes. ' +
      'Nowhere to Lay My Eyes, the director thirty fifth feature, follows a woman who heads to the southern island of Jeju to find her mother whom she last saw ten years ago. ' +
      'Organisers added that ticket sales had risen again this year across every screening venue.'
    const srcs = [fp('yna', WIRE_ORIGINAL), fp('herald', partial)]
    expect(measuredLineCount(srcs)).toBe(1)
    // 같은 쌍도 임계값을 올리면 갈라진다 — 판정을 만드는 것은 데이터가 아니라 이 값이다.
    expect(measuredLineCount(srcs, 0.9)).toBe(2)
  })
})
