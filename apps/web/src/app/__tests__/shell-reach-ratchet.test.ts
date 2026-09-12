// apps/web/src/app/__tests__/shell-reach-ratchet.test.ts
//
// **셸이 파는 것과 실제 목적지를 라쳇으로 고정한다.**
//
// 링크 그래프(`link-graph-ratchet.test.ts`)는 "코드 어딘가에 링크가 있는가" 만 답한다.
// 그런데 학습자는 코드를 안 읽는다 — **사이드바·탭·레일에 보이는가**가 실제 도달 가능성이다.
// 그 축을 재는 것이 `scripts/audit/shell-reach.mjs` 이고, 지금 값은 화면 구멍 **0** 이다.
//
// ⚠️ 이 초록은 **쉽게 무너진다.** 화면을 새로 만들고 메뉴에 안 붙이면 그 화면은 코드상
//    링크가 있어도(다른 화면에서 한 번 갈 수 있어도) 학습자가 **되찾아갈 길이 없다.**
//    화면은 멀쩡히 뜨므로 어떤 e2e 도 실패하지 않는다 — 그래서 여기서 잠근다.
//
// ⚠️ 세션 라우트(`kind: 'session'`)는 셸이 팔지 않는 것이 **정상**이다. 게임 19종은
//    `/arcade` 에서, 플래시카드 세션은 `/flashcard` 에서 시작한다. 그것까지 구멍으로 세면
//    목록이 세션으로 덮여 진짜 구멍이 안 보인다(감사 스크립트가 이미 갈라 놓았다).
//
// ⚠️ 감사 스크립트는 **저장소 루트**에서 돈다. vitest 는 `apps/web` 에서 도므로 cwd 를 올린다.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { beforeAll, describe, expect, it } from 'vitest'

const ROOT = resolve(process.cwd(), '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'audit', 'shell-reach.mjs')

/**
 * 셸이 파는 목적지의 **하한**. 지금 실측 38.
 *
 * 라쳇이므로 이 아래로 내려가면 실패한다 — 메뉴에서 무언가를 떼면 여기서 걸린다.
 * (올리는 것은 자유다. 올린 뒤 이 숫자도 같이 올려 두면 다음 후퇴를 막는다.)
 */
const MIN_SOLD_BY_SHELL = 38

/** 학습자 목적지의 **하한**. 지금 실측 61 — 목록 추출이 깨져 0을 세고 통과하는 길을 막는다. */
const MIN_DESTINATIONS = 55

interface ShellReachReport {
  totals: {
    destinations: number
    soldByShell: number
    screenGaps: number
    sessionsFromHub: number
  }
  screenGaps: string[]
  sessionsNotSoldByShell: string[]
}

describe('셸 도달성 라쳇', () => {
  let report: ShellReachReport

  beforeAll(() => {
    execFileSync(process.execPath, [SCRIPT], { cwd: ROOT, stdio: 'pipe' })
    const out = join(ROOT, 'scripts', 'audit', 'shell-reach.result.json')
    report = JSON.parse(readFileSync(out, 'utf8')) as ShellReachReport
  }, 120_000)

  it('감사 스크립트가 그 자리에 있다', () => {
    expect(existsSync(SCRIPT)).toBe(true)
  })

  it('목적지를 실제로 세었다 — 0을 세고 통과하지 않는다', () => {
    expect(report.totals.destinations).toBeGreaterThanOrEqual(MIN_DESTINATIONS)
  })

  it('셸 메뉴로 못 닿는 화면이 없다', () => {
    expect(report.screenGaps).toEqual([])
  })

  it('셸이 파는 목적지가 줄지 않았다', () => {
    expect(report.totals.soldByShell).toBeGreaterThanOrEqual(MIN_SOLD_BY_SHELL)
  })

  it('세션은 구멍이 아니라 세션으로 분류된다 — 갈라 놓지 않으면 진짜 구멍이 묻힌다', () => {
    // 세션이 하나도 없다면 분류가 깨진 것이다(게임 19종 + 학습 세션들이 있다).
    expect(report.totals.sessionsFromHub).toBeGreaterThan(10)
    for (const s of report.sessionsNotSoldByShell) {
      expect(report.screenGaps).not.toContain(s)
    }
  })

  it('숫자끼리 어긋나지 않는다', () => {
    const { destinations, soldByShell, screenGaps, sessionsFromHub } = report.totals
    expect(soldByShell).toBeLessThanOrEqual(destinations)
    expect(soldByShell + screenGaps + sessionsFromHub).toBe(destinations)
    expect(report.screenGaps.length).toBe(screenGaps)
    expect(report.sessionsNotSoldByShell.length).toBe(sessionsFromHub)
  })
})
