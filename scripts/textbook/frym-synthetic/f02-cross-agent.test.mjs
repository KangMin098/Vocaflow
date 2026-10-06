// scripts/textbook/frym-synthetic/f02-cross-agent.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildF02Synthetic } from './f02-synthetic.mjs'
import { evidencePolicy, parseAnswers, requestFor, stageC, verifyStage } from './f02-cross-agent.mjs'

test('student packet excludes scoring key and grader excludes profile', () => {
  const built = buildF02Synthetic(), packet = built.packets[0]
  const student = requestFor(packet, 'student')
  const grader = requestFor(packet, 'grader', [{ id: packet.body.questions[0].id, answer: 'x' }], built.scoringKey)
  assert.ok(student.stdin.includes('ability_constraints'))
  assert.ok(!student.stdin.includes('rubrics'))
  assert.ok(grader.stdin.includes('rubrics'))
  assert.ok(!grader.stdin.includes('ability_constraints'))
  assert.equal(evidencePolicy.provider_attested, false)
})

test('student answer cannot smuggle profile fields into blind grading', () => {
  const packet = buildF02Synthetic().packets[0]
  const answers = packet.body.questions.map(question => ({ id: question.id, answer: 'unsure' }))
  assert.equal(parseAnswers(JSON.stringify({ answers }), packet).length, 12)
  answers[0].ability_constraints = { inference: 'high' }
  assert.throws(() => parseAnswers(JSON.stringify({ answers }), packet), /STUDENT_ANSWERS_INVALID/)
})

test('incomplete local audit never counts as synthetic validation', () => {
  const temp = mkdtempSync(join(tmpdir(), 'f02-cross-test-'))
  try {
    writeFileSync(join(temp, 'run.json'), JSON.stringify({ seal_sha256: buildF02Synthetic().seal.seal_sha256, planned: 1, pairs: [] }))
    assert.throws(() => verifyStage(temp), /RUN_INCOMPLETE/)
  } finally { rmSync(temp, { recursive: true, force: true }) }
})

test('actual Stage A evidence rejects raw, request, identity and run mixing', { skip: !process.env.F02_STAGE_A_FIXTURE }, () => {
  const source = process.env.F02_STAGE_A_FIXTURE
  const make = () => {
    const temp = mkdtempSync(join(tmpdir(), 'f02-cross-tamper-'))
    cpSync(source, temp, { recursive: true })
    return temp
  }
  const first = JSON.parse(readFileSync(join(source, 'run.json'), 'utf8')).pairs[0]
  const graderInput = readFileSync(join(source, `${first.grader}.stdin`), 'utf8')
  assert.ok(graderInput.startsWith('INSTRUCTIONS\n'))
  assert.ok(graderInput.includes('Independently grade'))
  assert.ok(!graderInput.includes('ability_constraints'))
  const variants = [
    ['packet hash', `${first.student}.record.json`, value => { value.packet_sha256 = '0'.repeat(64); return JSON.stringify(value) }],
    ['profile hash', `${first.student}.record.json`, value => { value.profile_sha256 = '0'.repeat(64); return JSON.stringify(value) }],
    ['session id', `${first.student}.record.json`, value => { value.session_id = 'wrong'; return JSON.stringify(value) }],
    ['run id', `${first.grader}.record.json`, value => { value.run_id = 'wrong'; return JSON.stringify(value) }],
    ['cli version', `${first.student}.record.json`, value => { value.cli_version = ''; return JSON.stringify(value) }],
    ['requested model', `${first.student}.record.json`, value => { value.model_requested = 'wrong'; return JSON.stringify(value) }],
    ['observed model', `${first.student}.record.json`, value => { value.model_observed = 'wrong'; return JSON.stringify(value) }],
    ['command argv', `${first.student}.manifest.json`, value => { value.argv = ['wrong']; return JSON.stringify(value) }],
    ['missing invocation id', `${first.student}.record.json`, value => { value.invocation_id = ''; return JSON.stringify(value) }],
    ['self grade', `${first.grader}.record.json`, value => { value.family = 'anthropic'; return JSON.stringify(value) }],
    ['parsed answer', `${first.student}.record.json`, value => { value.parsed[0].answer = 'wrong'; return JSON.stringify(value) }],
    ['parsed score', `${first.grader}.record.json`, value => { value.parsed[0].score = 0.5; return JSON.stringify(value) }],
    ['system prompt', `${first.student}.system`, value => value + ' changed'],
    ['student raw stdout', `${first.student}.stdout`, value => value + ' changed'],
    ['grader raw stdout', `${first.grader}.stdout`, value => value + ' changed'],
    ['missing stdout', `${first.student}.stdout`, () => ''],
    ['grader request', `${first.grader}.stdin`, value => value + ' changed']
  ]
  assert.doesNotThrow(() => verifyStage(source))
  for (const [label, file, mutate] of variants) {
    const temp = make()
    try {
      const path = join(temp, file), original = readFileSync(path, 'utf8')
      const object = file.endsWith('.json') ? JSON.parse(original) : original
      writeFileSync(path, mutate(object))
      assert.throws(() => verifyStage(temp), undefined, label)
    } finally { rmSync(temp, { recursive: true, force: true }) }
  }
})

test('actual bidirectional CLI evidence rejects all Stage C mutations', { skip: !process.env.F02_STAGE_A_FIXTURE || !process.env.F02_STAGE_B_FIXTURE }, () => {
  const result = stageC(process.env.F02_STAGE_A_FIXTURE, process.env.F02_STAGE_B_FIXTURE)
  assert.equal(result.evidence_level, 'E3')
  assert.equal(result.tamper_checks, 69)
  assert.equal(result.synthetic_validation_valid_n, 0)
})
