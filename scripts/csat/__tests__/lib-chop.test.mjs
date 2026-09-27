// scripts/csat/__tests__/lib-chop.test.mjs
//
// `lib-chop.mjs` 회귀 — **버리던 두 자리를 다시 버리지 못하게 막는다.**
//
// 옛 `chop()` 은 12권 1,312,273어 중 54.9% 를 버렸고, 그중 절대다수가 두 줄이었다:
//   · `if (w > hi) continue`        340어 넘는 문단을 쪼개지 않고 버림 — 본문의 21.3%
//   · `if (n <= hi + 60)` 아니면 리셋  창을 넘긴 묶음을 통째로 버림 — 본문의 30.6%
// 고친 뒤 같은 12권에서 장문창 잔존율이 45.1% → 72.8% 가 됐다.
//
// 실행: node --test scripts/csat/__tests__/lib-chop.test.mjs

import test from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const {
  chopToWindow, splitLongParagraph, splitSentences, countWords, isProseParagraph,
} = await import(pathToFileURL(resolve('scripts/csat/lib-chop.mjs')).href)

/**
 * n 어짜리 문장을 만든다 — **대문자로 시작하고** 마침표로 끝난다.
 *
 * ⚠️ 대문자가 필수다. `splitSentences` 는 약어(`e.g.`)를 안 쪼개려고 **뒤에 대문자가
 *   올 때만** 나눈다. 첫 판 픽스처는 소문자로 시작해서 한 문장도 안 갈렸고,
 *   그래서 멀쩡한 코드가 탈락했다 — 틀린 건 픽스처였다.
 */
const sentence = (n, seed = 'idea') =>
  ['Alpha', ...Array.from({ length: n - 2 }, (_, i) => `${seed}${i}`), 'end.'].join(' ')
/** 여러 문장을 이어 한 문단으로. */
const para = (...ss) => ss.join(' ')

test('긴 문단을 버리지 않고 문장 경계에서 쪼갠다', () => {
  // 옛 코드가 `continue` 로 통째로 버리던 자리. 본문의 21.3% 가 여기서 사라졌다.
  const p = para(sentence(200, 'a'), sentence(200, 'b'), sentence(200, 'c'))
  assert.equal(countWords(p), 600)
  const pieces = splitLongParagraph(p, 400)
  assert.ok(pieces.length >= 2, '쪼개져야 한다')
  for (const x of pieces) assert.ok(countWords(x) <= 400, `조각이 창을 넘었다: ${countWords(x)}`)
  // 낱말이 사라지지 않았다
  assert.equal(pieces.reduce((s, x) => s + countWords(x), 0), 600)
})

test('문장 중간에서는 자르지 않는다', () => {
  const pieces = splitLongParagraph(para(sentence(300, 'a'), sentence(300, 'b')), 400)
  for (const x of pieces) {
    assert.match(x, /\.$/, '조각이 마침표로 끝나야 한다')
    assert.match(x, /^[A-Za-z]/, '조각이 문장 처음에서 시작해야 한다')
  }
})

test('한 문장이 창보다 길면 쪼개지 않고 그대로 둔다', () => {
  // 문장을 쪼개면 그 조각의 문장 평균이 망가져 소스의 성질이 아니라 자르는 방식을 재게 된다.
  const one = sentence(500, 'z')
  assert.deepEqual(splitLongParagraph(one, 400), [one])
})

test('창을 넘길 것 같으면 먼저 내보내고 다음 묶음으로 넘긴다 — 버리지 않는다', () => {
  // 옛 코드는 여기서 버퍼를 그냥 비웠다. 본문의 30.6% 가 이 자리에서 사라졌다.
  //
  // ⚠️ 문단을 **실제 문장 길이(25어)로** 짠다. 첫 판은 250어짜리 단일 문장 문단을
  //   넷 놓고 「조각이 0개」라고 실패했는데, 그건 코드가 아니라 픽스처가 틀린 것이었다 —
  //   250어 문장은 쪼갤 수 없으니 300~400 창을 채울 방법이 애초에 없다.
  //   실제 산문은 문장이 15~30어라 촘촘히 채워진다.
  const paragraph = (seed, sents) =>
    Array.from({ length: sents }, (_, i) => sentence(25, `${seed}${i}`)).join(' ')
  const body = ['a', 'b', 'c', 'd'].map((s) => paragraph(s, 10)).join('\n\n') // 250어 × 4

  const { spans, losses } = chopToWindow(body, { lo: 300, max: 400 })
  assert.ok(spans.length >= 2, `조각이 ${spans.length}개뿐이다`)
  for (const s of spans) {
    const w = countWords(s)
    assert.ok(w >= 300 && w <= 400, `창 밖 조각: ${w}`)
  }
  assert.equal(losses.oversizeSentence, 0)
  // 1,000어에서 300~400 조각 둘이면 600~800어가 살아남는다 — 옛 코드는 여기서 0이었다.
  const kept = spans.reduce((s, x) => s + countWords(x), 0)
  assert.ok(kept >= 600, `되살린 몫이 ${kept}어뿐이다`)
})

test('마지막 꼬리도 하한을 넘으면 내보낸다', () => {
  const body = [sentence(350, 'a'), sentence(350, 'b')].join('\n\n')
  const { spans } = chopToWindow(body, { lo: 300, max: 400 })
  assert.equal(spans.length, 2, '둘째 문단이 꼬리로 사라지면 안 된다')
})

test('손실을 사유별로 세어 돌려준다 — 조용히 버리지 않는다', () => {
  const body = ['짧은 토막', sentence(350, 'a'), sentence(50, 'b')].join('\n\n')
  const { losses } = chopToWindow(body, { lo: 300, max: 400 })
  assert.ok(Object.prototype.hasOwnProperty.call(losses, 'notProse'))
  assert.ok(Object.prototype.hasOwnProperty.call(losses, 'tooShortTail'))
  assert.ok(Object.prototype.hasOwnProperty.call(losses, 'oversizeSentence'))
  assert.ok(losses.tooShortTail > 0, '하한에 못 미친 꼬리가 잡혀야 한다')
})

test('창을 인자로 받는다 — 같은 본문에서 여러 유형이 나온다', () => {
  // 옛 코드는 300~400 하나로 고정이라 짧은 창·학교 문단을 아예 못 냈다.
  const body = Array.from({ length: 8 }, (_, i) => sentence(120, `s${i}`)).join('\n\n')
  const long = chopToWindow(body, { lo: 300, max: 400 }).spans
  const short = chopToWindow(body, { lo: 120, max: 200 }).spans
  assert.ok(long.length > 0 && short.length > 0)
  assert.ok(short.length > long.length, '짧은 창이 더 많은 조각을 내야 한다')
  for (const s of short) assert.ok(countWords(s) <= 200)
})

test('약어를 문장 경계로 오인하지 않는다', () => {
  const t = 'Costs rise, e.g. fuel and rent. Wages do not follow. That gap is the problem.'
  assert.equal(splitSentences(t).length, 3)
})

test('표·목차 토막은 산문이 아니다', () => {
  assert.equal(isProseParagraph('CHAPTER IV'), false)
  assert.equal(isProseParagraph('1. Introduction 2. Method 3. Results'), false)
  assert.equal(
    isProseParagraph('A charge on drivers reduces the number of cars that enter the centre each day, and the money pays for buses.'),
    true,
  )
})
