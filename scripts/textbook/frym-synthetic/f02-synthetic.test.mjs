// scripts/textbook/frym-synthetic/f02-synthetic.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { analyzeF02Synthetic, buildF02Synthetic } from './f02-synthetic.mjs'

const built = buildF02Synthetic()
const response = packet => ({
  packet_id: packet.packet_id,
  model: 'independent-response-model-v1',
  model_family: 'response-family',
  scorer_model: 'blind-rubric-model-v1',
  scorer_family: 'scoring-family',
  replica_id: 'r1',
  scoring_key_hash: built.seal.scoring_key_hash,
  answers: packet.body.questions.map(({ id }) => ({ id, answer: 'A nonempty diagnostic response.' })),
  scores: packet.body.questions.map(({ id }) => ({ id, score: 0.5 }))
})

test('blind F02 packets bind current freeze and omit scoring and target metadata', () => {
  assert.equal(built.packets.length, 28)
  assert.equal(new Set(built.packets.map(packet => packet.packet_id)).size, 28)
  for (const packet of built.packets) {
    assert.equal(packet.body.questions.length, 12)
    assert.ok(!JSON.stringify(packet.body).includes('scoring_rubric'))
    assert.ok(!JSON.stringify(packet.body).includes('source_quote'))
    assert.ok(!Object.hasOwn(packet.body, 'passage_variant'))
    assert.ok(!Object.hasOwn(packet.body, 'scoring_key'))
  }
})

test('synthetic diagnostic reports item statistics but never grants validation or seed', () => {
  const empty = analyzeF02Synthetic([], built)
  assert.equal(empty.n_model_outputs, 0)
  assert.equal(empty.target_fit, 'NOT_CALIBRATED')
  assert.equal(empty.gold_s, false)
  const middle = built.packets.find(packet => packet.profile_id === 'middle_1:mid' && packet.passage_variant === 'middle_1')
  const high = built.packets.find(packet => packet.profile_id === 'middle_1:mid' && packet.passage_variant === 'high_1')
  const result = analyzeF02Synthetic([response(middle), response(high)], built)
  assert.equal(result.matched_profile_pairs, 1)
  assert.equal(result.by_variant.middle_1.items[0].synthetic_facility, 0.5)
  assert.equal(result.irt.status, 'not_estimated')
  assert.equal(result.cross_model_consensus.status, 'INSUFFICIENT_MODEL_FAMILIES')
  assert.equal(result.target_fit, 'NOT_CALIBRATED')
  assert.equal(result.level_separation, 'NOT_CALIBRATED')
  assert.equal(result.educationally_validated, false)
  assert.equal(result.gold_s, false)
  assert.equal(result.db_seed, false)
})

test('response import rejects self-scoring, missing answers, altered keys, and duplicates', () => {
  const packet = built.packets[0]
  const valid = response(packet)
  assert.throws(() => analyzeF02Synthetic([{ ...valid, scorer_family: valid.model_family }], built), /provenance/)
  assert.throws(() => analyzeF02Synthetic([{ ...valid, answers: valid.answers.slice(1) }], built), /incomplete/)
  assert.throws(() => analyzeF02Synthetic([{ ...valid, scoring_key_hash: '0'.repeat(64) }], built), /provenance/)
  assert.throws(() => analyzeF02Synthetic([valid, valid], built), /Duplicate/)
  assert.throws(() => analyzeF02Synthetic([{ ...valid, packet_id: '0'.repeat(64) }], built), /provenance/)
})

test('CLI exports only blind packet files and an identity seal to a new directory', () => {
  const root = mkdtempSync(join(tmpdir(), 'vocaflow-f02-synthetic-'))
  const target = join(root, 'packets')
  try {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./f02-synthetic.mjs', import.meta.url)), 'export', target], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(readdirSync(target).length, 29)
    assert.deepEqual(JSON.parse(readFileSync(join(target, 'seal.json'), 'utf8')), built.seal)
    const packet = JSON.parse(readFileSync(join(target, `${built.packets[0].packet_id}.json`), 'utf8'))
    assert.ok(!Object.hasOwn(packet, 'passage_variant'))
    assert.ok(!JSON.stringify(packet).includes('scoring_rubric'))
  } finally {
    const absoluteRoot = realpathSync(root)
    const absoluteTemp = realpathSync(tmpdir())
    assert.ok(absoluteRoot.startsWith(`${absoluteTemp}${sep}`))
    rmSync(absoluteRoot, { recursive: true, force: true })
  }
})
