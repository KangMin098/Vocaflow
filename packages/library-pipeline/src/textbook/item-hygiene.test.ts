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

/**
 * **각주 약물에서 잘린 조각** (3인 검수 3회차 실측 2026-09-14).
 *
 * 검수자 둘이 각자 같은 지문을 짚었다 — 19세기 학술서의 각주 약물(`(vi. 13)` · `RC xxi. 149 f.`)
 * 마다 끊겨 「문장」이 아닌 조각이 지면에 올랐다. 위 ①~⑤ 는 하나도 못 잡는다: 소문자로
 * 열지도, 한 글자 약어로 끝나지도 않기 때문이다.
 *
 * DB 실측 — 이런 조각을 가진 문항 **11,321건**. 가장 흔한 조각은 전부 진짜 잘림이다:
 * `Mr.`(1,057) · `No.`(617) · `5.`(616) · `Mrs.`(571) · `.`(284) · `Fig 1.`(178).
 */
describe('각주·번호 매김에서 잘린 조각', () => {
  const sents = (...s: string[]) => ({ payload: { sentences: s } })

  it('글자가 하나도 없는 조각은 문장이 아니다', () => {
    expect(itemHygieneReject(sents('The tide rose twice that night.', '.'))).toBe('badSplit')
    expect(itemHygieneReject(sents('The tide rose twice that night.', '5.'))).toBe('badSplit')
  })

  it('여는 괄호 안의 약어에서 끊긴 조각을 잡는다', () => {
    expect(
      itemHygieneReject(sents('The religious interdictions mentioned by Cæsar (vi.')),
    ).toBe('badSplit')
  })

  it('번호 매김의 뒤쪽만 남은 조각을 잡는다', () => {
    expect(itemHygieneReject(sents('13) may be regarded as tabus, while the spoils remained.'))).toBe(
      'badSplit',
    )
  })

  it('숫자로 끝나는 짧은 라벨을 잡는다', () => {
    expect(itemHygieneReject(sents('The chart shows the trend clearly.', 'Fig 1.'))).toBe('badSplit')
    expect(itemHygieneReject(sents('The chart shows the trend clearly.', 'RC xxii.'))).toBe('badSplit')
  })

  // ⚠️ 더한 규칙이 뺀 규칙이 되지 않게 — 멀쩡한 짧은 문장을 막으면 재고가 통째로 사라진다.
  it('숫자로 끝나는 멀쩡한 짧은 문장은 통과한다', () => {
    expect(
      itemHygieneReject(sents('The boy was only 21.', 'He had never left the village before.')),
    ).toBeNull()
  })

  it('숫자로 여는 멀쩡한 문장은 통과한다', () => {
    expect(
      itemHygieneReject(
        sents('2024 saw the first harvest in a decade.', 'The farmers had waited a long time.'),
      ),
    ).toBeNull()
  })

  it('괄호가 제대로 닫힌 인용은 통과한다', () => {
    expect(
      itemHygieneReject(
        sents('The ruling (see chapter four) changed the outcome for everyone involved.'),
      ),
    ).toBeNull()
  })
})

/**
 * **유형↔지문 적합** — 소설에 「글의 목적」을 묻는 문항을 인쇄하지 않는다.
 *
 * 3인 검수 두 청크가 각자 짚었고(reading-v5 chunk-04 · chunk-05, purpose 3/3 이 서사),
 * 재고 전체는 86건 중 통과 **0** 이었다. 자세한 실측은 `type-fit.ts` 머리에 있다.
 */
describe('유형이 지문에 얹히는가', () => {
  const narrative = {
    payload: {
      passage:
        'After awhile the mowers came, and the grass fell in swathes behind them. Bevis watched from the gate until the sun went down behind the elms.',
    },
  }

  it('서사에 붙은 목적 문항을 막는다', () => {
    expect(itemHygieneReject({ ...narrative, type: 'purpose' })).toBe('typeMisfit')
  })

  // ⚠️ **막는 것이 목적이 아니다.** 규칙이 넓어져 편지까지 막으면 18번을 영영 못 만든다.
  it('편지는 그대로 통과한다', () => {
    const letter = {
      payload: {
        passage:
          'Dear Mr. Harding,\n\nThe school bus has been arriving nearly fifteen minutes late for two months. I am writing to ask that the morning schedule be reviewed before the winter term begins.',
      },
    }
    expect(itemHygieneReject({ ...letter, type: 'purpose' })).toBeNull()
  })

  // ⚠️ 유형을 안 넘기면 **재지 않는다** — 다른 검사까지 조용히 죽이면 안 된다.
  it('유형이 없으면 이 검사만 건너뛴다', () => {
    expect(itemHygieneReject(narrative)).toBeNull()
    expect(itemHygieneReject({ ...narrative, type: 'topic' })).toBeNull()
  })

  // ⚠️ 규칙이 **다른 검사를 가려서는 안 된다** — 유형이 맞아도 민감 소재는 여전히 막힌다.
  it('적합해도 다른 사유는 그대로 막는다', () => {
    const letterWithChrome = {
      payload: {
        passage:
          'Dear Ms. Alvarez,\n\nCredits: NASA. I am writing to ask whether you could kindly send your revised timetable.',
      },
    }
    expect(itemHygieneReject({ ...letterWithChrome, type: 'purpose' })).toBe('chrome')
  })
})

/**
 * **배열 문항의 재고에도 같은 자를 댄다.**
 *
 * `word-order.ts` 의 두 검사는 앞으로 만들 문항만 막는다. 재고 실측(2026-09-15):
 * 부사가 옮겨지는 것 **4,133건** · 대문자가 첫 자리를 흘리는 것 **3,182건** —
 * 둘 다 지금도 조판 대상이었다.
 */
describe('배열 뭉치가 정답을 하나로 확정하는가', () => {
  it('옮길 수 있는 부사가 있으면 인쇄하지 않는다', () => {
    const payload = { bank: ['borrowed', 'horse', 'therefore', 'a', 'he', 'from', 'Wilkins'] }
    expect(itemHygieneReject({ payload, type: 'word_order' })).toBe('ambiguousOrder')
  })

  it('대문자 기능어가 남아 있으면 인쇄하지 않는다', () => {
    const payload = { bank: ['builders', 'Their', 'rebuilt', 'wall', 'northern', 'the'] }
    expect(itemHygieneReject({ payload, type: 'word_order' })).toBe('caseLeak')
  })

  it('고유명사의 대문자는 정상이다', () => {
    const payload = { bank: ['builders', 'Prague', 'rebuilt', 'wall', 'northern', 'the'] }
    expect(itemHygieneReject({ payload, type: 'word_order' })).toBeNull()
  })

  // ⚠️ `not only … but also` 의 `also` 는 붙박이다 — 막으면 멀쩡한 재고를 버린다.
  it('`but also` 는 막지 않는다', () => {
    const payload = { bank: ['found', 'it', 'harbours', 'but', 'also', 'along', 'shores', 'they'] }
    expect(itemHygieneReject({ payload, type: 'word_order' })).toBeNull()
  })
})

/**
 * **무관 문항도 부호 모양으로 답이 보인다.**
 *
 * 3인 검수 chunk-01: 무관 문항 두 건이 **둘 다** 정답 문장에만 짝 없는 따옴표를 달고 있었다
 * (`"Note that I am not giving …` · `" Low participation …`). 다섯 자리 중 모양이 다른
 * 하나가 정답이라 영어를 한 줄도 안 읽고 고른다.
 */
describe('무관 문항의 부호 누설', () => {
  const five = (...s: string[]) => ({ payload: { intro: 'The town kept its fleet.', sentences: s } })
  const CLEAN = [
    'The fleets bring in enough catch to supply the local markets.',
    'Younger crews replace older boats with quieter engines.',
    'Harbour councils publish the daily catch so buyers can plan.',
    'Mountain railways carried timber to the mills inland.',
    'The towns that kept their fleets held their populations steady.',
  ]

  it('짝 없는 따옴표가 딱 하나면 그 자리가 보인다', () => {
    const leaky = [...CLEAN]
    leaky[3] = '"Note that I am not giving the full figure here.'
    expect(itemHygieneReject(five(...leaky))).toBe('punctuationLeak')
  })

  it('여는 따옴표 뒤 공백도 짝이 안 맞는 꼴이다', () => {
    const leaky = [...CLEAN]
    leaky[1] = '" Low participation was reported in the northern district.'
    expect(itemHygieneReject(five(...leaky))).toBe('punctuationLeak')
  })

  // ⚠️ **넓게 잡으면 멀쩡한 재고가 통째로 떨어진다** — 이 저장소가 이미 두 번 겪었다.
  it('인용이 두 문장에 걸치면 누설이 아니다 — 모양이 갈리지 않는다', () => {
    // ⚠️ 두 토막이 **둘 다** 인용부호로 열리게 둔다. 한쪽만 열면 첫 글자 모양이 갈려
    //   아래 「첫 글자 모양」 검사가 잡는다 — 그 검사는 실측 98.5% 정밀도라 그대로 둔다
    //   (오탐 1/66 = 1.5%, 그 하나가 바로 이런 자리다).
    const spanning = [...CLEAN]
    spanning[1] = '“The catch is smaller than last year,” the harbour master said.'
    spanning[2] = '“Nobody expects it to recover soon,” he added.'
    expect(itemHygieneReject(five(...spanning))).toBeNull()
  })

  it('전부 짝이 맞으면 통과한다', () => {
    expect(itemHygieneReject(five(...CLEAN))).toBeNull()
  })

  it('문장이 셋 미만이면 대상이 아니다 — 무관 문항이 아니다', () => {
    expect(itemHygieneReject({ payload: { sentences: ['"Only one unbalanced here.'] } })).toBeNull()
  })
})

/**
 * **아무도 읽지 않을 문항을 세 사람이 읽었다.**
 *
 * 지칭(44번)의 인쇄 가능 판정이 조판기 안에만 있었다. 그래서 검수 내보내기는 조판이
 * 건너뛸 문항을 그대로 내보냈고, 3인 검수 chunk-03 이 `47e4173a` 를 다 읽고 나서야
 * 「이건 인쇄가 안 된다」를 알았다(실측 자리표 (a)82 · (b)564 · **(c)1070 · (d)873** · (e)1365).
 * 3인 검수는 이 파이프라인에서 가장 비싼 자원이라 낭비가 그대로 발행 지연이 된다.
 */
describe('지칭 문항이 지면에 설 수 있는가', () => {
  const passage =
    'Ines opened the glass door and stepped onto the terrace. Her mother had gone through the same door an hour before. Marek followed her into the garden without a word. The lamp she carried threw a long shadow. Her mother called once from the far end.'

  const item = (choices: string[]) => ({
    payload: { passage, choices },
    answer_key: { answer: 3 },
    type: 'long_reference',
  })

  it('절 다섯이 나오는 차례면 통과한다', () => {
    expect(
      itemHygieneReject(
        item([
          'Ines opened the glass door',
          'Her mother had gone through the same door',
          'Marek followed her into the garden',
          'The lamp she carried',
          'Her mother called once',
        ]),
      ),
    ).toBeNull()
  })

  it('차례가 어긋나면 인쇄하지 않는다 — (d) 가 (c) 보다 앞이다', () => {
    expect(
      itemHygieneReject(
        item([
          'Ines opened the glass door',
          'Her mother had gone through the same door',
          'The lamp she carried',
          'Marek followed her into the garden',
          'Her mother called once',
        ]),
      ),
    ).toBe('unprintableReference')
  })

  it('한 절이라도 지문에 없으면 인쇄하지 않는다', () => {
    expect(
      itemHygieneReject(
        item([
          'Ines opened the glass door',
          'Her mother had gone through the same door',
          'a clause that never appears anywhere',
          'The lamp she carried',
          'Her mother called once',
        ]),
      ),
    ).toBe('unprintableReference')
  })

  it('절이 다섯이 아니면 인쇄하지 않는다', () => {
    expect(itemHygieneReject(item(['Ines opened the glass door']))).toBe('unprintableReference')
  })

  // ⚠️ **따옴표 모양 때문에 「없다」고 읽지 않는다** — 풀이 지문만 정제해 한 글자가 달라진다.
  it('아포스트로피 모양이 달라도 찾는다', () => {
    const curly =
      'Ivo said he’d wait by the gate. The keeper had told him so. Ivo counted the minutes until dusk. He’d never waited so long. The gate stayed shut.'
    expect(
      itemHygieneReject({
        payload: {
          passage: curly,
          choices: ["Ivo said he'd wait", 'The keeper had told him', 'Ivo counted the minutes', "He'd never waited", 'The gate stayed shut'],
        },
        answer_key: { answer: 2 },
        type: 'long_reference',
      }),
    ).toBeNull()
  })

  it('다른 유형은 이 자의 대상이 아니다', () => {
    expect(itemHygieneReject({ payload: { passage }, type: 'topic' })).toBeNull()
  })
})

/**
 * **문장처럼 열리지 않는 조각** — 해설 전수 재작성의 표본이 알려 줬다(2026-09-16).
 *
 * `irrelevant` 15,618건을 다시 쓰다가 **정답 문장**이 이런 것을 보았다:
 *
 *     `# 130-052-301) and PBS, and were processed using Chromium Controller …`
 *     `(2021) highlight how this problem arises in a wide variety of …`
 *
 * 기존 자국 열은 이 꼴을 하나도 못 잡는다. 실측(표본 1,200): 새 규칙에 걸리는 것 841건,
 * 그중 **이미 다른 사유로 빠지는 것 462건**을 빼면 **새로 빠지는 것 517건(43%)**.
 * 새로 빠지는 것만 골라 열을 읽었더니 **10/10 이 조각**이었다 — 참고문헌 꼬리 ·
 * 수식/표 번호 · 인터뷰 화자표 · 카탈로그 번호.
 */
describe('문장처럼 열리지 않는 조각', () => {
  const sents = (...s: string[]) => ({ payload: { sentences: s } })

  it.each([
    ['참고문헌 꼬리', '(2008) Minority HIV-1 drug resistance mutations are present in naive populations.'],
    ['수식 번호', '(11) Finally, the results on the PPML coefficients are more accurate than the OLS ones.'],
    ['표 번호 · 공백 없음', '(12)This adjustment allows for a higher rating for players who play many games.'],
    ['인터뷰 화자표', '(Father 4) Following the discharge, relationships in their social network had changed.'],
    ['카탈로그 번호', '# M3029S, NEB Luna Probe One-Step Mix with UDG), SARS-CoV-2 Neo Assay Kit was used.'],
    ['백분율 이어짐', '% inhibition was then calculated by using the formula as mentioned in equation 1.'],
  ])('%s 는 문장이 아니다', (_label, frag) => {
    expect(itemHygieneReject(sents('The coastal region provides a steady supply of water.', frag))).toBe(
      'badSplit',
    )
  })

  // ⚠️ **괄호 하나를 통째로 막지 않는다** — 문장 전체가 괄호 안인 것은 정상이다.
  //   막으면 멀쩡한 지문이 통째로 떨어진다(이 저장소가 두 번 겪은 일이다).
  it.each([
    ['문장 전체가 괄호', '(The figures for 2019 were revised after the survey closed.)'],
    ['숫자로 여는 문장', '2024 saw the highest rainfall recorded in the northern valley.'],
    ['평범한 문장', 'The coastal region provides a steady supply of fresh water each year.'],
  ])('%s 는 그대로 통과한다', (_label, s) => {
    expect(itemHygieneReject(sents('Farmers depend on it during the dry season.', s))).toBeNull()
  })
})

/**
 * **첫 글자 모양도 답을 알려 준다.**
 *
 * 앞의 「짝이 안 맞는가」는 인용이 같은 문장 안에서 닫히면 통과시킨다 — 개수가 짝수라서다.
 * 그런데 지면에서는 **그 줄만 따옴표로 열려** 눈에 띈다.
 *
 * 실측 2026-09-16 (V5 무관 2,500문항): 정답 문장이 알파벳으로 안 시작하는 비율 **87.0%**,
 * 정답 아닌 문장 **1.4%**. 새로 빠지는 66건 중 **65건(98.5%)에서 그 문장이 정답**이었다.
 */
describe('첫 글자 모양이 갈리면 답이 보인다', () => {
  const CLEAN = [
    'The fleets bring in enough catch to supply the local markets.',
    'Younger crews replace older boats with quieter engines.',
    'Harbour councils publish the daily catch so buyers can plan.',
    'Mountain railways carried timber to the mills inland.',
    'The towns that kept their fleets held their populations steady.',
  ]
  const five = (...s: string[]) => ({ payload: { intro: 'The town kept its fleet.', sentences: s } })

  it('짝이 맞는 따옴표로 열려도 그 줄만 다르면 잡는다', () => {
    const leaky = [...CLEAN]
    // 따옴표가 같은 문장 안에서 닫힌다 — 개수가 짝수라 앞 검사는 통과시킨다.
    leaky[3] = '" Low participation" is an indicator that measures involvement of lawmakers.'
    expect(itemHygieneReject(five(...leaky))).toBe('punctuationLeak')
  })

  // ⚠️ 여럿이면 모양이 갈리지 않는다 — 누설이 아니다.
  it('모양이 다른 줄이 둘이면 잡지 않는다', () => {
    const many = [...CLEAN]
    many[1] = '"The catch is smaller than last year," the harbour master said.'
    many[3] = '"Nobody expects it to recover soon," he added.'
    expect(itemHygieneReject(five(...many))).toBeNull()
  })

  it('전부 글자로 열리면 통과한다', () => {
    expect(itemHygieneReject(five(...CLEAN))).toBeNull()
  })
})

/**
 * **배열 문항의 정답은 `payload` 가 아니라 `answer_key` 에 있다.**
 *
 * `hasBadSentenceSplit` 은 `PASSAGE_KEYS`·`SPLIT_CHECK_ARRAY_KEYS` 만 훑는데
 * `word_order` 의 정답 문장은 `answer_key.sentence` 다 — 자가 그 자리를 한 번도 안 봤다
 * (3인 검수 chunk-02 이 짚었다). **재고가 낡아서가 아니라 범위 누락이다.**
 * DB 실측 2026-09-16: `word_order` 48,855건 중 **3,772건(7.7%)**.
 */
describe('배열 문항의 정답 문장도 본다', () => {
  const item = (sentence: string) => ({
    payload: { bank: ['boat', 'the', 'into', 'they', 'got', 'warning'] },
    answer_key: { sentence },
    answerKey: { sentence },
    type: 'word_order',
  })

  it('약어에서 잘린 정답을 잡는다 — 이름이 통째로 없다', () => {
    expect(itemHygieneReject(item('They got into the boat with a warning from Mr.'))).toBe('badSplit')
  })

  it('온전한 정답은 통과한다', () => {
    expect(itemHygieneReject(item('They got into the boat with a warning.'))).toBeNull()
  })

  it('정답 문장이 없으면 이 검사만 건너뛴다', () => {
    expect(itemHygieneReject({ payload: { bank: ['boat', 'the'] }, type: 'word_order' })).toBeNull()
  })
})
