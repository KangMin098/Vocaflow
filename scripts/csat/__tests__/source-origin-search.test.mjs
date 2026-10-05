// scripts/csat/__tests__/source-origin-search.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { alternativeQueries, documentFrequencies, searchSegments } from '../source-origin-search.mjs'

test('short and dual anchors remain in original exam blocks and exclude edited summary', () => {
  const passage = 'Auditory looming protects rhesus monkeys from approaching dangers and other hazards. (A) Distinctive rhinoceros examples illustrate the evolutionary benefit of predictable errors. (B) Natural selection favors safety over accuracy in dangerous situations.'
  const queries = alternativeQueries(passage, documentFrequencies([passage]), 1)
  assert.equal(queries[0].strategy, 'dual_anchor')
  assert.ok(queries.filter(q => q.strategy === 'short_phrase').length >= 2)
  const segments = searchSegments(passage).map(words => words.join(' '))
  for (const row of queries) for (const [, phrase] of row.query.matchAll(/"([^"]+)"/g)) {
    assert.equal(phrase.split(' ').length, 4)
    assert.ok(segments.some(segment => segment.includes(phrase)))
  }
  const summary = passage + '\nOriginal sentences contain several more searchable descriptive terms.\nScientific findings are summarized using (A) ______ and (B) ______ explanations.'
  assert.ok(alternativeQueries(summary, documentFrequencies([summary]), 1, 'R-SUMMARY').every(row => !row.query.includes('Scientific findings')))
})

test('rare phrase wins over shared vocabulary and unusable bodies yield no invented query', () => {
  const passage = 'The common words describe shared facts about the unusual axolotl regeneration mechanism.'
  const frequencies = documentFrequencies([passage, ...Array(20).fill('The common words describe shared facts about the same ordinary objects today.')])
  const queries = alternativeQueries(passage, frequencies, 21)
  assert.equal(queries[0].query, '"unusual axolotl regeneration mechanism"')
  assert.deepEqual(alternativeQueries('① ______ 한글', frequencies, 21), [])
})

test('accented Latin names remain intact in quoted searches', () => {
  const passage = 'The zebra-striped Atitlán Giant Grebe lived peacefully on Lake Atitlán in Guatemala.'
  for (const input of [passage, passage.normalize('NFD')]) {
    const queries = alternativeQueries(input, documentFrequencies([input]), 1)
    assert.ok(queries.some(row => row.query.includes('Atitlán')))
    assert.ok(queries.every(row => !row.query.includes('Atitl n')))
    for (const row of queries) for (const [, phrase] of row.query.matchAll(/"([^"]+)"/g)) {
      assert.ok(passage.includes(phrase))
    }
  }
})
