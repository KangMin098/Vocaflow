// scripts/csat/__tests__/source-origin-search.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { selectFingerprints, searchSegments, documentFrequencies, searchQueries, searchAttemptKey } from '../source-origin-search.mjs'

test('insertion sentence, order blocks, vocabulary markers and blanks never join', () => {
  const text = "I have not exactly pinpointed Maddy's character since wickedness takes many forms. Imagine I describe someone in detail using several common words. (A) Some discoveries seem to entail numerous phases and discoverers none are isolated. (B) Another completely distinct passage contains enough words for an independent search. ① What cell metabolism and structure should be complex would not be surprising. Information was the key to their ______ these firms worked in relative secrecy."
  const parts = searchSegments(text)
  const phrases = selectFingerprints(text, documentFrequencies([text]), 1)
  assert.ok(phrases.length)
  for (const phrase of phrases) assert.ok(parts.some(words => words.join(' ').includes(phrase)))
  assert.ok(!phrases.some(p => /forms Imagine|isolated Another|surprising Information|their these/.test(p)))
})

test('summary answer sentence is excluded, numeric content and parentheses are boundaries', () => {
  const text = 'The history of the discovery in 1920 contains several important observations. Scientific explanations can be made by seeking the (A) ______ number of principles or finding (B) ______ observations.'
  const parts = searchSegments(text, 'R-SUMMARY').flat().join(' ')
  assert.ok(parts.includes('1920'))
  assert.ok(!parts.includes('Scientific explanations'))
  const split = searchSegments('The original quoted statement here includes at least seven words (edited phrase) the next portion also contains seven distinct usable words')
  assert.equal(split.length, 2)
})

test('query attempts have distinct provider/query/attempt identities', () => {
  const row = { passage_sha256: 'a'.repeat(64), query: 'first phrase' }
  assert.notEqual(searchAttemptKey(row), searchAttemptKey({ ...row, query: 'second phrase' }))
  assert.notEqual(searchAttemptKey(row), searchAttemptKey({ ...row, attempt_id: '20261004-1' }))
  assert.deepEqual(searchQueries(['one two three four five six seven eight nine']), ['"one two three four five six seven eight"'])
})

test('raw writer retains two queries, and retries of the same attempt are idempotent', () => {
  const root = path.resolve('scripts/csat/source-origin-work')
  fs.mkdirSync(root, { recursive: true })
  const dir = fs.mkdtempSync(path.join(root, 'regression-'))
  const output = path.join(dir, 'raw.jsonl')
  const base = { passage_sha256: 'a'.repeat(64), representative_item_id: 'fixture#38', raw_search: 'no result', attempt_id: 'fixed-attempt' }
  const write = rows => {
    const run = spawnSync(process.execPath, ['scripts/csat/source-origin-raw-write.mjs', '--output', output], { input: JSON.stringify(rows), encoding: 'utf8' })
    assert.equal(run.status, 0, run.stderr)
  }
  try {
    write([{ ...base, query: 'first' }]); write([{ ...base, query: 'second' }]); write([{ ...base, query: 'first' }])
    const rows = fs.readFileSync(output, 'utf8').trim().split('\n').map(JSON.parse)
    assert.equal(rows.length, 2)
    assert.deepEqual(new Set(rows.map(r => r.query)), new Set(['first', 'second']))
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
