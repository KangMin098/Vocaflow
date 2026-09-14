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
import { SERIES_SPINE } from './series'
import { MARKET_TYPE_MEDIAN, marketTypeMedianOfBand, marketTypeSampleOfBand } from './type-spread'

const HERE = dirname(fileURLToPath(import.meta.url))
const RENDERER = join(HERE, '..', '..', '..', '..', 'scripts', 'textbook', 'render-volume.mjs')

/** 아무 결함도 없는 권. 각 검사는 여기서 한 축만 흐트러뜨린다. */
const CLEAN: PublishGateInput = {
  band: 5,
  items: 60,
  units: 10,
  seriesId: 'reading',
  explained: 60,
  failedChecks: [],
  answerBiased: false,
  cramersV: 0.04,
  proofChecked: 60,
  proofDefective: 0,
  reviewedItems: 60,
  unreviewableItems: 0,
  // 고1 권이 시중 중앙값(9종)을 넘긴 상태. 유형 폭 축은 여기서만 흐트러뜨린다.
  printedTypes: ['blank', 'order', 'insert', 'title', 'topic', 'mood', 'summary', 'claim', 'purpose'],
  marketTypeMedian: 9,
  marketTypeSample: null,
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

  /**
   * 게이트가 안내하는 드레인 명령은 **이 권을 찍을 때 쓴 단원 수**를 써야 한다.
   * 2026-09-13 까지 세 명령이 단원 수 20 을 박아 안내했는데 조판기 기본값은 10(시중 중앙값)이라,
   * 시킨 대로 돌리면 **120문항짜리 다른 책**을 겨냥했다 — 다 채워도 60문항의 구멍은 안 메워진다.
   */
  it('실제로 찍은 단원 수를 게이트에 넘긴다 — 박아 두면 다른 책을 겨냥한다', () => {
    expect(src).toContain('units: UNITS')
  })

  /**
   * ⚠️ **이 둘을 안 넘기면 게이트가 영영 「못 잼」을 찍는다.** 새 입력은 기본값이 없으므로
   *   `.mjs` 에서 빠져도 타입체크가 못 잡고, 런타임에서는 `undefined` 가 조용히 「못 쟀다」로
   *   흘러간다. 그러면 「시중 모든 유형보다 우위」를 **아무도 확인하지 않는 상태**로 돌아간다.
   */
  it('지면 유형과 시중 기준선을 게이트에 넘긴다', () => {
    expect(src).toContain('printedTypes:')
    expect(src).toContain('marketTypeMedianOfBand(BAND)')
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
    expect(src).toContain("select('item_id, persona, verdict, reviewed_digest')")
    expect(src, 'pass 만 받으면 막힌 문항이 안 본 문항처럼 보인다').not.toContain(
      "eq('verdict', 'pass')",
    )
    // ⚠️ **판(版)을 함께 받아야 한다** (2026-09-14). 이것이 빠지면 낡은 판정을 지금 판정으로
    //   세고, 해설을 고쳐 38,522문항을 다시 써도 통과율이 안 움직인다 — 실제로 그랬다.
    //   세는 것도 `countTriPersonaPassed` 가 아니라 판을 보는 `tallyFreshReviews` 여야 한다.
    expect(src).toContain('tallyFreshReviews')
    expect(src).toContain('reviewDigest(')
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

/**
 * **시리즈가 셋이 된 순간 안내 명령이 다른 책을 겨냥하게 됐다.**
 *
 * 2026-09-13 에 어휘·구문 시리즈가 **처음으로 조합됐다**(`Vocaflow Vocab Advanced` ·
 * `Vocaflow Syntax Advanced` — 각각 60문항 10단원). 그러자 게이트의 안내 명령이
 * `--series` 를 한 번도 안 넘긴다는 것이 실제 사고가 됐다 — 드레인의 기본값은 `reading`
 * 이라, 어휘 권이 막힌 화면을 보고 그 명령을 그대로 돌리면 **독해 문항을 뽑는다.**
 *
 * `--volume` 이 20으로 박혀 있던 것과 같은 계열이다. 그때는 단원 수가, 이번에는 시리즈가.
 */
describe('안내 명령이 그 권을 겨냥한다', () => {
  const src = readFileSync(RENDERER, 'utf8')

  it('막힌 항목의 명령이 모두 그 시리즈를 담는다', () => {
    const v = judgePublish({
      ...CLEAN,
      seriesId: 'vocab',
      items: 0,
      explained: 0,
      failedChecks: ['유형 배합'],
      reviewedItems: 0,
    })
    const fixes = v.blocked.map((f) => f.fix).filter(Boolean) as string[]
    expect(fixes.length).toBeGreaterThan(0)
    for (const fix of fixes) {
      expect(fix, `시리즈를 안 담은 명령: ${fix}`).toContain('--series vocab')
    }
  })

  it('해설 명령도 시리즈를 담는다 — 배치 드레인이 다른 책을 뽑으면 안 된다', () => {
    const v = judgePublish({ ...CLEAN, seriesId: 'syntax', explained: 0 })
    expect(v.blocked[0]?.fix).toContain('--series syntax')
  })

  it('조판기가 실제 시리즈를 게이트에 넘긴다 — 박아 두면 다른 책을 겨냥한다', () => {
    expect(src).toContain('seriesId: SERIES')
  })
})

/**
 * **「시중 모든 유형보다 우위」를 조판 시점에 확인하는 자리** (2026-09-13).
 *
 * 그 약속을 재는 자(`type-spread.mjs`)는 있었지만 **리포트일 뿐**이라 사람이 돌려야 보였다.
 * 안 돌리면 지면 4종짜리 고등 권(시중 중앙 9종)이 조용히 나간다 — 실제로 그런 권이 나갔다.
 */
describe('judgePublish — 유형 폭', () => {
  it('시중 중앙값 미만이면 경고한다 — 분자/분모를 그대로 적는다', () => {
    const v = judgePublish({ ...CLEAN, printedTypes: ['blank', 'order', 'insert', 'title'] })
    const f = v.warned.find((x) => x.label === '유형 폭 미달')
    expect(f).toBeDefined()
    expect(f?.detail).toContain('4종')
    expect(f?.detail).toContain('9종')
    // ⚠️ 얇은 책은 결함이 아니다 — 막으면 게이트가 곧 꺼진다.
    expect(v.pass).toBe(true)
  })

  it('중앙값과 같으면 경고하지 않는다 — 우위의 경계는 「이상」이다', () => {
    expect(judgePublish(CLEAN).warned.some((x) => x.label === '유형 폭 미달')).toBe(false)
  })

  it('빌려 온 기준선이면 그 사실을 같은 줄에 적는다 — 수만 적으면 잘못된 일로 보낸다', () => {
    const v = judgePublish({
      ...CLEAN,
      printedTypes: ['rhyme', 'word_meaning', 'spell_blank'],
      marketTypeMedian: 4,
      marketTypeSample: '초등 표본(초6)',
    })
    const f = v.warned.find((x) => x.label === '유형 폭 미달')
    expect(f?.detail).toContain('빌렸다')
    expect(f?.detail).toContain('초6')
  })

  it('빌리지 않은 기준선에는 그 말을 붙이지 않는다 — 없는 단서를 만들지 않는다', () => {
    const v = judgePublish({ ...CLEAN, printedTypes: ['blank'], marketTypeSample: null })
    expect(v.warned.find((x) => x.label === '유형 폭 미달')?.detail).not.toContain('빌렸다')
  })

  it('초등 두 밴드의 기준선은 빌려 온 것이다 — 코퍼스에 저학년 표본이 없다', () => {
    expect(marketTypeSampleOfBand(1)).toContain('초6')
    expect(marketTypeSampleOfBand(2)).toContain('초6')
    // 고등은 제 표본이 있다 — 없는 단서를 붙이면 그것도 거짓이다.
    expect(marketTypeSampleOfBand(5)).toBeNull()
    expect(marketTypeSampleOfBand(7)).toBeNull()
  })

  it('중복은 종 수로 센다 — 같은 유형 아홉 개는 한 종이다', () => {
    const v = judgePublish({ ...CLEAN, printedTypes: Array(9).fill('blank') })
    expect(v.warned.find((x) => x.label === '유형 폭 미달')?.detail).toContain('1종')
  })

  // ⚠️ 이 저장소가 이미 겪은 거짓 초록 — 못 잰 것을 통과로 세지 않는다.
  it('시중 기준선이 없으면 「못 잼」 — 0 으로 뭉개면 무엇을 실어도 우위가 된다', () => {
    const v = judgePublish({ ...CLEAN, marketTypeMedian: null, printedTypes: ['blank'] })
    expect(v.warned.some((x) => x.label === '유형 폭 미달')).toBe(false)
    expect(v.unmeasured.join(' ')).toContain('유형 폭')
  })

  // ⚠️ 0 을 통과로 세면 **무엇을 실어도 우위**가 된다. 시중 교재가 0종을 싣는다는 뜻일 수
  //   없으므로 그 값은 기준선이 아니라 못 읽은 것이다. `measureVolumeSpread` 와 같은 판단이다.
  it('기준선 0 도 「못 잼」이다 — 자를 둘로 가르지 않는다', () => {
    const v = judgePublish({ ...CLEAN, marketTypeMedian: 0, printedTypes: [] })
    expect(v.warned.some((x) => x.label === '유형 폭 미달')).toBe(false)
    expect(v.unmeasured.join(' ')).toContain('유형 폭')
  })
})

describe('marketTypeMedianOfBand — 눈금을 새로 만들지 않는다', () => {
  it('규격 실측을 그대로 낸다 — 초등 4 · 중등 4 · 고등 9', () => {
    expect(MARKET_TYPE_MEDIAN).toEqual({ 초등: 4, 중등: 4, 고등: 9 })
  })

  it('사다리 전 밴드가 기준선을 갖는다 — 하나라도 null 이면 그 권은 영영 「못 잼」이다', () => {
    for (const rung of SERIES_SPINE) {
      const lead = rung.vLevels[0]!
      expect(marketTypeMedianOfBand(lead), `V${lead}`).not.toBeNull()
    }
  })

  it('사다리 밖 밴드는 null — 짐작으로 기준선을 주지 않는다', () => {
    expect(marketTypeMedianOfBand(99)).toBeNull()
  })
})

/**
 * **면제와 「경로가 없다」는 다른 말이다** (실측 2026-09-13).
 *
 * 초등 3종은 사전에서 즉석 생성되어 `csat_dcp_items` 에 행이 없다 — 검수 기록을 붙일
 * 대상 자체가 없다. 그동안 게이트는 그 권을 「**표가 없다**(csat_item_reviews)」로 적었다.
 * 표는 있다. 담을 문항이 없는 것이다 — 마이그레이션을 기다릴 일이 아니라 검수 경로를
 * 새로 만들 일이다. 실측 V1 10단원 전부 · V2 8단원 · V3 5단원이 그 상태였다.
 */
describe('검수할 수 없는 문항 — 통과가 아니라 「못 잼」', () => {
  it('담을 수 없는 문항을 사유와 함께 적는다 — 표가 없다고 말하지 않는다', () => {
    const v = judgePublish({ ...CLEAN, items: 60, unreviewableItems: 60, reviewedItems: 0 })
    const said = v.unmeasured.join(' ')
    expect(said).toContain('60문항은 검수 표에 담을 수 없다')
    expect(said).not.toContain('csat_item_reviews')
  })

  it('담을 수 없는 문항은 분모에서 뺀다 — 두면 그 권이 영영 막힌다', () => {
    // V1 은 60문항이 전부 사전 유형이다. 분모에 두면 0/60 으로 영구 차단된다.
    const v = judgePublish({ ...CLEAN, items: 60, unreviewableItems: 60, reviewedItems: 0 })
    expect(v.blocked.map((f) => f.label)).not.toContain('3인 검수 미완')
  })

  it('섞인 권은 검수할 수 있는 몫만 분모가 된다', () => {
    // V3 처럼 사전 유형이 일부만 섞인 권 — 36문항 중 30이 검수 대상이다.
    const v = judgePublish({ ...CLEAN, items: 36, unreviewableItems: 6, reviewedItems: 10 })
    const f = v.blocked.find((x) => x.label === '3인 검수 미완')
    expect(f?.detail).toContain('10/30')
    expect(f?.detail).toContain('20문항')
  })

  it('검수 대상 전부가 통과하면 막지 않는다 — 다만 담을 수 없는 몫은 계속 적는다', () => {
    const v = judgePublish({ ...CLEAN, items: 36, unreviewableItems: 6, reviewedItems: 30 })
    expect(v.pass).toBe(true)
    expect(v.unmeasured.join(' ')).toContain('6문항은 검수 표에 담을 수 없다')
  })

  it('검수할 것이 없는 권에는 「표가 없다」를 적지 않는다 — 진짜 사유가 덮인다', () => {
    const v = judgePublish({ ...CLEAN, items: 60, unreviewableItems: 60, reviewedItems: null })
    const said = v.unmeasured.filter((u) => u.includes('3인 검수'))
    expect(said).toHaveLength(1)
    expect(said[0]).toContain('담을 수 없다')
  })
  it('담을 수 없는 문항이 0 이면 그 줄을 적지 않는다 — 없는 구멍을 만들지 않는다', () => {
    expect(judgePublish(CLEAN).unmeasured.join(' ')).not.toContain('담을 수 없다')
  })
})
