// packages/library-pipeline/src/textbook/type-fit.test.ts
//
// 유형↔지문 적합 회귀.
//
// ⚠️ **지키려는 것은 「떨어뜨린다」가 아니라 「무엇을 떨어뜨리는가」다.** 규칙이 넓어지면
//   편지까지 버려 18번을 영영 못 만들게 되고, 좁아지면 소설에 목적을 묻는 지금으로 되돌아간다.
//   그래서 양쪽을 다 잠근다 — **통과해야 하는 편지**와 **떨어져야 하는 서사**를 함께 둔다.
import { describe, expect, it } from 'vitest'

import { bearsClaim, bearsPurpose, bearsType, hasTypeFitRule, TYPE_FIT_REASON_KO } from './type-fit'

/** 수능 18번이 실제로 쓰는 모양 — 인사말 + 배경 + 요청. */
const LETTER = `Dear Mr. Harding,

I am the parent of a third-year student at Wilton High. Over the past two months the school
bus has been arriving nearly fifteen minutes late, and many of us have had to drive our
children to the gate ourselves. I am writing to ask that the morning schedule be reviewed
before the winter term begins. Please let us know whether a meeting would be possible.`

/** 인사말이 없는 공지문 — 2인칭과 요청으로 선다. */
const NOTICE = `The community library will close its east wing for repairs from March 4.
During that week you may return borrowed books at the front desk instead. We would like to
remind you that holds placed before March 1 will still be available for pickup.`

describe('bearsPurpose — 목적(18번)을 떠받치는 글인가', () => {
  it('편지를 받는다 — 인사말과 요청이 다 있다', () => {
    expect(bearsPurpose(LETTER)).toEqual({ ok: true, judged: true, reason: null })
  })

  it('인사말이 없어도 부르고 시키면 받는다 — 공지문', () => {
    expect(bearsPurpose(NOTICE).ok).toBe(true)
  })

  // ── 실측으로 떨어진 것들 (2026-09-15 · 저장된 purpose 86건 중 통과 0) ──
  // 아래 셋은 재고에서 그대로 가져왔다. 앞의 둘은 **첫 판 규칙(2인칭만)이 통과시킨 것**이다 —
  // 부르기는 하지만 아무것도 시키지 않는다. 규칙이 그 자리로 되돌아가면 여기서 깨진다.
  it.each([
    [
      '수필의 일반 호칭',
      'If you have ever been a cat you will understand something of what Maurice endured during the dreadful days that followed. If you have not, I can never make you know it.',
      'no_request_act',
    ],
    [
      '기사의 일반 호칭',
      'If you’ve ever struggled to reduce your carb intake, ancient DNA might be to blame, new research suggests. It has long been known that humans carry multiple copies of the gene.',
      'no_request_act',
    ],
    [
      '3인칭 서술 소설',
      'After awhile the mowers came, and the grass fell in swathes behind them. Bevis watched from the gate until the sun went down behind the elms.',
      'no_addressee',
    ],
    [
      '논문 초록',
      'The coexistence of diverse microbial communities despite the common presence of antimicrobial weapons presents a fundamental puzzle in ecology.',
      'no_addressee',
    ],
  ])('%s 은 목적 유형을 못 떠받친다 — %#', (_label, text, reason) => {
    const fit = bearsPurpose(text)
    expect(fit.ok).toBe(false)
    expect(fit.reason).toBe(reason)
    // 사유는 사람이 읽을 말이 있어야 드레인이 세어 찍을 수 있다.
    expect(TYPE_FIT_REASON_KO[fit.reason!]).toBeTruthy()
  })

  // ⚠️ 소설 대사의 `“My dear Watson,”` 을 인사말로 세면 구텐베르크 511편이 통째로 들어온다
  //   (실측: `Dear ` 를 담은 518편 중 편지 꼴은 7편뿐).
  it('문장 한가운데의 `my dear` 는 인사말이 아니다', () => {
    const dialogue = 'He looked up and said, "My dear Watson, you have been in Afghanistan, I perceive."'
    expect(bearsPurpose(dialogue).ok).toBe(false)
  })
})

describe('bearsType — 규칙이 없는 유형', () => {
  it('규칙이 없으면 통과가 아니라 **미판정**이다', () => {
    const fit = bearsType('blank', 'Any passage at all.')
    expect(fit.judged).toBe(false)
    expect(hasTypeFitRule('blank')).toBe(false)
  })

  it('규칙이 있는 유형은 판정한다', () => {
    expect(hasTypeFitRule('purpose')).toBe(true)
    expect(bearsType('purpose', LETTER)).toEqual({ ok: true, judged: true, reason: null })
    expect(bearsType('purpose', 'The tide rose twice that night.').judged).toBe(true)
  })
})

/**
 * **`please` 는 요청 표지이기도 하고 동사이기도 하다.**
 *
 * 첫 판(`\bplease\b`)으로 V5 후보 8편을 뽑아 읽으니 **7편이 이 한 낱말의 오탐**이었다.
 * 아래 셋은 그 실물이다 — 규칙이 낱말 자리로 되돌아가면 여기서 깨진다.
 */
describe('요청의 `please` 와 동사 `please` 를 가른다', () => {
  const addressed = (s: string) => `You will see this, and you should know it. ${s}`

  it.each([
    ['Plato, Laws', 'Ten commissioners are to give laws, and we may give any which we please—Cretan or foreign.'],
    ['The Teacher', 'Resolve as deliberately as you please, but be sure to keep your resolution.'],
    ['Composition-Rhetoric', 'It is written in so lifeless a manner that much of its power to please is lost.'],
  ])('%s 의 `please` 는 요청이 아니다', (_label, sentence) => {
    expect(bearsPurpose(addressed(sentence)).reason).toBe('no_request_act')
  })

  it('문장 머리의 명령형 `Please` 는 요청이다', () => {
    expect(bearsPurpose(addressed('Please observe the postscript before you reply.')).ok).toBe(true)
  })
})

/**
 * **대사는 필자의 말이 아니다.**
 *
 * V5 후보 5편 중 3편이 이 오탐이었다 — 소설 대사와 방송 대본의 `Please` 가 요청으로 읽혔다.
 */
describe('따옴표 안의 요청은 인물의 말이다', () => {
  it('소설 대사의 `Please proceed` 는 필자의 요청이 아니다', () => {
    const fiction =
      'The fellow hesitated at the door, twisting his hat as if you could see his mind working, and you would have pitied him. "You have informed me of that point before. Please proceed," remarked the doctress with great complacency.'
    expect(bearsPurpose(fiction).reason).toBe('no_request_act')
  })

  it('따옴표 밖의 요청은 그대로 센다', () => {
    const letter =
      'I enclose herewith a second letter, which I have answered as I did the first. Please observe the postscript before you send your reply.'
    expect(bearsPurpose(letter).ok).toBe(true)
  })

  // ⚠️ **홀로 선 따옴표에 본문을 잃지 않는다** — 짝이 없으면 지우지 않는다.
  it('짝이 없는 따옴표는 본문을 삼키지 않는다', () => {
    const unpaired = 'She said "it will be fine for you and your family. Please return the form by Friday.'
    expect(bearsPurpose(unpaired).ok).toBe(true)
  })
})

// ── 주장(20번) ────────────────────────────────────────────────────────
//
// ⚠️ 여기 실린 「떨어져야 하는」 지문 다섯은 **실제로 `claim-v5/chunk-03` 에 뽑혀 있던 것**이다
//   (2026-09-15에 채우려고 열었다가 발견했다). 지어낸 반례가 아니라 배치가 받아 든 몫이다.

/** 당위가 분명한 논설 — 이런 글에만 20번이 선다. */
const ARGUMENT =
  'Cities have spent a century widening roads, and each widening has filled with new cars within a few years. The lesson is not that drivers are irrational but that supply creates demand. Planners should stop treating congestion as a shortage of asphalt and start treating it as a price problem.'

describe('주장 — 당위 표현이 없으면 정답이 요지가 된다', () => {
  it('당위가 있는 논설은 통과한다', () => {
    expect(bearsClaim(ARGUMENT).ok).toBe(true)
    expect(bearsClaim(ARGUMENT).judged).toBe(true)
  })

  it('should 말고도 센다 — must · ought to · need to · have to', () => {
    for (const d of [
      'Schools must teach this earlier.',
      'We ought to revisit the assumption.',
      'Regulators need to publish the raw data.',
      'Readers have to weigh both costs.',
      'It is essential that the record be public.',
    ]) {
      expect(bearsClaim(`Some background sentence here. ${d}`).ok, d).toBe(true)
    }
  })

  // 실물 — 전부 순수 서술문이라 「필자가 주장하는 바」가 없다.
  it('실제로 뽑혀 있던 서술문 다섯을 떨어뜨린다', () => {
    const REAL_DESCRIPTIVE = [
      'Towards the north and the west the history of Russian expansion may almost be regarded as closed. Northwards there is nothing to be annexed but the Arctic Ocean and the Polar regions.',
      'The principle of the lathe was applied to those machines in which the shaft carrying the cutting or boring tool was held either in a vertical or in a horizontal position.',
      'The Turkish group studied the chemical structure of leaves from the plant called the sacred lotus. Water drops normally flatten and spread out when they fall on a surface.',
      'The Janua contained some eight thousand Latin words, arranged in simple sentences, with the vernacular equivalent in parallel columns.',
      'In order to get the foundations laid there were three essentials--a perfectly smooth sea, a dead calm, and low spring-tides.',
    ]
    for (const p of REAL_DESCRIPTIVE) {
      const fit = bearsClaim(p)
      expect(fit.ok, p.slice(0, 40)).toBe(false)
      expect(fit.reason).toBe('no_deontic')
    }
  })

  it('인물의 대사 속 당위는 필자의 주장이 아니다', () => {
    const fiction =
      'He set the lantern down and watched the door for a long moment before answering. "You must leave before the tide turns," he said quietly.'
    expect(bearsClaim(fiction).reason).toBe('no_deontic')
  })

  it('따옴표 밖의 당위는 그대로 센다', () => {
    // ⚠️ 처음 이 자리에 `should have acted on them years ago` 를 썼다가 아래 완료형 규칙에
    //   걸렸다 — 규칙이 아니라 **예문이 틀렸다.** 그것은 당위가 아니라 반사실이고,
    //   "그때 그랬어야 했다" 는 20번의 정답이 되지 않는다. 진짜 당위로 바꾼다.
    const mixed =
      '"The tide turns at six," he said. Accounts like his are common, and the harbour board should publish them before the next season.'
    expect(bearsClaim(mixed).ok).toBe(true)
  })

  it('빈 지문은 통과시키지 않는다', () => {
    expect(bearsClaim('').ok).toBe(false)
  })

  it('레지스트리에 걸려 bearsType 으로도 판정된다', () => {
    expect(hasTypeFitRule('claim')).toBe(true)
    expect(bearsType('claim', ARGUMENT).ok).toBe(true)
    expect(bearsType('claim', 'A purely descriptive sentence about lathes.').judged).toBe(true)
  })

  it('사유에 한국어 설명이 있다 — 화면이 그대로 찍는다', () => {
    expect(TYPE_FIT_REASON_KO.no_deontic.length).toBeGreaterThan(0)
  })
})

// ── 완료형 추측은 당위가 아니다 ───────────────────────────────────────
//
// ⚠️ 아래 셋은 게이트를 켜고 **처음 뽑은 8편에서 실제로 걸린 오탐**이다(2026-09-15).
//   지어낸 반례가 아니라 규칙이 한 번 놓친 자리다.
describe('주장 — must/should + have 는 추측·예측이다', () => {
  it('실제로 통과했던 완료형 추측 셋을 떨어뜨린다', () => {
    const REAL_EPISTEMIC = [
      'At Mytilene she appears to have gathered about her a large circle of young women. Her influence must have been widespread, for the list of her disciples includes names from all parts of Greece.',
      'Walt had been accustomed to reading his morning papers and then throwing them back on this stack. That pile must have been the accumulation of several years.',
      'Given that social interactions are fundamental to well-being, measures aimed at slowing the spread of the disease should have a significant impact on social behaviors.',
    ]
    for (const p of REAL_EPISTEMIC) {
      expect(bearsClaim(p).reason, p.slice(0, 40)).toBe('no_deontic')
    }
  })

  it('완료형을 지워도 남은 당위가 있으면 통과한다', () => {
    const both =
      'The early reports must have been exaggerated, as later surveys showed. Even so, regulators should publish the raw counts before the next review.'
    expect(bearsClaim(both).ok).toBe(true)
  })

  // 좁히기가 진짜 당위를 죽이지 않는지 — 이쪽이 더 중요하다.
  it('`must be` 수동 당위는 살아남는다', () => {
    expect(bearsClaim('Old-growth stands must be protected before the survey closes.').ok).toBe(true)
    expect(bearsClaim('These habits must be taught early, not corrected later.').ok).toBe(true)
  })
})

describe('주장 — need 가 명사인 자리', () => {
  it('실측 오탐 — 한정사 뒤의 `need to` 는 조동사가 아니다', () => {
    const real =
      'There was in that age but little leisure, freedom, wealth, security, or economic need to make such education possible or desirable for the many.'
    expect(bearsClaim(real).reason).toBe('no_deontic')
  })

  it('조동사 `need to` 는 그대로 센다', () => {
    expect(bearsClaim('Regulators need to publish the raw counts.').ok).toBe(true)
    expect(bearsClaim('A teacher needs to see the whole class at once.').ok).toBe(true)
  })

  /**
   * ⚠️ **아직 못 잡는 것** — 가정법 `That the boy should lose his heart …`(실측 오탐).
   *   구문이 아니라 절의 성격이라 정규식으로는 안 갈린다. 규칙이 필요조건만 적는다는
   *   계약상 통과시키는 쪽이 맞고, 남는 오탐은 다음 후보로 넘기면 된다(후보가 수요의 수십 배).
   *   적어 두는 이유는 다음 사람이 새 결함으로 다시 조사하지 않게 하기 위해서다.
   */
  it('가정법 should 는 아직 통과한다 — 알려진 한계', () => {
    expect(bearsClaim('That the boy should lose his heart to her was no matter for wonder.').ok).toBe(
      true,
    )
  })
})
