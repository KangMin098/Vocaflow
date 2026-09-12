// packages/library-pipeline/src/textbook/publish-gate.test.ts
//
// **판정이 아니라 집행을 지킨다.**
//
// 실측 2026-09-12: `render-volume.mjs` 에 `process.exit` 와 `throw` 가 **0건**이었다.
// 자동 검수·쏠림·교정·해설을 전부 돌려 터미널에 찍고 **그대로 HTML 을 썼다.** 판정은 화면
// (현황판·발주)에만 살아 있어서, 안 보고 명령을 돌리면 결함 있는 권이 그냥 나왔다.
//
// 그래서 이 파일의 마지막 검사는 판정 함수가 아니라 **조판기 소스**를 본다 — 차단 판정이
// `writeFileSync` **앞에서** 실행을 끊는지. 순수 함수만 검사하면 "게이트는 있는데 아무도
// 안 부른다" 는 원래 상태가 그대로 통과한다.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { formatGate, gateRecord, judgePublish, type PublishGateInput } from './publish-gate'

const HERE = dirname(fileURLToPath(import.meta.url))
const RENDERER = join(HERE, '..', '..', '..', '..', 'scripts', 'textbook', 'render-volume.mjs')

/** 아무 결함도 없는 권. 각 검사는 여기서 한 축만 흐트러뜨린다. */
const CLEAN: PublishGateInput = {
  band: 5,
  items: 60,
  explained: 60,
  failedChecks: [],
  answerBiased: false,
  cramersV: 0.04,
  proofChecked: 60,
  proofDefective: 0,
  reviewedItems: 60,
}

describe('judgePublish — 차단', () => {
  it('깨끗한 권은 통과하고 걸린 것이 없다', () => {
    const v = judgePublish(CLEAN)
    expect(v.pass).toBe(true)
    expect(v.findings).toHaveLength(0)
    expect(v.unmeasured).toHaveLength(0)
  })

  it('해설이 하나라도 빠지면 막는다 — 분자/분모를 그대로 적는다', () => {
    const v = judgePublish({ ...CLEAN, explained: 59 })
    expect(v.pass).toBe(false)
    expect(v.blocked).toHaveLength(1)
    expect(v.blocked[0]?.label).toBe('해설 누락')
    // 백분율만 적으면 98%가 되어 미달이 숨는다.
    expect(v.blocked[0]?.detail).toContain('59/60')
    expect(v.blocked[0]?.detail).toContain('1문항')
  })

  it('해설 채우는 명령에 그 권의 단이 박혀 있다', () => {
    const v = judgePublish({ ...CLEAN, band: 3, explained: 0 })
    expect(v.blocked[0]?.fix).toContain('--band 3')
  })

  it('자동 검수가 떨어지면 막고, 떨어진 항목 이름을 남긴다', () => {
    const v = judgePublish({ ...CLEAN, failedChecks: ['유형 배합', '단원 수'] })
    expect(v.pass).toBe(false)
    expect(v.blocked[0]?.label).toBe('자동 검수 미통과')
    expect(v.blocked[0]?.detail).toContain('유형 배합')
    expect(v.blocked[0]?.detail).toContain('단원 수')
  })

  it('문항이 0이면 막는다 — 0단원은 책이 아니다', () => {
    const v = judgePublish({ ...CLEAN, items: 0, explained: 0 })
    expect(v.pass).toBe(false)
    expect(v.blocked.map((f) => f.label)).toContain('문항 0')
    // 0문항을 해설 누락으로도 세면 같은 사실이 두 번 걸린다.
    expect(v.blocked.map((f) => f.label)).not.toContain('해설 누락')
  })
})

describe('judgePublish — 경고는 막지 않는다', () => {
  it('정답 쏠림은 경고다 — 문턱이 시중 실측이 아니라 통계 관행이라서', () => {
    const v = judgePublish({ ...CLEAN, answerBiased: true, cramersV: 0.31 })
    expect(v.pass).toBe(true)
    expect(v.warned).toHaveLength(1)
    expect(v.warned[0]?.label).toBe('정답 번호 쏠림')
    expect(v.warned[0]?.detail).toContain('0.310')
    expect(v.warned[0]?.detail).toContain('관행')
  })

  it('표기 결함은 경고다 — 규칙이 시중 지문 3%를 오탐한다', () => {
    const v = judgePublish({ ...CLEAN, proofDefective: 7 })
    expect(v.pass).toBe(true)
    expect(v.warned[0]?.label).toBe('표기 결함')
    expect(v.warned[0]?.detail).toContain('7/60')
  })
})

describe('judgePublish — 못 잰 것은 통과가 아니다', () => {
  it('쏠림을 못 쟀으면 괜찮다고 하지 않고 못 쟀다고 적는다', () => {
    const v = judgePublish({ ...CLEAN, answerBiased: null, cramersV: null })
    expect(v.unmeasured.join(' ')).toContain('정답 쏠림')
    expect(v.warned).toHaveLength(0)
  })

  it('교정 대상이 0이면 깨끗함이 아니라 판정 불가다', () => {
    // 실측 2026-09-07: 초등 낱말 유형은 payload.sentences 가 없어 1·2단이 0/0 이었다.
    const v = judgePublish({ ...CLEAN, proofChecked: 0, proofDefective: 0 })
    expect(v.unmeasured.join(' ')).toContain('교정')
  })
})

describe('formatGate · gateRecord', () => {
  it('차단 항목은 이름과 푸는 명령을 함께 찍는다', () => {
    const lines = formatGate(judgePublish({ ...CLEAN, explained: 10 }))
    expect(lines.some((l) => l.includes('해설 누락'))) .toBe(true)
    // 명령을 안 적으면 관리자가 우회 플래그를 붙이게 된다 — 그 순간 게이트가 죽는다.
    expect(lines.some((l) => l.includes('explain-drain-export'))).toBe(true)
  })

  it('우회로 나온 권은 통과와 다른 모양으로 기록된다', () => {
    const bad = judgePublish({ ...CLEAN, explained: 0 })
    expect(gateRecord(bad, true).forced).toBe(true)
    expect(gateRecord(bad, true).pass).toBe(false)
    // 통과한 권에 우회 플래그가 붙어 있어도 "우회했다" 고 적지 않는다.
    expect(gateRecord(judgePublish(CLEAN), true).forced).toBe(false)
  })
})

describe('조판기가 판정을 집행한다', () => {
  const src = readFileSync(RENDERER, 'utf8')

  it('판정을 부른다', () => {
    expect(src).toContain('judgePublish')
  })

  it('차단이면 조판물을 쓰기 전에 실행을 끊는다', () => {
    // 원래 결함: 판정은 있고 exit 이 없었다(실측 0건).
    expect(src).toContain('process.exit(1)')
    const gate = src.indexOf('judgePublish(')
    const stop = src.indexOf('process.exit(1)')
    const write = src.indexOf('fs.writeFileSync(path.resolve(OUT)')
    expect(gate).toBeGreaterThan(-1)
    expect(stop).toBeGreaterThan(gate)
    // 쓰기보다 앞에서 끊어야 결함 있는 HTML 이 남지 않는다.
    expect(stop).toBeLessThan(write)
  })

  it('우회는 명시적 플래그로만 — 기본값이 우회면 게이트가 아니다', () => {
    expect(src).toContain('--allow-defects')
    // `ALLOW_DEFECTS = true` 처럼 켜 두면 이 검사가 깨진다.
    expect(src).not.toMatch(/ALLOW_DEFECTS\s*=\s*true/)
  })
})

describe('L2 다수·다각 검수 — 근거가 생기면 차단이 된다', () => {
  /** 기본 픽스처는 표가 아직 없는 상태(`null`)를 쓴다 — 지금의 실제 상태다. */
  const NO_TABLE: PublishGateInput = { ...CLEAN, reviewedItems: null }

  it('표가 없으면 차단이 아니라 「못 잼」이다', () => {
    // ⚠️ 0 으로 넘기면 전 권이 차단된다 — 그건 사실이 아니라 아직 안 쟀다는 뜻이다.
    const v = judgePublish(NO_TABLE)
    expect(v.pass).toBe(true)
    expect(v.blocked).toHaveLength(0)
    expect(v.unmeasured.join(' ')).toContain('3인 검수')
    expect(v.unmeasured.join(' ')).toContain('csat_item_reviews')
  })

  it('표가 생기고 검수가 모자라면 막는다', () => {
    const v = judgePublish({ ...CLEAN, reviewedItems: 12 })
    expect(v.pass).toBe(false)
    expect(v.blocked.map((f) => f.label)).toContain('3인 검수 미완')
    expect(v.blocked.find((f) => f.label === '3인 검수 미완')?.detail).toContain('12/60')
    expect(v.blocked.find((f) => f.label === '3인 검수 미완')?.detail).toContain('48문항')
  })

  it('실릴 문항 전부가 3인을 받으면 통과한다', () => {
    const v = judgePublish({ ...CLEAN, reviewedItems: 60 })
    expect(v.pass).toBe(true)
    expect(v.unmeasured.join(' ')).not.toContain('3인 검수')
  })

  it('0문항 권에는 3인 검수를 묻지 않는다 — 지면에 없는 것을 검수할 수 없다', () => {
    const v = judgePublish({ ...CLEAN, items: 0, explained: 0, reviewedItems: 0 })
    expect(v.blocked.map((f) => f.label)).not.toContain('3인 검수 미완')
  })
})

describe('조판기가 페르소나를 「서로 다른 3인」으로 센다', () => {
  const src = readFileSync(RENDERER, 'utf8')

  it('검수 기록을 읽는다', () => {
    expect(src).toContain('csat_item_reviews')
    expect(src).toContain("eq('verdict', 'pass')")
  })

  it('같은 페르소나를 여러 번 세지 않는다 — Set 으로 모은다', () => {
    // 배열 길이로 세면 한 사람이 세 번 본 것이 「3인 검수」가 된다.
    expect(src).toMatch(/new Set\(\)/)
    expect(src).toMatch(/\.size >= 3/)
  })

  it('표가 없으면 0 이 아니라 null 을 넘긴다', () => {
    expect(src).toMatch(/let reviewedItems = null/)
    // error 가 있으면 대입하지 않는다 — `if (!error)` 안에서만 센다.
    expect(src).toContain('if (!error)')
  })
})
