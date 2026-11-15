// scripts/csat/__tests__/passage-notes.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import { passageOf } from '../lib-passage.mjs'

const block = [
  '28. 다음 안내문의 내용과 일치하지 않는 것은?',
  'School Event',
  'We welcome participants.',
  '* Winners will receive a pass to',
  'the next event.',
  '* Note: Register before Monday!',
  '* welcome: 환영하다',
  '** pass: 통행증',
  '① first', '② second', '③ third', '④ fourth', '⑤ fifth',
]

test('notice operational notes retain their marker and wrapped text; vocabulary glosses stay excluded', () => {
  const p = passageOf(block, { keepEnglishNotes: true })
  assert.match(p, /\* Winners will receive a pass to the next event\./)
  assert.match(p, /\* Note: Register before Monday!/)
  assert.doesNotMatch(p, /welcome:|pass:|환영|통행증|①/)
})

test('existing extraction retains its glossary behavior when the notice option is absent', () => {
  const p = passageOf(block)
  assert.doesNotMatch(p, /\* Winners|\* Note/)
  assert.match(p, /the next event\./)
})

// 평가원 안내문(2026-10-25): 각주가 정답 근거인데 원장 생성이 학평에만 각주를 남겨 DB 에서 빠졌다(M1809#26 · 2014A#29).
const kiceNotice = [
  '29. Modern Pottery Museum에 관한 다음 안내문의 내용과 일치하지 않는 것은?',
  '    Modern Pottery Museum',
  '    Hours  *',
  '    Weekdays: 9:00 a.m. －  6:00 p.m.',
  '    * The museum is closed on the first Monday of every',
  '      month.',
  '    Fees',
  '    * ceramic: 도자기의',
  '① first', '② second', '③ third', '④ fourth', '⑤ fifth',
]

test('notice note keeps a wrapped operational footnote and attaches its detached reference marker', () => {
  const p = passageOf(kiceNotice, { keepEnglishNotes: true })
  assert.match(p, /Hours\* Weekdays/)
  assert.match(p, /\* The museum is closed on the first Monday of every month\. Fees/)
  assert.doesNotMatch(p, /ceramic:|도자기|①/)
})

test('without the notice option the footnote is dropped and the detached marker stays as extracted', () => {
  const p = passageOf(kiceNotice)
  assert.doesNotMatch(p, /The museum is closed/)
  assert.match(p, /Hours \* Weekdays/)
})

test('a single-line operational footnote between list lines is kept (M1809#26 shape)', () => {
  const block = ['26. 다음 안내문의 내용과 일치하지 않는 것은?', 'What to donate:', 'Clothes, bags, books, and small electronics', '* No cash donations will be accepted.', 'How to donate:', '① a', '② b', '③ c', '④ d', '⑤ e']
  assert.match(passageOf(block, { keepEnglishNotes: true }), /small electronics \* No cash donations will be accepted\. How to donate:/)
})
