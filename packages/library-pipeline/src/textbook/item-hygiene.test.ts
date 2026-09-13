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

import {
  cleanItemPayload,
  isRetractedTitle,
  isTooShortForPractice,
  itemHygieneReject,
  MAX_SENTENCE_WORDS,
  passageTextOf,
} from './item-hygiene'

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

/**
 * **자리를 아는 밑줄은 모호하지 않다.**
 *
 * 어법 밑줄은 `tokenIdx` 를 저장한다. 관사·지시사는 한 문장에 여러 번 나오는 것이
 * 정상이라, 낱말로만 세면 멀쩡한 재고가 통째로 걸린다 —
 * 실측 2026-09-13: 이 갈래가 없던 동안 어법 **4,330문항 중 2,180개(50%)** 가 걸렸다.
 * 고칠 곳은 재고가 아니라 **자리를 안 쓰던 조판기**였다.
 */
describe('밑줄 자리 — tokenIdx 가 있으면 확정이다', () => {
  it('자리를 아는 어법 밑줄은 같은 낱말이 여러 번 나와도 통과한다', () => {
    expect(
      itemHygieneReject({
        payload: {
          sentences: ['They bought a panel and a switch for the shed.'],
          underlines: [
            { word: 'a', sentenceIdx: 0, tokenIdx: 2, label: '①' },
            { word: 'a', sentenceIdx: 0, tokenIdx: 5, label: '②' },
          ],
        },
      }),
    ).toBeNull()
  })

  it('자리를 모르는 어휘 밑줄은 여전히 모호로 잡는다', () => {
    expect(
      itemHygieneReject({
        payload: {
          sentences: ['The wayfinding app improves wayfinding for drivers.'],
          underlines: [{ word: 'wayfinding', sentenceIdx: 0, label: '①' }],
        },
      }),
    ).toBe('ambiguousUnderline')
  })
})

/**
 * **덩어리 길이가 정답의 첫 자리를 알려 주면 문항이 아니다.**
 *
 * 순서 문항의 정답 배열 첫 자리는 언제나 원문의 첫 조각이다(라벨은 섞여도 그건 안 바뀐다).
 * 자를 때 남는 문장을 앞에서부터 얹으면 첫 조각이 늘 가장 길어져 — **문장만 세면 풀린다.**
 * V5 실측: 문장 5개 1,306문항 완전 누설 · 6개 973문항 부분 누설 · 합쳐 48%.
 */
describe('덩어리 길이 누설', () => {
  /** 문장 5개 → rest 4 → 옛 규칙으로 [2,1,1]. 첫 덩어리가 유일하게 길다. */
  it('첫 덩어리가 유일하게 가장 길면 반려한다', () => {
    expect(
      itemHygieneReject({
        payload: { presented: ['Sentence number 0 runs on for a while.', 'Sentence number 1 runs on for a while.', 'Sentence number 2 runs on for a while.', 'Sentence number 3 runs on for a while.', 'Sentence number 4 runs on for a while.'] },
        answerKey: { source_order: [0, 1, 2, 3, 4] },
      }),
    ).toBe('blockLengthLeak')
  })

  it('셋이 같은 길이면 새지 않는다 — 문장 4개', () => {
    expect(
      itemHygieneReject({
        payload: { presented: ['Sentence number 0 runs on for a while.', 'Sentence number 1 runs on for a while.', 'Sentence number 2 runs on for a while.', 'Sentence number 3 runs on for a while.'] },
        answerKey: { source_order: [0, 1, 2, 3] },
      }),
    ).toBeNull()
  })

  it('가장 긴 덩어리가 둘이면 첫 자리가 확정되지 않는다 — 문장 6개', () => {
    // rest 5 → [2,2,1]. 첫 덩어리가 **유일하게** 길지는 않다.
    expect(
      itemHygieneReject({
        payload: { presented: ['Sentence number 0 runs on for a while.', 'Sentence number 1 runs on for a while.', 'Sentence number 2 runs on for a while.', 'Sentence number 3 runs on for a while.', 'Sentence number 4 runs on for a while.', 'Sentence number 5 runs on for a while.'] },
        answerKey: { source_order: [0, 1, 2, 3, 4, 5] },
      }),
    ).toBeNull()
  })

  /** ⚠️ 정답 배열을 모르면 **이 검사만** 건너뛴다 — 다른 검사는 그대로 돈다. */
  it('정답 키가 없으면 이 검사는 건너뛴다', () => {
    expect(
      itemHygieneReject({ payload: { presented: ['Sentence number 0 runs on for a while.', 'Sentence number 1 runs on for a while.', 'Sentence number 2 runs on for a while.', 'Sentence number 3 runs on for a while.', 'Sentence number 4 runs on for a while.'] } }),
    ).toBeNull()
  })
})

/**
 * **웹페이지 꼬리는 글이 아니다.**
 *
 * 해설 배치가 찾았다 — 한 문항은 USGS 연재 홍보문이 **「넣을 문장」 자체**였다.
 * 산불 지문인데 정답 자리가 홍보 질문 뒤라, 영어를 안 읽고 `…?` → `Then…` 만 보고 풀린다.
 */
describe('웹페이지 꼬리', () => {
  it('연재 홍보 블록을 잡는다', () => {
    expect(
      itemHygieneReject({
        payload: { sentences: ['Then check out USGS Science Snippets, our snack-sized science series.'] },
      }),
    ).toBe('chrome')
  })

  it('안내 링크와 전화번호를 잡는다', () => {
    expect(
      itemHygieneReject({ payload: { sentences: ['Visit the USGS event page for more information.'] } }),
    ).toBe('chrome')
    expect(
      itemHygieneReject({ payload: { sentences: ['Call the office at 303-273-8500 for details.'] } }),
    ).toBe('chrome')
  })

  it('평범한 과학 글은 막지 않는다', () => {
    expect(
      itemHygieneReject({
        payload: { sentences: ['The survey mapped the fault line across three counties.'] },
      }),
    ).toBeNull()
  })
})

/**
 * **반대 방향의 절단** — 문장 경계가 사라져 두 문장이 한 덩어리로 붙은 것.
 *
 * 해설 배치 실측(2026-09-13): `…this century.Most deforestation for oilseeds…`.
 * 삽입 문항에서는 **자리 하나가 선지에서 사라진다** — 고를 수 없는 경계가 생긴다.
 * V5 실측 91문항. 붙은 것을 떼려면 문장 배열을 다시 만들어야 하므로 거른다.
 */
describe('문장 경계 소실', () => {
  it('마침표 뒤 공백이 없으면 잡는다', () => {
    expect(
      itemHygieneReject({
        payload: { sentences: ['Forests shrank this century.Most of it was for oilseeds.'] },
      }),
    ).toBe('badSplit')
  })

  it('약어는 잡지 않는다 — 그건 다른 갈래다', () => {
    expect(
      itemHygieneReject({ payload: { sentences: ['The U.S. team published the map last spring.'] } }),
    ).toBeNull()
  })
})

/**
 * **다섯 선지가 서로 다른 낱말이어야 한다.**
 *
 * 3회차 검수 실측: 어휘 문항 7개 중 **4개**에서 밑줄 둘이 같은 낱말이었다
 * (`experienced`×2 · `robot`/`robots` · `romantic`×2). 5지선다가 3~4지가 된다.
 * 또 한 문항은 정답이 `rarely → often` 인데 **선지 ②가 `Often`** 이었다.
 *
 * DB 실측(V5 10,612): 낱말 중복 1,265(12%) · 정답 낱말이 선지로 1,143(11%).
 */
describe('선지 충돌', () => {
  const item = (words: string[], original?: string) => ({
    payload: {
      sentences: ['The coastal region provides a steady supply of fresh water.'],
      underlines: words.map((word, i) => ({ word, sentenceIdx: 0, label: String(i + 1) })),
    },
    ...(original ? { answerKey: { original } } : {}),
  })

  it('같은 낱말이 두 선지에 있으면 반려한다', () => {
    expect(itemHygieneReject(item(['experienced', 'coastal', 'experienced', 'supply', 'fresh']))).toBe(
      'choiceCollision',
    )
  })

  it('굴절형도 같은 낱말로 본다 — 학생 눈에는 한 낱말이다', () => {
    expect(itemHygieneReject(item(['robot', 'coastal', 'robots', 'supply', 'fresh']))).toBe(
      'choiceCollision',
    )
  })

  it('정답의 원래 낱말이 다른 선지로 인쇄되면 반려한다', () => {
    expect(itemHygieneReject(item(['rarely', 'Often', 'coastal', 'supply', 'fresh'], 'often'))).toBe(
      'choiceCollision',
    )
  })

  it('다섯이 서로 다르면 통과한다 — 더한 규칙이 뺀 규칙이 되지 않게', () => {
    expect(
      itemHygieneReject(item(['coastal', 'steady', 'supply', 'region', 'water'], 'plentiful')),
    ).toBeNull()
  })

  it('밑줄이 하나뿐이면 충돌이 없다', () => {
    expect(itemHygieneReject(item(['coastal']))).toBeNull()
  })
})

/**
 * **CEFR 로는 학술 산문을 못 거른다 — 문장 길이로 거른다.**
 *
 * 고등 밴드에 B2 상한을 걸고도 3회차 검수가 학술 산문을 계속 잡아냈다.
 * 확인해 보니 그 문항들이 **전부 `B2` 로 태그**돼 있었다(PLOS·eLife 논문까지) —
 * `cefr_level` 은 Flesch 가독성에서 오고 방법론 절은 문장이 짧아 B2 를 받는다.
 * 검수자들이 실제로 짚은 것은 **초장문**이었다(48낱말 도입문 · 57낱말 · 306자).
 */
describe('초장문', () => {
  const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ')

  it('50낱말을 넘는 문장이 있으면 반려한다', () => {
    expect(itemHygieneReject({ payload: { sentences: [`The ${words(55)}.`] } })).toBe('longSentence')
  })

  it('도입문·〈보기〉도 본다 — 배열이 아니라 문자열 칸이다', () => {
    expect(itemHygieneReject({ payload: { intro: `The ${words(55)}.` } })).toBe('longSentence')
    expect(itemHygieneReject({ payload: { insert_sentence: `The ${words(55)}.` } })).toBe(
      'longSentence',
    )
  })

  it('보통 길이는 통과한다 — 우리 중앙값이 20낱말이다', () => {
    expect(
      itemHygieneReject({
        payload: { sentences: ['The coastal region provides a steady supply of fresh water each spring.'] },
      }),
    ).toBeNull()
  })

  it('상한이 코드에 적혀 있다 — 근거는 머리 주석', () => {
    expect(MAX_SENTENCE_WORDS).toBe(50)
  })
})

/**
 * **자가 틀렸지 재고가 틀린 것이 아니었다** (실측 2026-09-13).
 *
 * 위 「약어 절단」 판정자와 `NON_PROSE` 가 **지문이 아닌 텍스트**에 대어져, 조판에서
 * 유형 일곱 종이 통째로 사라졌다. 둘 다 규칙이 넓었던 것이지 문항이 나빴던 것이 아니다.
 *
 *   V5 실측 — 선지가 소문자로 여는 유형이 전량 `badSplit`:
 *     blank 78 · topic 23 · mood 25 · summary 22 · implication 14 · long_vocab 16
 *   V5 실측 — 빈칸 표시(`_____`)가 전량 `residue`:
 *     blank_word 19,870 (창고 전체로는 224,148)
 *
 * 이 두 묶음은 **되돌아오면 안 되는 자리**다. 자를 넓힌 만큼 오탐도 함께 잠근다 —
 * 아래 「여전히 막는다」 검사가 그 몫이다.
 */
describe('자가 지문이 아닌 것을 재고 있었다', () => {
  it('선지가 소문자로 열어도 막지 않는다 — 빈칸·주제·제목 선지는 원래 구(句)다', () => {
    expect(
      itemHygieneReject({
        payload: {
          passage: 'Indigenous communities, like the Navajo, ____.',
          choices: [
            'have refused to share their own maps with outsiders',
            'already run their own satellite programs alone',
            'have long had almost no support for using such data',
            'prefer paper maps to any image taken from space',
            'were the first partners in the Landsat program',
          ],
        },
      }),
    ).toBeNull()
  })

  it('선지가 약어로 끝나도 막지 않는다 — 선지는 문장 분할로 만들어지지 않는다', () => {
    expect(
      itemHygieneReject({
        payload: {
          passage: 'The survey ran for three years before the results were published.',
          choices: ['a study run by the U.S.', 'a plan drawn up by Li et al.'],
        },
      }),
    ).toBeNull()
  })

  it('지문 쪽 절단은 **여전히 막는다** — 선지를 빼는 것이 판정자를 끄는 것이 되면 안 된다', () => {
    expect(
      itemHygieneReject({
        payload: {
          sentences: ['The survey covered the U.S.'],
          choices: ['one clean choice', 'another clean choice'],
        },
      }),
    ).toBe('badSplit')
  })

  it('문항이 찍은 빈칸 표시는 잔해가 아니다 — `_____` 4~15개', () => {
    expect(
      itemHygieneReject({
        payload: {
          stem: 'Fleas can cause pets to _____ itchy, especially on their lower back.',
          context: 'Veterinarians describe the signs that owners notice first at home.',
        },
      }),
    ).toBeNull()
    expect(
      itemHygieneReject({
        payload: { passage: 'The biggest differences between them are ____ in daily service.' },
      }),
    ).toBeNull()
  })

  it('사전 보일러플레이트의 긴 가로줄은 **여전히 막는다** — 16개 이상', () => {
    expect(
      itemHygieneReject({
        payload: { passage: `A calm opening sentence. ${'_'.repeat(48)} stimulate – v.` },
      }),
    ).toBe('residue')
  })

  it('빈칸 표시를 지운다고 다른 잔해까지 지워지지 않는다', () => {
    expect(
      itemHygieneReject({
        payload: { passage: 'The result was confirmed later _____ by another team [12].' },
      }),
    ).toBe('residue')
  })
})
