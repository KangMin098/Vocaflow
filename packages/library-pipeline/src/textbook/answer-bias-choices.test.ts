// packages/library-pipeline/src/textbook/answer-bias-choices.test.ts
//
// **기대값이 다른 문항을 한 히스토그램에 담지 않는다.**
//
// 실측 2026-08-31 — 조판기가 정답 위치를 5칸 배열 하나에 몰아 담고 있었다. V1 은 초등
// 3종(4지선다)만 싣는데, 그러면 ⑤ 칸이 **구조적으로 영원히 0** 이 된다. 검사는 그것을
// 보고 χ²=16.25 · V=0.319 로 "정답 쏠림" 을 선언했다 — 없는 자리를 결함으로 고발한 것이다.
// 4칸으로 다시 세면 χ²=5.0(자유도 3, 임계 7.81)으로 정상이다.
//
// 이런 오탐은 조용히 사람의 신뢰를 깎는다. 다음 사이클에 "V1 은 원래 빨간색" 이 되면
// 진짜 쏠림이 생겨도 아무도 안 본다.
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { assessAnswerBias } from './item-health'

/**
 * 저장소 뿌리 — **이 파일 위치 기준**으로 잡는다.
 *
 * 전에는 `process.cwd()` 에서 '../..' 를 올라갔다. 그러면 패키지 디렉터리에서 돌릴 때만
 * 맞고, vitest 를 저장소 뿌리에서 돌리면 저장소 밖을 읽으려다 ENOENT 로
 * **네 파일이 통째로 실패**한다(실측 2026-09-05). 조용히 안 도는 테스트는 없는 테스트다.
 */
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')


describe('선택지 수와 쏠림 검정', () => {
  it('4지선다를 5칸으로 세면 없는 자리가 결함이 된다', () => {
    const asFive = assessAnswerBias([8, 7, 9, 16, 0])
    expect(asFive.biased).toBe(true) // 실제로 찍혔던 오탐

    const asFour = assessAnswerBias([8, 7, 9, 16])
    expect(asFour.df).toBe(3)
    expect(asFour.chi2).toBeCloseTo(5.0, 1)
    expect(asFour.biased).toBe(false) // 같은 문항, 맞는 자로 재면 정상
  })

  it('진짜 쏠림은 칸 수를 맞춰도 잡힌다', () => {
    // 4지선다인데 ④에만 몰린 경우 — 자를 고쳤다고 눈이 멀면 안 된다.
    const real = assessAnswerBias([2, 2, 2, 34])
    expect(real.biased).toBe(true)
    expect(real.cramersV).toBeGreaterThan(0.1)
  })

  it('조판기가 선택지 수별로 나눠 센다', () => {
    const src = fs.readFileSync(
      path.resolve(REPO_ROOT, 'scripts/textbook/render-volume.mjs'),
      'utf8',
    )
    // 고정 5칸 배열로 되돌아가지 않는다.
    expect(src).not.toContain('const biasCounts = [0, 0, 0, 0, 0]')
    expect(src).toContain('histByChoices')
    expect(src).toContain('new Array(k).fill(0)')
    // 묶음이 여럿이면 가장 나쁜 쪽을 대표로 — 평균은 쏠림을 감춘다.
    expect(src).toContain('g.cramersV > worst.cramersV')
    // 되짚을 수 있게 묶음 전부를 기록한다.
    expect(src).toContain('groups: biasGroups.map(')
  })

  it('교정은 문장으로 쪼갠 뒤에 건다 — `s+` 오타 재발 금지', () => {
    // 같은 오타가 이 저장소에서 세 번 났다(volume-pool 2회 + render-volume 1회).
    // `s+` 는 글자 s 를 찾으므로 지문이 통째로 문장 1개가 되고, 교정 분모가 문항 수와 같아진다.
    for (const f of ['render-volume.mjs', 'volume-pool.mjs']) {
      const src = fs.readFileSync(path.resolve(REPO_ROOT, 'scripts/textbook', f), 'utf8')
      expect(src, f).not.toMatch(/split\(\/(\(\?<=\[\.!\?\]\))?s\+\//)
    }
  })
})

/**
 * **삽입의 `position` 은 지면의 ①~⑤ 가 아니다.**
 *
 * 삽입 문항에는 `answer_key.answer` 가 없어 계수기가 `position` 으로 떨어졌는데, 그 값은
 * **원문 본문의 빈틈 색인**이라 5를 넘을 수 있다(V5 5,999건 중 346건 = 5.8%). `n <= k` 가
 * 그것을 조용히 버렸고 남은 것도 엉뚱한 칸에 담겼다 — **세는 자가 세려는 것을 안 세고 있었다**
 * (3인 검수 chunk-11, 2026-09-16).
 *
 * 인쇄와 같은 함수(`toCsatInsert`)로 되짚어 세니 실제 분포가 드러난다:
 *   ① 1,518 · ② 1,642 · ③ 1,643 · ④ 747 · ⑤ 387 — Cramér V ≈ **0.219**(임계 0.1).
 */
describe('삽입의 정답 자리는 인쇄와 같은 자로 센다', () => {
  it('실측 분포가 쏠림으로 판정된다 — 자를 고치면 보인다', () => {
    const real = assessAnswerBias([1518, 1642, 1643, 747, 387])
    expect(real.biased).toBe(true)
    expect(real.cramersV).toBeGreaterThan(0.2)
  })

  it('조판기가 `position` 을 자리로 쓰지 않는다', () => {
    const src = fs.readFileSync(
      path.resolve(REPO_ROOT, 'scripts/textbook/render-volume.mjs'),
      'utf8',
    )
    // 인쇄와 같은 함수로 자리를 되짚는다.
    expect(src).toContain('printedSlotOf')
    expect(src).toContain("it.type === 'insert'")
    // 옛 꼴로 되돌아가지 않는다 — 그 한 줄이 5.8%를 버리고 나머지를 잘못 담았다.
    expect(src).not.toMatch(/const n = Number\(it\.answer_key\?\.answer \?\? it\.answer_key\?\.position\)\s*\n\s*const k/)
  })
})
