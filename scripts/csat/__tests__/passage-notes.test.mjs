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
