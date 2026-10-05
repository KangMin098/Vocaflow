// scripts/textbook/academic-reading-smoke/check-f02-freeze.test.mjs
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reviewIdentity } from '../academic-reading-review.mjs'
import { targetMatches } from './check-f02-freeze.mjs'

const base = '.agent-logs/academic-reading-f02-r2/'
const frozen = JSON.parse(readFileSync('scripts/textbook/frym-validation/f02-calibration-freeze.json'))
test('F02 review binding covers title, analysis, rights, passage and target', () => {
  for (const [folder, grade] of [['middle1', 'middle_1'], ['high1', 'high_1']]) {
    const draft = JSON.parse(readFileSync(`${base}${folder}/chunk-00.out.json`))[0]
    const exported = JSON.parse(readFileSync(`${base}${folder}/chunk-00.json`))[0]
    const expected = frozen.variants.find(v => v.grade === grade)
    assert.equal(reviewIdentity(draft, exported).draft_hash, expected.draft_hash)
    assert.notEqual(reviewIdentity({ ...draft, title: `${draft.title} Changed` }, exported).draft_hash, expected.draft_hash)
    assert.notEqual(reviewIdentity({ ...draft, text: `${draft.text} Changed` }, exported).draft_hash, expected.draft_hash)
    const analysis = draft.reading.reading_analysis
    assert.notEqual(reviewIdentity({ ...draft, reading: { ...draft.reading, reading_analysis: { ...analysis, passage_profile: { ...analysis.passage_profile, lexical_level: { ...analysis.passage_profile.lexical_level, evidence: 'Changed difficulty evidence' } } } } }, exported).draft_hash, expected.draft_hash)
    assert.notEqual(reviewIdentity({ ...draft, reading: { ...draft.reading, source_rights: { ...draft.reading.source_rights, original_author: 'Changed author' } } }, exported).draft_hash, expected.draft_hash)
    assert.notEqual(reviewIdentity(draft, { ...exported, reading: { ...exported.reading, target: { ...exported.reading.target, reasoning_band: grade === 'middle_1' ? 'high_1' : 'middle_1' } } }).target_hash, expected.target_hash)
    const packet = JSON.parse(readFileSync(`${base}F02-review-packet.json`)).adaptations.find(a => a.target.age_band === grade)
    assert.equal(targetMatches(draft, exported, packet), true)
    assert.equal(targetMatches({ ...draft, reading: { ...draft.reading, target: { ...draft.reading.target, reasoning_band: grade === 'middle_1' ? 'high_1' : 'middle_1' } } }, exported, packet), false)
  }
})
