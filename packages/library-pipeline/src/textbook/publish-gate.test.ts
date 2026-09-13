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

import {
  countTriPersonaPassed,
  formatGate,
  gateRecord,
  judgePublish,
  REVIEW_PERSONA_QUORUM,
  type PublishGateInput,
} from './publish-gate'

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
    // ⚠️ **순서가 명령에 담겨야 한다.** 배치 드레인만 가리키던 동안 관리자는 막다른 길로 갔다 —
    //   그 스크립트는 순서·삽입 전용이라 어휘·어법 문항에 「배치 몫 0」을 찍는다(해설이 없는데
    //   쓸 것이 없다고 말한다). 규칙 작성기가 먼저다.
    const fix = lines.join(String.fromCharCode(10))
    expect(fix).toContain('explain-fill')
    expect(fix).toContain('explain-drain-export')
    // 규칙이 배치보다 앞에 적혀야 한다 — 순서가 뒤바뀌면 같은 막다른 길이 된다.
    expect(fix.indexOf('explain-fill')).toBeLessThan(fix.indexOf('explain-drain-export'))
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
    // ⚠️ **게이트 뒤의** exit 을 찾는다 — 조판기에는 exit 이 둘이다(앞쪽은 카탈로그에 없는
    //   권을 거절하는 가드, 뒤쪽이 발행 게이트). 첫 번째를 집으면 이 검사가 순서를 거꾸로 읽는다.
    const stop = src.indexOf('process.exit(1)', gate)
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
  })

  /**
   * 2026-09-13: 원래는 `.eq('verdict', 'pass')` 로 걸러 받았고, 이 회귀가 그것을 잠갔다.
   * 그러면 **「셋이 봤는데 통과가 아닌 문항」과 「아직 셋이 안 본 문항」이 똑같이 0** 으로
   * 보인다 — 할 일이 정반대인데(전자는 고치고 후자는 검수를 돌린다) 화면에 같게 나온다.
   * 이제 판정을 함께 받아 `countTriPersonaPassed` 가 `passed`/`settled` 로 가른다.
   */
  it('판정으로 거르지 않고 받아 온다 — 「덜 봤나 막혔나」를 가르려면 둘 다 필요하다', () => {
    expect(src).toContain("select('item_id, persona, verdict')")
    expect(src, 'pass 만 받으면 막힌 문항이 안 본 문항처럼 보인다').not.toContain(
      "eq('verdict', 'pass')",
    )
    // 잰 것을 기록에 남겨야 화면이 다시 세지 않는다.
    expect(src).toContain('personaReview')
  })

  /**
   * 2026-09-13: 이 단언은 원래 **조판기 안의 사본**(`new Set()` + `.size >= 3`)을 잠갔다.
   * 그 사본이 있는 한 웹앱은 같은 규칙을 부를 방법이 없어서, 화면은 기출 표를 세고 있었다.
   * 규칙이 순수 함수로 올라갔으므로 **잠글 것도 그쪽으로 옮긴다** — 사본을 잠그면
   * 사본이 남는다.
   */
  it('세는 법을 자기 안에 두지 않고 정본 함수를 부른다', () => {
    expect(src).toContain('countTriPersonaPassed')
    expect(src, '조판기에 옛 사본이 되살아났다').not.toMatch(/\.size >= 3/)
  })

  it('표가 없으면 0 이 아니라 null 을 넘긴다', () => {
    expect(src).toMatch(/let reviewedItems = null/)
    // error 가 있으면 대입하지 않는다 — `if (!error)` 안에서만 센다.
    expect(src).toContain('if (!error)')
  })
})

/**
 * **「서로 다른 3인이 통과시켰다」를 세는 자는 한 벌뿐이다.**
 *
 * 이 규칙은 세 곳에 각각 박혀 있었고, **화면은 그중 어느 것도 안 썼다** — ⑦ 검수 화면의
 * 「L2 3인 페르소나」 눈금은 `csat_coverage()`(기출 분석)를 세고 있어서, 교재 문항 쪽
 * 구멍을 초록으로 덮고 있었다(실측 2026-09-13).
 */
describe('countTriPersonaPassed', () => {
  const row = (item_id: string, persona: string, verdict = 'pass') => ({ item_id, persona, verdict })

  it('정족수는 셋이다', () => {
    expect(REVIEW_PERSONA_QUORUM).toBe(3)
  })

  it('서로 다른 셋이 통과시키면 센다', () => {
    const r = countTriPersonaPassed([
      row('a', 'setter'),
      row('a', 'analyst'),
      row('a', 'tutor'),
    ])
    expect(r.passed).toBe(1)
    expect(r.settled).toBe(1)
  })

  it('**같은 눈이 세 번 본 것은 다각이 아니다** — 행이 아니라 페르소나를 센다', () => {
    // 행으로 세면 3 이 되어 통과한다. DB 도 unique(item_id, persona) 로 막지만,
    // 자가 행을 세고 있으면 그 제약이 사라지는 날 조용히 통과가 된다.
    const r = countTriPersonaPassed([
      row('a', 'setter'),
      row('a', 'setter'),
      row('a', 'setter'),
    ])
    expect(r.passed).toBe(0)
  })

  it('셋이 보기는 했지만 통과가 아니면 `passed` 에 안 든다 — 「덜 봤나 막혔나」를 가른다', () => {
    const r = countTriPersonaPassed([
      row('a', 'setter', 'pass'),
      row('a', 'analyst', 'revise'),
      row('a', 'tutor', 'fail'),
    ])
    expect(r.passed).toBe(0)
    expect(r.settled).toBe(1)
  })

  it('둘만 본 문항은 어느 쪽에도 안 든다', () => {
    const r = countTriPersonaPassed([row('a', 'setter'), row('a', 'analyst')])
    expect(r).toEqual({ passed: 0, settled: 0 })
  })

  it('빈 입력은 0 이다 — 못 쟀다는 뜻의 null 은 부르는 쪽이 만든다', () => {
    expect(countTriPersonaPassed([])).toEqual({ passed: 0, settled: 0 })
  })

  it('망가진 행은 조용히 건너뛴다 — 세다가 죽으면 권 전체가 못 나간다', () => {
    const bad = [{ item_id: '', persona: 'setter' }, { item_id: 'a', persona: '' }] as never
    expect(() => countTriPersonaPassed(bad)).not.toThrow()
    expect(countTriPersonaPassed(bad).passed).toBe(0)
  })

})
