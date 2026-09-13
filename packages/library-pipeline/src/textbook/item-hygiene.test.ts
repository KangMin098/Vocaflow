// packages/library-pipeline/src/textbook/item-hygiene.test.ts
//
// **조판과 연습이 같은 판정을 써야 한다.**
//
// 실측 2026-09-01 — 게이트 다섯과 정제 체인을 여러 사이클에 걸쳐 세웠는데 전부
// 조판 경로에만 걸려 있었다. 학습자가 실제로 푸는 `/library/textbooks/[step]/practice` 는
// `textbook_practice_items` RPC 로 창고에서 곧장 가져오고, 그 RPC 는 유형 화이트리스트와
// `v_level`·발행 상태만 본다. 연습 후보 안에 남아 있던 것:
//
//   소재 부적합 **14,738문항**(V6 12,567 · V7 1,610 · V5 526 · V4 17 · V8 18)
//   철회 논문 **168문항**(V6 91 · V7 77) · 절 이름 잔존 56문항
//
// 조판물은 깨끗한데 학습자가 받는 것은 아니었다.
import { describe, expect, it } from 'vitest'

import { cleanItemPayload, isRetractedTitle, isTooShortForPractice, itemHygieneReject, passageTextOf } from './item-hygiene'

const ok = { payload: { passage: 'Photosynthesis converts light into chemical energy in leaves.' } }

describe('철회 논문', () => {
  it('앞머리로만 판정한다 — 철회를 다룬 글은 통과시킨다', () => {
    expect(isRetractedTitle('RETRACTED: Gene editing in rice')).toBe(true)
    expect(isRetractedTitle('[RETRACTED] Trial outcomes')).toBe(true)
    expect(isRetractedTitle('Withdrawn: a note on methods')).toBe(true)
    expect(isRetractedTitle('Retraction studies in research ethics')).toBe(false)
  })
})

describe('학습자에게 내보내도 되는가', () => {
  it('깨끗한 문항은 통과한다', () => {
    expect(itemHygieneReject(ok)).toBeNull()
  })

  it('출처 제목만으로도 막는다 — 출처는 화면에 함께 나간다', () => {
    expect(itemHygieneReject({ ...ok, refTitle: 'RETRACTED: something' })).toBe('retracted')
    expect(
      itemHygieneReject({ ...ok, refTitle: 'What can the US learn about contested abortion care?' }),
    ).toBe('sensitive')
  })

  it('조판이 막는 것을 똑같이 막는다', () => {
    expect(itemHygieneReject({ payload: { passage: 'A study of suicide rates in the region.' } })).toBe(
      'sensitive',
    )
    expect(itemHygieneReject({ payload: { passage: 'Credits: NASA. The probe launched.' } })).toBe('chrome')
    expect(
      itemHygieneReject({ payload: { passage: '38887), particularly where the link is unclear.' } }),
    ).toBe('cutFragment')
    expect(
      itemHygieneReject({ payload: { passage: 'They trained the model [] using a sample set.' } }),
    ).toBe('residue')
  })

  it('순서 문항의 지문은 `presented` 에 있다 — 그 키를 안 보면 통째로 샌다', () => {
    const order = { payload: { presented: ['A study of suicide prevention programs.', 'Next part.'] } }
    expect(passageTextOf(order.payload)).toContain('suicide')
    expect(itemHygieneReject(order)).toBe('sensitive')
  })

  it('지문이 없는 문항은 판정 대상이 아니다', () => {
    expect(itemHygieneReject({ payload: {} })).toBeNull()
    expect(itemHygieneReject({ payload: null })).toBeNull()
  })
})

describe('정제는 저장이 아니라 사본에 건다', () => {
  it('절 이름·구두점·따옴표를 다듬는다', () => {
    const cleaned = cleanItemPayload({
      passage: 'Abstract The coexistence of communities , despite weapons .',
      choices: ['He said “yes” and she said "no" to us.'],
    })
    expect(cleaned.passage).toBe('The coexistence of communities, despite weapons.')
    expect(cleaned.choices[0]).toBe('He said “yes” and she said “no” to us.')
  })

  it('원본 객체를 바꾸지 않는다', () => {
    const raw = { passage: 'Abstract The result was clear.' }
    cleanItemPayload(raw)
    expect(raw.passage).toBe('Abstract The result was clear.')
  })
})

describe('isTooShortForPractice', () => {
  const long = (n: number) => ({ passage: Array.from({ length: n }, () => 'word').join(' ') })

  it('하한 미만이면 막는다 — 4문장 미만은 순서를 맞출 단서가 없어 찍기가 된다', () => {
    expect(isTooShortForPractice(90, long(64))).toBe(true)
  })

  it('하한 이상이면 통과한다', () => {
    expect(isTooShortForPractice(90, long(120))).toBe(false)
  })

  it('**상한은 보지 않는다** — 길다는 이유로 막지 않는다 (지면 제약은 연습 화면에 없다)', () => {
    expect(isTooShortForPractice(90, long(400))).toBe(false)
  })

  it('지문이 없으면 대상이 아니다 — 문장 단위·초등 3종이 전량 걸리면 안 된다', () => {
    expect(isTooShortForPractice(90, {})).toBe(false)
    expect(isTooShortForPractice(90, null)).toBe(false)
  })

  it('하한이 없거나 이상하면 막지 않는다', () => {
    expect(isTooShortForPractice(0, long(1))).toBe(false)
    expect(isTooShortForPractice(Number.NaN, long(1))).toBe(false)
  })

  it('`presented` 에 담긴 순서 문항 지문도 센다 — 그 키를 빠뜨리면 통째로 샌다', () => {
    const presented = { presented: Array.from({ length: 120 }, () => 'word') }
    expect(isTooShortForPractice(90, presented)).toBe(false)
    expect(isTooShortForPractice(90, { presented: ['one', 'two'] })).toBe(true)
  })
})

/**
 * **밑줄이 낱말이 아닌 문항은 내보내지 않는다.**
 *
 * 생성 규칙은 2026-09-13 에 고쳤지만, 그 규칙으로 **다시 만들 수 없는** 문단이 있다
 * (V5 재생성 뒤 509문항이 그랬다 — 4,533개는 고쳐졌다). 고칠 수 없는 것은 안 내보낸다.
 * 조판 풀(`volume-pool.mjs`)도 같은 자를 쓴다 — 한쪽만 걸면 이 저장소가 이미 겪은
 * 「조판물은 깨끗한데 학습자가 받는 것은 아니었다」가 거울상으로 되풀이된다.
 */
describe('밑줄 위생', () => {
  const withWords = (...words: string[]) => ({
    payload: {
      sentences: ['The coastal region provides a steady supply of fresh water.'],
      underlines: words.map((word, i) => ({ word, sentenceIdx: 0, label: String(i + 1) })),
    },
  })

  it('부호·마크업이 붙은 밑줄은 반려한다', () => {
    for (const w of ['Happen?', 'Earthquakes—Rattling', 'worry.', 'Analogously,', '[Sidenote:']) {
      expect(itemHygieneReject(withWords('coastal', w)), w).toBe('badUnderline')
    }
  })

  it('순수한 낱말만 있으면 통과한다 — 더한 규칙이 뺀 규칙이 되지 않게', () => {
    expect(itemHygieneReject(withWords('coastal', 'provides', "don't"))).toBeNull()
  })

  it('밑줄이 없는 유형은 이 자의 대상이 아니다', () => {
    expect(itemHygieneReject({ payload: { passage: 'The probe launched last spring.' } })).toBeNull()
  })

  it('밑줄 배열이 망가져 있어도 죽지 않는다 — 세다가 죽으면 전량이 막힌다', () => {
    expect(() => itemHygieneReject({ payload: { underlines: [null, {}, 7] } })).not.toThrow()
    expect(itemHygieneReject({ payload: { underlines: [null] } })).toBe('badUnderline')
  })
})

/**
 * **약어 마침표에서 잘린 지문은 내보내지 않는다.**
 *
 * 3인 검수가 같은 자국을 네 갈래로 찾아냈다(실측 2026-09-13) — `U.S.` 는 이미 알려져
 * 있었는데 학명(`genome of V.`) · `Li et al.` · 시각(`at 8 a.m.`)에서 **재발**했다.
 * 선지가 그 조각 가운데 놓이면 학습자는 고를 수 없는 자리를 받는다.
 */
describe('약어 절단 위생', () => {
  const sents = (...s: string[]) => ({ payload: { sentences: s } })

  it('소문자로 열리는 문장은 조각의 뒤쪽이다', () => {
    expect(itemHygieneReject(sents('The probe launched.', 'constructed a timeline.'))).toBe('badSplit')
  })

  it('홀로 선 한 글자 약어로 끝나면 조각의 앞쪽이다', () => {
    expect(itemHygieneReject(sents('They inserted it into the genome of V.'))).toBe('badSplit')
  })

  it('점을 여러 개 쓰는 약어도 잡는다 — 한 글자 규칙으로는 안 잡힌다', () => {
    // `U.S.` 는 마지막 글자 앞이 공백이 아니라 마침표라 앞 규칙을 빠져나간다.
    expect(itemHygieneReject(sents('The survey covered the U.S.'))).toBe('badSplit')
    expect(itemHygieneReject(sents('The reading was taken at 8 a.m.'))).toBe('badSplit')
  })

  it('흔한 축약으로 끝나도 잡는다', () => {
    expect(itemHygieneReject(sents('The work follows Li et al.'))).toBe('badSplit')
  })

  it('멀쩡한 지문은 통과한다 — 더한 규칙이 뺀 규칙이 되지 않게', () => {
    expect(
      itemHygieneReject(
        sents(
          'The coastal region provides a steady supply of fresh water.',
          'Farmers depend on it during the dry season.',
        ),
      ),
    ).toBeNull()
  })

  it('문장 안의 약어는 건드리지 않는다 — 끝에 있을 때만 조각이다', () => {
    expect(
      itemHygieneReject(sents('The U.S. government published the report last spring.')),
    ).toBeNull()
  })

  it('배열이 아니거나 비어 있으면 대상이 아니다', () => {
    expect(itemHygieneReject({ payload: { passage: 'A single clean sentence here.' } })).toBeNull()
    expect(itemHygieneReject({ payload: { sentences: [] } })).toBeNull()
  })
})

/**
 * **부호 짝이 정답을 흘리면 문항이 아니다.**
 *
 * 3인 검수 2회차 실측(2026-09-13): 여는 따옴표가 한 덩어리에만, 닫는 따옴표가 다른
 * 덩어리에만 있어 **영어를 한 글자도 안 읽고 순서가 정해지는** 문항이 나왔다.
 * 괄호 판도 있었다. 전체를 이으면 짝이 맞아 버려 안 걸린다 — 그래서 **덩어리마다** 본다.
 */
describe('부호 누설 위생', () => {
  it('덩어리에 여는 부호만 있으면 순서가 새어 나간다', () => {
    expect(
      itemHygieneReject({
        payload: { presented: ['“Dams are supposed to be maintained.', 'He asked for more information.”'] },
      }),
    ).toBe('punctuationLeak')
    expect(
      itemHygieneReject({ payload: { presented: ['(Wilmot scientists ran the trial.', 'They finished.)'] } }),
    ).toBe('punctuationLeak')
  })

  it('덩어리 안에서 짝이 맞으면 통과한다', () => {
    expect(
      itemHygieneReject({
        payload: { presented: ['She said “it works” on the first try.', 'The team agreed with her.'] },
      }),
    ).toBeNull()
  })

  /** ⚠️ 평범한 지문에서는 인용이 여러 문장에 걸치는 것이 정상이다 — 같은 자를 대면 안 된다. */
  it('순서·삽입이 아닌 지문에는 이 자를 대지 않는다', () => {
    expect(
      itemHygieneReject({
        payload: { sentences: ['He began, “The river rose fast.', 'It did not stop for days.”'] },
      }),
    ).toBeNull()
  })
})

/**
 * **밑줄이 제 문장에 두 번 나오면 어디에 긋는지 확정되지 않는다.**
 *
 * 조판기와 화면은 첫 자리에 긋는데, 출제 의도가 어느 쪽인지 알 수 없다.
 * 앞서 부분문자열 충돌은 낱말 경계로 고쳤지만, **같은 낱말이 두 번**인 것은
 * 경계로 풀리지 않는다 — 문항 자체가 모호한 것이다.
 */
describe('밑줄 자리 모호', () => {
  const item = (sentence: string, word: string) => ({
    payload: { sentences: [sentence], underlines: [{ word, sentenceIdx: 0, label: '①' }] },
  })

  it('같은 낱말이 제 문장에 두 번이면 반려한다', () => {
    expect(item('Measurement error affects measurement quality.', 'measurement')).toBeTruthy()
    expect(
      itemHygieneReject(item('The wayfinding app improves wayfinding for drivers.', 'wayfinding')),
    ).toBe('ambiguousUnderline')
  })

  it('한 번만 나오면 통과한다', () => {
    expect(itemHygieneReject(item('The coastal region supplies fresh water.', 'coastal'))).toBeNull()
  })

  it('부분문자열은 두 번으로 세지 않는다 — 거기는 애초에 밑줄 자리가 아니다', () => {
    expect(
      itemHygieneReject(item('That was unnecessary but the necessary work went on.', 'necessary')),
    ).toBeNull()
  })
})

/**
 * **문자열 칸도 봐야 한다** — 2회차 검수가 찾은 판정자의 구멍.
 *
 * 처음엔 배열 칸(`sentences`·`presented`)만 봤는데, 삽입 문항의 〈보기〉는
 * `insert_sentence` 라는 **문자열**이라 검사를 통째로 빠져나갔다.
 * 그래서 판정자를 새로 걸고도 `…National Jewish Health and the U.S.` 로 잘린
 * 〈보기〉가 그대로 남아 있었다 — 검수가 그것을 찾아 알려 줬다.
 */
describe('약어 절단 — 문자열 칸', () => {
  it('삽입 문항의 〈보기〉가 약어에서 잘린 것을 잡는다', () => {
    expect(
      itemHygieneReject({
        payload: {
          insert_sentence: 'Groups such as National Jewish Health and the U.S.',
          remaining: ['The agencies met last spring.', 'They agreed on a plan.'],
        },
      }),
    ).toBe('badSplit')
  })

  it('도입문이 소문자로 열리는 것도 잡는다', () => {
    expect(
      itemHygieneReject({ payload: { intro: 'constructed a timeline of the evolution.' } }),
    ).toBe('badSplit')
  })

  it('멀쩡한 〈보기〉는 통과한다', () => {
    expect(
      itemHygieneReject({
        payload: {
          insert_sentence: 'The agencies agreed on a joint plan that spring.',
          remaining: ['They met in March.', 'The work began soon after.'],
        },
      }),
    ).toBeNull()
  })
})
