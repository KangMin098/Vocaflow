// packages/library-pipeline/src/textbook/strip-section-labels.test.ts
//
// 절 이름 정제 회귀. **지우는 것보다 안 지우는 것을 더 많이 본다** — 이 규칙이 헛디디면
// 멀쩡한 문장의 첫 낱말이 사라지고, 그건 조판물에서 눈에 안 띈다.
import { describe, expect, it } from 'vitest'

import {
  cleanPassageText as canonicalCleanPassageText,
  stripSectionLabels,
  stripSpaceBeforePunct,
} from './csat-format'
import { cleanPassageText } from './item-hygiene'

describe('stripSectionLabels — 홀로 선 절 이름', () => {
  it('글 머리에 붙은 절 이름을 뗀다', () => {
    expect(stripSectionLabels('Abstract The coexistence of diverse communities is a puzzle.'))
      .toBe('The coexistence of diverse communities is a puzzle.')
  })

  it('문장 끝 뒤에 붙은 것도 뗀다', () => {
    expect(stripSectionLabels('We ran the study. Methods We assessed risk factors.'))
      .toBe('We ran the study. We assessed risk factors.')
  })

  it('연달아 붙은 것을 다 뗀다', () => {
    expect(stripSectionLabels('Abstract Background The importance of sleep is clear.'))
      .toBe('The importance of sleep is clear.')
  })

  it('여러 낱말 라벨도 뗀다', () => {
    expect(stripSectionLabels('Materials and Methods Rabbits were fed ad libitum.'))
      .toBe('Rabbits were fed ad libitum.')
  })

  // ── 건드리면 안 되는 것 ────────────────────────────────────────────
  it('문장 안에 든 낱말은 그대로 둔다', () => {
    const s = 'She read the Introduction Section before the exam.'
    expect(stripSectionLabels(s)).toBe(s)
  })

  it('뒤가 소문자면 그대로 둔다 — 진짜 문장이다', () => {
    const s = 'Results were mixed across the three sites.'
    expect(stripSectionLabels(s)).toBe(s)
  })

  it('주어로 쓰인 절 이름을 지우지 않는다', () => {
    const s = 'The abstract was written last. Conclusions follow from the data.'
    expect(stripSectionLabels(s)).toBe(s)
  })

  it('빈 값·null 을 견딘다', () => {
    expect(stripSectionLabels('')).toBe('')
    expect(stripSectionLabels(null as unknown as string)).toBe('')
  })

  it('절 이름이 없는 지문은 한 글자도 안 바꾼다', () => {
    const s = 'Small reductions to meat production in wealthier countries may help fight climate change.'
    expect(stripSectionLabels(s)).toBe(s)
  })
})

/**
 * **콜론을 달고 오는 원문 라벨.**
 *
 * 3인 검수에서 지문 첫 낱말이 `Explanation:` 인 문항이 나왔다(실측 2026-09-13).
 * 위 규칙으로는 안 걸렸다 — 목록에 없었고, **있었어도 콜론 때문에 `\s+` 가 안 맞는다.**
 *
 * ⚠️ 콜론을 **필수**로 두는 것이 이 검사의 요점이다. 콜론 없이 지우면 정상 산문이 잘린다.
 */
describe('stripSectionLabels — 콜론 라벨', () => {
  it('콜론이 붙은 원문 라벨을 뗀다', () => {
    expect(stripSectionLabels('Explanation: The Milky Way was not created by a lake.')).toBe(
      'The Milky Way was not created by a lake.',
    )
    expect(stripSectionLabels('Note: Results were mixed.')).toBe('Results were mixed.')
    expect(stripSectionLabels('The test ran. Source: Public records were used.')).toBe(
      'The test ran. Public records were used.',
    )
  })

  it('콜론이 없으면 건드리지 않는다 — 정상 산문을 자르지 않기 위해서다', () => {
    // 콜론 없이 이 낱말들을 지우면 아래 둘이 통째로 망가진다.
    expect(stripSectionLabels('Table Manners are learned early.')).toBe(
      'Table Manners are learned early.',
    )
    expect(stripSectionLabels('Note that the results were mixed.')).toBe(
      'Note that the results were mixed.',
    )
    expect(stripSectionLabels('Figure 3 shows the decline.')).toBe('Figure 3 shows the decline.')
  })

  it('문장 안에 든 라벨은 남긴다 — 문장을 여는 자리만 본다', () => {
    expect(stripSectionLabels('We read the Note: it was short.')).toBe(
      'We read the Note: it was short.',
    )
  })
})

/**
 * **하이픈 양옆의 공백은 잡티가 아니라 누설이다.**
 *
 * 해설 배치 실측(2026-09-13): 지문의 다른 네 곳이 `non-serious` 인데 **정답 자리만
 * `non - trivial`** 이었다 — 손댄 낱말이 조판 모양으로 표시돼, 영어를 한 자도 안 읽고
 * 그 선지가 짚인다. V5 실측 424문항. 지우면 되는 것이라 **거르지 않고 고친다.**
 */
describe('하이픈 공백', () => {
  it('낱말 사이 하이픈의 공백을 붙인다', () => {
    expect(cleanPassageText('a non - trivial result')).toBe('a non-trivial result')
    expect(cleanPassageText('Genesis -related discoveries')).toBe('Genesis-related discoveries')
    expect(cleanPassageText('well- known author')).toBe('well-known author')
  })

  it('낱말이 아닌 자리는 건드리지 않는다', () => {
    // 줄표는 낱말 사이 하이픈이 아니다.
    expect(cleanPassageText('The plan — a bold one — failed.')).toBe('The plan — a bold one — failed.')
    expect(cleanPassageText('already-joined words stay')).toBe('already-joined words stay')
  })
})

/**
 * **정제 사슬이 둘이 되면 반드시 갈린다 — 그 갈림을 여기서 잡는다.**
 *
 * 2026-09-15 에 `item-hygiene` 이 같은 이름으로 사슬을 한 벌 더 갖게 됐고, **그 사본에만**
 * `normalizeSourceMarkup` 이 빠졌다. 패키지가 밖으로 내주는 것(`src/index.ts`)이 하필
 * 그 사본이라 뽑기(`volume-pool.mjs`)와 검수 내보내기가 안 고쳐진 글을 썼다 — 3인 검수
 * 청크 셋이 각자 `--` 를 되짚어 왔다(chunk-02 · 04 · 05, 53문항 중 3건).
 *
 * ⚠️ **같은 결과를 내는지 재지 않는다 — 같은 함수인지 본다.** 표본으로 재면 새 규칙이
 *   한쪽에만 붙는 날 표본을 비켜 가고, 그러면 회귀가 있어도 갈림이 통과한다.
 */
describe('정제 사슬은 한 벌이다', () => {
  it('`item-hygiene` 이 내주는 정제기가 `csat-format` 의 그것과 같은 함수다', () => {
    expect(cleanPassageText).toBe(canonicalCleanPassageText)
  })

  // 검수자가 실제로 되짚어 온 세 글자 — 밖으로 나가는 이름으로 확인한다.
  it.each([
    ['chunk-02 · 낱말 사이', '“Carlisle--Jimmie Carlisle.”', '—Jimmie'],
    ['chunk-04 · 숫자 뒤', 'in the year 138--the Equiria', '138—the'],
    ['chunk-05 · 절 사이', 'the saddle--though he used one--and', 'saddle—though'],
  ])('%s 이중 하이픈이 지면 글자로 바뀐다', (_label, raw, want) => {
    expect(cleanPassageText(raw)).toContain(want)
    expect(cleanPassageText(raw)).not.toContain('--')
  })
})
