// apps/web/src/lib/csat/__tests__/factory-model.test.ts
//
// 공정 모델의 **판정 규칙**과, 화면이 관리자에게 내미는 **명령이 실제로 존재하는지**를 고정한다.
//
// 왜 명령 존재를 테스트하나: 이 화면의 새로운 점은 "다음에 무엇을 돌릴지" 를 화면이 직접 말한다는
// 것이다. 스크립트 이름이 바뀌었는데 화면이 옛 이름을 계속 내밀면 관리자는 터미널에서 막히고,
// 한 번 막히면 그다음부터 화면을 안 믿는다 — 도움말이 낡는 것과 같은 사고다(CLAUDE.md §3️⃣).
// 그래서 `factory.ts` 본문에 적힌 `scripts/...` 경로를 전부 긁어 파일 존재를 실측한다.

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  FACTORY_STAGES,
  findBottleneck,
  judgeGauge,
  judgeStage,
  lineCompletion,
  STATUS_KO,
  type StageGauge,
  type StageState,
} from '../factory-model'

const g = (p: Partial<StageGauge>): StageGauge => ({
  label: 't',
  num: 1,
  den: 1,
  unit: 'ratio',
  ...p,
})

describe('judgeGauge — 못 잰 것과 0 을 가른다', () => {
  it('num 이 null 이면 unmeasured — 0 이 아니다', () => {
    expect(judgeGauge(g({ num: null }))).toBe('unmeasured')
  })

  it('분자가 0이면 blocked — 아직 한 개도 없다는 뜻이다', () => {
    expect(judgeGauge(g({ num: 0, den: 10 }))).toBe('blocked')
  })

  it('분모가 0이면 blocked — 나눌 수 없는 것을 100% 로 그리지 않는다', () => {
    expect(judgeGauge(g({ num: 0, den: 0 }))).toBe('blocked')
  })

  it('목표 미달은 short', () => {
    expect(judgeGauge(g({ num: 65, den: 100 }))).toBe('short')
  })

  it('목표를 채우면 pass', () => {
    expect(judgeGauge(g({ num: 100, den: 100 }))).toBe('pass')
  })

  it('target 을 낮춰 잡으면 그 값이 기준이다', () => {
    expect(judgeGauge(g({ num: 7, den: 10, target: 0.7 }))).toBe('pass')
    expect(judgeGauge(g({ num: 69, den: 100, target: 0.7 }))).toBe('short')
  })

  it('지수 축은 분모 없이 목표와만 견준다 — 1.199 는 1.200 미달이다', () => {
    expect(judgeGauge(g({ num: 1.199, den: null, unit: 'index', target: 1.2 }))).toBe('short')
    expect(judgeGauge(g({ num: 1.2, den: null, unit: 'index', target: 1.2 }))).toBe('pass')
  })

  it('분모 없는 개수 눈금은 0 초과면 통과다', () => {
    expect(judgeGauge(g({ num: 616, den: null, unit: 'count' }))).toBe('pass')
    expect(judgeGauge(g({ num: 0, den: null, unit: 'count' }))).toBe('blocked')
  })
})

describe('judgeStage — 평균이 아니라 가장 나쁜 눈금이 그 공정의 상태다', () => {
  it('한 칸이 막히면 나머지가 다 통과여도 막힘이다', () => {
    expect(judgeStage([g({}), g({}), g({ num: 0, den: 5 })])).toBe('blocked')
  })

  it('못 잰 것이 섞이면 통과라고 하지 않는다', () => {
    expect(judgeStage([g({}), g({ num: null })])).toBe('unmeasured')
  })

  it('막힘이 못 잼보다 무겁다', () => {
    expect(judgeStage([g({ num: null }), g({ num: 0, den: 3 })])).toBe('blocked')
  })

  it('눈금이 없으면 통과가 아니라 못 잼이다', () => {
    expect(judgeStage([])).toBe('unmeasured')
  })
})

const stage = (ord: number, status: StageState['status']): StageState => ({
  def: { ...FACTORY_STAGES[0]!, ord, id: FACTORY_STAGES[ord - 1]!.id },
  status,
  gauges: [],
  blocker: null,
  nextCommands: [],
})

describe('findBottleneck — 가장 나쁜 공정이 아니라 가장 앞선 막힌 공정', () => {
  it('뒤가 더 나빠도 앞의 미달을 먼저 가리킨다', () => {
    const b = findBottleneck([stage(1, 'pass'), stage(2, 'short'), stage(3, 'blocked')])
    expect(b?.def.ord).toBe(2)
  })

  it('못 잰 공정도 병목이다 — 안 잰 것을 통과로 세면 그게 거짓 안심이다', () => {
    const b = findBottleneck([stage(1, 'unmeasured'), stage(2, 'blocked')])
    expect(b?.def.ord).toBe(1)
  })

  it('전부 통과하면 병목이 없다', () => {
    expect(findBottleneck([stage(1, 'pass'), stage(2, 'pass')])).toBeNull()
  })

  it('배열 순서가 뒤죽박죽이어도 ord 로 고른다', () => {
    const b = findBottleneck([stage(3, 'blocked'), stage(1, 'pass'), stage(2, 'short')])
    expect(b?.def.ord).toBe(2)
  })
})

describe('lineCompletion', () => {
  it('통과한 공정 수와 전체를 그대로 낸다 — 백분율로 접지 않는다', () => {
    expect(lineCompletion([stage(1, 'pass'), stage(2, 'short'), stage(3, 'pass')])).toEqual({
      passed: 2,
      total: 3,
    })
  })
})

describe('FACTORY_STAGES — 공정 정본', () => {
  it('ord 가 1부터 빈틈 없이 이어진다', () => {
    expect(FACTORY_STAGES.map((s) => s.ord)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('id 가 중복되지 않는다 — 레지스트리 키로 쓰인다', () => {
    expect(new Set(FACTORY_STAGES.map((s) => s.id)).size).toBe(FACTORY_STAGES.length)
  })

  it('두 레인이 모두 채워져 있다 — 연구소만 있고 라인이 없으면 공장이 아니다', () => {
    expect(FACTORY_STAGES.filter((s) => s.lane === 'lab').length).toBeGreaterThan(0)
    expect(FACTORY_STAGES.filter((s) => s.lane === 'line').length).toBeGreaterThan(0)
  })

  it('연구소가 라인보다 앞선다 — 규격이 정해지기 전에 찍으면 다 낡는다', () => {
    const lastLab = Math.max(...FACTORY_STAGES.filter((s) => s.lane === 'lab').map((s) => s.ord))
    const firstLine = Math.min(...FACTORY_STAGES.filter((s) => s.lane === 'line').map((s) => s.ord))
    expect(lastLab).toBeLessThan(firstLine)
  })

  it('모든 상태에 한국어 라벨과 색이 있다', () => {
    for (const k of ['pass', 'short', 'blocked', 'unmeasured'] as const) {
      expect(STATUS_KO[k].label.length).toBeGreaterThan(0)
      expect(STATUS_KO[k].color).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })

  it('href 가 있는 공정은 /admin/csat 아래에 있다 — 레일 밖으로 나가지 않는다', () => {
    for (const s of FACTORY_STAGES) {
      if (s.href) expect(s.href.startsWith('/admin/csat')).toBe(true)
    }
  })
})

describe('화면이 내미는 명령이 저장소에 실제로 있는가', () => {
  const REPO_ROOT = resolve(__dirname, '../../../../../..')
  const src = readFileSync(resolve(__dirname, '../factory.ts'), 'utf8')
  // `cmd:` 줄에 적힌 명령에서 `scripts/...` 로 시작하는 경로만 뽑는다.
  const paths = [...src.matchAll(/(scripts\/[\w./-]+\.(?:mjs|mts|ts|js))/g)].map((m) => m[1]!)

  it('명령을 실제로 담고 있다 — 정규식이 헛돌아 0건이면 이 테스트는 아무것도 안 지킨다', () => {
    expect(paths.length).toBeGreaterThanOrEqual(10)
  })

  it.each([...new Set(paths)])('%s 가 존재한다', (p) => {
    expect(existsSync(resolve(REPO_ROOT, p))).toBe(true)
  })
})

describe('눈금이 게이트가 말한 것을 본다', () => {
  // ⚠️ 실측 2026-09-05: ⑧ 조판의 게이트는 「**최신 규격으로** 조판된 권이 있는가」인데
  //   눈금은 규격을 안 보고 계단 수만 셌다. 7단이 전부 찍혀 「7/7 통과」로 떴지만 그중
  //   **6단이 옛 규격**이었다 — "조판 끝났다" 는 거짓 초록이었다.
  //   게이트 문구에 있는 낱말이 눈금 라벨 어디에도 없으면 그 공정은 자기 약속을 안 재고 있다.
  const factorySrc = readFileSync(resolve(__dirname, '../factory.ts'), 'utf8')

  /** 눈금 라벨은 `label: '…'` 로만 쓴다 — 실측 코드에서 전부 긁는다. */
  const gaugeLabels = [...factorySrc.matchAll(/label:\s*'([^']+)'/g)].map((m) => m[1]!)

  const MUST_MEASURE: { id: string; word: string }[] = [
    // 게이트가 「최신 규격으로 조판된 권」이라고 말하므로, 눈금도 규격을 봐야 한다.
    { id: 'press', word: '최신 규격' },
    { id: 'review', word: 'L4' },
  ]

  it('눈금 라벨을 실제로 긁었다 — 정규식이 헛돌면 이 검사는 아무것도 안 지킨다', () => {
    expect(gaugeLabels.length).toBeGreaterThanOrEqual(10)
  })

  it.each(MUST_MEASURE)('$id 의 눈금 중에 「$word」를 재는 것이 있다', ({ id, word }) => {
    const def = FACTORY_STAGES.find((s) => s.id === id)!
    expect(def, `${id} 공정이 없다`).toBeTruthy()
    expect(
      gaugeLabels.some((l) => l.includes(word)),
      `${id} 게이트는 「${def.gate}」인데 「${word}」를 재는 눈금이 없다 — 약속한 것을 안 재고 있다`,
    ).toBe(true)
  })
})
