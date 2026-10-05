// scripts/textbook/frym-synthetic/f02-synthetic.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { analyzeF02Synthetic, buildF02Synthetic, verifyF02SyntheticEvidence } from './f02-synthetic.mjs'

const built = buildF02Synthetic()
const response = packet => ({
  packet_id: packet.packet_id,
  model: 'independent-response-model-v1',
  model_family: 'response-family',
  scorer_model: 'blind-rubric-model-v1',
  scorer_family: 'scoring-family',
  replica_id: 'r1',
  scoring_key_hash: built.seal.scoring_key_hash,
  student_prompt_sha256: 'a'.repeat(64),
  scorer_prompt_sha256: 'b'.repeat(64),
  student_invocation_sha256: 'e'.repeat(64),
  scorer_invocation_sha256: 'f'.repeat(64),
  respondent_raw_sha256: 'c'.repeat(64),
  scorer_raw_sha256: 'd'.repeat(64),
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
  assert.throws(() => analyzeF02Synthetic([{ ...valid, student_prompt_sha256: undefined }], built), /provenance/)
  assert.throws(() => analyzeF02Synthetic([valid, valid], built), /Duplicate/)
  assert.throws(() => analyzeF02Synthetic([{ ...valid, packet_id: '0'.repeat(64) }], built), /provenance/)
})

test('the 28 recorded model outputs verify against original provider bytes', () => {
  const rows = JSON.parse(readFileSync(new URL('./evidence/f02-smoke-v1.responses.json', import.meta.url), 'utf8'))
  const bundle = JSON.parse(readFileSync(new URL('./evidence/f02-smoke-v1.raw.json', import.meta.url), 'utf8'))
  assert.equal(verifyF02SyntheticEvidence(rows, bundle, built).verified_raw_outputs, 28)
  const changed = structuredClone(bundle)
  changed.entries[0].respondent_raw_base64 = `A${changed.entries[0].respondent_raw_base64.slice(1)}`
  assert.throws(() => verifyF02SyntheticEvidence(rows, changed, built), /raw output hash mismatch/)
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
    if (process.platform !== 'win32') return
    const packetPath = join(target, `${built.packets[0].packet_id}.json`)
    writeFileSync(packetPath, JSON.stringify({ ...packet, passage: 'changed' }))
    const runner = fileURLToPath(new URL('./f02-smoke-run.mjs', import.meta.url))
    const changedPacket = spawnSync(process.execPath, [runner, target, '1'], { encoding: 'utf8' })
    assert.notEqual(changedPacket.status, 0)
    assert.match(changedPacket.stderr, /Blind packet .* changed/)
    assert.deepEqual(JSON.parse(readFileSync(join(target, 'responses.json'), 'utf8')), [])
    assert.equal(JSON.parse(readFileSync(join(target, 'run-summary.json'), 'utf8')).valid_rows, 0)
    writeFileSync(packetPath, JSON.stringify(packet))
    writeFileSync(join(target, `claude-${built.packets[0].packet_id}.json`), JSON.stringify({ prompt_sha256: '0'.repeat(64), result: '{"answers":[]}' }))
    const stalePrompt = spawnSync(process.execPath, [runner, target, '1'], { encoding: 'utf8' })
    assert.notEqual(stalePrompt.status, 0)
    assert.match(stalePrompt.stderr, /Student invocation changed/)
    writeFileSync(join(target, 'seal.json'), JSON.stringify({ ...built.seal, seal_sha256: '0'.repeat(64) }))
    const changedSeal = spawnSync(process.execPath, [runner, target, '1'], { encoding: 'utf8' })
    assert.notEqual(changedSeal.status, 0)
    assert.match(changedSeal.stderr, /Synthetic seal changed/)
  } finally {
    const absoluteRoot = realpathSync(root)
    const absoluteTemp = realpathSync(tmpdir())
    assert.ok(absoluteRoot.startsWith(`${absoluteTemp}${sep}`))
    rmSync(absoluteRoot, { recursive: true, force: true })
  }
})
